// App Router handler for JONI Webhook (Next.js / Vercel App Router)
// Handles WhatsApp incoming webhook, Global Catch-All Welcome Menu, Outgoing Dispatch Logging & Plain Text Fallback

export * from '../../../../api/webhooks/joni/route';
export { POST, GET, sendWhatsAppMessage, sendWhatsAppText, sendWelcomeMenuWithFallback, FALLBACK_WELCOME_TEXT } from '../../../../api/webhooks/joni/route';
