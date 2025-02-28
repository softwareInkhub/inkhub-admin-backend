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
  DocumentData 
} from 'firebase/firestore';
import { FirebaseClientAccessor } from './FirebaseClientAccessor';
import { FirebaseUser } from './types/FirebaseTypes';

export class FirebaseActivity {
  private db = FirebaseClientAccessor.getInstance().getDb();
  private collection = 'users';

  async createUser(data: Omit<FirebaseUser, 'id'>): Promise<FirebaseUser> {
    try {
      const collectionRef = collection(this.db, this.collection);
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
      const querySnapshot = await getDocs(collection(this.db, this.collection));
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
      const docRef = doc(this.db, this.collection, id);
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
      const docRef = doc(this.db, this.collection, id);
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
      const docRef = doc(this.db, this.collection, id);
      await deleteDoc(docRef);
      return { id, deleted: true };
    } catch (error) {
      throw new Error(`Error deleting user: ${error}`);
    }
  }
} 