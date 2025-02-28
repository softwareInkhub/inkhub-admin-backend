import type { NextApiRequest, NextApiResponse } from 'next';
import { FirebaseController } from '@/services/firebase/FirebaseController';
import cors from '@/utils/cors';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3001');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    try {
      const firebaseController = new FirebaseController();
      const result = await firebaseController.getAllShopifyOrders();
      return res.status(200).json(result);
    } catch (error) {
      console.error('API Error:', error);
      return res.status(500).json({
        success: false,
        count: 0,
        orders: [],
        error: 'Internal server error'
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
} 