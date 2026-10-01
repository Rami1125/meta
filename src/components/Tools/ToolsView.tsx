import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  Send, 
  Check, 
  Copy, 
  Radio, 
  Terminal, 
  Layers, 
  ArrowRight, 
  RefreshCw, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle,
  Sparkles,
  Bot,
  Code2,
  Workflow,
  Smartphone
} from 'lucide-react';
import { api } from '../../services/api';

export const ToolsView: React.FC = () => {
  const MAKE_WEBHOOK_URL = 'https://hook.eu1.make.com/iozzim8loo8gtkq62wb4axycdskfe080';

  // Test form state
  const [toPhone, setToPhone] = useState('972508860896');
  const [selectedAction, setSelectedAction] = useState<'send_menu' | 'order_update' | 'container_task' | 'customer_reply'>('send_menu');
  const [messageText, setMessageText] = useState(
    `ח. סבן חומרי בניין 🏗️\nברוכים הבאים למרכז ההזמנות! הקלד מספר לבחירה:\n1 - 🚚 הזמנה והובלה לאתר\n2 - 🏭 איסוף עצמי ושעות פעילות\n3 - 🗑️ מכולות פסולת (6/8/12 קוב)\n4 - 🔍 מעקב משלוח ונהגים`
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dispatchResult, setDispatchResult] = useState<any>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [isSendingMenuDirect, setIsSendingMenuDirect] = useState(false);
  const [directMenuNotice, setDirectMenuNotice] = useState<string | null>(null);

  const handleSendMenuDirect = async () => {
    setIsSendingMenuDirect(true);
    setDirectMenuNotice(null);
    try {
      const res = await api.sendMenuViaJoni(toPhone);
      setDirectMenuNotice(res.success ? 'תפריט סבן שודר בהצלחה בוואטסאפ ובתוסף JONI!' : res.error);
      fetchToolsData();
      setTimeout(() => setDirectMenuNotice(null), 4000);
    } catch (err: any) {
      setDirectMenuNotice(err.message);
    } finally {
      setIsSendingMenuDirect(false);
    }
  };

  const presetMessages: Record<string, { label: string; text: string; action: 'send_menu' | 'order_update' | 'container_task' | 'customer_reply' }> = {
    menu: {
      label: '📋 שידור תפריט ראשי סבן',
      action: 'send_menu',
      text: `ח. סבן חומרי בניין 🏗️\nברוכים הבאים למרכז ההזמנות! הקלד מספר לבחירה:\n1 - 🚚 הזמנה והובלה לאתר\n2 - 🏭 איסוף עצמי ושעות פעילות\n3 - 🗑️ מכולות פסולת (6/8/12 קוב)\n4 - 🔍 מעקב משלוח ונהגים`
    },
    order: {
      label: '🚚 אישור הזמנה ואספקה לאתר',
      action: 'order_update',
      text: `שלום! פרטי הזמנת החומרים נקלטו בהצלחה 🚚🏗️.\nמשאית מנוף עם ברזל, מלט ובלוקים תתואם מול ראמי מסארווה (050-886-0896).`
    },
    container: {
      label: '🗑️ מכולת פסולת 8 קוב',
      action: 'container_task',
      text: `✅ פרטי הצבת מכולת 8 קוב נקלטו בהצלחה!\nמנהל התפעול ראמי יתאם משאית רמסע לאתר. נא לוודא גישה פנויה ורחבה למשאית 🚛.`
    },
    reply: {
      label: '💬 מענה חכם מנועה AI',
      action: 'customer_reply',
      text: `היי, שמחים לעמוד לשירותך בח. סבן חומרי בניין כפר ברא 🏗️. נציגנו ראמי מסארווה זמין עבורך ב-050-886-0896 לכל שאלה!`
    }
  };

  const handleSelectPreset = (key: keyof typeof presetMessages) => {
    const preset = presetMessages[key];
    setSelectedAction(preset.action);
    setMessageText(preset.text);
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const fetchToolsData = async () => {
    setIsLoadingLogs(true);
    try {
      const data = await api.getTools();
      if (data && data.recentDispatches) {
        setRecentLogs(data.recentDispatches);
      }
    } catch (err) {
      console.warn('Failed to fetch tools status:', err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchToolsData();
    const interval = setInterval(fetchToolsData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleExecuteTool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) return;

    setIsSubmitting(true);
    setDispatchResult(null);

    try {
      const res = await api.triggerJoniMake(toPhone, messageText, selectedAction);
      setDispatchResult(res);
      fetchToolsData();
    } catch (err: any) {
      setDispatchResult({ success: false, error: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 h-full overflow-y-auto bg-slate-950 p-6 space-y-6 text-right font-['Assistant',sans-serif]" dir="rtl">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-5 gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 via-teal-500 to-emerald-400 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-cyan-500/20">
              <Zap className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-100 flex items-center gap-2">
                <span>כלים ו-Function Calling (נועה AI & Make)</span>
                <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-2.5 py-0.5 rounded-full border border-cyan-500/30 font-bold font-mono">
                  Make Live ⚡
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                סגירת מעגל ושידור אוטומטי מול מנוע ההפצה של JONI Make ו-WhatsApp
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={handleSendMenuDirect}
            disabled={isSendingMenuDirect}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
          >
            <Send className={`w-3.5 h-3.5 ${isSendingMenuDirect ? 'animate-bounce' : ''}`} />
            <span>{isSendingMenuDirect ? 'משדר תפריט...' : 'שליחת תפריט דרך השרת ותוסף JONI'}</span>
          </button>

          <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-slate-300 font-medium">חיבור ישיר:</span>
            <span className="font-mono text-cyan-300 font-bold">trigger_joni_make</span>
          </div>

          <button
            onClick={fetchToolsData}
            disabled={isLoadingLogs}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="רענן היסטוריית שידורים"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingLogs ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {directMenuNotice && (
        <div className="p-3 rounded-2xl bg-emerald-950/60 border border-emerald-500/50 text-xs text-emerald-300 font-medium animate-in fade-in flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{directMenuNotice}</span>
        </div>
      )}

      {/* Grid: Tool Definition & Closed Loop Architecture */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Card: Tool Specification (Function Calling Definition) */}
        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Code2 className="w-4 h-4 text-cyan-400" />
              <h3 className="font-bold text-sm text-slate-100">מפרט הכלי (Function Declaration)</h3>
            </div>
            <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-lg border border-emerald-500/20 font-semibold">
              gemini-3.8-flash Ready ✓
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-[11px] text-slate-400 block mb-1">שם הכלי (Function Name):</span>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-cyan-300 font-bold">
                <span>trigger_joni_make</span>
                <button
                  onClick={() => handleCopy('trigger_joni_make', 'tool_name')}
                  className="p-1 hover:text-white text-slate-400"
                  title="העתק"
                >
                  {copiedKey === 'tool_name' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div>
              <span className="text-[11px] text-slate-400 block mb-1">תיאור הפעולה (Description):</span>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 leading-relaxed">
                שולח את התפריט או התשובה של נועה ישירות ל-Make (JONI Webhook) לשידור מיידי בוואטסאפ ללקוח.
              </div>
            </div>

            <div>
              <span className="text-[11px] text-slate-400 block mb-1">כתובת Webhook יעד ב-Make:</span>
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-amber-300 dir-ltr text-left">
                <span className="flex-1 truncate select-all">{MAKE_WEBHOOK_URL}</span>
                <button
                  onClick={() => handleCopy(MAKE_WEBHOOK_URL, 'webhook_url')}
                  className="p-1 text-slate-400 hover:text-white shrink-0"
                  title="העתק כתובת Webhook"
                >
                  {copiedKey === 'webhook_url' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Parameters Table */}
            <div>
              <span className="text-[11px] text-slate-400 block mb-1.5">שדות הקלט (Parameters Schema):</span>
              <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
                <table className="w-full text-right text-[11px]">
                  <thead>
                    <tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400">
                      <th className="p-2 font-semibold">שדה</th>
                      <th className="p-2 font-semibold">סוג</th>
                      <th className="p-2 font-semibold">חובה?</th>
                      <th className="p-2 font-semibold">תיאור</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    <tr>
                      <td className="p-2 font-bold text-cyan-300">to</td>
                      <td className="p-2 text-slate-400">String</td>
                      <td className="p-2 text-rose-400 font-bold">חובה</td>
                      <td className="p-2 font-sans text-slate-300">מספר הטלפון של הנמען (972508860896)</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-bold text-cyan-300">message</td>
                      <td className="p-2 text-slate-400">String</td>
                      <td className="p-2 text-rose-400 font-bold">חובה</td>
                      <td className="p-2 font-sans text-slate-300">התפריט המלא או נוסח התשובה שנבנה</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-bold text-cyan-300">action</td>
                      <td className="p-2 text-slate-400">String</td>
                      <td className="p-2 text-slate-500">אופציונלי</td>
                      <td className="p-2 font-sans text-slate-300">send_menu / order_update / container_task / customer_reply</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-bold text-amber-300">sender</td>
                      <td className="p-2 text-slate-400">String</td>
                      <td className="p-2 text-emerald-400 font-bold">קבוע</td>
                      <td className="p-2 font-sans text-slate-300">נועה AI (ח. סבן)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Right Card: Closed-Loop Automation Architecture */}
        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Workflow className="w-4 h-4 text-emerald-400" />
              <h3 className="font-bold text-sm text-slate-100">סגירת מעגל ושידור אוטומטי (Closed-Loop)</h3>
            </div>
            <span className="text-[11px] text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded-lg border border-cyan-500/20 font-semibold">
              אוטומטי מלא ⚡
            </span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            בכל פעם שנועה AI מייצרת תפריט, מאשרת הזמנה או מנסחת תשובה ללקוח עבור וואטסאפ — המערכת אינה מסתפקת רק בהצגת הטקסט בצ'אט. היא מפעילה מיידית את הכלי <code className="bg-slate-950 px-1.5 py-0.5 rounded text-cyan-300 font-mono">trigger_joni_make</code> המשדר את ה-Payload המלא ל-Webhook של Make.
          </p>

          {/* Step-by-Step Flow Pipeline */}
          <div className="space-y-2.5 pt-1">
            <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-start gap-3 text-xs">
              <div className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                1
              </div>
              <div>
                <div className="font-bold text-slate-200">פניית לקוח או בחירת תפריט בוואטסאפ</div>
                <div className="text-[11px] text-slate-400">הודעה נכנסת נקלטת במערכת סבן (+972 50-886-0896).</div>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-start gap-3 text-xs">
              <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                2
              </div>
              <div>
                <div className="font-bold text-slate-200">נועה AI מנסחת מענה מקצועי</div>
                <div className="text-[11px] text-slate-400">מודל Gemini 3.8 Flash בונה את התפריט, אישור ההזמנה או התשובה המבוקשת.</div>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-gradient-to-r from-cyan-950/40 to-slate-950 border border-cyan-500/40 flex items-start gap-3 text-xs">
              <div className="w-6 h-6 rounded-full bg-cyan-400 text-slate-950 flex items-center justify-center font-black text-xs shrink-0 mt-0.5">
                3
              </div>
              <div>
                <div className="font-bold text-cyan-200 flex items-center gap-1.5">
                  <span>הפעלת trigger_joni_make ל-Webhook של Make</span>
                  <span className="text-[9px] bg-cyan-400/20 text-cyan-300 px-1.5 py-0.2 rounded font-mono">POST</span>
                </div>
                <div className="text-[11px] text-slate-300 mt-0.5">
                  שידור ישיר ל-hook.eu1.make.com עם שדות <code className="text-cyan-300 font-mono">to</code>, <code className="text-cyan-300 font-mono">message</code>, <code className="text-cyan-300 font-mono">action</code>, ו-<code className="text-cyan-300 font-mono">sender</code>.
                </div>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-start gap-3 text-xs">
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                4
              </div>
              <div>
                <div className="font-bold text-slate-200">הפצה מיידית לוואטסאפ של הלקוח</div>
                <div className="text-[11px] text-slate-400">תרחיש Make מפיץ את ההודעה ללקוח, ומעדכן במקביל את Firebase RTDB ואת Google Sheets.</div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Interactive Live Testing Panel (מבחן שידור חי) */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-cyan-500/30 shadow-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-100">מבחן הפעלה ושידור חי לכלי (Interactive Runner)</h3>
              <p className="text-[11px] text-slate-400">בדיקה בזמן אמת של trigger_joni_make מול ה-Webhook של Make</p>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-slate-400 font-semibold ml-1">תבניות מהירות:</span>
            {Object.entries(presetMessages).map(([key, item]) => (
              <button
                key={key}
                type="button"
                onClick={() => handleSelectPreset(key as any)}
                className="px-2.5 py-1 text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition-all active:scale-95"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleExecuteTool} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                מספר טלפון של הנמען (<code className="text-cyan-300 font-mono">to</code>):
              </label>
              <input
                type="text"
                value={toPhone}
                onChange={(e) => setToPhone(e.target.value)}
                placeholder="972508860896"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 font-mono dir-ltr text-left focus:outline-none focus:border-cyan-500 transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                סוג הפעולה (<code className="text-cyan-300 font-mono">action</code>):
              </label>
              <select
                value={selectedAction}
                onChange={(e) => setSelectedAction(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 transition-colors"
              >
                <option value="send_menu">send_menu (תפריט אפשרויות שירות)</option>
                <option value="order_update">order_update (אישור ועדכון הזמנת חומרים)</option>
                <option value="container_task">container_task (תיאום מכולת פסולת)</option>
                <option value="customer_reply">customer_reply (מענה שירותי מנועה AI)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              תוכן ההודעה לשידור (<code className="text-cyan-300 font-mono">message</code>):
            </label>
            <textarea
              rows={4}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="כתוב את ההודעה או התפריט שתרצה לשדר..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 font-sans focus:outline-none focus:border-cyan-500 transition-colors resize-y leading-relaxed"
              required
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <span className="font-semibold text-slate-300">שולח:</span>
              <span className="text-cyan-300 font-bold font-mono">נועה AI (ח. סבן)</span>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !messageText.trim()}
              className="flex items-center gap-2 px-6 py-2.5 min-h-[44px] bg-gradient-to-r from-cyan-600 via-teal-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 active:scale-95 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-xs shadow-lg shadow-cyan-600/25 transition-all"
            >
              <Send className={`w-4 h-4 ${isSubmitting ? 'animate-pulse' : ''}`} />
              <span>{isSubmitting ? 'משדר ישירות ל-Make...' : '🚀 הפעל כלי ושדר עכשיו ל-Make'}</span>
            </button>
          </div>
        </form>

        {/* Live Dispatch Result Card */}
        {dispatchResult && (
          <div className={`p-4 rounded-2xl border text-xs space-y-2 animate-in fade-in ${
            dispatchResult.success
              ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
              : 'bg-rose-950/40 border-rose-500/50 text-rose-200'
          }`}>
            <div className="flex items-center justify-between font-bold">
              <div className="flex items-center gap-2">
                {dispatchResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400" />
                )}
                <span>
                  {dispatchResult.success
                    ? 'הכלי הופעל בהצלחה! השדר נחת ב-Make Webhook'
                    : 'שגיאה בהפעלת הכלי'}
                </span>
              </div>
              <span className="font-mono text-[10px] bg-black/40 px-2 py-0.5 rounded">
                HTTP {dispatchResult.status || (dispatchResult.success ? 200 : 500)} {dispatchResult.result?.response || 'Accepted'}
              </span>
            </div>

            <div className="text-[11px] font-mono text-slate-300 dir-ltr text-left overflow-x-auto p-2.5 bg-slate-950 rounded-xl border border-slate-800 whitespace-pre-wrap">
              {JSON.stringify(dispatchResult.result?.payload || dispatchResult.payload || dispatchResult, null, 2)}
            </div>
          </div>
        )}
      </div>

      {/* Recent Dispatches Log Table */}
      <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-amber-400 animate-pulse" />
            <h3 className="font-bold text-sm text-slate-100">יומן שידורים אחרונים ל-Make (Dispatch History)</h3>
          </div>
          <span className="text-[11px] text-slate-400">
            {recentLogs.length} שידורים מתועדים
          </span>
        </div>

        {recentLogs.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500">
            טרם בוצעו שידורים בסשן הנוכחי. השתמש בטופס מעלה או בצע שיחה בצ'אט כדי להפעיל את הכלי.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                  <th className="p-2 font-semibold">זמן</th>
                  <th className="p-2 font-semibold">נמען (to)</th>
                  <th className="p-2 font-semibold">פעולה (action)</th>
                  <th className="p-2 font-semibold">תוכן מקוצר</th>
                  <th className="p-2 font-semibold">סטטוס</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {recentLogs.map((log, idx) => (
                  <tr key={log.id || idx} className="hover:bg-slate-850 transition-colors">
                    <td className="p-2 text-slate-400 font-mono text-[11px]">
                      {new Date(log.timestamp).toLocaleTimeString('he-IL')}
                    </td>
                    <td className="p-2 font-mono text-cyan-300 dir-ltr text-right">
                      +{log.to}
                    </td>
                    <td className="p-2">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                        {log.action}
                      </span>
                    </td>
                    <td className="p-2 text-slate-300 max-w-xs truncate" title={log.message}>
                      {log.message}
                    </td>
                    <td className="p-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        log.success || log.status === 200
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      }`}>
                        {log.status === 200 ? '200 OK' : `${log.status || 'ERR'}`}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};
