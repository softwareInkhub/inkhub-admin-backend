export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  permissions: Permission[];
}

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  DESIGNER = 'DESIGNER',
  STAFF = 'STAFF'
}

export enum Permission {
  READ_USERS = 'READ_USERS',
  WRITE_USERS = 'WRITE_USERS',
  MANAGE_PRODUCTS = 'MANAGE_PRODUCTS',
  MANAGE_ORDERS = 'MANAGE_ORDERS'
} 