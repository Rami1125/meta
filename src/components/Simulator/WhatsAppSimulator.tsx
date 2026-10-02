import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  X, 
  Send, 
  RotateCcw, 
  Sparkles, 
  CheckCheck, 
  Menu, 
  Phone, 
  ExternalLink,
  ChevronDown,
  ArrowRight,
  RefreshCw,
  Radio,
  Check,
  Zap,
  Clock,
  Layers,
  CheckCircle2,
  FileSpreadsheet
} from 'lucide-react';
import { ref, onValue } from 'firebase/database';
import { db } from '../../firebase';
import { FlowTree, ListMenuRow, ListMenuData, StudioNode } from '../../types/studio';
import { DEFAULT_FLOW } from '../../data/defaultFlow';
import { api } from '../../services/api';

interface WhatsAppSimulatorProps {
  isOpen: boolean;
  onClose: () => void;
  flow?: FlowTree;
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
  taskDetails?: {
    taskId?: string;
    title?: string;
    category?: string;
    assignedTo?: string;
  };
}

interface PersonaPreset {
  id: string;
  name: string;
  phone: string;
  label: string;
  badge: string;
  badgeColor: string;
  type: 'repeat' | 'commander' | 'vip' | 'driver' | 'new';
}

const PERSONA_PRESETS: PersonaPreset[] = [
  { id: 'repeat_dniv', name: 'ד.ניב', phone: '+972528765432', label: 'ד.ניב (לקוח חוזר 603377 / הבנות 16)', badge: 'לקוח חוזר', badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', type: 'repeat' },
  { id: 'repeat_vagshel', name: 'וגשל דאו', phone: '+972549876543', label: 'וגשל דאו (לקוח חוזר 811005)', badge: 'לקוח חוזר', badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', type: 'repeat' },
  { id: 'repeat_shaked', name: 'השוקדים', phone: '+972531234567', label: 'השוקדים (לקוח חוזר 605070 / עלי זהב)', badge: 'לקוח חוזר', badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', type: 'repeat' },
  { id: 'rami', name: 'ראמי מסארווה', phone: '+972508860896', label: 'ראמי מסארווה (050-886-0896)', badge: 'המפקד 🫡', badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40', type: 'commander' },
  { id: 'harel', name: 'הראל אידלסון', phone: '+972541112233', label: 'הראל אידלסון (מנכ"ל ח. סבן)', badge: 'הנהלה', badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40', type: 'vip' },
  { id: 'mom', name: 'אמא של ראמי', phone: '+972509998877', label: 'אמא של ראמי', badge: 'משפחה ❤️', badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40', type: 'vip' },
  { id: 'hikmat', name: 'חכמת מנוף', phone: '+972501112244', label: 'חכמת (משאית מנוף 615-41-002)', badge: 'נהג 🚛', badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/40', type: 'driver' },
  { id: 'new_client', name: 'לקוח חדש', phone: '+972529988776', label: 'לקוח חדש (ללא היסטוריה קודמת)', badge: 'לקוח חדש', badgeColor: 'bg-slate-700 text-slate-300 border-slate-600', type: 'new' }
];

export const WhatsAppSimulator: React.FC<WhatsAppSimulatorProps> = ({
  isOpen,
  onClose,
  flow,
  onEventSent
}) => {
  const [selectedPersona, setSelectedPersona] = useState<PersonaPreset>(PERSONA_PRESETS[0]);
  const [phone, setPhone] = useState(PERSONA_PRESETS[0].phone);
  const [customerName, setCustomerName] = useState(PERSONA_PRESETS[0].name);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedListId, setExpandedListId] = useState<string | null>(null);

  // Live Flow & Online Sync State
  const [liveFlow, setLiveFlow] = useState<FlowTree>(flow || DEFAULT_FLOW);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  const [showUpdateToast, setShowUpdateToast] = useState(false);
  const [toastMessage, setToastMessage] = useState<string>('');
  const [hasUserMessaged, setHasUserMessaged] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Helper: Extract current root menu data from any FlowTree
  const getRootMenuData = useCallback((f: FlowTree): { header?: string; body: string; footer?: string; buttonText: string; rows: ListMenuRow[] } => {
    const rootNode = f.nodes.find(n => n.id === f.rootBlockId || n.isRoot) || 
                     f.nodes.find(n => n.data && n.data.type === 'list_menu') || 
                     f.nodes[0];
    if (rootNode && rootNode.data && rootNode.data.type === 'list_menu') {
      const data = rootNode.data as ListMenuData;
      return {
        header: data.header || 'ח. סבן חומרי בניין 🏗️',
        body: data.body || 'שלום וברוכים הבאים לח. סבן חומרי בניין! במה נוכל לעזור היום?',
        footer: data.footer || 'זמינים בימים א-ה 06:30-17:00 | יום ו 06:30-13:00',
        buttonText: data.buttonText || 'בחר שירות',
        rows: Array.isArray(data.rows) ? data.rows : []
      };
    }
    return {
      header: 'ח. סבן חומרי בניין 🏗️',
      body: 'שלום! במה נוכל לעזור היום?',
      footer: 'זמינים בימים א-ה 06:30-17:00',
      buttonText: 'בחר שירות',
      rows: []
    };
  }, []);

  // Helper: Create the initial welcome messages showing the live menu card
  const createWelcomeMessages = useCallback((f: FlowTree): SimMessage[] => {
    const timeStr = new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    const rootMenu = getRootMenuData(f);

    const menuMsgId = `welcome_menu_${Date.now()}`;
    return [
      {
        id: `intro_${Date.now()}`,
        sender: 'saban',
        type: 'text',
        text: 'שלום וברוכים הבאים לח. סבן חומרי בניין בע״מ (כפר ברא) 🏗️\nאיך נוכל לעזור היום?',
        timestamp: timeStr
      },
      {
        id: menuMsgId,
        sender: 'saban',
        type: 'list_menu',
        timestamp: timeStr,
        listMenu: rootMenu
      }
    ];
  }, [getRootMenuData]);

  const [messages, setMessages] = useState<SimMessage[]>(() => createWelcomeMessages(flow || DEFAULT_FLOW));

  // Sync with prop flow if passed from parent
  useEffect(() => {
    if (flow && flow.nodes) {
      setLiveFlow(flow);
    }
  }, [flow]);

  // Online Flow Fetching function directly from Firebase RTDB via api
  const fetchOnlineFlow = useCallback(async (isInitial = false) => {
    setIsSyncing(true);
    try {
      const flowRes = await api.getFlow().catch(() => null);
      let updated = false;
      let newFlow: FlowTree | null = flowRes || null;

      if (newFlow && newFlow.nodes) {
        setLiveFlow(prev => {
          const prevRows = JSON.stringify(getRootMenuData(prev).rows);
          const newRows = JSON.stringify(getRootMenuData(newFlow!).rows);
          if (prevRows !== newRows || prev.updatedAt !== newFlow!.updatedAt) {
            updated = true;
            return newFlow!;
          }
          return prev;
        });
      }

      const nowTime = new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastSyncTime(nowTime);

      if (updated && !isInitial) {
        setToastMessage('תפריט ח. סבן עודכן און-ליין בזמן אמת! 🟢');
        setShowUpdateToast(true);
        setTimeout(() => setShowUpdateToast(false), 3500);

        // If the user hasn't started a customized back-and-forth session, update the menu card in chat
        setMessages(prev => {
          if (!hasUserMessaged) {
            return createWelcomeMessages(newFlow!);
          }
          return prev;
        });
      }
    } catch (err) {
      console.warn('Failed to fetch online flow:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [createWelcomeMessages, getRootMenuData, hasUserMessaged]);

  // Online Listeners: Firebase RTDB + Active Polling while simulator is open
  useEffect(() => {
    if (!isOpen) return;

    // Immediately fetch latest state
    fetchOnlineFlow(true);

    // 1. Firebase RTDB listener for active flow updates
    let unsubActive: (() => void) | undefined;
    let unsubVisual: (() => void) | undefined;

    try {
      const activeRef = ref(db, 'flows/active');
      unsubActive = onValue(activeRef, (snap) => {
        const val = snap.val();
        if (val && val.nodes && Array.isArray(val.nodes)) {
          setLiveFlow(prev => {
            const prevStr = JSON.stringify(getRootMenuData(prev).rows);
            const newStr = JSON.stringify(getRootMenuData(val).rows);
            if (prevStr !== newStr) {
              setToastMessage('שינוי בתפריט זוהה מ-Firebase RTDB און-ליין 🟢');
              setShowUpdateToast(true);
              setTimeout(() => setShowUpdateToast(false), 3500);
              return val;
            }
            return prev;
          });
          setLastSyncTime(new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        }
      });

      // 2. Firebase RTDB listener for visual builder updates
      const visualRef = ref(db, 'chat_flows/main');
      unsubVisual = onValue(visualRef, (snap) => {
        const val = snap.val();
        if (val && val.nodes) {
          fetchOnlineFlow(false);
        }
      });
    } catch (e) {
      console.warn('Firebase RTDB listener note:', e);
    }

    // 3. Fallback active polling every 3 seconds to guarantee online detection
    const pollInterval = setInterval(() => {
      fetchOnlineFlow(false);
    }, 3000);

    return () => {
      if (unsubActive) unsubActive();
      if (unsubVisual) unsubVisual();
      clearInterval(pollInterval);
    };
  }, [isOpen, fetchOnlineFlow, getRootMenuData]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, isOpen]);

  if (!isOpen) return null;

  const rootMenuData = getRootMenuData(liveFlow);
  const activeRows = rootMenuData.rows || [];

  const triggerIncoming = async (textToSend: string, listReplyId?: string, listReplyTitle?: string) => {
    if (!textToSend && !listReplyId) return;

    setHasUserMessaged(true);
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
      const data = await api.simulateIncoming({
        from: phone,
        text: textToSend,
        listReplyId: listReplyId,
        customerName: customerName || selectedPersona.name
      });

      setIsLoading(false);

      if (data && data.targetNode) {
        const node: StudioNode = data.targetNode;
        const outTime = new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

        if (node.type === 'list_menu' || (node.data && node.data.type === 'list_menu')) {
          const listData = node.data as ListMenuData;
          const botMsg: SimMessage = {
            id: `saban_${Date.now()}`,
            sender: 'saban',
            type: 'list_menu',
            timestamp: outTime,
            listMenu: {
              header: listData.header || 'ח. סבן',
              body: listData.body || 'אנא בחרו שירות:',
              footer: listData.footer,
              buttonText: listData.buttonText || 'בחר שירות',
              rows: listData.rows || []
            }
          };
          setMessages(prev => [...prev, botMsg]);
          setExpandedListId(botMsg.id);
        } else if (node.type === 'task' || (node.data && node.data.type === 'task')) {
          const taskData = node.data as any;
          const botMsg: SimMessage = {
            id: `saban_${Date.now()}`,
            sender: 'saban',
            type: 'task',
            text: taskData?.confirmationMessage || data.sentResponseText || '✅ המשימה נפתחה בהצלחה במוקד סבן',
            timestamp: outTime,
            taskDetails: {
              title: taskData?.taskTitleTemplate?.replace('{{from}}', phone) || node.title,
              category: taskData?.category || 'general',
              assignedTo: taskData?.assignedTo || 'רמי מסארווה'
            }
          };
          setMessages(prev => [...prev, botMsg]);
        } else {
          const botMsg: SimMessage = {
            id: `saban_${Date.now()}`,
            sender: 'saban',
            type: 'text',
            text: data.sentResponseText || (node.data as any)?.text || 'מענה נשלח בהצלחה מח. סבן',
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
      setMessages(prev => [
        ...prev,
        {
          id: `saban_err_${Date.now()}`,
          sender: 'saban',
          type: 'text',
          text: 'סבן חומרי בניין - תודה על פנייתך! נציג שירות יחזור אליך בהקדם. 050-8860896 🏗️',
          timestamp: new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    triggerIncoming(inputText.trim());
  };

  const resetChat = () => {
    setHasUserMessaged(false);
    setMessages(createWelcomeMessages(liveFlow));
    setToastMessage('השיחה אופסה לתפריט הראשי המעודכן 👍');
    setShowUpdateToast(true);
    setTimeout(() => setShowUpdateToast(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md md:p-4 font-['Assistant',sans-serif]">
      <div className="bg-[#0b141a] border-0 md:border md:border-slate-700/80 rounded-none md:rounded-3xl w-full h-full md:max-w-md md:h-[760px] md:max-h-[92vh] shadow-2xl flex flex-col overflow-hidden text-right relative">
        
        {/* Authentic WhatsApp Phone Header */}
        <div className="bg-[#075E54] text-white px-3 md:px-4 py-2.5 safe-top flex items-center justify-between border-b border-emerald-950/60 shadow-md shrink-0">
          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="p-1.5 -mr-1 text-emerald-100 hover:text-white rounded-lg active:scale-95"
              title="חזור"
            >
              <ArrowRight className="w-5 h-5 stroke-[2.4]" />
            </button>
            <div className="w-9 h-9 rounded-full bg-emerald-950 flex items-center justify-center font-bold text-amber-400 border border-emerald-600 shadow-inner shrink-0 text-xs">
              סבן
            </div>
            <div>
              <div className="font-bold text-sm leading-tight flex items-center gap-1.5">
                <span>ח. סבן חומרי בניין</span>
                <span className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse"></span>
              </div>
              <div className="text-[10px] text-emerald-200/90 font-mono dir-ltr flex items-center gap-1.5">
                <span>+972 50-8860896</span>
                <span className="text-[9px] bg-emerald-900/80 px-1 rounded text-emerald-300">
                  {activeRows.length} שירותים בתפריט
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Live Online Sync Button with Spinner */}
            <button 
              onClick={() => fetchOnlineFlow(false)}
              disabled={isSyncing}
              title={`רענן תפריט און ליין (${lastSyncTime ? 'סונכרן: ' + lastSyncTime : 'חי'})`}
              className="p-2 text-emerald-200 hover:text-white hover:bg-emerald-700/50 rounded-lg transition-colors active:scale-95 flex items-center gap-1 text-[11px]"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-amber-300' : ''}`} />
            </button>

            {/* Reset Chat Button */}
            <button 
              onClick={resetChat}
              title="איפוס שיחה לתפריט ראשי"
              className="p-2 text-emerald-200 hover:text-white hover:bg-emerald-700/50 rounded-lg transition-colors active:scale-95"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Close Button */}
            <button 
              onClick={onClose}
              className="p-2 text-emerald-200 hover:text-white hover:bg-emerald-700/50 rounded-lg transition-colors active:scale-95"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Live Status Sub-Bar */}
        <div className="bg-[#05463e] px-3 py-1 text-[10px] text-emerald-100 flex items-center justify-between border-b border-emerald-900/80 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span className="font-semibold">סימולטור מחובר לשינויים און ליין</span>
          </div>
          <div className="flex items-center gap-2 text-emerald-300/90 font-mono text-[9px] dir-ltr">
            {lastSyncTime ? `עדכון: ${lastSyncTime}` : 'RTDB מחובר'}
          </div>
        </div>

        {/* Persona Switcher Bar for Repeat Customer / VIP / Commander Testing */}
        <div className="bg-slate-900/95 px-3 py-1.5 border-b border-slate-800 flex items-center justify-between gap-2 shrink-0 text-xs">
          <div className="flex items-center gap-1.5 text-slate-300 font-medium shrink-0">
            <span className="text-[11px] text-slate-400">פונה:</span>
            <select
              value={selectedPersona.id}
              onChange={(e) => {
                const found = PERSONA_PRESETS.find(p => p.id === e.target.value);
                if (found) {
                  setSelectedPersona(found);
                  setPhone(found.phone);
                  setCustomerName(found.name);
                  setToastMessage(`הוחלפה זהות פונה ל: ${found.label}`);
                  setShowUpdateToast(true);
                  setTimeout(() => setShowUpdateToast(false), 2000);
                }
              }}
              className="bg-slate-950 border border-slate-700 text-slate-100 text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-emerald-500 max-w-[220px] truncate"
            >
              {PERSONA_PRESETS.map(p => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${selectedPersona.badgeColor}`}>
            {selectedPersona.badge}
          </span>
        </div>

        {/* Live Notification Toast Banner */}
        {showUpdateToast && (
          <div className="absolute top-16 left-3 right-3 z-30 bg-emerald-600/95 text-white px-3 py-2 rounded-xl text-xs font-semibold shadow-xl border border-emerald-400 flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-300 animate-bounce" />
              <span>{toastMessage}</span>
            </div>
            <button onClick={() => setShowUpdateToast(false)} className="text-white/80 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

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
                {m.type === 'text' && (
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

                {/* WhatsApp Task Confirmation Card */}
                {m.type === 'task' && (
                  <div className="max-w-[90%] bg-slate-900 border border-amber-500/50 rounded-2xl rounded-tl-none p-3.5 shadow-lg space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                      <span className="font-bold text-xs text-amber-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>משימה נפתחה במוקד סבן</span>
                      </span>
                      <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/40">
                        {m.taskDetails?.category || 'שירות'}
                      </span>
                    </div>

                    <div className="text-xs text-slate-200 leading-relaxed whitespace-pre-line">
                      {m.text}
                    </div>

                    {m.taskDetails && (
                      <div className="text-[11px] bg-slate-950 p-2 rounded-lg border border-slate-800 space-y-1 text-slate-300">
                        {m.taskDetails.title && <div><strong>כותרת:</strong> {m.taskDetails.title}</div>}
                        {m.taskDetails.assignedTo && <div><strong>משויך ל:</strong> {m.taskDetails.assignedTo}</div>}
                      </div>
                    )}

                    <div className="text-[10px] text-slate-400 text-left pt-1">
                      {m.timestamp}
                    </div>
                  </div>
                )}

                {/* WhatsApp Interactive List Menu Bubble */}
                {m.type === 'list_menu' && m.listMenu && (
                  <div className="max-w-[92%] bg-[#005c4b] text-white rounded-2xl rounded-tl-none p-3.5 shadow-lg border border-emerald-600/70 space-y-2.5">
                    {m.listMenu.header && (
                      <div className="font-bold text-amber-300 text-sm border-b border-emerald-700/60 pb-1.5 flex items-center justify-between">
                        <span>{m.listMenu.header}</span>
                        <span className="text-[10px] bg-emerald-950/80 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-700/50 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                          <span>תפריט חי</span>
                        </span>
                      </div>
                    )}

                    <div className="text-sm leading-relaxed text-slate-100 whitespace-pre-line">
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
                        className="w-full py-2.5 px-3 bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-500/70 text-emerald-200 rounded-xl text-xs font-bold flex items-center justify-between transition-all shadow-sm active:scale-98"
                      >
                        <div className="flex items-center gap-2">
                          <Menu className="w-4 h-4 text-emerald-400" />
                          <span>{m.listMenu.buttonText}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] bg-emerald-800/80 px-2 py-0.5 rounded-full text-emerald-200">
                            {m.listMenu.rows.length} אפשרויות
                          </span>
                          <ChevronDown className={`w-4 h-4 text-emerald-400 transition-transform ${expandedListId === m.id ? 'rotate-180' : ''}`} />
                        </div>
                      </button>
                    </div>

                    {/* Expanded Interactive Rows */}
                    {expandedListId === m.id && (
                      <div className="bg-slate-900/95 rounded-xl p-2 border border-slate-700 space-y-1.5 mt-2 animate-in fade-in zoom-in-95">
                        <div className="text-[11px] text-slate-400 font-semibold px-2 pb-1 border-b border-slate-800 flex items-center justify-between">
                          <span>בחר שירות מבוקש:</span>
                          <span className="text-[9px] text-emerald-400">און-ליין ✅</span>
                        </div>
                        {m.listMenu.rows.map((row, idx) => (
                          <button
                            key={row.id || idx}
                            onClick={() => {
                              setExpandedListId(null);
                              triggerIncoming(`בחרתי: ${row.title}`, row.id, row.title);
                            }}
                            className="w-full text-right p-2.5 rounded-lg hover:bg-emerald-600/30 border border-slate-800 hover:border-emerald-500/50 transition-all flex flex-col group bg-slate-950/50"
                          >
                            <span className="font-bold text-xs text-emerald-300 group-hover:text-emerald-100 flex items-center justify-between">
                              <span>{row.title}</span>
                              <span className="text-[10px] text-slate-500 font-mono">#{idx + 1}</span>
                            </span>
                            {row.description && (
                              <span className="text-[11px] text-slate-400 group-hover:text-slate-200 leading-snug mt-0.5">
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
            <div className="flex items-center gap-2 text-xs text-emerald-400 bg-slate-900/90 px-3 py-1.5 rounded-full w-max mx-auto border border-emerald-800/60 animate-pulse shadow-md">
              <Sparkles className="w-3.5 h-3.5 animate-spin text-amber-400" />
              <span>ח. סבן מעבד מענה אוטומטי מהעץ החי...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Dynamic Quick Test Chips: Live options populated directly from live menu! */}
        <div className="bg-slate-950 px-3 py-2 border-t border-slate-800 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
          <div className="flex items-center gap-1 text-[11px] text-emerald-400 shrink-0 font-bold">
            <Zap className="w-3 h-3 text-amber-400" />
            <span>תפריט חי:</span>
          </div>

          {/* 1. Main Menu Greeting button */}
          <button
            onClick={() => triggerIncoming('שלום')}
            className="px-3 py-2 bg-emerald-950/80 hover:bg-emerald-900 active:scale-95 text-emerald-200 rounded-xl text-xs shrink-0 border border-emerald-700/60 font-semibold min-h-[38px] flex items-center gap-1.5 transition-all shadow-sm"
          >
            👋 <span>שלום</span>
          </button>

          {/* Repeat Customer Quick Chips */}
          <button
            onClick={() => triggerIncoming('כמו פעם שעברה')}
            className="px-3 py-2 bg-amber-950/60 hover:bg-amber-900 active:scale-95 text-amber-200 rounded-xl text-xs shrink-0 border border-amber-600/50 font-semibold min-h-[38px] flex items-center gap-1.5 transition-all shadow-sm"
            title="שחזור הזמנה קודמת ללקוח חוזר"
          >
            🔁 <span>כמו פעם שעברה</span>
          </button>

          <button
            onClick={() => triggerIncoming('לאותו אתר')}
            className="px-3 py-2 bg-teal-950/60 hover:bg-teal-900 active:scale-95 text-teal-200 rounded-xl text-xs shrink-0 border border-teal-600/50 font-semibold min-h-[38px] flex items-center gap-1.5 transition-all shadow-sm"
            title="אישור אתר אחרון"
          >
            📍 <span>לאותו אתר</span>
          </button>

          <button
            onClick={() => triggerIncoming('5 בלות חול ו-20 שקי מלט')}
            className="px-3 py-2 bg-slate-800/90 hover:bg-slate-700 active:scale-95 text-slate-200 rounded-xl text-xs shrink-0 border border-slate-600 font-semibold min-h-[38px] flex items-center gap-1.5 transition-all shadow-sm"
            title="הזמנת חומרים עם נרמול ופקדונות"
          >
            🧱 <span>הזמנת חומרים</span>
          </button>

          {/* 2. Dynamically rendered chips matching ALL rows currently in the live menu */}
          {activeRows.map((row, idx) => (
            <button
              key={row.id || idx}
              onClick={() => triggerIncoming(row.title, row.id, row.title)}
              className="px-3 py-2 bg-slate-800/90 hover:bg-slate-700 active:scale-95 text-slate-100 rounded-xl text-xs shrink-0 border border-slate-700 font-medium min-h-[38px] flex items-center gap-1.5 transition-all shadow-sm hover:border-emerald-500/50"
              title={`בחר: ${row.title}`}
            >
              <span>{row.title}</span>
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSend} className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2 safe-bottom shrink-0">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="הקלד הודעה כלקוח (למשל: 'היי' או 'הובלה')..."
            className="flex-1 bg-slate-950 border border-slate-700 rounded-2xl px-4 py-2.5 text-base text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 min-h-[44px]"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="w-12 h-12 min-w-[44px] min-h-[44px] rounded-2xl bg-[#25D366] hover:bg-[#20ba5a] active:scale-90 disabled:opacity-50 text-slate-950 flex items-center justify-center transition-all shadow-md shrink-0"
          >
            <Send className="w-5 h-5 stroke-[2.5]" />
          </button>
        </form>

      </div>
    </div>
  );
};
