import React, { useState } from 'react';
import { 
  X, 
  Send, 
  RotateCcw, 
  Sparkles, 
  CheckCheck, 
  Menu, 
  Phone, 
  ExternalLink,
  ChevronDown
} from 'lucide-react';
import { FlowTree, ListMenuRow } from '../../types/studio';

interface WhatsAppSimulatorProps {
  isOpen: boolean;
  onClose: () => void;
  flow: FlowTree;
  onEventSent?: () => void;
}

interface SimMessage {
  id: string;
  sender: 'client' | 'saban';
  text?: string;
  type?: 'text' | 'list_menu' | 'image' | 'task';
  timestamp: string;
  listMenu?: {
    header?: string;
    body: string;
    footer?: string;
    buttonText: string;
    rows: ListMenuRow[];
  };
}

export const WhatsAppSimulator: React.FC<WhatsAppSimulatorProps> = ({
  isOpen,
  onClose,
  flow,
  onEventSent
}) => {
  const [phone, setPhone] = useState('+972524458912');
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedListId, setExpandedListId] = useState<string | null>(null);

  const [messages, setMessages] = useState<SimMessage[]>([
    {
      id: 'sim_init',
      sender: 'saban',
      type: 'text',
      text: 'שלום! זהו סימולטור WhatsApp של ח. סבן חומרי בניין (+972 50-8860896). כתוב "שלום" או לחץ על הכפתורים המהירים למטה כדי לבדוק את התפריט!',
      timestamp: new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  if (!isOpen) return null;

  const triggerIncoming = async (textToSend: string, listReplyId?: string, listReplyTitle?: string) => {
    if (!textToSend && !listReplyId) return;

    const timeStr = new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    const userMsg: SimMessage = {
      id: `client_${Date.now()}`,
      sender: 'client',
      text: listReplyTitle ? `בחרתי: ${listReplyTitle}` : textToSend,
      type: 'text',
      timestamp: timeStr
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/simulate-incoming', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: phone,
          text: textToSend,
          listReplyId: listReplyId,
          customerName: 'בדיקת סימולטור'
        })
      });

      const data = await res.json();
      setIsLoading(false);

      if (data && data.targetNode) {
        const node = data.targetNode;
        const outTime = new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

        if (node.type === 'list_menu') {
          const listData = node.data;
          const botMsg: SimMessage = {
            id: `saban_${Date.now()}`,
            sender: 'saban',
            type: 'list_menu',
            timestamp: outTime,
            listMenu: {
              header: listData.header,
              body: listData.body,
              footer: listData.footer,
              buttonText: listData.buttonText || 'בחר שירות',
              rows: listData.rows || []
            }
          };
          setMessages(prev => [...prev, botMsg]);
          setExpandedListId(botMsg.id);
        } else {
          const botMsg: SimMessage = {
            id: `saban_${Date.now()}`,
            sender: 'saban',
            type: 'text',
            text: data.sentResponseText || node.data.text || 'מענה נשלח בהצלחה',
            timestamp: outTime
          };
          setMessages(prev => [...prev, botMsg]);
        }

        if (onEventSent) {
          onEventSent();
        }
      }
    } catch (err) {
      console.error('Simulator error:', err);
      setIsLoading(false);
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    triggerIncoming(inputText.trim());
  };

  const resetChat = () => {
    setMessages([
      {
        id: 'sim_init_2',
        sender: 'saban',
        type: 'text',
        text: 'השיחה אופסה. שלח "היי" לפתיחת התפריט הראשי של ח. סבן.',
        timestamp: new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-md shadow-2xl flex flex-col h-[740px] max-h-[92vh] overflow-hidden text-right">
        
        {/* Phone Header Mockup */}
        <div className="bg-emerald-800 text-white px-4 py-3 flex items-center justify-between border-b border-emerald-900/60 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-950 flex items-center justify-center font-bold text-amber-400 border border-emerald-600 shadow-inner">
              סבן
            </div>
            <div>
              <div className="font-bold text-sm leading-tight flex items-center gap-1.5">
                <span>ח. סבן חומרי בניין בע״מ</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-300"></span>
              </div>
              <div className="text-[11px] text-emerald-100/90 font-mono dir-ltr flex items-center gap-2">
                <span>+972 50-8860896</span>
                <span className="text-[10px] bg-emerald-900/70 px-1.5 py-0.2 rounded text-emerald-200">עסקי מאומת</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={resetChat}
              title="איפוס שיחה"
              className="p-1.5 text-emerald-200 hover:text-white hover:bg-emerald-700/50 rounded-lg transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button 
              onClick={onClose}
              className="p-1.5 text-emerald-200 hover:text-white hover:bg-emerald-700/50 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* WhatsApp Background Chat Pane */}
        <div 
          className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-[#0b141a] text-slate-100"
          style={{
            backgroundImage: `radial-gradient(#1e293b 1px, transparent 1px)`,
            backgroundSize: '20px 20px'
          }}
        >
          {messages.map((m) => {
            const isClient = m.sender === 'client';

            return (
              <div
                key={m.id}
                className={`flex flex-col ${isClient ? 'items-start' : 'items-end'}`}
              >
                {/* Regular Text Bubble */}
                {m.type !== 'list_menu' && (
                  <div
                    className={`max-w-[85%] rounded-2xl p-3 shadow-md text-sm whitespace-pre-line relative ${
                      isClient
                        ? 'bg-slate-800 text-slate-100 rounded-tr-none border border-slate-700/60'
                        : 'bg-[#005c4b] text-white rounded-tl-none border border-emerald-700/50'
                    }`}
                  >
                    <div className="leading-relaxed">{m.text}</div>
                    <div className={`text-[10px] mt-1 text-left flex items-center justify-end gap-1 ${isClient ? 'text-slate-400' : 'text-emerald-200'}`}>
                      <span>{m.timestamp}</span>
                      {isClient && <CheckCheck className="w-3.5 h-3.5 text-cyan-400 inline" />}
                    </div>
                  </div>
                )}

                {/* WhatsApp Interactive List Menu Bubble */}
                {m.type === 'list_menu' && m.listMenu && (
                  <div className="max-w-[90%] bg-[#005c4b] text-white rounded-2xl rounded-tl-none p-3.5 shadow-lg border border-emerald-600/70 space-y-2.5">
                    {m.listMenu.header && (
                      <div className="font-bold text-amber-300 text-sm border-b border-emerald-700/60 pb-1.5 flex items-center justify-between">
                        <span>{m.listMenu.header}</span>
                        <span className="text-[10px] bg-emerald-950/60 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-700/50">
                          תפריט אינטראקטיבי
                        </span>
                      </div>
                    )}

                    <div className="text-sm leading-relaxed text-slate-100">
                      {m.listMenu.body}
                    </div>

                    {m.listMenu.footer && (
                      <div className="text-[11px] text-emerald-200/80 italic">
                        {m.listMenu.footer}
                      </div>
                    )}

                    {/* Button to Open List Options */}
                    <div className="pt-1 border-t border-emerald-700/60">
                      <button
                        onClick={() => setExpandedListId(expandedListId === m.id ? null : m.id)}
                        className="w-full py-2 px-3 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-600 text-emerald-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-sm"
                      >
                        <Menu className="w-4 h-4 text-emerald-400" />
                        <span>{m.listMenu.buttonText}</span>
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expandedListId === m.id ? 'rotate-180' : ''}`} />
                      </button>
                    </div>

                    {/* Expanded Interactive Rows */}
                    {expandedListId === m.id && (
                      <div className="bg-slate-900/90 rounded-xl p-2 border border-slate-700 space-y-1.5 mt-2 animate-in fade-in zoom-in-95">
                        <div className="text-[11px] text-slate-400 font-semibold px-2 pb-1 border-b border-slate-800">
                          בחר שירות מבוקש:
                        </div>
                        {m.listMenu.rows.map((row) => (
                          <button
                            key={row.id}
                            onClick={() => {
                              setExpandedListId(null);
                              triggerIncoming(`בחרתי: ${row.title}`, row.id, row.title);
                            }}
                            className="w-full text-right p-2.5 rounded-lg hover:bg-emerald-600/30 border border-transparent hover:border-emerald-500/40 transition-all flex flex-col group"
                          >
                            <span className="font-semibold text-xs text-emerald-300 group-hover:text-emerald-200">
                              {row.title}
                            </span>
                            {row.description && (
                              <span className="text-[11px] text-slate-300/80 group-hover:text-slate-200 leading-snug">
                                {row.description}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="text-[10px] text-emerald-300 text-left pt-1">
                      {m.timestamp}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-emerald-400 bg-slate-900/80 px-3 py-1.5 rounded-full w-max mx-auto border border-emerald-800/60 animate-pulse">
              <Sparkles className="w-3.5 h-3.5 animate-spin" />
              <span>ח. סבן מעבד מענה אוטומטי...</span>
            </div>
          )}
        </div>

        {/* Quick Test Chips for H. Saban options */}
        <div className="bg-slate-950 px-3 py-2 border-t border-slate-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <span className="text-[10px] text-slate-500 shrink-0 font-medium">בדיקות מהירות:</span>
          <button
            onClick={() => triggerIncoming('שלום, אשמח לתפריט חומרי בניין')}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs shrink-0 border border-slate-700 font-medium"
          >
            👋 שלום (פתיחת תפריט)
          </button>
          <button
            onClick={() => triggerIncoming('הזמנת הובלה', 'delivery', '🚚 הזמנת הובלה לאתר')}
            className="px-2.5 py-1 bg-orange-950/80 hover:bg-orange-900 text-orange-200 rounded-lg text-xs shrink-0 border border-orange-800/60 font-medium"
          >
            🚚 1. הובלה
          </button>
          <button
            onClick={() => triggerIncoming('איסוף עצמי', 'pickup', '🏪 איסוף עצמי מסניף')}
            className="px-2.5 py-1 bg-blue-950/80 hover:bg-blue-900 text-blue-200 rounded-lg text-xs shrink-0 border border-blue-800/60 font-medium"
          >
            🏪 2. איסוף עצמי
          </button>
          <button
            onClick={() => triggerIncoming('מכולות פינוי פסולת', 'containers', '🗑️ מכולות פינוי פסולת')}
            className="px-2.5 py-1 bg-amber-950/80 hover:bg-amber-900 text-amber-200 rounded-lg text-xs shrink-0 border border-amber-800/60 font-medium"
          >
            🗑️ 3. מכולות
          </button>
          <button
            onClick={() => triggerIncoming('מעקב אחרי הזמנה', 'tracking', '📍 מעקב אחרי הזמנה')}
            className="px-2.5 py-1 bg-purple-950/80 hover:bg-purple-900 text-purple-200 rounded-lg text-xs shrink-0 border border-purple-800/60 font-medium"
          >
            📍 4. מעקב
          </button>
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSend} className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="הקלד הודעה כלקוח (למשל: 'היי' או 'איפה המשלוח?')..."
            className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="w-10 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white flex items-center justify-center transition-colors shadow-md"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

      </div>
    </div>
  );
};
