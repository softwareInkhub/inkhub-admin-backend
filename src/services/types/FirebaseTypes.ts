export interface FirebaseUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  permissions: Permission[];
  createdAt?: string;
  updatedAt?: string;
  displayName?: string;
  phoneNumber?: string;
  photoURL?: string;
  disabled?: boolean;
  emailVerified?: boolean;
  metadata?: {
    lastSignInTime?: string;
    creationTime?: string;
  };
}

export enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER',
  MANAGER = 'MANAGER',
  STAFF = 'STAFF'
}

export enum Permission {
  READ = 'READ',
  WRITE = 'WRITE',
  DELETE = 'DELETE',
  MANAGE_USERS = 'MANAGE_USERS',
  MANAGE_ORDERS = 'MANAGE_ORDERS',
  MANAGE_PRODUCTS = 'MANAGE_PRODUCTS',
  VIEW_ANALYTICS = 'VIEW_ANALYTICS',
  SYNC_SHOPIFY = 'SYNC_SHOPIFY'
}

export interface UserCredential {
  email: string;
  password: string;
}

export interface UserUpdateData {
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: UserRole;
  permissions?: Permission[];
  displayName?: string;
  phoneNumber?: string;
  photoURL?: string;
  disabled?: boolean;
} 