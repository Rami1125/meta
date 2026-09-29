// App Router route for JONI webhook with Free AI Chat + Visual Branch Flow & Logs
import { GoogleGenAI } from '@google/genai';

const FB_ROOT = "https://saban-ai-drive-default-rtdb.europe-west1.firebasedatabase.app";
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID || '646128321917738';
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || 'EAAfybToWbKABSiSBQ2DC7MzDWwVTAZA583wK5RJsxGjTvfzgwMWVZB20EsdP1frjZAeXqZB16dJZCZA3C15K1YEtkQgLuCEPzVsoD8r5ftsQyy2Ys7TcFlsi0m6RRZASZBm8KHGHZBx6GocsVpWukIUKwlHLbt2l53VM2IgcCZCpZCPaVapi1sih258Mes2irUGKQZDZD';
const GRAPH_VERSION = process.env.GRAPH_VERSION || 'v20.0';

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
    let body: any;
    try {
      body = await req.json();
    } catch {
      body = { text: await req.text() };
    }
    
    // 1. Sanitize incoming to valid JSON with serverTimestamp()
    const now = Date.now();
    const clean = {
      from: String(body.from || body.phone || body.waId || "972508860896").replace(/\D/g, ""),
      text: String(body.text || body.message || body.body || JSON.stringify(body)).slice(0, 1000),
      name: String(body.name || body.pushName || "לקוח וואטסאפ").slice(0, 100),
      timestamp: now,
      server_timestamp: { ".sv": "timestamp" },
      created_at: { ".sv": "timestamp" }
    };

    // 1. Save to Firebase joni/incoming.json (KEEP GREEN)
    await fetch(`${FB_ROOT}/joni/incoming.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(clean)
    });

    // Also write to /joni/last.json
    await fetch(`${FB_ROOT}/joni/last.json`, {
      method: "PUT",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(clean)
    });

    // 2. Load flow from /chat_flows/main
    let branchReply = '';
    let branchId = '';
    let aiUsed = false;

    const trimmed = clean.text.trim().toLowerCase();

    // Check fixed digit menu choices
    if (trimmed === '1' || trimmed === 'order_delivery') {
      branchReply = "🚚 מעולה! איזה חומר צריך?\n1️⃣ ברזל\n2️⃣ בלוקים\n3️⃣ מלט\n4️⃣ חול/חצץ";
      branchId = 'order_delivery';
    } else if (trimmed === '2' || trimmed === 'self_pickup') {
      branchReply = "🏪 איסוף עצמי מהמחסן בכפר ברא.\nשלח מיקום או כתוב מה להכין לך?";
      branchId = 'self_pickup';
    } else if (trimmed === '3' || trimmed === 'waste_container') {
      branchReply = "🗑️ איזה גודל מכולה?\n6 קוב / 8 קוב / 12 קוב";
      branchId = 'waste_container';
    } else if (trimmed === '4' || trimmed === 'track_order') {
      branchReply = "📍 שלח מספר הזמנה ואבדוק לך מיד מול הנהג ראמי";
      branchId = 'track_order';
    } else if (clean.text.includes('בדיקה') || trimmed === 'test') {
      branchReply = "הבדיקה עברה בהצלחה 👍 מערכת סבן חומרי בניין מחוברת ומוכנה לשירותך! איזה חומר תרצה להזמין היום?";
      branchId = 'test_check';
    } else {
      // 4. Free AI Chat Engine using Gemini (handles queries like "ברזל 2 טון לכפר סבא")
      aiUsed = true;
      branchId = 'ai_free_reply';
      branchReply = "שלום! נשמח לתאם הובלת חומרים 🏗️🚚. כדי שנוכל לתאם במדויק, אנא ציין: כמות, כתובת אספקה מלאה, ותאריך רצוי.";

      try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (apiKey) {
          const ai = new GoogleGenAI();
          const prompt = `System Instructions:\n${SYSTEM_PROMPT}\n\nלקוח: ${clean.text}\nמענה קצר:`;
          const res = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: prompt
          });
          if (res.text) {
            branchReply = res.text.trim();
          }
        }
      } catch (aiErr) {
        console.error('AI chat error:', aiErr);
      }
    }

    // 5. Send reply via WhatsApp Cloud API
    try {
      let cleanTo = clean.from;
      if (cleanTo.startsWith('05')) {
        cleanTo = '972' + cleanTo.slice(1);
      }
      await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${WHATSAPP_PHONE_ID}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: cleanTo,
          type: 'text',
          text: { body: branchReply }
        })
      });
    } catch (sendErr) {
      console.error('WhatsApp send error:', sendErr);
    }

    // 6. Save all to logs in Firebase (Requirements 4 & 5)
    try {
      const logPayload = {
        incoming: clean.text,
        reply: branchReply,
        branch_id: branchId,
        ai_used: aiUsed,
        action: "auto_reply_sent",
        timestamp: clean.timestamp
      };

      // /logs/whatsapp/{phone}/{timestamp}
      await fetch(`${FB_ROOT}/logs/whatsapp/${clean.from}/${clean.timestamp}.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(logPayload)
      }).catch(() => {});

      await fetch(`${FB_ROOT}/joni/logs/${clean.from}/${clean.timestamp}.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(logPayload)
      }).catch(() => {});

      // /conversations/{phone}
      const convPayload = {
        lastMessage: branchReply,
        flowPosition: branchId,
        name: clean.name,
        updatedAt: new Date().toISOString()
      };

      await fetch(`${FB_ROOT}/conversations/${clean.from}.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(convPayload)
      }).catch(() => {});

      await fetch(`${FB_ROOT}/joni/conversations/${clean.from}.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(convPayload)
      }).catch(() => {});
    } catch (fbLogErr) {
      console.error('Firebase logs error:', fbLogErr);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      received: clean,
      reply: branchReply,
      branch_id: branchId,
      ai_used: aiUsed
    }), {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  }
}

export async function GET() {
  return new Response(JSON.stringify({ status: "joni webhook alive" }), {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}
