// Pages Router handler for JONI webhook
import joniHandler from '@/api/webhooks/joni.ts';

export default function handler(req: any, res: any) {
  return joniHandler(req, res);
}
