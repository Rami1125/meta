// JONI Incoming Webhook Handler (Vercel Serverless / Node.js)
const FB_ROOT = "https://saban-ai-drive-default-rtdb.europe-west1.firebasedatabase.app";
const FB_PATH = "joni/incoming";

const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID || '646128321917738';
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || 'EAAfybToWbKABSiSBQ2DC7MzDWwVTAZA583wK5RJsxGjTvfzgwMWVZB20EsdP1frjZAeXqZB16dJZCZA3C15K1YEtkQgLuCEPzVsoD8r5ftsQyy2Ys7TcFlsi0m6RRZASZBm8KHGHZBx6GocsVpWukIUKwlHLbt2l53VM2IgcCZCpZCPaVapi1sih258Mes2irUGKQZDZD';
const GRAPH_VERSION = process.env.GRAPH_VERSION || 'v20.0';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({ joni: "alive", time: Date.now() });
  }

  if (req.method === 'POST') {
    try {
      let rawBody = '';
      if (typeof req.body === 'string') {
        rawBody = req.body;
      } else if (req.body && typeof req.body === 'object') {
        rawBody = JSON.stringify(req.body);
      }
      console.log("JONI RAW:", rawBody);

      // 1. Parse incoming even if invalid
      let data;
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
      const fbRes = await fetch(`${FB_ROOT}/${FB_PATH}.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8'
        },
        body: jsonString
      });

      const fbResult = await fbRes.text();
      console.log("FIREBASE WRITE:", fbRes.status, fbResult);

      // 5. Also write to /joni/last for debug
      await fetch(`${FB_ROOT}/joni/last.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: jsonString
      });

      // 6. Check interactive selection
      const listId = data.listReplyId || data.rowId || data.interactive?.list_reply?.id;
      const buttonId = data.buttonReplyId || data.interactive?.button_reply?.id;
      const selectedId = listId || buttonId;

      if (selectedId) {
        console.log("MENU SELECTED:", selectedId);

        const flows = {
          order_delivery: {
            text: "🚚 מעולה! איזה חומר צריך?\n1️⃣ ברזל\n2️⃣ בלוקים\n3️⃣ מלט\n4️⃣ חול/חצץ",
            next: "await_material"
          },
          self_pickup: {
            text: "🏪 איסוף עצמי מהמחסן בכפר ברא.\nשלח מיקום או כתוב מה להכין לך?",
            next: "await_pickup_details"
          },
          waste_container: {
            text: "🗑️ איזה גודל מכולה?\n6 קוב / 8 קוב / 12 קוב",
            next: "await_container_size"
          },
          track_order: {
            text: "📍 שלח מספר הזמנה ואבדוק לך מיד",
            next: "await_tracking"
          }
        };

        const normalizedId = selectedId === 'delivery' ? 'order_delivery'
          : selectedId === 'pickup' ? 'self_pickup'
          : selectedId === 'containers' ? 'waste_container'
          : selectedId === 'tracking' ? 'track_order'
          : selectedId;

        if (flows[normalizedId]) {
          try {
            const endpoint = `https://graph.facebook.com/${GRAPH_VERSION}/${WHATSAPP_PHONE_ID}/messages`;
            await fetch(endpoint, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                messaging_product: 'whatsapp',
                to: cleanPayload.from,
                type: 'text',
                text: { body: flows[normalizedId].text }
              })
            });
          } catch (e) {
            console.error("Error sending WhatsApp message:", e);
          }
        }
      }

      return res.status(200).json({ status: "ok", fixed: true, payload: cleanPayload });

    } catch (error) {
      console.error("JONI FIX ERROR:", error);
      // Return 200 anyway so JONI doesn't retry loop
      return res.status(200).json({ status: "error_fixed", error: error.message });
    }
  }

  return res.status(405).send('Method Not Allowed');
}
