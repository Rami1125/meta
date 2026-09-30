// App Router handler for JONI Webhook (Next.js / Vercel)
// Handles WhatsApp incoming webhook, Global Catch-All Welcome Menu, Outgoing Dispatch Logging & Plain Text Fallback

const FB_ROOT = "https://saban-ai-drive-default-rtdb.europe-west1.firebasedatabase.app";
const GRAPH_VERSION = process.env.GRAPH_VERSION || 'v20.0';

export const FALLBACK_WELCOME_TEXT = `ח. סבן חומרי בניין 🏗️

ברוכים הבאים למרכז ההזמנות! הקלד מספר לבחירה:

1 - 🚚 הזמנה והובלה לאתר

2 - 🏭 איסוף עצמי ושעות פעילות

3 - 🗑️ מכולות פסולת (6/8/12 קוב)

4 - 🔍 מעקב משלוח ונהגים`;

function getMetaCredentials() {
  const token = process.env.WHATSAPP_TOKEN || '';
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_ID || '646128321917738';
  return { token, phoneId };
}

export async function sendWhatsAppMessage(to: string, payload: any): Promise<{ success: boolean; status?: number; messageId?: string; error?: any }> {
  const { token, phoneId } = getMetaCredentials();
  let cleanTo = String(to).replace(/[^0-9]/g, '');
  if (cleanTo.startsWith('05')) {
    cleanTo = '972' + cleanTo.slice(1);
  }

  const endpoint = `https://graph.facebook.com/${GRAPH_VERSION}/${phoneId}/messages`;
  const body = {
    messaging_product: 'whatsapp',
    to: cleanTo,
    ...payload
  };

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const status = res.status;
    const resText = await res.text();
    let data: any = {};
    try {
      data = JSON.parse(resText);
    } catch {
      data = { raw: resText };
    }

    console.log(`[Meta Graph API Outgoing] Status Code: ${status}, Response:`, JSON.stringify(data));

    const isAuthError = status === 401 ||
      status === 403 ||
      data?.error?.code === 190 ||
      data?.error?.type === 'OAuthException' ||
      (typeof data?.error?.message === 'string' && (
        data.error.message.includes('Session has expired') ||
        data.error.message.includes('Error validating access token') ||
        data.error.message.includes('The access token could not be decrypted')
      ));

    if (isAuthError) {
      console.error("WHATSAPP_TOKEN is expired or invalid in Vercel env");
    }

    if (res.ok && data?.messages?.[0]?.id) {
      return { success: true, status, messageId: data.messages[0].id };
    } else {
      return { success: false, status, error: data };
    }
  } catch (err: any) {
    console.error("Network error sending WhatsApp message to Meta Graph API:", err);
    return { success: false, error: err.message };
  }
}

export async function sendWhatsAppText(to: string, text: string) {
  return await sendWhatsAppMessage(to, {
    type: 'text',
    text: { body: text }
  });
}

export async function sendWelcomeMenuWithFallback(to: string): Promise<{ success: boolean; mode: string; messageId?: string; reply: string }> {
  const interactivePayload = {
    type: 'interactive',
    interactive: {
      type: 'list',
      header: {
        type: 'text',
        text: 'ח. סבן חומרי בניין 🏗️'
      },
      body: {
        text: 'ברוכים הבאים למרכז ההזמנות! הקלד מספר או בחר שירות מהתפריט:'
      },
      footer: {
        text: 'כפר ברא | ראמי 050-8860896'
      },
      action: {
        button: 'בחר שירות',
        sections: [
          {
            title: 'שירותי ח. סבן',
            rows: [
              {
                id: 'order_delivery',
                title: '🚚 הזמנה והובלה לאתר',
                description: 'ברזל, מלט, בלוקים וחול'
              },
              {
                id: 'self_pickup',
                title: '🏭 איסוף עצמי ושעות',
                description: 'מחסן כפר ברא פתוח'
              },
              {
                id: 'waste_container',
                title: '🗑️ מכולות פסולת',
                description: '6, 8, 12 קוב ברמסע'
              },
              {
                id: 'track_order',
                title: '🔍 מעקב משלוח ונהגים',
                description: 'בירור סטטוס אספקה'
              }
            ]
          }
        ]
      }
    }
  };

  console.log(`[Dispatching Menu] Attempting Interactive List Menu to ${to}...`);
  const listResult = await sendWhatsAppMessage(to, interactivePayload);

  if (listResult.success) {
    console.log(`[Dispatching Menu] Interactive List Menu sent successfully to ${to}`);
    return {
      success: true,
      mode: 'interactive',
      messageId: listResult.messageId,
      reply: 'תפריט אינטראקטיבי נשלח'
    };
  }

  console.warn(`[Dispatching Menu] Interactive List Menu failed. Sending plain text fallback to ${to}...`);
  const textResult = await sendWhatsAppText(to, FALLBACK_WELCOME_TEXT);
  return {
    success: textResult.success,
    mode: 'plain_text_fallback',
    messageId: textResult.messageId,
    reply: FALLBACK_WELCOME_TEXT
  };
}

export async function POST(req: any) {
  try {
    const rawBody = await req.text();
    console.log("JONI WEBHOOK RAW:", rawBody);

    let data: any;
    try {
      data = JSON.parse(rawBody);
    } catch {
      data = { text: rawBody, from: "unknown" };
    }

    const now = Date.now();
    const cleanPayload = {
      from: String(data.from || data.phone || data.waId || "972508860896").replace(/[^0-9]/g, ""),
      text: String(data.text || data.message || data.body || "").substring(0, 1000),
      name: String(data.name || data.pushName || "לקוח").substring(0, 100),
      timestamp: now,
      message_id: `wamid_${now}`,
      source: "joni"
    };

    // 1. Write incoming message to Firebase RTDB
    try {
      await fetch(`${FB_ROOT}/joni/incoming.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(cleanPayload)
      });

      await fetch(`${FB_ROOT}/joni/last.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(cleanPayload)
      });
    } catch (fbErr) {
      console.error("Error writing incoming to Firebase:", fbErr);
    }

    // 2. Fetch existing session
    let userSession: any = null;
    try {
      const sessionRes = await fetch(`${FB_ROOT}/sessions/${cleanPayload.from}.json`);
      if (sessionRes.ok) {
        userSession = await sessionRes.json();
      }
    } catch (sessionErr) {
      console.warn("Could not read user session:", sessionErr);
    }

    const isSessionActive = userSession &&
      userSession.step &&
      userSession.step !== 'completed' &&
      userSession.step !== 'idle' &&
      (now - (userSession.updatedAt || 0) < 2 * 60 * 60 * 1000);

    const trimmedText = cleanPayload.text.trim();
    const lower = trimmedText.toLowerCase();

    const listId = data.listReplyId || data.rowId || data.interactive?.list_reply?.id;
    const buttonId = data.buttonReplyId || data.interactive?.button_reply?.id;
    const selectedId = listId || buttonId;

    let replyText = '';
    let branchId = '';
    let sessionUpdate: any = null;

    const isResetCommand = trimmedText === 'תפריט' ||
      lower === 'menu' ||
      trimmedText === 'התחלה' ||
      lower === 'start' ||
      trimmedText === '0';

    if (isResetCommand) {
      const menuResult = await sendWelcomeMenuWithFallback(cleanPayload.from);
      replyText = menuResult.reply;
      branchId = 'welcome_menu';
      sessionUpdate = { step: 'welcome_menu', updatedAt: now };

    } else if (selectedId || ['1', '2', '3', '4'].includes(trimmedText)) {
      const choice = selectedId || trimmedText;
      const normalizedChoice = (choice === '1' || choice === 'order_delivery' || choice === 'delivery') ? 'order_delivery'
        : (choice === '2' || choice === 'self_pickup' || choice === 'pickup') ? 'self_pickup'
        : (choice === '3' || choice === 'waste_container' || choice === 'containers') ? 'waste_container'
        : (choice === '4' || choice === 'track_order' || choice === 'tracking') ? 'track_order'
        : choice;

      if (normalizedChoice === 'order_delivery') {
        replyText = "🚚 מעולה! איזה חומר וכמות נדרשת? (לדוגמה: 2 טון ברזל, 5 משטחי בלוקים, מלט נשר) ולאיזו כתובת לשלוח עם משאית מנוף?";
        branchId = 'order_delivery';
        sessionUpdate = { step: 'await_delivery_details', chosenMenu: 'order_delivery', updatedAt: now };
        await sendWhatsAppText(cleanPayload.from, replyText);

      } else if (normalizedChoice === 'self_pickup') {
        replyText = "🏭 מחסן כפר ברא פתוח בימים א-ה 06:30-17:00, וביום שישי 06:30-13:00.\nמה תרצה שנכין לך לאיסוף עצמי?";
        branchId = 'self_pickup';
        sessionUpdate = { step: 'await_pickup_details', chosenMenu: 'self_pickup', updatedAt: now };
        await sendWhatsAppText(cleanPayload.from, replyText);

      } else if (normalizedChoice === 'waste_container') {
        replyText = "🗑️ שירות מכולות פסולת - ח. סבן\nאיזה סוג פעולה למכולה נדרש באתר?\n\n1️⃣ 📍 הצבה חדשה (הבאת מכולה ריקה לאתר)\n2️⃣ 🔄 החלפה (הוצאת מכולה מלאה והצבת ריקה)\n3️⃣ 🚛 הוצאה ופינוי (פינוי סופי של המכולה וסגירת האתר)";
        branchId = 'waste_container';
        sessionUpdate = { step: 'await_container_action', chosenMenu: 'waste_container', updatedAt: now };
        await sendWhatsAppText(cleanPayload.from, replyText);

      } else if (normalizedChoice === 'track_order') {
        replyText = "🔍 מעקב משלוח ונהגים:\nאנא שלח מספר הזמנה או שם המזמין, ונבדוק עבורך מיד מול מנהל ההפצה ראמי מסארווה (050-886-0896) 📞";
        branchId = 'track_order';
        sessionUpdate = { step: 'await_tracking', chosenMenu: 'track_order', updatedAt: now };
        await sendWhatsAppText(cleanPayload.from, replyText);
      }

    } else if (isSessionActive && userSession.step.startsWith('await_')) {
      const step = userSession.step;

      if (step === 'await_delivery_details' || step === 'await_material' || step === 'await_quantity' || step === 'await_address') {
        const taskId = `task_del_${now}`;
        try {
          await fetch(`${FB_ROOT}/joni/tasks/${taskId}.json`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({
              id: taskId,
              clientPhone: cleanPayload.from,
              clientName: cleanPayload.name || 'לקוח הזמנה',
              title: `הזמנת חומרים: ${trimmedText.slice(0, 35)}`,
              description: trimmedText,
              category: 'delivery',
              status: 'pending',
              priority: 'urgent',
              assignedTo: 'ראמי מסארווה (050-886-0896)',
              createdAt: new Date().toISOString()
            })
          });
        } catch (taskErr) {
          console.error("Error creating delivery task:", taskErr);
        }

        replyText = `✅ פרטי ההזמנה והמשלוח נקלטו בהצלחה!\nמנהל האספקה ראמי מסארווה (050-886-0896) יתאם איתך את מועד הגעת משאית המנוף לאתר 🚚🏗️.\n\nלחזרה לתפריט הראשי הקלד 'תפריט'.`;
        branchId = 'delivery_details_captured';
        sessionUpdate = { step: 'completed', lastDetails: trimmedText, updatedAt: now };
        await sendWhatsAppText(cleanPayload.from, replyText);

      } else if (step === 'await_container_action') {
        let action = 'הצבה חדשה';
        if (trimmedText.includes('2') || trimmedText.includes('החלפה')) {
          action = 'החלפה';
        } else if (trimmedText.includes('3') || trimmedText.includes('פינוי') || trimmedText.includes('הוצאה')) {
          action = 'הוצאה ופינוי';
        }

        replyText = "📦 אנא בחר את גודל המכולה המבוקש:\n\n⚠️ דגש תפעולי: נדרשת גישה פנויה ורחבה למשאית רמסע לצורך הנפה ופריקה.\n\n1️⃣ 📦 6 קוב (מתאים לשיפוץ קל ודירות)\n2️⃣ 📦 8 קוב (מתאים לפסולת כבדה, בלוקים ובטון)\n3️⃣ 📦 12 קוב (מתאים לפסולת עץ, גבס ונפח גדול)";
        branchId = 'container_size_menu';
        sessionUpdate = { step: 'await_container_size', containerAction: action, updatedAt: now };
        await sendWhatsAppText(cleanPayload.from, replyText);

      } else if (step === 'await_container_size') {
        let size = '8 קוב';
        if (trimmedText.includes('1') || trimmedText.includes('6')) {
          size = '6 קוב';
        } else if (trimmedText.includes('3') || trimmedText.includes('12')) {
          size = '12 קוב';
        }

        replyText = "📍 מעולה! אנא רשום לי בהודעה: כתובת האספקה המדויקת להצבת המכולה (עיר, רחוב ומספר), איש קשר באתר, ותאריך/שעה מבוקשים:";
        branchId = 'container_site_details';
        sessionUpdate = { ...userSession, step: 'await_container_site_details', containerSize: size, updatedAt: now };
        await sendWhatsAppText(cleanPayload.from, replyText);

      } else if (step === 'await_container_site_details') {
        const action = userSession.containerAction || 'הצבה חדשה';
        const size = userSession.containerSize || '8 קוב';
        const address = trimmedText;
        const taskId = `task_cnt_${now}`;

        try {
          await fetch(`${FB_ROOT}/joni/tasks/${taskId}.json`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({
              id: taskId,
              clientPhone: cleanPayload.from,
              clientName: cleanPayload.name || 'לקוח מכולה',
              title: `מכולת ${size} (${action}) - ${address.slice(0, 30)}`,
              description: `פעולה: ${action} | נפח: ${size} | כתובת ופרטי אתר: ${address}`,
              category: 'containers',
              status: 'pending',
              priority: 'urgent',
              assignedTo: 'ראמי מסארווה (050-886-0896)',
              createdAt: new Date().toISOString()
            })
          });
        } catch (taskErr) {
          console.error("Error creating container task:", taskErr);
        }

        replyText = `✅ פרטי המכולה נקלטו בהצלחה!\n📍 סוג פעולה: ${action}\n📦 נפח מכולה: ${size}\n🏠 כתובת האתר: ${address}\n\nנוצרה משימת תיאום עבור ראמי מסארווה (050-886-0896) לתיאום משאית רמסע 🚛.\nלחזרה לתפריט הראשי הקלד 'תפריט'.`;
        branchId = 'create_container_task';
        sessionUpdate = { step: 'completed', updatedAt: now };
        await sendWhatsAppText(cleanPayload.from, replyText);

      } else if (step === 'await_pickup_details') {
        replyText = "👍 הפרטים נקלטו בהצלחה! צוות המחסן בכפר ברא יכין עבורך את החומרים. לכל שאלה או תיאום איסוף: ראמי מסארווה ב-050-8860896 🏪.\nלחזרה לתפריט הראשי הקלד 'תפריט'.";
        branchId = 'pickup_details_captured';
        sessionUpdate = { step: 'completed', updatedAt: now };
        await sendWhatsAppText(cleanPayload.from, replyText);

      } else if (step === 'await_tracking') {
        replyText = "🔍 פנייתך למעקב משלוח הועברה ישירות לראמי מסארווה (050-886-0896). נחזור אליך בהקדם עם מיקום הנהג וההזמנה 🚚.\nלחזרה לתפריט הראשי הקלד 'תפריט'.";
        branchId = 'tracking_inquired';
        sessionUpdate = { step: 'completed', updatedAt: now };
        await sendWhatsAppText(cleanPayload.from, replyText);
      }

    } else {
      // GLOBAL CATCH-ALL TRIGGER:
      console.log(`[Global Catch-All Trigger] Dispatching welcome menu to ${cleanPayload.from}...`);
      const menuResult = await sendWelcomeMenuWithFallback(cleanPayload.from);
      replyText = menuResult.reply;
      branchId = 'welcome_menu';
      sessionUpdate = { step: 'welcome_menu', updatedAt: now };
    }

    // 3. Update session
    if (sessionUpdate) {
      try {
        await fetch(`${FB_ROOT}/sessions/${cleanPayload.from}.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify(sessionUpdate)
        });
      } catch (sErr) {
        console.error("Error updating session in Firebase:", sErr);
      }
    }

    // 4. Save to Logs and Conversations
    try {
      const logPayload = {
        from: cleanPayload.from,
        customer_name: cleanPayload.name,
        incoming_text: cleanPayload.text,
        selected_menu_id: branchId,
        sent_response: replyText,
        response_type: 'whatsapp_response',
        timestamp: now,
        channel: 'joni',
        status: 'sent'
      };

      await fetch(`${FB_ROOT}/joni/logs/${cleanPayload.from}/${now}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(logPayload)
      });

      await fetch(`${FB_ROOT}/conversations/${cleanPayload.from}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          from: `+${cleanPayload.from}`,
          customerName: cleanPayload.name,
          lastMessage: replyText,
          lastTimestamp: new Date(now).toISOString(),
          status: 'active'
        })
      });
    } catch (logErr) {
      console.error("Error updating logs/conversations in Firebase:", logErr);
    }

    return new Response(JSON.stringify({
      success: true,
      received: cleanPayload,
      reply: replyText,
      branch_id: branchId
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });

  } catch (error: any) {
    console.error("JONI HANDLER ERROR:", error);
    return new Response(JSON.stringify({ status: "error_handled", error: error.message }), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }
}

export async function GET() {
  return new Response(JSON.stringify({
    joni: "alive",
    phone_id: process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_ID || '646128321917738',
    time: Date.now()
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}
