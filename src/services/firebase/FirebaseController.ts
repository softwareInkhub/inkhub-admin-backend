import type { NextApiRequest, NextApiResponse } from 'next';
import { FirebaseActivity } from './FirebaseActivity';
import { collection, getDocs, query, orderBy, limit, startAfter } from 'firebase/firestore';
import { FirebaseClientAccessor } from './FirebaseClientAccessor';

export class FirebaseController {
  private activity: FirebaseActivity;
  private db = FirebaseClientAccessor.getInstance().getDb();

  constructor() {
    this.activity = new FirebaseActivity();
  }

  async handleRequest(req: NextApiRequest, res: NextApiResponse) {
    try {
      switch (req.method) {
        case 'GET':
          if (req.query.id) {
            const user = await this.activity.getUserById(req.query.id as string);
            res.status(200).json(user);
          } else if (req.query.resource === 'shopify-orders') {
            console.log('Fetching orders from Firebase...');
            const orders = await this.getShopifyOrders();
            res.status(200).json(orders);
          } else {
            const users = await this.activity.getUsers();
            res.status(200).json(users);
          }
          break;

        case 'POST':
          const newUser = await this.activity.createUser(req.body);
          res.status(201).json(newUser);
          break;

        case 'PUT':
          const { id, ...updateData } = req.body;
          const updatedUser = await this.activity.updateUser(id, updateData);
          res.status(200).json(updatedUser);
          break;

        case 'DELETE':
          const result = await this.activity.deleteUser(req.query.id as string);
          res.status(200).json(result);
          break;

        default:
          res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
          res.status(405).end(`Method ${req.method} Not Allowed`);
      }
    } catch (error) {
      console.error('Firebase Controller Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      res.status(500).json({ error: errorMessage });
    }
  }

  async getShopifyOrders(page: number = 0, pageSize: number = 25) {
    try {
      const ordersCollection = collection(this.db, 'shopify-orders');
      
      // Get total count
      const totalSnapshot = await getDocs(collection(this.db, 'shopify-orders'));
      const totalCount = totalSnapshot.size;

      // Get paginated data
      const querySnapshot = await getDocs(query(
        ordersCollection,
        orderBy('createdAt', 'desc'),
        limit(pageSize)
      ));

      // Return raw document data
      const orders = querySnapshot.docs.map(doc => ({
        ...doc.data(),
        firebaseId: doc.id
      }));

      return {
        success: true,
        count: totalCount,
        orders
      };

    } catch (error) {
      console.error('Error fetching orders:', error);
      return {
        success: false,
        count: 0,
        orders: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getAllShopifyOrders() {
    try {
      const ordersCollection = collection(this.db, 'shopify-orders');
      const querySnapshot = await getDocs(query(
        ordersCollection,
        orderBy('createdAt', 'desc')
      ));

      const orders = querySnapshot.docs.map(doc => ({
        ...doc.data(),
        firebaseId: doc.id
      }));

      return {
        success: true,
        count: orders.length,
        orders
      };
    } catch (error) {
      console.error('Error fetching all orders:', error);
      return {
        success: false,
        count: 0,
        orders: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
} 