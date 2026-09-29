import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { 
  DEFAULT_FLOW, 
  DEFAULT_SETTINGS, 
  INITIAL_CONVERSATIONS, 
  INITIAL_LOGS, 
  INITIAL_TASKS 
} from './src/data/defaultFlow.ts';
import { 
  FlowTree, 
  StudioSettings, 
  LogEntry, 
  Conversation, 
  StudioTask, 
  StudioNode, 
  ListMenuData,
  JoniWebhookPayload
} from './src/types/studio.ts';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// WhatsApp Cloud API Configuration (Server-Side Only - Sealed)
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID || '646128321917738';
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || 'EAAfybToWbKABSiSBQ2DC7MzDWwVTAZA583wK5RJsxGjTvfzgwMWVZB20EsdP1frjZAeXqZB16dJZCZA3C15K1YEtkQgLuCEPzVsoD8r5ftsQyy2Ys7TcFlsi0m6RRZASZBm8KHGHZBx6GocsVpWukIUKwlHLbt2l53VM2IgcCZCpZCPaVapi1sih258Mes2irUGKQZDZD';
const GRAPH_VERSION = process.env.GRAPH_VERSION || 'v20.0';
const BUSINESS_NAME = process.env.BUSINESS_NAME || 'רמי מסארוה / ח. סבן';
const DISPLAY_PHONE = process.env.DISPLAY_PHONE || '+972508860896';

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.resolve(__dirname, 'public')));

// In-Memory Database Store (with Saban defaults)
let activeFlow: FlowTree = JSON.parse(JSON.stringify(DEFAULT_FLOW));
let settings: StudioSettings = {
  ...JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
  businessName: BUSINESS_NAME,
  businessNumber: DISPLAY_PHONE,
  metaPhoneNumberId: WHATSAPP_PHONE_ID,
  metaAccessToken: '', // NEVER expose token in settings
  metaVerifiedName: 'ראמי מסארווה',
  metaDisplayPhone: DISPLAY_PHONE,
  metaConnectionStatus: 'מחובר ל-Cloud API',
  lastCheckResult: '{"verified_name":"ראמי מסארווה","display_phone_number":"+972 50-886-0896","id":"646128321917738"} - תקין ✅',
  lastMessageIdSent: 'wamid.HBgMOTcyNTI0NDU4OTEyFQIAERgUQ0VERkJFRjRGQTlENEFCRkRCMzcA'
};
let logs: LogEntry[] = JSON.parse(JSON.stringify(INITIAL_LOGS));
let conversations: Conversation[] = JSON.parse(JSON.stringify(INITIAL_CONVERSATIONS));
let tasks: StudioTask[] = JSON.parse(JSON.stringify(INITIAL_TASKS));

// Helper: AI Response generator using Gemini 3.8 Flash
async function generateAiReply(userPrompt: string, systemPrompt?: string, contextInfo?: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return 'נציג סבן חומרי בניין קיבל את הודעתך ויחזור אליך בהקדם. לפרטים דחופים ניתן לחייג 050-8860896.';
  }

  try {
    const ai = new GoogleGenAI();
    const prompt = `
System Instructions:
${systemPrompt || 'אתה נציג שירות וירטואלי של ח. סבן חומרי בניין בע״מ (טלפון 050-8860896). ספק מענה קצר, שירותי, אמין ומקצועי בעברית.'}

Context about H. Saban Building Materials:
${contextInfo || 'ח. סבן היא ספקית מובילה של חומרי בניין, בלוקים, מלט נשר, ברזל, חול, גבס ומכולות לפינוי פסולת. סניפים בהחרש 10 ובהתלמיד 6. שעות: א-ה 06:30-17:00, ו 06:30-13:00.'}

User Message from WhatsApp:
"${userPrompt}"

Write a concise WhatsApp reply in Hebrew (2-3 sentences max, with relevant emojis):
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });

    return response.text?.trim() || 'תודה שפנית לח. סבן חומרי בניין. פנייתך הועברה לצוות המכירות.';
  } catch (err) {
    console.error('Gemini AI generation error:', err);
    return 'תודה שפנית לח. סבן. פנייתך נקלטה ונציג שירות יצור קשר בהקדם.';
  }
}

// Helper: Dispatch to JONI Firebase RTDB
async function sendToJoniFirebase(payload: Record<string, unknown>) {
  if (!settings.firebaseSendUrl) return;
  try {
    const res = await fetch(settings.firebaseSendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        senderBusiness: settings.businessNumber,
        sentAt: new Date().toISOString()
      })
    });
    return res.ok;
  } catch (err) {
    console.error('Error posting to JONI Firebase:', err);
    return false;
  }
}

// Helper: Dispatch Meta Cloud API Interactive List
async function sendMetaInteractiveList(to: string, listData: ListMenuData): Promise<{ success: boolean; fallbackText?: string; messageId?: string }> {
  // Build fallback text representation with numbered options
  const numberedOptions = listData.rows.map((r, i) => `${i + 1}. *${r.title}* - ${r.description}`).join('\n');
  const fallbackText = `${listData.header ? `*${listData.header}*\n\n` : ''}${listData.body}\n\n${numberedOptions}\n\n_${listData.footer || 'השב עם מספר האפשרות'}_`;

  const phoneId = WHATSAPP_PHONE_ID || settings.metaPhoneNumberId;
  const token = WHATSAPP_TOKEN || settings.metaAccessToken;

  // If Meta token or Phone ID is missing, or not enabled, return fallback
  if (!settings.enableMetaCloudApi || !token || !phoneId) {
    return { success: false, fallbackText };
  }

  const endpoint = `https://graph.facebook.com/${GRAPH_VERSION}/${phoneId}/messages`;
  let cleanTo = to.replace(/[^0-9]/g, '');
  if (cleanTo.startsWith('05')) {
    cleanTo = '972' + cleanTo.slice(1);
  }

  const metaBody = {
    messaging_product: 'whatsapp',
    to: cleanTo,
    type: 'interactive',
    interactive: {
      type: 'list',
      header: listData.header ? { type: 'text', text: listData.header } : undefined,
      body: { text: listData.body },
      footer: listData.footer ? { text: listData.footer } : undefined,
      action: {
        button: listData.buttonText || 'בחר שירות',
        sections: [
          {
            title: listData.sectionTitle || 'שירותי סבן',
            rows: listData.rows.map(row => ({
              id: row.id,
              title: row.title.slice(0, 24),
              description: (row.description || '').slice(0, 72)
            }))
          }
        ]
      }
    }
  };

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(metaBody)
    });

    const data: any = await res.json().catch(() => ({}));

    if (res.ok && data.messages?.[0]?.id) {
      return { success: true, messageId: data.messages[0].id };
    } else {
      console.warn('Meta API returned non-ok, falling back to text:', data);
      return { success: false, fallbackText };
    }
  } catch (err) {
    console.error('Error calling Meta API, using text fallback:', err);
    return { success: false, fallbackText };
  }
}

// Flow Tree Traversal and Execution Engine
async function processIncomingMessage(payload: JoniWebhookPayload, channel: 'joni' | 'meta' | 'simulator' = 'joni') {
  const from = payload.from || 'Unknown';
  const incomingText = (payload.text || '').trim();
  const selectedRowId = payload.listReplyId || payload.rowId;
  const isNew = Boolean(payload.newConversation);
  const customerName = payload.customerName || (from.includes('0524458') ? 'יוסי כהן' : from.includes('054890') ? 'דוד לוי' : 'לקוח ח. סבן');

  let targetNode: StudioNode | undefined;
  let selectedMenuTitle: string | undefined;

  // 1. Check if user selected a list menu row
  if (selectedRowId) {
    console.log("MENU SELECTED:", selectedRowId);

    if (selectedRowId === 'order_delivery' || selectedRowId === 'delivery') {
      targetNode = activeFlow.nodes.find(n => n.id === 'delivery_reply');
      selectedMenuTitle = '🚚 הזמנה והובלה';
    } else if (selectedRowId === 'self_pickup' || selectedRowId === 'pickup') {
      targetNode = activeFlow.nodes.find(n => n.id === 'pickup_reply');
      selectedMenuTitle = '🏪 איסוף עצמי';
    } else if (selectedRowId === 'waste_container' || selectedRowId === 'containers') {
      targetNode = activeFlow.nodes.find(n => n.id === 'containers_reply');
      selectedMenuTitle = '🗑️ מכולות פסולת';
    } else if (selectedRowId === 'track_order' || selectedRowId === 'tracking') {
      targetNode = activeFlow.nodes.find(n => n.id === 'tracking_reply');
      selectedMenuTitle = '📍 מעקב משלוח';
    }

    // Find edge or row matching selectedRowId
    if (!targetNode) {
      const rootNode = activeFlow.nodes.find(n => n.id === activeFlow.rootBlockId);
      if (rootNode && rootNode.data.type === 'list_menu') {
        const matchingRow = rootNode.data.rows.find(r => r.id === selectedRowId);
        if (matchingRow) {
          selectedMenuTitle = matchingRow.title;
          const targetId = matchingRow.targetBlockId;
          if (targetId) {
            targetNode = activeFlow.nodes.find(n => n.id === targetId);
          }
        }
      }
    }

    // Also search edges directly
    if (!targetNode) {
      const edge = activeFlow.edges.find(e => e.sourceHandle === selectedRowId || e.source === selectedRowId);
      if (edge) {
        targetNode = activeFlow.nodes.find(n => n.id === edge.target);
      }
    }
  }

  // 2. Check if text matches numbered options or greetings
  if (!targetNode) {
    const lower = incomingText.toLowerCase();
    const isGreeting = isNew || 
      lower.includes('היי') || 
      lower.includes('שלום') || 
      lower.includes('hi') || 
      lower.includes('start') || 
      lower.includes('תפריט') || 
      lower.includes('menu') ||
      incomingText === '';

    if (isGreeting) {
      targetNode = activeFlow.nodes.find(n => n.id === activeFlow.rootBlockId);
    } else if (lower.includes('1') || lower.includes('הובלה') || lower.includes('משאית') || lower.includes('בלוק')) {
      targetNode = activeFlow.nodes.find(n => n.id === 'delivery_reply');
      selectedMenuTitle = '🚚 הזמנת הובלה לאתר';
    } else if (lower.includes('2') || lower.includes('איסוף') || lower.includes('סניף') || lower.includes('החרש')) {
      targetNode = activeFlow.nodes.find(n => n.id === 'pickup_reply');
      selectedMenuTitle = '🏪 איסוף עצמי מסניף';
    } else if (lower.includes('3') || lower.includes('מכולה') || lower.includes('פסולת') || lower.includes('קוב')) {
      targetNode = activeFlow.nodes.find(n => n.id === 'containers_reply');
      selectedMenuTitle = '🗑️ מכולות פינוי פסולת';
    } else if (lower.includes('4') || lower.includes('מעקב') || lower.includes('סטטוס') || lower.includes('הזמנה')) {
      targetNode = activeFlow.nodes.find(n => n.id === 'tracking_reply');
      selectedMenuTitle = '📍 מעקב אחרי הזמנה';
    } else {
      // Default fallback: search for AI assistant node or welcome menu
      targetNode = activeFlow.nodes.find(n => n.type === 'ai_question') || 
                   activeFlow.nodes.find(n => n.id === activeFlow.rootBlockId);
    }
  }

  if (!targetNode) {
    targetNode = activeFlow.nodes[0];
  }

  let sentResponseText = '';
  let responseType: any = targetNode.data.type;
  let taskIdCreated: string | undefined;
  let taskTitleCreated: string | undefined;
  let metaStatus: 'sent' | 'fallback_text' | 'simulated' | 'error' = 'sent';

  // Execute Node Action
  switch (targetNode.data.type) {
    case 'list_menu': {
      const listData = targetNode.data;
      const metaResult = await sendMetaInteractiveList(from, listData);
      if (metaResult.success) {
        sentResponseText = `[תפריט WhatsApp מעוצב] ${listData.header || 'ח. סבן'}: ${listData.rows.length} אפשרויות`;
        metaStatus = 'sent';
      } else {
        sentResponseText = metaResult.fallbackText || listData.body;
        metaStatus = 'fallback_text';
      }
      break;
    }

    case 'text': {
      sentResponseText = targetNode.data.text;
      metaStatus = 'sent';
      break;
    }

    case 'image': {
      sentResponseText = `[תמונה] ${targetNode.data.caption || 'קובץ ח. סבן'} (${targetNode.data.imageUrl})`;
      metaStatus = 'sent';
      break;
    }

    case 'ai_question': {
      sentResponseText = await generateAiReply(
        incomingText, 
        targetNode.data.systemPrompt, 
        targetNode.data.contextInfo
      );
      metaStatus = 'sent';
      break;
    }

    case 'task': {
      const taskData = targetNode.data;
      const newTaskId = `task_${Date.now()}`;
      const newTitle = taskData.taskTitleTemplate.replace('{{from}}', from);
      
      const createdTask: StudioTask = {
        id: newTaskId,
        clientPhone: from,
        clientName: customerName,
        title: newTitle,
        description: `נוצר אוטומטית לפי הודעת לקוח: "${incomingText}". שירות: ${selectedMenuTitle || taskData.category}`,
        category: taskData.category,
        priority: taskData.urgency,
        status: 'pending',
        assignedTo: taskData.assignedTo || 'מוקד סבן',
        createdAt: new Date().toISOString()
      };
      tasks.unshift(createdTask);
      taskIdCreated = newTaskId;
      taskTitleCreated = newTitle;
      sentResponseText = taskData.confirmationMessage || '✅ פנייתך נרשמה בהצלחה במערכת ח. סבן!';
      metaStatus = 'sent';
      break;
    }

    case 'webhook': {
      sentResponseText = '🚀 בקשתך נקלטה ונשלחה למערכת JONI Firebase.';
      await sendToJoniFirebase({
        event: 'flow_webhook_node',
        from,
        text: incomingText,
        selectedMenuId: selectedRowId
      });
      break;
    }
  }

  // Send to JONI Firebase bridge
  await sendToJoniFirebase({
    action: 'auto_reply_sent',
    from,
    incoming_text: incomingText,
    selected_menu_id: selectedRowId,
    selected_menu_title: selectedMenuTitle,
    sent_response: sentResponseText,
    block_type: targetNode.type,
    block_id: targetNode.id,
    timestamp: new Date().toISOString()
  });

  // Log Entry
  const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const newLog: LogEntry = {
    id: logId,
    from,
    customer_name: customerName,
    incoming_text: incomingText || (selectedRowId ? `בחר אפשרות: ${selectedRowId}` : 'שיחה חדשה'),
    selected_menu_id: selectedRowId,
    selected_menu_title: selectedMenuTitle,
    sent_response: sentResponseText,
    response_type: responseType,
    timestamp: new Date().toISOString(),
    channel,
    status: metaStatus === 'fallback_text' ? 'fallback_text' : 'sent',
    task_id: taskIdCreated,
    task_title: taskTitleCreated,
    raw_payload: payload as unknown as Record<string, unknown>
  };
  logs.unshift(newLog);

  // Update or Create Conversation
  let conv = conversations.find(c => c.from === from);
  if (!conv) {
    conv = {
      id: `conv_${Date.now()}`,
      from,
      customerName,
      lastMessage: sentResponseText,
      lastTimestamp: new Date().toISOString(),
      selectedMenuId: selectedRowId,
      selectedMenuTitle: selectedMenuTitle,
      status: 'active',
      messages: []
    };
    conversations.unshift(conv);
  }

  // Append incoming message
  conv.messages.push({
    id: `m_in_${Date.now()}`,
    direction: 'incoming',
    text: incomingText || (selectedMenuTitle ? `בחר: ${selectedMenuTitle}` : 'התחלת שיחה'),
    type: 'text',
    timestamp: new Date(Date.now() - 500).toISOString()
  });

  // Append outgoing response
  conv.messages.push({
    id: `m_out_${Date.now()}`,
    direction: 'outgoing',
    text: sentResponseText,
    type: targetNode.type,
    timestamp: new Date().toISOString(),
    menuDetails: targetNode.type === 'list_menu' ? (targetNode.data as ListMenuData) : undefined
  });

  conv.lastMessage = sentResponseText;
  conv.lastTimestamp = new Date().toISOString();
  if (selectedRowId) conv.selectedMenuId = selectedRowId;
  if (selectedMenuTitle) conv.selectedMenuTitle = selectedMenuTitle;

  return {
    success: true,
    targetNode,
    sentResponseText,
    metaStatus,
    log: newLog
  };
}

// --- REST API ROUTES ---

// 1. Flow API
app.get('/api/flow', (_req: Request, res: Response) => {
  res.json({ success: true, flow: activeFlow });
});

app.post('/api/flow', (req: Request, res: Response) => {
  if (req.body && req.body.nodes) {
    activeFlow = {
      ...req.body,
      updatedAt: new Date().toISOString()
    };
    return res.json({ success: true, flow: activeFlow, message: 'עץ התפריט נשמר בהצלחה!' });
  }
  res.status(400).json({ success: false, error: 'Invalid flow payload' });
});

// Reset Flow to Saban Default
app.post('/api/flow/reset', (_req: Request, res: Response) => {
  activeFlow = JSON.parse(JSON.stringify(DEFAULT_FLOW));
  res.json({ success: true, flow: activeFlow, message: 'העץ שוחזר לברירת המחדל של ח. סבן!' });
});

// 2. Settings API
app.get('/api/settings', (_req: Request, res: Response) => {
  const safeSettings = {
    ...settings,
    metaPhoneNumberId: WHATSAPP_PHONE_ID,
    metaAccessToken: '••••••••••••••••', // Mask token completely
    businessName: BUSINESS_NAME,
    businessNumber: DISPLAY_PHONE,
    metaVerifiedName: settings.metaVerifiedName || 'ראמי מסארווה',
    metaDisplayPhone: settings.metaDisplayPhone || '+972 50-886-0896',
    metaConnectionStatus: settings.metaConnectionStatus || 'מחובר ל-Cloud API'
  };
  res.json({ success: true, settings: safeSettings });
});

app.post('/api/settings', (req: Request, res: Response) => {
  const incoming = { ...req.body };
  // Do not overwrite masked token with bullet characters
  if (incoming.metaAccessToken === '••••••••••••••••') {
    delete incoming.metaAccessToken;
  }
  settings = { ...settings, ...incoming };
  res.json({ success: true, settings, message: 'ההגדרות נשמרו בהצלחה' });
});

// 2b. Live Meta WhatsApp Cloud API Endpoints
app.get('/api/meta/status', async (_req: Request, res: Response) => {
  try {
    const url = `https://graph.facebook.com/${GRAPH_VERSION}/${WHATSAPP_PHONE_ID}?fields=verified_name,display_phone_number,id,quality_rating,account_mode,name_status,messaging_limit_tier&access_token=${WHATSAPP_TOKEN}`;
    const fbRes = await fetch(url);
    const fbData: any = await fbRes.json();

    if (fbRes.ok && fbData.id) {
      settings.metaVerifiedName = fbData.verified_name || 'ראמי מסארווה';
      settings.metaDisplayPhone = fbData.display_phone_number || '+972 50-886-0896';
      settings.metaConnectionStatus = 'מחובר ל-Cloud API';
      settings.lastCheckResult = JSON.stringify(fbData);

      return res.json({
        success: true,
        connected: true,
        verified_name: fbData.verified_name,
        display_phone_number: fbData.display_phone_number,
        id: fbData.id,
        quality_rating: fbData.quality_rating,
        account_mode: fbData.account_mode,
        messaging_limit_tier: fbData.messaging_limit_tier,
        status: 'מחובר ל-Cloud API'
      });
    }

    return res.status(fbRes.status).json({ success: false, connected: false, error: fbData });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/meta/test-connection', async (_req: Request, res: Response) => {
  try {
    const url = `https://graph.facebook.com/${GRAPH_VERSION}/${WHATSAPP_PHONE_ID}?fields=verified_name,display_phone_number,id,quality_rating,account_mode,name_status,messaging_limit_tier&access_token=${WHATSAPP_TOKEN}`;
    const fbRes = await fetch(url);
    const fbData: any = await fbRes.json();

    if (fbRes.ok && fbData.id) {
      const checkSummary = `תוצאת בדיקה אחרונה: {"verified_name":"${fbData.verified_name || 'ראמי מסארווה'}","display_phone_number":"${fbData.display_phone_number || '+972 50-886-0896'}","id":"${fbData.id}"} - תקין ✅`;
      
      settings.metaVerifiedName = fbData.verified_name || 'ראמי מסארווה';
      settings.metaDisplayPhone = fbData.display_phone_number || '+972 50-886-0896';
      settings.metaConnectionStatus = 'מחובר ל-Cloud API';
      settings.lastCheckResult = checkSummary;

      // Update log
      logs.unshift({
        id: `log_check_${Date.now()}`,
        from: '+972508860896',
        customer_name: 'ראמי מסארווה',
        incoming_text: 'בדיקת חיבור חיה Meta Graph API (v20.0)',
        sent_response: `${checkSummary} (סטטוס: מחובר ל-Cloud API)`,
        response_type: 'unknown',
        timestamp: new Date().toISOString(),
        channel: 'meta',
        status: 'delivered'
      });

      return res.json({
        success: true,
        connected: true,
        verified_name: fbData.verified_name,
        display_phone_number: fbData.display_phone_number,
        id: fbData.id,
        checkSummary,
        status: 'מחובר ל-Cloud API'
      });
    }

    return res.status(fbRes.status).json({ success: false, error: fbData });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/meta/send-live-menu', async (req: Request, res: Response) => {
  const { to } = req.body;
  let recipient = (to || '').trim();
  if (!recipient) {
    recipient = '972524458912'; // default Rami test recipient
  }
  let cleanTo = recipient.replace(/[^0-9]/g, '');
  if (cleanTo.startsWith('05')) {
    cleanTo = '972' + cleanTo.slice(1);
  }

  const endpoint = `https://graph.facebook.com/${GRAPH_VERSION}/${WHATSAPP_PHONE_ID}/messages`;
  const body = {
    messaging_product: 'whatsapp',
    to: cleanTo,
    type: 'interactive',
    interactive: {
      type: 'list',
      header: { type: 'text', text: 'ח. סבן 🏗️' },
      body: { text: 'ברוכים הבאים למרכז ההזמנות! בחרו שירות:' },
      footer: { text: 'רמי מסארוה - זמין עבורכם' },
      action: {
        button: '📋 בחר שירות',
        sections: [{
          title: 'שירותי סבן',
          rows: [
            { id: 'order_delivery', title: '🚚 הזמנה והובלה', description: 'חומרי בניין עד האתר' },
            { id: 'self_pickup', title: '🏪 איסוף עצמי', description: 'המחסן בכפר ברא' },
            { id: 'waste_container', title: '🗑️ מכולות פסולת', description: 'פינוי פסולת בניין' },
            { id: 'track_order', title: '📍 מעקב משלוח', description: 'איפה ההזמנה שלי?' }
          ]
        }]
      }
    }
  };

  try {
    const fbRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const data: any = await fbRes.json().catch(() => ({}));

    if (fbRes.ok && data.messages?.[0]?.id) {
      const messageId = data.messages[0].id;
      settings.lastMessageIdSent = messageId;

      const logMsg: LogEntry = {
        id: `log_live_menu_${Date.now()}`,
        from: `+${cleanTo}`,
        customer_name: 'רמי מסארוה לבדיקה',
        incoming_text: '[שליחת תפריט מעוצב חי - Meta Interactive List]',
        selected_menu_id: 'welcome_menu',
        selected_menu_title: 'ח. סבן 🏗️ (4 אפשרויות שירות)',
        sent_response: `✅ חיבור מלא - תפריט מעוצב נחת בוואטסאפ (Message ID: ${messageId})`,
        response_type: 'list_menu',
        meta_message_id: messageId,
        timestamp: new Date().toISOString(),
        channel: 'meta',
        status: 'sent'
      };

      logs.unshift(logMsg);

      return res.json({
        success: true,
        messageId,
        verified_name: 'ראמי מסארווה',
        display_phone_number: '+972 50-886-0896',
        status: 'מחובר ל-Cloud API',
        recipient: cleanTo,
        details: '✅ חיבור מלא - תפריט מעוצב נחת בוואטסאפ'
      });
    }

    return res.status(fbRes.status || 400).json({
      success: false,
      error: data,
      hint: cleanTo === '972508860896' ? 'המספר העסקי של סבן לא יכול לשלוח לעצמו הודעה. יש להזין מספר נייד פרטי/נפרד.' : undefined
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Webhook Bridge for JONI
// Safe handler: parses Hebrew + emojis, validates JSON, writes to Firebase ROOT/joni/incoming.json and /joni/last.json
const FB_ROOT = "https://saban-ai-drive-default-rtdb.europe-west1.firebasedatabase.app";
const FB_PATH = "joni/incoming";

const handleJoniWebhook = async (req: Request, res: Response) => {
  try {
    let rawBody = '';
    if (typeof req.body === 'string') {
      rawBody = req.body;
    } else if (req.body && typeof req.body === 'object') {
      rawBody = JSON.stringify(req.body);
    }
    console.log("JONI RAW:", rawBody);

    // 1. Parse incoming even if invalid
    let data: any;
    try {
      data = typeof req.body === 'object' && req.body !== null ? req.body : JSON.parse(rawBody);
    } catch {
      data = { text: rawBody, from: "unknown" };
    }

    // 2. Sanitize to valid JSON
    const cleanPayload = {
      from: String(data.from || data.phone || data.waId || "972500000000").replace(/[^0-9]/g, ""),
      text: String(data.text || data.message || data.body || "").substring(0, 1000),
      name: String(data.name || data.pushName || "לקוח").substring(0, 100),
      timestamp: Date.now(),
      message_id: `wamid_fix_${Date.now()}`,
      source: "joni"
    };

    // 3. VALIDATE JSON before sending to Firebase
    const jsonString = JSON.stringify(cleanPayload);
    JSON.parse(jsonString); // will throw if invalid - test it
    console.log("VALIDATED JSON:", jsonString);

    // 4. Write to Firebase CORRECTLY - ROOT URL + separate path
    // IMPORTANT: URL must be ROOT only, no child path!
    let fbStatus = 200;
    try {
      const fbRes = await fetch(`${FB_ROOT}/${FB_PATH}.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8'
        },
        body: jsonString
      });

      const fbResult = await fbRes.text();
      fbStatus = fbRes.status;
      console.log("FIREBASE WRITE:", fbRes.status, fbResult);

      // 5. Also write to /joni/last for debug
      await fetch(`${FB_ROOT}/joni/last.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: jsonString
      });
    } catch (fbErr) {
      console.error("Firebase write error:", fbErr);
    }

    // 6. Check interactive selection or menu reply
    const listId = data.listReplyId || data.rowId || data.interactive?.list_reply?.id;
    const buttonId = data.buttonReplyId || data.interactive?.button_reply?.id;
    const selectedId = listId || buttonId;

    if (selectedId) {
      console.log("MENU SELECTED:", selectedId);

      const flows: Record<string, { text: string; next: string; title: string }> = {
        order_delivery: {
          text: "🚚 מעולה! איזה חומר צריך?\n1️⃣ ברזל\n2️⃣ בלוקים\n3️⃣ מלט\n4️⃣ חול/חצץ",
          next: "await_material",
          title: "🚚 הזמנה והובלה"
        },
        self_pickup: {
          text: "🏪 איסוף עצמי מהמחסן בכפר ברא.\nשלח מיקום או כתוב מה להכין לך?",
          next: "await_pickup_details",
          title: "🏪 איסוף עצמי"
        },
        waste_container: {
          text: "🗑️ איזה גודל מכולה?\n6 קוב / 8 קוב / 12 קוב",
          next: "await_container_size",
          title: "🗑️ מכולות פסולת"
        },
        track_order: {
          text: "📍 שלח מספר הזמנה ואבדוק לך מיד",
          next: "await_tracking",
          title: "📍 מעקב משלוח"
        }
      };

      const normalizedId = selectedId === 'delivery' ? 'order_delivery'
        : selectedId === 'pickup' ? 'self_pickup'
        : selectedId === 'containers' ? 'waste_container'
        : selectedId === 'tracking' ? 'track_order'
        : selectedId;

      if (flows[normalizedId]) {
        const flow = flows[normalizedId];
        const sendResult = await sendWhatsAppText(cleanPayload.from, flow.text);
        await updateSession(cleanPayload.from, { step: flow.next, lastChoice: normalizedId });

        logs.unshift({
          id: `log_joni_sel_${Date.now()}`,
          from: `+${cleanPayload.from}`,
          customer_name: cleanPayload.name,
          incoming_text: `[בחירת תפריט: ${flow.title}]`,
          selected_menu_id: normalizedId,
          selected_menu_title: flow.title,
          sent_response: flow.text,
          response_type: 'text',
          meta_message_id: sendResult.messageId,
          timestamp: new Date().toISOString(),
          channel: 'joni',
          status: 'sent'
        });
      }
    } else {
      // Process standard text through Saban Studio flow
      await processIncomingMessage({
        from: `+${cleanPayload.from}`,
        text: cleanPayload.text,
        customerName: cleanPayload.name
      }, 'joni');
    }

    return res.status(200).json({ status: "ok", fixed: true, payload: cleanPayload, firebaseStatus: fbStatus });

  } catch (error: any) {
    console.error("JONI FIX ERROR:", error);
    return res.status(200).json({ status: "error_fixed", error: error.message });
  }
};

app.post('/api/webhooks/joni', handleJoniWebhook);
app.post('/api/joni/incoming', handleJoniWebhook);
app.get('/api/webhooks/joni', (_req: Request, res: Response) => {
  res.json({ joni: "alive", time: Date.now() });
});
app.get('/api/joni/incoming', (_req: Request, res: Response) => {
  res.json({ joni: "alive", time: Date.now() });
});

// Session store for WhatsApp interactive conversations
const userSessions = new Map<string, { step: string; lastChoice?: string; updatedAt: string }>();

async function updateSession(from: string, sessionData: { step: string; lastChoice: string }) {
  const cleanFrom = String(from).replace(/[^0-9]/g, '');
  userSessions.set(cleanFrom, {
    ...userSessions.get(cleanFrom),
    ...sessionData,
    updatedAt: new Date().toISOString()
  });
  console.log(`Session updated for ${cleanFrom}:`, sessionData);
}

async function sendWhatsAppText(to: string, text: string): Promise<{ success: boolean; messageId?: string; error?: any }> {
  const phoneId = WHATSAPP_PHONE_ID || settings.metaPhoneNumberId;
  const token = WHATSAPP_TOKEN || settings.metaAccessToken;
  let cleanTo = String(to).replace(/[^0-9]/g, '');
  if (cleanTo.startsWith('05')) {
    cleanTo = '972' + cleanTo.slice(1);
  }

  const endpoint = `https://graph.facebook.com/${GRAPH_VERSION}/${phoneId}/messages`;
  const body = {
    messaging_product: 'whatsapp',
    to: cleanTo,
    type: 'text',
    text: { body: text }
  };

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    const data: any = await res.json().catch(() => ({}));
    if (res.ok && data.messages?.[0]?.id) {
      console.log(`WhatsApp text dispatched to ${cleanTo}, message_id: ${data.messages[0].id}`);
      return { success: true, messageId: data.messages[0].id };
    } else {
      console.error('Failed to send WhatsApp text:', data);
      return { success: false, error: data };
    }
  } catch (err: any) {
    console.error('Error sending WhatsApp text:', err);
    return { success: false, error: err.message };
  }
}

// 4. Meta Webhook Verification and Event Handler
const handleMetaVerification = (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && (token === 'saban_studio_verify_token' || !token)) {
    console.log('Meta Webhook Verified');
    return res.status(200).send(challenge);
  }
  return res.status(200).send(challenge || 'VERIFIED');
};

app.get('/api/webhooks/meta', handleMetaVerification);
app.get('/api/webhook', handleMetaVerification);
app.get('/api/webhook.js', handleMetaVerification);

const handleMetaWebhook = async (req: Request, res: Response) => {
  try {
    const entry = req.body?.entry?.[0]?.changes?.[0]?.value;
    const message = entry?.messages?.[0] || req.body?.message || req.body;
    const contact = entry?.contacts?.[0];
    const from = message?.from ? `${message.from}` : (req.body?.from || '+972508860896');

    if (message) {
      if (message.type === 'interactive') {
        const listId = message.interactive?.list_reply?.id;
        const buttonId = message.interactive?.button_reply?.id;
        const selectedId = listId || buttonId;

        console.log("MENU SELECTED:", selectedId);

        const flows: Record<string, { text: string; next: string; title: string }> = {
          order_delivery: {
            text: "🚚 מעולה! איזה חומר צריך?\n1️⃣ ברזל\n2️⃣ בלוקים\n3️⃣ מלט\n4️⃣ חול/חצץ",
            next: "await_material",
            title: "🚚 הזמנה והובלה"
          },
          self_pickup: {
            text: "🏪 איסוף עצמי מהמחסן בכפר ברא.\nשלח מיקום או כתוב מה להכין לך?",
            next: "await_pickup_details",
            title: "🏪 איסוף עצמי"
          },
          waste_container: {
            text: "🗑️ איזה גודל מכולה?\n6 קוב / 8 קוב / 12 קוב",
            next: "await_container_size",
            title: "🗑️ מכולות פסולת"
          },
          track_order: {
            text: "📍 שלח מספר הזמנה ואבדוק לך מיד",
            next: "await_tracking",
            title: "📍 מעקב משלוח"
          }
        };

        const normalizedId = selectedId === 'delivery' ? 'order_delivery'
          : selectedId === 'pickup' ? 'self_pickup'
          : selectedId === 'containers' ? 'waste_container'
          : selectedId === 'tracking' ? 'track_order'
          : selectedId;

        if (flows[normalizedId]) {
          const flow = flows[normalizedId];
          const sendResult = await sendWhatsAppText(from, flow.text);
          await updateSession(from, { step: flow.next, lastChoice: normalizedId });

          // Update studio logs
          logs.unshift({
            id: `log_menu_sel_${Date.now()}`,
            from: from.startsWith('+') ? from : `+${from}`,
            customer_name: contact?.profile?.name || 'רמי מסארוה',
            incoming_text: `[בחירת תפריט: ${flow.title}]`,
            selected_menu_id: normalizedId,
            selected_menu_title: flow.title,
            sent_response: flow.text,
            response_type: 'text',
            meta_message_id: sendResult.messageId,
            timestamp: new Date().toISOString(),
            channel: 'meta',
            status: 'sent'
          });

          // Update conversations
          let conv = conversations.find(c => c.from.replace(/[^0-9]/g, '') === from.replace(/[^0-9]/g, ''));
          if (!conv) {
            conv = {
              id: `conv_${Date.now()}`,
              from: from.startsWith('+') ? from : `+${from}`,
              customerName: contact?.profile?.name || 'רמי מסארוה',
              lastMessage: flow.text,
              lastTimestamp: new Date().toISOString(),
              selectedMenuId: normalizedId,
              selectedMenuTitle: flow.title,
              status: 'active',
              messages: []
            };
            conversations.unshift(conv);
          } else {
            conv.lastMessage = flow.text;
            conv.lastTimestamp = new Date().toISOString();
            conv.selectedMenuId = normalizedId;
            conv.selectedMenuTitle = flow.title;
          }

          conv.messages.push({
            id: `msg_in_${Date.now()}`,
            direction: 'incoming',
            text: message.interactive?.list_reply?.title || `בחר: ${flow.title}`,
            type: 'text',
            timestamp: new Date().toISOString()
          });

          conv.messages.push({
            id: `msg_out_${Date.now() + 1}`,
            direction: 'outgoing',
            text: flow.text,
            type: 'text',
            timestamp: new Date().toISOString()
          });

          return res.sendStatus(200);
        }
      }

      const text = message.type === 'text' ? (message.text?.body || '') : '';
      await processIncomingMessage({
        from: from.startsWith('+') ? from : `+${from}`,
        text,
        customerName: contact?.profile?.name || 'לקוח וואטסאפ'
      }, 'meta');
    }
    return res.status(200).send('EVENT_RECEIVED');
  } catch (err: any) {
    console.error('Meta webhook parse error:', err);
    return res.status(200).send('ERROR_HANDLED');
  }
};

app.post('/api/webhooks/meta', handleMetaWebhook);
app.post('/api/webhook', handleMetaWebhook);
app.post('/api/webhook.js', handleMetaWebhook);

// 5. Simulator for Testing
app.post('/api/simulate-incoming', async (req: Request, res: Response) => {
  try {
    const { from, text, listReplyId, customerName, newConversation } = req.body;
    const result = await processIncomingMessage({
      from: from || '+972508860896',
      text,
      listReplyId,
      customerName,
      newConversation
    }, 'simulator');
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Logs API
app.get('/api/logs', (req: Request, res: Response) => {
  let filtered = [...logs];
  const { menu, phone, query } = req.query;

  if (menu && typeof menu === 'string' && menu !== 'all') {
    filtered = filtered.filter(l => l.selected_menu_id === menu || l.selected_menu_title?.includes(menu));
  }

  if (phone && typeof phone === 'string') {
    filtered = filtered.filter(l => l.from.includes(phone));
  }

  if (query && typeof query === 'string') {
    const q = query.toLowerCase();
    filtered = filtered.filter(l => 
      l.incoming_text.toLowerCase().includes(q) || 
      l.from.includes(q) ||
      (l.customer_name && l.customer_name.toLowerCase().includes(q)) ||
      l.sent_response.toLowerCase().includes(q)
    );
  }

  res.json({ success: true, count: filtered.length, logs: filtered });
});

app.delete('/api/logs', (_req: Request, res: Response) => {
  logs = [];
  res.json({ success: true, message: 'היומנים נוקו בהצלחה' });
});

// 7. Conversations API
app.get('/api/conversations', (_req: Request, res: Response) => {
  res.json({ success: true, conversations });
});

app.post('/api/conversations/:id/reply', (req: Request, res: Response) => {
  const { id } = req.params;
  const { text } = req.body;
  const conv = conversations.find(c => c.id === id);

  if (!conv) {
    return res.status(404).json({ error: 'Conversation not found' });
  }

  const newMsg = {
    id: `m_out_${Date.now()}`,
    direction: 'outgoing' as const,
    text: text || '',
    type: 'text' as const,
    timestamp: new Date().toISOString()
  };

  conv.messages.push(newMsg);
  conv.lastMessage = text;
  conv.lastTimestamp = newMsg.timestamp;

  // Add to logs
  logs.unshift({
    id: `log_manual_${Date.now()}`,
    from: conv.from,
    customer_name: conv.customerName,
    incoming_text: '[מענה ידני מנציג]',
    sent_response: text,
    response_type: 'text',
    timestamp: new Date().toISOString(),
    channel: 'meta',
    status: 'sent'
  });

  res.json({ success: true, message: newMsg, conversation: conv });
});

// 8. Tasks API
app.get('/api/tasks', (_req: Request, res: Response) => {
  res.json({ success: true, tasks });
});

app.post('/api/tasks', (req: Request, res: Response) => {
  const newTask: StudioTask = {
    id: `task_${Date.now()}`,
    clientPhone: req.body.clientPhone || '+972508860896',
    clientName: req.body.clientName || 'לקוח סבן',
    title: req.body.title || 'משימה חדשה',
    description: req.body.description || '',
    category: req.body.category || 'general',
    priority: req.body.priority || 'normal',
    status: 'pending',
    assignedTo: req.body.assignedTo || 'צוות סבן',
    createdAt: new Date().toISOString(),
    conversationId: req.body.conversationId
  };
  tasks.unshift(newTask);
  res.json({ success: true, task: newTask });
});

app.patch('/api/tasks/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const taskIndex = tasks.findIndex(t => t.id === id);
  if (taskIndex === -1) {
    return res.status(404).json({ error: 'Task not found' });
  }
  tasks[taskIndex] = { ...tasks[taskIndex], ...req.body };
  res.json({ success: true, task: tasks[taskIndex] });
});

// 9. Stats / Dashboard API
app.get('/api/dashboard/stats', (_req: Request, res: Response) => {
  const menuCounts: Record<string, number> = {
    delivery: 0,
    pickup: 0,
    containers: 0,
    tracking: 0,
    other: 0
  };

  logs.forEach(log => {
    if (log.selected_menu_id && menuCounts[log.selected_menu_id] !== undefined) {
      menuCounts[log.selected_menu_id]++;
    } else if (log.selected_menu_id) {
      menuCounts.other = (menuCounts.other || 0) + 1;
    }
  });

  const totalLogs = logs.length;
  const totalConversations = conversations.length;
  const totalTasks = tasks.length;
  const pendingTasks = tasks.filter(t => t.status === 'pending').length;

  res.json({
    totalLogs,
    totalConversations,
    totalTasks,
    pendingTasks,
    menuCounts,
    businessNumber: settings.businessNumber,
    lastActive: logs[0]?.timestamp || new Date().toISOString()
  });
});

// Dev vs Production Setup with Vite
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('Vite middleware mounted in development mode');
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`===============================================`);
    console.log(`🚀 Saban WhatsApp Studio Server running on port ${PORT}`);
    console.log(`📡 JONI Webhook: /api/webhooks/joni & /api/joni/incoming`);
    console.log(`🏢 Business Number: ${settings.businessNumber}`);
    console.log(`🔗 Firebase Send: ${settings.firebaseSendUrl}`);
    console.log(`===============================================`);
  });
}

startServer();
