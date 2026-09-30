// AI Service for Google Gemini (Google AI Studio) - Saban Building Materials
import { GoogleGenAI } from '@google/genai';

export const SABAN_AI_SYSTEM_PROMPT = `אתה נציג שירות ומכירות וירטואלי של חברת "ח. סבן חומרי בניין בע״מ" בכפר ברא.
נציג ראשי ומנהל: ראמי מסארווה (טלפון: 050-8860896).
שירותי החברה:
1. אספקת כל חומרי הבניין: מלט נשר, ברזל מקצועי, בלוקים שחורים ולבנים, חול, טיט, שומשום ובאלות, גבס, צבע וכלי עבודה.
2. הובלות עד אתר הבנייה במשאית פול-טריילר ומנוף.
3. איסוף עצמי מהמחסן המרכזי בכפר ברא (א-ה 06:30-17:00, ו 06:30-13:00).
4. שירות השכרת והצבת מכולות לפינוי פסולת בניין (6, 8, 12 קוב) ברמסע.

הנחיות מענה:
- ענה תמיד בעברית טבעית, שירותית, עסקית ואמינה.
- השב בקצרה (1-2 משפטים) עם 1-2 אימוג'ים מתאימים (🏗️, 🚚, 🏪, 📞).
- אם הלקוח מבקש הובלה או חומרים, בקש בנעימות: כמות מדויקת, כתובת אספקה ותאריך רצוי.
- אם מדובר במכולה, שאל על גודל ומיקום הצבה.
- בסיום הצע שיחה עם ראמי מסארווה ב-050-8860896.`;

export async function callGeminiClient(userPrompt: string, systemPrompt?: string): Promise<string> {
  const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY 
    || (typeof process !== 'undefined' ? process.env?.VITE_GEMINI_API_KEY || process.env?.GEMINI_API_KEY : '')
    || '';

  if (!apiKey) {
    return 'שלום! קיבלנו את פנייתך בח. סבן חומרי בניין (כפר ברא) 🏗️. נציגנו ראמי מסארווה (050-8860896) יחזור אליך בהקדם לתיאום!';
  }

  // 1. Try modern @google/genai SDK
  try {
    const ai = new GoogleGenAI({ apiKey });
    const res = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: userPrompt,
      config: systemPrompt ? { systemInstruction: systemPrompt } : undefined
    });
    
    // Protected extraction from SDK response
    const text = (res as any)?.candidates?.[0]?.content?.parts?.[0]?.text || res?.text;
    if (text && typeof text === 'string' && text.trim()) {
      return text.trim();
    }
  } catch (err) {
    console.warn('GoogleGenAI SDK call fallback to REST API:', err);
  }

  // 2. Direct browser fetch to Google Gemini REST API with protected extraction
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined
      })
    });

    if (res.ok) {
      const data = await res.json().catch(() => null);
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        return "לא התקבלה תשובה תקינה מהמודל. אנא נסה שוב.";
      }
      return text.trim();
    } else {
      const data = await res.json().catch(() => null);
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        return "לא התקבלה תשובה תקינה מהמודל. אנא נסה שוב.";
      }
      return text.trim();
    }
  } catch (restErr) {
    console.error('Direct Gemini REST call failed:', restErr);
  }

  return "לא התקבלה תשובה תקינה מהמודל. אנא נסה שוב.";
}

// Named alias for geminiService
export const geminiService = {
  callGeminiClient,
  generateAiReply: callGeminiClient,
  SABAN_AI_SYSTEM_PROMPT
};

export default geminiService;
