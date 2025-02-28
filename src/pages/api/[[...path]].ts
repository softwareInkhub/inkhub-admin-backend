import { NextApiRequest, NextApiResponse } from 'next';
import { FirebaseController } from '@/services/controller/FirebaseController';
import { ShopifyActivity } from '@/services/activity/ShopifyActivity';
import Cors from 'cors';

const firebaseController = new FirebaseController();
const shopifyActivity = new ShopifyActivity();

// Initialize CORS middleware
const cors = Cors({
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  origin: (origin, callback) => {
    const allowedOrigins = [
      'http://localhost:3001',
      'http://localhost:3002',
      process.env.FRONTEND_URL
    ].filter(Boolean);

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
});

// Helper method to wait for a middleware to execute before continuing
// And to throw an error when an error happens in a middleware
function runMiddleware(req: NextApiRequest, res: NextApiResponse, fn: Function) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result: any) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Run the CORS middleware
  await runMiddleware(req, res, cors);

  const { path = [] } = req.query;
  const [service, ...rest] = path as string[];

  console.log('API Request:', {
    method: req.method,
    service,
    path: rest,
    query: req.query,
    origin: req.headers.origin
  });

  try {
    switch (service) {
      case 'firebase': {
        const resource = rest[0];
        const subResource = rest[1];
        
        if (resource === 'shopify-orders') {
          if (req.method === 'GET') {
            console.log('Processing Firebase shopify-orders request:', {
              subResource,
              query: req.query
            });

            if (subResource === 'all') {
              // Handle /api/firebase/shopify-orders/all
              console.log('Fetching all orders...');
              const result = await firebaseController.getAllShopifyOrders();
              console.log('Fetch complete:', {
                success: result.success,
                count: result.count,
                hasError: 'error' in result
              });
              return res.status(result.success ? 200 : 500).json(result);
            } else {
              // Handle /api/firebase/shopify-orders with pagination
              const page = Number(req.query.page) || 0;
              const pageSize = Number(req.query.pageSize) || 25;
              console.log('Fetching paginated orders:', { page, pageSize });
              const result = await firebaseController.getShopifyOrders(page, pageSize);
              return res.status(result.success ? 200 : 500).json(result);
            }
          }
        }
        
        // Forward other Firebase requests to the controller
        return await firebaseController.handleRequest(req, res);
      }

      case 'shopify': {
        // Forward to Shopify activity
        if (['GET', 'POST'].includes(req.method || '')) {
          req.query.resource = rest[0]; // Set the resource for the activity
          return await shopifyActivity.handleRequest(req, res);
        }
        break;
      }
    }

    // If no route matched
    console.log('No matching route found:', { service, path: rest });
    return res.status(404).json({ error: 'Route not found' });
  } catch (error) {
    console.error('API Error:', {
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorCode: error instanceof Error ? (error as any).code : undefined,
      stack: error instanceof Error ? error.stack : undefined
    });
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
}

export const config = {
  api: {
    bodyParser: true,
  },
}; 