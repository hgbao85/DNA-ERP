/**
 * Mapping thuần (không gọi mạng) giữa mô hình phẳng FE (SystemUser) và BE (RBAC N-N).
 * Tách khỏi `users-api.ts` để "gọi API" và "business mapping" không nằm chung 1 file.
 * Hợp đồng BE: xem docs (FE⇄BE map tạo account) — roleIds UUID, tách firstName/lastName,
 * tạo = POST /users rồi PATCH /users/:id/mfg-attributes, password min 8, response roles[]=tên.
 */
import type { SystemUser } from '../types/admin';
import type { BeUserProfile } from '../types/auth';

// ─── §5: quy đổi lựa chọn admin (form phẳng) → roleIds[] ─────────────────────
export function deriveRoleIds(v: Record<string, unknown>, roleId: Record<string, string>): string[] {
  const pick = (name: string) => (roleId[name] ? [roleId[name]] : []);
  if (v.role === 'ADMIN') return pick('ADMIN');
  if (v.role === 'BOSS') return pick('BOSS');
  // WAREHOUSE_STAFF:
  if (v.mfgRole) return []; // nhánh SẢN XUẤT: BE tự gán role qua mfg-attributes
  // nhánh KHO/VĂN PHÒNG: role nền + theo cờ
  return [
    ...pick('WAREHOUSE_STAFF'),
    ...(v.isPurchaser ? pick('PURCHASER') : []),
    ...(v.isSale ? pick('SALES_STAFF') : []),
    ...(v.isProductPlanner ? pick('PRODUCTION_PLANNER') : []),
  ];
}

// ─── §9: map user BE → SystemUser (shape FE cũ) để list/form render như cũ ───
function toFeRole(roles: string[]): SystemUser['role'] {
  if (roles.includes('ADMIN')) return 'ADMIN';
  if (roles.includes('BOSS')) return 'BOSS';
  return 'WAREHOUSE_STAFF';
}

export function mapBeToFe(u: BeUserProfile): SystemUser {
  return {
    // BE dùng UUID (string); SystemUser.id là number — cast để tương thích key/consumer cũ.
    id: u.id as unknown as number,
    username: u.username,
    name: `${u.firstName} ${u.lastName}`.trim(),
    email: u.email,
    password: '',
    role: toFeRole(u.roles),
    mfgRole: (u.mfgRole as SystemUser['mfgRole']) ?? null,
    warehouseScope: u.warehouseScope ?? null,
    isPurchaser: u.isPurchaser,
    isProductPlanner: u.isProductPlanner,
    isSale: u.isSale,
    isActive: u.isActive,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

// ─── §4: tách "Nguyễn Văn A" → firstName "Nguyễn", lastName "Văn A" ───────────
export function splitName(name: string): { firstName: string; lastName: string } {
  const s = String(name ?? '').trim();
  const i = s.indexOf(' ');
  if (i < 0) return { firstName: s, lastName: s }; // 1 từ: BE thường yêu cầu lastName → fallback
  return { firstName: s.slice(0, i), lastName: s.slice(i + 1) };
}

// mfg-attributes chỉ gửi khi có ít nhất 1 thuộc tính sản xuất/kho
export function hasMfgAttrs(v: Record<string, unknown>): boolean {
  return !!(v.mfgRole || v.warehouseScope || v.isPurchaser || v.isProductPlanner || v.isSale);
}

export function mfgAttrsPayload(v: Record<string, unknown>) {
  return {
    mfgRole: (v.mfgRole as string) || null,
    warehouseScope: (v.warehouseScope as string) || null,
    isPurchaser: !!v.isPurchaser,
    isProductPlanner: !!v.isProductPlanner,
    isSale: !!v.isSale,
  };
}
