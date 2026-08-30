export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    [key: string]: unknown;
  };
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface AuthenticatedUser {
  id: string;
  authUserId: string;
  email?: string | null;
  displayName: string;
  role: 'USER' | 'ADMIN' | 'RESTAURANT_OWNER';
}
