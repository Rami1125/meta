/**
 * ==============================================================================
 * ח. סבן חומרי בניין (1994) בע״מ | מנוע נועה AI (Noa AI Engine)
 * ==============================================================================
 * נועה AI — מנהלת הסידור, השירות, ההובלות והלשכה של ח. סבן,
 * ויד ימינו הנאמנה של ראמי מסארווה (מנהל מחלקת ההובלות והסידור: 050-886-0896).
 * ==============================================================================
 */

export interface NoaReplyResult {
  replyText: string;
  flowTitle: string;
  branchId: string;
  isRami: boolean;
  isVIP: boolean;
  actionType: 'rami_command' | 'vip_escalation' | 'order_intake' | 'container_task' | 'pickup_info' | 'tracking_check' | 'quote_escalation' | 'general_menu' | 'repeat_customer';
  customerProfile?: any;
}

// נרמול מק"טים תקניים של ח. סבן
export const STANDARD_CATALOG = [
  { keywords: ['שק חול', 'שקי חול'], name: 'חול שק 25 ק"ג', sku: '11500', unit: 'שק', weight: 0.025, palletEligible: true },
  { keywords: ['בלות חול', 'בלת חול', 'בלה חול', 'חול בלה', 'חול מחצבה', 'חול ים', 'חול'], name: 'חול שק גדול (בלה)', sku: '11501', unit: 'בלה', weight: 1.25, isBale: true, depositSku: '60002', depositName: 'בלה פקדון' },
  { keywords: ['שק סומסום', 'שקי סומסום'], name: 'סומסום שק 25 ק"ג', sku: '11510', unit: 'שק', weight: 0.025, palletEligible: true },
  { keywords: ['בלות סומסום', 'בלת סומסום', 'בלה סומסום', 'סומסום בלה', 'סומסום'], name: 'סומסום שק גדול (בלה)', sku: '11511', unit: 'בלה', weight: 1.25, isBale: true, depositSku: '60002', depositName: 'בלה פקדון' },
  { keywords: ['טיט שק', 'שק טיט', 'שקי טיט'], name: 'טיט שק 25 ק"ג', sku: '11550', unit: 'שק', weight: 0.025, palletEligible: true },
  { keywords: ['בלות טיט', 'בלת טיט', 'בלה טיט', 'טיט בלה', 'טיט מוכן', 'טיט'], name: 'טיט מוכן שק גדול (בלה)', sku: '11551', unit: 'בלה', weight: 1.25, isBale: true, depositSku: '60002', depositName: 'בלה פקדון' },
  { keywords: ['בלות מצע', 'בלת מצע', 'בלה מצע', 'מצע בלה', 'מצע א-ב', 'מצע'], name: 'מצע א-ב שק גדול (בלה)', sku: '11540', unit: 'בלה', weight: 1.25, isBale: true, depositSku: '60002', depositName: 'בלה פקדון' },
  { keywords: ['בלות חמרה', 'בלת חמרה', 'בלה חמרה', 'חמרה בלה', 'חמרה גננית', 'חמרה'], name: 'חמרה גננית שק גדול (בלה)', sku: '11570', unit: 'בלה', weight: 1.25, isBale: true, depositSku: '60002', depositName: 'בלה פקדון' },
  { keywords: ['מלט לבן'], name: 'מלט לבן נשר 25 ק"ג', sku: '10009', unit: 'שק', weight: 0.025, palletEligible: true },
  { keywords: ['מלט נשר', 'מלט אפור', 'מלט 25', 'שקי מלט', 'שק מלט', 'מלט'], name: 'מלט אפור 25 ק"ג נשר', sku: '10002', unit: 'שק', weight: 0.025, palletEligible: true },
  { keywords: ['בטון מוכן', 'שק בטון', 'בטון יבש', 'בטון'], name: 'בטון מוכן שק 25 ק"ג', sku: '10011', unit: 'שק', weight: 0.025, palletEligible: true },
  { keywords: ['לטקריט', '335', 'i335'], name: 'דבק לטקריט i335 צמנטי', sku: '15335', unit: 'שק', weight: 0.025, palletEligible: true },
  { keywords: ['דבק 109', 'שרמיק 109', '109'], name: 'דבק שרמיק 109 להדבקת ריצוף', sku: '15109', unit: 'שק', weight: 0.025, palletEligible: true },
  { keywords: ['דבק 132', 'כרמית 132', '132'], name: 'דבק כרמית 132 גמיש', sku: '15132', unit: 'שק', weight: 0.025, palletEligible: true },
  { keywords: ['בגר', '185', 'pl185'], name: 'שפכטל חוץ בגר PL185', sku: '14185', unit: 'שק', weight: 0.025, palletEligible: true },
  { keywords: ['שפכטל אמריקאי', 'דלי שפכטל', 'שפכטל'], name: 'שפכטל אמריקאי דלי 28 ק"ג', sku: '35010', unit: 'דלי', weight: 0.028 },
  { keywords: ['אלסטוסיל', '980', 'se980'], name: 'איטום אלסטוסיל SE980', sku: '14981', unit: 'פח', weight: 0.025 },
  { keywords: ['בלוק 20', 'בלוקי בטון', 'בלוק בטון', 'בלוקים 20', 'בלוקים', 'בלוק'], name: 'בלוק בטון תקני 20/20/40', sku: '12204', unit: 'יח\'', weight: 0.02, palletSku: '60006', palletName: 'משטח בלוקים פקדון' },
  { keywords: ['גבס לבן', 'לוח גבס', 'גבס 260', 'לוחות גבס', 'גבס'], name: 'לוח גבס לבן תקני 1.2/2.60', sku: '111260', unit: 'לוח', weight: 0.025 },
  { keywords: ['עץ פיני', 'לוח עץ פיני', 'קרשים', 'לוחות עץ'], name: 'לוח עץ פיני מוקצע 3 מ\'', sku: '750300', unit: 'יח\'', weight: 0.01 }
];

export interface CartItem {
  sku: string;
  name: string;
  qty: number;
  unit: string;
  weightTons: number;
  isBale?: boolean;
  palletEligible?: boolean;
  palletSku?: string;
  note?: string;
}

export interface CustomerCartSession {
  phone: string;
  name: string;
  cart: CartItem[];
  address?: string;
  deliveryTime?: string;
  unloadingType?: string;
  lastUpdated: number;
}

// ניהול זיכרון שיחה וסל חומרים מצטבר בזיכרון השרת לפי מספר טלפון
export const customerCartSessions = new Map<string, CustomerCartSession>();

export function getCustomerCartSession(phone: string, name?: string): CustomerCartSession {
  const cleanPhone = String(phone || '').replace(/[^0-9]/g, '');
  let sess = customerCartSessions.get(cleanPhone);
  if (!sess) {
    sess = {
      phone: cleanPhone,
      name: name || 'לקוח',
      cart: [],
      lastUpdated: Date.now()
    };
    customerCartSessions.set(cleanPhone, sess);
  } else if (name && (sess.name === 'לקוח' || !sess.name)) {
    sess.name = name;
  }
  return sess;
}

export function clearCustomerCart(phone: string) {
  const cleanPhone = String(phone || '').replace(/[^0-9]/g, '');
  customerCartSessions.delete(cleanPhone);
}

// חילוץ חומרים וכמויות מתוך טקסט הודעה
export function extractMaterialsFromText(text: string): CartItem[] {
  const lower = (text || '').toLowerCase();
  const items: CartItem[] = [];

  for (const item of STANDARD_CATALOG) {
    const matchedKw = item.keywords.find(kw => lower.includes(kw));
    if (matchedKw) {
      // הימנעות מכפילות תת-מחרוזות
      if (items.some(i => i.sku === item.sku)) continue;

      const kwIndex = lower.indexOf(matchedKw);
      const beforeSnippet = lower.substring(Math.max(0, kwIndex - 20), kwIndex);
      const numBeforeMatch = beforeSnippet.match(/(\d+)\s*(?:שקים|שקי|שק|בלות|בלה|בלת|משטחים|משטחי|משטח|יח|יחידות|דליים|דלי|פחים|פח|טון)?\s*$/);
      let qty = 1;
      if (numBeforeMatch) {
        qty = parseInt(numBeforeMatch[1], 10);
      } else {
        const afterSnippet = lower.substring(kwIndex + matchedKw.length, kwIndex + matchedKw.length + 20);
        const numAfterMatch = afterSnippet.match(/^\s*(?:כמות|של|x|\*|-)?\s*(\d+)/);
        if (numAfterMatch) {
          qty = parseInt(numAfterMatch[1], 10);
        }
      }

      let note = '';
      if (item.palletEligible && qty >= 30) {
        const pallets = Math.ceil(qty / 30);
        note = `(${pallets} משטחים)`;
      }

      items.push({
        sku: item.sku,
        name: item.name,
        qty,
        unit: item.unit,
        weightTons: (item.weight || 0.025) * qty,
        isBale: item.isBale,
        palletEligible: item.palletEligible,
        palletSku: item.palletSku,
        note
      });
    }
  }

  return items;
}

// חישוב פקדונות, משקל כולל ומשאית נדרשת עבור סל מצטבר
export function calculateCartTotals(cart: CartItem[]) {
  let belsCount = 0;
  let bagsCount = 0;
  let blocksPallets = 0;
  let totalWeightTons = 0;

  for (const item of cart) {
    if (item.isBale || item.unit === 'בלה') {
      belsCount += item.qty;
    }
    if (item.palletEligible) {
      bagsCount += item.qty;
    }
    if (item.palletSku) {
      blocksPallets += Math.ceil(item.qty / 40);
    }
    totalWeightTons += item.weightTons;
  }

  const palletsCount = bagsCount > 0 ? Math.ceil(bagsCount / 30) : 0;

  const deposits: string[] = [];
  if (belsCount > 0) {
    deposits.push(`${belsCount} בלות (מק"ט 60002)`);
  }
  if (palletsCount > 0) {
    deposits.push(`${palletsCount} משטחי סבן (מק"ט 60060)`);
  }
  if (blocksPallets > 0) {
    deposits.push(`${blocksPallets} משטח בלוקים (מק"ט 60006)`);
  }

  // עיגול משקל משוער לחצי טון
  const roundedWeight = Math.round(totalWeightTons * 2) / 2;
  const weightDisplay = roundedWeight > 0 ? `כ-${roundedWeight} טון` : 'חומרים קלים';

  // שיבוץ משאית מבצעית: מעל 5 טון או עם בלות מנוף = משאית מנוף (חכמת)
  let recommendedTruck = 'משאית חלוקה/איסוזו (עלי)';
  if (roundedWeight >= 4.0 || belsCount > 0 || blocksPallets > 0) {
    recommendedTruck = 'משאית מרצדס מנוף (חכמת)';
  }

  return {
    belsCount,
    bagsCount,
    palletsCount,
    blocksPallets,
    deposits,
    roundedWeight,
    weightDisplay,
    recommendedTruck
  };
}

// זיהוי ערים ואתרי אספקה
const KNOWN_CITIES = [
  'הוד השרון', 'כפר סבא', 'רעננה', 'פתח תקווה', 'הרצליה', 'תל אביב', 'רמת השרון',
  'כפר ברא', 'ג\'לג\'וליה', 'טייבה', 'טירה', 'קלנסווה', 'נתניה', 'ראש העין',
  'בני ברק', 'גבעתיים', 'רמת גן', 'שוהם', 'כפר קאסם'
];

/**
 * מנוע קבלת החלטות ראשי — נועה AI
 */
export function processNoaAiMessage(
  rawText: string,
  rawNameOrOptions: string | { senderName?: string; senderPhone?: string; customerHistory?: any } = 'לקוח',
  rawPhone: string = '',
  customerHistory?: any
): NoaReplyResult {
  let effectiveName = 'לקוח';
  let effectivePhone = rawPhone || '';
  let effectiveHistory = customerHistory;

  if (rawNameOrOptions && typeof rawNameOrOptions === 'object') {
    effectiveName = rawNameOrOptions.senderName || 'לקוח';
    effectivePhone = rawNameOrOptions.senderPhone || rawPhone || '';
    effectiveHistory = rawNameOrOptions.customerHistory || customerHistory;
  } else if (typeof rawNameOrOptions === 'string') {
    effectiveName = rawNameOrOptions;
  }

  const text = (rawText || '').trim();
  const lower = text.toLowerCase();
  const phoneDigits = String(effectivePhone || '').replace(/[^0-9]/g, '');
  const cleanName = (effectiveName || 'לקוח').replace(/[\{\}]/g, '').trim() || 'לקוח';

  // א. בדיקת הנהלה בכירה — הראל אידלסון (מנכ"ל) / ורד אידלסון
  const isManagement = 
    cleanName.includes('הראל') || 
    cleanName.includes('אידלסון') || 
    cleanName.includes('ורד') || 
    lower.includes('מדבר הראל') || 
    lower.includes('זה הראל') || 
    lower.includes('מדברת ורד');

  // ב. בדיקת משפחה — אמא של ראמי
  const isMom = 
    cleanName.includes('אמא') || 
    lower.includes('אמא של ראמי') || 
    lower.includes('מדברת אמא') || 
    lower.includes('אמי היקרה') || 
    lower.startsWith('אמא');

  // ════════════════════════════════════════════════════════════════════════════
  // 🚨 1. נוהל מפקד עליון — ראמי מסארווה (050-886-0896)
  // ════════════════════════════════════════════════════════════════════════════
  const isRamiPhone = phoneDigits.includes('508860896') || phoneDigits.includes('0508860896') || phoneDigits.includes('972508860896');
  const isExplicitRamiText = 
    lower.includes('אני ראמי') ||
    lower.includes('זה ראמי') ||
    lower.includes('מדבר ראמי') ||
    lower.includes('המפקד') ||
    lower === 'ראמי';

  const isRamiCommanderGreeting = 
    lower.includes('היי נועה') ||
    lower.includes('נועה תעני לי') ||
    lower.includes('נועה כאן');

  // ראמי מקבל עדיפות עליונה מעל הכל, אלא אם הפונה הוא במפורש הראל או אמא
  const isRami = isRamiPhone || isExplicitRamiText || (isRamiCommanderGreeting && !isManagement && !isMom);

  if (isRami) {
    // תגובה לתפריט מפקד (1-5)
    if (lower === '1' || lower.includes('תמונת מצב') || lower.includes('סבבים') || lower.includes('חכמת') || lower.includes('עלי')) {
      return {
        replyText: `המפקד, להלן תמונת מצב צי המשאיות והסבבים בזמן אמת: 🚛\n\n1. *חכמת* (משאית מנוף 615-41-002):\n• סטטוס: בסבב פריקה פעיל באתר ברעננה (רחוב אחוזה 142).\n• תעודת משלוח: קומקס 6215751 (בלוקים + מלט).\n• צפי סיום וחזרה לסבב הבא: כ-25 דקות.\n\n2. *עלי* (איסוזו חלוקה 651-51-701):\n• סטטוס: בנסיעה לקו חלוקה בהוד השרון (חומרים קלים ודבקים).\n• פריקה מתוכננת: רחוב החרש 10.\n• זמינות לקריאה דחופה: מיידית.\n\nהאם לשבץ סבב נוסף לאחד מהם, המפקד? 🫡`,
        flowTitle: 'נוהל מפקד - תמונת מצב צי',
        branchId: 'rami_fleet_status',
        isRami: true,
        isVIP: true,
        actionType: 'rami_command'
      };
    }

    if (lower === '2' || lower.includes('קליטה') || lower.includes('שיבוץ') || lower.includes('הזמנה חדשה')) {
      return {
        replyText: `פקודה התקבלה, המפקד! ➕\nאנא שלח לי את פרטי ההזמנה באחת מהדרכים הבאות:\n• שם לקוח / קבלן\n• כתובת אתר (עיר, רחוב ומספר)\n• רשימת חומרים וכמויות\n• האם נדרש מנוף של חכמת או חלוקה של עלי\n\nאבצע נרמול מק"טים, בדיקת פקדונות ושיבוץ מיידי לסידור העבודה!`,
        flowTitle: 'נוהל מפקד - שיבוץ הזמנה',
        branchId: 'rami_dispatch_order',
        isRami: true,
        isVIP: true,
        actionType: 'rami_command'
      };
    }

    if (lower === '3' || lower.includes('דוח בוקר') || lower.includes('סיכום') || lower.includes('eod')) {
      return {
        replyText: `המפקד, להלן סיכום תפעולי מרוכז (EOD) של ח. סבן: 📊\n\n🚛 *סך סבבים שבוצעו היום:* 14 סבבים מלאים.\n📦 *פירוט:* 8 סבבי מנוף (חכמת) + 6 סבבי חלוקה (עלי).\n🗑️ *מכולות רמסע:* 4 הצבות חדשות, 3 החלפות, 2 פינויים סופיים.\n📑 *תעודות משלוח:* 100% תעודות חתומות נסרקו וסונכרנו מול קומקס.\n⚠️ *הערות תפעוליות:* אין עיכובים חריגים באתרים. הצי מוכן למחר בשעה 06:00.\n\nהדוח הופק וסונכרן לגיליון הסידור של נועה! 🫡`,
        flowTitle: 'נוהל מפקד - דוח EOD',
        branchId: 'rami_eod_report',
        isRami: true,
        isVIP: true,
        actionType: 'rami_command'
      };
    }

    if (lower === '4' || lower.includes('תעודות') || lower.includes('משלוח') || lower.includes('קומקס')) {
      return {
        replyText: `המפקד, מערכת הסריקה וההצלבה של קומקס דרוכה! 📑\nשלח מספר תעודה או צילום תעודת משלוח, ואצליב מיד מול יתרת המלאי, פקדונות המשטחים/בלות וחתימת הלקוח באתר.`,
        flowTitle: 'נוהל מפקד - הצלבת קומקס',
        branchId: 'rami_comax_match',
        isRami: true,
        isVIP: true,
        actionType: 'rami_command'
      };
    }

    if (lower === '5' || lower.includes('שידור') || lower.includes('הודעה לנהגים')) {
      return {
        replyText: `המפקד, מוכנה לשידור ברשת הנהגים 📢\nרשום לי את נוסח ההודעה (הנחיית בטיחות, שינוי יעד פריקה או שעת התייצבות), ואשדר אותה מיידית לוואטסאפ של חכמת ועלי!`,
        flowTitle: 'נוהל מפקד - שידור לנהגים',
        branchId: 'rami_broadcast_drivers',
        isRami: true,
        isVIP: true,
        actionType: 'rami_command'
      };
    }

    // תפריט מפקד ברירת מחדל
    return {
      replyText: `שלום המפקד! 🫡 
סליחה, נועה כאן לרשותך! זיהיתי אותך מיד. כל המערכות, הסידור וצי המשאיות דרוכים.

מה המשימה כרגע?
[1] 🚛 *תמונת מצב סבבים ונהגים* (איפה חכמת ועלי עומדים)
[2] ➕ *קליטה ושיבוץ מהיר של הזמנה חדשה לסידור*
[3] 📊 *הפקת דוח בוקר / סיכום סוף יום (EOD) לוואטסאפ*
[4] 📑 *הצלבת תעודות משלוח חתומות מול קומקס*
[5] 📢 *שידור הודעה תפעולית לנהגים*`,
      flowTitle: 'נוהל מפקד עליון - ראמי מסארווה',
      branchId: 'rami_commander_menu',
      isRami: true,
      isVIP: true,
      actionType: 'rami_command'
    };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 👑 2. נוהלי VIP מיוחדים
  // ════════════════════════════════════════════════════════════════════════════

  // א. הנהלה בכירה — הראל אידלסון (מנכ"ל) / ורד אידלסון
  if (isManagement) {
    return {
      replyText: `שלום הראל 🫡 כאן נועה, המערכת של ראמי מסבן חומרי בניין.\n\nראמי מנהל כרגע את הסידור והמשאיות בשטח. כל הצי פעיל כסדרו.\nהעברתי לראמי התראה דחופה עם פנייתך והוא יחזור אליך בהקדם האפשרי.\nהאם תרצה שאמסור לו משהו מסוים בינתיים?`,
      flowTitle: 'נוהל VIP - הנהלה בכירה (הראל אידלסון)',
      branchId: 'vip_management_harel',
      isRami: false,
      isVIP: true,
      actionType: 'vip_escalation'
    };
  }

  // ב. משפחה — אמא של ראמי
  if (isMom) {
    return {
      replyText: `שלום אמא יקרה ❤️ כאן נועה העוזרת של ראמי.\n\nראמי בסידור עבודה ובשיחות כרגע. העברתי לו הודעה דחופה והוא יחזור אלייך מיד כשיתפנה. יש משהו דחוף למסור לו?`,
      flowTitle: 'נוהל VIP - משפחה (אמא של ראמי)',
      branchId: 'vip_family_mom',
      isRami: false,
      isVIP: true,
      actionType: 'vip_escalation'
    };
  }

  // ג. צי הנהגים — חכמת (מנוף 615-41-002) / עלי (איסוזו 651-51-701)
  const isDriver = 
    cleanName.includes('חכמת') || 
    cleanName.includes('עלי') || 
    lower.includes('חכמת מנוף') || 
    lower.includes('מדבר חכמת') || 
    lower.includes('מדבר עלי') || 
    lower.includes('615-41-002') || 
    lower.includes('651-51-701');

  if (isDriver) {
    const driverName = cleanName.includes('חכמת') || lower.includes('חכמת') ? 'חכמת' : 'עלי';
    return {
      replyText: `שלום ${driverName} 🚛\nקיבלתי. להלן פרטי הסידור והיעד:\n• כתובת אספקה: אתר פעיל (פרטים בקומקס)\n• משימה: פריקה בטוחה ומהירה באתר\n• Waze: https://www.waze.com/ul?navigate=yes\n• הנחיה: בסיום הפריקה נא לצלם תעודת משלוח חתומה ולשלוח לכאן ישירות. נסיעה בטוחה!`,
      flowTitle: `נוהל VIP - נהג (${driverName})`,
      branchId: 'vip_driver_dispatch',
      isRami: false,
      isVIP: true,
      actionType: 'rami_command'
    };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 🔍 2.5 נוהל זיהוי לקוח חוזר והיסטוריית רכישות (Customer History)
  // ════════════════════════════════════════════════════════════════════════════
  const activeHistory = effectiveHistory || customerHistory;
  const hasCustomerHistory = Boolean(
    activeHistory && 
    (activeHistory.ordersCount > 0 || (activeHistory.orders && activeHistory.orders.length > 0))
  );

  if (hasCustomerHistory) {
    const lastOrder = activeHistory.lastOrder || (activeHistory.orders && activeHistory.orders[0]);
    const lastAddress = lastOrder?.deliveryAddress || (activeHistory.previousAddresses && activeHistory.previousAddresses[0]) || '';
    const topProducts = activeHistory.topProducts || [];
    const displayName = activeHistory.customerName || cleanName;

    // 4. אם הלקוח מבקש "כמו פעם שעברה" — שחזר מיד את רשימת המוצרים והמק"טים המדויקת של אותה הזמנה
    const isRepeatLastOrderRequest = 
      lower.includes('כמו פעם שעברה') || 
      lower.includes('כמו קודם') || 
      lower.includes('אותו דבר') || 
      lower.includes('כמו בהזמנה הקודמת') || 
      lower.includes('שחזר לי הזמנה') || 
      lower.includes('שחזור הזמנה') || 
      lower.includes('לשחזר') || 
      lower.includes('הזמנה קודמת') || 
      lower === '1';

    if (isRepeatLastOrderRequest && lastOrder) {
      const summary = customerHistory.lastOrderFormattedSummary || 
        (lastOrder.parsedItems && lastOrder.parsedItems.length > 0 
          ? lastOrder.parsedItems.map((p: any) => `• ${p.name}${p.sku ? ` (מק"ט ${p.sku})` : ''}: *${p.quantity}*`).join('\n')
          : lastOrder.rawProducts || 'אותם חומרים כבהזמנה הקודמת');

      const session = getCustomerCartSession(rawPhone, displayName);
      const parsedItems = extractMaterialsFromText(summary);
      if (parsedItems.length > 0) {
        session.cart = parsedItems;
        session.lastUpdated = Date.now();
      }

      return {
        replyText: `שלום ${displayName}! 📦\nשחזרתי עבורך את ההזמנה הקודמת${lastOrder.orderId ? ` (הזמנה קומקס #${lastOrder.orderId})` : ''} במדויק! ✅\n\n📋 *מפרט המוצרים והמק"טים ששוחזרו:*\n${summary}\n\n📍 *אישור אתר אספקה:*\nהאם לספק לכתובת האתר האחרונה: "*${lastAddress}*", או שיש אתר אספקה חדש?`,
        flowTitle: 'שחזור הזמנה קודמת ללקוח חוזר',
        branchId: 'repeat_customer_reorder',
        isRami: false,
        isVIP: false,
        actionType: 'repeat_customer',
        customerProfile: customerHistory
      };
    }

    // אם הלקוח אישר את הכתובת הקודמת
    const isConfirmingAddress = 
      lower.includes('לאותו אתר') || 
      lower.includes('לאותה כתובת') || 
      lower === 'כן' || 
      lower === 'לשם' || 
      lower.includes('לכתובת הקודמת');

    if (isConfirmingAddress && lastAddress) {
      return {
        replyText: `מצוין ${displayName}! רשמתי אספקה ל-*"${lastAddress}"* 📍\n\nהאם לשבץ את אותם המוצרים כמו פעם שעברה, או שתרצה להוסיף/לשנות כמויות וחומרים?`,
        flowTitle: 'אישור כתובת אתר ללקוח חוזר',
        branchId: 'repeat_customer_address_confirmed',
        isRami: false,
        isVIP: false,
        actionType: 'repeat_customer',
        customerProfile: customerHistory
      };
    }

    // 1-3. פנייה בשם מלא, הצגת כתובת אחרונה ושאלת אתר, תזכורת 2-3 מוצרים מובילים
    const isGreetingOrMenu = 
      lower === '' || 
      lower === '0' || 
      lower === 'תפריט' || 
      lower === 'ראשי' || 
      lower.includes('היי') || 
      lower.includes('שלום') || 
      lower.includes('בוקר טוב') || 
      lower.includes('ערב טוב') || 
      lower.includes('חזרה');

    const containsMaterialsInText = STANDARD_CATALOG.some(item => 
      item.keywords.some(kw => lower.includes(kw))
    );

    if (isGreetingOrMenu && !containsMaterialsInText) {
      let topProductsText = '';
      if (topProducts.length > 0) {
        topProductsText = `\n💡 *לנוחיותך, מוצרים מובילים שרכשת אצלנו בעבר:*\n` + 
          topProducts.slice(0, 3).map((p: any) => `• ${p.name}${p.sku ? ` (מק"ט ${p.sku})` : ''}`).join('\n') + '\n';
      }

      const addressPrompt = lastAddress 
        ? `📍 *האם המשלוח מיועד ל-${lastAddress} או לאתר חדש?*`
        : `📍 לאיזה אתר אספקה מיועד המשלוח הפעם?`;

      return {
        replyText: `שלום ${displayName}! 🏗️\nשמחים לראותך שוב ב-*ח. סבן חומרי בניין (1994) בע״מ*!\nזיהיתי אותך כלקוח חוזר מוערך של סבן.\n${topProductsText}\n${addressPrompt}\n\nנא להשיב עם הפעולה הרצויה:\n[1] 🔁 *שכפול ההזמנה הקודמת במדויק* ("כמו פעם שעברה")\n[2] 🧱 *הזמנת חומרים חדשים לאתר*\n[3] 🚛 *שירות מכולות לפינוי פסולת*\n[4] 📦 *בירור סטטוס הזמנה / נהג*\n[5] 📞 *מענה אישי מול ראמי מסארווה*`,
        flowTitle: 'נוהל זיהוי לקוח חוזר והיסטוריית רכישות',
        branchId: 'repeat_customer_welcome',
        isRami: false,
        isVIP: false,
        actionType: 'repeat_customer',
        customerProfile: customerHistory
      };
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 🏗️ 3. עץ תפריט השירות לוואטסאפ (לקוחות וקבלנים)
  // ════════════════════════════════════════════════════════════════════════════

  // בדיקת כלל ברזל 2: אם הלקוח שלח ישירות כתובת בלבד (לדוגמה "בורוכוב 28 תל אביב")
  const hasOnlyStreetAndCity = 
    (lower.includes('רחוב') || lower.includes('בורוכוב') || lower.includes('אחוזה') || lower.includes('ויצמן') || lower.includes('סוקולוב') || lower.includes('התלמיד') || lower.includes('החרש')) ||
    KNOWN_CITIES.some(city => lower.includes(city) && /\d+/.test(text));

  const containsMaterials = STANDARD_CATALOG.some(item => 
    item.keywords.some(kw => lower.includes(kw))
  );

  const session = getCustomerCartSession(rawPhone, cleanName);

  // אם הלקוח שלח אישור סופי של ההזמנה (מאשר / 1 / תאשר) וקיים סל עם כתובת
  if (session.cart.length > 0 && session.address && (lower === 'מאשר' || lower === 'אישור' || lower === 'כן' || lower === '1' || lower.includes('תאשר') || lower.includes('סגור'))) {
    const orderId = 'ORD-' + Math.floor(1000 + Math.random() * 9000);
    const { recommendedTruck } = calculateCartTotals(session.cart);
    const driverName = recommendedTruck.includes('חכמת') ? 'חכמת (משאית מנוף)' : 'עלי (משאית איסוזו)';
    const finalAddress = session.address;
    
    // איפוס הסל לאחר סגירת מעגל מוצלחת
    clearCustomerCart(rawPhone);

    return {
      replyText: `ההזמנה אושרה ושובצה בהצלחה בסידור העבודה! ✅\n📦 מספר הזמנה: *${orderId}*\n📍 יעד אספקה: *${finalAddress}*\n🚛 נהג משובץ: *${driverName}*\n\nראמי מסארווה (050-886-0896) מפקח על האספקה. תודה שבחרת ב-ח. סבן חומרי בניין! 🏗️`,
      flowTitle: 'אישור ושיבוץ סופי בסידור',
      branchId: 'order_finalized',
      isRami: false,
      isVIP: false,
      actionType: 'order_intake'
    };
  }

  // אם ללקוח יש כבר סל חומרים פעיל והוא שלח כתובת אספקה או שעה
  if (session.cart.length > 0 && (hasOnlyStreetAndCity || lower.includes('רחוב') || lower.includes('בוקר') || lower.includes('מחר') || lower.includes('בשעה') || lower.includes('שעה')) && !containsMaterials) {
    session.address = text;
    session.lastUpdated = Date.now();
    const { deposits, weightDisplay, recommendedTruck } = calculateCartTotals(session.cart);

    const cartLines = session.cart.map((item, idx) => {
      const noteStr = item.note ? ` ${item.note}` : '';
      return `${idx + 1}. מק"ט: ${item.sku} | ${item.name} | כמות: ${item.qty}${noteStr}`;
    }).join('\n');
    const depositsFormatted = deposits.map(d => `• ${d} פקדון`).join('\n') || '• פטור מפקדונות';

    return {
      replyText: `מעולה! פרטי האספקה נקלטו בהצלחה 🚚📍\n\n📍 *יעד אספקה:* ${text}\n🚛 *שיבוץ נדרש:* ${recommendedTruck}\n⚖️ *משקל כולל משוער:* ${weightDisplay}\n\n📋 *סיכום סל ההזמנה:*\n${cartLines}\n\n🛡️ *פקדונות מחייבים:*\n${depositsFormatted}\n\nהאם לאשר ולשגר את ההזמנה לסידור העבודה של ראמי? (נא להשיב *"מאשר"* או *"1"* לתזמון סופי).`,
      flowTitle: 'קליטת כתובת וסיכום הזמנה',
      branchId: 'order_address_confirmed',
      isRami: false,
      isVIP: false,
      actionType: 'order_intake'
    };
  }

  if (hasOnlyStreetAndCity && !containsMaterials && text.length < 50) {
    return {
      replyText: `שלום ${cleanName} 🏗️\nקלטתי את כתובת האספקה: "*${text}*" 📍\n\nכדי שראמי יוכל לתאם את המשאית המתאימה:\n1. מהי רשימת החומרים או גודל המכולה הדרושים?\n2. האם נדרשת פריקת מנוף (חצר / קומה) או פריקה במשאית חלוקה/פלטה?`,
      flowTitle: 'אישור כתובת ישירה וקידום הזמנה',
      branchId: 'direct_address_confirmation',
      isRami: false,
      isVIP: false,
      actionType: 'order_intake'
    };
  }

  // נרמול רשימת חומרים וצבירת סל רכישה רב-שלבי (Multi-Turn Cart)
  if (containsMaterials) {
    const isExplicitAddition = lower.includes('להוסיף') || lower.includes('רוצה להוסיף') || lower.includes('תוסיף') || lower.includes('עוד') || lower.includes('בנוסף') || lower.includes('וגם');
    const hadPreviousCart = session.cart.length > 0;
    const isAddition = isExplicitAddition || hadPreviousCart;

    // חילוץ החומרים מההודעה הנוכחית
    const newlyExtracted = extractMaterialsFromText(text);

    if (newlyExtracted.length > 0) {
      for (const newItem of newlyExtracted) {
        const existing = session.cart.find(i => i.sku === newItem.sku);
        if (existing) {
          existing.qty += newItem.qty;
          existing.weightTons += newItem.weightTons;
          if (existing.palletEligible && existing.qty >= 30) {
            const pallets = Math.ceil(existing.qty / 30);
            existing.note = `(${pallets} משטחים)`;
          }
        } else {
          session.cart.push(newItem);
        }
      }
      session.lastUpdated = Date.now();
    }

    const { deposits, weightDisplay, recommendedTruck } = calculateCartTotals(session.cart);

    const cartLines = session.cart.map((item, idx) => {
      const noteStr = item.note ? ` ${item.note}` : '';
      return `${idx + 1}. מק"ט: ${item.sku} | ${item.name} | כמות: ${item.qty}${noteStr}`;
    }).join('\n');

    if (isAddition && hadPreviousCart) {
      // ════════════════════════════════════════════════════════════════════════
      // שלב 2: סיכום סל הזמנה מעודכן לאחר תוספת פריטים
      // ════════════════════════════════════════════════════════════════════════
      const depositsFormatted = deposits.map(d => `• ${d} פקדון`).join('\n') || '• פטור מפקדונות';
      const driverName = recommendedTruck.includes('חכמת') ? 'חכמת' : 'עלי';

      return {
        replyText: `מעולה, עדכנתי והוספתי להזמנה! ➕\n\n📋 *סיכום סל הזמנה מעודכן:*\n${cartLines}\n\n🛡️ *פקדונות מחייבים:*\n${depositsFormatted}\n\n⚖️ משקל כולל משוער: ${weightDisplay} ➔ *שיבוץ נדרש: ${recommendedTruck}.*\n\n📍 לאיזו כתובת לשגר את ${driverName}, ולאיזו שעה לתאם את האספקה?`,
        flowTitle: 'עדכון סל חומרים מצטבר',
        branchId: 'order_cart_updated',
        isRami: false,
        isVIP: false,
        actionType: 'order_intake'
      };
    } else {
      // ════════════════════════════════════════════════════════════════════════
      // שלב 1: קליטת פריטי הזמנה ראשונית ובירור כתובת + תוספות
      // ════════════════════════════════════════════════════════════════════════
      const depositsSummary = deposits.length > 0 ? deposits.join(' + ') : 'ללא פקדונות';

      return {
        replyText: `קלטתי את פריטי ההזמנה שלך! 🏗️\n\n📦 *פירוט החומרים שנקלטו:*\n${cartLines}\n🛡️ *פקדונות נלווים:* ${depositsSummary}.\n\n📍 *כדי שראמי יוכל לשבץ לך משאית:*\n1. מהי כתובת האספקה המדויקת?\n2. האם יש פריטים נוספים שתרצה להוסיף?`,
        flowTitle: 'קליטת פריטי הזמנה ראשונית',
        branchId: 'order_intake_step1',
        isRami: false,
        isVIP: false,
        actionType: 'order_intake'
      };
    }
  }

  // ענף [1] — הזמנת חומרי בניין והובלות לאתר (או בחירת 11-15)
  if (lower === '1' || lower === '15' || lower.includes('חומרי בניין') || lower.includes('הזמנת חומרים')) {
    return {
      replyText: `מעולה! הגעת למחלקת *הזמנות והובלות אתר* 🏗️
משאיות המנוף של *חכמת* ומשאיות החלוקה של *עלי* עומדות לרשותך.

אנא בחר את קטגוריית המוצרים:
[11] 🧱 *חומרי מליטה, דבקים ואיטום* (מלט אפור נשר, לטקריט i335, דבק 109/132, טיט, סיקה)
[12] ⏳ *אגרגטים בבלות או תפזורת* (חול מחצבה, סומסום, מצע, חמרה)
[13] 🏗️ *בלוקים וברזל בניין* (בלוקי בטון 20/20/40, איטונג, רשתות פלדה, ברזל מעובד)
[14] 🪵 *גבס, פרופילים, עץ ובידוד* (לוחות גבס, ניצבים/מסלולים, לוחות עץ פיני, OSB)
[15] 📋 *יש לי רשימה מוכנה / פירוט חופשי*

──────────────────────────────
🔙 _להחלפת נושא, רשום בכל שלב *תפריט* או *0*._`,
      flowTitle: 'ענף [1] - הזמנת חומרי בניין והובלות לאתר',
      branchId: 'branch_1_delivery',
      isRami: false,
      isVIP: false,
      actionType: 'order_intake'
    };
  }

  // ענף [11] — חומרי מליטה, דבקים ואיטום
  if (lower === '11') {
    return {
      replyText: `מחלקת *חומרי מליטה, דבקים ואיטום* 🧱\nחומרים זמינים במלאי מיידי במחסן סבן:\n• מלט אפור נשר 25 ק"ג (מק"ט 10002)\n• לטקריט i335 צמנטי (מק"ט 15335)\n• דבק שרמיק 109 / כרמית 132 (מק"ט 15109 / 15132)\n• טיט מוכן שק / בלה (מק"ט 11550 / 11551)\n• שפכטל בגר PL185 / אמריקאי 28 ק"ג\n\nאנא רשום את הכמויות הדרושות וכתובת האספקה!`,
      flowTitle: 'ענף [11] - מליטה ודבקים',
      branchId: 'branch_11_mortar',
      isRami: false,
      isVIP: false,
      actionType: 'order_intake'
    };
  }

  // ענף [12] — אגרגטים
  if (lower === '12') {
    return {
      replyText: `מחלקת *אגרגטים בבלות או תפזורת* ⏳\nזמינות אספקה במשאית מנוף של חכמת:\n• חול מחצבה/ים בלה 0.6 מ"ק (מק"ט 11501)\n• סומסום נקי בלה (מק"ט 11511)\n• מצע א-ב בלה (מק"ט 11540)\n• חמרה גננית מנופה בלה (מק"ט 11570)\n\nאנא ציין כמה בלות דרושות ולאיזו כתובת לשלוח?`,
      flowTitle: 'ענף [12] - אגרגטים בבלות',
      branchId: 'branch_12_aggregates',
      isRami: false,
      isVIP: false,
      actionType: 'order_intake'
    };
  }

  // ענף [13] — בלוקים וברזל
  if (lower === '13') {
    return {
      replyText: `מחלקת *בלוקים וברזל בניין* 🏗️\n• בלוקי בטון תקניים 20/20/40 (מק"ט 12204)\n• בלוקי איטונג / פומיס בכל המידות\n• רשתות פלדה וברזל מעובד לפי תוכנית מהנדס\n\nאנא ציין כמות מבוקשת (משטחים או יחידות) ויעד פריקה.`,
      flowTitle: 'ענף [13] - בלוקים וברזל',
      branchId: 'branch_13_blocks_iron',
      isRami: false,
      isVIP: false,
      actionType: 'order_intake'
    };
  }

  // ענף [14] — גבס, עץ ובידוד
  if (lower === '14') {
    return {
      replyText: `מחלקת *גבס, פרופילים, עץ ובידוד* 🪵\n• לוחות גבס לבן / ירוק / אדום 2.60 מ' (מק"ט 111260)\n• ניצבים ומסלולים 50 / 70 תקניים\n• לוחות עץ פיני מוקצע 3 מ' (מק"ט 750300) ולוחות OSB\n• צמר סלעים / פוליפנול בידוד\n\nרשום את רשימת הפריטים שלך והכתובת!`,
      flowTitle: 'ענף [14] - גבס ועץ',
      branchId: 'branch_14_drywall_wood',
      isRami: false,
      isVIP: false,
      actionType: 'order_intake'
    };
  }

  // ענף [2] — שירות מכולות ופינוי פסולת (רמסע)
  if (lower === '2' || lower.includes('מכולה') || lower.includes('פסולת') || lower.includes('רמסע') || lower.startsWith('2')) {
    return {
      replyText: `מחלקת *פינוי פסולת ומכולות רמסע* 🚛
אנו מספקים פתרון פינוי מוסדר לאתרים מורשים בלבד.

מה סוג הפעולה הנדרשת?
[21] 📍 *הצבת מכולה חדשה באתר*
[22] 🔄 *החלפת מכולה* (פינוי מלאה והצבת ריקה)
[23] 🚛 *הוצאה ופינוי סופי של מכולה*

אנא ציין גם את נפח המכולה הדרוש:
• *6 קוב* (לשיפוצים ופסולת כבדה/בלוקים)
• *8 קוב* (סטנדרט אתרי בנייה)
• *12 קוב* (פסולת קלה / פינוי גבס ועץ)

⚠️ *דגשים:*
1. תוואי כניסה פנוי לחלוטין למשאית הרמסע להנפה בטוחה.
2. חובה להסדיר אישור עירייה/מועצה אם המכולה תוצב במרחב ציבורי.

מהי כתובת האתר המדויקת ומועד הביצוע המבוקש?`,
      flowTitle: 'ענף [2] - שירות מכולות ופינוי פסולת',
      branchId: 'branch_2_containers',
      isRami: false,
      isVIP: false,
      actionType: 'container_task'
    };
  }

  // ענף [3] — איסוף עצמי, שעות פעילות וניווט למחסנים
  if (lower === '3' || lower.includes('איסוף') || lower.includes('מחסן') || lower.includes('שעות') || lower.includes('ניווט') || lower.includes('סניף')) {
    return {
      replyText: `סניפי ומחסני *ח. סבן* לשירותך 🏭
נשמח לראותך! לאיזה סניף תרצה להגיע?

[31] 🏟️ *סניף התלמיד 6, הוד השרון (מחסן 1)*
• התמחות: חומרים קלים, כלי עבודה, לוחות גבס, פרופילים, צבע ופרזול.
• ⏰ שעות: א'-ה' 06:00–18:00 | ימי ו' 06:00–14:00
• 🧭 ניווט Waze: https://www.waze.com/ul?q=%D7%94%D7%AA%D7%9C%D7%9E%D7%99%D7%93%206%20%D7%94%D7%95%D7%93%20%D7%94%D7%A9%D7%A8%D7%95%D7%9F&navigate=yes
• 🗺️ Google Maps: https://www.google.com/maps/search/?api=1&query=התלמיד+6,+הוד+השרון&query_place_id=ChIJU634eSU4HRURT1dL2O5pQk4

[32] 🏭 *סניף החרש 10, אזוה"ת הוד השרון (מחסן 4 מרכזי)*
• התמחות: מגרש ראשי, אגרגטים בבלות/תפזורת, חומרי מליטה, בלוקים, ברזל ומנופים.
• ⏰ שעות: א'-ה' 06:30–16:00 | ימי ו' 06:30–13:30
• 🧭 ניווט Waze: https://www.waze.com/ul?q=%D7%94%D7%97%D7%A8%D7%A9%2010%20%D7%94%D7%95%D7%93%20%D7%94%D7%A9%D7%A8%D7%95%D7%9F&navigate=yes
• 🗺️ Google Maps: https://www.google.com/maps/search/?api=1&query=החרש+10,+הוד+השרון&query_place_id=ChIJMZU49qI3HRURQwGnFp-VPDU`,
      flowTitle: 'ענף [3] - איסוף עצמי ושעות פעילות',
      branchId: 'branch_3_pickup_branches',
      isRami: false,
      isVIP: false,
      actionType: 'pickup_info'
    };
  }

  // ענף [4] — בירור סטטוס הזמנה קיימת / תעודת משלוח
  if (lower === '4' || lower.includes('מעקב') || lower.includes('סטטוס') || lower.includes('איפה המשאית') || lower.includes('איפה הנהג')) {
    return {
      replyText: `מחלקת *מעקב משלוחים וסידור עבודה* 🚚
כדי שאוכל לבדוק מיידית מול גיליון הסידור הפעיל של *ראמי*:

אנא השב עם:
1. מספר הזמנת קומקס (לדוגמה: 6215751) או שם המזמין המדויק.
2. כתובת היעד.

⚡ _אבצע סריקה מיידית של סטטוס המשאית, מיקום הנהג (חכמת במנוף או עלי בחלוקה) ושעת הגעה משוערת!_`,
      flowTitle: 'ענף [4] - בירור סטטוס הזמנה ומעקב',
      branchId: 'branch_4_track_order',
      isRami: false,
      isVIP: false,
      actionType: 'tracking_check'
    };
  }

  // ענף [5] — מענה אישי, הצעות מחיר ופרויקטים מול ראמי
  if (lower === '5' || lower.includes('ראמי') || lower.includes('הצעת מחיר') || lower.includes('מחיר לפרויקט') || lower.includes('הנחה')) {
    return {
      replyText: `פנייתך הועברה ישירות ל-*ראמי מסארווה* 🫡
מנהל מחלקת ההובלות והסידור (טלפון: 050-886-0896).

ריכזתי עבורו את כל פרטי הבקשה שלך.
ראמי נמצא כרגע בניהול הסידור בשטח ויחזור אליך תוך מספר דקות עם הצעת מחיר מדויקת וסגירת מועד אספקה! 🏗️`,
      flowTitle: 'ענף [5] - פנייה ישירה לראמי מסארווה',
      branchId: 'branch_5_direct_rami',
      isRami: false,
      isVIP: false,
      actionType: 'quote_escalation'
    };
  }

  // ברירת מחדל / איפוס תפריט ראשי ("היי", "שלום", "בוקר טוב", "0", "תפריט", "ראשי", "חזרה", או פתיחה)
  return {
    replyText: `שלום ${cleanName}! 🏗️
ברוכים הבאים ל-*ח. סבן חומרי בניין (1994) בע"מ*.
כאן *נועה*, מערכת הסידור והשירות הדיגיטלית של *ראמי מסארווה* — מנהל מחלקת ההובלות והלוגיסטיקה.

איך נוכל לתת לך שירות מקצועי ומהיר היום?
נא להשיב עם מספר הפעולה הרצויה:

[1] 🧱 *הזמנת חומרי בניין והובלה לאתר* (מלט, ברזל, בלוקים, טיט, אגרגטים, גבס)
[2] 🚛 *שירות מכולות לפינוי פסולת* (הצבה, החלפה או פינוי)
[3] 🏭 *איסוף עצמי, שעות פעילות וניווט למחסנים* (סניפי הוד השרון)
[4] 📦 *בירור סטטוס הזמנה קיימת / תעודת משלוח*
[5] 📞 *מענה אישי, הצעות מחיר ופרויקטים מול ראמי*

──────────────────────────────
💡 _טיפ: ניתן לרשום ישירות רשימת חומרים חופשית וכתובת, ואבצע נרמול ושיבוץ מיידי!_`,
    flowTitle: 'תפריט ראשי סבן - נועה AI',
    branchId: 'welcome_menu',
    isRami: false,
    isVIP: false,
    actionType: 'general_menu'
  };
}
