export type AuthUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  userType: string;
  status: string;
  roles: string[];
  permissions: string[];
};

export type AuthTokensResponse = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
};

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type PaginatedResponse<T> = {
  items: T[];
  meta: PaginationMeta;
};

export type ApiErrorBody = {
  statusCode?: number;
  message?: string | string[];
  error?: string;
};
