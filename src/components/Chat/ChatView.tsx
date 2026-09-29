import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Send, 
  CheckSquare, 
  Menu, 
  Phone, 
  Clock, 
  User, 
  Sparkles, 
  Filter, 
  CheckCheck,
  Building2,
  RefreshCw,
  ArrowRight,
  Zap
} from 'lucide-react';
import { Conversation, ChatMessage, StudioTask } from '../../types/studio';
import { TaskModal } from './TaskModal';
import { api } from '../../services/api';
import { ref, get, onChildAdded } from 'firebase/database';
import { db } from '../../firebase';

interface ChatViewProps {
  conversations: Conversation[];
  onRefresh: () => void;
  onSendReply: (convId: string, text: string) => Promise<void>;
  onCreateTask: (task: Partial<StudioTask>) => Promise<void>;
}

export const ChatView: React.FC<ChatViewProps> = ({
  conversations,
  onRefresh,
  onSendReply,
  onCreateTask,
}) => {
  const [selectedConvId, setSelectedConvId] = useState<string>(
    // On desktop start with first conv, on mobile let user pick
    typeof window !== 'undefined' && window.innerWidth < 768 ? '' : (conversations[0]?.id || '')
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [menuFilter, setMenuFilter] = useState<string>('all');
  const [replyText, setReplyText] = useState('');
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const quickTemplates = [
    { id: 'q1', label: '🚚 יצא להובלה', text: 'היי {שם} 👋 ההזמנה #{מספר} יצאה להובלה עם הנהג ראמי 🚚\nצפי הגעה: {שעה}\n📍 {כתובת}' },
    { id: 'q2', label: '🏪 מוכן לאיסוף', text: 'היי 👋 ההזמנה מוכנה לאיסוף במחסן כפר ברא 🏗️\nשעות פתיחה: 06:00-17:00\nרמי: 050-886-0896' },
    { id: 'q3', label: '🗑️ מכולה בדרך', text: 'המכולה בדרך אליך 🗑️\nהנהג ייצור קשר 30 דק לפני הגעה. נא להכין גישה למשאית.' },
    { id: 'q4', label: '📍 מעקב', text: 'תוכל לעקוב כאן: https://saban.app/track/{מספר}\nאו שלח לי מספר הזמנה ואבדוק לך' },
    { id: 'q5', label: '💰 חשבונית', text: 'חשבונית מס #{מספר} מצורפת 💰\nלתשלום בביט / העברה. תודה!' },
    { id: 'q6', label: '❓ מה המיקום?', text: 'היי, תוכל לשלוח מיקום מדויק בוואטסאפ? 📍\nלחץ על 📎 > מיקום > שלח מיקום נוכחי' }
  ];

  const setInput = (text: string) => {
    let populated = text;
    if (activeConv?.customerName) {
      const firstName = activeConv.customerName.split(' ')[0] || activeConv.customerName;
      populated = populated.replace('{שם}', firstName);
    }
    setReplyText(populated);
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 20);
  };

  // Live conversations state merging props and Firebase RTDB
  const [liveConversations, setLiveConversations] = useState<Conversation[]>(conversations);

  useEffect(() => {
    if (conversations && conversations.length > 0) {
      setLiveConversations(prev => {
        // Merge without losing realtime updates
        const existingPhones = new Set(prev.map(c => c.from.replace(/\D/g, '')));
        const fresh = conversations.filter(c => !existingPhones.has(c.from.replace(/\D/g, '')));
        return [...prev, ...fresh];
      });
    }
  }, [conversations]);

  const mergeIncomingMessage = (msgId: string, phone: string, text: string, name: string, timestamp: number) => {
    setLiveConversations(prev => {
      const cleanPhone = phone.replace(/\D/g, '');
      const existingIdx = prev.findIndex(c => c.from.replace(/\D/g, '') === cleanPhone);

      const newMsg: ChatMessage = {
        id: msgId,
        direction: 'incoming',
        text,
        type: 'text',
        timestamp: new Date(timestamp).toISOString()
      };

      if (existingIdx >= 0) {
        const conv = prev[existingIdx];
        const msgExists = conv.messages.some(m => m.id === msgId || (m.text === text && m.direction === 'incoming'));
        const updatedMessages = msgExists ? conv.messages : [...conv.messages, newMsg];

        const updatedConv: Conversation = {
          ...conv,
          customerName: name || conv.customerName,
          lastMessage: text,
          lastTimestamp: new Date(timestamp).toISOString(),
          messages: updatedMessages
        };

        const copy = [...prev];
        copy.splice(existingIdx, 1);
        return [updatedConv, ...copy];
      } else {
        const newConv: Conversation = {
          id: `conv_${cleanPhone}`,
          from: `+${cleanPhone}`,
          customerName: name || `לקוח ${cleanPhone.slice(-4)}`,
          lastMessage: text,
          lastTimestamp: new Date(timestamp).toISOString(),
          status: 'active',
          messages: [newMsg]
        };
        return [newConv, ...prev];
      }
    });
  };

  // STEP 1 & STEP 3: Firebase RTDB Listener on BOTH paths with Debug Logs
  useEffect(() => {
    console.log("🔍 START LISTENING TO: joni/incoming");

    const ref1 = ref(db, 'joni/incoming');
    const ref2 = ref(db, 'conversations');

    // DEBUG 1: Check if we can read
    get(ref1).then(snap => {
      console.log("📦 CURRENT DATA IN joni/incoming:", snap.val());
      const val = snap.val() || {};
      const count = Object.keys(val).length;
      console.log("📦 COUNT:", count);

      if (val && typeof val === 'object') {
        Object.entries(val).forEach(([key, data]: [string, any]) => {
          const phone = (data.from || data.senderBusiness || '').toString().replace(/[^0-9]/g, '');
          const text = data.text || data.incoming_text || data.lastMessage || '';
          if (phone && text) {
            mergeIncomingMessage(key, phone, text, data.name || phone, data.timestamp || Date.now());
          }
        });
      }
    }).catch(err => {
      console.error("❌ FIREBASE READ ERROR:", err.code, err.message);
      console.error("👉 FIX: Check Firebase Rules!");
    });

    const unsub1 = onChildAdded(ref1, (snap) => {
      console.log("🔥 NEW MESSAGE DETECTED:", snap.key, snap.val());
      const data = snap.val();
      if (!data) return;

      const phone = (data.from || data.senderBusiness || '').toString().replace(/[^0-9]/g, '');
      const text = data.text || data.incoming_text || data.lastMessage || '';

      if (!phone || !text) {
        console.warn("⚠️ SKIPPED - missing phone or text:", data);
        return;
      }

      console.log("✅ PROCESSING:", phone, text);
      mergeIncomingMessage(snap.key || `inc_${Date.now()}`, phone, text, data.name || phone, data.timestamp || Date.now());
    });

    const unsub2 = onChildAdded(ref2, (snap) => {
      const data = snap.val();
      if (!data) return;
      const phone = (data.phone || data.from || snap.key || '').toString().replace(/[^0-9]/g, '');
      const text = data.lastMessage || data.text || '';
      if (!phone || !text) return;
      console.log("🔥 CONVERSATIONS UPDATE:", phone, text);
      mergeIncomingMessage(snap.key || `conv_${Date.now()}`, phone, text, data.name || phone, data.timestamp || Date.now());
    });

    return () => {
      unsub1();
      unsub2();
    };
  }, []);

  // STEP 4: Manual Sync Button For Testing
  const handleManualSync = async () => {
    try {
      console.log("🔄 MANUAL SYNC TRIGGERED");
      const snap = await get(ref(db, 'joni/incoming'));
      const data = snap.val();
      console.log("SYNC:", data);
      if (data && typeof data === 'object') {
        Object.entries(data).forEach(([key, msg]: [string, any]) => {
          const phone = (msg.from || '').replace(/\D/g, '');
          const text = msg.text || msg.incoming_text || msg.lastMessage || '';
          if (phone && text) {
            mergeIncomingMessage(key, phone, text, msg.name || phone, msg.timestamp || Date.now());
          }
        });
      }
      onRefresh();
    } catch (err) {
      console.error("❌ SYNC FAILED:", err);
    }
  };

  useEffect(() => {
    if (!selectedConvId && liveConversations.length > 0) {
      setSelectedConvId(liveConversations[0].id);
    }
  }, [liveConversations, selectedConvId]);

  const activeConv = liveConversations.find(c => c.id === selectedConvId) || liveConversations[0];

  // Identify last incoming customer message to analyze
  const lastIncomingMsg = activeConv?.messages
    ? [...activeConv.messages].reverse().find(m => m.direction === 'incoming')
    : null;
  const lastCustomerText = lastIncomingMsg?.text || activeConv?.lastMessage || '';

  // AI Smart Reply Suggestions State
  const [smartReplies, setSmartReplies] = useState<string[]>([]);
  const [isLoadingSmartReplies, setIsLoadingSmartReplies] = useState(false);
  const [analyzedMsgText, setAnalyzedMsgText] = useState<string>('');

  const fetchSmartReplies = async (msgText: string, conv?: Conversation) => {
    if (!msgText && !conv?.lastMessage) return;
    setIsLoadingSmartReplies(true);
    setAnalyzedMsgText(msgText || conv?.lastMessage || '');
    try {
      const suggestions = await api.getSmartReplySuggestions(
        msgText || conv?.lastMessage || '',
        conv?.messages || [],
        conv?.customerName
      );
      if (suggestions && suggestions.length > 0) {
        setSmartReplies(suggestions.slice(0, 3));
      }
    } catch (err) {
      console.error('Error fetching smart replies:', err);
    } finally {
      setIsLoadingSmartReplies(false);
    }
  };

  useEffect(() => {
    if (activeConv) {
      const targetText = lastCustomerText;
      if (targetText && targetText !== analyzedMsgText) {
        fetchSmartReplies(targetText, activeConv);
      }
    }
  }, [selectedConvId, lastCustomerText]);

  // Filtering conversations
  const filteredConversations = liveConversations.filter(c => {
    const matchesMenu = menuFilter === 'all' || 
      c.selectedMenuId === menuFilter || 
      c.selectedMenuTitle?.includes(menuFilter);

    const q = searchQuery.toLowerCase();
    const matchesQuery = !searchQuery || 
      c.from.includes(q) ||
      c.customerName.toLowerCase().includes(q) ||
      c.lastMessage.toLowerCase().includes(q);

    return matchesMenu && matchesQuery;
  });

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !activeConv || isSending) return;
    setIsSending(true);
    await onSendReply(activeConv.id, replyText.trim());
    setReplyText('');
    setIsSending(false);
  };

  const getMenuBadge = (menuId?: string) => {
    switch (menuId) {
      case 'delivery':
        return { label: '🚚 הובלה', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' };
      case 'pickup':
        return { label: '🏪 איסוף', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' };
      case 'containers':
        return { label: '🗑️ מכולות', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' };
      case 'tracking':
        return { label: '📍 מעקב', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' };
      default:
        return { label: 'כללי', color: 'bg-slate-800 text-slate-400 border-slate-700' };
    }
  };

  return (
    <div className="flex-1 h-full flex bg-slate-950 overflow-hidden">
      
      {/* Left List of Conversations */}
      <div className={`${selectedConvId ? 'hidden md:flex' : 'flex'} w-full md:w-96 bg-slate-900 border-l border-slate-800 flex-col shrink-0 pb-16 md:pb-0`}>
        
        {/* Search & Filter Header */}
        <div className="p-3.5 border-b border-slate-800 space-y-2.5 bg-slate-950/60">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-100 text-sm flex items-center gap-2">
              <span>שיחות WhatsApp נכנסות</span>
              <span className="text-[11px] bg-slate-800 px-2 py-0.5 rounded-full text-slate-400 font-mono">
                {filteredConversations.length}
              </span>
            </h2>
            <div className="flex items-center gap-1.5">
              {/* STEP 4: Manual Sync Button */}
              <button
                onClick={handleManualSync}
                className="px-2.5 py-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-all font-semibold flex items-center gap-1 active:scale-95 shadow-sm"
                title="סנכרן הודעות ישירות מ-Firebase"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>🔄 סנכרן</span>
              </button>
              <button
                onClick={onRefresh}
                title="רענן שיחות"
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors active:scale-95"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="חיפוש לפי מספר, שם או תוכן..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl pr-9 pl-3 py-2.5 text-base md:text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-orange-500 min-h-[44px]"
            />
          </div>

          {/* Menu Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
            {[
              { id: 'all', label: 'הכל' },
              { id: 'delivery', label: '🚚 הובלה' },
              { id: 'pickup', label: '🏪 איסוף' },
              { id: 'containers', label: '🗑️ מכולות' },
              { id: 'tracking', label: '📍 מעקב' }
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setMenuFilter(p.id)}
                className={`px-3 py-1.5 min-h-[36px] rounded-xl text-xs font-medium whitespace-nowrap transition-colors active:scale-95 ${
                  menuFilter === p.id
                    ? 'bg-orange-600 text-white font-semibold'
                    : 'bg-slate-800/80 hover:bg-slate-800 text-slate-400'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
          {filteredConversations.map((conv) => {
            const isSelected = activeConv?.id === conv.id;
            const badge = getMenuBadge(conv.selectedMenuId);
            const timeAgo = new Date(conv.lastTimestamp).toLocaleTimeString('he-IL', {
              hour: '2-digit',
              minute: '2-digit'
            });

            return (
              <button
                key={conv.id}
                onClick={() => setSelectedConvId(conv.id)}
                className={`w-full p-3.5 text-right flex items-start gap-3 transition-colors active:bg-slate-800/80 min-h-[64px] ${
                  isSelected
                    ? 'bg-orange-950/30 border-r-4 border-r-orange-500'
                    : 'hover:bg-slate-800/50'
                }`}
              >
                {/* Avatar */}
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-slate-800 to-slate-700 border border-slate-600 flex items-center justify-center text-slate-200 font-bold text-xs shrink-0 shadow-sm">
                  {conv.customerName ? conv.customerName.slice(0, 2) : 'לק'}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-slate-100 truncate">
                      {conv.customerName || conv.from}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {timeAgo}
                    </span>
                  </div>

                  <div className="text-[11px] text-emerald-400 font-mono mt-0.5 dir-ltr text-right">
                    {conv.from}
                  </div>

                  <p className="text-[11px] text-slate-400 truncate mt-1 leading-snug">
                    {conv.lastMessage}
                  </p>

                  <div className="flex items-center gap-1.5 mt-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${badge.color}`}>
                      {badge.label}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}

          {filteredConversations.length === 0 && (
            <div className="p-8 text-center text-slate-500 text-xs">
              לא נמצאו שיחות התואמות את החיפוש.
            </div>
          )}
        </div>
      </div>

      {/* Right Chat Details Pane */}
      {activeConv ? (
        <div className={`${selectedConvId ? 'flex' : 'hidden md:flex'} flex-1 flex-col h-full bg-[#0b141a] pb-16 md:pb-0`}>
          
          {/* Conversation Top Bar */}
          <div className="px-3 md:px-5 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setSelectedConvId('')}
                className="md:hidden p-2 -mr-1.5 text-slate-400 hover:text-white rounded-xl active:scale-95"
                title="חזור לרשימת שיחות"
              >
                <ArrowRight className="w-5 h-5 stroke-[2.4]" />
              </button>
              <div className="w-10 h-10 rounded-full bg-emerald-950 border border-emerald-600 text-emerald-300 font-bold flex items-center justify-center text-sm shrink-0">
                <User className="w-5 h-5" />
              </div>
              <div>
                <div className="font-bold text-slate-100 text-sm flex items-center gap-2">
                  <span className="truncate max-w-[130px] sm:max-w-none">{activeConv.customerName}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getMenuBadge(activeConv.selectedMenuId).color}`}>
                    {getMenuBadge(activeConv.selectedMenuId).label}
                  </span>
                </div>
                <div className="text-xs text-slate-400 font-mono dir-ltr flex items-center gap-1.5">
                  <Phone className="w-3 h-3 text-emerald-400" />
                  <span>{activeConv.from}</span>
                </div>
              </div>
            </div>

            {/* Quick Action: Create Task with prefilled data */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsTaskModalOpen(true)}
                className="flex items-center gap-1 px-3 py-2 min-h-[44px] bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-rose-600/20 active:scale-95 transition-all"
              >
                <CheckSquare className="w-4 h-4 stroke-[2.2]" />
                <span className="hidden sm:inline">+ הוסף משימה ללקוח</span>
                <span className="sm:hidden">+ משימה</span>
              </button>
            </div>
          </div>

          {/* Chat Messages Timeline */}
          <div 
            className="flex-1 overflow-y-auto p-5 space-y-4"
            style={{
              backgroundImage: `radial-gradient(#1e293b 1px, transparent 1px)`,
              backgroundSize: '24px 24px'
            }}
          >
            {activeConv.messages.map((msg) => {
              const isOutgoing = msg.direction === 'outgoing';
              const time = new Date(msg.timestamp).toLocaleTimeString('he-IL', {
                hour: '2-digit',
                minute: '2-digit'
              });

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isOutgoing ? 'items-start' : 'items-end'}`}
                >
                  {/* Regular Message Bubble */}
                  {msg.type !== 'list_menu' && (
                    <div
                      className={`max-w-lg rounded-2xl p-3.5 shadow-md text-sm whitespace-pre-line ${
                        isOutgoing
                          ? 'bg-[#005c4b] text-white rounded-tr-none border border-emerald-700/50'
                          : 'bg-slate-800 text-slate-100 rounded-tl-none border border-slate-700/70'
                      }`}
                    >
                      <div className="leading-relaxed">{msg.text}</div>
                      <div className={`text-[10px] mt-1 text-left flex items-center justify-end gap-1 ${isOutgoing ? 'text-emerald-200' : 'text-slate-400'}`}>
                        <span>{time}</span>
                        {isOutgoing && <CheckCheck className="w-3.5 h-3.5 text-cyan-400 inline" />}
                      </div>
                    </div>
                  )}

                  {/* List Menu Bubble Preview */}
                  {msg.type === 'list_menu' && (
                    <div className="max-w-md bg-[#005c4b] text-white rounded-2xl rounded-tr-none p-4 shadow-lg border border-emerald-600/70 space-y-2.5">
                      <div className="font-bold text-amber-300 text-xs border-b border-emerald-700/60 pb-1.5 flex items-center justify-between">
                        <span>ח. סבן חומרי בניין בע״מ</span>
                        <span className="text-[10px] bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-700/50">
                          תפריט WhatsApp
                        </span>
                      </div>

                      <div className="text-xs leading-relaxed text-slate-100">
                        {msg.text}
                      </div>

                      {/* Fallback preview of 4 Saban main choices */}
                      <div className="pt-2 border-t border-emerald-700/60 space-y-1.5">
                        <div className="text-[11px] font-semibold text-emerald-200">
                          אפשרויות שנשלחו ללקוח:
                        </div>
                        <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                          <div className="p-1.5 rounded bg-emerald-900/60 border border-emerald-700/40 text-emerald-100">
                            🚚 1. הזמנת הובלה לאתר
                          </div>
                          <div className="p-1.5 rounded bg-emerald-900/60 border border-emerald-700/40 text-emerald-100">
                            🏪 2. איסוף עצמי מסניף
                          </div>
                          <div className="p-1.5 rounded bg-emerald-900/60 border border-emerald-700/40 text-emerald-100">
                            🗑️ 3. מכולות פינוי פסולת
                          </div>
                          <div className="p-1.5 rounded bg-emerald-900/60 border border-emerald-700/40 text-emerald-100">
                            📍 4. מעקב אחרי הזמנה
                          </div>
                        </div>
                      </div>

                      <div className="text-[10px] text-emerald-300 text-left pt-1">
                        {time}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* AI-Powered Smart Reply Suggestions Section (3 context-aware buttons analyzing last customer message) */}
          <div className="px-4 py-2.5 bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-950 border-t border-slate-800/90 select-none">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-slate-950 shadow-sm shadow-orange-500/20">
                  <Sparkles className="w-3.5 h-3.5 stroke-[2.5]" />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-200">
                    מענה חכם AI
                  </span>
                  <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded font-mono font-medium">
                    Gemini Flash
                  </span>
                </div>
                {lastCustomerText && (
                  <span className="hidden md:inline-block text-[11px] text-slate-400 truncate max-w-[280px]">
                    מנתח: &ldquo;{lastCustomerText}&rdquo;
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => fetchSmartReplies(lastCustomerText, activeConv)}
                disabled={isLoadingSmartReplies}
                className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-amber-400 px-2 py-1 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
                title="רענן 3 הצעות מענה מהיר"
              >
                <RefreshCw className={`w-3 h-3 ${isLoadingSmartReplies ? 'animate-spin text-amber-400' : ''}`} />
                <span className="hidden sm:inline">הצעות חדשות</span>
              </button>
            </div>

            {/* 3 Quick Response Buttons */}
            {isLoadingSmartReplies ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-16 rounded-xl bg-slate-950/60 border border-slate-800/80 animate-pulse flex items-center p-2.5 gap-2">
                    <div className="w-5 h-5 rounded-full bg-slate-800 shrink-0"></div>
                    <div className="flex-1 space-y-1.5">
                      <div className="h-2.5 bg-slate-800 rounded w-5/6"></div>
                      <div className="h-2 bg-slate-800/60 rounded w-2/3"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : smartReplies.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {smartReplies.map((reply, idx) => (
                  <div
                    key={idx}
                    className="group relative flex flex-col justify-between p-2.5 rounded-xl bg-slate-950/80 hover:bg-slate-900 border border-slate-800 hover:border-amber-500/50 hover:shadow-lg hover:shadow-amber-500/5 transition-all text-right cursor-pointer"
                    onClick={() => {
                      setReplyText(reply);
                      inputRef.current?.focus();
                    }}
                  >
                    <div className="flex items-start gap-1.5 mb-1.5">
                      <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold flex items-center justify-center shrink-0 border border-amber-500/30">
                        {idx + 1}
                      </span>
                      <p className="text-[12px] leading-snug text-slate-200 group-hover:text-white transition-colors line-clamp-2">
                        {reply}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[10px] text-slate-400 group-hover:text-amber-300">
                      <span className="flex items-center gap-1 font-medium">
                        <Zap className="w-3 h-3 text-amber-400" />
                        הזן בתיבה
                      </span>
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (isSending || !activeConv) return;
                          setIsSending(true);
                          await onSendReply(activeConv.id, reply);
                          setIsSending(false);
                        }}
                        className="px-2 py-0.5 rounded bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 transition-all font-semibold flex items-center gap-1"
                        title="שלח ישירות ללקוח"
                      >
                        <Send className="w-2.5 h-2.5" />
                        <span>שלח</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {/* Quick-Reply Templates Bar */}
          <div className="px-3 pt-2.5 bg-slate-900 border-t border-slate-800">
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {quickTemplates.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setInput(t.text)}
                  className="whitespace-nowrap px-3 py-1.5 rounded-full bg-stone-100 hover:bg-stone-200 text-slate-900 text-sm font-medium transition-all shrink-0 active:scale-95 shadow-sm"
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Bottom Manual Reply Box */}
          <form onSubmit={handleSend} className="p-3 bg-slate-900 border-t border-slate-800/60 flex items-center gap-2 safe-bottom">
            <input
              ref={inputRef}
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="כתוב מענה ידני ללקוח..."
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-base md:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-orange-500 min-h-[44px]"
            />
            <button
              type="submit"
              disabled={!replyText.trim() || isSending}
              className="px-4 py-2.5 min-h-[44px] rounded-xl bg-orange-600 hover:bg-orange-500 active:scale-95 disabled:opacity-50 text-white font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-orange-600/20 text-xs"
            >
              <Send className="w-4 h-4 stroke-[2.2]" />
              <span className="hidden sm:inline">{isSending ? 'שולח...' : 'שלח מענה'}</span>
            </button>
          </form>

        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
          <p>בחר שיחה מהרשימה לצפייה ומענה</p>
        </div>
      )}

      {/* Task Creation Modal */}
      {activeConv && (
        <TaskModal
          isOpen={isTaskModalOpen}
          onClose={() => setIsTaskModalOpen(false)}
          onSubmit={onCreateTask}
          initialData={{
            clientPhone: activeConv.from,
            clientName: activeConv.customerName,
            title: `פנייה מ${activeConv.customerName || activeConv.from}: ${activeConv.selectedMenuTitle || 'חומרי בניין'}`,
            description: `הודעה אחרונה: "${activeConv.lastMessage}"`,
            category: (activeConv.selectedMenuId as any) || 'delivery',
            conversationId: activeConv.id
          }}
        />
      )}
    </div>
  );
};
