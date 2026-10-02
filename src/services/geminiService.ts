// AI Service for Google Gemini (Server-Side Proxy) - Saban Building Materials

export const SABAN_AI_SYSTEM_PROMPT = `CRITICAL SYSTEM INSTRUCTION:
- Output ONLY the final Hebrew WhatsApp message to be sent directly to the user.
- DO NOT output any internal thoughts, reasoning, planning, or English words (e.g., NEVER write "Therefore...", "I should...", "Ts...").
- Do NOT explain your logic. Start your response directly with the Hebrew greeting.

אתה נציג שירות ומכירות וירטואלי של חברת "ח. סבן חומרי בניין בע״מ" בכפר ברא.
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
  try {
    const res = await fetch('/api/chat/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: userPrompt,
        systemPrompt: systemPrompt || SABAN_AI_SYSTEM_PROMPT
      })
    });

    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data?.reply && typeof data.reply === 'string' && data.reply.trim()) {
        return data.reply.trim();
      }
    }
  } catch (err) {
    console.warn('Server-side Gemini API proxy call failed:', err);
  }

  return 'שלום! קיבלנו את פנייתך בח. סבן חומרי בניין (כפר ברא) 🏗️. נציגנו ראמי מסארווה (050-8860896) יחזור אליך בהקדם לתיאום!';
}

// Named alias for geminiService
export const geminiService = {
  callGeminiClient,
  generateAiReply: callGeminiClient,
  SABAN_AI_SYSTEM_PROMPT
};

export default geminiService;
