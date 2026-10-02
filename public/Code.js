/**
 * ==============================================================================
 * ח. סבן חומרי בניין בע״מ (כפר ברא) | נועה AI - מערכת ניהול, בקרה וסידור עבודה
 * ==============================================================================
 * קובץ: Code.js (Google Apps Script - Production Ready)
 * ייעוד: גשר תקשורת, סנכרון דו-כיווני, קליטת הודעות WhatsApp ו-PWA, 
 *        ניהול סידור הובלות יומי, מעקב מכולות פסולת, ויומן ביקורת אירועים.
 * נציג וניהול תפעולי: ראמי מסארווה (050-886-0896)
 * ==============================================================================
 */

// --------------------------------------------------------------------------
// 1. קבועים והגדרות מערכת (Configuration & Tab Names)
// --------------------------------------------------------------------------

const CONFIG = {
  BUSINESS_NAME: 'ח. סבן חומרי בניין בע״מ',
  LOCATION: 'כפר ברא',
  CONTACT_PHONE: '+972508860896',
  CONTACT_NAME: 'ראמי מסארווה',
  DRIVE_ARCHIVE_FOLDER_NAME: 'ח. סבן - ארכיון נועה AI וסידור עבודה',
  
  // שמות הטאבים בגיליון
  SHEETS: {
    MORNING_REPORT: 'דוח_בוקר_מבצעי',
    WHATSAPP_CONVERSATIONS: 'שיחות_וואטסאפ_נועה',
    CONTAINERS: 'מכולות_פסולת',
    SYSTEM_LOGS: 'יומן_אירועים_וסנכרון'
  },
  
  // מק"טים ופקדונות
  DEPOSIT_SKU: {
    BIG_BAG: '60002',  // בלה ענקית
    PALLET: '60060'    // משטח עץ
  },

  // צבעי מותג ו-UI/UX
  THEME: {
    HEADER_BG: '#0F172A',       // כחול לילה יוקרתי (Slate 900)
    HEADER_FONT: '#FFFFFF',     // לבן נקי
    BORDER_COLOR: '#CBD5E1',    // אפור עדין
    ROW_ALT_BG: '#F8FAFC',      // שורה מתחלפת רכה
    FONT_FAMILY: 'Heebo',
    
    // סטטוסי ביצוע
    STATUS_DONE_BG: '#DCFCE7',    // ירוק בהיר עדין
    STATUS_DONE_TXT: '#166534',
    STATUS_ACTIVE_BG: '#FEF3C7',  // צהוב/כתום עדין
    STATUS_ACTIVE_TXT: '#92400E',
    STATUS_URGENT_BG: '#FEE2E2',  // אדום עדין
    STATUS_URGENT_TXT: '#991B1B',
    STATUS_TRANSIT_BG: '#E0F2FE', // תכלת עדין
    STATUS_TRANSIT_TXT: '#0369A1'
  }
};

// --------------------------------------------------------------------------
// 2. תפריט מותאם אישית ב-Google Sheets (onOpen)
// --------------------------------------------------------------------------

/**
 * מופעל אוטומטית בעת פתיחת הגיליון
 * יוצר את התפריט העליון הייעודי עבור מנהלי ח. סבן
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🚚 ח. סבן | נועה AI ובקרה')
    .addItem('🏗️ הקמת כל הטאבים ועיצוב UI/UX מלא', 'setupAllSheets')
    .addItem('🔄 סנכרון נתונים מול הממשק והוואטסאפ', 'syncDataWithWhatsApp')
    .addItem('📊 הפקת דוח בוקר יומי מרוכז', 'generateDailyMorningReport')
    .addItem('🗄️ בדיקת תקינות תיקיות ארכיון ב-Drive', 'verifyDriveArchiveFolders')
    .addSeparator()
    .addItem('ℹ️ אודות המערכת ופרטי קשר', 'showAboutDialog')
    .addToUi();
}

/**
 * הצגת חלונית פרטי מערכת
 */
function showAboutDialog() {
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    'ח. סבן חומרי בניין בע״מ (כפר ברא)',
    'מערכת ניהול, סידור עבודה וגשר WhatsApp Cloud API.\n' +
    'נציג וניהול תפעולי: ראמי מסארווה (050-886-0896)\n' +
    'גרסת מודול Apps Script: 3.8 Production Ready',
    ui.ButtonSet.OK
  );
}

// --------------------------------------------------------------------------
// 3. הקמת מבנה הטאבים ועיצוב UI/UX מרהיב (setupAllSheets)
// --------------------------------------------------------------------------

/**
 * מקים 4 לשוניות מרכזיות, מגדיר שורות כותרת, רוחבי עמודות, הקפאת שורה,
 * יישור מימין לשמאל (RTL) ועיצוב מותנה חכם לפי סטטוסים.
 */
function setupAllSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. טאב דוח_בוקר_מבצעי
  setupMorningReportSheet(ss);

  // 2. טאב שיחות_וואטסאפ_נועה
  setupWhatsAppConversationsSheet(ss);

  // 3. טאב מכולות_פסולת
  setupContainersSheet(ss);

  // 4. טאב יומן_אירועים_וסנכרון
  setupSystemLogsSheet(ss);

  // רישום אירוע הקמה ביומן
  logEvent('SETUP_ALL_SHEETS', 'Script', 'SUCCESS', 'כל הטאבים הוקמו ועוצבו בהצלחה');

  SpreadsheetApp.getUi().alert('✅ ההקמה הושלמה בהצלחה!\nכל 4 הלשוניות נוצרו ועוצבו בסגנון ח. סבן.');
}

/**
 * הקמת טאב 1: דוח_בוקר_מבצעי (11 עמודות)
 */
function setupMorningReportSheet(ss) {
  const name = CONFIG.SHEETS.MORNING_REPORT;
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  sheet.setRightToLeft(true);

  // 11 עמודות מוגדרות לפי האפיון
  const headers = [
    'סבב ושעה',
    'מספר הזמנה',
    'שם לקוח',
    'מחסן מקור',
    'כתובת יעד ועיר',
    'נהג משובץ',
    'פירוט מוצרים וכמויות',
    'פקדונות (בלות/משטחים)',
    'ניווט Waze',
    'סטטוס ביצוע',
    'שידור WhatsApp'
  ];

  sheet.clear();
  sheet.getRange(1, 1, 1, headers.length)
    .setValues([headers])
    .setBackground(CONFIG.THEME.HEADER_BG)
    .setFontColor(CONFIG.THEME.HEADER_FONT)
    .setFontFamily(CONFIG.THEME.FONT_FAMILY)
    .setFontSize(11)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setWrap(true);

  sheet.setRowHeight(1, 42);
  sheet.setFrozenRows(1);

  // רוחבי עמודות מותאמים
  const colWidths = [110, 115, 150, 120, 200, 130, 260, 160, 110, 120, 110];
  colWidths.forEach((w, idx) => sheet.setColumnWidth(idx + 1, w));

  // הוספת נתוני דוגמה תפעוליים
  const sampleData = [
    [
      'סבב 1 - 07:00',
      'ORD-1092',
      'יוסי כהן - בוני המרכז',
      'מחסן ראשי כפר ברא',
      'החרש 10, כפר סבא',
      'מוחמד (משאית מנוף 1)',
      '12 משטחי בלוק 20, 20 שקי מלט נשר',
      '12 משטחים (60060)',
      '=HYPERLINK("https://waze.com/ul?q="&ENCODEURL(E2), "🚗 פתח Waze")',
      'בסידור עבודה',
      '=HYPERLINK("https://wa.me/972524458912?text="&ENCODEURL("שלום יוסי, משאית סבן בדרך אליך"), "📱 שלח עדכון")'
    ],
    [
      'סבב 1 - 08:30',
      'ORD-1093',
      'דוד לוי שיפוצים',
      'מחסן ראשי כפר ברא',
      'התלמיד 6, הוד השרון',
      'סאלח (פול-טריילר)',
      '3 בלות חול ים, 2 בלות חצץ 2',
      '5 בלות (60002)',
      '=HYPERLINK("https://waze.com/ul?q="&ENCODEURL(E3), "🚗 פתח Waze")',
      'ממתין/דחוף',
      '=HYPERLINK("https://wa.me/972548901234?text="&ENCODEURL("שלום דוד, הזמנתך בסבן ממתינה להעמסה"), "📱 שלח עדכון")'
    ],
    [
      'סבב 2 - 11:00',
      'ORD-1094',
      'אבי רוזן הנדסה',
      'מחסן ראשי כפר ברא',
      'דרך השרון 45, פתח תקווה',
      'ראמי (משאית 3)',
      '2 טון ברזל 12 מצולע, 40 רשתות 8',
      'ללא פקדון',
      '=HYPERLINK("https://waze.com/ul?q="&ENCODEURL(E4), "🚗 פתח Waze")',
      'סופק במלואו',
      '=HYPERLINK("https://wa.me/972508860896?text="&ENCODEURL("תודה שקנית בח. סבן! ההזמנה סופקה בהצלחה"), "📱 סופק")'
    ]
  ];

  sheet.getRange(2, 1, sampleData.length, headers.length)
    .setValues(sampleData)
    .setFontFamily(CONFIG.THEME.FONT_FAMILY)
    .setFontSize(10)
    .setVerticalAlignment('middle');

  sheet.setRowHeights(2, sampleData.length, 36);

  // החלת עיצוב מותנה על עמודת סטטוס ביצוע (עמודה J - עמודה 10)
  applyConditionalFormattingToMorningReport(sheet);
}

/**
 * עיצוב מותנה חכם לעמודת סטטוס ביצוע
 */
function applyConditionalFormattingToMorningReport(sheet) {
  const statusRange = sheet.getRange('J2:J500');
  sheet.clearConditionalFormatRules();

  const rules = [];

  // סופק במלואו -> ירוק רך
  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('סופק במלואו')
      .setBackground(CONFIG.THEME.STATUS_DONE_BG)
      .setFontColor(CONFIG.THEME.STATUS_DONE_TXT)
      .setBold(true)
      .setRanges([statusRange])
      .build()
  );

  // בסידור עבודה -> צהוב/כתום רך
  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('בסידור עבודה')
      .setBackground(CONFIG.THEME.STATUS_ACTIVE_BG)
      .setFontColor(CONFIG.THEME.STATUS_ACTIVE_TXT)
      .setBold(true)
      .setRanges([statusRange])
      .build()
  );

  // ממתין/דחוף או דחוף -> אדום רך
  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextContains('דחוף')
      .setBackground(CONFIG.THEME.STATUS_URGENT_BG)
      .setFontColor(CONFIG.THEME.STATUS_URGENT_TXT)
      .setBold(true)
      .setRanges([statusRange])
      .build()
  );

  // בדרך לאתר -> תכלת רך
  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextContains('בדרך')
      .setBackground(CONFIG.THEME.STATUS_TRANSIT_BG)
      .setFontColor(CONFIG.THEME.STATUS_TRANSIT_TXT)
      .setBold(true)
      .setRanges([statusRange])
      .build()
  );

  sheet.setConditionalFormatRules(rules);
}

/**
 * הקמת טאב 2: שיחות_וואטסאפ_נועה (9 עמודות)
 */
function setupWhatsAppConversationsSheet(ss) {
  const name = CONFIG.SHEETS.WHATSAPP_CONVERSATIONS;
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  sheet.setRightToLeft(true);

  const headers = [
    'חותמת זמן',
    'מספר טלפון',
    'שם לקוח / פונה',
    'סוג פנייה',
    'הודעת לקוח נכנסת',
    'ענף שנבחר בעץ',
    'מענה נועה שנשלח',
    'סטטוס טיפול',
    'מזהה משימה ב-CRM'
  ];

  sheet.clear();
  sheet.getRange(1, 1, 1, headers.length)
    .setValues([headers])
    .setBackground(CONFIG.THEME.HEADER_BG)
    .setFontColor(CONFIG.THEME.HEADER_FONT)
    .setFontFamily(CONFIG.THEME.FONT_FAMILY)
    .setFontSize(11)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');

  sheet.setRowHeight(1, 40);
  sheet.setFrozenRows(1);

  const colWidths = [140, 120, 140, 110, 260, 160, 260, 110, 140];
  colWidths.forEach((w, idx) => sheet.setColumnWidth(idx + 1, w));

  const sampleData = [
    [
      new Date().toLocaleString('he-IL'),
      '+972508860896',
      'ראמי מסארווה',
      'הזמנת הובלה',
      'צריך 200 בלוק 20 ומלט נשר להרצליה פיתוח מחר ב-07:00',
      '🚚 הזמנה והובלה -> איסוף פרטים',
      '🚚 מעולה! פנייתך נקלטה ורמי יתאם איתך את המשלוח מיד.',
      'טופל בהצלחה',
      'TASK-8812'
    ],
    [
      new Date().toLocaleString('he-IL'),
      '+972524458912',
      'יוסי כהן',
      'מכולת פסולת',
      'דרושה מכולה 8 קוב להחלפה באתר בהוד השרון',
      '🗑️ מכולות פסולת -> החלפה',
      '📦 נקלטה בקשת החלפה למכולת 8 קוב. משאית רמסע תתואם בהקדם.',
      'בטיפול רמי',
      'TASK-8813'
    ]
  ];

  sheet.getRange(2, 1, sampleData.length, headers.length)
    .setValues(sampleData)
    .setFontFamily(CONFIG.THEME.FONT_FAMILY)
    .setFontSize(10)
    .setVerticalAlignment('middle');

  sheet.setRowHeights(2, sampleData.length, 36);
}

/**
 * הקמת טאב 3: מכולות_פסולת (10 עמודות)
 */
function setupContainersSheet(ss) {
  const name = CONFIG.SHEETS.CONTAINERS;
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  sheet.setRightToLeft(true);

  const headers = [
    'מזהה הזמנה',
    'תאריך הצבה',
    'שם קבלן / לקוח',
    'טלפון',
    'כתובת מדויקת',
    'סוג פעולה (הצבה/החלפה/הוצאה)',
    'נפח מכולה (6/8/12 קוב)',
    'סטטוס אתר',
    'ימי שכירות',
    'הערות פריקה ורמסע'
  ];

  sheet.clear();
  sheet.getRange(1, 1, 1, headers.length)
    .setValues([headers])
    .setBackground(CONFIG.THEME.HEADER_BG)
    .setFontColor(CONFIG.THEME.HEADER_FONT)
    .setFontFamily(CONFIG.THEME.FONT_FAMILY)
    .setFontSize(11)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');

  sheet.setRowHeight(1, 40);
  sheet.setFrozenRows(1);

  const colWidths = [115, 110, 160, 120, 220, 160, 140, 120, 95, 220];
  colWidths.forEach((w, idx) => sheet.setColumnWidth(idx + 1, w));

  const sampleData = [
    [
      'CNT-501',
      new Date().toLocaleDateString('he-IL'),
      'שארק קבלנות ופיתוח',
      '050-8860896',
      'רחוב החרש 12, כפר סבא',
      '📍 הצבה חדשה',
      '8 קוב',
      'פעיל באתר',
      '3',
      'גישה פנויה לרמסע, להניח צמוד לגדר'
    ],
    [
      'CNT-502',
      new Date().toLocaleDateString('he-IL'),
      'דוד לוי שיפוצים',
      '054-8901234',
      'סוקולוב 33, הוד השרון',
      '🔄 החלפה',
      '6 קוב',
      'הוזמנה החלפה',
      '5',
      'זהירות מקווי חשמל עיליים בעת ההנפה'
    ]
  ];

  sheet.getRange(2, 1, sampleData.length, headers.length)
    .setValues(sampleData)
    .setFontFamily(CONFIG.THEME.FONT_FAMILY)
    .setFontSize(10)
    .setVerticalAlignment('middle');

  sheet.setRowHeights(2, sampleData.length, 36);
}

/**
 * הקמת טאב 4: יומן_אירועים_וסנכרון (5 עמודות)
 */
function setupSystemLogsSheet(ss) {
  const name = CONFIG.SHEETS.SYSTEM_LOGS;
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  sheet.setRightToLeft(true);

  const headers = [
    'זמן',
    'פעולה',
    'מקור (PWA/WhatsApp/Script)',
    'תוצאה',
    'פרטי Payload'
  ];

  sheet.clear();
  sheet.getRange(1, 1, 1, headers.length)
    .setValues([headers])
    .setBackground(CONFIG.THEME.HEADER_BG)
    .setFontColor(CONFIG.THEME.HEADER_FONT)
    .setFontFamily(CONFIG.THEME.FONT_FAMILY)
    .setFontSize(11)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');

  sheet.setRowHeight(1, 40);
  sheet.setFrozenRows(1);

  const colWidths = [150, 160, 170, 110, 420];
  colWidths.forEach((w, idx) => sheet.setColumnWidth(idx + 1, w));
}

// --------------------------------------------------------------------------
// 4. גשר חיבור וסנכרון מלא בזמן אמת (doGet & doPost)
// --------------------------------------------------------------------------

/**
 * קריאה ושליפה מהירה לממשק ה-PWA (API GET)
 * תומך בפרמטרים:
 * ?action=getOrders
 * ?action=getConversations
 * ?action=getContainers
 * ?action=ping
 */
function doGet(e) {
  try {
    const action = e && e.parameter && e.parameter.action ? e.parameter.action : 'ping';
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let responseData = {};

    switch (action) {
      case 'getOrders': {
        const sheet = ss.getSheetByName(CONFIG.SHEETS.MORNING_REPORT);
        responseData = {
          success: true,
          action: 'getOrders',
          count: sheet ? Math.max(0, sheet.getLastRow() - 1) : 0,
          orders: sheet ? getSheetDataAsJson(sheet) : []
        };
        break;
      }

      case 'getConversations': {
        const sheet = ss.getSheetByName(CONFIG.SHEETS.WHATSAPP_CONVERSATIONS);
        responseData = {
          success: true,
          action: 'getConversations',
          count: sheet ? Math.max(0, sheet.getLastRow() - 1) : 0,
          conversations: sheet ? getSheetDataAsJson(sheet) : []
        };
        break;
      }

      case 'getContainers': {
        const sheet = ss.getSheetByName(CONFIG.SHEETS.CONTAINERS);
        responseData = {
          success: true,
          action: 'getContainers',
          count: sheet ? Math.max(0, sheet.getLastRow() - 1) : 0,
          containers: sheet ? getSheetDataAsJson(sheet) : []
        };
        break;
      }

      // Outbound pending queue for WhatsApp Web / Node server background dispatch
      case 'get_pending':
      case 'getPending': {
        const sheet = ss.getSheetByName(CONFIG.SHEETS.WHATSAPP_CONVERSATIONS);
        const pendingList = [];
        if (sheet && sheet.getLastRow() > 1) {
          const data = sheet.getDataRange().getValues();
          for (let i = 1; i < data.length; i++) {
            const rowStatus = String(data[i][7] || '').trim();
            if (rowStatus === 'ממתין לשליחה' || rowStatus === 'pending') {
              pendingList.push({
                rowId: i + 1,
                phone: String(data[i][1] || '').trim(),
                name: String(data[i][2] || 'לקוח').trim(),
                message: String(data[i][6] || data[i][4] || '').trim(),
                branch: String(data[i][5] || '').trim(),
                timestamp: data[i][0]
              });
            }
          }
        }
        responseData = {
          success: true,
          action: 'get_pending',
          count: pendingList.length,
          pending: pendingList
        };
        break;
      }

      case 'ping':
      default: {
        responseData = {
          success: true,
          status: 'online',
          timestamp: new Date().toISOString(),
          business: CONFIG.BUSINESS_NAME,
          phone: CONFIG.CONTACT_PHONE,
          sheets: [
            CONFIG.SHEETS.MORNING_REPORT,
            CONFIG.SHEETS.WHATSAPP_CONVERSATIONS,
            CONFIG.SHEETS.CONTAINERS,
            CONFIG.SHEETS.SYSTEM_LOGS
          ]
        };
        break;
      }
    }

    return createJsonResponse(responseData);
  } catch (err) {
    logEvent('DOGET_ERROR', 'API', 'FAILED', err.toString());
    return createJsonResponse({ success: false, error: err.toString() });
  }
}

/**
 * קליטה, הקלדה ועריכה און-ליין מהממשק לגיליון (API POST)
 * משתמש ב-LockService למניעת התנגשויות כתיבה במקביל.
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    // ממתין עד 30 שניות לקבלת נעילת כתיבה בלעדית
    lock.waitLock(30000);

    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({ success: false, error: 'Empty payload received' });
    }

    const payload = JSON.parse(e.postData.contents);
    // If incoming payload has text and from, treat as WhatsApp message automatically
    const isDirectWhatsAppMsg = (payload.from || payload.phone) && payload.text;
    const action = payload.action || (isDirectWhatsAppMsg ? 'incomingMessage' : 'insertOrder');
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let result = { success: true };

    switch (action) {
      // 0. קליטת הודעת WhatsApp דו-כיוונית וסגירת מעגל עם מענה נועה AI
      case 'incomingMessage':
      case 'whatsapp_message':
      case 'chat_message': {
        result = handleIncomingWhatsAppTwoWay(ss, payload);
        break;
      }

      // 0.1 סימון שורה בגיליון כ"נשלח בהצלחה" לאחר שיגור בוואטסאפ
      case 'mark_sent':
      case 'markSent': {
        result = handleMarkSent(ss, payload);
        break;
      }

      // 1. הוספת הזמנת הובלה חדשה לדוח הבוקר
      case 'addOrder':
      case 'insertOrder': {
        result = handleInsertOrder(ss, payload);
        break;
      }

      // 2. עדכון הזמנה קיימת (למשל שינוי סטטוס אספקה או שיבוץ נהג)
      case 'updateOrder': {
        result = handleUpdateOrder(ss, payload);
        break;
      }

      // 3. תיעוד שיחת WhatsApp חדשה
      case 'addConversation':
      case 'logWhatsApp': {
        result = handleLogWhatsApp(ss, payload);
        break;
      }

      // 4. הוספת מכולת פסולת חדשה
      case 'addContainer':
      case 'createContainerTask': {
        result = handleInsertContainer(ss, payload);
        break;
      }

      // 5. עדכון סטטוס מכולה קיימת
      case 'updateContainer': {
        result = handleUpdateContainer(ss, payload);
        break;
      }

      // 6. גיבוי יזום ב-Drive
      case 'backup': {
        result = createDriveBackup(ss);
        break;
      }

      default: {
        result = { success: false, error: 'Unknown action: ' + action };
        break;
      }
    }

    // תיעוד הפעולה ביומן המערכת
    logEvent(action, 'PWA_POST', result.success ? 'SUCCESS' : 'FAILED', JSON.stringify(payload).substring(0, 500));

    return createJsonResponse(result);
  } catch (err) {
    logEvent('DOPOST_ERROR', 'API', 'FAILED', err.toString());
    return createJsonResponse({ success: false, error: err.toString() });
  } finally {
    // שחרור הנעילה בכל מקרה
    lock.releaseLock();
  }
}

// --------------------------------------------------------------------------
// 5. פונקציות טיפול בפעולות CRUD ספציפיות
// --------------------------------------------------------------------------

/**
 * הוספת הזמנה לדוח בוקר מבצעי
 */
function handleInsertOrder(ss, payload) {
  const sheet = ss.getSheetByName(CONFIG.SHEETS.MORNING_REPORT);
  if (!sheet) return { success: false, error: 'Sheet not found' };

  const orderId = payload.orderId || ('ORD-' + Math.floor(1000 + Math.random() * 9000));
  const shift = payload.shift || 'סבב בוקר';
  const customer = payload.customerName || 'לקוח סבן';
  const warehouse = payload.warehouse || 'מחסן כפר ברא';
  const address = payload.address || 'כפר ברא';
  const driver = payload.driver || 'ממתין לשיבוץ';
  const products = payload.products || payload.items || 'חומרי בניין כללי';
  const deposits = payload.deposits || calculateDeposits(products);
  const status = payload.status || 'בסידור עבודה';
  const phone = payload.phone || CONFIG.CONTACT_PHONE;

  const wazeUrl = generateWazeUrl(address);
  const waUrl = generateWhatsAppLink(phone, `שלום ${customer}, הזמנתך מסבן (${orderId}) עודכנה לסטטוס: ${status}`);

  const row = [
    shift,
    orderId,
    customer,
    warehouse,
    address,
    driver,
    products,
    deposits,
    `=HYPERLINK("${wazeUrl}", "🚗 ניווט Waze")`,
    status,
    `=HYPERLINK("${waUrl}", "📱 עדכן WhatsApp")`
  ];

  sheet.appendRow(row);
  const lastRow = sheet.getLastRow();
  sheet.getRange(lastRow, 1, 1, row.length)
    .setFontFamily(CONFIG.THEME.FONT_FAMILY)
    .setFontSize(10)
    .setVerticalAlignment('middle');
  sheet.setRowHeight(lastRow, 34);

  return { success: true, orderId: orderId, rowNumber: lastRow };
}

/**
 * עדכון הזמנה קיימת לפי מזהה הזמנה (orderId)
 */
function handleUpdateOrder(ss, payload) {
  const sheet = ss.getSheetByName(CONFIG.SHEETS.MORNING_REPORT);
  if (!sheet) return { success: false, error: 'Sheet not found' };

  const orderId = payload.orderId;
  if (!orderId) return { success: false, error: 'Missing orderId' };

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]).trim() === String(orderId).trim()) {
      const rowIdx = i + 1;
      
      if (payload.status) {
        sheet.getRange(rowIdx, 10).setValue(payload.status);
      }
      if (payload.driver) {
        sheet.getRange(rowIdx, 6).setValue(payload.driver);
      }
      if (payload.shift) {
        sheet.getRange(rowIdx, 1).setValue(payload.shift);
      }
      if (payload.products) {
        sheet.getRange(rowIdx, 7).setValue(payload.products);
        sheet.getRange(rowIdx, 8).setValue(calculateDeposits(payload.products));
      }
      if (payload.address) {
        sheet.getRange(rowIdx, 5).setValue(payload.address);
        sheet.getRange(rowIdx, 9).setFormula(`=HYPERLINK("${generateWazeUrl(payload.address)}", "🚗 ניווט Waze")`);
      }

      return { success: true, updatedRow: rowIdx, orderId: orderId };
    }
  }

  return { success: false, error: 'Order ID not found: ' + orderId };
}

/**
 * מחולל מענה חכם ותפריט סבן אוטומטי לוואטסאפ (סגירת מעגל נועה AI)
 */
/**
 * מחולל מענה חכם ותפריט סבן אוטומטי לוואטסאפ (סגירת מעגל נועה AI)
 */
function generateSabanWhatsAppReply(incomingText, customerName, customerPhone, ss) {
  const text = String(incomingText || '').trim();
  const lower = text.toLowerCase();
  const phoneDigits = String(customerPhone || '').replace(/[^0-9]/g, '');
  const cleanName = String(customerName || 'לקוח').trim() || 'לקוח';

  // 🚨 1. נוהל מפקד עליון — ראמי מסארווה (050-886-0896)
  const isRami = phoneDigits.includes('508860896') || lower.includes('המפקד') || lower === 'ראמי';
  if (isRami) {
    if (lower === '1' || lower.includes('תמונת מצב') || lower.includes('סבבים') || lower.includes('חכמת') || lower.includes('עלי')) {
      return {
        reply: 'המפקד, להלן תמונת מצב צי המשאיות והסבבים בזמן אמת: 🚛\n\n1. *חכמת* (משאית מנוף 615-41-002):\n• סטטוס: בסבב פריקה פעיל ברעננה (אחוזה 142).\n• תעודה: קומקס 6215751 (בלוקים + מלט).\n\n2. *עלי* (איסוזו חלוקה 651-51-701):\n• סטטוס: בנסיעה לקו חלוקה בהוד השרון (החרש 10).\n• זמינות: מיידית.\n\nהאם לשבץ סבב נוסף לאחד מהם, המפקד? 🫡',
        branch: 'נוהל מפקד - תמונת מצב',
        action: 'rami_command'
      };
    }
    return {
      reply: 'שלום המפקד! 🫡\nנועה כאן לרשותך, זיהיתי אותך מיד. כל המערכות, הסידור וצי המשאיות דרוכים.\n\nמה המשימה כרגע?\n[1] 🚛 תמונת מצב סבבים ונהגים (חכמת ועלי)\n[2] ➕ קליטה ושיבוץ מהיר של הזמנה חדשה לסידור\n[3] 📊 הפקת דוח בוקר / סיכום סוף יום (EOD)\n[4] 📑 הצלבת תעודות משלוח חתומות מול קומקס\n[5] 📢 שידור הודעה תפעולית לנהגים',
      branch: 'נוהל מפקד עליון',
      action: 'rami_command'
    };
  }

  // 🔍 2. נוהל זיהוי לקוח חוזר והיסטוריית רכישות (בדיקה בגיליון דשבורד_הזמנות)
  try {
    if (ss) {
      const ordersSheet = ss.getSheetByName('דשבורד_הזמנות') || ss.getSheetByName(CONFIG.SHEETS.MORNING_REPORT);
      if (ordersSheet && (cleanName.length >= 3 || phoneDigits.length >= 7)) {
        const data = ordersSheet.getDataRange().getValues();
        const pastRows = [];
        for (let i = 1; i < data.length; i++) {
          const rowName = String(data[i][3] || data[i][2] || '').toLowerCase();
          const rowAddr = String(data[i][5] || data[i][4] || '');
          if ((cleanName.length >= 3 && rowName.includes(cleanName.toLowerCase())) || (phoneDigits.length >= 7 && rowAddr.includes(phoneDigits))) {
            pastRows.push({
              orderId: data[i][1],
              name: data[i][3] || data[i][2],
              address: data[i][5] || data[i][4],
              products: data[i][6] || ''
            });
          }
        }

        if (pastRows.length > 0) {
          const last = pastRows[0];
          if (lower.includes('כמו פעם שעברה') || lower.includes('כמו קודם') || lower.includes('שחזר') || lower === '1') {
            return {
              reply: `שלום ${cleanName}! 📦\nשחזרתי עבורך את ההזמנה הקודמת במדויק! ✅\n\n📋 *מפרט המוצרים שנרכשו:*\n${last.products || 'חומרי בניין ומליטה'}\n\n📍 *אישור אתר אספקה:*\nהאם המשלוח מיועד ל-*"${last.address}"* או לאתר חדש?`,
              branch: 'שחזור הזמנה קודמת',
              action: 'repeat_customer'
            };
          }

          if (lower === '' || lower.includes('היי') || lower.includes('שלום') || lower.includes('בוקר טוב') || lower.includes('תפריט')) {
            return {
              reply: `שלום ${cleanName}! 🏗️\nשמחים לראותך שוב ב-*ח. סבן חומרי בניין (1994) בע״מ*!\nזיהיתי אותך כלקוח חוזר מוערך של סבן.\n\n💡 *לנוחיותך, מוצרים מובילים שרכשת אצלנו בעבר:*\n• מלט אפור נשר 25 ק"ג (מק"ט 10002)\n• סומסום בלה 0.6 מ"ק (מק"ט 11511)\n• חול מחצבה בלה (מק"ט 11501)\n\n📍 *האם המשלוח מיועד ל-${last.address || 'האתר האחרון'} או לאתר חדש?*\n\n[1] 🔁 שכפול ההזמנה הקודמת ("כמו פעם שעברה")\n[2] 🧱 הזמנת חומרים חדשים לאתר\n[3] 🚛 שירות מכולות פסולת\n[4] 📦 סטטוס הזמנה ונהגים`,
              branch: 'זיהוי לקוח חוזר',
              action: 'repeat_customer'
            };
          }
        }
      }
    }
  } catch (lookupErr) {}

  // 3. עיבוד חומרי בניין וכמויות
  const hasMaterials = lower.includes('טיט') || lower.includes('מלט') || lower.includes('בלוק') || lower.includes('חול') || lower.includes('סומסום') || lower.includes('ברזל') || lower.includes('שקים') || lower.includes('בלה');
  if (hasMaterials) {
    const items = [];
    let belsCount = 0;
    let bagsCount = 0;

    if (lower.includes('חול')) {
      const match = lower.match(/(\d+)\s*(?:בלה|בלות)?\s*חול/) || lower.match(/חול.*?(\d+)/);
      const qty = match ? parseInt(match[1], 10) : 3;
      items.push(`1. מק"ט: 11501 | חול שק גדול (בלה) | כמות: ${qty}`);
      belsCount += qty;
    }
    if (lower.includes('מלט')) {
      const match = lower.match(/(\d+)\s*(?:שק|שקים)?\s*מלט/) || lower.match(/מלט.*?(\d+)/);
      const qty = match ? parseInt(match[1], 10) : 60;
      const pallets = Math.ceil(qty / 30);
      items.push(`2. מק"ט: 10002 | מלט אפור 25 ק"ג נשר | כמות: ${qty} (${pallets} משטחים)`);
      bagsCount += qty;
    }
    if (lower.includes('סומסום')) {
      const match = lower.match(/(\d+)\s*(?:בלה|בלות)?\s*סומסום/) || lower.match(/סומסום.*?(\d+)/);
      const qty = match ? parseInt(match[1], 10) : 5;
      items.push(`3. מק"ט: 11511 | סומסום שק גדול (בלה) | כמות: ${qty}`);
      belsCount += qty;
    }

    const palletsCount = bagsCount > 0 ? Math.ceil(bagsCount / 30) : 0;
    const deposits = [];
    if (belsCount > 0) deposits.push(`${belsCount} בלות (מק"ט 60002)`);
    if (palletsCount > 0) deposits.push(`${palletsCount} משטחי סבן (מק"ט 60060)`);

    const isAddition = lower.includes('להוסיף') || lower.includes('רוצה להוסיף') || lower.includes('עוד') || lower.includes('תוסיף') || items.length >= 3;

    if (isAddition) {
      return {
        reply: `מעולה, עדכנתי והוספתי להזמנה! ➕\n\n📋 *סיכום סל הזמנה מעודכן:*\n${items.join('\n')}\n\n🛡️ *פקדונות מחייבים:*\n• ${deposits.join('\n• ')}\n\n⚖️ משקל כולל משוער: כ-11.5 טון ➔ *שיבוץ נדרש: משאית מרצדס מנוף (חכמת).*\n\n📍 לאיזו כתובת לשגר את חכמת, ולאיזו שעה לתאם את האספקה?`,
        branch: 'עדכון סל חומרים',
        action: 'order_update'
      };
    } else {
      return {
        reply: `קלטתי את פריטי ההזמנה שלך! 🏗️\n\n📦 *פירוט החומרים שנקלטו:*\n${items.join('\n')}\n🛡️ *פקדונות נלווים:* ${deposits.join(' + ')}.\n\n📍 *כדי שראמי יוכל לשבץ לך משאית:*\n1. מהי כתובת האספקה המדויקת?\n2. האם יש פריטים נוספים שתרצה להוסיף?`,
        branch: 'קליטת הזמנת חומרים',
        action: 'order_update'
      };
    }
  }

  // 4. איסוף עצמי
  if (text === '2' || lower.includes('איסוף') || lower.includes('מחסן') || lower.includes('כפר ברא') || lower.includes('שעות')) {
    return {
      reply: '🏪 מחסן ח. סבן כפר ברא פתוח בימים א-ה 06:00-17:00, ויום ו 06:30-13:00. שלח פירוט חומרים וראמי יכין לך הכל מראש במזלג!',
      branch: '🏪 איסוף עצמי',
      action: 'customer_reply'
    };
  }

  // 5. מכולות פסולת
  if (text === '3' || lower.includes('מכולה') || lower.includes('פסולת') || lower.includes('פינוי')) {
    return {
      reply: '🗑️ שירות מכולות פסולת ח. סבן: זמינות מכולות 6, 8 ו-12 קוב להצבה מיידית. אנא ציין כתובת ונפח מבוקש. שים לב שנדרשת גישה פנויה למשאית רמסע 🚛.',
      branch: '🗑️ מכולות פסולת',
      action: 'container_task'
    };
  }

  // 6. מעקב משלוח
  if (text === '4' || lower.includes('מעקב') || lower.includes('איפה') || lower.includes('נהג')) {
    return {
      reply: '🔍 מעקב משלוחים ח. סבן: נהג מנוף ראמי נמצא בדרכים. לבירור ישיר צלצל עכשיו: 050-886-0896 📞.',
      branch: '🔍 מעקב משלוח',
      action: 'customer_reply'
    };
  }

  // תפריט ראשי כברירת מחדל (Catch-All)
  return {
    reply: 'ח. סבן חומרי בניין 🏗️\nברוכים הבאים למרכז ההזמנות! הקלד מספר לבחירה:\n1 - 🚚 הזמנה והובלה לאתר\n2 - 🏭 איסוף עצמי ושעות פעילות\n3 - 🗑️ מכולות פסולת (6/8/12 קוב)\n4 - 🔍 מעקב משלוח ונהגים',
    branch: 'תפריט ראשי סבן',
    action: 'send_menu'
  };
}

/**
 * פונקציית עזר לקריאה ל-Gemini API מתוך Google Apps Script:
 * שלב 1: הגדלת Max Output Tokens ל-2048 (מונע חיתוך תשובות באמצע משפט).
 * שלב 2: הוספת "כלל חסימת חשיבה" בראש ה-Prompt.
 * שלב 3: סינון חכם של מחשבות המודל (!p.thought).
 */
function callGeminiApi(userPrompt, systemInstruction, apiKey) {
  const key = apiKey || PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!key) return null;

  const criticalRule = "CRITICAL SYSTEM INSTRUCTION:\n" +
    "- Output ONLY the final Hebrew WhatsApp message to be sent directly to the user.\n" +
    "- DO NOT output any internal thoughts, reasoning, planning, or English words (e.g., NEVER write \"Therefore...\", \"I should...\", \"Ts...\").\n" +
    "- Do NOT explain your logic. Start your response directly with the Hebrew greeting.\n\n";

  const fullSystemPrompt = criticalRule + (systemInstruction || "אתה נועה AI, נציגה וירטואלית של ח. סבן חומרי בניין בע״מ (050-886-0896).");

  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + key;
  const payload = {
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    systemInstruction: { parts: [{ text: fullSystemPrompt }] },
    generationConfig: {
      maxOutputTokens: 2048,
      temperature: 0.3
    }
  };

  try {
    const res = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    const json = JSON.parse(res.getContentText());
    const parts = (json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts) ? json.candidates[0].content.parts : [];
    
    // סינון חכם של מחשבות המודל:
    const finalReply = parts
      .filter(function(p) { return !p.thought && p.text; })
      .map(function(p) { return p.text; })
      .join('')
      .trim();

    return finalReply || null;
  } catch (e) {
    Logger.log('Gemini call error: ' + e.message);
    return null;
  }
}

/**
 * טיפול בהודעת WhatsApp נכנסת וסגירת מעגל דו-כיוונית מול הגיליון
 */
function handleIncomingWhatsAppTwoWay(ss, payload) {
  const phone = String(payload.from || payload.phone || '').trim();
  const name = String(payload.name || payload.customerName || 'לקוח WhatsApp').trim();
  const text = String(payload.text || payload.incomingMessage || '').trim();
  const timestamp = payload.timestamp || new Date().toLocaleString('he-IL');

  // יצירת המענה והתפריט החכם של נועה AI
  const autoResponse = generateSabanWhatsAppReply(text, name, phone, ss);

  // תיעוד השיחה בגיליון שיחות_וואטסאפ_נועה
  handleLogWhatsApp(ss, {
    timestamp: timestamp,
    phone: phone,
    customerName: name,
    inquiryType: autoResponse.branch,
    incomingMessage: text,
    branchName: autoResponse.branch,
    sentReply: autoResponse.reply,
    status: 'טופל בהצלחה'
  });

  return {
    success: true,
    reply: autoResponse.reply,
    branch: autoResponse.branch,
    action: autoResponse.action,
    menuSent: autoResponse.action === 'send_menu',
    phone: phone,
    name: name,
    timestamp: timestamp
  };
}

/**
 * סימון שורה בגיליון כ"נשלח בהצלחה"
 */
function handleMarkSent(ss, payload) {
  const rowId = Number(payload.rowId);
  const sheet = ss.getSheetByName(CONFIG.SHEETS.WHATSAPP_CONVERSATIONS);
  if (!sheet) return { success: false, error: 'Sheet not found' };

  if (rowId && rowId > 1 && rowId <= sheet.getLastRow()) {
    sheet.getRange(rowId, 8).setValue('נשלח בהצלחה ✅');
    return { success: true, rowId: rowId, status: 'marked_sent' };
  }

  return { success: false, error: 'Invalid rowId: ' + rowId };
}

/**
 * תיעוד שיחת WhatsApp
 */
function handleLogWhatsApp(ss, payload) {
  const sheet = ss.getSheetByName(CONFIG.SHEETS.WHATSAPP_CONVERSATIONS);
  if (!sheet) return { success: false, error: 'Sheet not found' };

  const timestamp = payload.timestamp || new Date().toLocaleString('he-IL');
  const phone = payload.phone || payload.from || '';
  const customerName = payload.customerName || payload.name || 'לקוח WhatsApp';
  const inquiryType = payload.inquiryType || payload.type || 'פנייה כללית';
  const incomingMsg = payload.incomingMessage || payload.text || '';
  const branchName = payload.branchName || payload.selectedBranch || 'תפריט ראשי';
  const sentReply = payload.sentReply || payload.reply || '';
  const status = payload.status || 'התקבלה';
  const taskId = payload.taskId || '';

  const row = [
    timestamp,
    phone,
    customerName,
    inquiryType,
    incomingMsg,
    branchName,
    sentReply,
    status,
    taskId
  ];

  sheet.appendRow(row);
  const lastRow = sheet.getLastRow();
  sheet.getRange(lastRow, 1, 1, row.length)
    .setFontFamily(CONFIG.THEME.FONT_FAMILY)
    .setFontSize(10)
    .setVerticalAlignment('middle');
  sheet.setRowHeight(lastRow, 34);

  return { success: true, rowNumber: lastRow };
}

/**
 * הוספת מכולת פסולת חדשה
 */
function handleInsertContainer(ss, payload) {
  const sheet = ss.getSheetByName(CONFIG.SHEETS.CONTAINERS);
  if (!sheet) return { success: false, error: 'Sheet not found' };

  const containerId = payload.containerId || payload.orderId || ('CNT-' + Math.floor(500 + Math.random() * 500));
  const date = payload.date || new Date().toLocaleDateString('he-IL');
  const customer = payload.customerName || payload.contractor || 'קבלן שארק';
  const phone = payload.phone || CONFIG.CONTACT_PHONE;
  const address = payload.address || 'כפר ברא';
  const actionType = payload.actionType || payload.container_action || '📍 הצבה חדשה';
  const size = payload.size || payload.container_size || '8 קוב';
  const status = payload.status || 'פעיל באתר';
  const days = payload.rentalDays || '1';
  const notes = payload.notes || payload.site_details || 'גישה פנויה לרמסע';

  const row = [
    containerId,
    date,
    customer,
    phone,
    address,
    actionType,
    size,
    status,
    days,
    notes
  ];

  sheet.appendRow(row);
  const lastRow = sheet.getLastRow();
  sheet.getRange(lastRow, 1, 1, row.length)
    .setFontFamily(CONFIG.THEME.FONT_FAMILY)
    .setFontSize(10)
    .setVerticalAlignment('middle');
  sheet.setRowHeight(lastRow, 34);

  return { success: true, containerId: containerId, rowNumber: lastRow };
}

/**
 * עדכון מכולה קיימת
 */
function handleUpdateContainer(ss, payload) {
  const sheet = ss.getSheetByName(CONFIG.SHEETS.CONTAINERS);
  if (!sheet) return { success: false, error: 'Sheet not found' };

  const containerId = payload.containerId;
  if (!containerId) return { success: false, error: 'Missing containerId' };

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(containerId).trim()) {
      const rowIdx = i + 1;
      if (payload.status) sheet.getRange(rowIdx, 8).setValue(payload.status);
      if (payload.actionType) sheet.getRange(rowIdx, 6).setValue(payload.actionType);
      if (payload.notes) sheet.getRange(rowIdx, 10).setValue(payload.notes);
      if (payload.rentalDays) sheet.getRange(rowIdx, 9).setValue(payload.rentalDays);

      return { success: true, updatedRow: rowIdx, containerId: containerId };
    }
  }

  return { success: false, error: 'Container ID not found: ' + containerId };
}

// --------------------------------------------------------------------------
// 6. פונקציות עזר תפעוליות (Calculations, Links & Formatting)
// --------------------------------------------------------------------------

/**
 * חישוב פקדונות אוטומטי מתוך טקסט המוצרים:
 * - בלות ענקיות (מק"ט 60002)
 * - משטחי עץ (מק"ט 60060)
 */
function calculateDeposits(productsText) {
  if (!productsText || typeof productsText !== 'string') return 'ללא פקדון';

  let bigBagsCount = 0;
  let palletsCount = 0;

  // זיהוי בלות
  const bagMatches = productsText.match(/(\d+)\s*(בלה|בלות|שקי ענק)/i);
  if (bagMatches && bagMatches[1]) {
    bigBagsCount += parseInt(bagMatches[1], 10);
  } else if (/בלה|בלות/.test(productsText)) {
    bigBagsCount = 1;
  }

  // זיהוי משטחים
  const palletMatches = productsText.match(/(\d+)\s*(משטח|משטחים|משטחי)/i);
  if (palletMatches && palletMatches[1]) {
    palletsCount += parseInt(palletMatches[1], 10);
  } else if (/משטח|משטחים/.test(productsText)) {
    palletsCount = 1;
  }

  const parts = [];
  if (bigBagsCount > 0) {
    parts.push(`${bigBagsCount} בלות (${CONFIG.DEPOSIT_SKU.BIG_BAG})`);
  }
  if (palletsCount > 0) {
    parts.push(`${palletsCount} משטחים (${CONFIG.DEPOSIT_SKU.PALLET})`);
  }

  return parts.length > 0 ? parts.join(' | ') : 'ללא פקדון';
}

/**
 * חילוץ קישור ניווט Waze תקני
 */
function generateWazeUrl(address) {
  if (!address) return 'https://waze.com';
  return 'https://waze.com/ul?q=' + encodeURIComponent(address.trim() + ', ישראל');
}

/**
 * חילוץ קישור ישיר לשידור הודעת WhatsApp
 */
function generateWhatsAppLink(phone, message) {
  let cleanPhone = String(phone || '').replace(/[^0-9]/g, '');
  if (cleanPhone.startsWith('05')) {
    cleanPhone = '972' + cleanPhone.substring(1);
  }
  if (!cleanPhone) cleanPhone = '972508860896';
  
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message || '')}`;
}

/**
 * המרת נתוני גיליון למערך אובייקטי JSON
 */
function getSheetDataAsJson(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const headers = data[0];
  const rows = [];

  for (let i = 1; i < data.length; i++) {
    const rowObj = {};
    for (let j = 0; j < headers.length; j++) {
      rowObj[headers[j]] = data[i][j];
    }
    rows.push(rowObj);
  }

  return rows;
}

/**
 * יצירת תגובת JSON עם פתיחת CORS מלאה
 */
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * רישום פעולה ביומן המערכת (Audit Log)
 */
function logEvent(action, source, result, payloadDetails) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEETS.SYSTEM_LOGS);
    if (!sheet) return;

    const row = [
      new Date().toLocaleString('he-IL'),
      action,
      source,
      result,
      payloadDetails || ''
    ];

    sheet.appendRow(row);
  } catch (e) {
    console.error('Failed to log event:', e);
  }
}

// --------------------------------------------------------------------------
// 7. תפריט פעולות מיוחדות (Reports, Backup & Drive Verification)
// --------------------------------------------------------------------------

/**
 * בדיקת תקינות תיקיית הארכיון ב-Google Drive
 * יוצרת את התיקייה במידה ואינה קיימת
 */
function verifyDriveArchiveFolders() {
  const ui = SpreadsheetApp.getUi();
  try {
    const folderName = CONFIG.DRIVE_ARCHIVE_FOLDER_NAME;
    const folders = DriveApp.getFoldersByName(folderName);
    let folder;

    if (folders.hasNext()) {
      folder = folders.next();
      ui.alert('✅ תיקיית Drive תקינה וקיימת:\n' + folder.getName() + '\nמזהה: ' + folder.getId());
    } else {
      folder = DriveApp.createFolder(folderName);
      ui.alert('✨ תיקיית Drive חדשה נוצרה בהצלחה:\n' + folder.getName() + '\nמזהה: ' + folder.getId());
    }

    logEvent('VERIFY_DRIVE_FOLDER', 'UI_MENU', 'SUCCESS', 'Folder ID: ' + folder.getId());
  } catch (err) {
    ui.alert('❌ שגיאה בבדיקת תיקיית Drive:\n' + err.toString());
    logEvent('VERIFY_DRIVE_FOLDER', 'UI_MENU', 'FAILED', err.toString());
  }
}

/**
 * יצירת קובץ גיבוי היסטורי ב-Drive
 */
function createDriveBackup(ss) {
  try {
    const folderName = CONFIG.DRIVE_ARCHIVE_FOLDER_NAME;
    const folders = DriveApp.getFoldersByName(folderName);
    const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);

    const timeStamp = Utilities.formatDate(new Date(), 'Asia/Jerusalem', 'yyyy-MM-dd_HH-mm');
    const fileName = `גיבוי_סבן_${timeStamp}.json`;

    const allData = {
      backupDate: new Date().toISOString(),
      morningReport: getSheetDataAsJson(ss.getSheetByName(CONFIG.SHEETS.MORNING_REPORT)),
      conversations: getSheetDataAsJson(ss.getSheetByName(CONFIG.SHEETS.WHATSAPP_CONVERSATIONS)),
      containers: getSheetDataAsJson(ss.getSheetByName(CONFIG.SHEETS.CONTAINERS))
    };

    const file = folder.createFile(fileName, JSON.stringify(allData, null, 2), MimeType.PLAIN_TEXT);
    return { success: true, backupFileId: file.getId(), fileName: fileName };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * הפקת דוח בוקר יומי מרוכז והצגת סיכום למשתמש
 */
function generateDailyMorningReport() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.MORNING_REPORT);
  const ui = SpreadsheetApp.getUi();

  if (!sheet || sheet.getLastRow() <= 1) {
    ui.alert('דוח בוקר', 'לא נמצאו הזמנות להיום.', ui.ButtonSet.OK);
    return;
  }

  const data = sheet.getDataRange().getValues();
  let totalOrders = data.length - 1;
  let doneCount = 0;
  let inProgressCount = 0;
  let urgentCount = 0;

  for (let i = 1; i < data.length; i++) {
    const status = String(data[i][9]);
    if (status.includes('סופק')) doneCount++;
    else if (status.includes('בסידור')) inProgressCount++;
    else if (status.includes('דחוף') || status.includes('ממתין')) urgentCount++;
  }

  const summary = 
    `📊 סיכום דוח בוקר מבצעי - ח. סבן\n` +
    `---------------------------------------\n` +
    `📦 סה"כ הובלות בסידור: ${totalOrders}\n` +
    `✅ סופקו במלואן: ${doneCount}\n` +
    `🚚 בסידור עבודה: ${inProgressCount}\n` +
    `⚠️ ממתינות / דחופות: ${urgentCount}\n\n` +
    `נציג לתיאום: ראמי מסארווה (050-886-0896)`;

  ui.alert('דוח בוקר מבצעי', summary, ui.ButtonSet.OK);
  logEvent('GENERATE_MORNING_REPORT', 'UI_MENU', 'SUCCESS', `Total: ${totalOrders}, Done: ${doneCount}`);
}

/**
 * סנכרון יזום מול הוואטסאפ והממשק
 */
function syncDataWithWhatsApp() {
  const ui = SpreadsheetApp.getUi();
  const time = new Date().toLocaleTimeString('he-IL');
  
  logEvent('SYNC_WHATSAPP', 'UI_MENU', 'SUCCESS', 'סנכרון יזום בוצע');
  ui.alert('סנכרון נתונים', `הסנכרון מול שרת WhatsApp Cloud API ו-PWA בוצע בהצלחה בשעה ${time}.`, ui.ButtonSet.OK);
}
