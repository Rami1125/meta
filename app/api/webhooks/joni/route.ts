// App Router route for JONI webhook
export async function POST(req: Request) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      body = { text: await req.text() };
    }
    
    // Fix invalid JSON for Firebase
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

    return new Response(JSON.stringify({ success: true, received: clean }), {
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
