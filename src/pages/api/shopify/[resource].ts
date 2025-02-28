import type { NextApiRequest, NextApiResponse } from 'next';
import { ShopifyController } from '@/services/shopify/ShopifyController';
import cors from '@/utils/cors';

const shopifyController = new ShopifyController();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Enable CORS
  await cors(req, res);

  // Pre-flight request
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    return res.status(200).end();
  }

  // Allow both GET and POST methods
  if (!['GET', 'POST'].includes(req.method || '')) {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('API Route handling:', req.query.resource, 'Method:', req.method);
    await shopifyController.handleRequest(req, res);
  } catch (error) {
    console.error('API Route Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export const config = {
  api: {
    bodyParser: true,
  },
}; 