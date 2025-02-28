import type { NextApiRequest, NextApiResponse } from 'next';
import { ShopifyController } from '@/services/controller/ShopifyController';

export class ShopifyActivity {
  private controller: ShopifyController;

  constructor() {
    this.controller = new ShopifyController();
  }

  async handleRequest(req: NextApiRequest, res: NextApiResponse) {
    const { resource } = req.query;
    const limit = Number(req.query.limit) || 10;

    console.log('Processing Shopify request:', { resource, limit });

    try {
      switch (resource) {
        case 'products':
          return await this.controller.getProducts(limit, res);

        case 'orders':
          return await this.controller.getOrders(limit, res);

        case 'collections':
          return await this.controller.getCollections(limit, res);

        case 'open-orders':
          return await this.controller.getOpenOrders(limit, res);

        case 'sync-orders':
          if (req.method === 'POST') {
            return await this.controller.syncOrdersToFirebase(res);
          }
          break;

        case 'sync-all-orders':
          if (req.method === 'POST') {
            return await this.controller.startFullOrderSync(res);
          }
          break;

        default:
          return res.status(404).json({ 
            error: `Resource '${resource}' not found`
          });
      }

      return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
      console.error('Shopify Activity error:', error);
      return res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
} 