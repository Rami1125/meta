// Webhook handler for Meta WhatsApp Cloud API / JONI (Vercel Serverless & Cloud Run endpoint)
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID || '646128321917738';
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || 'EAAfybToWbKABSiSBQ2DC7MzDWwVTAZA583wK5RJsxGjTvfzgwMWVZB20EsdP1frjZAeXqZB16dJZCZA3C15K1YEtkQgLuCEPzVsoD8r5ftsQyy2Ys7TcFlsi0m6RRZASZBm8KHGHZBx6GocsVpWukIUKwlHLbt2l53VM2IgcCZCpZCPaVapi1sih258Mes2irUGKQZDZD';
const GRAPH_VERSION = process.env.GRAPH_VERSION || 'v20.0';

const sessions = new Map();

export async function updateSession(from, sessionData) {
  const cleanFrom = String(from).replace(/[^0-9]/g, '');
  sessions.set(cleanFrom, {
    ...sessions.get(cleanFrom),
    ...sessionData,
    updatedAt: new Date().toISOString()
  });
  console.log(`Session updated for ${cleanFrom}:`, sessionData);
}

export async function sendWhatsAppText(to, text) {
  let cleanTo = String(to).replace(/[^0-9]/g, '');
  if (cleanTo.startsWith('05')) {
    cleanTo = '972' + cleanTo.slice(1);
  }
  const endpoint = `https://graph.facebook.com/${GRAPH_VERSION}/${WHATSAPP_PHONE_ID}/messages`;
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
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    console.log(`WhatsApp text dispatched to ${cleanTo}, status: ${res.status}:`, JSON.stringify(data));
    return data;
  } catch (err) {
    console.error('Error sending WhatsApp text:', err);
    throw err;
  }
}

export default async function handler(req, res) {
  // 1. GET Webhook Verification
  if (req.method === 'GET') {
    const mode = req.query?.['hub.mode'];
    const token = req.query?.['hub.verify_token'];
    const challenge = req.query?.['hub.challenge'];

    if (mode === 'subscribe' && (token === 'saban_studio_verify_token' || !token)) {
      console.log('Webhook verification successful');
      return res.status(200).send(challenge);
    }
    return res.status(200).send(challenge || 'VERIFIED');
  }

  // 2. POST Message Webhook Event
  if (req.method === 'POST') {
    try {
      const entry = req.body?.entry?.[0]?.changes?.[0]?.value;
      const message = entry?.messages?.[0] || req.body?.message || req.body;
      const from = message?.from ? `${message.from}` : (req.body?.from || '972508860896');

      if (message && message.type === 'interactive') {
        const listId = message.interactive?.list_reply?.id;
        const buttonId = message.interactive?.button_reply?.id;
        const selectedId = listId || buttonId;

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
          await sendWhatsAppText(from, flows[normalizedId].text);
          await updateSession(from, { step: flows[normalizedId].next, lastChoice: normalizedId });
          if (res.sendStatus) {
            return res.sendStatus(200);
          }
          return res.status(200).send("OK");
        }
      }

      if (res.sendStatus) {
        return res.sendStatus(200);
      }
      return res.status(200).send("EVENT_RECEIVED");
    } catch (err) {
      console.error('Webhook execution error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).send('Method Not Allowed');
}
