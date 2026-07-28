/**
 * DTO cho các response/request thật của BE (module auth + user profile).
 * Dùng chung giữa `services/auth-api.ts` và `services/users-mapper.ts` để tránh khai báo
 * shape `BeUser` trùng lặp ở 2 nơi.
 */

/** Role thô từ BE (GET /roles). */
export interface BeRole {
  id: string;
  name: string;
  description?: string;
}

/** Response của GET /auth/me và từng phần tử GET /users — cùng 1 UserResponseDto ở BE. */
export interface BeUserProfile {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  roles: string[]; // RBAC N-N — tên role, không phải UUID
  mfgRole: string | null;
  warehouseScope: string | null;
  isPurchaser: boolean;
  isProductPlanner: boolean;
  isSale: boolean;
}

/** Response của POST /auth/login và POST /auth/refresh — AuthTokensDto ở BE. */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/** Payload FE gửi để đăng nhập. BE nhận `username`; `email` giữ lại để tương thích chỗ gọi cũ. */
export interface LoginCredentials {
  username?: string;
  email?: string;
  password: string;
}
