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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.resolve(__dirname, 'public')));

// In-Memory Database Store (with Saban defaults)
let activeFlow: FlowTree = JSON.parse(JSON.stringify(DEFAULT_FLOW));
let settings: StudioSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
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
async function sendMetaInteractiveList(to: string, listData: ListMenuData): Promise<{ success: boolean; fallbackText?: string }> {
  // Build fallback text representation with numbered options
  const numberedOptions = listData.rows.map((r, i) => `${i + 1}. *${r.title}* - ${r.description}`).join('\n');
  const fallbackText = `${listData.header ? `*${listData.header}*\n\n` : ''}${listData.body}\n\n${numberedOptions}\n\n_${listData.footer || 'השב עם מספר האפשרות'}_`;

  // If Meta token or Phone ID is missing, or not enabled, return fallback
  if (!settings.enableMetaCloudApi || !settings.metaAccessToken || !settings.metaPhoneNumberId) {
    return { success: false, fallbackText };
  }

  const endpoint = `https://graph.facebook.com/v20.0/${settings.metaPhoneNumberId}/messages`;
  const metaBody = {
    messaging_product: 'whatsapp',
    to: to.replace('+', ''),
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
            title: listData.sectionTitle || 'בחר שירות',
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
        'Authorization': `Bearer ${settings.metaAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(metaBody)
    });

    if (res.ok) {
      return { success: true };
    } else {
      const errData = await res.json().catch(() => ({}));
      console.warn('Meta API returned non-ok, falling back to text:', errData);
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
    // Find edge or row matching selectedRowId
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
  res.json({ success: true, settings });
});

app.post('/api/settings', (req: Request, res: Response) => {
  settings = { ...settings, ...req.body };
  res.json({ success: true, settings, message: 'ההגדרות נשמרו בהצלחה' });
});

// 3. Webhook Bridge for JONI
// Support both /api/webhooks/joni and /api/joni/incoming
const handleJoniWebhook = async (req: Request, res: Response) => {
  console.log('JONI Webhook received:', req.body);
  try {
    const payload: JoniWebhookPayload = req.body || {};
    const result = await processIncomingMessage(payload, 'joni');
    res.json({
      status: 'success',
      received: payload,
      executed: result
    });
  } catch (err: any) {
    console.error('Error handling JONI webhook:', err);
    res.status(500).json({ status: 'error', error: err?.message || 'Server error' });
  }
};

app.post('/api/webhooks/joni', handleJoniWebhook);
app.post('/api/joni/incoming', handleJoniWebhook);

// 4. Meta Webhook Verification and Event Handler
app.get('/api/webhooks/meta', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === 'saban_studio_verify_token') {
    console.log('Meta Webhook Verified');
    return res.status(200).send(challenge);
  }
  return res.status(403).send('Verification token mismatch');
});

app.post('/api/webhooks/meta', async (req: Request, res: Response) => {
  try {
    const entry = req.body?.entry?.[0]?.changes?.[0]?.value;
    const message = entry?.messages?.[0];
    const contact = entry?.contacts?.[0];

    if (message) {
      const from = message.from ? `+${message.from}` : '+972508860896';
      let text = '';
      let listReplyId: string | undefined;

      if (message.type === 'text') {
        text = message.text?.body || '';
      } else if (message.type === 'interactive') {
        if (message.interactive?.type === 'list_reply') {
          listReplyId = message.interactive?.list_reply?.id;
          text = message.interactive?.list_reply?.title || '';
        }
      }

      await processIncomingMessage({
        from,
        text,
        listReplyId,
        customerName: contact?.profile?.name || 'לקוח וואטסאפ'
      }, 'meta');
    }
    res.status(200).send('EVENT_RECEIVED');
  } catch (err) {
    console.error('Meta webhook parse error:', err);
    res.status(200).send('ERROR_IGNORED');
  }
});

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
