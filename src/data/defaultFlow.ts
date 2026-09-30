import { FlowTree, StudioSettings, StudioTask, Conversation, LogEntry } from '../types/studio';

export const DEFAULT_SETTINGS: StudioSettings = {
  businessName: 'רמי מסארוה / ח. סבן',
  businessNumber: '+972508860896',
  firebaseSendUrl: 'https://saban-ai-drive-default-rtdb.europe-west1.firebasedatabase.app/joni/incoming.json',
  firebaseRootUrl: 'https://saban-ai-drive-default-rtdb.europe-west1.firebasedatabase.app',
  firebasePath: 'joni/incoming',
  waitTimeSeconds: 2,
  metaPhoneNumberId: '646128321917738',
  metaAccessToken: '',
  enableMetaCloudApi: true,
  enableJoniBridge: true,
  defaultFallbackToText: true,
  language: 'עברית',
  webhookBaseUrl: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
  metaVerifiedName: 'ראמי מסארווה',
  metaDisplayPhone: '+972 50-886-0896',
  metaConnectionStatus: 'מחובר ל-Cloud API',
  lastCheckResult: '{"verified_name":"ראמי מסארווה","display_phone_number":"+972 50-886-0896","id":"646128321917738"} - תקין ✅',
  lastMessageIdSent: 'wamid.HBgMOTcyNTI0NDU4OTEyFQIAERgUQ0VERkJFRjRGQTlENEFCRkRCMzcA',
  googleSheetWebAppUrl: 'https://script.google.com/macros/s/AKfycbwAPxnpsQxYOul2jxnyxKGg83DGYnXHFahrWT7VZh-JgwVtGypG2u7lMe_wjLKeF_QZ/exec',
  enableGoogleSheetsSync: true
};

export const DEFAULT_FLOW: FlowTree = {
  id: 'saban_main_flow',
  name: 'תפריט ראשי - ח. סבן חומרי בניין',
  businessName: 'ח. סבן חומרי בניין בע״מ',
  businessNumber: '+972508860896',
  rootBlockId: 'welcome_menu',
  updatedAt: new Date().toISOString(),
  nodes: [
    {
      id: 'welcome_menu',
      type: 'list_menu',
      title: 'תפריט ראשי סבן',
      description: 'תפריט פתיחה מעוצב עם 4 השירותים המרכזיים',
      isRoot: true,
      position: { x: 80, y: 180 },
      data: {
        type: 'list_menu',
        header: 'ח. סבן חומרי בניין 🏗️',
        body: 'שלום וברוכים הבאים לח. סבן חומרי בניין! נשמח לתת לכם שירות מהיר ומקצועי. במה נוכל לעזור היום?',
        footer: 'זמינים בימים א-ה 06:30-17:00 | יום ו 06:30-13:00',
        buttonText: 'בחר שירות',
        sectionTitle: 'שירותי ח. סבן',
        rows: [
          {
            id: 'order_delivery',
            title: '🚚 הזמנה והובלה',
            description: 'חומרי בניין עד האתר',
            targetBlockId: 'delivery_reply'
          },
          {
            id: 'self_pickup',
            title: '🏪 איסוף עצמי',
            description: 'המחסן בכפר ברא',
            targetBlockId: 'pickup_reply'
          },
          {
            id: 'waste_container',
            title: '🗑️ מכולות פסולת',
            description: 'פינוי פסולת בניין',
            targetBlockId: 'container_action_menu'
          },
          {
            id: 'track_order',
            title: '📍 מעקב משלוח',
            description: 'איפה ההזמנה שלי?',
            targetBlockId: 'tracking_reply'
          }
        ]
      }
    },
    {
      id: 'delivery_reply',
      type: 'text',
      title: 'ענף הובלה (order_delivery)',
      description: 'בחירת חומר לבנייה',
      position: { x: 580, y: 30 },
      data: {
        type: 'text',
        text: '🚚 מעולה! איזה חומר צריך?\n1️⃣ ברזל\n2️⃣ בלוקים\n3️⃣ מלט\n4️⃣ חול/חצץ',
        targetBlockId: 'create_delivery_task'
      }
    },
    {
      id: 'create_delivery_task',
      type: 'task',
      title: 'יצירת משימת הובלה',
      description: 'יוצר משימה למוקד ההזמנות של סבן',
      position: { x: 990, y: 30 },
      data: {
        type: 'task',
        taskTitleTemplate: 'הזמנת הובלה חדשה - {{from}}',
        category: 'delivery',
        urgency: 'urgent',
        assignedTo: 'מוקד הזמנות והובלות',
        confirmationMessage: '✅ פנייתך נקלטה במערכת סבן! מנהל לוגיסטיקה יתאם איתך את המשלוח מיד.',
        targetBlockId: 'notify_joni_webhook'
      }
    },
    {
      id: 'pickup_reply',
      type: 'text',
      title: 'ענף איסוף עצמי (self_pickup)',
      description: 'איסוף עצמי מהמחסן בכפר ברא',
      position: { x: 580, y: 220 },
      data: {
        type: 'text',
        text: '🏪 איסוף עצמי מהמחסן בכפר ברא.\nשלח מיקום או כתוב מה להכין לך?',
        targetBlockId: undefined
      }
    },
    {
      id: 'container_action_menu',
      type: 'list_menu',
      title: '🗑️ שירות מכולות פסולת - ח. סבן',
      description: 'סוג פעולה נדרשת למכולה באתר',
      position: { x: 580, y: 380 },
      data: {
        type: 'list_menu',
        header: '🗑️ שירות מכולות פסולת - ח. סבן',
        body: 'איזה סוג פעולה למכולה נדרש באתר?',
        footer: 'ח. סבן חומרי בניין כפר ברא',
        buttonText: 'בחר פעולה',
        sectionTitle: 'סוגי פעולות מכולה',
        rows: [
          {
            id: 'container_place_new',
            title: '📍 הצבה חדשה',
            description: 'הבאת מכולה ריקה לאתר',
            targetBlockId: 'container_size_menu'
          },
          {
            id: 'container_swap',
            title: '🔄 החלפה',
            description: 'הוצאת מכולה מלאה והצבת ריקה',
            targetBlockId: 'container_size_menu'
          },
          {
            id: 'container_remove',
            title: '🚛 הוצאה ופינוי',
            description: 'פינוי סופי של המכולה וסגירת האתר',
            targetBlockId: 'container_size_menu'
          }
        ]
      }
    },
    {
      id: 'container_size_menu',
      type: 'list_menu',
      title: '📦 בחירת נפח המכולה',
      description: 'בחירת נפח מכולה ודגש תפעולי',
      position: { x: 990, y: 380 },
      data: {
        type: 'list_menu',
        header: '📦 בחירת נפח המכולה',
        body: 'אנא בחר את גודל המכולה המבוקש:\n\n⚠️ דגש תפעולי: נדרשת גישה פנויה ורחבה למשאית רמסע לצורך הנפה ופריקה.',
        footer: 'ח. סבן - משאיות רמסע',
        buttonText: 'בחר גודל',
        sectionTitle: 'נפחי מכולה זמינים',
        rows: [
          {
            id: 'container_size_6',
            title: '📦 6 קוב',
            description: 'מתאים לשיפוץ קל ודירות',
            targetBlockId: 'container_site_details'
          },
          {
            id: 'container_size_8',
            title: '📦 8 קוב',
            description: 'מתאים לפסולת כבדה, בלוקים ובטון',
            targetBlockId: 'container_site_details'
          },
          {
            id: 'container_size_12',
            title: '📦 12 קוב',
            description: 'מתאים לפסולת עץ, גבס ונפח גדול',
            targetBlockId: 'container_site_details'
          }
        ]
      }
    },
    {
      id: 'container_site_details',
      type: 'text',
      title: '📍 איסוף פרטי אתר מכולה',
      description: 'איסוף כתובת מדויקת ואיש קשר',
      position: { x: 1390, y: 380 },
      data: {
        type: 'text',
        text: 'מעולה! אנא רשום לי בהודעה: כתובת האספקה המדויקת (עיר ורחוב), איש קשר באתר, ותאריך/שעה מבוקשים.',
        targetBlockId: 'create_container_task'
      }
    },
    {
      id: 'create_container_task',
      type: 'task',
      title: 'יצירת משימת מכולה - ראמי',
      description: 'סנכרון ל-Firebase RTDB ויצירת משימה לרמי',
      position: { x: 1790, y: 380 },
      data: {
        type: 'task',
        taskTitleTemplate: 'מכולת פסולת - {{from}}',
        category: 'containers',
        urgency: 'urgent',
        assignedTo: 'ראמי מסארווה (050-886-0896)',
        confirmationMessage: '✅ פרטי המכולה נקלטו בהצלחה וסונכרנו ל-Firebase RTDB (joni/incoming)! נוצרה משימת תיאום עבור רמי מסארווה (050-886-0896) לתיאום משאית רמסע.',
        targetBlockId: undefined
      }
    },
    {
      id: 'tracking_reply',
      type: 'text',
      title: 'ענף מעקב (track_order)',
      description: 'בירור מספר הזמנה לאיתור משלוח',
      position: { x: 580, y: 580 },
      data: {
        type: 'text',
        text: '📍 שלח מספר הזמנה ואבדוק לך מיד',
        targetBlockId: 'saban_ai_assistant'
      }
    },
    {
      id: 'saban_ai_assistant',
      type: 'ai_question',
      title: 'מענה AI סבן',
      description: 'מענה חכם לשאלות לקוחות על חומרי בניין ומועדי פתיחה',
      position: { x: 990, y: 580 },
      data: {
        type: 'ai_question',
        systemPrompt: 'אתה נציג שירות וירטואלי של ח. סבן חומרי בניין בע״מ (מספר 050-8860896). ענה בעברית בצורה אדיבה, תמציתית ומקצועית לגבי אספקת חומרי בניין, בלוקים, מלט, מכולות ושעות פעילות.',
        contextInfo: 'ח. סבן מספקת בלוקים איטונג ובטון, ברזל מקצועי, טיח, גבס, מלט נשר, חול ים ומחצבה, כלי עבודה ומכולות לפינוי פסולת. סניפים: החרש 10 והתלמיד 6.',
        fallbackText: 'נציג סבן יבדוק זאת וישיב לך בהקדם. ניתן גם לחייג 050-8860896.',
        model: 'gemini-3.8-flash',
        targetBlockId: undefined
      }
    },
    {
      id: 'notify_joni_webhook',
      type: 'webhook',
      title: 'עדכון JONI Firebase',
      description: 'שליחת עדכון ל-Firebase של JONI',
      position: { x: 1390, y: 30 },
      data: {
        type: 'webhook',
        endpointUrl: 'https://saban-ai-drive-default-rtdb.europe-west1.firebasedatabase.app/joni/send.json',
        method: 'POST',
        bodyTemplate: '{"action": "new_order_alert", "from": "{{from}}", "type": "delivery", "business": "H. Saban", "timestamp": "{{timestamp}}"}',
        targetBlockId: undefined
      }
    }
  ],
  edges: [
    {
      id: 'edge_delivery',
      source: 'welcome_menu',
      sourceHandle: 'order_delivery',
      target: 'delivery_reply'
    },
    {
      id: 'edge_delivery_legacy',
      source: 'welcome_menu',
      sourceHandle: 'delivery',
      target: 'delivery_reply'
    },
    {
      id: 'edge_delivery_task',
      source: 'delivery_reply',
      target: 'create_delivery_task'
    },
    {
      id: 'edge_delivery_webhook',
      source: 'create_delivery_task',
      target: 'notify_joni_webhook'
    },
    {
      id: 'edge_pickup',
      source: 'welcome_menu',
      sourceHandle: 'self_pickup',
      target: 'pickup_reply'
    },
    {
      id: 'edge_pickup_legacy',
      source: 'welcome_menu',
      sourceHandle: 'pickup',
      target: 'pickup_reply'
    },
    {
      id: 'edge_containers',
      source: 'welcome_menu',
      sourceHandle: 'waste_container',
      target: 'container_action_menu'
    },
    {
      id: 'edge_containers_legacy',
      source: 'welcome_menu',
      sourceHandle: 'containers',
      target: 'container_action_menu'
    },
    {
      id: 'edge_action_place',
      source: 'container_action_menu',
      sourceHandle: 'container_place_new',
      target: 'container_size_menu'
    },
    {
      id: 'edge_action_swap',
      source: 'container_action_menu',
      sourceHandle: 'container_swap',
      target: 'container_size_menu'
    },
    {
      id: 'edge_action_remove',
      source: 'container_action_menu',
      sourceHandle: 'container_remove',
      target: 'container_size_menu'
    },
    {
      id: 'edge_size_6',
      source: 'container_size_menu',
      sourceHandle: 'container_size_6',
      target: 'container_site_details'
    },
    {
      id: 'edge_size_8',
      source: 'container_size_menu',
      sourceHandle: 'container_size_8',
      target: 'container_site_details'
    },
    {
      id: 'edge_size_12',
      source: 'container_size_menu',
      sourceHandle: 'container_size_12',
      target: 'container_site_details'
    },
    {
      id: 'edge_container_task',
      source: 'container_site_details',
      target: 'create_container_task'
    },
    {
      id: 'edge_tracking',
      source: 'welcome_menu',
      sourceHandle: 'track_order',
      target: 'tracking_reply'
    },
    {
      id: 'edge_tracking_legacy',
      source: 'welcome_menu',
      sourceHandle: 'tracking',
      target: 'tracking_reply'
    },
    {
      id: 'edge_tracking_ai',
      source: 'tracking_reply',
      target: 'saban_ai_assistant'
    }
  ]
};

export const INITIAL_CONVERSATIONS: Conversation[] = [
  {
    id: 'conv_1',
    from: '+972524458912',
    customerName: 'יוסי כהן - קבלן שלד',
    lastMessage: 'מעולה, שולח מיקום: רחוב הברזל 22 תל אביב, צריך משטח בלוק 20',
    lastTimestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    selectedMenuId: 'delivery',
    selectedMenuTitle: '🚚 הזמנת הובלה לאתר',
    status: 'active',
    messages: [
      {
        id: 'm1',
        direction: 'incoming',
        text: 'שלום, צריך הובלה דחופה של בלוקים לאתר היום',
        type: 'text',
        timestamp: new Date(Date.now() - 1000 * 60 * 20).toISOString()
      },
      {
        id: 'm2',
        direction: 'outgoing',
        text: 'שלום וברוכים הבאים לח. סבן חומרי בניין! במה נוכל לעזור?',
        type: 'list_menu',
        timestamp: new Date(Date.now() - 1000 * 60 * 19).toISOString(),
        menuDetails: {
          header: 'ח. סבן חומרי בניין 🏗️',
          body: 'בחר שירות:',
          footer: 'ח. סבן',
          selectedRowId: 'delivery'
        }
      },
      {
        id: 'm3',
        direction: 'incoming',
        text: 'בחר: 🚚 הזמנת הובלה לאתר',
        type: 'text',
        timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString()
      },
      {
        id: 'm4',
        direction: 'outgoing',
        text: 'מעולה! 🚚 שלח מיקום + רשימת חומרים (מלט, בלוקים, ברזל, חול, גבס) ונציג סבן יחזור אליך תוך מספר דקות עם הצעת מחיר ומועד הגעה!',
        type: 'text',
        timestamp: new Date(Date.now() - 1000 * 60 * 14).toISOString()
      },
      {
        id: 'm5',
        direction: 'incoming',
        text: 'מעולה, שולח מיקום: רחוב הברזל 22 תל אביב, צריך משטח בלוק 20',
        type: 'text',
        timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString()
      }
    ]
  },
  {
    id: 'conv_2',
    from: '+972548901234',
    customerName: 'דוד לוי - עבודות עפר ושיפוצים',
    lastMessage: 'מתי אפשר להציב מכולה 12 קוב בהרצליה פיתוח?',
    lastTimestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    selectedMenuId: 'containers',
    selectedMenuTitle: '🗑️ מכולות פינוי פסולת',
    status: 'active',
    messages: [
      {
        id: 'm21',
        direction: 'incoming',
        text: 'היי מה קורה, צריך מכולה',
        type: 'text',
        timestamp: new Date(Date.now() - 1000 * 60 * 50).toISOString()
      },
      {
        id: 'm22',
        direction: 'outgoing',
        text: 'ח. סבן חומרי בניין - בחר שירות:',
        type: 'list_menu',
        timestamp: new Date(Date.now() - 1000 * 60 * 49).toISOString()
      },
      {
        id: 'm23',
        direction: 'incoming',
        text: 'מכולות פינוי פסולת',
        type: 'text',
        timestamp: new Date(Date.now() - 1000 * 60 * 47).toISOString()
      },
      {
        id: 'm24',
        direction: 'outgoing',
        text: '🗑️ מחלקת פינוי פסולת ומכולות סבן: אנא שלח כתובת מדויקת + גודל מכולה מבוקש (8 קוב / 12 קוב / 16 קוב)',
        type: 'text',
        timestamp: new Date(Date.now() - 1000 * 60 * 46).toISOString()
      },
      {
        id: 'm25',
        direction: 'incoming',
        text: 'מתי אפשר להציב מכולה 12 קוב בהרצליה פיתוח?',
        type: 'text',
        timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString()
      }
    ]
  },
  {
    id: 'conv_3',
    from: '+972507712390',
    customerName: 'משה אדרי - אחים אדרי בנייה',
    lastMessage: 'מגיע עוד 20 דק להחרש 10 לקחת 50 שקי מלט נשר',
    lastTimestamp: new Date(Date.now() - 1000 * 60 * 95).toISOString(),
    selectedMenuId: 'pickup',
    selectedMenuTitle: '🏪 איסוף עצמי מסניף',
    status: 'waiting_customer',
    messages: [
      {
        id: 'm31',
        direction: 'incoming',
        text: 'שלום, פתוחים עכשיו בהחרש 10?',
        type: 'text',
        timestamp: new Date(Date.now() - 1000 * 60 * 100).toISOString()
      },
      {
        id: 'm32',
        direction: 'outgoing',
        text: '🏪 סניפי ח. סבן לאיסוף עצמי: • סניף ראשי: החרש 10 • סניף לוגיסטי: התלמיד 6',
        type: 'text',
        timestamp: new Date(Date.now() - 1000 * 60 * 98).toISOString()
      },
      {
        id: 'm33',
        direction: 'incoming',
        text: 'מגיע עוד 20 דק להחרש 10 לקחת 50 שקי מלט נשר',
        type: 'text',
        timestamp: new Date(Date.now() - 1000 * 60 * 95).toISOString()
      }
    ]
  },
  {
    id: 'conv_4',
    from: '+972529944111',
    customerName: 'אבי גולדברג',
    lastMessage: 'תודה רבה, המשאית כבר נכנסה לאתר!',
    lastTimestamp: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    selectedMenuId: 'tracking',
    selectedMenuTitle: '📍 מעקב אחרי הזמנה',
    status: 'closed',
    messages: [
      {
        id: 'm41',
        direction: 'incoming',
        text: 'איפה המשאית של הזמנה 88412?',
        type: 'text',
        timestamp: new Date(Date.now() - 1000 * 60 * 190).toISOString()
      },
      {
        id: 'm42',
        direction: 'outgoing',
        text: '📍 שירות מעקב משלוחים ח. סבן: נהג מנוף נמצא כעת בדרך ומגיע תוך 15 דקות.',
        type: 'text',
        timestamp: new Date(Date.now() - 1000 * 60 * 185).toISOString()
      },
      {
        id: 'm43',
        direction: 'incoming',
        text: 'תודה רבה, המשאית כבר נכנסה לאתר!',
        type: 'text',
        timestamp: new Date(Date.now() - 1000 * 60 * 180).toISOString()
      }
    ]
  }
];

export const INITIAL_TASKS: StudioTask[] = [
  {
    id: 'task_1',
    clientPhone: '+972524458912',
    clientName: 'יוסי כהן - קבלן שלד',
    title: 'הזמנת הובלה: משטח בלוק 20 לרחוב הברזל 22 תל אביב',
    description: 'הלקוח פנה דרך תפריט WhatsApp. דרושה משאית עם מנוף קומה 2.',
    category: 'delivery',
    priority: 'urgent',
    status: 'pending',
    assignedTo: 'מוקד הזמנות והובלות',
    createdAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    conversationId: 'conv_1'
  },
  {
    id: 'task_2',
    clientPhone: '+972548901234',
    clientName: 'דוד לוי - עבודות עפר ושיפוצים',
    title: 'הצבת מכולה 12 קוב בהרצליה פיתוח',
    description: 'מכולת פסולת בניין דחופה, תיאום גישה מול הלקוח.',
    category: 'containers',
    priority: 'normal',
    status: 'in_progress',
    assignedTo: 'מחלקת מכולות',
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    conversationId: 'conv_2'
  },
  {
    id: 'task_3',
    clientPhone: '+972507712390',
    clientName: 'משה אדרי - אחים אדרי בנייה',
    title: 'איסוף עצמי סניף החרש 10: 50 שקי מלט נשר',
    description: 'הלקוח מגיע במשאית קטנה, להכין משטח במזלג.',
    category: 'pickup',
    priority: 'normal',
    status: 'completed',
    assignedTo: 'מחסנאי סניף החרש',
    createdAt: new Date(Date.now() - 1000 * 60 * 95).toISOString(),
    conversationId: 'conv_3'
  }
];

export const INITIAL_LOGS: LogEntry[] = [
  {
    id: 'log_live_check',
    from: '+972508860896',
    customer_name: 'ראמי מסארווה',
    incoming_text: 'בדיקת חיבור חיה Meta Graph API (v20.0)',
    sent_response: 'תוצאת בדיקה אחרונה: {"verified_name":"ראמי מסארווה","display_phone_number":"+972 50-886-0896","id":"646128321917738"} - תקין ✅ (סטטוס: מחובר ל-Cloud API)',
    response_type: 'unknown',
    timestamp: new Date().toISOString(),
    channel: 'meta',
    status: 'delivered'
  },
  {
    id: 'log_live_menu_send',
    from: '+972524458912',
    customer_name: 'רמי מסארוה לבדיקה',
    incoming_text: '[שליחת תפריט מעוצב חי - Meta Interactive List]',
    selected_menu_id: 'welcome_menu',
    selected_menu_title: 'ח. סבן 🏗️ (4 אפשרויות שירות)',
    sent_response: '✅ חיבור מלא - תפריט מעוצב נחת בוואטסאפ (Message ID: wamid.HBgMOTcyNTI0NDU4OTEyFQIAERgUQ0VERkJFRjRGQTlENEFCRkRCMzcA)',
    response_type: 'list_menu',
    meta_message_id: 'wamid.HBgMOTcyNTI0NDU4OTEyFQIAERgUQ0VERkJFRjRGQTlENEFCRkRCMzcA',
    timestamp: new Date(Date.now() - 1000 * 30).toISOString(),
    channel: 'meta',
    status: 'sent'
  },
  {
    id: 'log_1',
    from: '+972524458912',
    customer_name: 'יוסי כהן',
    incoming_text: 'בחר: 🚚 הזמנת הובלה לאתר',
    selected_menu_id: 'delivery',
    selected_menu_title: '🚚 הזמנת הובלה לאתר',
    sent_response: 'מעולה! 🚚 שלח מיקום + רשימת חומרים (מלט, בלוקים, ברזל, חול, גבס) ונציג סבן יחזור אליך תוך מספר דקות!',
    response_type: 'text',
    timestamp: new Date(Date.now() - 1000 * 60 * 14).toISOString(),
    channel: 'joni',
    status: 'sent',
    task_id: 'task_1',
    task_title: 'הזמנת הובלה: משטח בלוק 20'
  },
  {
    id: 'log_2',
    from: '+972524458912',
    customer_name: 'יוסי כהן',
    incoming_text: 'שלום, צריך הובלה דחופה של בלוקים לאתר היום',
    selected_menu_id: undefined,
    selected_menu_title: undefined,
    sent_response: '[Meta Interactive List] ח. סבן חומרי בניין (4 אפשרויות)',
    response_type: 'list_menu',
    timestamp: new Date(Date.now() - 1000 * 60 * 19).toISOString(),
    channel: 'meta',
    status: 'delivered'
  },
  {
    id: 'log_3',
    from: '+972548901234',
    customer_name: 'דוד לוי',
    incoming_text: 'מכולות פינוי פסולת',
    selected_menu_id: 'containers',
    selected_menu_title: '🗑️ מכולות פינוי פסולת',
    sent_response: '🗑️ מחלקת פינוי פסולת ומכולות סבן: אנא שלח כתובת מדויקת + גודל מכולה מבוקש (8 קוב / 12 קוב / 16 קוב)',
    response_type: 'text',
    timestamp: new Date(Date.now() - 1000 * 60 * 46).toISOString(),
    channel: 'joni',
    status: 'sent',
    task_id: 'task_2',
    task_title: 'הצבת מכולה 12 קוב'
  },
  {
    id: 'log_4',
    from: '+972507712390',
    customer_name: 'משה אדרי',
    incoming_text: 'איסוף עצמי מסניף',
    selected_menu_id: 'pickup',
    selected_menu_title: '🏪 איסוף עצמי מסניף',
    sent_response: '🏪 סניפי ח. סבן לאיסוף עצמי: • סניף ראשי: החרש 10 • סניף לוגיסטי: התלמיד 6',
    response_type: 'text',
    timestamp: new Date(Date.now() - 1000 * 60 * 98).toISOString(),
    channel: 'joni',
    status: 'sent',
    task_id: 'task_3'
  },
  {
    id: 'log_5',
    from: '+972529944111',
    customer_name: 'אבי גולדברג',
    incoming_text: 'מעקב אחרי הזמנה 88412',
    selected_menu_id: 'tracking',
    selected_menu_title: '📍 מעקב אחרי הזמנה',
    sent_response: '📍 שירות מעקב משלוחים ח. סבן: נהג מנוף נמצא כעת בדרך ומגיע תוך 15 דקות.',
    response_type: 'text',
    timestamp: new Date(Date.now() - 1000 * 60 * 185).toISOString(),
    channel: 'meta',
    status: 'delivered'
  }
];
