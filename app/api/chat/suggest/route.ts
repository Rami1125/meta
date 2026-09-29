// Smart reply suggestions API using Gemini
import { GoogleGenAI } from '@google/genai';

function getFallbackSuggestions(lastMsg: string, customerName?: string): string[] {
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

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { message = '', history = [], customerName = '' } = body;
    const cleanMsg = String(message || '').trim();

    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && cleanMsg) {
      try {
        const ai = new GoogleGenAI();
        const prompt = `
אתה עוזר חכם לנציג שירות ומכירות של "ח. סבן חומרי בניין בע״מ" (כפר ברא, נציג: ראמי מסארווה 050-886-0896).
נתח את הודעת הלקוח האחרונה בוואטסאפ וספק בדיוק 3 הצעות מענה מהיר (Smart Reply Suggestions) שונות, רלוונטיות ומקצועיות עבור הנציג.

דרישות חובה:
1. שפה: עברית טבעית, שירותית ומזמינה עם 1-2 אימוג'ים רלוונטיים (🏗️, 🚚, 🏪, 📞, 👍).
2. אורך: קצר וממוקד (משפט 1 עד 2 משפטים לכל היותר).
3. גיוון ב-3 ההצעות:
   - הצעה 1: מענה ענייני ישיר / אישור והתקדמות בהזמנה (כמות, כתובת, תאריך).
   - הצעה 2: שאלת הבהרה טכנית או תיאום לוגיסטי (גישת משאית, קוטר ברזל, גודל מכולה).
   - הצעה 3: יצירת קשר מהיר עם ראמי (050-886-0896) לסגירת מחיר או פתרון מיידי.

שם הלקוח: ${customerName || 'לקוח'}
הודעת הלקוח האחרונה:
"${cleanMsg}"

החזר אך ורק מערך JSON תקני של 3 מחרוזות בלבד, ללא שום מלל נוסף מעבר ל-JSON.
דוגמה:
["הצעה ראשונה...", "הצעה שנייה...", "הצעה שלישית..."]
`;

        const res = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json'
          }
        });

        const text = res.text?.trim() || '';
        try {
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed) && parsed.length >= 3) {
            return new Response(JSON.stringify({ suggestions: parsed.slice(0, 3) }), {
              status: 200,
              headers: { 'Content-Type': 'application/json; charset=utf-8' }
            });
          }
        } catch {
          const match = text.match(/\[[\s\S]*\]/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            if (Array.isArray(parsed) && parsed.length >= 3) {
              return new Response(JSON.stringify({ suggestions: parsed.slice(0, 3) }), {
                status: 200,
                headers: { 'Content-Type': 'application/json; charset=utf-8' }
              });
            }
          }
        }
      } catch (aiErr) {
        console.error('Error generating AI suggestions in route:', aiErr);
      }
    }

    return new Response(JSON.stringify({ suggestions: getFallbackSuggestions(cleanMsg, customerName) }), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ suggestions: getFallbackSuggestions('') }), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }
}
