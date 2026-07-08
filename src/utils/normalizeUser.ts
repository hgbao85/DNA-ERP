import type { User } from '../context/AuthContext';

/** Cùng shape với response login — tránh thiếu field khi restore session. */
export function normalizeUser(raw: Record<string, unknown>): User {
  return {
    id: raw.id as number,
    name: raw.name as string,
    email: raw.email as string,
    role: raw.role as User['role'],
    mfgRole: (raw.mfgRole as User['mfgRole']) ?? null,
    phoiOperation: (raw.phoiOperation as User['phoiOperation']) ?? null,
    warehouseScope: (raw.warehouseScope as User['warehouseScope']) ?? null,
    isPurchaser: !!raw.isPurchaser,
    isProductPlanner: !!raw.isProductPlanner,
  };
}
