import type { User } from '../context/AuthContext';

/**
 * Chuẩn hoá user về model phẳng của FE. Nhận được CẢ 2 shape:
 *  - BE thật (GET /auth/me): { roles: string[], firstName, lastName, ... }
 *  - Đã phẳng (restore từ localStorage): { role, name, ... }
 * Suy `role` phẳng từ roles[] (RBAC N-N) và gộp name từ firstName/lastName khi cần.
 */
export function normalizeUser(raw: Record<string, unknown>): User {
  const roles = Array.isArray(raw.roles) ? (raw.roles as string[]) : [];
  const role: User['role'] =
    (raw.role as User['role']) ??
    (roles.includes('ADMIN') ? 'ADMIN' : roles.includes('BOSS') ? 'BOSS' : 'WAREHOUSE_STAFF');

  const name =
    (raw.name as string) ??
    `${(raw.firstName as string) ?? ''} ${(raw.lastName as string) ?? ''}`.trim();

  return {
    id: raw.id as number,
    name,
    email: raw.email as string,
    role,
    mfgRole: (raw.mfgRole as User['mfgRole']) ?? null,
    phoiOperation: (raw.phoiOperation as User['phoiOperation']) ?? null,
    warehouseScope: (raw.warehouseScope as User['warehouseScope']) ?? null,
    isPurchaser: !!raw.isPurchaser,
    isProductPlanner: !!raw.isProductPlanner,
    isSale: !!raw.isSale,
  };
}
