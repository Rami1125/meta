/**
 * ==============================================================================
 * ח. סבן חומרי בניין בע״מ (כפר ברא) | שרת גשר וואטסאפ דו-כיווני (WhatsApp Bridge)
 * ==============================================================================
 * קובץ: whatsapp_bridge.js / whatsapp_bridge.cjs
 * 
 * תפקיד:
 * 1. סנכרון חי בזמן אמת מול ענפי השיחה ב-Firebase RTDB ובשרת סבן!
 * 2. מאזין לכל הודעת וואטסאפ נכנסת ומשקף אותה מיד בצ'אט הסטודיו דרך Firebase RTDB.
 * 3. מזהה בחירות תפריט, כמויות, חומרי בניין וכתובות באופן דינמי לפי מה שהוגדר בענפים!
 * 4. מאזין לתור ההודעות היוצא: כל מענה שנכתב בממשק הצ'אט נמשך מ-Firebase ונוחת מיד בוואטסאפ של הלקוח!
 * 
 * הפעלה בתיקייה C:\noa:
 * node whatsapp_bridge.js
 * או:
 * node whatsapp_bridge.cjs
 * ==============================================================================
 */

const express = require('express');
const cors = require('cors');
const qrcodeTerminal = require('qrcode-terminal');
const QRCode = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');

process.on('uncaughtException', (err) => {
  console.error('\n❌ Uncaught Exception:', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('\n❌ Unhandled Rejection:', reason);
});

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.BRIDGE_PORT || 3001;

// כתובות שירות הענן של סבן (פתוחות וישירות מכל מקום בעולם ללא צורך ב-localhost)
const FIREBASE_RTDB_URL = 'https://saban-ai-drive-default-rtdb.europe-west1.firebasedatabase.app';
const STUDIO_WEBHOOK_URL = 'https://ais-dev-neh5cjw2tq37sjrtzdnrcq-812919982163.europe-west2.run.app/api/webhooks/joni';
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwAkBK1Z051WmTvyDsRNrUf3xAS0MOCio9QRdoGyYxQdN66AekWhG_YFAgmKNEl7mR_/exec';

let latestQrCode = null;
let latestQrDataUrl = null;
let isClientReady = false;
let connectedUserPhone = null;

// מעקב סשן של לקוחות עבור עץ הענפים
const userSessions = new Map();

// מטמון ענפים חי מ-Firebase RTDB (מתרענן אוטומטית)
let cachedVisualFlow = null;
let lastFlowFetchTime = 0;

async function getLiveFlow() {
  const now = Date.now();
  if (cachedVisualFlow && now - lastFlowFetchTime < 3000) {
    return cachedVisualFlow;
  }

  try {
    const res = await fetch(`${FIREBASE_RTDB_URL}/chat_flows/main.json`, {
      signal: AbortSignal.timeout(4000)
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.nodes) {
        let nodes = data.nodes;
        if (typeof nodes === 'object' && !Array.isArray(nodes)) {
          nodes = Object.values(nodes);
        }
        let connections = data.connections;
        if (typeof connections === 'object' && !Array.isArray(connections)) {
          connections = Object.values(connections);
        }
        if (Array.isArray(nodes) && nodes.length > 0) {
          cachedVisualFlow = {
            ...data,
            nodes,
            connections: connections || []
          };
          lastFlowFetchTime = now;
          return cachedVisualFlow;
        }
      }
    }
  } catch (e) {
    // network warning
  }
  return cachedVisualFlow;
}

const client = new Client({
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
  try {
    latestQrDataUrl = await QRCode.toDataURL(qr);
  } catch (e) {}

  console.log('\n======================================================');
  console.log('📲 סרקו את קוד ה-QR בוואטסאפ (הגדרות > מכשירים מקושרים):');
  console.log(`🌐 או פתחו בדפדפן לצפייה ב-QR: http://localhost:${PORT}/qr`);
  console.log('======================================================\n');
  qrcodeTerminal.generate(qr, { small: true });
});

// התחברות מוצלחת
client.on('ready', () => {
  isClientReady = true;
  latestQrCode = null;
  latestQrDataUrl = null;
  connectedUserPhone = client.info?.wid?.user || 'מחובר';

  console.log('\n======================================================');
  console.log('🚀 נועה AI מחוברת ישירות לוואטסאפ ולמערכת ח. סבן!');
  console.log(`📱 מספר מקושר: ${connectedUserPhone}`);
  console.log(`☁️ חיבור ענן סטודיו: ${FIREBASE_RTDB_URL}`);
  console.log(`📊 חיבור גיליון נועה: ${APPS_SCRIPT_URL}`);
  console.log('⚡ סנכרון דו-כיווני פעיל: WhatsApp ⇄ Studio Chat ⇄ Google Sheets');
  console.log('======================================================\n');

  // טעינת ענפים ראשונית
  getLiveFlow().catch(() => {});

  // בדיקת תור הודעות יוצא מ-Firebase (כל מענה שנכתב בממשק הצ'אט) כל 2 שניות
  setInterval(checkOutboundFirebaseQueue, 2000);
});

client.on('disconnected', (reason) => {
  isClientReady = false;
  console.log('⚠️ הוואטסאפ התנתק:', reason);
});

// פונקציית מענה דינמית בזמן אמת לפי עץ הענפים ב-Firebase ומנוע נועה AI
async function generateContextualReply(text, senderName, senderPhone) {
  const clean = (text || '').trim();
  const lower = clean.toLowerCase();
  const phoneDigits = String(senderPhone || '').replace(/[^0-9]/g, '');
  const cleanName = (senderName || 'לקוח').replace(/[\{\}]/g, '').trim() || 'לקוח';

  // 0. נסיון פנייה ישיר למנוע נועה AI בשרת הסטודיו (כולל Session Cart מלא וחיבור ל-Gemini)
  try {
    const studioUrl = process.env.STUDIO_API_URL || 'https://ais-dev-neh5cjw2tq37sjrtzdnrcq-812919982163.europe-west2.run.app';
    const bridgeQueryRes = await fetch(`${studioUrl}/api/bridge/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: clean,
        senderName: cleanName,
        senderPhone: senderPhone
      }),
      signal: AbortSignal.timeout(4000)
    });
    if (bridgeQueryRes.ok) {
      const queryData = await bridgeQueryRes.json();
      if (queryData && queryData.success && queryData.reply) {
        console.log('🤖 מענה מנוע נועה AI מהסטודיו:', queryData.reply.substring(0, 80) + '...');
        return queryData.reply;
      }
    }
  } catch (apiErr) {
    // במקרה של ניתוק רשת זמני, ממשיכים לעיבוד מקומי עמיד
  }

  // 🚨 1. נוהל מפקד עליון — ראמי מסארווה (050-886-0896)
  const isRami = phoneDigits.includes('508860896') || lower.includes('המפקד') || lower === 'ראמי';
  if (isRami) {
    return `שלום המפקד! 🫡 
סליחה, נועה כאן לרשותך! זיהיתי אותך מיד. כל המערכות, הסידור וצי המשאיות דרוכים.

מה המשימה כרגע?
[1] 🚛 *תמונת מצב סבבים ונהגים* (איפה חכמת ועלי עומדים)
[2] ➕ *קליטה ושיבוץ מהיר של הזמנה חדשה לסידור*
[3] 📊 *הפקת דוח בוקר / סיכום סוף יום (EOD) לוואטסאפ*
[4] 📑 *הצלבת תעודות משלוח חתומות מול קומקס*
[5] 📢 *שידור הודעה תפעולית לנהגים*`;
  }

  // 2. זיהוי הזמנה קונקרטית עם חומרים / כמויות / סל מצטבר
  const hasMaterials = lower.includes('טיט') || lower.includes('מלט') || lower.includes('בלוק') || lower.includes('חול') || lower.includes('סומסום') || lower.includes('ברזל') || lower.includes('שקים') || lower.includes('בלה');
  
  let cartSession = userSessions.get(`cart_${phoneDigits}`);
  if (!cartSession) {
    cartSession = { cart: [], address: '', lastUpdated: Date.now() };
    userSessions.set(`cart_${phoneDigits}`, cartSession);
  }

  if (hasMaterials) {
    const isAddition = lower.includes('להוסיף') || lower.includes('רוצה להוסיף') || lower.includes('עוד') || lower.includes('תוסיף') || cartSession.cart.length > 0;
    
    // קליטת פריטים
    if (lower.includes('חול')) {
      const match = lower.match(/(\d+)\s*(?:בלה|בלות)?\s*חול/) || lower.match(/חול.*?(\d+)/);
      const qty = match ? parseInt(match[1], 10) : 3;
      if (!cartSession.cart.some(i => i.sku === '11501')) {
        cartSession.cart.push({ sku: '11501', name: 'חול שק גדול (בלה)', qty, note: '' });
      }
    }
    if (lower.includes('מלט')) {
      const match = lower.match(/(\d+)\s*(?:שק|שקים)?\s*מלט/) || lower.match(/מלט.*?(\d+)/);
      const qty = match ? parseInt(match[1], 10) : 60;
      if (!cartSession.cart.some(i => i.sku === '10002')) {
        cartSession.cart.push({ sku: '10002', name: 'מלט אפור 25 ק"ג נשר', qty, note: '(2 משטחים)' });
      }
    }
    if (lower.includes('סומסום')) {
      const match = lower.match(/(\d+)\s*(?:בלה|בלות)?\s*סומסום/) || lower.match(/סומסום.*?(\d+)/);
      const qty = match ? parseInt(match[1], 10) : 5;
      if (!cartSession.cart.some(i => i.sku === '11511')) {
        cartSession.cart.push({ sku: '11511', name: 'סומסום שק גדול (בלה)', qty, note: '' });
      }
    }

    const cartLines = cartSession.cart.map((item, idx) => {
      const noteStr = item.note ? ` ${item.note}` : '';
      return `${idx + 1}. מק"ט: ${item.sku} | ${item.name} | כמות: ${item.qty}${noteStr}`;
    }).join('\n');

    if (isAddition && cartSession.cart.length > 1) {
      return `מעולה, עדכנתי והוספתי להזמנה! ➕\n\n📋 *סיכום סל הזמנה מעודכן:*\n${cartLines}\n\n🛡️ *פקדונות מחייבים:*\n• 8 בלות פקדון (מק"ט 60002)\n• 2 משטחי סבן פקדון (מק"ט 60060)\n\n⚖️ משקל כולל משוער: כ-11.5 טון ➔ *שיבוץ נדרש: משאית מרצדס מנוף (חכמת).*\n\n📍 לאיזו כתובת לשגר את חכמת, ולאיזו שעה לתאם את האספקה?`;
    } else {
      return `קלטתי את פריטי ההזמנה שלך! 🏗️\n\n📦 *פירוט החומרים שנקלטו:*\n${cartLines}\n🛡️ *פקדונות נלווים:* 3 בלות (מק"ט 60002) + 2 משטחי סבן (מק"ט 60060).\n\n📍 *כדי שראמי יוכל לשבץ לך משאית:*\n1. מהי כתובת האספקה המדויקת?\n2. האם יש פריטים נוספים שתרצה להוסיף?`;
    }
  }

  // אם כבר יש סל והלקוח שולח כתובת
  if (cartSession.cart.length > 0 && (lower.includes('רחוב') || lower.includes('בוקר') || lower.includes('מחר') || lower.includes('אחוזה') || lower.includes('הבנים') || lower.includes('סבא') || lower.includes('רעננה'))) {
    cartSession.address = clean;
    const cartLines = cartSession.cart.map((item, idx) => {
      const noteStr = item.note ? ` ${item.note}` : '';
      return `${idx + 1}. מק"ט: ${item.sku} | ${item.name} | כמות: ${item.qty}${noteStr}`;
    }).join('\n');
    return `מעולה! פרטי האספקה נקלטו בהצלחה 🚚📍\n\n📍 *יעד אספקה:* ${clean}\n🚛 *שיבוץ נדרש:* משאית מרצדס מנוף (חכמת)\n⚖️ *משקל כולל משוער:* כ-11.5 טון\n\n📋 *סיכום סל ההזמנה:*\n${cartLines}\n\nהאם לאשר ולשגר את ההזמנה לסידור העבודה של ראמי? (נא להשיב *"מאשר"* או *"1"* לתזמון סופי).`;
  }

  // אישור סופי
  if (cartSession.cart.length > 0 && cartSession.address && (lower === 'מאשר' || lower === 'אישור' || lower === 'כן' || lower === '1')) {
    const orderId = 'ORD-' + Math.floor(1000 + Math.random() * 9000);
    const finalAddr = cartSession.address;
    userSessions.delete(`cart_${phoneDigits}`);
    return `ההזמנה אושרה ושובצה בהצלחה בסידור העבודה! ✅\n📦 מספר הזמנה: *${orderId}*\n📍 יעד אספקה: *${finalAddr}*\n🚛 נהג משובץ: *חכמת (משאית מנוף)*\n\nראמי מסארווה (050-886-0896) מפקח על האספקה. תודה שבחרת ב-ח. סבן חומרי בניין! 🏗️`;
  }

  const flow = await getLiveFlow();

  // 2. אם יש עץ ענפים דינמי ב-Firebase:
  if (flow && Array.isArray(flow.nodes) && flow.nodes.length > 0) {
    const rootNode = flow.nodes.find(n => n.id === 'node_welcome' || n.isRoot) || flow.nodes[0];
    const session = userSessions.get(senderPhone);

    // בדיקה אם הלקוח כבר נמצא בענף קודם (למשל מכולה, איסוף וכו')
    if (session && session.currentNodeId) {
      const currentNode = flow.nodes.find(n => n.id === session.currentNodeId);
      if (currentNode) {
        // בדיקת בחירה במספר מתוך אפשרויות הענף הנוכחי
        const numMatch = clean.match(/^([1-9])$/);
        let chosenIndex = -1;
        if (numMatch) {
          chosenIndex = parseInt(numMatch[1], 10) - 1;
        } else if (Array.isArray(currentNode.options)) {
          chosenIndex = currentNode.options.findIndex(opt => lower.includes(opt.toLowerCase()) || opt.toLowerCase().includes(lower));
        }

        if (chosenIndex >= 0 && Array.isArray(flow.connections)) {
          // מציאת חיבור הענף ליעד הבא
          const conn = flow.connections.find(c => c.fromNodeId === currentNode.id && c.fromOptionIndex === chosenIndex);
          if (conn) {
            const nextNode = flow.nodes.find(n => n.id === conn.toNodeId);
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

    // בחירה מתפריט השורש הראשי (1, 2, 3, 4 או טקסט)
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
        chosenOptionIndex = rootNode.options.findIndex(opt => lower.includes(opt.toLowerCase()) || opt.toLowerCase().includes(lower));
      }
    }

    if (chosenOptionIndex >= 0 && Array.isArray(rootNode.options) && rootNode.options[chosenOptionIndex]) {
      // מציאת חיבור הענף מתפריט השורש
      const conn = Array.isArray(flow.connections) 
        ? flow.connections.find(c => c.fromNodeId === rootNode.id && c.fromOptionIndex === chosenOptionIndex)
        : null;

      let targetNode = conn ? flow.nodes.find(n => n.id === conn.toNodeId) : null;

      // גיבוי זיהוי מזהים לפי אינדקס אם אין חיבור ישיר
      if (!targetNode) {
        if (chosenOptionIndex === 0) targetNode = flow.nodes.find(n => n.id === 'node_delivery');
        else if (chosenOptionIndex === 1) targetNode = flow.nodes.find(n => n.id === 'node_pickup');
        else if (chosenOptionIndex === 2) targetNode = flow.nodes.find(n => n.id === 'container_action_menu' || n.id === 'container_size_menu');
        else if (chosenOptionIndex === 3) targetNode = flow.nodes.find(n => n.id === 'tracking_reply');
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

    // תפריט שורש דינמי מלא לפי מה שהמשתמש הגדיר בענף הראשי!
    userSessions.set(senderPhone, { currentNodeId: rootNode.id, lastTime: Date.now() });
    let rootMenuText = `שלום ${senderName || ''} וברוכים הבאים ל${flow.name || 'ח. סבן חומרי בניין'} 🏗️\n${rootNode.text}\n\n`;
    if (Array.isArray(rootNode.options) && rootNode.options.length > 0) {
      rootMenuText += rootNode.options.map((opt, i) => `${i + 1} - ${opt}`).join('\n');
    }
    rootMenuText += '\n\nאו פשוט כתוב לנו מה החומרים והכמויות הדרושים!';
    return rootMenuText;
  }

  // 3. ברירת מחדל אם Firebase לא נגיש
  return `שלום ${senderName || ''} וברוכים הבאים לח. סבן חומרי בניין בע״מ (כפר ברא) 🏗️\nאנא הקלד מספר לבחירה:\n1 - 🚚 הזמנה והובלה לאתר\n2 - 🏪 איסוף עצמי ושעות פעילות\n3 - 🗑️ מכולה לפינוי פסולת\n4 - 🔍 מעקב משלוח ונהגים\nאו פשוט כתוב לנו מה החומרים והכמויות הדרושים!`;
}

// קליטת הודעה נכנסת מוואטסאפ
client.on('message', async (msg) => {
  if (
    msg.isStatus || 
    msg.from.includes('@broadcast') || 
    msg.from.includes('@newsletter') || 
    msg.from.includes('@g.us')
  ) return;

  if (!msg.body || !msg.body.trim()) return;

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

  // 2. שליחה ל-Webhook של הסטודיו (כדי שיסונכרן למשימות, CRM ולוגים בענן)
  fetch(STUDIO_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: senderPhone,
      customerName: senderName,
      text: msg.body,
      timestamp: Date.now()
    }),
    signal: AbortSignal.timeout(6000)
  }).catch(() => {});

  // 3. שיקוף מיידי ב-Firebase RTDB (כך שההודעה קופצת מיד בצ'אט הסטודיו!)
  try {
    const fbRes = await fetch(`${FIREBASE_RTDB_URL}/joni/incoming.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: senderPhone,
        name: senderName,
        text: msg.body,
        reply: replyText,
        source: 'whatsapp_web',
        timestamp: Date.now()
      }),
      signal: AbortSignal.timeout(6000)
    });
    if (fbRes.ok) {
      console.log('✅ ההודעה שוקפה בהצלחה בממשק הצ\'אט של הסטודיו דרך Firebase RTDB!');
    }
  } catch (fbErr) {
    console.warn('⚠️ שגיאה בעדכון Firebase:', fbErr.message);
  }

  // 4. תיעוד ב-Google Apps Script (גיליון נועה)
  fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'logWhatsApp',
      phone: senderPhone,
      name: senderName,
      text: msg.body,
      reply: replyText,
      timestamp: new Date().toISOString()
    }),
    redirect: 'follow',
    signal: AbortSignal.timeout(8000)
  }).catch(() => {});

  // 5. שליחת המענה האוטומטי הדינמי חזרה ללקוח בוואטסאפ
  if (replyText) {
    console.log('🤖 מענה נועה AI שנשלח לוואטסאפ:\n' + replyText);

    try {
      await msg.reply(replyText);
      console.log('✅ תשובה נחתה בהצלחה בוואטסאפ של הלקוח!');
    } catch (sendErr) {
      try {
        await client.sendMessage(msg.from, replyText);
        console.log('✅ תשובה נשלחה דרך client.sendMessage!');
      } catch (fallbackErr) {
        console.error('❌ שגיאה בשליחת וואטסאפ:', fallbackErr.message);
      }
    }
  }
});

// בדיקת תור הודעות יוצא מ-Firebase (כל מענה שנכתב על ידי נציג בממשק הצ'אט)
async function checkOutboundFirebaseQueue() {
  if (!isClientReady) return;

  try {
    const response = await fetch(`${FIREBASE_RTDB_URL}/joni/outbound.json`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    });
    const data = await response.json();

    if (data && typeof data === 'object') {
      for (const [key, item] of Object.entries(data)) {
        if (!item || !item.message) continue;

        let chatId = String(item.phone || '').replace(/[^0-9]/g, '');
        if (chatId.startsWith('0')) chatId = '972' + chatId.slice(1);
        if (!chatId.endsWith('@c.us')) chatId = chatId + '@c.us';

        console.log(`\n📤 [מענה מנציג בממשק] משגר לוואטסאפ של ${item.name || 'לקוח'} (${item.phone})...`);
        console.log(`💬 תוכן ההודעה: "${item.message}"`);

        // שיגור הודעה פיזית לוואטסאפ של הלקוח
        await client.sendMessage(chatId, item.message);

        // מחיקה מהתור כדי שלא יישלח שוב
        await fetch(`${FIREBASE_RTDB_URL}/joni/outbound/${key}.json`, {
          method: 'DELETE',
          signal: AbortSignal.timeout(5000)
        }).catch(() => {});

        console.log(`✅ המענה מממשק הצ'אט נחת בהצלחה בוואטסאפ של ${item.name || item.phone}!`);
      }
    }
  } catch (err) {
    // שגיאת רשת רגעית
  }
}

// נתיב דפדפן להצגת קוד ה-QR
app.get('/qr', (_req, res) => {
  if (isClientReady) {
    return res.send(`
      <!DOCTYPE html>
      <html dir="rtl">
      <head><meta charset="utf-8"><title>סטטוס וואטסאפ - ח. סבן</title></head>
      <body style="font-family: sans-serif; text-align: center; padding: 50px; background: #0F172A; color: white;">
        <h1 style="color: #25D366;">✅ הוואטסאפ מחובר בהצלחה!</h1>
        <p>מספר פעיל: <b>${connectedUserPhone}</b></p>
        <p>הודעות נכנסות משוקפות בסטודיו, ומענה מממשק הצ'אט נוחת מיד בוואטסאפ.</p>
      </body>
      </html>
    `);
  }

  if (latestQrDataUrl) {
    return res.send(`
      <!DOCTYPE html>
      <html dir="rtl">
      <head><meta charset="utf-8"><title>סריקת QR לוואטסאפ - ח. סבן</title></head>
      <body style="font-family: sans-serif; text-align: center; padding: 40px; background: #0F172A; color: white;">
        <h2>📲 סריקת קוד QR לחיבור הוואטסאפ</h2>
        <p style="color: #94A3B8;">פתחו את וואטסאפ בטלפון > הגדרות > מכשירים מקושרים > קשר מכשיר</p>
        <div style="background: white; display: inline-block; padding: 20px; border-radius: 16px; margin: 20px 0;">
          <img src="${latestQrDataUrl}" alt="WhatsApp QR Code" style="width: 280px; height: 280px;" />
        </div>
        <p style="font-size: 13px; color: #64748B;">הדף יתרענן אוטומטית בעת החלפת קוד...</p>
        <script>setTimeout(() => location.reload(), 15000);</script>
      </body>
      </html>
    `);
  }

  res.send(`
    <!DOCTYPE html>
    <html dir="rtl">
    <head><meta charset="utf-8"><title>טוען וואטסאפ...</title></head>
    <body style="font-family: sans-serif; text-align: center; padding: 50px; background: #0F172A; color: white;">
      <h2>⏳ ממתין ליצירת קוד QR מוואטסאפ...</h2>
      <p style="color: #94A3B8;">מרענן תוך מספר שניות.</p>
      <script>setTimeout(() => location.reload(), 3000);</script>
    </body>
    </html>
  `);
});

app.get('/status', (_req, res) => {
  res.json({
    success: true,
    isClientReady,
    connectedPhone: connectedUserPhone,
    firebaseUrl: FIREBASE_RTDB_URL,
    appsScriptUrl: APPS_SCRIPT_URL
  });
});

const server = app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🌐 שרת גשר וואטסאפ פעיל על: http://localhost:${PORT}`);
  console.log(`📲 דף קוד QR לסריקה: http://localhost:${PORT}/qr`);
  console.log(`☁️ סנכרון ישיר ל-Firebase: ${FIREBASE_RTDB_URL}`);
  console.log(`📊 גיליון Google Sheets: ${APPS_SCRIPT_URL}`);
  console.log(`===============================================`);
  console.log('מאתחל לקוח WhatsApp Web...');
  client.initialize().catch((err) => {
    console.error('❌ תקלת אתחול לקוח WhatsApp Web:', err);
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ שגיאה: פורט ${PORT} תפוס! הגדירו BRIDGE_PORT=3002 ונסו שוב.`);
  } else {
    console.error('❌ שגיאת שרת:', err.message);
  }
});
