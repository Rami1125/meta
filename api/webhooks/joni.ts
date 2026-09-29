// Vercel Serverless Function for /api/webhooks/joni
export default async function handler(req: any, res: any) {
  if (req.method === 'GET') {
    return res.status(200).json({ status: "joni webhook alive" });
  }

  if (req.method === 'POST') {
    try {
      let body = req.body;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch {
          body = { text: body };
        }
      } else if (!body) {
        body = {};
      }

      const clean = {
        from: String(body.from || "9725").replace(/\D/g, ""),
        text: String(body.text || body.message || JSON.stringify(body)).slice(0, 1000),
        timestamp: Date.now()
      };

      await fetch("https://saban-ai-drive-default-rtdb.europe-west1.firebasedatabase.app/joni/incoming.json", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(clean)
      });

      return res.status(200).json({ success: true, received: clean });
    } catch (err: any) {
      return res.status(200).json({ status: "error_handled", error: err.message });
    }
  }

  return res.status(405).send("Method Not Allowed");
}
