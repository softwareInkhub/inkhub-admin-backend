import type { NextApiRequest, NextApiResponse } from 'next';
import { ShopifyActivity } from './ShopifyActivity';

export class ShopifyController {
  private activity: ShopifyActivity;

  constructor() {
    this.activity = new ShopifyActivity();
  }

  async handleRequest(req: NextApiRequest, res: NextApiResponse) {
    const { resource } = req.query;
    const limit = Number(req.query.limit) || 10;

    console.log('Processing request:', { resource, limit });

    try {
      switch (resource) {
        case 'products':
          const products = await this.activity.getProducts(limit);
          return res.status(200).json(products);

        case 'orders':
          const allOrders = await this.activity.getOrders(limit);
          return res.status(200).json(allOrders);

        case 'collections':
          const collections = await this.activity.getCollections(limit);
          res.status(200).json(collections);
          break;

        case 'test':
          const testProduct = await this.getTestProduct();
          res.status(200).json(testProduct);
          break;

        case 'open-orders':
          console.log('Handling open orders request');
          try {
            const openOrders = await this.activity.getOpenOrders(50);
            return res.status(200).json({
              success: true,
              count: openOrders.length,
              orders: openOrders.map(order => ({
                id: order.id,
                name: order.name,
                createdAt: order.createdAt,
                displayFulfillmentStatus: order.displayFulfillmentStatus,
                displayFinancialStatus: order.displayFinancialStatus,
                totalPriceSet: order.totalPriceSet,
                customer: {
                  firstName: order.customer?.firstName || 'N/A',
                  lastName: order.customer?.lastName || '',
                  email: order.customer?.email || 'N/A'
                },
                lineItems: order.lineItems.map(item => ({
                  title: item.title,
                  quantity: item.quantity,
                  variant: {
                    title: item.variant?.title || 'N/A',
                    price: item.variant?.price || '0.00'
                  }
                }))
              }))
            });
          } catch (error) {
            console.error('Error processing open orders:', error);
            throw error;
          }
          break;

        case 'sync-orders':
          console.log('Handling sync-orders request');
          try {
            const syncResult = await this.activity.syncOrdersToFirebase();
            return res.status(200).json({
              success: true,
              message: 'Orders synced successfully',
              ...syncResult
            });
          } catch (error) {
            console.error('Error syncing orders:', error);
            throw error;
          }
          break;

        case 'sync-all-orders':
          console.log('Starting full order sync...');
          try {
            const syncJob = await this.activity.startFullOrderSync();
            return res.status(200).json({
              success: true,
              ...syncJob
            });
          } catch (error) {
            console.error('Error starting full order sync:', error);
            throw error;
          }
          break;

        default:
          return res.status(404).json({ 
            error: `Resource '${resource}' not found`
          });
      }
    } catch (error) {
      console.error('Controller error:', error);
      return res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async getTestProduct() {
    const products = await this.activity.getProducts(1);
    return {
      message: 'Test Product',
      product: products[0]
    };
  }
} 