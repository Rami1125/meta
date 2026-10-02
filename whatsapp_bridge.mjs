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
// 8. מנוע מענה חכם ודינמי לפי ענפי השיחה (Dynamic Flow Engine)
// ==============================================================================
async function generateContextualReply(text, senderName, senderPhone) {
  try {
    const clean = (text || '').trim();
    const lower = clean.toLowerCase();
    const flow = await getLiveFlow();

    // 1. זיהוי הזמנה קונקרטית עם חומרים / כמויות / כתובת
    const hasMaterials = lower.includes('טיט') || lower.includes('מלט') || lower.includes('בלוק') || lower.includes('חול') || lower.includes('סומסום') || lower.includes('ברזל') || lower.includes('שקים') || lower.includes('בלה');
    const hasAddress = lower.includes('רחוב') || lower.includes('רעננה') || lower.includes('כפר סבא') || lower.includes('הוד השרון') || lower.includes('פתח תקווה') || lower.includes('הרצליה') || lower.includes('כפר ברא') || lower.includes('ג\'לג\'וליה') || lower.includes('טייבה') || lower.includes('טירה') || /\d+/.test(clean);

    if (hasMaterials) {
      userSessions.delete(senderPhone);
      if (hasAddress) {
        return `רשמנו את פרטי ההזמנה שלך: "${clean}" 🚚!\nההזמנה הועברה לראמי מסארווה (050-886-0896) לתיאום משאית מנוף ואספקה מהירה לאתר. תודה שפנית לח. סבן!`;
      }
      return `מעולה! קיבלנו את פירוט החומרים: "${clean}" 🏗️.\nלאיזו כתובת מדויקת תרצה את המשלוח? ראמי מסארווה (050-886-0896) יתאם אספקה מהירה.`;
    }

    // 2. ניווט דינמי בעץ הענפים מ-Firebase RTDB
    if (flow && Array.isArray(flow.nodes) && flow.nodes.length > 0) {
      const rootNode = flow.nodes.find((n) => n.id === 'node_welcome' || n.isRoot) || flow.nodes[0];
      const session = userSessions.get(senderPhone);

      // בדיקה אם הלקוח כבר נמצא בענף קודם (מכולה, איסוף, שאלה)
      if (session && session.currentNodeId) {
        const currentNode = flow.nodes.find((n) => n.id === session.currentNodeId);
        if (currentNode) {
          const numMatch = clean.match(/^([1-9])$/);
          let chosenIndex = -1;

          if (numMatch) {
            chosenIndex = parseInt(numMatch[1], 10) - 1;
          } else if (Array.isArray(currentNode.options)) {
            chosenIndex = currentNode.options.findIndex((opt) => lower.includes(opt.toLowerCase()) || opt.toLowerCase().includes(lower));
          }

          if (chosenIndex >= 0 && Array.isArray(flow.connections)) {
            const conn = flow.connections.find((c) => c.fromNodeId === currentNode.id && c.fromOptionIndex === chosenIndex);
            if (conn) {
              const nextNode = flow.nodes.find((n) => n.id === conn.toNodeId);
              if (nextNode) {
                userSessions.set(senderPhone, { currentNodeId: nextNode.id, lastTime: Date.now() });
                let reply = nextNode.text || '';
                if (Array.isArray(nextNode.options) && nextNode.options.length > 0) {
                  reply += '\n\n' + nextNode.options.map((opt, i) => `${i + 1} - ${opt}`).join('\n');
                }
                return reply;
              }
            }
          }
        }
      }

      // בחירה מתפריט השורש הראשי
      const numMatch = clean.match(/^([1-9])$/);
      let chosenOptionIndex = -1;
      if (numMatch) {
        chosenOptionIndex = parseInt(numMatch[1], 10) - 1;
      } else if (Array.isArray(rootNode.options)) {
        if (lower.includes('הובלה') || lower.includes('הזמנה')) chosenOptionIndex = 0;
        else if (lower.includes('איסוף') || lower.includes('מחסן')) chosenOptionIndex = 1;
        else if (lower.includes('מכולה') || lower.includes('פסולת') || lower.includes('רמסע')) chosenOptionIndex = 2;
        else if (lower.includes('מעקב') || lower.includes('נהג')) chosenOptionIndex = 3;
        else {
          chosenOptionIndex = rootNode.options.findIndex((opt) => lower.includes(opt.toLowerCase()) || opt.toLowerCase().includes(lower));
        }
      }

      if (chosenOptionIndex >= 0 && Array.isArray(rootNode.options) && rootNode.options[chosenOptionIndex]) {
        const conn = Array.isArray(flow.connections)
          ? flow.connections.find((c) => c.fromNodeId === rootNode.id && c.fromOptionIndex === chosenOptionIndex)
          : null;

        let targetNode = conn ? flow.nodes.find((n) => n.id === conn.toNodeId) : null;

        if (!targetNode) {
          if (chosenOptionIndex === 0) targetNode = flow.nodes.find((n) => n.id === 'node_delivery');
          else if (chosenOptionIndex === 1) targetNode = flow.nodes.find((n) => n.id === 'node_pickup');
          else if (chosenOptionIndex === 2) targetNode = flow.nodes.find((n) => n.id === 'container_action_menu' || n.id === 'container_size_menu');
          else if (chosenOptionIndex === 3) targetNode = flow.nodes.find((n) => n.id === 'tracking_reply');
        }

        if (targetNode) {
          userSessions.set(senderPhone, { currentNodeId: targetNode.id, lastTime: Date.now() });
          let reply = targetNode.text || '';
          if (Array.isArray(targetNode.options) && targetNode.options.length > 0) {
            reply += '\n\n' + targetNode.options.map((opt, i) => `${i + 1} - ${opt}`).join('\n');
          }
          return reply;
        }
      }

      // תפריט שורש מלא ודינמי לפי הגדרות המערכת
      userSessions.set(senderPhone, { currentNodeId: rootNode.id, lastTime: Date.now() });
      let rootMenuText = `שלום ${senderName || ''} וברוכים הבאים ל${flow.name || 'ח. סבן חומרי בניין'} 🏗️\n${rootNode.text}\n\n`;
      if (Array.isArray(rootNode.options) && rootNode.options.length > 0) {
        rootMenuText += rootNode.options.map((opt, i) => `${i + 1} - ${opt}`).join('\n');
      }
      rootMenuText += '\n\nאו פשוט כתוב לנו מה החומרים והכמויות הדרושים!';
      return rootMenuText;
    }

    return `שלום ${senderName || ''} וברוכים הבאים לח. סבן חומרי בניין בע״מ (כפר ברא) 🏗️\nאנא הקלד מספר לבחירה:\n1 - 🚚 הזמנה והובלה לאתר\n2 - 🏪 איסוף עצמי ושעות פעילות\n3 - 🗑️ מכולה לפינוי פסולת\n4 - 🔍 מעקב משלוח ונהגים\nאו פשוט כתוב לנו מה החומרים והכמויות הדרושים!`;
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
