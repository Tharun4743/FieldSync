import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    status: 'ok',
    ts: Date.now(),
    version: process.env.VITE_APP_VERSION ?? '1.0.0',
  });
}
