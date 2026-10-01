import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Smile, 
  Paperclip, 
  Phone, 
  MoreVertical, 
  Search, 
  Check, 
  CheckCheck, 
  ArrowLeft,
  Sparkles,
  RefreshCw,
  Building2,
  Download,
  Users,
  Terminal,
  Radio,
  ExternalLink,
  MessageCircle,
  HelpCircle,
  Copy,
  X
} from 'lucide-react';
import { ref, get, set, onChildAdded } from 'firebase/database';
import { db } from '../firebase';
import { api } from '../services/api';
import { Conversation } from '../types/studio';
import { WHATSAPP_BRIDGE_SOURCE_CODE } from '../data/bridgeScriptContent';

export interface WhatsAppMessage {
  id: string;
  sender: 'user' | 'bot'; // user = white bubble (incoming customer), bot = green bubble #DCF8C6 (outgoing representative)
  text: string;
  timestamp: string;
  status?: 'sent' | 'delivered' | 'read';
  isMenuCard?: boolean;
  options?: string[];
  dispatchedToWhatsApp?: boolean;
}

interface WhatsAppChatProps {
  initialRecipient?: string;
  customerName?: string;
  onBack?: () => void;
  isStandalone?: boolean;
}

export const WhatsAppChat: React.FC<WhatsAppChatProps> = ({
  initialRecipient = '+972 50-886-0896',
  customerName = 'ראמי מסארווה (050-886-0896)',
  onBack,
  isStandalone = false
}) => {
  // Active conversation state
  const [activePhone, setActivePhone] = useState(initialRecipient);
  const [activeCustomerName, setActiveCustomerName] = useState(customerName);
  const [conversationsList, setConversationsList] = useState<Conversation[]>([]);
  const [isConversationsOpen, setIsConversationsOpen] = useState(false);
  const [showBridgeModal, setShowBridgeModal] = useState(false);
  const [copiedBridgeCode, setCopiedBridgeCode] = useState(false);

  // Client-Side Direct Blob Download (100% reliable, no 302 or network issues)
  const handleDownloadBridgeScript = (ext: 'js' | 'cjs' = 'cjs') => {
    try {
      const code = ext === 'cjs' 
        ? WHATSAPP_BRIDGE_SOURCE_CODE.replace("import { createRequire } from 'module';\nconst require = createRequire(import.meta.url);\n\n", "")
        : WHATSAPP_BRIDGE_SOURCE_CODE;
      const fileName = `whatsapp-web.${ext}`;
      const blob = new Blob([code], { type: 'application/javascript;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      window.open(`/whatsapp-web.${ext}`, '_blank');
    }
  };

  // Copy full source code to clipboard
  const handleCopyBridgeScript = () => {
    navigator.clipboard.writeText(WHATSAPP_BRIDGE_SOURCE_CODE).then(() => {
      setCopiedBridgeCode(true);
      setTimeout(() => setCopiedBridgeCode(false), 3000);
    });
  };

  // Mode: 'operator' (sends to customer's WhatsApp) vs 'simulate_customer' (tests incoming message)
  const [chatMode, setChatMode] = useState<'operator' | 'simulate_customer'>('operator');

  // Messages state
  const [messages, setMessages] = useState<WhatsAppMessage[]>([
    {
      id: 'm1',
      sender: 'bot',
      text: 'שלום וברוכים הבאים לח. סבן חומרי בניין בע״מ (כפר ברא) 🏗️\nאיך נוכל לעזור לכם היום?',
      timestamp: '09:00',
      status: 'read'
    },
    {
      id: 'm2',
      sender: 'bot',
      text: 'ח. סבן 🏗️ ברוכים הבאים\nאנא בחרו שירות רצוי להמשך מיידי:',
      timestamp: '09:00',
      status: 'read',
      isMenuCard: true,
      options: [
        '🚚 הזמנה והובלה',
        '🏪 איסוף עצמי מכפר ברא',
        '🗑️ מכולה לפינוי פסולת',
        '📍 מעקב הזמנה'
      ]
    }
  ]);

  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [sendSuccessToast, setSendSuccessToast] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Quick-Reply Templates for Saban Building Materials
  const quickTemplates = [
    { id: 'q_menu', label: '📋 שלח תפריט סבן', text: 'ח. סבן חומרי בניין 🏗️\nברוכים הבאים למרכז ההזמנות! הקלד מספר לבחירה:\n1 - 🚚 הזמנה והובלה לאתר\n2 - 🏭 איסוף עצמי ושעות פעילות\n3 - 🗑️ מכולות פסולת (6/8/12 קוב)\n4 - 🔍 מעקב משלוח ונהגים' },
    { id: 'q1', label: '🚚 יצא להובלה', text: 'היי, ההזמנה יצאה להובלה עם הנהג ראמי 🚚\nצפי הגעה כשעה. 📍 כתובת סופקה' },
    { id: 'q2', label: '🏪 מוכן לאיסוף', text: 'היי 👋 ההזמנה מוכנה לאיסוף במחסן כפר ברא 🏗️\nשעות פתיחה: 06:00-17:00\nרמי: 050-886-0896' },
    { id: 'q3', label: '🗑️ מכולה בדרך', text: 'המכולה בדרך אליך 🗑️\nהנהג ייצור קשר 30 דק לפני הגעה. נא להכין גישה למשאית.' },
    { id: 'q4', label: '📍 שלח מיקום', text: 'היי, תוכל לשלוח מיקום מדויק בוואטסאפ? 📍\nלחץ על 📎 > מיקום > שלח מיקום נוכחי' },
    { id: 'q5', label: '💰 חשבונית/תשלום', text: 'חשבונית מס מצורפת 💰\nלתשלום בביט / העברה בנקאית. תודה!' },
    { id: 'q6', label: '❓ עזרה ובירור', text: 'היי, נציג ח. סבן זמין עבורך לכל שאלה בטלפון 050-886-0896 🏗️' }
  ];

  const getCurrentTime = () => {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Load live conversations from server and select active
  const loadConversations = async () => {
    try {
      const data: any = await api.getConversations();
      const list = Array.isArray(data) ? data : (data?.conversations || []);
      if (Array.isArray(list) && list.length > 0) {
        setConversationsList(list);
        const match = list.find((c: Conversation) => 
          c.from.replace(/[^0-9]/g, '') === activePhone.replace(/[^0-9]/g, '')
        );
        if (match && match.messages && match.messages.length > 0) {
          const mapped: WhatsAppMessage[] = match.messages.map((m: any) => ({
            id: m.id || `m_${Math.random()}`,
            sender: m.direction === 'incoming' ? 'user' : 'bot',
            text: m.text,
            timestamp: m.timestamp ? new Date(m.timestamp).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : getCurrentTime(),
            status: 'read',
            dispatchedToWhatsApp: m.direction === 'outgoing'
          }));
          setMessages(mapped);
        }
      }
    } catch (e) {
      console.warn('Failed to load conversations from server:', e);
    }
  };

  // Initial fetch and 2.5s polling loop
  useEffect(() => {
    loadConversations();
    const interval = setInterval(loadConversations, 2500);
    return () => clearInterval(interval);
  }, [activePhone]);

  // Real-time Firebase RTDB Listener for instant sync
  useEffect(() => {
    const incomingRef = ref(db, 'joni/incoming');
    const unsub = onChildAdded(incomingRef, (snap) => {
      const data = snap.val();
      if (!data) return;

      const phone = String(data.from || '').replace(/[^0-9]/g, '');
      const currentDigits = activePhone.replace(/[^0-9]/g, '');

      // If matches active chat or if global
      if (!currentDigits || phone.includes(currentDigits) || currentDigits.includes(phone)) {
        const text = data.text || data.incoming_text || '';
        const reply = data.reply || data.sent_response || '';

        setMessages(prev => {
          const updated = [...prev];
          if (text && !updated.some(m => m.text === text && m.sender === 'user')) {
            updated.push({
              id: `inc_${snap.key || Date.now()}`,
              sender: 'user',
              text,
              timestamp: getCurrentTime(),
              status: 'read'
            });
          }
          if (reply && !updated.some(m => m.text === reply && m.sender === 'bot')) {
            updated.push({
              id: `rep_${snap.key || Date.now()}`,
              sender: 'bot',
              text: reply,
              timestamp: getCurrentTime(),
              dispatchedToWhatsApp: true
            });
          }
          return updated;
        });
      }
    });

    return () => unsub();
  }, [activePhone]);

  // Switch to another conversation
  const selectConversation = (conv: Conversation) => {
    setActivePhone(conv.from);
    setActiveCustomerName(conv.customerName || conv.from);
    setIsConversationsOpen(false);
    if (conv.messages && conv.messages.length > 0) {
      const mapped: WhatsAppMessage[] = conv.messages.map((m: any) => ({
        id: m.id || `m_${Math.random()}`,
        sender: m.direction === 'incoming' ? 'user' : 'bot',
        text: m.text,
        timestamp: m.timestamp ? new Date(m.timestamp).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : getCurrentTime(),
        status: 'read',
        dispatchedToWhatsApp: m.direction === 'outgoing'
      }));
      setMessages(mapped);
    }
  };

  // SEND MESSAGE HANDLER
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isSending) return;

    setInputText('');
    setIsSending(true);

    if (chatMode === 'operator') {
      // 1. OPERATOR MODE: The representative replies -> LANDS IN WHATSAPP!
      const outMsg: WhatsAppMessage = {
        id: `out_${Date.now()}`,
        sender: 'bot', // Green WhatsApp bubble
        text,
        timestamp: getCurrentTime(),
        dispatchedToWhatsApp: true
      };

      setMessages(prev => [...prev, outMsg]);

      try {
        // 1. Send via Studio server
        const res = await api.sendConversationReply(
          `conv_${activePhone.replace(/[^0-9]/g, '')}`,
          text,
          activePhone,
          activeCustomerName
        );

        // 2. Also queue directly in Firebase RTDB so local whatsapp_bridge picks it up instantly
        try {
          const outKey = Date.now().toString();
          await set(ref(db, `joni/outbound/${outKey}`), {
            phone: activePhone,
            name: activeCustomerName,
            message: text,
            timestamp: Date.now()
          });
        } catch (fbErr) {
          console.warn('Firebase RTDB outbound queue warning:', fbErr);
        }

        setSendSuccessToast('🚀 המענה שוגר ונוחת בוואטסאפ של הלקוח!');
        setTimeout(() => setSendSuccessToast(null), 3500);

        if (res && res.conversation && res.conversation.messages) {
          // reload live state
          loadConversations();
        }
      } catch (err: any) {
        setSendSuccessToast(`שגיאה בשידור לוואטסאפ: ${err.message}`);
        setTimeout(() => setSendSuccessToast(null), 4000);
      } finally {
        setIsSending(false);
      }

    } else {
      // 2. SIMULATE CUSTOMER MODE: Incoming customer message -> AI replies
      const userMsg: WhatsAppMessage = {
        id: `usr_${Date.now()}`,
        sender: 'user', // White bubble
        text,
        timestamp: getCurrentTime(),
        status: 'read'
      };

      setMessages(prev => [...prev, userMsg]);
      setIsTyping(true);

      try {
        const data = await api.chatAi({
          from: activePhone.replace(/[^0-9]/g, ''),
          text,
          history: messages.map(m => ({
            role: m.sender === 'user' ? 'user' : 'model',
            text: m.text
          }))
        });

        setIsTyping(false);
        setIsSending(false);

        const botReply = data.reply || "תודה שפנית לח. סבן חומרי בניין כפר ברא 🏗️. נשמח לספק לך את כל חומרי הבניין הדרושים!";

        const botMsg: WhatsAppMessage = {
          id: `bot_${Date.now()}`,
          sender: 'bot',
          text: botReply,
          timestamp: getCurrentTime(),
          dispatchedToWhatsApp: true
        };

        setMessages(prev => [...prev, botMsg]);

        if (data.suggested_branches && data.suggested_branches.length > 0 && !data.reply.includes('בדיקה עברה בהצלחה')) {
          setTimeout(() => {
            setMessages(prev => [
              ...prev,
              {
                id: `menu_${Date.now()}`,
                sender: 'bot',
                text: 'אפשרויות זמינות לבחירה מהירה:',
                timestamp: getCurrentTime(),
                isMenuCard: true,
                options: data.suggested_branches
              }
            ]);
          }, 400);
        }

      } catch (err) {
        setIsTyping(false);
        setIsSending(false);
        setMessages(prev => [
          ...prev,
          {
            id: `bot_err_${Date.now()}`,
            sender: 'bot',
            text: 'סבן חומרי בניין - תודה על פנייתך! נציג שירות יחזור אליך בהקדם. 050-8860896 🏗️',
            timestamp: getCurrentTime()
          }
        ]);
      }
    }
  };

  const handleOptionClick = (option: string) => {
    handleSendMessage(option);
  };

  const setTemplate = (text: string) => {
    setInputText(text);
    inputRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#E5DDD5] select-none font-['Assistant',sans-serif] relative" dir="rtl">
      
      {/* WhatsApp Green Top Header (#075E54) */}
      <header className="bg-[#075E54] text-white px-3 py-2.5 flex items-center justify-between shadow-md z-10 shrink-0">
        <div className="flex items-center gap-2">
          {onBack && (
            <button 
              onClick={onBack}
              className="p-1 hover:bg-[#128C7E]/50 rounded-full transition-colors active:scale-95 cursor-pointer"
              title="חזור"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
          )}

          {/* Avatar with building logo */}
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-500 to-orange-400 flex items-center justify-center text-slate-950 font-bold border-2 border-emerald-300 shadow">
              <Building2 className="w-5 h-5 text-slate-900" />
            </div>
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-[#25D366] border-2 border-[#075E54] rounded-full"></span>
          </div>

          <div className="flex flex-col text-right">
            <div className="font-bold text-sm tracking-tight flex items-center gap-1.5">
              <span>{activeCustomerName}</span>
              <span className="text-[10px] bg-emerald-400/20 text-emerald-200 px-1.5 py-0.2 rounded font-mono font-normal dir-ltr">
                {activePhone}
              </span>
            </div>
            <div className="text-[11px] text-emerald-100/90 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse"></span>
              <span>קשר דו-כיווני פעיל: מענה ינחת ב-WhatsApp ⚡</span>
            </div>
          </div>
        </div>

        {/* Action icons & Bridge Dialog */}
        <div className="flex items-center gap-2 text-white/90">
          
          {/* Conversation Switcher Drawer Button */}
          <button
            onClick={() => setIsConversationsOpen(!isConversationsOpen)}
            className="px-2.5 py-1 text-xs bg-[#128C7E] hover:bg-[#25D366] hover:text-slate-950 text-white rounded-lg transition-all font-semibold flex items-center gap-1 active:scale-95 shadow-sm cursor-pointer"
            title="בחר שיחה מרשימת הלקוחות"
          >
            <Users className="w-3.5 h-3.5" />
            <span>שיחות ({conversationsList.length})</span>
          </button>

          {/* WhatsApp Bridge Daemon Help */}
          <button 
            onClick={() => setShowBridgeModal(true)}
            className="px-2.5 py-1 text-xs bg-slate-900/60 hover:bg-slate-900 text-emerald-300 border border-emerald-500/40 rounded-lg transition-all font-semibold flex items-center gap-1 active:scale-95 shadow-sm cursor-pointer"
            title="הורד והפעל סקריפט גשר לוואטסאפ"
          >
            <Terminal className="w-3.5 h-3.5 text-[#25D366]" />
            <span>סקריפט גשר</span>
          </button>

          {/* Manual Refresh */}
          <button 
            onClick={loadConversations}
            className="p-1.5 hover:bg-[#128C7E]/50 rounded-full transition-colors cursor-pointer" 
            title="רענן שיחה"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button 
            onClick={() => window.open(`tel:${activePhone.replace(/[^0-9+]/g, '')}`)}
            className="p-1.5 hover:bg-[#128C7E]/50 rounded-full transition-colors cursor-pointer" 
            title="חייג"
          >
            <Phone className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Mode Switcher Banner: Representative Reply vs Customer Simulation */}
      <div className="bg-[#0b5345] px-3 py-1.5 flex items-center justify-between text-xs text-emerald-100 border-b border-[#128C7E]/40 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-emerald-300">מצב פעולה:</span>
          <div className="flex items-center bg-slate-900/60 rounded-lg p-0.5 border border-emerald-500/30">
            <button
              onClick={() => setChatMode('operator')}
              className={`px-2.5 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                chatMode === 'operator'
                  ? 'bg-[#25D366] text-slate-950 shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              מענה נציג לוואטסאפ 📱 (ינחת בוואטסאפ)
            </button>
            <button
              onClick={() => setChatMode('simulate_customer')}
              className={`px-2.5 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                chatMode === 'simulate_customer'
                  ? 'bg-amber-400 text-slate-950 shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              סימולציית הודעת לקוח 🧪
            </button>
          </div>
        </div>

        <div className="text-[11px] text-emerald-200 hidden sm:block">
          {chatMode === 'operator' 
            ? '✅ כל הודעה שתישלח מכאן תשודר מיד לטלפון של הלקוח'
            : '🧪 ההודעה תישלח כלקוח לבדיקת תגובת נועה AI'}
        </div>
      </div>

      {/* Toast Notification */}
      {sendSuccessToast && (
        <div className="absolute top-14 left-1/2 transform -translate-x-1/2 z-30 bg-emerald-600 text-white font-bold px-4 py-2 rounded-xl shadow-2xl text-xs flex items-center gap-2 border border-emerald-400 animate-in fade-in slide-in-from-top-2">
          <CheckCheck className="w-4 h-4" />
          <span>{sendSuccessToast}</span>
        </div>
      )}

      {/* Conversations Drawer Modal */}
      {isConversationsOpen && (
        <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs z-30 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md max-h-[80%] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <span>בחירת שיחת WhatsApp פעילה</span>
              </h3>
              <button 
                onClick={() => setIsConversationsOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 border-b border-slate-800 space-y-1">
              <label className="text-[11px] text-slate-400">שיחה עם מספר חדש:</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="05X-XXXXXXX / 9725XXXXXXXX"
                  id="new_chat_phone"
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono dir-ltr text-left"
                />
                <button
                  onClick={() => {
                    const el = document.getElementById('new_chat_phone') as HTMLInputElement;
                    if (el && el.value.trim()) {
                      const num = el.value.trim();
                      setActivePhone(num);
                      setActiveCustomerName(`לקוח (${num})`);
                      setIsConversationsOpen(false);
                      setMessages([]);
                    }
                  }}
                  className="px-3 py-1.5 bg-[#25D366] text-slate-950 font-bold rounded-xl text-xs hover:bg-[#20bd5a]"
                >
                  פתח צ'אט
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1 divide-y divide-slate-800/60">
              {conversationsList.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => selectConversation(conv)}
                  className={`p-3 rounded-xl transition-all cursor-pointer flex items-center justify-between ${
                    conv.from.replace(/[^0-9]/g, '') === activePhone.replace(/[^0-9]/g, '')
                      ? 'bg-emerald-950/60 border border-emerald-500/50'
                      : 'hover:bg-slate-800'
                  }`}
                >
                  <div>
                    <div className="font-bold text-xs text-white flex items-center gap-2">
                      <span>{conv.customerName || 'לקוח'}</span>
                      <span className="text-[10px] text-slate-400 font-mono dir-ltr">{conv.from}</span>
                    </div>
                    <div className="text-[11px] text-slate-300 truncate max-w-[240px] mt-0.5">
                      {conv.lastMessage || 'אין הודעות'}
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                    {conv.messages?.length || 0} הודעות
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Bridge Help Modal */}
      {showBridgeModal && (
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl p-6 space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-[#25D366]" />
                <h3 className="font-bold text-sm text-white">סקריפט גשר WhatsApp Web (סגירת מעגל מלאה)</h3>
              </div>
              <button 
                onClick={() => setShowBridgeModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              סקריפט זה מאזין לחשבון הוואטסאפ האמיתי שלך באמצעות סריקת QR, משקף כל הודעה נכנסת בצ'אט הסטודיו, ומאזין לתור ההודעות היוצא מהממשק כדי שכל מענה שתקליד ינחת מיד בוואטסאפ של הלקוח!
            </p>

            <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-2 text-xs">
              <div className="text-emerald-400 font-bold">הוראות הפעלה פשוטות (3 צעדים בתיקייה C:\noa):</div>
              <ol className="list-decimal list-inside space-y-1.5 text-slate-300 text-[11px]">
                <li>
                  הורד את הקובץ ישירות ל-<b>C:\noa\whatsapp-web.cjs</b> (או <b>whatsapp-web.js</b>):
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => handleDownloadBridgeScript('cjs')}
                      className="px-3 py-1.5 bg-[#25D366] hover:bg-[#20bd5a] text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 shadow transition-all cursor-pointer"
                      title="מומלץ ל-Windows ולפרויקטים עם type: module"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>הורד whatsapp-web.cjs (מומלץ)</span>
                    </button>
                    <button
                      onClick={() => handleDownloadBridgeScript('js')}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 font-semibold rounded-lg text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>whatsapp-web.js</span>
                    </button>
                    <button
                      onClick={handleCopyBridgeScript}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      {copiedBridgeCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedBridgeCode ? 'הקוד הועתק!' : 'העתק קוד'}</span>
                    </button>
                  </div>
                </li>
                <li>בטרמינל/CMD בתיקיית <b>C:\noa</b> הרץ פעם אחת (אם טרם הותקן):
                  <div className="p-2 mt-1 bg-slate-900 rounded-xl font-mono text-[10px] text-cyan-300 dir-ltr text-left">
                    npm install whatsapp-web.js qrcode-terminal qrcode express cors
                  </div>
                </li>
                <li>הפעל את השרת:
                  <div className="p-2 mt-1 bg-slate-900 rounded-xl font-mono text-[10px] text-emerald-300 dir-ltr text-left font-bold">
                    node whatsapp-web.cjs
                  </div>
                </li>
              </ol>

              {/* Helpful tips */}
              <div className="mt-2 p-2.5 bg-emerald-950/30 border border-emerald-500/30 rounded-xl text-[10px] text-emerald-200/90 leading-relaxed">
                <span className="font-bold text-emerald-300">⚡ סגירת מעגל מלאה:</span>
                <span className="mr-1">
                  כל הודעה נכנסת בוואטסאפ מופיעה מיד כאן בצ'אט, וכל מענה שתקליד בממשק הצ'אט נשלח פיזית לוואטסאפ של הלקוח.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => handleDownloadBridgeScript('cjs')}
                className="px-4 py-2 bg-[#25D366] hover:bg-[#20bd5a] text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-[#25D366]/20 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>הורד את whatsapp-web.cjs</span>
              </button>

              <button
                onClick={() => setShowBridgeModal(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs cursor-pointer"
              >
                סגור
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Messages Scroll Area with WhatsApp Doodle Pattern */}
      <div 
        className="flex-1 overflow-y-auto p-4 space-y-2.5 relative"
        style={{
          backgroundColor: '#E5DDD5',
          backgroundImage: `radial-gradient(#000000 0.75px, transparent 0.75px)`,
          backgroundSize: '16px 16px',
          backgroundPosition: '0 0',
          opacity: 1
        }}
      >
        {/* Date bubble */}
        <div className="flex justify-center mb-3">
          <span className="bg-white/80 backdrop-blur-sm text-slate-600 text-[11px] px-3 py-1 rounded-lg shadow-sm border border-slate-200/60 font-medium">
            היום • שיחת שירות לקוחות סבן ({activeCustomerName})
          </span>
        </div>

        {/* Message Bubbles */}
        {messages.map((m) => {
          const isUser = m.sender === 'user';

          return (
            <div 
              key={m.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[85%] md:max-w-[70%] ${isUser ? 'mr-auto' : 'ml-auto'}`}
            >
              {/* WhatsApp Bubble */}
              <div 
                className={`p-3 relative shadow-sm text-slate-800 text-sm leading-relaxed transition-all ${
                  isUser 
                    ? 'bg-[#FFFFFF] text-slate-900 rounded-[7.5px] rounded-tl-none border border-slate-200/80 shadow-slate-300/40' 
                    : 'bg-[#DCF8C6] text-slate-950 rounded-[7.5px] rounded-tr-none shadow-emerald-900/10'
                }`}
              >
                {/* Header label for clarity */}
                <div className="text-[10px] font-bold mb-1 opacity-70 flex items-center justify-between gap-3">
                  <span>{isUser ? activeCustomerName : 'ח. סבן (נציג)'}</span>
                  {!isUser && (
                    <span className="text-[9px] text-emerald-800 bg-emerald-700/15 px-1.5 py-0.2 rounded font-normal">
                      נחת בוואטסאפ ✓✓
                    </span>
                  )}
                </div>

                {/* Text Content */}
                <div className="whitespace-pre-wrap font-['Assistant',sans-serif] text-sm">
                  {m.text}
                </div>

                {/* Styled Menu Card if message has options */}
                {m.isMenuCard && m.options && (
                  <div className="mt-2.5 pt-2 border-t border-emerald-600/20 space-y-1.5">
                    {m.options.map((opt, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleOptionClick(opt)}
                        className="w-full text-right bg-white hover:bg-emerald-50 active:scale-98 border border-[#25D366] text-slate-900 font-semibold px-3 py-2 rounded-xl text-xs transition-all shadow-sm flex items-center justify-between group cursor-pointer"
                      >
                        <span>{opt}</span>
                        <span className="text-[#25D366] group-hover:translate-x-[-2px] transition-transform text-sm font-bold">
                          ‹
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Timestamp & double ticks */}
                <div className={`flex items-center gap-1 justify-end text-[10px] mt-1 ${isUser ? 'text-slate-400' : 'text-slate-500'}`}>
                  <span>{m.timestamp}</span>
                  {!isUser && (
                    <CheckCheck className="w-3.5 h-3.5 text-[#34B7F1]" />
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex items-start ml-auto">
            <div className="bg-[#DCF8C6] px-3.5 py-2 rounded-[7.5px] rounded-tr-none shadow-sm flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-bounce"></span>
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-bounce [animation-delay:0.2s]"></span>
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-bounce [animation-delay:0.4s]"></span>
              <span className="text-xs text-emerald-800 font-medium mr-1.5">נועה AI מנסחת מענה...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick-Reply Templates Horizontal Scroll Bar */}
      <div className="bg-[#F0F2F5] px-3 py-2 border-t border-slate-200">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {quickTemplates.map(t => (
            <button
              key={t.id}
              onClick={() => setTemplate(t.text)}
              className="whitespace-nowrap px-3 py-1.5 rounded-full bg-white hover:bg-slate-100 active:scale-95 text-slate-800 text-xs font-semibold shadow-sm border border-slate-300 transition-all shrink-0 cursor-pointer"
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* WhatsApp Input Bar */}
      <footer className="bg-[#F0F2F5] px-3 py-2 flex items-center gap-2 border-t border-slate-300/60 safe-bottom">
        
        {/* Emoji Icon */}
        <button 
          className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-colors shrink-0"
          title="אימוג'י"
        >
          <Smile className="w-5 h-5" />
        </button>

        {/* Paperclip Attachment */}
        <button 
          className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-colors shrink-0"
          title="צרף קובץ/מיקום"
        >
          <Paperclip className="w-5 h-5 rotate-45" />
        </button>

        {/* Input box */}
        <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center px-3.5 py-1.5 min-h-[42px]">
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder={
              chatMode === 'operator' 
                ? `כתוב מענה שיישלח ישירות לוואטסאפ של ${activeCustomerName}...` 
                : "כתוב הודעת לקוח מדומה..."
            }
            className="w-full bg-transparent border-none text-slate-900 placeholder-slate-400 text-sm focus:outline-none"
          />
        </div>

        {/* Send Button */}
        {inputText.trim() ? (
          <button
            onClick={() => handleSendMessage()}
            disabled={isSending}
            className={`w-10 h-10 rounded-full active:scale-95 text-white flex items-center justify-center shadow-md transition-all shrink-0 cursor-pointer ${
              chatMode === 'operator' ? 'bg-[#25D366] hover:bg-[#20bd5a]' : 'bg-amber-500 hover:bg-amber-600'
            }`}
            title={chatMode === 'operator' ? 'שלח מענה ישירות לוואטסאפ' : 'שלח כלקוח'}
          >
            <Send className={`w-4 h-4 rotate-180 fill-current ${isSending ? 'animate-pulse' : ''}`} />
          </button>
        ) : (
          <button
            onClick={() => handleSendMessage('ח. סבן חומרי בניין כפר ברא - שלום! איך נוכל לעזור היום? 🏗️')}
            className="w-10 h-10 rounded-full bg-[#128C7E] hover:bg-[#075E54] active:scale-95 text-white flex items-center justify-center shadow-md transition-all shrink-0 cursor-pointer"
            title="מענה מהיר"
          >
            <Sparkles className="w-4 h-4" />
          </button>
        )}

      </footer>
    </div>
  );
};
