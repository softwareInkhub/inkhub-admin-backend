import type { NextApiRequest, NextApiResponse } from 'next';
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  DocumentData 
} from 'firebase/firestore';
import { FirebaseClientAccessor } from '../clientaccessor/FirebaseClientAccessor';
import { FirebaseUser, UserRole, Permission } from '../types/FirebaseTypes';

export class FirebaseController {
  private db = FirebaseClientAccessor.getInstance().getDb();
  private usersCollection = 'users';

  // User Management Methods
  async createUser(data: Omit<FirebaseUser, 'id'>): Promise<FirebaseUser> {
    try {
      const collectionRef = collection(this.db, this.usersCollection);
      const docRef = await addDoc(collectionRef, {
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      
      return {
        id: docRef.id,
        ...data
      };
    } catch (error) {
      throw new Error(`Error creating user: ${error}`);
    }
  }

  async getUsers(): Promise<FirebaseUser[]> {
    try {
      const querySnapshot = await getDocs(collection(this.db, this.usersCollection));
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as FirebaseUser));
    } catch (error) {
      throw new Error(`Error fetching users: ${error}`);
    }
  }

  async getUserById(id: string): Promise<FirebaseUser> {
    try {
      const docRef = doc(this.db, this.usersCollection, id);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        throw new Error('User not found');
      }

      return {
        id: docSnap.id,
        ...docSnap.data()
      } as FirebaseUser;
    } catch (error) {
      throw new Error(`Error fetching user: ${error}`);
    }
  }

  async updateUser(id: string, data: Partial<FirebaseUser>): Promise<FirebaseUser> {
    try {
      const docRef = doc(this.db, this.usersCollection, id);
      await updateDoc(docRef, {
        ...data,
        updatedAt: new Date().toISOString()
      });

      return this.getUserById(id);
    } catch (error) {
      throw new Error(`Error updating user: ${error}`);
    }
  }

  async deleteUser(id: string): Promise<{ id: string; deleted: boolean }> {
    try {
      const docRef = doc(this.db, this.usersCollection, id);
      await deleteDoc(docRef);
      return { id, deleted: true };
    } catch (error) {
      throw new Error(`Error deleting user: ${error}`);
    }
  }

  // Shopify Orders Methods
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

  private async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (error instanceof Error && (error as any).code === 'deadline-exceeded') {
          console.log(`Operation timed out, attempt ${attempt}/${maxRetries}. Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }
    throw lastError;
  }

  async getAllShopifyOrders() {
    try {
      console.log('Starting getAllShopifyOrders...');
      
      return await this.retryOperation(async () => {
        const ordersCollection = collection(this.db, 'shopify-orders');
        console.log('Fetching orders from collection...');
        
        const querySnapshot = await getDocs(query(
          ordersCollection,
          orderBy('createdAt', 'desc')
        ));

        console.log(`Retrieved ${querySnapshot.size} orders from Firebase`);

        const orders = querySnapshot.docs.map(doc => ({
          ...doc.data(),
          firebaseId: doc.id
        }));

        console.log('Successfully processed all orders');
        return {
          success: true,
          count: orders.length,
          orders
        };
      });
    } catch (error) {
      console.error('Error fetching all orders:', {
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorCode: error instanceof Error ? (error as any).code : undefined,
        stack: error instanceof Error ? error.stack : undefined
      });
      return {
        success: false,
        count: 0,
        orders: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // API Request Handler
  async handleRequest(req: NextApiRequest, res: NextApiResponse) {
    try {
      console.log('Firebase Controller handling request:', {
        method: req.method,
        query: req.query,
        path: req.url
      });

      switch (req.method) {
        case 'GET':
          if (req.query.id) {
            const user = await this.getUserById(req.query.id as string);
            return res.status(200).json(user);
          } else if (req.query.resource === 'shopify-orders') {
            if (req.query.all === 'true') {
              console.log('Fetching all orders from Firebase...');
              const orders = await this.getAllShopifyOrders();
              return res.status(200).json(orders);
            } else {
              console.log('Fetching paginated orders from Firebase...');
              const page = Number(req.query.page) || 0;
              const pageSize = Number(req.query.pageSize) || 25;
              const orders = await this.getShopifyOrders(page, pageSize);
              return res.status(200).json(orders);
            }
          } else {
            const users = await this.getUsers();
            return res.status(200).json(users);
          }
          break;

        case 'POST':
          const newUser = await this.createUser(req.body);
          return res.status(201).json(newUser);

        case 'PUT':
          const { id, ...updateData } = req.body;
          const updatedUser = await this.updateUser(id, updateData);
          return res.status(200).json(updatedUser);

        case 'DELETE':
          const result = await this.deleteUser(req.query.id as string);
          return res.status(200).json(result);

        default:
          res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
          return res.status(405).end(`Method ${req.method} Not Allowed`);
      }
    } catch (error) {
      console.error('Firebase Controller Error:', {
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorCode: error instanceof Error ? (error as any).code : undefined,
        stack: error instanceof Error ? error.stack : undefined
      });
      return res.status(500).json({ 
        error: error instanceof Error ? error.message : 'An unknown error occurred'
      });
    }
  }
} 