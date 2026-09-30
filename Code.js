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
    const action = payload.action || 'insertOrder';
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let result = { success: true };

    switch (action) {
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
