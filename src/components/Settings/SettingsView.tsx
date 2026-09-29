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
  AlertTriangle
} from 'lucide-react';
import { StudioSettings } from '../../types/studio';

interface SettingsViewProps {
  settings: StudioSettings;
  onSaveSettings: (settings: Partial<StudioSettings>) => Promise<void>;
  onTestWebhook: (text: string) => Promise<any>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSaveSettings,
  onTestWebhook,
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
    } catch (err: any) {
      setTestResult({ error: err.message });
    }
    setIsTesting(false);
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
            הגדרות קבועות עבור ח. סבן חומרי בניין, תוסף JONI וחיבור Meta WhatsApp Cloud API
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Column: Fixed Business Details & JONI Bridge */}
        <div className="space-y-6">
          
          {/* Business & Flow Settings */}
          <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
              <Phone className="w-4 h-4 text-emerald-400" />
              <span>פרטי עסק וזמני תגובה</span>
            </h3>

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                מספר טלפון עסקי (Business Number):
              </label>
              <input
                type="text"
                readOnly
                value={formData.businessNumber}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs font-mono text-emerald-400 dir-ltr text-right"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                מספר וואטסאפ רשמי של ח. סבן (+972 50-8860896)
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

        {/* Right Column: Meta WhatsApp Cloud API & Webhook Tester */}
        <div className="space-y-6">
          
          {/* Meta WhatsApp Cloud API Integration */}
          <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                <span>חיבור Meta WhatsApp Cloud API הקיים</span>
              </h3>
              <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/20 font-mono">
                v20.0
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              שליחת תפריטים מעוצבים כ-Interactive List עם 4 ענפי סבן (הובלה, איסוף, מכולות, מעקב). במידה ואין הרשאה, המערכת מבצעת Fallback אוטומטי לטקסט ממוספר 1-4.
            </p>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Phone Number ID:</label>
              <input
                type="text"
                value={formData.metaPhoneNumberId}
                onChange={(e) => setFormData({ ...formData, metaPhoneNumberId: e.target.value })}
                placeholder="109886089612345"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 dir-ltr text-left"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Meta Permanent Access Token:</label>
              <input
                type="password"
                value={formData.metaAccessToken}
                onChange={(e) => setFormData({ ...formData, metaAccessToken: e.target.value })}
                placeholder="EAAB..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 dir-ltr text-left"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                נשמר בצורה מאובטחת בסביבת השרת.
              </span>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-xs text-slate-300">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200">סייג ביטחון (Fallback אוטומטי לטקסט):</span>
                <span className="text-emerald-400 font-semibold">מופעל תמיד</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                אם לקוח משתמש בגרסת WhatsApp שלא תומכת ב-List Menu או אם יש שגיאת הרשאה זמנית מול פייסבוק, סבן סטודיו ממיר את התפריט להודעת טקסט מעוצבת עם בחירה 1, 2, 3, 4 ללא איבוד פניות.
              </p>
            </div>
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
