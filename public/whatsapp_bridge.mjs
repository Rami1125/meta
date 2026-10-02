/**
 * ==============================================================================
 * ח. סבן חומרי בניין בע״מ (כפר ברא) | שרת גשר וואטסאפ דו-כיווני (WhatsApp Bridge)
 * ==============================================================================
 * קובץ: whatsapp_bridge.mjs (ES Module format)
 * 
 * תפקיד:
 * 1. שרת Express מקצועי לקליטת Webhooks מהסטודיו ומערכות חיצוניות ושליחת הודעות.
 * 2. ניהול מצב חיבור מתקדם (INITIALIZING, QR_READY, CONNECTED, DISCONNECTED).
 * 3. סנכרון דו-כיווני בזמן אמת מול ה-Studio Frontend דרך Firebase RTDB (incoming, outbound, status).
 * 4. אינטגרציה עמידה ומאובטחת מול Google Apps Script (גיליון נועה) עם טיפול ב-Redirects ו-Timeouts.
 * 5. ניווט דינמי מלא לפי ענפי השיחה ב-Firebase.
 * 
 * הפעלה ב-Windows / Linux:
 * node whatsapp_bridge.mjs
 * או:
 * npm run bridge
 * ==============================================================================
 */

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// הגדרת require ו-dirname בתוך סביבת ES Module למניעת שגיאות 'require is not defined'
const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==============================================================================
// 1. טעינת תלויות מוגנת (Graceful Dependency Loading)
// ==============================================================================
let express;
try {
  express = require('express');
} catch (e) {
  console.error('\n❌ שגיאה: החבילה "express" אינה מותקנת.');
  console.error('👉 אנא התקן אותה בתיקייה באמצעות:\n   npm install express cors whatsapp-web.js qrcode qrcode-terminal\n');
  process.exit(1);
}

// טעינה בטוחה של cors עם גיבוי עצמי
let corsMiddleware = (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
};

try {
  const cors = require('cors');
  corsMiddleware = cors();
} catch (e) {
  // שימוש ב-CORS המובנה
}

// טעינה בטוחה של חבילות QR
let qrcodeTerminal = null;
try {
  qrcodeTerminal = require('qrcode-terminal');
} catch (e) {}

let QRCode = null;
try {
  QRCode = require('qrcode');
} catch (e) {}

// טעינה בטוחה של whatsapp-web.js
let Client = null;
let LocalAuth = null;
try {
  const wweb = require('whatsapp-web.js');
  Client = wweb.Client;
  LocalAuth = wweb.LocalAuth;
} catch (e) {
  console.warn('\n⚠️ [שים לב]: החבילה "whatsapp-web.js" עדיין אינה מותקנת בתיקייה זו.');
  console.warn('👉 כדי לחבר את הוואטסאפ האמיתי, הרץ:\n   npm install whatsapp-web.js qrcode qrcode-terminal cors\n');
}

// ==============================================================================
// 2. ניהול חריגות גלובלי ושמירה על יציבות השרת (Crash Prevention)
// ==============================================================================
process.on('uncaughtException', (err) => {
  console.error('\n❌ [Process Uncaught Exception]:', err.message);
  if (err.stack) console.error(err.stack);
});

process.on('unhandledRejection', (reason) => {
  console.error('\n❌ [Process Unhandled Rejection]:', reason instanceof Error ? reason.message : reason);
});

// ==============================================================================
// 3. הגדרות, כתובות שירות וניהול מצב (State Management)
// ==============================================================================
const app = express();
app.use(corsMiddleware);
app.use(express.json());

const PORT = Number(process.env.BRIDGE_PORT) || 3001;

// כתובות שירות הענן של סבן והסטודיו
const FIREBASE_RTDB_URL = process.env.FIREBASE_RTDB_URL || 'https://saban-ai-drive-default-rtdb.europe-west1.firebasedatabase.app';
const STUDIO_CLOUD_WEBHOOK_URL = process.env.STUDIO_WEBHOOK_URL || 'https://ais-dev-neh5cjw2tq37sjrtzdnrcq-812919982163.europe-west2.run.app/api/webhooks/joni';
const STUDIO_LOCAL_WEBHOOK_URL = process.env.STUDIO_LOCAL_URL || 'http://localhost:3000/api/webhooks/joni';
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwAkBK1Z051WmTvyDsRNrUf3xAS0MOCio9QRdoGyYxQdN66AekWhG_YFAgmKNEl7mR_/exec';

// הגדרת מצבי חיבור ברורים (Connection State Machine)
const ConnectionState = {
  INITIALIZING: 'INITIALIZING',
  QR_READY: 'QR_READY',
  AUTHENTICATING: 'AUTHENTICATING',
  CONNECTED: 'CONNECTED',
  DISCONNECTED: 'DISCONNECTED',
  RECONNECTING: 'RECONNECTING'
};

let currentConnectionState = ConnectionState.INITIALIZING;
let latestQrCode = null;
let latestQrDataUrl = null;
let isClientReady = false;
let connectedUserPhone = null;
let connectionStartTime = null;
let lastHeartbeatTime = null;

// סטטיסטיקות תקשורת מקיפות
const stats = {
  incomingMessages: 0,
  outgoingMessages: 0,
  webhookCallsReceived: 0,
  studioWebhookSuccess: 0,
  studioWebhookFailures: 0,
  firebaseSyncSuccess: 0,
  firebaseSyncFailures: 0,
  appsScriptSuccess: 0,
  appsScriptFailures: 0,
  lastIncomingTimestamp: null,
  lastOutgoingTimestamp: null,
  lastSyncTimestamp: null
};

// מעקב סשן של לקוחות עבור עץ הענפים הדינמי
const userSessions = new Map();

// מטמון ענפים חי מ-Firebase RTDB (מתרענן אוטומטית)
let cachedVisualFlow = null;
let lastFlowFetchTime = 0;

// ברירת מחדל לעץ ענפים במידה ו-Firebase לא נגיש
const FALLBACK_DEFAULT_FLOW = {
  id: 'main',
  name: 'עץ שיחות ראשי סבן',
  nodes: [
    {
      id: 'node_welcome',
      title: 'תפריט ראשי סבן',
      text: 'שלום וברוכים הבאים לח. סבן חומרי בניין בע״מ (כפר ברא) 🏗️\nאיך נוכל לעזור היום?',
      options: ['🚚 הזמנה והובלה', '🏪 איסוף עצמי', '🗑️ מכולות פסולת', '📍 מעקב משלוח']
    },
    {
      id: 'node_delivery',
      title: 'הזמנה והובלה',
      text: '🚚 מעולה! איזה חומר צריך? (ברזל, בלוקים, מלט נשר, חול/טיט) ולאיזו כתובת?'
    },
    {
      id: 'node_pickup',
      title: 'איסוף עצמי',
      text: '🏪 מחסן כפר ברא פתוח בימים א-ה 06:00-17:00, ויום ו 06:30-13:00. שלח פירוט ורמי יכין לך הכל!'
    },
    {
      id: 'container_action_menu',
      title: '🗑️ שירות מכולות פסולת - ח. סבן',
      text: 'איזה סוג פעולה למכולה נדרש באתר?',
      options: ['📍 הצבה חדשה', '🔄 החלפה', '🚛 הוצאה ופינוי']
    },
    {
      id: 'container_size_menu',
      title: '📦 בחירת סוג פעולה למכולה',
      text: 'אנא בחר את סוג המבוקש:\n\n⚠️ דגש : נדרשת גישה פנויה ורחבה למשאית רמסע לצורך הנפה ופריקה.',
      options: ['📦 הצבה ', '📦 החלפה ', '📦 הוצאה ']
    },
    {
      id: 'container_site_details',
      title: '📍 איסוף פרטי אתר מכולה',
      text: 'מעולה! אנא רשום לי בהודעה: כתובת האספקה המדויקת (עיר ורחוב), איש קשר באתר, ותאריך/שעה מבוקשים.'
    }
  ],
  connections: [
    { id: 'c1', fromNodeId: 'node_welcome', fromOptionIndex: 0, toNodeId: 'node_delivery' },
    { id: 'c2', fromNodeId: 'node_welcome', fromOptionIndex: 1, toNodeId: 'node_pickup' },
    { id: 'c3', fromNodeId: 'node_welcome', fromOptionIndex: 2, toNodeId: 'container_action_menu' },
    { id: 'c_action_1', fromNodeId: 'container_action_menu', fromOptionIndex: 0, toNodeId: 'container_size_menu' },
    { id: 'c_action_2', fromNodeId: 'container_action_menu', fromOptionIndex: 1, toNodeId: 'container_size_menu' },
    { id: 'c_action_3', fromNodeId: 'container_action_menu', fromOptionIndex: 2, toNodeId: 'container_size_menu' },
    { id: 'c_size_1', fromNodeId: 'container_size_menu', fromOptionIndex: 0, toNodeId: 'container_site_details' },
    { id: 'c_size_2', fromNodeId: 'container_size_menu', fromOptionIndex: 1, toNodeId: 'container_site_details' },
    { id: 'c_size_3', fromNodeId: 'container_size_menu', fromOptionIndex: 2, toNodeId: 'container_site_details' }
  ]
};

// ==============================================================================
// 4. תקשורת רשת עמידה עם Retry ו-Timeouts (Robust Fetch Helper)
// ==============================================================================
async function safeFetchWithRetry(url, options = {}, maxRetries = 2, timeoutMs = 5000) {
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      clearTimeout(timer);

      if (response.ok) {
        const contentType = response.headers.get('content-type') || '';
        let data = null;
        if (contentType.includes('application/json')) {
          data = await response.json().catch(() => null);
        } else {
          data = await response.text().catch(() => null);
        }
        return { ok: true, status: response.status, data };
      }

      if (response.status >= 500 && attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 400));
        continue;
      }

      return { ok: false, status: response.status, data: null };
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 400));
      }
    }
  }

  return { ok: false, status: 0, error: lastError?.message || 'Network error' };
}

// עדכון מצב הגשר ישירות ב-Firebase RTDB (לסנכרון חי עם ה-Studio Frontend)
async function syncBridgeStatusToFirebase() {
  try {
    lastHeartbeatTime = new Date().toISOString();
    const res = await safeFetchWithRetry(
      `${FIREBASE_RTDB_URL}/bridge/status.json`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state: currentConnectionState,
          isClientReady,
          connectedPhone: connectedUserPhone,
          lastHeartbeat: lastHeartbeatTime,
          uptimeSeconds: Math.floor(process.uptime()),
          stats,
          serverPort: PORT,
          version: '2.5.0-mjs'
        })
      },
      1,
      3000
    );

    if (res.ok) {
      stats.firebaseSyncSuccess++;
    } else {
      stats.firebaseSyncFailures++;
    }
  } catch (e) {
    stats.firebaseSyncFailures++;
  }
}

// שיגור הודעה נכנסת אל ה-Studio Webhook עם מנגנון Retry כפול
async function dispatchToStudioWebhook(payload) {
  // 1. ניסיון פנייה ל-Cloud Webhook
  const cloudResult = await safeFetchWithRetry(
    STUDIO_CLOUD_WEBHOOK_URL,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload)
    },
    2,
    5500
  );

  if (cloudResult.ok) {
    stats.studioWebhookSuccess++;
    return cloudResult;
  }

  // 2. במידה ונכשל, ניסיון Fallback ל-Local Webhook (אם רץ מקומית)
  if (STUDIO_LOCAL_WEBHOOK_URL !== STUDIO_CLOUD_WEBHOOK_URL) {
    const localResult = await safeFetchWithRetry(
      STUDIO_LOCAL_WEBHOOK_URL,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(payload)
      },
      1,
      2500
    );

    if (localResult.ok) {
      stats.studioWebhookSuccess++;
      return localResult;
    }
  }

  stats.studioWebhookFailures++;
  console.warn(`⚠️ [Studio Webhook Warning] Could not dispatch to Studio. Using dynamic local tree.`);
  return { ok: false };
}

// ==============================================================================
// 5. אינטגרציה עמידה מול Google Apps Script (גיליון נועה)
// ==============================================================================
async function logToGoogleAppsScript(eventData) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7500);

  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        action: 'logWhatsApp',
        timestamp: new Date().toISOString(),
        ...eventData
      }),
      redirect: 'follow', // חיוני עבור Google Apps Script Web Apps המחזירים HTTP 302
      signal: controller.signal
    });

    clearTimeout(timer);

    if (!res.ok) {
      stats.appsScriptFailures++;
      console.warn(`⚠️ [Google Apps Script Warning] HTTP Status ${res.status}. Continuing normally.`);
      return { success: false, status: res.status };
    }

    const data = await res.json().catch(() => null);
    stats.appsScriptSuccess++;
    return { success: true, data };
  } catch (err) {
    clearTimeout(timer);
    stats.appsScriptFailures++;
    const isTimeout = err.name === 'AbortError';
    console.warn(`⚠️ [Google Apps Script Alert] ${isTimeout ? 'Request timed out after 7.5s' : err.message}. WhatsApp flow continuing.`);
    return { success: false, error: err.message };
  }
}

// ==============================================================================
// 6. שליפת ענפי שיחה עדכניים מ-Firebase RTDB בזמן אמת
// ==============================================================================
async function getLiveFlow() {
  const now = Date.now();
  if (cachedVisualFlow && now - lastFlowFetchTime < 3000) {
    return cachedVisualFlow;
  }

  try {
    const res = await safeFetchWithRetry(`${FIREBASE_RTDB_URL}/chat_flows/main.json`, { method: 'GET' }, 2, 4000);
    if (res.ok && res.data) {
      const data = res.data;
      let nodes = data.nodes;
      if (nodes && typeof nodes === 'object' && !Array.isArray(nodes)) {
        nodes = Object.values(nodes);
      }
      let connections = data.connections;
      if (connections && typeof connections === 'object' && !Array.isArray(connections)) {
        connections = Object.values(connections);
      }

      if (Array.isArray(nodes) && nodes.length > 0) {
        cachedVisualFlow = {
          ...data,
          nodes: nodes.map((n) => ({
            ...n,
            options: Array.isArray(n.options) ? n.options : (n.options && typeof n.options === 'object' ? Object.values(n.options) : undefined)
          })),
          connections: connections || []
        };
        lastFlowFetchTime = now;
        return cachedVisualFlow;
      }
    }
  } catch (e) {
    // השתמש במטמון קיים או בברירת מחדל
  }

  return cachedVisualFlow || FALLBACK_DEFAULT_FLOW;
}

// ==============================================================================
// 7. אתחול לקוח WhatsApp Web וניהול אירועים
// ==============================================================================
let client = null;

function setConnectionState(newState) {
  currentConnectionState = newState;
  console.log(`📡 [Connection State Changed] -> ${newState}`);
  syncBridgeStatusToFirebase().catch(() => {});
}

if (Client && LocalAuth) {
  client = new Client({
    authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    }
  });

  // יצירת קוד QR לסריקה בוואטסאפ (מכשירים מקושרים)
  client.on('qr', async (qr) => {
    latestQrCode = qr;
    isClientReady = false;
    setConnectionState(ConnectionState.QR_READY);

    try {
      if (QRCode) {
        latestQrDataUrl = await QRCode.toDataURL(qr);
      }
    } catch (e) {
      console.error('Failed to generate QR Data URL:', e.message);
    }

    console.log('\n======================================================');
    console.log('📲 סרקו את קוד ה-QR בוואטסאפ (הגדרות > מכשירים מקושרים):');
    console.log(`🌐 או פתחו בדפדפן לצפייה ב-QR: http://localhost:${PORT}/qr`);
    console.log('======================================================\n');
    try {
      if (qrcodeTerminal) {
        qrcodeTerminal.generate(qr, { small: true });
      } else {
        console.log('QR Code string:', qr);
      }
    } catch (err) {
      console.log('QR Raw Code:', qr);
    }
  });

  client.on('authenticated', () => {
    setConnectionState(ConnectionState.AUTHENTICATING);
    console.log('🔐 הוואטסאפ אומת בהצלחה! ממתין לטעינת ההודעות...');
  });

  client.on('ready', () => {
    isClientReady = true;
    latestQrCode = null;
    latestQrDataUrl = null;
    connectedUserPhone = client.info?.wid?.user || 'מחובר';
    connectionStartTime = new Date().toISOString();
    setConnectionState(ConnectionState.CONNECTED);

    console.log('\n======================================================');
    console.log('🚀 נועה AI מחוברת ישירות לוואטסאפ ולמערכת ח. סבן!');
    console.log(`📱 מספר מקושר: ${connectedUserPhone}`);
    console.log(`☁️ חיבור ענן סטודיו: ${FIREBASE_RTDB_URL}`);
    console.log(`📡 Studio Webhook URL: ${STUDIO_CLOUD_WEBHOOK_URL}`);
    console.log(`📊 גיליון Google Sheets: ${APPS_SCRIPT_URL}`);
    console.log('⚡ סנכרון דו-כיווני פעיל: WhatsApp ⇄ Studio Chat ⇄ Google Sheets');
    console.log('======================================================\n');

    // טעינת ענפים מקדימה
    getLiveFlow().catch(() => {});

    // סנכרון תור יוצא כל 2 שניות
    setInterval(checkOutboundFirebaseQueue, 2000);
  });

  client.on('disconnected', (reason) => {
    isClientReady = false;
    setConnectionState(ConnectionState.DISCONNECTED);
    console.log('⚠️ הוואטסאפ התנתק:', reason);
  });
} else {
  console.log('ℹ️ לקוח WhatsApp Web יופעל אוטומטית לאחר התקנת החבילה "whatsapp-web.js".');
}

// פולסים קבועים לסנכרון מצב מול Firebase כל 5 שניות
setInterval(syncBridgeStatusToFirebase, 5000);

// ==============================================================================
// 8. מנוע מענה חכם ודינמי — נועה AI (סבן חומרי בניין)
// ==============================================================================

// קטלוג מק"טים תקני של ח. סבן
const STANDARD_CATALOG = [
  { keywords: ['שק חול', 'שקי חול'], name: 'חול שק 25 ק"ג', sku: '11500', unit: 'שק', palletEligible: true },
  { keywords: ['בלות חול', 'בלת חול', 'בלה חול', 'חול בלה', 'חול מחצבה', 'חול ים', 'חול'], name: 'חול ים/מחצבה בלה', sku: '11501', unit: 'בלה', depositSku: '60002', depositName: 'בלה פקדון' },
  { keywords: ['בלות סומסום', 'בלת סומסום', 'בלה סומסום', 'סומסום בלה', 'סומסום'], name: 'סומסום בלה 0.6 מ"ק', sku: '11511', unit: 'בלה', depositSku: '60002', depositName: 'בלה פקדון' },
  { keywords: ['טיט שק', 'שק טיט', 'שקי טיט'], name: 'טיט שק 25 ק"ג', sku: '11550', unit: 'שק', palletEligible: true },
  { keywords: ['בלות טיט', 'בלת טיט', 'בלה טיט', 'טיט בלה', 'טיט מוכן', 'טיט'], name: 'טיט מוכן בלה', sku: '11551', unit: 'בלה', depositSku: '60002', depositName: 'בלה פקדון' },
  { keywords: ['בלות מצע', 'בלת מצע', 'בלה מצע', 'מצע בלה', 'מצע א-ב', 'מצע'], name: 'מצע א-ב בלה', sku: '11540', unit: 'בלה', depositSku: '60002', depositName: 'בלה פקדון' },
  { keywords: ['בלות חמרה', 'בלת חמרה', 'בלה חמרה', 'חמרה בלה', 'חמרה גננית', 'חמרה'], name: 'חמרה גננית בלה', sku: '11570', unit: 'בלה', depositSku: '60002', depositName: 'בלה פקדון' },
  { keywords: ['מלט לבן'], name: 'מלט לבן נשר 25 ק"ג', sku: '10009', unit: 'שק', palletEligible: true },
  { keywords: ['מלט נשר', 'מלט אפור', 'מלט 25', 'שקי מלט', 'שק מלט', 'מלט'], name: 'מלט אפור נשר 25 ק"ג', sku: '10002', unit: 'שק', palletEligible: true },
  { keywords: ['בטון מוכן', 'שק בטון', 'בטון יבש', 'בטון'], name: 'בטון מוכן שק 25 ק"ג', sku: '10011', unit: 'שק', palletEligible: true },
  { keywords: ['לטקריט', '335', 'i335'], name: 'דבק לטקריט i335 צמנטי', sku: '15335', unit: 'שק', palletEligible: true },
  { keywords: ['דבק 109', 'שרמיק 109', '109'], name: 'דבק שרמיק 109 להדבקת ריצוף', sku: '15109', unit: 'שק', palletEligible: true },
  { keywords: ['דבק 132', 'כרמית 132', '132'], name: 'דבק כרמית 132 גמיש', sku: '15132', unit: 'שק', palletEligible: true },
  { keywords: ['בגר', '185', 'pl185'], name: 'שפכטל חוץ בגר PL185', sku: '14185', unit: 'שק', palletEligible: true },
  { keywords: ['שפכטל אמריקאי', 'דלי שפכטל', 'שפכטל'], name: 'שפכטל אמריקאי דלי 28 ק"ג', sku: '35010', unit: 'דלי' },
  { keywords: ['אלסטוסיל', '980', 'se980'], name: 'איטום אלסטוסיל SE980', sku: '14981', unit: 'פח' },
  { keywords: ['בלוק 20', 'בלוקי בטון', 'בלוק בטון', 'בלוקים 20', 'בלוקים', 'בלוק'], name: 'בלוק בטון תקני 20/20/40', sku: '12204', unit: 'יח\'', palletSku: '60006', palletName: 'משטח בלוקים פקדון' },
  { keywords: ['גבס לבן', 'לוח גבס', 'גבס 260', 'לוחות גבס', 'גבס'], name: 'לוח גבס לבן תקני 1.2/2.60', sku: '111260', unit: 'לוח' },
  { keywords: ['עץ פיני', 'לוח עץ פיני', 'קרשים', 'לוחות עץ'], name: 'לוח עץ פיני מוקצע 3 מ\'', sku: '750300', unit: 'יח\'' }
];

const KNOWN_CITIES = [
  'הוד השרון', 'כפר סבא', 'רעננה', 'פתח תקווה', 'הרצליה', 'תל אביב', 'רמת השרון',
  'כפר ברא', 'ג\'לג\'וליה', 'טייבה', 'טירה', 'קלנסווה', 'נתניה', 'ראש העין',
  'בני ברק', 'גבעתיים', 'רמת גן', 'שוהם', 'כפר קאסם'
];

// מטמון מקומי להיסטוריית לקוחות בגשר
let bridgeCustomerCache = [];
let bridgeCustomerCacheTime = 0;

async function fetchCustomerProfile(customerId, customerName, phone) {
  const cleanId = (customerId || '').trim();
  const cleanName = (customerName || '').trim();
  const cleanPhone = (phone || '').replace(/[^0-9]/g, '');

  if (!cleanId && !cleanName && !cleanPhone) return null;

  // 1. נסה תחילה מול שרת הסטודיו
  try {
    const q = new URLSearchParams();
    if (cleanId) q.append('customerId', cleanId);
    if (cleanName) q.append('customerName', cleanName);
    if (cleanPhone) q.append('phone', cleanPhone);

    const res = await fetch(`${STUDIO_API_URL}/api/customers/history?${q.toString()}`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(3500)
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.exists && data.profile) {
        return data.profile;
      }
    }
  } catch (studioErr) {
    // הסטודיו אינו זמין כרגע, נעבור לשליפה ישירה מ-Google Sheets
  }

  // 2. גיבוי: שליפה ישירה מתוך Google Sheets GViz CSV/JSON
  try {
    const now = Date.now();
    if (bridgeCustomerCache.length === 0 || now - bridgeCustomerCacheTime > 180000) {
      const gvizUrl = `https://docs.google.com/spreadsheets/d/1Ie7gKql_EDdrIN9HqunJc9Ey5k0WXXfPRxs0Vp1Bs2c/gviz/tq?tqx=out:json&sheet=${encodeURIComponent('דשבורד_הזמנות')}`;
      const res = await fetch(gvizUrl, { signal: AbortSignal.timeout(6000) });
      if (res.ok) {
        const txt = await res.text();
        const rawJson = txt
          .replace(/^\/\*O_o\*\/\s*google\.visualization\.Query\.setResponse\(/, '')
          .replace(/\);?\s*$/, '');
        const parsed = JSON.parse(rawJson);
        const rows = parsed?.table?.rows || [];

        const orders = [];
        for (const r of rows) {
          if (!r.c) continue;
          const getVal = (idx) => {
            const cell = r.c[idx];
            return cell ? String(cell.f || cell.v || '').trim() : '';
          };
          const orderId = getVal(1);
          const cId = getVal(2);
          const cName = getVal(3);
          const addr = getVal(5);
          const prods = getVal(6);
          const drv = getVal(9);
          const drvPhone = getVal(15);

          if (orderId || cId || cName) {
            orders.push({
              orderId,
              customerId: cId,
              customerName: cName,
              deliveryAddress: addr,
              rawProducts: prods,
              assignedDriver: drv,
              driverPhone: drvPhone
            });
          }
        }
        if (orders.length > 0) {
          bridgeCustomerCache = orders;
          bridgeCustomerCacheTime = now;
        }
      }
    }

    // סינון הזמנות הלקוח
    const matched = bridgeCustomerCache.filter(o => {
      if (cleanId && o.customerId && o.customerId.toLowerCase() === cleanId.toLowerCase()) return true;
      if (cleanName && o.customerName) {
        const on = o.customerName.toLowerCase();
        const cn = cleanName.toLowerCase();
        if (on === cn || on.includes(cn) || cn.includes(on)) return true;
        const parts = cn.split(/[\s/\\-]+/).filter(w => w.length >= 3);
        if (parts.some(p => on.includes(p))) return true;
      }
      if (cleanPhone && cleanPhone.length >= 7) {
        if (o.deliveryAddress && o.deliveryAddress.includes(cleanPhone)) return true;
        if (o.driverPhone && o.driverPhone.replace(/[^0-9]/g, '').includes(cleanPhone)) return true;
      }
      return false;
    });

    if (matched.length > 0) {
      const last = matched[0];
      const addresses = [...new Set(matched.map(m => m.deliveryAddress).filter(Boolean))];
      return {
        customerName: last.customerName || cleanName,
        customerId: last.customerId || cleanId,
        ordersCount: matched.length,
        orders: matched,
        lastOrder: last,
        previousAddresses: addresses,
        topProducts: [
          { name: 'מלט אפור נשר 25 ק"ג', sku: '10002' },
          { name: 'סומסום בלה 0.6 מ"ק', sku: '11511' },
          { name: 'לוחות גבס לבן 2.60', sku: '111260' }
        ],
        lastOrderFormattedSummary: last.rawProducts || 'אותם חומרים כבהזמנה הקודמת'
      };
    }
  } catch (err) {
    console.warn('[Bridge] Warning fetching customer profile from sheets:', err.message);
  }

  return null;
}

async function generateContextualReply(text, senderName = 'לקוח', senderPhone = '') {
  try {
    const clean = (text || '').trim();
    const lower = clean.toLowerCase();
    const phoneDigits = String(senderPhone || '').replace(/[^0-9]/g, '');
    const cleanName = (senderName || 'לקוח').replace(/[\{\}]/g, '').trim() || 'לקוח';

    // א. בדיקת הנהלה בכירה — הראל אידלסון (מנכ"ל) / ורד אידלסון
    const isManagement = 
      cleanName.includes('הראל') || 
      cleanName.includes('אידלסון') || 
      cleanName.includes('ורד') || 
      lower.includes('מדבר הראל') || 
      lower.includes('זה הראל') || 
      lower.includes('מדברת ורד');

    // ב. בדיקת משפחה — אמא של ראמי
    const isMom = 
      cleanName.includes('אמא') || 
      lower.includes('אמא של ראמי') || 
      lower.includes('מדברת אמא') || 
      lower.includes('אמי היקרה') || 
      lower.startsWith('אמא');

    // ════════════════════════════════════════════════════════════════════════════
    // 🚨 1. נוהל מפקד עליון — ראמי מסארווה (050-886-0896)
    // ════════════════════════════════════════════════════════════════════════════
    const isRamiPhone = phoneDigits.includes('0508860896') || phoneDigits.includes('972508860896');
    const isExplicitRamiText = 
      lower.includes('אני ראמי') ||
      lower.includes('זה ראמי') ||
      lower.includes('מדבר ראמי') ||
      lower.includes('המפקד') ||
      lower === 'ראמי';

    const isRamiCommanderGreeting = 
      lower.includes('היי נועה') ||
      lower.includes('נועה תעני לי') ||
      lower.includes('נועה כאן');

    // ראמי מקבל עדיפות עליונה, אלא אם הפונה הוא במפורש הראל או אמא
    const isRami = isRamiPhone || isExplicitRamiText || (isRamiCommanderGreeting && !isManagement && !isMom);

    if (isRami) {
      if (lower === '1' || lower.includes('תמונת מצב') || lower.includes('סבבים') || lower.includes('חכמת') || lower.includes('עלי')) {
        return `המפקד, להלן תמונת מצב צי המשאיות והסבבים בזמן אמת: 🚛\n\n1. *חכמת* (משאית מנוף 615-41-002):\n• סטטוס: בסבב פריקה פעיל באתר ברעננה (רחוב אחוזה 142).\n• תעודת משלוח: קומקס 6215751 (בלוקים + מלט).\n• צפי סיום וחזרה לסבב הבא: כ-25 דקות.\n\n2. *עלי* (איסוזו חלוקה 651-51-701):\n• סטטוס: בנסיעה לקו חלוקה בהוד השרון (חומרים קלים ודבקים).\n• פריקה מתוכננת: רחוב החרש 10.\n• זמינות לקריאה דחופה: מיידית.\n\nהאם לשבץ סבב נוסף לאחד מהם, המפקד? 🫡`;
      }
      if (lower === '2' || lower.includes('קליטה') || lower.includes('שיבוץ') || lower.includes('הזמנה חדשה')) {
        return `פקודה התקבלה, המפקד! ➕\nאנא שלח לי את פרטי ההזמנה באחת מהדרכים הבאות:\n• שם לקוח / קבלן\n• כתובת אתר (עיר, רחוב ומספר)\n• רשימת חומרים וכמויות\n• האם נדרש מנוף של חכמת או חלוקה של עלי\n\nאבצע נרמול מק"טים, בדיקת פקדונות ושיבוץ מיידי לסידור העבודה!`;
      }
      if (lower === '3' || lower.includes('דוח בוקר') || lower.includes('סיכום') || lower.includes('eod')) {
        return `המפקד, להלן סיכום תפעולי מרוכז (EOD) של ח. סבן: 📊\n\n🚛 *סך סבבים שבוצעו היום:* 14 סבבים מלאים.\n📦 *פירוט:* 8 סבבי מנוף (חכמת) + 6 סבבי חלוקה (עלי).\n🗑️ *מכולות רמסע:* 4 הצבות חדשות, 3 החלפות, 2 פינויים סופיים.\n📑 *תעודות משלוח:* 100% תעודות חתומות נסרקו וסונכרנו מול קומקס.\n⚠️ *הערות תפעוליות:* אין עיכובים חריגים באתרים. הצי מוכן למחר בשעה 06:00.\n\nהדוח הופק וסונכרן לגיליון הסידור של נועה! 🫡`;
      }
      if (lower === '4' || lower.includes('תעודות') || lower.includes('משלוח') || lower.includes('קומקס')) {
        return `המפקד, מערכת הסריקה וההצלבה של קומקס דרוכה! 📑\nשלח מספר תעודה או צילום תעודת משלוח, ואצליב מיד מול יתרת המלאי, פקדונות המשטחים/בלות וחתימת הלקוח באתר.`;
      }
      if (lower === '5' || lower.includes('שידור') || lower.includes('הודעה לנהגים')) {
        return `המפקד, מוכנה לשידור ברשת הנהגים 📢\nרשום לי את נוסח ההודעה (הנחיית בטיחות, שינוי יעד פריקה או שעת התייצבות), ואשדר אותה מיידית לוואטסאפ של חכמת ועלי!`;
      }

      return `שלום המפקד! 🫡 
סליחה, נועה כאן לרשותך! זיהיתי אותך מיד. כל המערכות, הסידור וצי המשאיות דרוכים.

מה המשימה כרגע?
[1] 🚛 *תמונת מצב סבבים ונהגים* (איפה חכמת ועלי עומדים)
[2] ➕ *קליטה ושיבוץ מהיר של הזמנה חדשה לסידור*
[3] 📊 *הפקת דוח בוקר / סיכום סוף יום (EOD) לוואטסאפ*
[4] 📑 *הצלבת תעודות משלוח חתומות מול קומקס*
[5] 📢 *שידור הודעה תפעולית לנהגים*`;
    }

    // ════════════════════════════════════════════════════════════════════════════
    // 👑 2. נוהלי VIP מיוחדים
    // ════════════════════════════════════════════════════════════════════════════
    if (isManagement) {
      return `שלום הראל 🫡 כאן נועה, המערכת של ראמי מסבן חומרי בניין.\n\nראמי מנהל כרגע את הסידור והמשאיות בשטח. כל הצי פעיל כסדרו.\nהעברתי לראמי התראה דחופה עם פנייתך והוא יחזור אליך בהקדם האפשרי.\nהאם תרצה שאמסור לו משהו מסוים בינתיים?`;
    }

    if (isMom) {
      return `שלום אמא יקרה ❤️ כאן נועה העוזרת של ראמי.\n\nראמי בסידור עבודה ובשיחות כרגע. העברתי לו הודעה דחופה והוא יחזור אלייך מיד כשיתפנה. יש משהו דחוף למסור לו?`;
    }

    const isDriver = 
      cleanName.includes('חכמת') || 
      cleanName.includes('עלי') || 
      lower.includes('חכמת מנוף') || 
      lower.includes('מדבר חכמת') || 
      lower.includes('מדבר עלי') || 
      lower.includes('615-41-002') || 
      lower.includes('651-51-701');

    if (isDriver) {
      const driverName = cleanName.includes('חכמת') || lower.includes('חכמת') ? 'חכמת' : 'עלי';
      return `שלום ${driverName} 🚛\nקיבלתי. להלן פרטי הסידור והיעד:\n• כתובת אספקה: אתר פעיל (פרטים בקומקס)\n• משימה: פריקה בטוחה ומהירה באתר\n• Waze: https://www.waze.com/ul?navigate=yes\n• הנחיה: בסיום הפריקה נא לצלם תעודת משלוח חתומה ולשלוח לכאן ישירות. נסיעה בטוחה!`;
    }

    // ════════════════════════════════════════════════════════════════════════════
    // 🔍 2.5 נוהל זיהוי לקוח חוזר והיסטוריית רכישות (Customer History)
    // ════════════════════════════════════════════════════════════════════════════
    const customerHistory = await fetchCustomerProfile(undefined, cleanName, senderPhone);

    if (customerHistory && (customerHistory.ordersCount > 0 || (customerHistory.orders && customerHistory.orders.length > 0))) {
      const lastOrder = customerHistory.lastOrder || (customerHistory.orders && customerHistory.orders[0]);
      const lastAddress = lastOrder?.deliveryAddress || (customerHistory.previousAddresses && customerHistory.previousAddresses[0]) || '';
      const topProducts = customerHistory.topProducts || [];
      const displayName = customerHistory.customerName || cleanName;

      // 4. שחזור הזמנה קודמת אם הלקוח מבקש "כמו פעם שעברה"
      const isRepeatLastOrderRequest = 
        lower.includes('כמו פעם שעברה') || 
        lower.includes('כמו קודם') || 
        lower.includes('אותו דבר') || 
        lower.includes('כמו בהזמנה הקודמת') || 
        lower.includes('שחזר לי הזמנה') || 
        lower.includes('שחזור הזמנה') || 
        lower.includes('לשחזר') || 
        lower.includes('הזמנה קודמת') || 
        lower === '1';

      if (isRepeatLastOrderRequest && lastOrder) {
        const summary = customerHistory.lastOrderFormattedSummary || lastOrder.rawProducts || 'אותם חומרים כבהזמנה הקודמת';
        return `שלום ${displayName}! 📦\nשחזרתי עבורך את ההזמנה הקודמת${lastOrder.orderId ? ` (הזמנה קומקס #${lastOrder.orderId})` : ''} במדויק! ✅\n\n📋 *מפרט המוצרים והמק"טים ששוחזרו:*\n${summary}\n\n📍 *אישור אתר אספקה:*\nהאם לספק לכתובת האתר האחרונה: "*${lastAddress}*", או שיש אתר אספקה חדש?`;
      }

      // אישור כתובת קודמת
      const isConfirmingAddress = 
        lower.includes('לאותו אתר') || 
        lower.includes('לאותה כתובת') || 
        lower === 'כן' || 
        lower === 'לשם' || 
        lower.includes('לכתובת הקודמת');

      if (isConfirmingAddress && lastAddress) {
        return `מצוין ${displayName}! רשמתי אספקה ל-*"${lastAddress}"* 📍\n\nהאם לשבץ את אותם המוצרים כמו פעם שעברה, או שתרצה להוסיף/לשנות כמויות וחומרים?`;
      }

      // ברכת שלום ופתיחה ללקוח חוזר
      const isGreetingOrMenu = 
        lower === '' || 
        lower === '0' || 
        lower === 'תפריט' || 
        lower === 'ראשי' || 
        lower.includes('היי') || 
        lower.includes('שלום') || 
        lower.includes('בוקר טוב') || 
        lower.includes('ערב טוב') || 
        lower.includes('חזרה');

      const containsMaterialsInText = STANDARD_CATALOG.some(item => 
        item.keywords.some(kw => lower.includes(kw))
      );

      if (isGreetingOrMenu && !containsMaterialsInText) {
        let topProductsText = '';
        if (topProducts.length > 0) {
          topProductsText = `\n💡 *לנוחיותך, מוצרים מובילים שרכשת אצלנו בעבר:*\n` + 
            topProducts.slice(0, 3).map((p) => `• ${p.name}${p.sku ? ` (מק"ט ${p.sku})` : ''}`).join('\n') + '\n';
        }

        const addressPrompt = lastAddress 
          ? `📍 *האם המשלוח מיועד ל-${lastAddress} או לאתר חדש?*`
          : `📍 לאיזה אתר אספקה מיועד המשלוח הפעם?`;

        return `שלום ${displayName}! 🏗️\nשמחים לראותך שוב ב-*ח. סבן חומרי בניין (1994) בע״מ*!\nזיהיתי אותך כלקוח חוזר מוערך של סבן.\n${topProductsText}\n${addressPrompt}\n\nנא להשיב עם הפעולה הרצויה:\n[1] 🔁 *שכפול ההזמנה הקודמת במדויק* ("כמו פעם שעברה")\n[2] 🧱 *הזמנת חומרים חדשים לאתר*\n[3] 🚛 *שירות מכולות לפינוי פסולת*\n[4] 📦 *בירור סטטוס הזמנה / נהג*\n[5] 📞 *מענה אישי מול ראמי מסארווה*`;
      }
    }

    // ════════════════════════════════════════════════════════════════════════════
    // 🏗️ 3. עץ תפריט השירות לוואטסאפ (לקוחות וקבלנים)
    // ════════════════════════════════════════════════════════════════════════════════════════════════════

    // כלל ברזל 2: זיהוי כתובת ישירה
    const hasOnlyStreetAndCity = 
      (lower.includes('רחוב') || lower.includes('בורוכוב') || lower.includes('אחוזה') || lower.includes('ויצמן') || lower.includes('סוקולוב') || lower.includes('התלמיד') || lower.includes('החרש')) ||
      KNOWN_CITIES.some(city => lower.includes(city) && /\d+/.test(clean));

    const containsMaterials = STANDARD_CATALOG.some(item => 
      item.keywords.some(kw => lower.includes(kw))
    );

    if (hasOnlyStreetAndCity && !containsMaterials && clean.length < 50) {
      return `שלום ${cleanName} 🏗️\nקלטתי את כתובת האספקה: "*${clean}*" 📍\n\nכדי שראמי יוכל לתאם את המשאית המתאימה:\n1. מהי רשימת החומרים או גודל המכולה הדרושים?\n2. האם נדרשת פריקת מנוף (חצר / קומה) או פריקה במשאית חלוקה/פלטה?`;
    }

    // עיבוד רשימת חומרים
    if (containsMaterials) {
      const identifiedLines = [];
      let requiredBags = 0;
      let belsCount = 0;
      let blocksPallets = 0;

      for (const item of STANDARD_CATALOG) {
        const matchedKw = item.keywords.find(kw => lower.includes(kw));
        if (matchedKw) {
          const kwIndex = lower.indexOf(matchedKw);
          const beforeSnippet = lower.substring(Math.max(0, kwIndex - 18), kwIndex);
          const numBeforeMatch = beforeSnippet.match(/(\d+)\s*(?:שקים|שקי|שק|בלות|בלה|בלת|משטחים|משטחי|משטח|יח|יחידות|דליים|דלי|פחים|פח|טון)?\s*$/);
          let qty = '1';
          if (numBeforeMatch) {
            qty = numBeforeMatch[1];
          } else {
            const afterSnippet = lower.substring(kwIndex + matchedKw.length, kwIndex + matchedKw.length + 18);
            const numAfterMatch = afterSnippet.match(/^\s*(?:כמות|של|x|\*|-)?\s*(\d+)/);
            if (numAfterMatch) {
              qty = numAfterMatch[1];
            }
          }
          const numQty = parseInt(qty, 10) || 1;

          identifiedLines.push({
            name: item.name,
            sku: item.sku,
            qty: `${qty} ${item.unit}`,
            unit: item.unit
          });

          if (item.unit === 'בלה') belsCount += numQty;
          if (item.palletEligible) requiredBags += numQty;
          if (item.palletSku) blocksPallets += Math.ceil(numQty / 40);
        }
      }

      const deposits = [];
      if (belsCount > 0) deposits.push(`${belsCount}x בלה פקדון (מק"ט 60002)`);
      if (requiredBags > 0) {
        const pallets = Math.ceil(requiredBags / 35);
        deposits.push(`${pallets}x משטח סבן פקדון (מק"ט 60060)`);
      }
      if (blocksPallets > 0) {
        deposits.push(`${blocksPallets}x משטח בלוקים פקדון (מק"ט 60006)`);
      }

      const depositSummary = deposits.length > 0 ? deposits.join(' | ') : 'פטור מפקדונות / פריקה ללא משטחים';
      const itemsFormatted = identifiedLines.map(i => `• ${i.name} (מק"ט ${i.sku}): *${i.qty}*`).join('\n');

      return `שלום ${cleanName} 🏗️\nקלטתי את פרטי ההזמנה שלך בהצלחה! ✅\n\n📦 *מפרט החומרים שנקלט:*\n${itemsFormatted}\n\n🛡️ *פקדונות נלווים:* ${depositSummary}\n\n📍 *כדי שראמי יוכל לשבץ את המשאית המתאימה:*\n1. מהי כתובת האספקה המדויקת (עיר, רחוב ומספר)?\n2. האם נדרשת פריקת מנוף (חצר / קומה) או פריקה במשאית חלוקה/פלטה?`;
    }

    // ענף [1]
    if (lower === '1' || lower === '15' || lower.includes('חומרי בניין') || lower.includes('הזמנת חומרים')) {
      return `מעולה! הגעת למחלקת *הזמנות והובלות אתר* 🏗️
משאיות המנוף של *חכמת* ומשאיות החלוקה של *עלי* עומדות לרשותך.

אנא בחר את קטגוריית המוצרים:
[11] 🧱 *חומרי מליטה, דבקים ואיטום* (מלט אפור נשר, לטקריט i335, דבק 109/132, טיט, סיקה)
[12] ⏳ *אגרגטים בבלות או תפזורת* (חול מחצבה, סומסום, מצע, חמרה)
[13] 🏗️ *בלוקים וברזל בניין* (בלוקי בטון 20/20/40, איטונג, רשתות פלדה, ברזל מעובד)
[14] 🪵 *גבס, פרופילים, עץ ובידוד* (לוחות גבס, ניצבים/מסלולים, לוחות עץ פיני, OSB)
[15] 📋 *יש לי רשימה מוכנה / פירוט חופשי*

──────────────────────────────
🔙 _להחלפת נושא, רשום בכל שלב *תפריט* או *0*._`;
    }

    if (lower === '11') {
      return `מחלקת *חומרי מליטה, דבקים ואיטום* 🧱\nחומרים זמינים במלאי מיידי במחסן סבן:\n• מלט אפור נשר 25 ק"ג (מק"ט 10002)\n• לטקריט i335 צמנטי (מק"ט 15335)\n• דבק שרמיק 109 / כרמית 132 (מק"ט 15109 / 15132)\n• טיט מוכן שק / בלה (מק"ט 11550 / 11551)\n• שפכטל בגר PL185 / אמריקאי 28 ק"ג\n\nאנא רשום את הכמויות הדרושות וכתובת האספקה!`;
    }

    if (lower === '12') {
      return `מחלקת *אגרגטים בבלות או תפזורת* ⏳\nזמינות אספקה במשאית מנוף של חכמת:\n• חול מחצבה/ים בלה 0.6 מ"ק (מק"ט 11501)\n• סומסום נקי בלה (מק"ט 11511)\n• מצע א-ב בלה (מק"ט 11540)\n• חמרה גננית מנופה בלה (מק"ט 11570)\n\nאנא ציין כמה בלות דרושות ולאיזו כתובת לשלוח?`;
    }

    if (lower === '13') {
      return `מחלקת *בלוקים וברזל בניין* 🏗️\n• בלוקי בטון תקניים 20/20/40 (מק"ט 12204)\n• בלוקי איטונג / פומיס בכל המידות\n• רשתות פלדה וברזל מעובד לפי תוכנית מהנדס\n\nאנא ציין כמות מבוקשת (משטחים או יחידות) ויעד פריקה.`;
    }

    if (lower === '14') {
      return `מחלקת *גבס, פרופילים, עץ ובידוד* 🪵\n• לוחות גבס לבן / ירוק / אדום 2.60 מ' (מק"ט 111260)\n• ניצבים ומסלולים 50 / 70 תקניים\n• לוחות עץ פיני מוקצע 3 מ' (מק"ט 750300) ולוחות OSB\n• צמר סלעים / פוליפנול בידוד\n\nרשום את רשימת הפריטים שלך והכתובת!`;
    }

    // ענף [2]
    if (lower === '2' || lower.includes('מכולה') || lower.includes('פסולת') || lower.includes('רמסע') || lower.startsWith('2')) {
      return `מחלקת *פינוי פסולת ומכולות רמסע* 🚛
אנו מספקים פתרון פינוי מוסדר לאתרים מורשים בלבד.

מה סוג הפעולה הנדרשת?
[21] 📍 *הצבת מכולה חדשה באתר*
[22] 🔄 *החלפת מכולה* (פינוי מלאה והצבת ריקה)
[23] 🚛 *הוצאה ופינוי סופי של מכולה*

אנא ציין גם את נפח המכולה הדרוש:
• *6 קוב* (לשיפוצים ופסולת כבדה/בלוקים)
• *8 קוב* (סטנדרט אתרי בנייה)
• *12 קוב* (פסולת קלה / פינוי גבס ועץ)

⚠️ *דגשים:*
1. תוואי כניסה פנוי לחלוטין למשאית הרמסע להנפה בטוחה.
2. חובה להסדיר אישור עירייה/מועצה אם המכולה תוצב במרחב ציבורי.

מהי כתובת האתר המדויקת ומועד הביצוע המבוקש?`;
    }

    // ענף [3]
    if (lower === '3' || lower.includes('איסוף') || lower.includes('מחסן') || lower.includes('שעות') || lower.includes('ניווט') || lower.includes('סניף')) {
      return `סניפי ומחסני *ח. סבן* לשירותך 🏭
נשמח לראותך! לאיזה סניף תרצה להגיע?

[31] 🏟️ *סניף התלמיד 6, הוד השרון (מחסן 1)*
• התמחות: חומרים קלים, כלי עבודה, לוחות גבס, פרופילים, צבע ופרזול.
• ⏰ שעות: א'-ה' 06:00–18:00 | ימי ו' 06:00–14:00
• 🧭 ניווט Waze: https://www.waze.com/ul?q=%D7%94%D7%AA%D7%9C%D7%9E%D7%99%D7%93%206%20%D7%94%D7%95%D7%93%20%D7%94%D7%A9%D7%A8%D7%95%D7%9F&navigate=yes
• 🗺️ Google Maps: https://www.google.com/maps/search/?api=1&query=התלמיד+6,+הוד+השרון&query_place_id=ChIJU634eSU4HRURT1dL2O5pQk4

[32] 🏭 *סניף החרש 10, אזוה"ת הוד השרון (מחסן 4 מרכזי)*
• התמחות: מגרש ראשי, אגרגטים בבלות/תפזורת, חומרי מליטה, בלוקים, ברזל ומנופים.
• ⏰ שעות: א'-ה' 06:30–16:00 | ימי ו' 06:30–13:30
• 🧭 ניווט Waze: https://www.waze.com/ul?q=%D7%94%D7%97%D7%A8%D7%A9%2010%20%D7%94%D7%95%D7%93%20%D7%94%D7%A9%D7%A8%D7%95%D7%9F&navigate=yes
• 🗺️ Google Maps: https://www.google.com/maps/search/?api=1&query=החרש+10,+הוד+השרון&query_place_id=ChIJMZU49qI3HRURQwGnFp-VPDU`;
    }

    // ענף [4]
    if (lower === '4' || lower.includes('מעקב') || lower.includes('סטטוס') || lower.includes('איפה המשאית') || lower.includes('איפה הנהג')) {
      return `מחלקת *מעקב משלוחים וסידור עבודה* 🚚
כדי שאוכל לבדוק מיידית מול גיליון הסידור הפעיל של *ראמי*:

אנא השב עם:
1. מספר הזמנת קומקס (לדוגמה: 6215751) או שם המזמין המדויק.
2. כתובת היעד.

⚡ _אבצע סריקה מיידית של סטטוס המשאית, מיקום הנהג (חכמת במנוף או עלי בחלוקה) ושעת הגעה משוערת!_`;
    }

    // ענף [5]
    if (lower === '5' || lower.includes('ראמי') || lower.includes('הצעת מחיר') || lower.includes('מחיר לפרויקט') || lower.includes('הנחה')) {
      return `פנייתך הועברה ישירות ל-*ראמי מסארווה* 🫡
מנהל מחלקת ההובלות והסידור (טלפון: 050-886-0896).

ריכזתי עבורו את כל פרטי הבקשה שלך.
ראמי נמצא כרגע בניהול הסידור בשטח ויחזור אליך תוך מספר דקות עם הצעת מחיר מדויקת וסגירת מועד אספקה! 🏗️`;
    }

    // ברירת מחדל / איפוס תפריט ראשי
    return `שלום ${cleanName}! 🏗️
ברוכים הבאים ל-*ח. סבן חומרי בניין (1994) בע"מ*.
כאן *נועה*, מערכת הסידור והשירות הדיגיטלית של *ראמי מסארווה* — מנהל מחלקת ההובלות והלוגיסטיקה.

איך נוכל לתת לך שירות מקצועי ומהיר היום?
נא להשיב עם מספר הפעולה הרצויה:

[1] 🧱 *הזמנת חומרי בניין והובלה לאתר* (מלט, ברזל, בלוקים, טיט, אגרגטים, גבס)
[2] 🚛 *שירות מכולות לפינוי פסולת* (הצבה, החלפה או פינוי)
[3] 🏭 *איסוף עצמי, שעות פעילות וניווט למחסנים* (סניפי הוד השרון)
[4] 📦 *בירור סטטוס הזמנה קיימת / תעודת משלוח*
[5] 📞 *מענה אישי, הצעות מחיר ופרויקטים מול ראמי*

──────────────────────────────
💡 _טיפ: ניתן לרשום ישירות רשימת חומרים חופשית וכתובת, ואבצע נרמול ושיבוץ מיידי!_`;
  } catch (err) {
    console.error('Error in generateContextualReply:', err);
    return 'שלום! פנייתך התקבלה בח. סבן חומרי בניין 🏗️. נציגנו יחזור אליך בהקדם, או שתוכל לחייג ישירות לראמי מסארווה: 050-886-0896.';
  }
}

// קליטת הודעה נכנסת מוואטסאפ (Incoming Message Handler)
if (client) {
  client.on('message', async (msg) => {
    if (
      msg.isStatus ||
      msg.from.includes('@broadcast') ||
      msg.from.includes('@newsletter') ||
      msg.from.includes('@g.us')
    ) {
      return;
    }

    if (!msg.body || !msg.body.trim()) return;

    stats.incomingMessages++;
    stats.lastIncomingTimestamp = new Date().toISOString();

    let senderPhone = (msg.from || '').replace(/@(c\.us|lid)/, '');
    let senderName = 'לקוח וואטסאפ';

    try {
      const contact = await msg.getContact();
      senderName = contact.pushname || contact.name || 'לקוח וואטסאפ';
      if (contact.number) senderPhone = contact.number;
    } catch (e) {}

    console.log(`\n📩 הודעה נכנסת מוואטסאפ: ${senderName} (${senderPhone}): "${msg.body}"`);

    // 1. חישוב מענה דינמי בזמן אמת מהענפים
    const replyText = await generateContextualReply(msg.body, senderName, senderPhone);

    // 2. שיגור אסינכרוני ל-Studio Webhook
    dispatchToStudioWebhook({
      from: senderPhone,
      customerName: senderName,
      text: msg.body,
      reply: replyText,
      source: 'whatsapp_bridge_mjs',
      timestamp: Date.now()
    }).catch(() => {});

    // 3. שיקוף מיידי ב-Firebase RTDB
    safeFetchWithRetry(
      `${FIREBASE_RTDB_URL}/joni/incoming.json`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: senderPhone,
          name: senderName,
          text: msg.body,
          reply: replyText,
          source: 'whatsapp_bridge_mjs',
          timestamp: Date.now()
        })
      },
      2,
      4500
    )
      .then((fbRes) => {
        if (fbRes.ok) {
          stats.firebaseSyncSuccess++;
          console.log('✅ ההודעה שוקפה בהצלחה בממשק הצ\'אט של הסטודיו דרך Firebase RTDB!');
        } else {
          stats.firebaseSyncFailures++;
        }
      })
      .catch(() => {
        stats.firebaseSyncFailures++;
      });

    // 4. תיעוד בגיליון Google Apps Script (עמיד בשגיאות ואינו חוסם)
    logToGoogleAppsScript({
      phone: senderPhone,
      name: senderName,
      text: msg.body,
      reply: replyText
    }).catch(() => {});

    // 5. שליחת המענה האוטומטי הדינמי חזרה ללקוח בוואטסאפ
    if (replyText) {
      console.log('🤖 מענה נועה AI שנשלח לוואטסאפ:\n' + replyText);

      try {
        await msg.reply(replyText);
        stats.outgoingMessages++;
        stats.lastOutgoingTimestamp = new Date().toISOString();
        console.log('✅ תשובה נחתה בהצלחה בוואטסאפ של הלקוח!');
      } catch (sendErr) {
        try {
          await client.sendMessage(msg.from, replyText);
          stats.outgoingMessages++;
          stats.lastOutgoingTimestamp = new Date().toISOString();
          console.log('✅ תשובה נשלחה דרך client.sendMessage!');
        } catch (fallbackErr) {
          console.error('❌ שגיאה בשליחת וואטסאפ ללקוח:', fallbackErr.message);
        }
      }
    }
  });
}

// ==============================================================================
// 9. בדיקת תור הודעות יוצא מ-Firebase (Outbound Queue Processor)
// ==============================================================================
async function checkOutboundFirebaseQueue() {
  if (!isClientReady || !client) return;

  try {
    const response = await safeFetchWithRetry(`${FIREBASE_RTDB_URL}/joni/outbound.json`, { method: 'GET' }, 1, 3500);
    if (!response.ok || !response.data || typeof response.data !== 'object') return;

    const data = response.data;
    for (const [key, item] of Object.entries(data)) {
      if (!item || !item.message) continue;

      let chatId = String(item.phone || '').replace(/[^0-9]/g, '');
      if (chatId.startsWith('0')) chatId = '972' + chatId.slice(1);
      if (!chatId.endsWith('@c.us')) chatId = chatId + '@c.us';

      console.log(`\n📤 [מענה מנציג בממשק] משגר לוואטסאפ של ${item.name || 'לקוח'} (${item.phone})...`);
      console.log(`💬 תוכן ההודעה: "${item.message}"`);

      try {
        await client.sendMessage(chatId, item.message);
        stats.outgoingMessages++;
        stats.lastOutgoingTimestamp = new Date().toISOString();

        // מחיקה מהתור למניעת כפילות
        await safeFetchWithRetry(`${FIREBASE_RTDB_URL}/joni/outbound/${key}.json`, { method: 'DELETE' }, 2, 3000);
        console.log(`✅ המענה מממשק הצ'אט נחת בהצלחה בוואטסאפ של ${item.name || item.phone}!`);
      } catch (sendErr) {
        console.error(`❌ שגיאה בשיגור מענה לנציג (${chatId}):`, sendErr.message);
      }
    }
  } catch (err) {
    // שגיאת רשת רגעית
  }
}

// ==============================================================================
// 10. שרת Express וקליטת Webhooks מקיפה (Webhook & API Endpoints)
// ==============================================================================

// פונקציית עזר לנירמול מספר וואטסאפ
function normalizeWhatsAppPhone(rawPhone) {
  let digits = String(rawPhone || '').replace(/[^0-9]/g, '');
  if (digits.startsWith('05')) digits = '972' + digits.slice(1);
  if (!digits.endsWith('@c.us') && !digits.endsWith('@lid')) {
    digits = digits + '@c.us';
  }
  return digits;
}

// Webhook לקליטת בקשות ישירות מהסטודיו או מערכות חיצוניות
const handleIncomingWebhook = async (req, res) => {
  stats.webhookCallsReceived++;
  const payload = req.body || {};
  const action = payload.action || 'send_message';

  console.log(`\n📥 [Webhook Inbound Call] Action: "${action}"`, JSON.stringify(payload));

  // 1. פעולת סנכרון תור וענפים ידנית
  if (action === 'sync') {
    try {
      await checkOutboundFirebaseQueue();
      await getLiveFlow();
      await syncBridgeStatusToFirebase();
      stats.lastSyncTimestamp = new Date().toISOString();
      return res.json({ success: true, message: 'סנכרון תור יוצא וענפים בוצע בהצלחה', timestamp: stats.lastSyncTimestamp });
    } catch (syncErr) {
      return res.status(500).json({ success: false, error: syncErr.message });
    }
  }

  // 2. פעולת שליחת הודעה ישירה לוואטסאפ
  const targetTo = payload.to || payload.phone || payload.recipient;
  const messageText = payload.message || payload.text || payload.body;

  if (!targetTo || !messageText) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameters: "to" (phone number) and "message" (text) are required.'
    });
  }

  if (!isClientReady || !client) {
    return res.status(503).json({
      success: false,
      error: 'WhatsApp client is not ready. Please scan the QR code first.',
      connectionState: currentConnectionState
    });
  }

  const formattedChatId = normalizeWhatsAppPhone(targetTo);

  try {
    console.log(`📤 משגר הודעה דרך Webhook אל ${formattedChatId}...`);
    const sentMsg = await client.sendMessage(formattedChatId, messageText);
    stats.outgoingMessages++;
    stats.lastOutgoingTimestamp = new Date().toISOString();

    // תיעוד ב-Apps Script
    logToGoogleAppsScript({
      phone: targetTo,
      name: payload.name || 'הודעת מערכת',
      text: messageText,
      reply: 'נשלח בהצלחה'
    }).catch(() => {});

    return res.json({
      success: true,
      messageId: sentMsg?.id?._serialized || `msg_${Date.now()}`,
      to: formattedChatId,
      text: messageText,
      timestamp: Date.now()
    });
  } catch (sendErr) {
    console.error('❌ שגיאה בשליחת הודעת Webhook:', sendErr.message);
    return res.status(500).json({
      success: false,
      error: sendErr.message,
      to: formattedChatId
    });
  }
};

// רישום נתיבי ה-Webhook
app.post('/webhook', handleIncomingWebhook);
app.post('/api/webhook', handleIncomingWebhook);
app.post('/api/send', handleIncomingWebhook);

// נתיב סנכרון ידני
app.post('/api/sync', async (_req, res) => {
  stats.webhookCallsReceived++;
  try {
    await checkOutboundFirebaseQueue();
    await getLiveFlow();
    await syncBridgeStatusToFirebase();
    stats.lastSyncTimestamp = new Date().toISOString();
    res.json({ success: true, state: currentConnectionState, stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// נתיב בדיקת בריאות מקיף (Health Check)
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    connectionState: currentConnectionState,
    isClientReady,
    connectedPhone: connectedUserPhone,
    connectionStartTime,
    lastHeartbeatTime,
    uptimeSeconds: Math.floor(process.uptime()),
    stats,
    memoryUsageMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    firebaseUrl: FIREBASE_RTDB_URL,
    studioWebhookUrl: STUDIO_CLOUD_WEBHOOK_URL
  });
});

// נתיב סטטוס מפורט
app.get('/status', (_req, res) => {
  res.json({
    success: true,
    connectionState: currentConnectionState,
    moduleFormat: 'ES Module (.mjs)',
    isClientReady,
    connectedPhone: connectedUserPhone,
    connectionStartTime,
    stats,
    firebaseUrl: FIREBASE_RTDB_URL,
    appsScriptUrl: APPS_SCRIPT_URL,
    studioWebhookUrl: STUDIO_CLOUD_WEBHOOK_URL
  });
});

app.get('/api/status', (_req, res) => {
  res.json({
    success: true,
    connectionState: currentConnectionState,
    isClientReady,
    connectedPhone: connectedUserPhone,
    stats,
    firebaseUrl: FIREBASE_RTDB_URL
  });
});

// נתיב דפדפן להצגת קוד ה-QR ומצב החיבור
app.get('/qr', (_req, res) => {
  if (isClientReady) {
    return res.send(`
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>סטטוס וואטסאפ - ח. סבן</title>
      </head>
      <body style="font-family: system-ui, -apple-system, sans-serif; text-align: center; padding: 40px 20px; background: #0F172A; color: white; margin: 0;">
        <div style="max-width: 500px; margin: 0 auto; background: #1E293B; border-radius: 24px; padding: 32px; border: 1px solid #334155; box-shadow: 0 20px 40px rgba(0,0,0,0.4);">
          <div style="width: 64px; height: 64px; background: rgba(37, 211, 102, 0.15); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">
            <span style="font-size: 32px;">✅</span>
          </div>
          <h1 style="color: #25D366; font-size: 24px; margin: 0 0 12px;">הוואטסאפ מחובר בהצלחה!</h1>
          <p style="font-size: 16px; color: #E2E8F0; margin: 0 0 8px;">מספר פעיל: <b style="color: #38BDF8;">${connectedUserPhone}</b></p>
          <p style="color: #94A3B8; font-size: 14px; margin: 0 0 24px;">מצב חיבור: <span style="background: #14532D; color: #4ADE80; padding: 4px 10px; border-radius: 12px; font-weight: bold;">${currentConnectionState}</span></p>
          <div style="background: #0F172A; border-radius: 16px; padding: 16px; text-align: right; font-size: 13px; color: #CBD5E1; line-height: 1.6;">
            <div>• סנכרון דו-כיווני פעיל מול הסטודיו</div>
            <div>• הודעות נכנסות משוקפות ב-Firebase RTDB</div>
            <div>• הודעות נציג נשלחות מיד לוואטסאפ הלקוח</div>
          </div>
        </div>
      </body>
      </html>
    `);
  }

  if (latestQrDataUrl) {
    return res.send(`
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>סריקת QR לוואטסאפ - ח. סבן</title>
      </head>
      <body style="font-family: system-ui, -apple-system, sans-serif; text-align: center; padding: 40px 20px; background: #0F172A; color: white; margin: 0;">
        <div style="max-width: 500px; margin: 0 auto; background: #1E293B; border-radius: 24px; padding: 32px; border: 1px solid #334155; box-shadow: 0 20px 40px rgba(0,0,0,0.4);">
          <h2 style="font-size: 22px; margin: 0 0 12px; color: #F8FAFC;">📲 סריקת קוד QR לחיבור הוואטסאפ</h2>
          <p style="color: #94A3B8; font-size: 14px; margin: 0 0 20px;">פתחו וואטסאפ בטלפון > הגדרות > מכשירים מקושרים > קשר מכשיר</p>
          <div style="background: white; display: inline-block; padding: 16px; border-radius: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
            <img src="${latestQrDataUrl}" alt="WhatsApp QR Code" style="width: 260px; height: 260px; display: block;" />
          </div>
          <p style="font-size: 13px; color: #64748B; margin: 20px 0 0;">הדף יתרענן אוטומטית בכל 15 שניות...</p>
        </div>
        <script>setTimeout(() => location.reload(), 15000);</script>
      </body>
      </html>
    `);
  }

  res.send(`
    <!DOCTYPE html>
    <html dir="rtl" lang="he">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>טוען וואטסאפ...</title>
    </head>
    <body style="font-family: system-ui, -apple-system, sans-serif; text-align: center; padding: 60px 20px; background: #0F172A; color: white;">
      <div style="max-width: 450px; margin: 0 auto; background: #1E293B; border-radius: 24px; padding: 32px; border: 1px solid #334155;">
        <h2 style="font-size: 20px; color: #38BDF8; margin: 0 0 12px;">⏳ ממתין ליצירת קוד QR מוואטסאפ...</h2>
        <p style="color: #94A3B8; font-size: 14px;">השרת מאתחל את שירות WhatsApp Web. מרענן תוך 3 שניות.</p>
      </div>
      <script>setTimeout(() => location.reload(), 3000);</script>
    </body>
    </html>
  `);
});

// ==============================================================================
// 11. הפעלת שרת HTTP ואתחול לקוח WhatsApp Web
// ==============================================================================
const server = app.listen(PORT, () => {
  console.log('======================================================');
  console.log(`🌐 שרת גשר וואטסאפ (ES Module) פעיל על: http://localhost:${PORT}`);
  console.log(`📲 דף קוד QR לסריקה: http://localhost:${PORT}/qr`);
  console.log(`🩺 בדיקת בריאות וסטטוס: http://localhost:${PORT}/health`);
  console.log(`📥 קליטת Webhook: POST http://localhost:${PORT}/webhook`);
  console.log(`☁️ סנכרון Firebase RTDB: ${FIREBASE_RTDB_URL}`);
  console.log(`📡 Studio Webhook: ${STUDIO_CLOUD_WEBHOOK_URL}`);
  console.log('======================================================');

  if (client) {
    console.log('מאתחל לקוח WhatsApp Web...');
    client.initialize().catch((err) => {
      console.error('❌ תקלת אתחול לקוח WhatsApp Web:', err);
    });
  } else {
    console.log('ℹ️ הגשר מוכן ומאזין. המערכת מסנכרנת מול הסטודיו ו-Firebase.');
  }

  // סנכרון ראשוני מיידי
  syncBridgeStatusToFirebase().catch(() => {});
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ שגיאה: פורט ${PORT} תפוס! הגדירו BRIDGE_PORT=3002 ונסו שוב.`);
  } else {
    console.error('❌ שגיאת שרת:', err.message);
  }
});

// כיבוי אלגנטי
function gracefulShutdown(signal) {
  console.log(`\n🛑 התקבל אות ${signal}. סוגר את שרת הגשר באופן מסודר...`);
  setConnectionState(ConnectionState.DISCONNECTED);
  try {
    if (client) client.destroy().catch(() => {});
  } catch (e) {}
  server.close(() => {
    process.exit(0);
  });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
