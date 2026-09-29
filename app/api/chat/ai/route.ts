// Free Chat AI Engine Route for Saban Building Materials
import { GoogleGenAI } from '@google/genai';

const SYSTEM_PROMPT = `אתה נציג שירות של ח. סבן חומרי בניין בע"מ - כפר ברא.
אתה מדבר בעברית מלאה, ידידותי, קצר, עם אימוג'ים 🏗️🚚.
מטרה: להבין מה הלקוח צריך (ברזל, בלוקים, מלט, חול, מכולה) ולתאם הובלה/איסוף.
אם לקוח אומר 'בדיקה' - תענה 'הבדיקה עברה בהצלחה 👍 מערכת סבן מחוברת ומוכנה לשירותך! איזה חומר תרצה להזמין?'
אל תמציא מחירים.

כלל קריטי לכל פנייה על חומרים או הובלה (לדוגמה: "ברזל 2 טון לכפר סבא", בלוקים, מלט וכדומה):
תמיד תשאל את הלקוח ותוודא:
1. כמות (או קוטר/סוג הברזל או המלט)
2. כתובת מדויקת לאספקה (עיר, רחוב ומספר)
3. תאריך מבוקש להובלה`;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { from, text, history = [] } = body;

    const cleanText = String(text || '').trim();

    // Check for "בדיקה" test message
    if (cleanText.includes('בדיקה') || cleanText === 'test') {
      return new Response(JSON.stringify({
        reply: "הבדיקה עברה בהצלחה 👍 מערכת סבן חומרי בניין מחוברת ומוכנה לשירותך! איזה חומר תרצה להזמין היום?",
        suggested_branches: ["🚚 הזמנה והובלה", "🏪 איסוף עצמי", "🗑️ מכולות פסולת"],
        intent: "test_check"
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
    }

    // Call Gemini AI
    let reply = "שלום! נשמח לתאם אספקת חומרים והובלה 🏗️🚚. כדי שנוכל לתאם, אנא ציין: כמות מדויקת, כתובת אספקה, ותאריך מבוקש.";
    let intent = "general_inquiry";
    let suggestedBranches: string[] = ["🚚 הזמנה והובלה", "🏪 איסוף עצמי", "🗑️ מכולות פסולת", "📍 מעקב הזמנה"];

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

לקוח (${from || 'וואטסאפ'}): ${cleanText}

השב בקצרה (1-2 משפטים) בעברית עם אימוג'ים מתאימים. אם הלקוח ציין חומר והובלה (כמו ברזל לכפר סבא), תאשר שנקלט ותשאל על כמות, כתובת ותאריך:
`;

        const res = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
        });

        if (res.text) {
          reply = res.text.trim();
        }
      }
    } catch (e) {
      console.error('Gemini call error in chat/ai route:', e);
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
