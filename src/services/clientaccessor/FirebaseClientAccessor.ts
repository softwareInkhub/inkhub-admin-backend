import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

export class FirebaseClientAccessor {
  private static instance: FirebaseClientAccessor;
  private app;
  private db;
  private auth;

  private constructor() {
    const firebaseConfig = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
    };

    this.app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    this.db = getFirestore(this.app);
    this.auth = getAuth(this.app);
  }

  public static getInstance(): FirebaseClientAccessor {
    if (!FirebaseClientAccessor.instance) {
      FirebaseClientAccessor.instance = new FirebaseClientAccessor();
    }
    return FirebaseClientAccessor.instance;
  }

  public getDb() {
    return this.db;
  }

  public getAuth() {
    return this.auth;
  }
} 