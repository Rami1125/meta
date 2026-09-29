import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Smile, 
  Paperclip, 
  Mic, 
  Phone, 
  MoreVertical, 
  Search, 
  Check, 
  CheckCheck, 
  ArrowLeft,
  Sparkles,
  RefreshCw,
  Building2
} from 'lucide-react';

export interface WhatsAppMessage {
  id: string;
  sender: 'user' | 'bot'; // user = white bubble (left/right based on RTL), bot = #DCF8C6 green bubble
  text: string;
  timestamp: string;
  status?: 'sent' | 'delivered' | 'read';
  isMenuCard?: boolean;
  options?: string[];
}

interface WhatsAppChatProps {
  initialRecipient?: string;
  customerName?: string;
  onBack?: () => void;
  isStandalone?: boolean;
}

export const WhatsAppChat: React.FC<WhatsAppChatProps> = ({
  initialRecipient = '+972 50-886-0896',
  customerName = 'לקוח וואטסאפ',
  onBack,
  isStandalone = false
}) => {
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
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Quick-Reply Templates
  const quickTemplates = [
    { id: 'q1', label: '🚚 יצא להובלה', text: 'היי, ההזמנה יצאה להובלה עם הנהג ראמי 🚚\nצפי הגעה כשעה. 📍 כתובת סופקה' },
    { id: 'q2', label: '🏪 מוכן לאיסוף', text: 'היי 👋 ההזמנה מוכנה לאיסוף במחסן כפר ברא 🏗️\nשעות פתיחה: 06:00-17:00\nרמי: 050-886-0896' },
    { id: 'q3', label: '🗑️ מכולה בדרך', text: 'המכולה בדרך אליך 🗑️\nהנהג ייצור קשר 30 דק לפני הגעה. נא להכין גישה למשאית.' },
    { id: 'q4', label: '📍 שלח מיקום', text: 'היי, תוכל לשלוח מיקום מדויק בוואטסאפ? 📍\nלחץ על 📎 > מיקום > שלח מיקום נוכחי' },
    { id: 'q5', label: '💰 חשבונית', text: 'חשבונית מס מצורפת 💰\nלתשלום בביט / העברה בנקאית. תודה!' },
    { id: 'q6', label: '❓ עזרה', text: 'היי, נציג ח. סבן זמין עבורך לכל שאלה בטלפון 050-886-0896 🏗️' }
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const getCurrentTime = () => {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  };

  // Send message through Free Chat AI engine or fixed branch
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text) return;

    const userMsg: WhatsAppMessage = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      text,
      timestamp: getCurrentTime(),
      status: 'read'
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    try {
      // Call Free Chat AI engine endpoint
      const res = await fetch('/api/chat/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: initialRecipient.replace(/[^0-9]/g, ''),
          text,
          history: messages.map(m => ({
            role: m.sender === 'user' ? 'user' : 'model',
            text: m.text
          }))
        })
      });

      const data = await res.json().catch(() => ({}));
      setIsTyping(false);

      const botReply = data.reply || "תודה שפנית לח. סבן חומרי בניין כפר ברא 🏗️. נשמח לספק לך את כל חומרי הבניין הדרושים!";

      const botMsg: WhatsAppMessage = {
        id: `bot_${Date.now()}`,
        sender: 'bot',
        text: botReply,
        timestamp: getCurrentTime()
      };

      setMessages(prev => [...prev, botMsg]);

      // If there are suggested branches and not a simple check
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
        }, 500);
      }

    } catch (err) {
      setIsTyping(false);
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
  };

  const handleOptionClick = (option: string) => {
    handleSendMessage(option);
  };

  const setTemplate = (text: string) => {
    setInputText(text);
    inputRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#E5DDD5] select-none font-['Assistant',sans-serif]" dir="rtl">
      
      {/* WhatsApp Green Top Header (#075E54) */}
      <header className="bg-[#075E54] text-white px-3 py-2.5 flex items-center justify-between shadow-md z-10 shrink-0">
        <div className="flex items-center gap-2">
          {onBack && (
            <button 
              onClick={onBack}
              className="p-1 hover:bg-[#128C7E]/50 rounded-full transition-colors active:scale-95"
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
              <span>ח. סבן חומרי בניין בע״מ</span>
              <span className="text-[10px] bg-emerald-400/20 text-emerald-200 px-1.5 py-0.2 rounded font-mono font-normal">
                רשמי ✓
              </span>
            </div>
            <div className="text-[11px] text-emerald-100/90 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#25D366] animate-pulse"></span>
              <span>רמי מסארוה • מחובר עכשיו</span>
            </div>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-3 text-white/90">
          <button 
            onClick={() => window.open(`tel:${initialRecipient.replace(/[^0-9+]/g, '')}`)}
            className="p-1.5 hover:bg-[#128C7E]/50 rounded-full transition-colors"
            title="חייג"
          >
            <Phone className="w-4 h-4" />
          </button>
          <button className="p-1.5 hover:bg-[#128C7E]/50 rounded-full transition-colors" title="חיפוש">
            <Search className="w-4 h-4" />
          </button>
          <button className="p-1.5 hover:bg-[#128C7E]/50 rounded-full transition-colors" title="עוד אפשרויות">
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </header>

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
            היום • שיחת שירות לקוחות סבן
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
                        className="w-full text-right bg-white hover:bg-emerald-50 active:scale-98 border border-[#25D366] text-slate-900 font-semibold px-3 py-2 rounded-xl text-xs transition-all shadow-sm flex items-center justify-between group"
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
                  {isUser && (
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
              <span className="text-xs text-emerald-800 font-medium mr-1.5">נציג סבן כותב...</span>
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
              className="whitespace-nowrap px-3 py-1.5 rounded-full bg-white hover:bg-slate-100 active:scale-95 text-slate-800 text-xs font-semibold shadow-sm border border-slate-300 transition-all shrink-0"
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
            placeholder="כתוב הודעה..."
            className="w-full bg-transparent border-none text-slate-900 placeholder-slate-400 text-sm focus:outline-none"
          />
        </div>

        {/* Send / Mic Button */}
        {inputText.trim() ? (
          <button
            onClick={() => handleSendMessage()}
            className="w-10 h-10 rounded-full bg-[#25D366] hover:bg-[#20bd5a] active:scale-95 text-white flex items-center justify-center shadow-md transition-all shrink-0"
            title="שלח"
          >
            <Send className="w-4 h-4 rotate-180 fill-current" />
          </button>
        ) : (
          <button
            onClick={() => handleSendMessage('בדיקה 🚚')}
            className="w-10 h-10 rounded-full bg-[#128C7E] hover:bg-[#075E54] active:scale-95 text-white flex items-center justify-center shadow-md transition-all shrink-0"
            title="בדיקה מהירה"
          >
            <Sparkles className="w-4 h-4" />
          </button>
        )}

      </footer>
    </div>
  );
};
