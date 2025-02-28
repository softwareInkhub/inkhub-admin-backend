import { UserRole, Permission } from '@/types';

export interface FirebaseUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  permissions: Permission[];
  createdAt?: string;
  updatedAt?: string;
} 