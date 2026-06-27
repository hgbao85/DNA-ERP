import type { User } from '../context/AuthContext';

/** Phân hệ mặc định sau đăng nhập — tài khoản chuyên biệt bị khóa vào 1 phân hệ. */
export function resolveDefaultModule(user: User | null): string | null {
  if (!user) return null;
  if (user.mfgRole) return 'production';
  if (user.isProductPlanner) return 'production_plan';
  if (user.role === 'SALES') return 'crm';
  if (user.isPurchaser) return 'purchasing';
  if (user.role === 'WAREHOUSE_STAFF') return 'inbound_warehouse';
  return null; // MANAGER: chọn phân hệ trên màn hình module
}

export function isDirector(user: User | null): boolean {
  return user?.role === 'MANAGER' && !user?.mfgRole;
}
