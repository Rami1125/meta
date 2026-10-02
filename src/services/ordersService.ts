/**
 * ==============================================================================
 * ח. סבן חומרי בניין (1994) בע״מ | שירות ניהול הזמנות והיסטוריית לקוחות
 * ==============================================================================
 * מודול שליפה מהירה בזמן אמת של היסטוריית הזמנות מגיליון "מערכת מאוחדת"
 * טאב: "דשבורד_הזמנות" (Spreadsheet ID: 1Ie7gKql_EDdrIN9HqunJc9Ey5k0WXXfPRxs0Vp1Bs2c)
 * ==============================================================================
 */

import { STANDARD_CATALOG } from '../logic/noaAiEngine.ts';

export interface ParsedOrderItem {
  sku: string;
  name: string;
  quantity: string | number;
  unit?: string;
  deposit?: string;
  raw?: string;
}

export interface CustomerOrder {
  orderDate?: string; // עמודה A
  orderId: string; // עמודה B (מספר הזמנה בקומקס)
  customerId: string; // עמודה C (קוד לקוח קומקס)
  customerName: string; // עמודה D (שם לקוח / פרויקט)
  warehouse?: string; // עמודה E (מחסן: התלמיד 6 / החרש 10)
  deliveryAddress: string; // עמודה F (כתובת אספקה)
  rawProducts: string; // עמודה G (פירוט מוצרים וכמויות)
  parsedItems: ParsedOrderItem[];
  depositBags?: string; // עמודה H (פקדון בלות)
  depositPallets?: string; // עמודה I (פקדון משטחים)
  assignedDriver?: string; // עמודה J (נהג משוייך: חכמת מנוף / עלי איסוזו)
  wazeLink?: string; // עמודה L (קישור Waze)
  driverPhone?: string; // עמודה P
}

export interface CustomerHistoryProfile {
  customerName: string;
  customerId?: string;
  phone?: string;
  ordersCount: number;
  orders: CustomerOrder[];
  lastOrder?: CustomerOrder;
  previousAddresses: string[];
  pastPurchases: ParsedOrderItem[];
  topProducts: { sku: string; name: string; totalQty: number }[];
  lastOrderFormattedSummary: string;
}

const DEFAULT_SHEET_ID = '1Ie7gKql_EDdrIN9HqunJc9Ey5k0WXXfPRxs0Vp1Bs2c';
const DEFAULT_SHEET_TAB = 'דשבורד_הזמנות';

// מטמון בזיכרון (Cache) למניעת עומס על Google Sheets ומהירות תגובה של מילישניות
let cachedOrders: CustomerOrder[] = [];
let lastFetchTime = 0;
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 דקות

/**
 * חילוץ וניתוח שורות מוצרים מתוך עמודה G (פירוט מוצרים וכמויות)
 */
export function parseOrderProducts(rawText: string): ParsedOrderItem[] {
  if (!rawText || typeof rawText !== 'string') return [];
  
  const rawClean = rawText.trim();
  if (!rawClean) return [];

  const items: ParsedOrderItem[] = [];
  const lines = rawClean.split(/[\n\r]+/).map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    // 1. זיהוי מק"ט וכמות באמצעות ביטויים רגולריים
    // דוגמאות: "1. 📦 מק"ט: 112000 | לוח גבס ירוק | כמות: 10"
    // או "מק"ט: 111260 | לוח גבס לבן 260 12.50 | כמות: 45"
    const skuMatch = line.match(/מק["״]ט:\s*([0-9a-zA-Z-]+)/i);
    const qtyMatch = line.match(/כמות:\s*([0-9.]+)/i);

    let name = '';
    const parts = line.split('|').map(p => p.trim());
    if (parts.length >= 2) {
      name = parts[1].replace(/^[0-9.\s📦\-]+/, '').trim();
    } else {
      name = line
        .replace(/מק["״]ט:[^|]+/i, '')
        .replace(/כמות:.*/i, '')
        .replace(/^[0-9.\s📦\-]+/, '')
        .trim();
    }

    let sku = skuMatch ? skuMatch[1].trim() : '';
    let quantity: string | number = qtyMatch ? qtyMatch[1].trim() : '1';

    // אם לא נמצא מק"ט ישיר, חפש בקטלוג התקני של סבן
    if (!sku) {
      const lower = line.toLowerCase();
      const matchedCatalog = STANDARD_CATALOG.find(cat =>
        cat.keywords.some(kw => lower.includes(kw))
      );
      if (matchedCatalog) {
        sku = matchedCatalog.sku;
        if (!name) name = matchedCatalog.name;
      }
    }

    if (sku || name) {
      items.push({
        sku,
        name: name || `מוצר מק"ט ${sku}`,
        quantity,
        raw: line
      });
    }
  }

  return items;
}

/**
 * שירות ניהול ושליפת הזמנות
 */
export const ordersService = {
  /**
   * שליפת כל ההזמנות מתוך Google Sheets עם תמיכה במטמון
   */
  async fetchAllOrders(forceRefresh = false): Promise<CustomerOrder[]> {
    const now = Date.now();
    if (!forceRefresh && cachedOrders.length > 0 && (now - lastFetchTime < CACHE_TTL_MS)) {
      return cachedOrders;
    }

    try {
      // 1. נסה שליפה מובנית באמצעות GViz JSON (הטאב הראשי של הגיליון כולל את כל 619 ההזמנות)
      const urlsToTry = [
        `https://docs.google.com/spreadsheets/d/${DEFAULT_SHEET_ID}/gviz/tq?tqx=out:json`,
        `https://docs.google.com/spreadsheets/d/${DEFAULT_SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(DEFAULT_SHEET_TAB)}`
      ];

      let rows: any[] = [];

      for (const jsonUrl of urlsToTry) {
        try {
          const res = await fetch(jsonUrl, {
            headers: { 'User-Agent': 'Noa-AI-HSaban/1.0' },
            signal: AbortSignal.timeout(8000)
          });
          if (!res.ok) continue;

          const txt = await res.text();
          const rawJson = txt
            .replace(/^\/\*O_o\*\/\s*google\.visualization\.Query\.setResponse\(/, '')
            .replace(/\);?\s*$/, '');
          const parsed = JSON.parse(rawJson);
          const candidateRows = parsed?.table?.rows || [];
          // בדוק אם יש שורות עם נתונים אמיתיים
          const hasRealData = candidateRows.some((r: any) => r.c && r.c[3] && String(r.c[3].f || r.c[3].v || '').trim().length > 1);
          if (candidateRows.length > 0 && hasRealData) {
            rows = candidateRows;
            break;
          } else if (candidateRows.length > rows.length) {
            rows = candidateRows;
          }
        } catch {}
      }

      const parsedOrders: CustomerOrder[] = [];

      for (const row of rows) {
        if (!row.c || !Array.isArray(row.c)) continue;
        const getVal = (idx: number): string => {
          const cell = row.c[idx];
          if (!cell) return '';
          return String(cell.f || cell.v || '').trim();
        };

        const orderDate = getVal(0);
        const orderId = getVal(1);
        const customerId = getVal(2);
        const customerName = getVal(3);
        const warehouse = getVal(4);
        const deliveryAddress = getVal(5);
        const rawProducts = getVal(6);
        const depositBags = getVal(7);
        const depositPallets = getVal(8);
        const assignedDriver = getVal(9);
        const wazeLink = getVal(11);
        const driverPhone = getVal(15);

        // סינון שורות ריקות לחלוטין
        if (!orderId && !customerId && !customerName && !deliveryAddress) {
          continue;
        }

        const parsedItems = parseOrderProducts(rawProducts);

        parsedOrders.push({
          orderDate,
          orderId,
          customerId,
          customerName,
          warehouse,
          deliveryAddress,
          rawProducts,
          parsedItems,
          depositBags,
          depositPallets,
          assignedDriver,
          wazeLink,
          driverPhone
        });
      }

      if (parsedOrders.length > 0) {
        cachedOrders = parsedOrders;
        lastFetchTime = now;
      }

      return cachedOrders;
    } catch (err: any) {
      console.warn('⚠️ שגיאה בשליפת GViz JSON, מנסה CSV חלופי:', err.message);
      
      // Fallback דרך CSV
      try {
        const csvUrl = `https://docs.google.com/spreadsheets/d/${DEFAULT_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(DEFAULT_SHEET_TAB)}`;
        const csvRes = await fetch(csvUrl, { signal: AbortSignal.timeout(6000) });
        if (csvRes.ok) {
          const csvText = await csvRes.text();
          const lines = csvText.split('\n');
          const fallbackOrders: CustomerOrder[] = [];

          for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            // חלוקת שורה פשוטה
            const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(s => s.replace(/^"|"$/g, '').trim());
            if (parts.length >= 6) {
              const orderId = parts[1] || '';
              const customerId = parts[2] || '';
              const customerName = parts[3] || '';
              const deliveryAddress = parts[5] || '';
              const rawProducts = parts[6] || '';

              if (orderId || customerId || customerName) {
                fallbackOrders.push({
                  orderDate: parts[0] || '',
                  orderId,
                  customerId,
                  customerName,
                  warehouse: parts[4] || '',
                  deliveryAddress,
                  rawProducts,
                  parsedItems: parseOrderProducts(rawProducts),
                  assignedDriver: parts[9] || '',
                  wazeLink: parts[11] || ''
                });
              }
            }
          }

          if (fallbackOrders.length > 0) {
            cachedOrders = fallbackOrders;
            lastFetchTime = now;
            return cachedOrders;
          }
        }
      } catch (csvErr: any) {
        console.error('❌ שגיאה גם בגיבוי CSV:', csvErr.message);
      }

      return cachedOrders;
    }
  },

  /**
   * שליפת הזמנות לפי קוד לקוח (קומקס), שם לקוח או מספר טלפון
   */
  async getOrdersByCustomerId(
    customerId?: string,
    customerName?: string,
    phone?: string
  ): Promise<CustomerOrder[]> {
    const allOrders = await this.fetchAllOrders();
    const cleanId = (customerId || '').trim().toLowerCase();
    const cleanName = (customerName || '').trim().toLowerCase();
    const cleanPhone = (phone || '').replace(/[^0-9]/g, '');

    if (!cleanId && !cleanName && !cleanPhone) {
      return [];
    }

    return allOrders.filter(order => {
      // 1. התאמת קוד לקוח
      if (cleanId && order.customerId && order.customerId.toLowerCase() === cleanId) {
        return true;
      }

      // 2. התאמת שם לקוח (כולל תת-מחרוזת)
      if (cleanName && order.customerName) {
        const orderName = order.customerName.toLowerCase();
        if (orderName === cleanName) return true;
        // בדיקת הכלה בשמות מעל 2 תווים
        if (cleanName.length >= 3 && (orderName.includes(cleanName) || cleanName.includes(orderName))) {
          return true;
        }
        // פירוק שמות (למשל "וגשל", "ד.ניב", "שוקדים")
        const nameKeywords = cleanName.split(/[\s/\\-]+/).filter(w => w.length >= 3);
        if (nameKeywords.some(kw => orderName.includes(kw))) {
          return true;
        }
      }

      // 3. התאמת כתובת המכילה את הטלפון או התאמה מול טלפון איש קשר
      if (cleanPhone && cleanPhone.length >= 7) {
        if (order.deliveryAddress && order.deliveryAddress.includes(cleanPhone)) return true;
        if (order.driverPhone && order.driverPhone.replace(/[^0-9]/g, '').includes(cleanPhone)) return true;
      }

      return false;
    });
  },

  /**
   * בניית פרופיל לקוח חוזר מלא כולל כתובות ומוצרים מובילים
   */
  async getCustomerProfile(
    customerId?: string,
    customerName?: string,
    phone?: string
  ): Promise<CustomerHistoryProfile | null> {
    const clientOrders = await this.getOrdersByCustomerId(customerId, customerName, phone);
    if (!clientOrders || clientOrders.length === 0) {
      return null;
    }

    const lastOrder = clientOrders[0];
    const previousAddresses = [
      ...new Set(clientOrders.map(o => o.deliveryAddress).filter(Boolean))
    ];
    const pastPurchases = clientOrders.flatMap(o => o.parsedItems);

    // ניתוח 2–3 מוצרים מובילים שנרכשו בעבר
    const productFrequency: Record<string, { sku: string; name: string; count: number; totalQty: number }> = {};
    for (const item of pastPurchases) {
      const key = item.sku || item.name;
      if (!key) continue;
      if (!productFrequency[key]) {
        productFrequency[key] = {
          sku: item.sku,
          name: item.name,
          count: 0,
          totalQty: 0
        };
      }
      productFrequency[key].count += 1;
      const q = typeof item.quantity === 'number' ? item.quantity : parseFloat(String(item.quantity)) || 1;
      productFrequency[key].totalQty += q;
    }

    const topProducts = Object.values(productFrequency)
      .sort((a, b) => b.count - a.count || b.totalQty - a.totalQty)
      .slice(0, 3)
      .map(p => ({ sku: p.sku, name: p.name, totalQty: p.totalQty }));

    // סיכום מפורט של ההזמנה האחרונה
    let lastOrderFormattedSummary = '';
    if (lastOrder && lastOrder.parsedItems.length > 0) {
      lastOrderFormattedSummary = lastOrder.parsedItems
        .map(item => `• ${item.name}${item.sku ? ` (מק"ט ${item.sku})` : ''}: *${item.quantity}*`)
        .join('\n');
    } else if (lastOrder && lastOrder.rawProducts) {
      lastOrderFormattedSummary = lastOrder.rawProducts;
    }

    return {
      customerName: lastOrder.customerName || customerName || 'לקוח סבן',
      customerId: lastOrder.customerId || customerId,
      phone,
      ordersCount: clientOrders.length,
      orders: clientOrders,
      lastOrder,
      previousAddresses,
      pastPurchases,
      topProducts,
      lastOrderFormattedSummary
    };
  }
};
