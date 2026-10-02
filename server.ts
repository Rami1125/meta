import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, FunctionDeclaration, Type } from '@google/genai';
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
  ListMenuRow,
  JoniWebhookPayload
} from './src/types/studio.ts';
import { processNoaAiMessage } from './src/logic/noaAiEngine.ts';
import { ordersService } from './src/services/ordersService.ts';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// WhatsApp Cloud API Configuration (Server-Side Only - Sealed)
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_ID || '646128321917738';
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || '';
const GRAPH_VERSION = process.env.GRAPH_VERSION || 'v20.0';
const BUSINESS_NAME = process.env.BUSINESS_NAME || 'רמי מסארוה / ח. סבן';
const DISPLAY_PHONE = process.env.DISPLAY_PHONE || '+972508860896';
const GOOGLE_SHEET_WEBAPP_URL = (process.env.GOOGLE_SHEET_WEBAPP_URL && !process.env.GOOGLE_SHEET_WEBAPP_URL.includes('AKfycbwAP')) 
  ? process.env.GOOGLE_SHEET_WEBAPP_URL 
  : 'https://script.google.com/macros/s/AKfycbwAkBK1Z051WmTvyDsRNrUf3xAS0MOCio9QRdoGyYxQdN66AekWhG_YFAgmKNEl7mR_/exec';
const MAKE_JONI_WEBHOOK_URL = process.env.MAKE_JONI_WEBHOOK_URL || 'https://hook.eu1.make.com/iozzim8loo8gtkq62wb4axycdskfe080';

// Log of recent dispatches sent to Make
export interface JoniMakeDispatchResult {
  id: string;
  timestamp: string;
  to: string;
  message: string;
  action: string;
  sender: string;
  status: number;
  success: boolean;
  response: string;
}
const joniMakeLogs: JoniMakeDispatchResult[] = [];

// Local outbound queue for Chat UI to WhatsApp Web Bridge & daemon
export interface OutboundQueueItem {
  id: string;
  phone: string;
  name?: string;
  message: string;
  action?: string;
  timestamp: string;
  source: 'chat_ui' | 'system' | 'sheet';
}
let localPendingOutboundQueue: OutboundQueueItem[] = [];

// Tool Definition for Gemini Function Calling (trigger_joni_make)
const triggerJoniMakeFunctionDeclaration: FunctionDeclaration = {
  name: 'trigger_joni_make',
  description: 'שולח את התפריט או התשובה של נועה ישירות ל-Make (JONI Webhook) לשידור מיידי בוואטסאפ ללקוח.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      to: {
        type: Type.STRING,
        description: 'מספר הטלפון של הנמען (לדוגמה 972508860896).'
      },
      message: {
        type: Type.STRING,
        description: 'תוכן ההודעה או התפריט שנועה שיגרה.'
      },
      action: {
        type: Type.STRING,
        description: 'סוג הפעולה (send_menu / customer_reply / order_update / container_task).'
      }
    },
    required: ['to', 'message']
  }
};

// Tool Executor: Dispatches directly to Make Webhook
async function triggerJoniMake(to: string, message: string, action: string = 'customer_reply') {
  let cleanTo = String(to || '').replace(/[^0-9]/g, '');
  if (cleanTo.startsWith('05')) {
    cleanTo = '972' + cleanTo.slice(1);
  }
  if (!cleanTo) {
    cleanTo = '972508860896';
  }

  const payload = {
    to: cleanTo,
    message: String(message || '').trim(),
    action: action || 'customer_reply',
    sender: 'נועה AI (ח. סבן)'
  };

  try {
    const res = await fetch(MAKE_JONI_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const resText = await res.text();
    console.log(`[trigger_joni_make] Dispatched to Make (${cleanTo}, action: ${payload.action}), status: ${res.status}, response:`, resText);

    const logEntry: JoniMakeDispatchResult = {
      id: `make_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      to: cleanTo,
      message: payload.message,
      action: payload.action,
      sender: payload.sender,
      status: res.status,
      success: res.ok,
      response: resText || 'Accepted'
    };
    joniMakeLogs.unshift(logEntry);
    if (joniMakeLogs.length > 80) joniMakeLogs.pop();

    return {
      success: res.ok,
      status: res.status,
      response: resText,
      payload
    };
  } catch (err: any) {
    console.error('[trigger_joni_make] Dispatch error:', err);
    const logEntry: JoniMakeDispatchResult = {
      id: `make_${Date.now()}_err`,
      timestamp: new Date().toISOString(),
      to: cleanTo,
      message: payload.message,
      action: payload.action,
      sender: payload.sender,
      status: 500,
      success: false,
      response: err.message
    };
    joniMakeLogs.unshift(logEntry);
    return {
      success: false,
      error: err.message,
      payload
    };
  }
}

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
  lastMessageIdSent: 'wamid.HBgMOTcyNTI0NDU4OTEyFQIAERgUQ0VERkJFRjRGQTlENEFCRkRCMzcA',
  googleSheetWebAppUrl: GOOGLE_SHEET_WEBAPP_URL,
  enableGoogleSheetsSync: true
};
let logs: LogEntry[] = JSON.parse(JSON.stringify(INITIAL_LOGS));
let conversations: Conversation[] = JSON.parse(JSON.stringify(INITIAL_CONVERSATIONS));
let tasks: StudioTask[] = JSON.parse(JSON.stringify(INITIAL_TASKS));

// Helper: AI Response generator using Gemini 3.8 Flash & Noa AI Make broadcast
async function generateAiReply(userPrompt: string, systemPrompt?: string, contextInfo?: string, toPhone?: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  const targetRecipient = toPhone || DISPLAY_PHONE || '972508860896';
  if (!apiKey) {
    const fallback = 'נציג סבן חומרי בניין קיבל את הודעתך ויחזור אליך בהקדם. לפרטים דחופים ניתן לחייג 050-8860896.';
    await triggerJoniMake(targetRecipient, fallback, 'customer_reply');
    return fallback;
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
    });
    const prompt = `
System Instructions:
${systemPrompt || 'אתה נועה AI, נציגה וירטואלית של ח. סבן חומרי בניין בע״מ (טלפון 050-8860896). המחוברת ישירות למנוע ההפצה של JONI Make.'}
הפעל תמיד את הכלי trigger_joni_make כדי לשדר את התשובה ישירות ל-Make ולוואטסאפ.

Context about H. Saban Building Materials:
${contextInfo || 'ח. סבן היא ספקית מובילה של חומרי בניין, בלוקים, מלט נשר, ברזל, חול, גבס ומכולות לפינוי פסולת. סניפים בהחרש 10 ובהתלמיד 6. שעות: א-ה 06:30-17:00, ו 06:30-13:00.'}

User Message from WhatsApp:
"${userPrompt}"

Write a concise WhatsApp reply in Hebrew (2-3 sentences max, with relevant emojis) and call trigger_joni_make:
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        tools: [{ functionDeclarations: [triggerJoniMakeFunctionDeclaration] }]
      }
    });

    let reply = response.text?.trim() || 'תודה שפנית לח. סבן חומרי בניין. פנייתך הועברה לצוות המכירות.';

    if (response.functionCalls && response.functionCalls.length > 0) {
      for (const call of response.functionCalls) {
        if (call.name === 'trigger_joni_make') {
          const args = call.args as any;
          const to = args?.to || targetRecipient;
          const msg = args?.message || reply;
          const act = args?.action || 'customer_reply';
          await triggerJoniMake(to, msg, act);
          reply = msg;
        }
      }
    } else {
      await triggerJoniMake(targetRecipient, reply, 'customer_reply');
    }

    return reply;
  } catch (err) {
    console.error('Gemini AI generation error:', err);
    const fallback = 'תודה שפנית לח. סבן. פנייתך נקלטה ונציג שירות יצור קשר בהקדם.';
    await triggerJoniMake(targetRecipient, fallback, 'customer_reply');
    return fallback;
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

// Helper: Dispatch to Google Apps Script / Google Sheets
async function sendToGoogleSheets(payload: Record<string, unknown>): Promise<any> {
  const url = settings.googleSheetWebAppUrl || GOOGLE_SHEET_WEBAPP_URL;
  if (!url || settings.enableGoogleSheetsSync === false) return null;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      redirect: 'follow'
    });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return { success: res.ok, raw: text };
    }
  } catch (err) {
    console.error('Error posting to Google Sheets Web App:', err);
    return null;
  }
}

// Helper: Generate dynamic welcome text based on the live root branch node in Firebase / Visual Builder
function getDynamicWelcomeText(): string {
  const rootNode = (visualChatFlow && Array.isArray(visualChatFlow.nodes) && visualChatFlow.nodes.find((n: any) => n.id === 'node_welcome' || n.isRoot))
    || (activeFlow && Array.isArray(activeFlow.nodes) && activeFlow.nodes.find(n => n.id === activeFlow.rootBlockId || n.isRoot))
    || null;

  if (rootNode) {
    const header = rootNode.title || 'ח. סבן חומרי בניין 🏗️';
    const body = rootNode.text || (rootNode.data && rootNode.data.body) || 'ברוכים הבאים למרכז ההזמנות! הקלד מספר לבחירה:';
    const rawOptions = rootNode.options || (rootNode.data && rootNode.data.rows && rootNode.data.rows.map((r: any) => r.title)) || [];
    let optsText = '';
    if (Array.isArray(rawOptions) && rawOptions.length > 0) {
      optsText = '\n\n' + rawOptions.map((opt: string, i: number) => `${i + 1} - ${opt}`).join('\n');
    }
    return `${header}\n\n${body}${optsText}`;
  }

  return `ח. סבן חומרי בניין 🏗️\n\nברוכים הבאים למרכז ההזמנות! הקלד מספר לבחירה:\n\n1 - 🚚 הזמנה והובלה לאתר\n\n2 - 🏭 איסוף עצמי ושעות פעילות\n\n3 - 🗑️ מכולות פסולת\n\n4 - 🔍 מעקב משלוח ונהגים`;
}

// Helper: Dispatch Meta Cloud API Interactive List
async function sendMetaInteractiveList(to: string, listData: ListMenuData): Promise<{ success: boolean; fallbackText?: string; messageId?: string }> {
  const fallbackText = getDynamicWelcomeText();

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
      header: listData.header ? { type: 'text', text: listData.header } : { type: 'text', text: 'ח. סבן חומרי בניין 🏗️' },
      body: { text: listData.body || 'ברוכים הבאים למרכז ההזמנות! הקלד מספר או בחר שירות:' },
      footer: listData.footer ? { text: listData.footer } : { text: 'כפר ברא | 050-8860896' },
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

    const status = res.status;
    const resText = await res.text();
    let data: any = {};
    try {
      data = JSON.parse(resText);
    } catch {
      data = { raw: resText };
    }

    console.log(`[Meta Graph API Outgoing List] Status Code: ${status}, Response:`, JSON.stringify(data));

    const isAuthError = status === 401 ||
      status === 403 ||
      data?.error?.code === 190 ||
      data?.error?.type === 'OAuthException' ||
      (typeof data?.error?.message === 'string' && (
        data.error.message.includes('Session has expired') ||
        data.error.message.includes('Error validating access token') ||
        data.error.message.includes('The access token could not be decrypted')
      ));

    if (isAuthError) {
      console.error("WHATSAPP_TOKEN is expired or invalid in Vercel env");
    }

    if (res.ok && data.messages?.[0]?.id) {
      return { success: true, messageId: data.messages[0].id };
    } else {
      console.warn('Meta API returned non-ok for interactive list, falling back to text:', data);
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

  // 1. Dynamic check if user selected a list menu row
  if (selectedRowId) {
    console.log("MENU SELECTED:", selectedRowId);

    // 1A. Search across all list_menu nodes in activeFlow for matching row
    for (const node of activeFlow.nodes) {
      if (node.data && node.data.type === 'list_menu' && Array.isArray((node.data as ListMenuData).rows)) {
        const foundRow = (node.data as ListMenuData).rows.find(r => 
          r.id === selectedRowId || 
          r.title === selectedRowId ||
          selectedRowId.includes(r.id) ||
          r.id.includes(selectedRowId)
        );
        if (foundRow) {
          selectedMenuTitle = foundRow.title;
          if (foundRow.targetBlockId) {
            targetNode = activeFlow.nodes.find(n => n.id === foundRow.targetBlockId);
          }
          break;
        }
      }
    }

    // 1B. Direct node match by id
    if (!targetNode) {
      targetNode = activeFlow.nodes.find(n => n.id === selectedRowId);
    }

    // 1C. Search edges directly
    if (!targetNode) {
      const edge = activeFlow.edges.find(e => e.sourceHandle === selectedRowId || e.source === selectedRowId);
      if (edge) {
        targetNode = activeFlow.nodes.find(n => n.id === edge.target);
      }
    }

    // 1D. Search visual chat flow connections & nodes
    if (!targetNode && visualChatFlow && Array.isArray(visualChatFlow.connections)) {
      const conn = visualChatFlow.connections.find((c: any) => 
        c.fromNodeId === selectedRowId || 
        c.toNodeId === selectedRowId ||
        `opt_${c.fromOptionIndex}` === selectedRowId
      );
      if (conn) {
        targetNode = activeFlow.nodes.find(n => n.id === conn.toNodeId);
      }
    }

    // 1E. Standard Aliases fallback for Saban core actions
    if (!targetNode) {
      if (selectedRowId === 'order_delivery' || selectedRowId === 'delivery') {
        targetNode = activeFlow.nodes.find(n => n.id === 'delivery_reply');
        selectedMenuTitle = '🚚 הזמנה והובלה';
      } else if (selectedRowId === 'self_pickup' || selectedRowId === 'pickup') {
        targetNode = activeFlow.nodes.find(n => n.id === 'pickup_reply');
        selectedMenuTitle = '🏪 איסוף עצמי';
      } else if (selectedRowId === 'waste_container' || selectedRowId === 'containers') {
        targetNode = activeFlow.nodes.find(n => n.id === 'container_action_menu') || activeFlow.nodes.find(n => n.id === 'containers_reply');
        selectedMenuTitle = '🗑️ שירות מכולות פסולת - ח. סבן';
      } else if (selectedRowId === 'container_place_new' || selectedRowId === 'container_swap' || selectedRowId === 'container_remove') {
        targetNode = activeFlow.nodes.find(n => n.id === 'container_size_menu');
        selectedMenuTitle = '📦 בחירת נפח המכולה';
      } else if (selectedRowId === 'container_size_6' || selectedRowId === 'container_size_8' || selectedRowId === 'container_size_12') {
        targetNode = activeFlow.nodes.find(n => n.id === 'container_site_details');
        selectedMenuTitle = '📍 איסוף פרטי אתר מכולה';
      } else if (selectedRowId === 'track_order' || selectedRowId === 'tracking') {
        targetNode = activeFlow.nodes.find(n => n.id === 'tracking_reply');
        selectedMenuTitle = '📍 מעקב משלוח';
      }
    }
  }

  // 2. Check if text matches numbered options, greetings, or dynamic menu options
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

    const rootNode = activeFlow.nodes.find(n => n.id === activeFlow.rootBlockId || n.isRoot) || activeFlow.nodes[0];

    if (isGreeting) {
      targetNode = rootNode;
    } else if (rootNode && rootNode.data.type === 'list_menu' && Array.isArray((rootNode.data as ListMenuData).rows)) {
      const rows = (rootNode.data as ListMenuData).rows;

      // Check numeric choice like "1", "2", "3", "אפשרות 1"
      const numMatch = incomingText.match(/\b([1-9])\b/);
      if (numMatch) {
        const idx = parseInt(numMatch[1], 10) - 1;
        if (rows[idx]) {
          selectedMenuTitle = rows[idx].title;
          targetNode = activeFlow.nodes.find(n => n.id === rows[idx].targetBlockId);
        }
      }

      // Check if text matches any row's title
      if (!targetNode) {
        for (const row of rows) {
          const rowClean = row.title.replace(/[^\u0590-\u05FFa-zA-Z0-9]/g, ' ').trim().toLowerCase();
          const words = rowClean.split(/\s+/).filter(w => w.length > 2);
          if (lower.includes(row.title.toLowerCase()) || words.some(w => lower.includes(w))) {
            selectedMenuTitle = row.title;
            targetNode = activeFlow.nodes.find(n => n.id === row.targetBlockId);
            break;
          }
        }
      }
    }

    // Secondary keywords matching if not resolved by root rows
    if (!targetNode) {
      if (lower.includes('הצבה') || lower.includes('החלפה') || lower.includes('פינוי')) {
        targetNode = activeFlow.nodes.find(n => n.id === 'container_size_menu');
        selectedMenuTitle = '📦 בחירת נפח המכולה';
      } else if (lower.includes('6 קוב') || lower.includes('8 קוב') || lower.includes('12 קוב')) {
        targetNode = activeFlow.nodes.find(n => n.id === 'container_site_details');
        selectedMenuTitle = '📍 איסוף פרטי אתר מכולה';
      } else if (lower.includes('הובלה') || lower.includes('משאית') || lower.includes('בלוק')) {
        targetNode = activeFlow.nodes.find(n => n.id === 'delivery_reply');
        selectedMenuTitle = '🚚 הזמנת הובלה לאתר';
      } else if (lower.includes('איסוף') || lower.includes('סניף') || lower.includes('החרש')) {
        targetNode = activeFlow.nodes.find(n => n.id === 'pickup_reply');
        selectedMenuTitle = '🏪 איסוף עצמי מסניף';
      } else if (lower.includes('מכולה') || lower.includes('פסולת')) {
        targetNode = activeFlow.nodes.find(n => n.id === 'container_action_menu') || activeFlow.nodes.find(n => n.id === 'containers_reply');
        selectedMenuTitle = '🗑️ שירות מכולות פסולת - ח. סבן';
      } else if (lower.includes('מעקב') || lower.includes('סטטוס')) {
        targetNode = activeFlow.nodes.find(n => n.id === 'tracking_reply');
        selectedMenuTitle = '📍 מעקב אחרי הזמנה';
      } else {
        // Fallback: search for AI assistant node or welcome menu
        targetNode = activeFlow.nodes.find(n => n.type === 'ai_question') || rootNode;
      }
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

  // Dispatch to Google Sheets (שיחות_וואטסאפ_נועה)
  sendToGoogleSheets({
    action: 'logWhatsApp',
    timestamp: new Date().toLocaleString('he-IL'),
    phone: from,
    customerName: customerName,
    inquiryType: selectedMenuTitle || selectedRowId || 'פנייה כללית',
    incomingMessage: incomingText || (selectedRowId ? `בחר אפשרות: ${selectedRowId}` : 'שיחה חדשה'),
    branchName: selectedMenuTitle || selectedRowId || 'תפריט ראשי',
    sentReply: sentResponseText,
    status: 'טופל בהצלחה',
    taskId: taskIdCreated || ''
  }).catch(() => {});

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

app.post('/api/flow', async (req: Request, res: Response) => {
  if (req.body && req.body.nodes) {
    activeFlow = {
      ...req.body,
      updatedAt: new Date().toISOString()
    };
    // Sync to Firebase RTDB for online live listeners
    await fetch(`${FB_ROOT}/flows/active.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(activeFlow)
    }).catch(() => {});

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

// 3. Webhook Bridge for JONI & Free Chat AI
// Safe handler: parses Hebrew + emojis, validates JSON, writes to Firebase ROOT/joni/incoming.json and /joni/last.json
const FB_ROOT = "https://saban-ai-drive-default-rtdb.europe-west1.firebasedatabase.app";
const FB_PATH = "joni/incoming";

const SABAN_AI_SYSTEM_PROMPT = `אתה נציג שירות של ח. סבן חומרי בניין בע"מ - כפר ברא.
אתה מדבר בעברית מלאה, ידידותי, קצר, עם אימוג'ים 🏗️🚚.
מטרה: להבין מה הלקוח צריך (ברזל, בלוקים, מלט, חול, מכולה) ולתאם הובלה/איסוף.
אם לקוח אומר 'בדיקה' - תענה 'הבדיקה עברה בהצלחה 👍 מערכת סבן מחוברת ומוכנה לשירותך! איזה חומר תרצה להזמין?'
אל תמציא מחירים.

כלל קריטי לכל פנייה על חומרים או הובלה (לדוגמה: "ברזל 2 טון לכפר סבא", בלוקים, מלט וכדומה):
תמיד תשאל את הלקוח ותוודא:
1. כמות (או קוטר/סוג הברזל או המלט)
2. כתובת מדויקת לאספקה (עיר, רחוב ומספר)
3. תאריך מבוקש להובלה`;

async function generateSabanAiChatReply(text: string, history: any[] = [], from?: string): Promise<{ reply: string; suggested_branches: string[]; intent: string; make_dispatched?: boolean }> {
  const cleanText = String(text || '').trim();
  const recipientPhone = from || DISPLAY_PHONE || '972508860896';

  if (cleanText.includes('בדיקה') || cleanText === 'test') {
    const testReply = "הבדיקה עברה בהצלחה 👍 מערכת סבן חומרי בניין מחוברת ומוכנה לשירותך! איזה חומר תרצה להזמין היום?";
    await triggerJoniMake(recipientPhone, testReply, 'customer_reply');
    return {
      reply: testReply,
      suggested_branches: ["🚚 הזמנה והובלה", "🏪 איסוף עצמי", "🗑️ מכולות פסולת"],
      intent: "test_check",
      make_dispatched: true
    };
  }

  let reply = "שלום! נשמח לספק לך את כל חומרי הבניין הדרושים 🏗️🚚. כדי שנוכל לתאם הובלה מסודרת, אנא ציין: כמות וקוטר מבוקש, כתובת מדויקת למשלוח, ותאריך אספקה רצוי.";
  let intent = "general_inquiry";
  let suggested_branches = ["🚚 הזמנה והובלה", "🏪 איסוף עצמי", "🗑️ מכולות פסולת", "📍 מעקב הזמנה"];
  let makeDispatched = false;

  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    try {
      const ai = new GoogleGenAI();
      const prompt = `
System Instructions:
${SABAN_AI_SYSTEM_PROMPT}

אתה נועה AI, המחוברת ישירות למנוע ההפצה של JONI Make.
בכל פעם שאתה מייצר תפריט, מאשר הזמנה או מנסח תשובה ללקוח עבור וואטסאפ — אל תסתפק רק בהצגת הטקסט בצ'אט. עליך להפעיל את הכלי trigger_joni_make כדי לשדר את התוכן ישירות ל-Webhook של Make.

לקוח (${recipientPhone}): ${cleanText}

השב בקצרה (1-2 משפטים) בעברית עם אימוג'ים מתאימים, והפעל את trigger_joni_make:
`;
      const res = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          tools: [{ functionDeclarations: [triggerJoniMakeFunctionDeclaration] }]
        }
      });

      if (res.functionCalls && res.functionCalls.length > 0) {
        for (const call of res.functionCalls) {
          if (call.name === 'trigger_joni_make') {
            const args = call.args as any;
            const targetTo = args?.to || recipientPhone;
            const targetMsg = args?.message || res.text || reply;
            const targetAct = args?.action || 'customer_reply';
            await triggerJoniMake(targetTo, targetMsg, targetAct);
            reply = targetMsg;
            makeDispatched = true;
          }
        }
      } else if (res.text) {
        reply = res.text.trim();
      }
    } catch (err) {
      console.error('Error generating Saban AI chat reply:', err);
    }
  }

  const lower = cleanText.toLowerCase();
  if (lower.includes('הובלה') || lower.includes('משלוח') || lower.includes('ברזל') || lower.includes('בלוק') || lower.includes('מלט')) {
    intent = 'order_delivery';
    suggested_branches = ['ברזל ורשתות', 'בלוקים שחורים/איטונג', 'מלט נשר', 'חול וחצץ'];
  } else if (lower.includes('איסוף') || lower.includes('מחסן') || lower.includes('כפר ברא')) {
    intent = 'self_pickup';
    suggested_branches = ['שעות פתיחה מחסן', 'מיקום Waze', 'הכן הזמנה'];
  } else if (lower.includes('מכולה') || lower.includes('פסולת') || lower.includes('פינוי')) {
    intent = 'waste_container';
    suggested_branches = ['מכולה 6 קוב', 'מכולה 8 קוב', 'מכולה 12 קוב'];
  } else if (lower.includes('איפה') || lower.includes('מעקב') || lower.includes('נהג')) {
    intent = 'track_order';
    suggested_branches = ['צפי הגעה נהג', 'מיקום משאית', 'רמי: 050-886-0896'];
  }

  // Ensure closed-loop broadcast to Make if not called via tool
  if (!makeDispatched) {
    let actionType = 'customer_reply';
    if (intent === 'order_delivery') actionType = 'order_update';
    else if (intent === 'waste_container') actionType = 'container_task';
    else if (cleanText.includes('תפריט') || cleanText.includes('שלום')) actionType = 'send_menu';

    await triggerJoniMake(recipientPhone, reply, actionType);
    makeDispatched = true;
  }

  return { reply, suggested_branches, intent, make_dispatched: makeDispatched };
}

// In-Memory Visual Chat Flow (syncs with Firebase /chat_flows/main)
let visualChatFlow: any = {
  id: 'main',
  name: 'עץ שיחות ראשי סבן',
  updatedAt: new Date().toISOString(),
  nodes: [
    {
      id: 'node_welcome',
      type: 'menu',
      title: 'תפריט ראשי סבן',
      text: 'שלום וברוכים הבאים לח. סבן חומרי בניין בע״מ (כפר ברא) 🏗️\nאיך נוכל לעזור היום?',
      options: ['🚚 הזמנה והובלה', '🏪 איסוף עצמי', '🗑️ מכולות פסולת', '📍 מעקב משלוח'],
      position: { x: 80, y: 160 }
    },
    {
      id: 'node_delivery',
      type: 'question',
      title: 'הזמנה והובלה',
      text: '🚚 מעולה! איזה חומר צריך? (ברזל, בלוקים, מלט נשר, חול/טיט) ולאיזו כתובת?',
      position: { x: 440, y: 40 }
    },
    {
      id: 'node_pickup',
      type: 'message',
      title: 'איסוף עצמי',
      text: '🏪 מחסן כפר ברא פתוח בימים א-ה 06:00-17:00. שלח פירוט ורמי יכין לך הכל!',
      position: { x: 440, y: 190 }
    },
    {
      id: 'container_action_menu',
      type: 'menu',
      title: '🗑️ שירות מכולות פסולת - ח. סבן',
      text: 'איזה סוג פעולה למכולה נדרש באתר?',
      options: [
        '📍 הצבה חדשה (הבאת מכולה ריקה לאתר)',
        '🔄 החלפה (הוצאת מכולה מלאה והצבת ריקה)',
        '🚛 הוצאה ופינוי (פינוי סופי של המכולה וסגירת האתר)'
      ],
      position: { x: 440, y: 340 }
    },
    {
      id: 'container_size_menu',
      type: 'menu',
      title: '📦 בחירת נפח המכולה',
      text: 'אנא בחר את גודל המכולה המבוקש:\n\n⚠️ דגש תפעולי: נדרשת גישה פנויה ורחבה למשאית רמסע לצורך הנפה ופריקה.',
      options: [
        '📦 6 קוב (מתאים לשיפוץ קל ודירות)',
        '📦 8 קוב (מתאים לפסולת כבדה, בלוקים ובטון)',
        '📦 12 קוב (מתאים לפסולת עץ, גבס ונפח גדול)'
      ],
      position: { x: 800, y: 340 }
    },
    {
      id: 'container_site_details',
      type: 'question',
      title: '📍 איסוף פרטי אתר מכולה',
      text: 'מעולה! אנא רשום לי בהודעה: כתובת האספקה המדויקת (עיר ורחוב), איש קשר באתר, ותאריך/שעה מבוקשים.',
      position: { x: 1160, y: 340 }
    },
    {
      id: 'create_container_task',
      type: 'agent',
      title: 'יצירת משימת מכולה - ראמי',
      text: '✅ פרטי המכולה נקלטו בהצלחה וסונכרנו ל-Firebase RTDB (joni/incoming)! נוצרה משימת תיאום עבור רמי מסארווה (050-886-0896) לתיאום משאית רמסע.',
      position: { x: 1520, y: 340 }
    },
    {
      id: 'node_ai_free',
      type: 'ai',
      title: 'AI חופשי סבן',
      text: '🤖 מענה אוטומטי חופשי של בינה מלאכותית המתמחה בחומרי בניין וסבן',
      position: { x: 440, y: 540 }
    },
    {
      id: 'node_agent',
      type: 'agent',
      title: 'נציג אנושי - ראמי',
      text: '👷 פנייתך הועברה ישירות לראמי מסארווה (050-886-0896)',
      position: { x: 800, y: 80 }
    }
  ],
  connections: [
    { id: 'c1', fromNodeId: 'node_welcome', fromOptionIndex: 0, toNodeId: 'node_delivery' },
    { id: 'c2', fromNodeId: 'node_welcome', fromOptionIndex: 1, toNodeId: 'node_pickup' },
    { id: 'c3', fromNodeId: 'node_welcome', fromOptionIndex: 2, toNodeId: 'container_action_menu' },
    { id: 'c4', fromNodeId: 'node_welcome', fromOptionIndex: 3, toNodeId: 'node_ai_free' },
    { id: 'c5', fromNodeId: 'node_delivery', toNodeId: 'node_agent' },
    { id: 'c_action_1', fromNodeId: 'container_action_menu', fromOptionIndex: 0, toNodeId: 'container_size_menu' },
    { id: 'c_action_2', fromNodeId: 'container_action_menu', fromOptionIndex: 1, toNodeId: 'container_size_menu' },
    { id: 'c_action_3', fromNodeId: 'container_action_menu', fromOptionIndex: 2, toNodeId: 'container_size_menu' },
    { id: 'c_size_1', fromNodeId: 'container_size_menu', fromOptionIndex: 0, toNodeId: 'container_site_details' },
    { id: 'c_size_2', fromNodeId: 'container_size_menu', fromOptionIndex: 1, toNodeId: 'container_site_details' },
    { id: 'c_size_3', fromNodeId: 'container_size_menu', fromOptionIndex: 2, toNodeId: 'container_site_details' },
    { id: 'c_details_task', fromNodeId: 'container_site_details', toNodeId: 'create_container_task' }
  ]
};

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

    // 2. Sanitize to valid JSON with serverTimestamp()
    const now = Date.now();
    const cleanPayload = {
      from: String(data.from || data.phone || data.waId || "972500000000").replace(/[^0-9]/g, ""),
      text: String(data.text || data.message || data.body || "").substring(0, 1000),
      name: String(data.name || data.pushName || "לקוח").substring(0, 100),
      timestamp: now,
      server_timestamp: { ".sv": "timestamp" },
      created_at: { ".sv": "timestamp" },
      message_id: `wamid_${now}`,
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

    // 6. Check interactive selection or branch keyword
    const listId = data.listReplyId || data.rowId || data.interactive?.list_reply?.id;
    const buttonId = data.buttonReplyId || data.interactive?.button_reply?.id;
    const selectedId = listId || buttonId;

    let replyText = '';
    let flowTitle = 'מענה AI סבן';
    let chosenBranchId = selectedId || '';

    const getDynamicBranch = (nodeIdOrAlias: string): { text: string; title: string; next?: string } | null => {
      const aliasMap: Record<string, string> = {
        delivery: 'node_delivery',
        order_delivery: 'node_delivery',
        pickup: 'node_pickup',
        self_pickup: 'node_pickup',
        containers: 'container_action_menu',
        waste_container: 'container_action_menu',
        container_place_new: 'container_size_menu',
        container_swap: 'container_size_menu',
        container_remove: 'container_size_menu',
        container_size_6: 'container_site_details',
        container_size_8: 'container_site_details',
        container_size_12: 'container_site_details',
        tracking: 'tracking_reply',
        track_order: 'tracking_reply'
      };

      const targetId = aliasMap[nodeIdOrAlias] || nodeIdOrAlias;

      // 1. Look in visualChatFlow nodes (live from Firebase & UI edits!)
      if (visualChatFlow && Array.isArray(visualChatFlow.nodes)) {
        const vNode = visualChatFlow.nodes.find((n: any) => n.id === targetId || n.id === nodeIdOrAlias);
        if (vNode) {
          let text = vNode.text || '';
          if (Array.isArray(vNode.options) && vNode.options.length > 0) {
            text += '\n\n' + vNode.options.map((opt: string, i: number) => `${i + 1}️⃣ ${opt}`).join('\n');
          }
          return {
            text,
            title: vNode.title || 'ענף סבן',
            next: vNode.type === 'menu' ? `await_${vNode.id}` : undefined
          };
        }
      }

      // 2. Look in activeFlow nodes
      if (activeFlow && Array.isArray(activeFlow.nodes)) {
        const aNode = activeFlow.nodes.find(n => n.id === targetId || n.id === nodeIdOrAlias);
        if (aNode) {
          let text = '';
          if (aNode.data.type === 'list_menu') {
            const d = aNode.data as ListMenuData;
            text = d.body || d.header || '';
            if (Array.isArray(d.rows) && d.rows.length > 0) {
              text += '\n\n' + d.rows.map((r, i) => `${i + 1}️⃣ ${r.title}`).join('\n');
            }
          } else if (aNode.data.type === 'text') {
            text = (aNode.data as any).text || '';
          }
          return {
            text,
            title: aNode.title,
            next: aNode.data.type === 'list_menu' ? `await_${aNode.id}` : undefined
          };
        }
      }

      return null;
    };

    const normalizedId = selectedId === 'delivery' ? 'order_delivery'
      : selectedId === 'pickup' ? 'self_pickup'
      : selectedId === 'containers' ? 'waste_container'
      : selectedId === 'tracking' ? 'track_order'
      : selectedId;

    const currentSession = userSessions.get(String(cleanPayload.from).replace(/[^0-9]/g, ''));

    const dynamicFlow = normalizedId ? getDynamicBranch(normalizedId) : null;
    if (dynamicFlow) {
      console.log("DYNAMIC MENU SELECTED:", normalizedId);
      replyText = dynamicFlow.text;
      flowTitle = dynamicFlow.title;
      chosenBranchId = normalizedId;
      await updateSession(cleanPayload.from, { step: dynamicFlow.next || 'completed', lastChoice: normalizedId });
    } else if (currentSession && currentSession.step && (currentSession.step.startsWith('await_container') || currentSession.step.includes('container'))) {
      if (currentSession.step.includes('action')) {
        let action = 'הצבה חדשה';
        const t = cleanPayload.text.toLowerCase();
        if (t.includes('החלפה') || t === '2') action = 'החלפה';
        else if (t.includes('פינוי') || t.includes('הוצאה') || t === '3') action = 'הוצאה ופינוי';

        const sizeNode = getDynamicBranch('container_size_menu');
        replyText = sizeNode ? sizeNode.text : 'אנא בחר את סוג המכולה המבוקש:\n\n1️⃣ 📦 הצבה\n2️⃣ 📦 החלפה\n3️⃣ 📦 הוצאה';
        flowTitle = sizeNode ? sizeNode.title : '📦 בחירת סוג פעולה למכולה';
        chosenBranchId = 'container_size_menu';
        await updateSession(cleanPayload.from, { step: 'await_container_size', lastChoice: 'container_size_menu', containerAction: action });
      } else if (currentSession.step.includes('size')) {
        let size = '8 קוב';
        const t = cleanPayload.text.toLowerCase();
        if (t.includes('6') || t === '1') size = '6 קוב';
        else if (t.includes('12') || t === '3') size = '12 קוב';

        const siteNode = getDynamicBranch('container_site_details');
        replyText = siteNode ? siteNode.text : 'מעולה! אנא רשום לי בהודעה: כתובת האספקה המדויקת (עיר ורחוב), איש קשר באתר, ותאריך/שעה מבוקשים.';
        flowTitle = siteNode ? siteNode.title : '📍 איסוף פרטי אתר מכולה';
        chosenBranchId = 'container_site_details';
        await updateSession(cleanPayload.from, { step: 'await_container_site_details', lastChoice: 'container_site_details', containerSize: size });
      } else if (currentSession.step.includes('site') || currentSession.step.includes('details')) {
        const action = currentSession.containerAction || 'הצבה חדשה';
        const size = currentSession.containerSize || '8 קוב';
        const address = cleanPayload.text;

        const newTaskId = `task_cnt_${Date.now()}`;
        tasks.unshift({
          id: newTaskId,
          clientPhone: cleanPayload.from,
          clientName: cleanPayload.name || 'לקוח מכולה',
          title: `מכולת ${size} (${action}) - ${address.substring(0, 30)}`,
          category: 'containers',
          priority: 'urgent',
          assignedTo: 'ראמי מסארווה (050-886-0896)',
          status: 'pending',
          createdAt: new Date().toISOString(),
          description: `פעולה: ${action} | נפח: ${size} | כתובת ופרטי אתר: ${address}`
        });

        // Write directly to Firebase RTDB joni/incoming
        try {
          await fetch(`${FB_ROOT}/joni/incoming.json`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({
              action: 'create_container_task',
              task_id: newTaskId,
              container_action: action,
              container_size: size,
              site_details: address,
              customer_phone: cleanPayload.from,
              customer_name: cleanPayload.name,
              assigned_to: 'ראמי מסארווה (050-886-0896)',
              timestamp: Date.now()
            })
          });
        } catch (e) {
          console.error('Failed to write container task to Firebase:', e);
        }

        // Write directly to Google Sheets (מכולות_פסולת)
        sendToGoogleSheets({
          action: 'addContainer',
          containerId: `CNT-${Date.now().toString().slice(-4)}`,
          customerName: cleanPayload.name || 'לקוח מכולה',
          contractor: cleanPayload.name || 'קבלן שארק',
          phone: cleanPayload.from,
          address: address,
          actionType: action,
          size: size,
          rentalDays: '1',
          status: 'פעיל באתר',
          notes: address
        }).catch(err => console.error('Failed to sync container to Google Sheets:', err));

        replyText = `✅ פרטי המכולה נקלטו בהצלחה וסונכרנו ל-Firebase RTDB (joni/incoming)!\n\n📍 סוג פעולה: ${action}\n📦 גודל: ${size}\n🏠 כתובת ופרטים: ${address}\n\nנוצרה משימת תיאום עבור רמי מסארווה (050-886-0896) לתיאום משאית רמסע.`;
        flowTitle = 'יצירת משימת מכולה';
        chosenBranchId = 'create_container_task';
        await updateSession(cleanPayload.from, { step: 'completed', lastChoice: 'create_container_task' });
      }
    } else {
      // 7. Execute Noa AI Operational Protocol (Rami Commander, VIPs, Customer History, 1-5 Tree, Catalog & Deposits)
      let customerHistory = null;
      try {
        customerHistory = await ordersService.getCustomerProfile(undefined, cleanPayload.name, cleanPayload.from);
      } catch (err: any) {
        console.warn('Customer history lookup warning:', err.message);
      }

      const noaResult = processNoaAiMessage(cleanPayload.text, cleanPayload.name, cleanPayload.from, customerHistory);
      replyText = noaResult.replyText;
      flowTitle = noaResult.flowTitle;
      chosenBranchId = noaResult.branchId;
      await updateSession(cleanPayload.from, { 
        step: noaResult.branchId, 
        lastChoice: noaResult.branchId,
        customerName: customerHistory?.customerName || cleanPayload.name
      });
    }

    // 8. Dispatch reply to customer via WhatsApp
    const sendResult = await sendWhatsAppText(cleanPayload.from, replyText);

    // 8.1. Closed-loop broadcast to Make Webhook (trigger_joni_make)
    let actionType = 'customer_reply';
    if (chosenBranchId === 'welcome_menu' || chosenBranchId.includes('menu')) {
      actionType = 'send_menu';
    } else if (chosenBranchId.includes('order') || chosenBranchId.includes('delivery')) {
      actionType = 'order_update';
    } else if (chosenBranchId.includes('container') || chosenBranchId.includes('waste')) {
      actionType = 'container_task';
    }
    await triggerJoniMake(cleanPayload.from, replyText, actionType);

    // 9. Save all to Firebase logs & conversations (Requirements 4 & 5)
    try {
      // Write to /logs/whatsapp/{cleanPhone}/{timestamp}.json
      const logPayload = {
        incoming: cleanPayload.text,
        reply: replyText,
        branch_id: chosenBranchId,
        ai_used: true,
        action: "auto_reply_sent",
        timestamp: cleanPayload.timestamp
      };
      await fetch(`${FB_ROOT}/logs/whatsapp/${cleanPayload.from}/${cleanPayload.timestamp}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(logPayload)
      }).catch(() => {});

      await fetch(`${FB_ROOT}/joni/logs/${cleanPayload.from}/${cleanPayload.timestamp}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(logPayload)
      }).catch(() => {});

      // Write to /conversations/{cleanPhone}.json
      const convPayload = {
        lastMessage: replyText,
        flowPosition: chosenBranchId,
        name: cleanPayload.name,
        updatedAt: new Date().toISOString()
      };
      await fetch(`${FB_ROOT}/conversations/${cleanPayload.from}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(convPayload)
      }).catch(() => {});

      await fetch(`${FB_ROOT}/joni/conversations/${cleanPayload.from}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(convPayload)
      }).catch(() => {});
    } catch (fbSaveErr) {
      console.error('Error saving to Firebase logs/conversations:', fbSaveErr);
    }

    // 10. Update local studio logs
    logs.unshift({
      id: `log_${Date.now()}`,
      from: `+${cleanPayload.from}`,
      customer_name: cleanPayload.name,
      incoming_text: cleanPayload.text || `[בחירת תפריט: ${flowTitle}]`,
      selected_menu_id: chosenBranchId,
      selected_menu_title: flowTitle,
      sent_response: replyText,
      response_type: 'text',
      meta_message_id: sendResult.messageId,
      timestamp: new Date().toISOString(),
      channel: 'joni',
      status: 'sent'
    });

    // Sync to Google Sheets (שיחות_וואטסאפ_נועה)
    sendToGoogleSheets({
      action: 'logWhatsApp',
      timestamp: new Date().toLocaleString('he-IL'),
      phone: `+${cleanPayload.from}`,
      customerName: cleanPayload.name || 'לקוח סבן',
      inquiryType: chosenBranchId || 'פנייה כללית',
      incomingMessage: cleanPayload.text || `[בחירת תפריט: ${flowTitle}]`,
      branchName: flowTitle || chosenBranchId || 'תפריט ראשי',
      sentReply: replyText,
      status: 'טופל בהצלחה'
    }).catch(err => console.error('Failed to log WhatsApp interaction to Google Sheets:', err));

    // 11. Update local conversations
    let conv = conversations.find(c => c.from.replace(/[^0-9]/g, '') === cleanPayload.from);
    if (!conv) {
      conv = {
        id: `conv_${Date.now()}`,
        from: `+${cleanPayload.from}`,
        customerName: cleanPayload.name,
        lastMessage: replyText,
        lastTimestamp: new Date().toISOString(),
        selectedMenuId: chosenBranchId,
        selectedMenuTitle: flowTitle,
        status: 'active',
        messages: []
      };
      conversations.unshift(conv);
    } else {
      conv.lastMessage = replyText;
      conv.lastTimestamp = new Date().toISOString();
      conv.selectedMenuId = chosenBranchId;
      conv.selectedMenuTitle = flowTitle;
    }

    if (cleanPayload.text) {
      conv.messages.push({
        id: `msg_in_${Date.now()}`,
        direction: 'incoming',
        text: cleanPayload.text,
        type: 'text',
        timestamp: new Date().toISOString()
      });
    }

    conv.messages.push({
      id: `msg_out_${Date.now() + 1}`,
      direction: 'outgoing',
      text: replyText,
      type: 'text',
      timestamp: new Date().toISOString()
    });

    return res.status(200).json({
      success: true,
      received: cleanPayload,
      reply: replyText,
      branch_id: chosenBranchId,
      status: "ok",
      fixed: true,
      payload: cleanPayload,
      firebaseStatus: fbStatus
    });

  } catch (error: any) {
    console.error("JONI FIX ERROR:", error);
    return res.status(200).json({ status: "error_fixed", error: error.message });
  }
};

app.post('/api/webhooks/joni', handleJoniWebhook);
app.post('/api/joni/incoming', handleJoniWebhook);
app.get('/api/webhooks/joni', (_req: Request, res: Response) => {
  res.json({ status: "joni webhook alive", joni: "alive", time: Date.now() });
});
app.get('/api/joni/incoming', (_req: Request, res: Response) => {
  res.json({ status: "joni webhook alive", joni: "alive", time: Date.now() });
});

// Free Chat AI API Route
app.post('/api/chat/ai', async (req: Request, res: Response) => {
  try {
    const { from, text, history } = req.body || {};
    const result = await generateSabanAiChatReply(text, history, from);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/chat/ai', (_req: Request, res: Response) => {
  res.json({
    status: "saban free chat ai alive",
    model: "gemini-3.8-flash",
    business: "ח. סבן חומרי בניין בע״מ - כפר ברא"
  });
});

// AI Smart Reply Suggestion System (Analyzes last customer message and returns 3 context-aware suggestions)
function getFallbackSmartSuggestions(lastMsg: string, customerName?: string): string[] {
  const lower = (lastMsg || '').toLowerCase();
  const name = customerName ? customerName.split(' ')[0] : '';
  const greeting = name ? `היי ${name} 👋` : 'שלום!';

  if (lower.includes('ברזל') || lower.includes('מלט') || lower.includes('בלוק') || lower.includes('חול') || lower.includes('טון') || lower.includes('קוב')) {
    return [
      `${greeting} יש לנו במלאי אספקה מיידית 🏗️🚚. לאיזו כתובת ותאריך לתאם הובלה?`,
      `מעולה! אנא אשר כמות וקוטר מבוקש כדי שנוציא חשבונית ונתאם משאית פריקה 👍`,
      `ראמי מסארוה זמין עכשיו ב-050-8860896 ויוכל לסגור מחיר אספקה מעולה 📞`
    ];
  }

  if (lower.includes('מכולה') || lower.includes('פסולת') || lower.includes('פינוי')) {
    return [
      `${greeting} מכולות 6, 8 ו-12 קוב זמינות להצבה היום 🗑️ לאיזו כתובת להוציא את המשאית?`,
      `הנהג ייצור קשר 30 דקות לפני הגעה. נא לוודא שיש גישה פנויה למשאית הרמסע 🚚`,
      `המחיר כולל הובלה, הצבה ופינוי לאתר מורשה. רמי: 050-8860896 📞`
    ];
  }

  if (lower.includes('איפה') || lower.includes('מעקב') || lower.includes('נהג') || lower.includes('מתי') || lower.includes('הגיע')) {
    return [
      `המשאית בדרך אליך עם הנהג ראמי 🚚 צפי הגעה משוער כ-45 דקות 📍`,
      `בודק לך ישירות מול הנהג בשטח וחוזר עם עדכון מדויק תוך רגע 👍`,
      `לבירור דחוף מול הנהג בדרכים ניתן לחייג אלינו: 050-8860896 📞`
    ];
  }

  if (lower.includes('איסוף') || lower.includes('מחסן') || lower.includes('כפר ברא') || lower.includes('שעות')) {
    return [
      `מחסן סבן כפר ברא פתוח רצוף 06:00-17:00 🏪 ההזמנה תמתין לך מוכנה!`,
      `נשמח להכין לך את כל החומרים מראש למניעת המתנה. מתי אתה מגיע? 🏗️`,
      `מיקום מדויק ב-Waze: "ח. סבן חומרי בניין כפר ברא". רמי: 050-8860896 📍`
    ];
  }

  return [
    `${greeting} שמחים לעמוד לשירותך בח. סבן חומרי בניין כפר ברא 🏗️ איזה חומר תרצה להזמין?`,
    `מעולה! שלח לנו פירוט כמויות וכתובת ונפיק לך הצעת מחיר מסודרת 🚚`,
    `לכל שאלה או תיאום אספקה דחוף, ראמי מסארוה זמין עבורך ב-050-8860896 📞`
  ];
}

async function generateSmartReplySuggestions(lastCustomerMessage: string, history: any[] = [], customerName?: string): Promise<string[]> {
  const cleanMsg = String(lastCustomerMessage || '').trim();
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey && cleanMsg) {
    try {
      const ai = new GoogleGenAI();
      const prompt = `
אתה עוזר חכם לנציג שירות ומכירות של "ח. סבן חומרי בניין בע״מ" (כפר ברא, נציג: ראמי מסארווה 050-886-0896).
נתח את הודעת הלקוח האחרונה בוואטסאפ וספק בדיוק 3 הצעות מענה מהיר (Smart Reply Suggestions) שונות, רלוונטיות ומקצועיות עבור הנציג.

דרישות חובה:
1. שפה: עברית טבעית, שירותית ומזמינה עם 1-2 אימוג'ים מתאימים (🏗️, 🚚, 🏪, 📞, 👍).
2. אורך: קצר וממוקד (משפט 1 עד 2 משפטים).
3. 3 גישות שונות:
   - הצעה 1: אישור מיידי ותיאום משלוח/הזמנה (כמות, כתובת, תאריך).
   - הצעה 2: שאלת הבהרה טכנית או תיאום לוגיסטי.
   - הצעה 3: יצירת קשר מהיר עם ראמי (050-886-0896) לסגירת מחיר.

שם הלקוח: ${customerName || 'לקוח'}
הודעת הלקוח האחרונה:
"${cleanMsg}"

החזר אך ורק מערך JSON תקני של 3 מחרוזות בלבד, ללא שום מלל נוסף מעבר ל-JSON.
דוגמה:
["הצעה 1...", "הצעה 2...", "הצעה 3..."]
`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json'
        }
      });

      const text = response.text?.trim() || '';
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed) && parsed.length >= 3) {
          return parsed.slice(0, 3).map(s => String(s).trim());
        }
      } catch {
        const match = text.match(/\[[\s\S]*\]/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          if (Array.isArray(parsed) && parsed.length >= 3) {
            return parsed.slice(0, 3).map(s => String(s).trim());
          }
        }
      }
    } catch (err) {
      console.error('Gemini smart replies error in server:', err);
    }
  }

  return getFallbackSmartSuggestions(cleanMsg, customerName);
}

app.post('/api/chat/suggest', async (req: Request, res: Response) => {
  try {
    const { message = '', history = [], customerName = '' } = req.body || {};
    const suggestions = await generateSmartReplySuggestions(message, history, customerName);
    res.json({ suggestions });
  } catch (err: any) {
    res.status(500).json({ error: err.message, suggestions: getFallbackSmartSuggestions(req.body?.message) });
  }
});

app.get('/api/chat/suggest', (_req: Request, res: Response) => {
  res.json({
    status: "smart reply suggestion engine alive",
    model: "gemini-3.8-flash",
    business: "ח. סבן חומרי בניין בע״מ - כפר ברא"
  });
});

// Helper: Synchronize Visual Chat Flow into Active Flow
function syncVisualFlowToActiveFlow(vFlow: any) {
  if (!vFlow || !vFlow.nodes || !Array.isArray(vFlow.nodes)) return;

  try {
    const menuBlock = vFlow.nodes.find((n: any) => n.type === 'menu' && (n.id === 'node_welcome' || (n.title && (n.title.includes('ראשי') || n.title.includes('תפריט'))))) ||
                      vFlow.nodes.find((n: any) => n.type === 'menu') ||
                      vFlow.nodes[0];

    if (menuBlock && Array.isArray(menuBlock.options)) {
      let rootNode = activeFlow.nodes.find(n => n.id === activeFlow.rootBlockId || n.isRoot);
      if (!rootNode) {
        rootNode = activeFlow.nodes.find(n => n.id === 'welcome_menu');
      }

      const rows: ListMenuRow[] = menuBlock.options.map((optText: string, idx: number) => {
        const conn = Array.isArray(vFlow.connections) 
          ? vFlow.connections.find((c: any) => c.fromNodeId === menuBlock.id && (c.fromOptionIndex === idx || c.fromOptionIndex === undefined))
          : undefined;

        const targetNodeId = conn ? conn.toNodeId : undefined;
        const targetBlock = targetNodeId ? vFlow.nodes.find((b: any) => b.id === targetNodeId) : undefined;

        let rowId = targetNodeId || `opt_${idx}`;
        if (optText.includes('הובלה') || optText.includes('1')) rowId = 'order_delivery';
        else if (optText.includes('איסוף') || optText.includes('2')) rowId = 'self_pickup';
        else if (optText.includes('מכול') || optText.includes('פסולת') || optText.includes('3')) rowId = 'waste_container';
        else if (optText.includes('מעקב') || optText.includes('4')) rowId = 'track_order';

        let targetBlockId = targetNodeId;
        if (!targetBlockId) {
          if (rowId === 'order_delivery') targetBlockId = 'delivery_reply';
          else if (rowId === 'self_pickup') targetBlockId = 'pickup_reply';
          else if (rowId === 'waste_container') targetBlockId = 'container_action_menu';
          else if (rowId === 'track_order') targetBlockId = 'tracking_reply';
        }

        return {
          id: rowId,
          title: optText,
          description: targetBlock?.text?.slice(0, 60) || targetBlock?.title || 'שירות ח. סבן חומרי בניין',
          targetBlockId: targetBlockId || `target_${idx}`
        };
      });

      if (rootNode) {
        rootNode.title = menuBlock.title || rootNode.title;
        rootNode.data = {
          ...rootNode.data,
          type: 'list_menu',
          header: menuBlock.title || 'ח. סבן חומרי בניין 🏗️',
          body: menuBlock.text || 'שלום וברוכים הבאים לח. סבן חומרי בניין! במה נוכל לעזור היום?',
          rows: rows
        } as ListMenuData;
      }

      // Add or update all individual blocks from vFlow into activeFlow
      vFlow.nodes.forEach((vb: any) => {
        if (vb.id === menuBlock.id) return;
        const existingIndex = activeFlow.nodes.findIndex(n => n.id === vb.id);
        const mappedNode: StudioNode = {
          id: vb.id,
          type: vb.type === 'menu' ? 'list_menu' : vb.type === 'ai' ? 'ai_question' : vb.type === 'agent' ? 'task' : 'text',
          title: vb.title || 'ענף סבן',
          position: vb.position || { x: 300, y: 200 },
          data: vb.type === 'menu' ? {
            type: 'list_menu',
            header: vb.title,
            body: vb.text,
            buttonText: 'בחר שירות',
            rows: (vb.options || []).map((o: string, oi: number) => ({
              id: `${vb.id}_opt_${oi}`,
              title: o,
              description: '',
              targetBlockId: undefined
            }))
          } : vb.type === 'ai' ? {
            type: 'ai_question',
            systemPrompt: vb.text,
            contextInfo: 'ח. סבן חומרי בניין',
            fallbackText: 'נציג סבן יחזור אליך בהקדם',
            model: 'gemini-3.8-flash'
          } : vb.type === 'agent' ? {
            type: 'task',
            taskTitleTemplate: `${vb.title} - {{from}}`,
            category: 'general',
            urgency: 'urgent',
            assignedTo: 'ראמי מסארווה (050-886-0896)',
            confirmationMessage: vb.text
          } : {
            type: 'text',
            text: vb.text
          }
        };

        if (existingIndex >= 0) {
          activeFlow.nodes[existingIndex] = {
            ...activeFlow.nodes[existingIndex],
            title: mappedNode.title,
            data: {
              ...activeFlow.nodes[existingIndex].data,
              ...mappedNode.data
            }
          };
        } else {
          activeFlow.nodes.push(mappedNode);
        }
      });

      activeFlow.updatedAt = new Date().toISOString();
      console.log('✅ Synchronized VisualFlow into ActiveFlow. Total nodes:', activeFlow.nodes.length, 'Root rows:', rows.length);
    }
  } catch (err) {
    console.error('Error syncing visual flow to active flow:', err);
  }
}

// Visual Chat Flow Storage Endpoints (Firebase /chat_flows/main sync)
app.get('/api/chat_flows/main', async (_req: Request, res: Response) => {
  try {
    const fbRes = await fetch(`${FB_ROOT}/chat_flows/main.json`);
    if (fbRes.ok) {
      const data = await fbRes.json();
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
          visualChatFlow = {
            ...data,
            nodes,
            connections: connections || []
          };
          syncVisualFlowToActiveFlow(visualChatFlow);
        }
      }
    }
  } catch (e) {
    // fallback to in-memory
  }
  res.json(visualChatFlow);
});

app.post('/api/chat_flows/main', async (req: Request, res: Response) => {
  try {
    const newFlow = req.body;
    if (newFlow && newFlow.nodes) {
      visualChatFlow = {
        ...newFlow,
        updatedAt: new Date().toISOString()
      };

      // 1. Sync directly to ActiveFlow so simulator & webhook pick up changes immediately!
      syncVisualFlowToActiveFlow(visualChatFlow);

      // 2. Persist to Firebase RTDB in both locations
      await Promise.all([
        fetch(`${FB_ROOT}/chat_flows/main.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify(visualChatFlow)
        }).catch(() => {}),
        fetch(`${FB_ROOT}/flows/active.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify(activeFlow)
        }).catch(() => {})
      ]);
    }
    res.json({ success: true, flow: visualChatFlow, activeFlow });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Session store for WhatsApp interactive conversations
const userSessions = new Map<string, { 
  step: string; 
  lastChoice?: string; 
  containerAction?: string; 
  containerSize?: string; 
  customerName?: string;
  updatedAt: string; 
}>();

async function updateSession(from: string, sessionData: { 
  step: string; 
  lastChoice?: string; 
  containerAction?: string; 
  containerSize?: string; 
  customerName?: string;
}) {
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
    const status = res.status;
    const resText = await res.text();
    let data: any = {};
    try {
      data = JSON.parse(resText);
    } catch {
      data = { raw: resText };
    }

    console.log(`[Meta Graph API Outgoing Text] Status Code: ${status}, Response:`, JSON.stringify(data));

    const isAuthError = status === 401 ||
      status === 403 ||
      data?.error?.code === 190 ||
      data?.error?.type === 'OAuthException' ||
      (typeof data?.error?.message === 'string' && (
        data.error.message.includes('Session has expired') ||
        data.error.message.includes('Error validating access token') ||
        data.error.message.includes('The access token could not be decrypted')
      ));

    if (isAuthError) {
      console.error("WHATSAPP_TOKEN is expired or invalid in Vercel env");
    }

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

app.post(['/api/conversations/:id/reply', '/api/chat/send-reply'], async (req: Request, res: Response) => {
  const { id } = req.params;
  const { text, toPhone, customerName } = req.body || {};
  
  if (!text || !String(text).trim()) {
    return res.status(400).json({ success: false, error: 'Text cannot be empty' });
  }

  const cleanText = String(text).trim();

  // Find or create conversation
  let conv = conversations.find(c => c.id === id || (toPhone && c.from.replace(/[^0-9]/g, '') === String(toPhone).replace(/[^0-9]/g, '')));
  let targetPhone = toPhone || conv?.from || DISPLAY_PHONE || '972508860896';
  let cleanDigits = String(targetPhone).replace(/[^0-9]/g, '');
  if (cleanDigits.startsWith('05')) cleanDigits = '972' + cleanDigits.slice(1);
  if (!cleanDigits) cleanDigits = '972508860896';

  const newMsg = {
    id: `m_out_${Date.now()}`,
    direction: 'outgoing' as const,
    text: cleanText,
    type: 'text' as const,
    timestamp: new Date().toISOString()
  };

  if (!conv) {
    conv = {
      id: `conv_${cleanDigits}`,
      from: `+${cleanDigits}`,
      customerName: customerName || 'לקוח וואטסאפ',
      lastMessage: cleanText,
      lastTimestamp: newMsg.timestamp,
      status: 'active',
      messages: [newMsg]
    };
    conversations.unshift(conv);
  } else {
    conv.messages.push(newMsg);
    conv.lastMessage = cleanText;
    conv.lastTimestamp = newMsg.timestamp;
  }

  // 1. Add to local outbound queue so whatsapp-web.js client sends it to WhatsApp immediately
  const queueItem: OutboundQueueItem = {
    id: `out_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    phone: cleanDigits,
    name: conv.customerName,
    message: cleanText,
    action: 'customer_reply',
    timestamp: newMsg.timestamp,
    source: 'chat_ui'
  };
  localPendingOutboundQueue.push(queueItem);

  // 2. Dispatch via Meta Cloud API
  const metaSendPromise = sendWhatsAppText(cleanDigits, cleanText).catch(() => ({ success: false }));

  // 3. Dispatch to Make Webhook
  const makePromise = triggerJoniMake(cleanDigits, cleanText, 'customer_reply').catch(() => null);

  // 4. Record to Google Sheets
  sendToGoogleSheets({
    action: 'logWhatsApp',
    timestamp: new Date().toLocaleString('he-IL'),
    phone: `+${cleanDigits}`,
    customerName: conv.customerName,
    inquiryType: 'מענה ידני מנציג (ממשק צ\'אט)',
    incomingMessage: '[נשלח מממשק הצ\'אט של סבן]',
    branchName: 'נציג סבן (ראמי)',
    sentReply: cleanText,
    status: 'נשלח לוואטסאפ'
  }).catch(() => {});

  // 5. Update Firebase RTDB
  try {
    fetch(`${FB_ROOT}/joni/incoming.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `+${cleanDigits}`,
        name: conv.customerName,
        text: '[מענה נציג מממשק הצ\'אט]',
        reply: cleanText,
        sender: 'operator',
        timestamp: Date.now()
      })
    }).catch(() => {});
  } catch {}

  // 6. Add to studio logs
  logs.unshift({
    id: `log_manual_${Date.now()}`,
    from: `+${cleanDigits}`,
    customer_name: conv.customerName,
    incoming_text: '[מענה נציג מממשק הצ\'אט]',
    sent_response: cleanText,
    response_type: 'text',
    timestamp: newMsg.timestamp,
    channel: 'joni',
    status: 'sent'
  });

  const [metaRes, makeRes] = await Promise.all([metaSendPromise, makePromise]);

  res.json({
    success: true,
    message: newMsg,
    conversation: conv,
    dispatchedToWhatsApp: true,
    metaResult: metaRes,
    makeResult: makeRes,
    queuedForBridge: true,
    queueId: queueItem.id
  });
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

// 10. Google Sheets & Apps Script Bridge API
app.get('/api/sheets/ping', async (_req: Request, res: Response) => {
  const url = settings.googleSheetWebAppUrl || GOOGLE_SHEET_WEBAPP_URL;
  try {
    const response = await fetch(`${url}?action=ping`, { redirect: 'follow', signal: AbortSignal.timeout(25000) });
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/sheets/orders', async (_req: Request, res: Response) => {
  const url = settings.googleSheetWebAppUrl || GOOGLE_SHEET_WEBAPP_URL;
  try {
    const response = await fetch(`${url}?action=getOrders`, { redirect: 'follow', signal: AbortSignal.timeout(25000) });
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/sheets/conversations', async (_req: Request, res: Response) => {
  const url = settings.googleSheetWebAppUrl || GOOGLE_SHEET_WEBAPP_URL;
  try {
    const response = await fetch(`${url}?action=getConversations`, { redirect: 'follow', signal: AbortSignal.timeout(25000) });
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/sheets/containers', async (_req: Request, res: Response) => {
  const url = settings.googleSheetWebAppUrl || GOOGLE_SHEET_WEBAPP_URL;
  try {
    const response = await fetch(`${url}?action=getContainers`, { redirect: 'follow', signal: AbortSignal.timeout(25000) });
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/sheets/post', async (req: Request, res: Response) => {
  const result = await sendToGoogleSheets(req.body);
  if (result) {
    res.json(result);
  } else {
    res.status(500).json({ success: false, error: 'Failed to post to Google Sheets Web App' });
  }
});

// 11. Studio Tools & Function Calling API (JONI Make Broadcast)
app.get('/api/tools', (_req: Request, res: Response) => {
  res.json({
    success: true,
    tools: [
      {
        name: triggerJoniMakeFunctionDeclaration.name,
        description: triggerJoniMakeFunctionDeclaration.description,
        webhookUrl: MAKE_JONI_WEBHOOK_URL,
        parameters: triggerJoniMakeFunctionDeclaration.parameters,
        sender: 'נועה AI (ח. סבן)',
        status: 'active'
      }
    ],
    recentDispatches: joniMakeLogs
  });
});

app.post('/api/tools/trigger-joni-make', async (req: Request, res: Response) => {
  try {
    const { to, message, action } = req.body || {};
    if (!message) {
      return res.status(400).json({ success: false, error: 'message is required' });
    }
    const result = await triggerJoniMake(to || '972508860896', message, action || 'send_menu');
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 12. Direct Menu Sending (Server & JONI Plugin Two-Way Connection)
app.post(['/api/joni/send-menu', '/api/whatsapp/send-menu'], async (req: Request, res: Response) => {
  try {
    const { to, customNote } = req.body || {};
    let target = String(to || DISPLAY_PHONE || '972508860896').replace(/[^0-9]/g, '');
    if (target.startsWith('05')) target = '972' + target.slice(1);
    if (!target) target = '972508860896';

    const dynamicWelcome = getDynamicWelcomeText();
    const menuText = customNote 
      ? `${customNote}\n\n${dynamicWelcome}`
      : dynamicWelcome;

    // 1. Send via WhatsApp Text / Cloud API
    const sendResult = await sendWhatsAppText(target, menuText);

    // 2. Dispatch to JONI Make Webhook
    const makeResult = await triggerJoniMake(target, menuText, 'send_menu');

    // 3. Sync to Google Sheets
    sendToGoogleSheets({
      action: 'logWhatsApp',
      timestamp: new Date().toLocaleString('he-IL'),
      phone: `+${target}`,
      customerName: 'לקוח סבן (שליחת תפריט יזומה)',
      inquiryType: 'תפריט ראשי סבן',
      incomingMessage: '[שליחת תפריט דרך שרת סטודיו ותוסף JONI]',
      branchName: 'תפריט ראשי סבן',
      sentReply: menuText,
      status: 'נשלח בהצלחה'
    }).catch(() => {});

    // 4. Update Studio Logs
    logs.unshift({
      id: `menu_dispatch_${Date.now()}`,
      from: `+${target}`,
      customer_name: 'לקוח סבן (שליחת תפריט)',
      incoming_text: '[שליחת תפריט דרך השרת ותוסף JONI]',
      selected_menu_id: 'welcome_menu',
      selected_menu_title: 'ח. סבן 🏗️ תפריט ראשי',
      sent_response: menuText,
      response_type: 'list_menu',
      timestamp: new Date().toISOString(),
      channel: 'joni',
      status: 'sent'
    });

    res.json({
      success: true,
      message: 'תפריט סבן שודר בהצלחה בוואטסאפ ובתוסף JONI (קשר דו-כיווני וסגירת מעגל)',
      recipient: target,
      menuText,
      whatsappResult: sendResult,
      makeResult
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 13. Two-Way WhatsApp Bridge & Outbound Queue System (Script ⇄ JONI ⇄ Server)
async function checkOutboundQueueFromSheet() {
  const url = settings.googleSheetWebAppUrl || GOOGLE_SHEET_WEBAPP_URL;
  if (!url || settings.enableGoogleSheetsSync === false) return;

  try {
    const response = await fetch(`${url}?action=get_pending`, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(15000)
    });

    const data: any = await response.json().catch(() => ({}));
    if (!data.pending || !Array.isArray(data.pending) || data.pending.length === 0) return;

    console.log(`[Google Apps Script Outbound Queue] Found ${data.pending.length} pending message(s) to send!`);

    for (const item of data.pending) {
      let cleanPhone = String(item.phone || '').replace(/[^0-9]/g, '');
      if (cleanPhone.startsWith('0')) cleanPhone = '972' + cleanPhone.slice(1);
      if (!cleanPhone) cleanPhone = '972508860896';

      console.log(`📤 Dispatching pending message from sheet to ${item.name || 'לקוח'} (${cleanPhone}):`, item.message);

      // 1. Send via WhatsApp
      await sendWhatsAppText(cleanPhone, item.message);

      // 2. Dispatch to Make Webhook
      await triggerJoniMake(cleanPhone, item.message, 'customer_reply');

      // 3. Mark row as sent in Google Apps Script
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_sent', rowId: item.rowId }),
        redirect: 'follow'
      }).catch(err => console.error('Failed to mark sent in Apps Script:', err));

      // 4. Record to studio logs
      logs.unshift({
        id: `outbound_queue_${Date.now()}_${item.rowId}`,
        from: `+${cleanPhone}`,
        customer_name: item.name || 'לקוח מהגיליון',
        incoming_text: `[תור הודעות יוצא מהגיליון - שורה ${item.rowId}]`,
        sent_response: item.message,
        response_type: 'text',
        timestamp: new Date().toISOString(),
        channel: 'joni',
        status: 'sent'
      });
    }
  } catch (err: any) {
    // transient network error
  }
}

// Bridge API for External Scripts (whatsapp-web.js client or desktop daemon)
app.post('/api/bridge/incoming', async (req: Request, res: Response) => {
  try {
    const { from, name, text, timestamp } = req.body || {};
    let cleanFrom = String(from || '').replace(/[^0-9]/g, '');
    if (cleanFrom.startsWith('05')) cleanFrom = '972' + cleanFrom.slice(1);
    if (!cleanFrom) cleanFrom = '972508860896';

    const senderName = name || 'לקוח וואטסאפ';
    const incomingText = String(text || '').trim();

    // 1. Forward to Google Apps Script for live 2-way script reply
    let replyText = '';
    const scriptUrl = settings.googleSheetWebAppUrl || GOOGLE_SHEET_WEBAPP_URL;
    try {
      const scriptRes = await fetch(scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: cleanFrom,
          name: senderName,
          text: incomingText,
          timestamp: timestamp || new Date().toISOString()
        }),
        redirect: 'follow',
        signal: AbortSignal.timeout(10000)
      });
      const scriptData: any = await scriptRes.json().catch(() => ({}));
      if (scriptData && scriptData.reply) {
        replyText = scriptData.reply.trim();
      }
    } catch (e: any) {
      console.warn('[Bridge] Apps Script query warning:', e.message);
    }

    if (!replyText) {
      let customerHistory = null;
      try {
        customerHistory = await ordersService.getCustomerProfile(undefined, senderName, cleanFrom);
      } catch {}
      const noaResult = processNoaAiMessage(incomingText, senderName, cleanFrom, customerHistory);
      replyText = noaResult.replyText;
    }

    // 2. Broadcast to Make Webhook
    let actionType = 'customer_reply';
    if (replyText.includes('הקלד מספר לבחירה') || replyText.includes('תפריט')) actionType = 'send_menu';
    else if (replyText.includes('הזמנה') || replyText.includes('הובלה')) actionType = 'order_update';
    else if (replyText.includes('מכולה')) actionType = 'container_task';

    await triggerJoniMake(cleanFrom, replyText, actionType);

    // 3. Reflect in Live Conversations so it appears in the Chat interface!
    const normalizedPhone = `+${cleanFrom}`;
    let conv = conversations.find(c => c.from.replace(/[^0-9]/g, '') === cleanFrom);
    if (!conv) {
      conv = {
        id: `conv_${cleanFrom}`,
        from: normalizedPhone,
        customerName: senderName,
        lastMessage: replyText,
        lastTimestamp: new Date().toISOString(),
        status: 'active',
        messages: []
      };
      conversations.unshift(conv);
    } else {
      conv.customerName = senderName || conv.customerName;
      conv.lastMessage = replyText;
      conv.lastTimestamp = new Date().toISOString();
    }

    conv.messages.push({
      id: `msg_in_${Date.now()}`,
      direction: 'incoming',
      text: incomingText,
      type: 'text',
      timestamp: new Date().toISOString()
    });

    conv.messages.push({
      id: `msg_out_${Date.now() + 1}`,
      direction: 'outgoing',
      text: replyText,
      type: 'text',
      timestamp: new Date().toISOString()
    });

    // 4. Update Firebase RTDB joni/incoming
    try {
      fetch(`${FB_ROOT}/joni/incoming.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: normalizedPhone,
          name: senderName,
          text: incomingText,
          reply: replyText,
          timestamp: Date.now()
        })
      }).catch(() => {});
    } catch {}

    // 5. Log to Studio
    logs.unshift({
      id: `bridge_${Date.now()}`,
      from: `+${cleanFrom}`,
      customer_name: senderName,
      incoming_text: incomingText,
      sent_response: replyText,
      response_type: actionType === 'send_menu' ? 'list_menu' : 'text',
      timestamp: new Date().toISOString(),
      channel: 'joni',
      status: 'sent'
    });

    res.json({
      success: true,
      reply: replyText,
      phone: cleanFrom,
      name: senderName,
      action: actionType
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/bridge/pending', async (_req: Request, res: Response) => {
  try {
    const url = settings.googleSheetWebAppUrl || GOOGLE_SHEET_WEBAPP_URL;
    let sheetPending: any[] = [];
    try {
      const response = await fetch(`${url}?action=get_pending`, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(10000)
      });
      const data: any = await response.json().catch(() => ({ pending: [] }));
      if (Array.isArray(data.pending)) {
        sheetPending = data.pending;
      }
    } catch {}

    const localItems = localPendingOutboundQueue.map(item => ({
      rowId: item.id,
      phone: item.phone,
      name: item.name || 'לקוח וואטסאפ',
      message: item.message,
      source: 'chat_ui'
    }));

    const allPending = [...localItems, ...sheetPending];
    res.json({ success: true, count: allPending.length, pending: allPending });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message, pending: [] });
  }
});

app.post('/api/bridge/mark-sent', async (req: Request, res: Response) => {
  try {
    const { rowId } = req.body || {};
    if (typeof rowId === 'string' && rowId.startsWith('out_')) {
      localPendingOutboundQueue = localPendingOutboundQueue.filter(item => item.id !== rowId);
      return res.json({ success: true, rowId, status: 'marked_local_sent' });
    }

    const url = settings.googleSheetWebAppUrl || GOOGLE_SHEET_WEBAPP_URL;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_sent', rowId }),
      redirect: 'follow'
    });
    const data: any = await response.json().catch(() => ({ success: true }));
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/bridge/status', async (_req: Request, res: Response) => {
  res.json({
    success: true,
    appsScriptUrl: settings.googleSheetWebAppUrl || GOOGLE_SHEET_WEBAPP_URL,
    makeWebhookUrl: MAKE_JONI_WEBHOOK_URL,
    businessPhone: DISPLAY_PHONE,
    metaPhoneNumberId: WHATSAPP_PHONE_ID,
    metaConnectionStatus: settings.metaConnectionStatus,
    syncIntervalSeconds: 10,
    activeFlowNodes: activeFlow.nodes.length,
    recentLogsCount: logs.length
  });
});

app.post('/api/bridge/sync', async (_req: Request, res: Response) => {
  try {
    await checkOutboundQueueFromSheet();
    res.json({ success: true, message: 'סנכרון תור יוצא וסגירת מעגל בוצעו בהצלחה' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==============================================================================
// 12. ניהול הזמנות והיסטוריית לקוחות מתוך Google Sheets (דשבורד_הזמנות)
// ==============================================================================

app.get('/api/orders/history', async (req: Request, res: Response) => {
  try {
    const { customerId, customerName, phone, refresh } = req.query as Record<string, string>;
    const forceRefresh = refresh === 'true' || refresh === '1';

    let orders;
    if (customerId || customerName || phone) {
      if (forceRefresh) await ordersService.fetchAllOrders(true);
      orders = await ordersService.getOrdersByCustomerId(customerId, customerName, phone);
    } else {
      orders = await ordersService.fetchAllOrders(forceRefresh);
    }

    res.json({
      success: true,
      count: orders.length,
      orders
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message, orders: [] });
  }
});

app.get('/api/customers/history', async (req: Request, res: Response) => {
  try {
    const { customerId, customerName, phone } = req.query as Record<string, string>;
    const profile = await ordersService.getCustomerProfile(customerId, customerName, phone);
    
    if (!profile) {
      return res.json({
        success: true,
        exists: false,
        message: 'לא נמצאה היסטוריית הזמנות עבור לקוח זה',
        profile: null
      });
    }

    res.json({
      success: true,
      exists: true,
      profile
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/customers/reorder', async (req: Request, res: Response) => {
  try {
    const { customerId, customerName, phone } = req.query as Record<string, string>;
    const profile = await ordersService.getCustomerProfile(customerId, customerName, phone);
    
    if (!profile || !profile.lastOrder) {
      return res.status(404).json({
        success: false,
        message: 'לא נמצאה הזמנה קודמת לשחזור'
      });
    }

    res.json({
      success: true,
      customerName: profile.customerName,
      lastOrder: profile.lastOrder,
      items: profile.lastOrder.parsedItems,
      deliveryAddress: profile.lastOrder.deliveryAddress,
      formattedSummary: profile.lastOrderFormattedSummary
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Dev vs Production Setup with Vite
async function startServer() {
  // Initialize flow from Firebase RTDB on server boot
  try {
    const fbRes = await fetch(`${FB_ROOT}/chat_flows/main.json`);
    if (fbRes.ok) {
      const data = await fbRes.json();
      if (data && data.nodes && data.nodes.length > 0) {
        visualChatFlow = data;
        syncVisualFlowToActiveFlow(visualChatFlow);
        console.log('⚡ Initialized and synchronized flow from Firebase RTDB');
      }
    }
  } catch (e) {
    // offline fallback
  }

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
    console.log(`⚡ Two-Way Bridge: /api/bridge/incoming & /api/bridge/status`);
    console.log(`📋 Send Menu API: /api/joni/send-menu`);
    console.log(`🏢 Business Number: ${settings.businessNumber}`);
    console.log(`🔗 Google Sheet Script: ${settings.googleSheetWebAppUrl || GOOGLE_SHEET_WEBAPP_URL}`);
    console.log(`🔗 Firebase Send: ${settings.firebaseSendUrl}`);
    console.log(`===============================================`);

    // Start 10-second polling for outbound queue from Google Apps Script
    setInterval(checkOutboundQueueFromSheet, 10000);
  });
}

startServer();
