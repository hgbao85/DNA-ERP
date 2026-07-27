import type { User } from '../context/AuthContext';

/**
 * Shape linh hoạt mà normalizeUser thực nhận được — CẢ 2 trường hợp:
 *  - BE thật (GET /auth/me, kiểu `BeUserProfile`): { roles: string[], firstName, lastName, ... }
 *  - Đã phẳng (restore từ localStorage, kiểu `User`): { role, name, ... }
 * Khai báo riêng thay vì union `BeUserProfile | User` vì 2 type lệch kiểu `id` (string vs number).
 */
interface NormalizableUser {
  id?: string | number;
  name?: string;
  email?: string;
  role?: User['role'];
  roles?: string[];
  firstName?: string;
  lastName?: string;
  mfgRole?: string | null;
  phoiOperation?: string | null;
  warehouseScope?: string | null;
  isPurchaser?: boolean;
  isProductPlanner?: boolean;
  isSale?: boolean;
}

/**
 * Chuẩn hoá user về model phẳng của FE. Suy `role` phẳng từ roles[] (RBAC N-N) và gộp
 * name từ firstName/lastName khi cần.
 */
export function normalizeUser(raw: NormalizableUser): User {
  const roles = Array.isArray(raw.roles) ? raw.roles : [];
  const role: User['role'] =
    raw.role ?? (roles.includes('ADMIN') ? 'ADMIN' : roles.includes('BOSS') ? 'BOSS' : 'WAREHOUSE_STAFF');

  const name = raw.name ?? `${raw.firstName ?? ''} ${raw.lastName ?? ''}`.trim();

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
