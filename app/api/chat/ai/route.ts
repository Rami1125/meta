// Free Chat AI Engine Route for Saban Building Materials
import { GoogleGenAI, FunctionDeclaration, Type } from '@google/genai';

const MAKE_JONI_WEBHOOK_URL = process.env.MAKE_JONI_WEBHOOK_URL || 'https://hook.eu1.make.com/iozzim8loo8gtkq62wb4axycdskfe080';

const SYSTEM_PROMPT = `אתה נועה AI, נציגת שירות ומכירות וירטואלית של חברת "ח. סבן חומרי בניין בע״מ" (כפר ברא, טלפון 050-8860896).
המחוברת ישירות למנוע ההפצה של JONI Make ולוואטסאפ.

בכל פעם שאתה מייצר תפריט, מאשר הזמנה או מנסח תשובה ללקוח עבור וואטסאפ — אל תסתפק רק בהצגת הטקסט בצ'אט.
עליך להפעיל את הכלי trigger_joni_make כדי לשדר את התוכן ישירות ל-Webhook של Make.

אתה מדבר בעברית מלאה, ידידותי, קצר, עם אימוג'ים 🏗️🚚.
מטרה: להבין מה הלקוח צריך (ברזל, בלוקים, מלט, חול, מכולה) ולתאם הובלה/איסוף.
אם לקוח אומר 'בדיקה' - תענה 'הבדיקה עברה בהצלחה 👍 מערכת סבן מחוברת ומוכנה לשירותך! איזה חומר תרצה להזמין?'
אל תמציא מחירים.

כלל קריטי לכל פנייה על חומרים או הובלה (לדוגמה: "ברזל 2 טון לכפר סבא", בלוקים, מלט וכדומה):
תמיד תשאל את הלקוח ותוודא:
1. כמות (או קוטר/סוג הברזל או המלט)
2. כתובת מדויקת לאספקה (עיר, רחוב ומספר)
3. תאריך מבוקש להובלה`;

const triggerJoniMakeDeclaration: FunctionDeclaration = {
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

async function dispatchToMake(to: string, message: string, action: string = 'customer_reply') {
  let cleanTo = String(to || '').replace(/[^0-9]/g, '');
  if (cleanTo.startsWith('05')) cleanTo = '972' + cleanTo.slice(1);
  if (!cleanTo) cleanTo = '972508860896';

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
    return { ok: res.ok, status: res.status };
  } catch (err: any) {
    console.error('Make webhook dispatch error:', err);
    return { ok: false, error: err.message };
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { from, text, history = [] } = body;

    const cleanText = String(text || '').trim();
    const recipientPhone = from || '972508860896';

    // Check for "בדיקה" test message
    if (cleanText.includes('בדיקה') || cleanText === 'test') {
      const testReply = "הבדיקה עברה בהצלחה 👍 מערכת סבן חומרי בניין מחוברת ומוכנה לשירותך! איזה חומר תרצה להזמין היום?";
      await dispatchToMake(recipientPhone, testReply, 'customer_reply');
      return new Response(JSON.stringify({
        reply: testReply,
        suggested_branches: ["🚚 הזמנה והובלה", "🏪 איסוף עצמי", "🗑️ מכולות פסולת"],
        intent: "test_check",
        make_dispatched: true
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
    }

    // Call Gemini AI with Function Calling (trigger_joni_make)
    let reply = "שלום! נשמח לתאם אספקת חומרים והובלה 🏗️🚚. כדי שנוכל לתאם, אנא ציין: כמות מדויקת, כתובת אספקה, ותאריך מבוקש.";
    let intent = "general_inquiry";
    let suggestedBranches: string[] = ["🚚 הזמנה והובלה", "🏪 איסוף עצמי", "🗑️ מכולות פסולת", "📍 מעקב הזמנה"];
    let makeDispatched = false;

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (apiKey) {
        const ai = new GoogleGenAI();
        const historyText = Array.isArray(history) 
          ? history.slice(-4).map((h: any) => `${h.role === 'user' ? 'לקוח' : 'נציג סבן'}: ${h.text || h.body}`).join('\n')
          : '';

        const prompt = `
System Instructions:
${SYSTEM_PROMPT}

Recent Chat History:
${historyText || '(התחלת שיחה)'}

לקוח (${recipientPhone}): ${cleanText}

השב בקצרה (1-2 משפטים) בעברית עם אימוג'ים מתאימים, והפעל את הכלי trigger_joni_make לשידור ללקוח:
`;

        const res = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            tools: [{ functionDeclarations: [triggerJoniMakeDeclaration] }]
          }
        });

        if (res.functionCalls && res.functionCalls.length > 0) {
          for (const call of res.functionCalls) {
            if (call.name === 'trigger_joni_make') {
              const args = call.args as any;
              const targetTo = args?.to || recipientPhone;
              const targetMsg = args?.message || res.text || reply;
              const targetAction = args?.action || 'customer_reply';
              await dispatchToMake(targetTo, targetMsg, targetAction);
              reply = targetMsg;
              makeDispatched = true;
            }
          }
        } else if (res.text) {
          reply = res.text.trim();
        }
      }
    } catch (e) {
      console.error('Gemini call error in chat/ai route:', e);
    }

    // If not already dispatched via tool, guarantee closed-loop execution to Make
    if (!makeDispatched) {
      let deducedAction = 'customer_reply';
      const lower = cleanText.toLowerCase();
      if (lower.includes('תפריט') || lower.includes('שלום') || lower.includes('היי')) deducedAction = 'send_menu';
      else if (lower.includes('הובלה') || lower.includes('משלוח') || lower.includes('ברזל') || lower.includes('בלוק')) deducedAction = 'order_update';
      else if (lower.includes('מכולה') || lower.includes('פסולת')) deducedAction = 'container_task';

      await dispatchToMake(recipientPhone, reply, deducedAction);
      makeDispatched = true;
    }

    // Determine intent and suggested branches
    const lower = cleanText.toLowerCase();
    if (lower.includes('הובלה') || lower.includes('משלוח') || lower.includes('ברזל') || lower.includes('בלוקים') || lower.includes('מלט')) {
      intent = 'order_delivery';
      suggestedBranches = ['ברזל ורשתות', 'בלוקים שחורים/איטונג', 'מלט וטיט', 'חול וחצץ'];
    } else if (lower.includes('איסוף') || lower.includes('מחסן') || lower.includes('כפר ברא')) {
      intent = 'self_pickup';
      suggestedBranches = ['שעות פתיחה מחסן', 'מיקום ב-Waze', 'הכן הזמנה מראש'];
    } else if (lower.includes('מכולה') || lower.includes('פסולת') || lower.includes('פינוי')) {
      intent = 'waste_container';
      suggestedBranches = ['מכולה 6 קוב', 'מכולה 8 קוב', 'מכולה 12 קוב'];
    } else if (lower.includes('איפה') || lower.includes('מעקב') || lower.includes('נהג')) {
      intent = 'track_order';
      suggestedBranches = ['מיקום נהג ראמי', 'זמן הגעה משוער', 'טלפון ראמי: 050-886-0896'];
    }

    return new Response(JSON.stringify({
      reply,
      suggested_branches: suggestedBranches,
      intent
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }
}

export async function GET() {
  return new Response(JSON.stringify({
    status: "saban free chat ai alive",
    model: "gemini-3.8-flash",
    business: "ח. סבן חומרי בניין בע״מ - כפר ברא"
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}
