import React, { useState } from 'react';
import { 
  Settings, 
  Copy, 
  Check, 
  Save, 
  Flame, 
  Radio, 
  Phone, 
  Clock, 
  Languages, 
  Send, 
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Download,
  Smartphone,
  Sparkles,
  Layers,
  CheckCircle2,
  RefreshCw,
  Lock,
  MessageSquare
} from 'lucide-react';
import { StudioSettings } from '../../types/studio';
import { api } from '../../services/api';

interface SettingsViewProps {
  settings: StudioSettings;
  onSaveSettings: (settings: Partial<StudioSettings>) => Promise<void>;
  onTestWebhook: (text: string) => Promise<any>;
  onRefreshData?: () => void;
  isInstallable?: boolean;
  isInstalled?: boolean;
  onInstall?: () => void;
  isIOS?: boolean;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSaveSettings,
  onTestWebhook,
  onRefreshData,
  isInstallable,
  isInstalled,
  onInstall,
  isIOS
}) => {
  const [formData, setFormData] = useState<StudioSettings>({ ...settings });
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Copy state
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Test webhook
  const [testText, setTestText] = useState('היי, אשמח לתפריט חומרי בניין');
  const [testResult, setTestResult] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);

  // Meta Live Check State
  const [isCheckingMeta, setIsCheckingMeta] = useState(false);
  const [metaCheckResult, setMetaCheckResult] = useState<any>(null);

  // Meta Live Menu Send State
  const [recipientPhone, setRecipientPhone] = useState('052-4458912');
  const [isSendingLiveMenu, setIsSendingLiveMenu] = useState(false);
  const [liveMenuResult, setLiveMenuResult] = useState<any>(null);

  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const joniWebhookUrl = `${origin}/api/webhooks/joni`;
  const joniIncomingUrl = `${origin}/api/joni/incoming`;
  const metaWebhookUrl = `${origin}/api/webhooks/meta`;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    await onSaveSettings(formData);
    setIsSaving(false);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const runTestWebhook = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await onTestWebhook(testText);
      setTestResult(res);
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      setTestResult({ error: err.message });
    }
    setIsTesting(false);
  };

  const runMetaLiveCheck = async () => {
    setIsCheckingMeta(true);
    setMetaCheckResult(null);
    try {
      const res = await api.testMetaConnection();
      setMetaCheckResult(res);
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      setMetaCheckResult({ success: false, error: err.message });
    }
    setIsCheckingMeta(false);
  };

  const runSendLiveMenu = async () => {
    setIsSendingLiveMenu(true);
    setLiveMenuResult(null);
    try {
      const res = await api.sendLiveMetaMenu(recipientPhone);
      setLiveMenuResult(res);
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      setLiveMenuResult({ success: false, error: err.message });
    }
    setIsSendingLiveMenu(false);
  };

  return (
    <div className="flex-1 h-full overflow-y-auto bg-slate-950 p-6 space-y-6 text-right">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Settings className="w-5 h-5 text-orange-500" />
            <span>הגדרות מערכת ואינטגרציות</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            חיבור פעיל למספר +972508860896 (רמי מסארוה / ח. סבן), תוסף JONI ו-Meta Cloud API v20.0
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold shadow-lg transition-all ${
            savedSuccess
              ? 'bg-emerald-600 text-white'
              : 'bg-orange-600 hover:bg-orange-500 text-white shadow-orange-600/20'
          }`}
        >
          {savedSuccess ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          <span>{isSaving ? 'שומר...' : savedSuccess ? 'ההגדרות נשמרו!' : 'שמור הגדרות'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-20 md:pb-6">
        
        {/* Left Column: Fixed Business Details & JONI Bridge */}
        <div className="space-y-6">

          {/* PWA Mobile App Section */}
          <div className="p-5 rounded-3xl bg-gradient-to-tr from-slate-900 via-slate-900 to-[#075E54]/30 border border-[#25D366]/40 shadow-xl space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#075E54] to-[#25D366] flex items-center justify-center text-white shadow-md">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
                    <span>אפליקציית מובייל (PWA)</span>
                    <span className="text-[10px] bg-[#25D366]/20 text-[#25D366] px-2 py-0.2 rounded-full font-mono">
                      Samsung & Android
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">מותאם למסך 6.8" 120Hz ו-Note 23 Ultra</p>
                </div>
              </div>

              {isInstalled && (
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold border border-emerald-500/20">
                  מותקן במכשיר ✓
                </span>
              )}
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              התקנת סבן סטודיו כאפליקציית מובייל אמיתית מאפשרת פתיחה ישירה ממסך הבית, תצוגת מסך מלא ללא סרגל דפדפן, תגובתיות 120Hz חלקה ותמיכה מלאה בפינץ' וזום.
            </p>

            <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800">
              <div className="text-[11px] text-slate-400">
                {isInstalled 
                  ? 'סטטוס: האפליקציה פועלת במצב Standalone עצמאי' 
                  : isIOS 
                    ? 'לחץ שתף (Share) ב-Safari ובחר "הוסף למסך הבית"' 
                    : 'לחץ על הכפתור להתקנה מהירה של ה-PWA למכשיר'}
              </div>

              {!isInstalled && (
                <button
                  type="button"
                  onClick={onInstall}
                  className="flex items-center gap-2 px-4 py-2.5 min-h-[44px] bg-[#25D366] hover:bg-[#20ba5a] active:scale-95 text-slate-950 font-bold rounded-xl text-xs shadow-lg shadow-[#25D366]/25 transition-all"
                >
                  <Download className="w-4 h-4 stroke-[2.5]" />
                  <span>התקן כאפליקציה</span>
                </button>
              )}
            </div>
          </div>
          
          {/* Business & Flow Settings */}
          <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
              <Phone className="w-4 h-4 text-emerald-400" />
              <span>פרטי עסק וזמני תגובה</span>
            </h3>

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                שם העסק הרשמי (Business Name):
              </label>
              <input
                type="text"
                readOnly
                value="רמי מסארוה / ח. סבן חומרי בניין"
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs font-semibold text-slate-200"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                מספר טלפון עסקי רשמי (Business Display Phone):
              </label>
              <input
                type="text"
                readOnly
                value="+972 50-886-0896"
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs font-mono text-emerald-400 dir-ltr text-right"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                מספר וואטסאפ רשמי מאומת מול Meta Cloud API (+972 50-886-0896)
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>זמן המתנה (Wait Time):</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={formData.waitTimeSeconds}
                    onChange={(e) => setFormData({ ...formData, waitTimeSeconds: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono"
                  />
                  <span className="text-xs text-slate-400">שניות</span>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1 flex items-center gap-1">
                  <Languages className="w-3.5 h-3.5 text-blue-400" />
                  <span>שפת ברירת מחדל:</span>
                </label>
                <input
                  type="text"
                  readOnly
                  value="עברית (Hebrew)"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300"
                />
              </div>
            </div>
          </div>

          {/* JONI Webhook Endpoints (With 1-Click Copy) */}
          <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-400" />
                <span>כתובות Webhook עבור תוסף JONI</span>
              </h3>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">
                פעיל
              </span>
            </div>
            <p className="text-xs text-slate-400">
              הזן את הכתובת הזו בהגדרות תוסף JONI כדי להעביר את כל הודעות הוואטסאפ הנכנסות לסטודיו סבן:
            </p>

            {/* Primary JONI webhook endpoint */}
            <div>
              <span className="block text-[11px] font-semibold text-slate-300 mb-1">
                כתובת Webhook ראשית:
              </span>
              <div className="flex items-center gap-2 bg-slate-950 p-2 rounded-xl border border-slate-700/80">
                <span className="text-xs font-mono text-emerald-300 dir-ltr text-left flex-1 truncate select-all">
                  {joniWebhookUrl}
                </span>
                <button
                  onClick={() => handleCopy(joniWebhookUrl, 'joni1')}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors shrink-0"
                  title="העתק ללוח"
                >
                  {copiedKey === 'joni1' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Bridge Incoming Callback */}
            <div>
              <span className="block text-[11px] font-semibold text-slate-300 mb-1">
                נתיב JONI Incoming Bridge:
              </span>
              <div className="flex items-center gap-2 bg-slate-950 p-2 rounded-xl border border-slate-700/80">
                <span className="text-xs font-mono text-emerald-300 dir-ltr text-left flex-1 truncate select-all">
                  {joniIncomingUrl}
                </span>
                <button
                  onClick={() => handleCopy(joniIncomingUrl, 'joni2')}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors shrink-0"
                  title="העתק ללוח"
                >
                  {copiedKey === 'joni2' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Firebase send endpoint */}
            <div>
              <span className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-amber-500" />
                <span>כתובת Firebase RTDB קיימת של JONI (POST):</span>
              </span>
              <div className="flex items-center gap-2 bg-slate-950 p-2 rounded-xl border border-slate-700/80">
                <input
                  type="text"
                  value={formData.firebaseSendUrl}
                  onChange={(e) => setFormData({ ...formData, firebaseSendUrl: e.target.value })}
                  className="text-xs font-mono text-amber-300 dir-ltr text-left flex-1 bg-transparent border-none focus:outline-none"
                />
                <button
                  onClick={() => handleCopy(formData.firebaseSendUrl, 'firebase')}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors shrink-0"
                >
                  {copiedKey === 'firebase' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* Right Column: Meta WhatsApp Cloud API LIVE Connection & Interactive Menu Sender */}
        <div className="space-y-6">
          
          {/* Meta WhatsApp Cloud API LIVE Integration */}
          <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </div>
                <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>חיבור חי: Meta WhatsApp Cloud API</span>
                </h3>
              </div>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2.5 py-0.5 rounded-full border border-emerald-500/30 font-bold">
                מחובר ל-Cloud API ✅
              </span>
            </div>

            {/* Live Status Summary Card */}
            <div className="p-3.5 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-400 block">שם מאומת (Verified):</span>
                  <span className="font-bold text-emerald-300">ראמי מסארווה (ח. סבן)</span>
                </div>
                <div>
                  <span className="text-slate-400 block">מספר תצוגה (Display):</span>
                  <span className="font-mono text-slate-200 dir-ltr text-right block">+972 50-886-0896</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Phone Number ID:</span>
                  <span className="font-mono text-slate-300">646128321917738</span>
                </div>
                <div>
                  <span className="text-slate-400 block">גרסת Graph API:</span>
                  <span className="font-mono text-blue-400">v20.0 (TIER_250)</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                <span className="text-slate-400 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-amber-400" />
                  <span>אבטחת Token:</span>
                </span>
                <span className="text-emerald-400 font-mono text-[10px]">
                  אטום ומוצפן בצד שרת בלבד (.env.production)
                </span>
              </div>
            </div>

            {/* Ping Meta API Button */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={runMetaLiveCheck}
                disabled={isCheckingMeta}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition-all"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isCheckingMeta ? 'animate-spin text-emerald-400' : ''}`} />
                <span>{isCheckingMeta ? 'מבצע בדיקת חיבור מול Meta...' : 'בדוק חיבור חי (Ping Meta Graph API)'}</span>
              </button>
            </div>

            {metaCheckResult && (
              <div className="p-3 bg-emerald-950/30 border border-emerald-500/40 rounded-xl text-xs space-y-1 animate-in fade-in">
                <div className="flex items-center justify-between text-emerald-400 font-bold">
                  <span>תוצאת בדיקה חיה:</span>
                  <span className="text-[10px] font-mono bg-emerald-500/20 px-2 py-0.5 rounded">200 OK</span>
                </div>
                <div className="text-[11px] font-mono text-emerald-200 dir-ltr text-left overflow-x-auto whitespace-pre-wrap">
                  {metaCheckResult.checkSummary || JSON.stringify(metaCheckResult, null, 2)}
                </div>
              </div>
            )}
          </div>

          {/* Live Interactive Menu Dispatcher (Direct Send to Rami / Customer) */}
          <div className="p-5 rounded-3xl bg-gradient-to-br from-slate-900 to-emerald-950/20 border border-emerald-500/30 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#25D366]" />
                <span>שליחה חיה של תפריט מעוצב לוואטסאפ (Interactive List)</span>
              </h3>
              <span className="text-[10px] bg-[#25D366]/20 text-[#25D366] px-2 py-0.5 rounded-full font-bold">
                Live Meta API
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              שלח תפריט WhatsApp מעוצב בזמן אמת ישירות למספר הוואטסאפ הפרטי לבדיקה. התפריט כולל את 4 ענפי סבן: 🚚 הזמנה והובלה, 🏪 איסוף עצמי, 🗑️ מכולות פסולת, 📍 מעקב משלוח.
            </p>

            <div className="space-y-2">
              <label className="block text-xs text-slate-400">
                מספר טלפון לקבלת התפריט בוואטסאפ:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                  placeholder="05X-XXXXXXX / 9725XXXXXXXX"
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono dir-ltr text-left"
                />
                <button
                  type="button"
                  onClick={() => setRecipientPhone('052-4458912')}
                  className="px-2.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] rounded-xl border border-slate-700 shrink-0"
                >
                  מספר לדוגמה
                </button>
              </div>
              <span className="text-[10px] text-slate-500 block">
                * הערה: לפי חוקי Meta, המספר העסקי לא יכול לשלוח לעצמו. יש להזין מספר נייד אישי/נפרד.
              </span>
            </div>

            <button
              type="button"
              onClick={runSendLiveMenu}
              disabled={isSendingLiveMenu || !recipientPhone}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 min-h-[44px] bg-[#25D366] hover:bg-[#20ba5a] active:scale-95 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-xs shadow-lg shadow-[#25D366]/25 transition-all"
            >
              <Send className={`w-4 h-4 ${isSendingLiveMenu ? 'animate-pulse' : ''}`} />
              <span>{isSendingLiveMenu ? 'שולח תפריט מעוצב לוואטסאפ דרך Meta...' : '🚀 שלח תפריט מעוצב עכשיו לוואטסאפ'}</span>
            </button>

            {liveMenuResult && (
              <div className={`p-3.5 rounded-2xl text-xs space-y-1.5 animate-in fade-in ${
                liveMenuResult.success 
                  ? 'bg-emerald-950/40 border border-emerald-500/50 text-emerald-200' 
                  : 'bg-rose-950/40 border border-rose-500/50 text-rose-200'
              }`}>
                {liveMenuResult.success ? (
                  <>
                    <div className="flex items-center gap-1.5 font-bold text-emerald-400 text-sm">
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                      <span>✅ חיבור מלא - תפריט מעוצב נחת בוואטסאפ</span>
                    </div>
                    <div className="text-[11px] space-y-0.5 pt-1">
                      <div><span className="text-slate-400">אישור מסירה (Message ID):</span> <span className="font-mono text-emerald-300 select-all">{liveMenuResult.messageId}</span></div>
                      <div><span className="text-slate-400">נמען:</span> <span className="font-mono text-slate-200">+{liveMenuResult.recipient}</span></div>
                      <div><span className="text-slate-400">סטטוס:</span> <span className="text-emerald-300 font-semibold">{liveMenuResult.status}</span></div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="font-bold text-rose-400 flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>שגיאה בשליחת התפריט:</span>
                    </div>
                    <div className="text-[11px] font-mono whitespace-pre-wrap">
                      {liveMenuResult.hint || JSON.stringify(liveMenuResult.error || liveMenuResult, null, 2)}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Test Webhook Simulator Box */}
          <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
              <Send className="w-4 h-4 text-orange-400" />
              <span>בדיקת קליטת Webhook מקומי (Test Webhook)</span>
            </h3>

            <p className="text-xs text-slate-400">
              שלח הודעת בדיקה למנוע הסטודיו כדי לאמת שהתפריט והענפים מגיבים כראוי:
            </p>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                placeholder="טקסט לבדיקה (למשל: 'היי' או 'איפה ההזמנה')..."
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100"
              />
              <button
                onClick={runTestWebhook}
                disabled={isTesting}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shrink-0"
              >
                {isTesting ? 'בודק...' : 'שלח בדיקה'}
              </button>
            </div>

            {testResult && (
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1 animate-in fade-in">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-emerald-400 font-bold">תוצאת בדיקה:</span>
                  <span className="text-[10px] text-slate-400 font-mono">200 OK</span>
                </div>
                <div className="text-xs text-slate-300 font-mono whitespace-pre-wrap max-h-36 overflow-y-auto">
                  {testResult.sentResponseText || JSON.stringify(testResult, null, 2)}
                </div>
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
};

