/**
 * Mapping thuần (không gọi mạng) giữa mô hình phẳng FE (SystemUser) và BE (RBAC N-N).
 * Tách khỏi `users-api.ts` để "gọi API" và "business mapping" không nằm chung 1 file.
 * Hợp đồng BE: xem docs (FE⇄BE map tạo account) — roleIds UUID, tách firstName/lastName,
 * tạo = POST /users rồi PATCH /users/:id/mfg-attributes, password min 8, response roles[]=tên.
 */
import type { SystemUser } from '../types/admin';
import type { BeUserProfile } from '../types/auth';
import { isFamilyScope } from '../utils/warehouseFamily';

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

// mfg-attributes chỉ áp dụng cho role WAREHOUSE_STAFF (ADMIN/BOSS không có khối "Loại nhân viên").
// 2026-09-03: TRƯỚC đây dựa vào "có ít nhất 1 thuộc tính truthy" - nhưng gỡ kho phụ trách về rỗng
// (unassign, vd. để hoán đổi 2 thủ kho giữa 2 kho) làm MỌI thuộc tính rỗng/false cùng lúc, khiến
// điều kiện cũ luôn false → PATCH mfg-attributes bị bỏ qua hoàn toàn → BE không bao giờ nhận được
// lệnh xoá, kho phụ trách cũ nằm lì trong DB dù UI hiện đã "trống". Dựa theo role thay vì theo giá
// trị: mọi user WAREHOUSE_STAFF luôn gửi PATCH (full-replace, kể cả gửi null để xoá).
export function hasMfgAttrs(v: Record<string, unknown>): boolean {
  return v.role === 'WAREHOUSE_STAFF';
}

// Công đoạn chuyền (Phôi/Hàn/Sơn/KCS) chỉ tồn tại trong gia đình kho phoi-son-han — trước
// 2026-09-03 ép cứng về đúng 1 literal 'phoi-son-han' bất kể form gửi gì, khiến không công nhân
// nào gán được vào kho phoi-son-han PHỤ dù Admin đã tạo thêm. Giờ tin giá trị form gửi MIỄN LÀ
// thuộc đúng gia đình phoi-son-han (isFamilyScope), chỉ fallback về kho gốc khi form không gửi
// hoặc gửi sai gia đình (dữ liệu cũ/hỏng) - mirror đúng users.service.ts (BE).
const MFG_FLOOR_WAREHOUSE_SCOPE = 'phoi-son-han';
const MFG_FLOOR_ROLES = new Set(['PHOI', 'HAN', 'SON', 'KCS']);

export function mfgAttrsPayload(v: Record<string, unknown>) {
  const mfgRole = (v.mfgRole as string) || null;
  const rawScope = (v.warehouseScope as string) || null;
  return {
    mfgRole,
    warehouseScope: mfgRole && MFG_FLOOR_ROLES.has(mfgRole)
      ? (isFamilyScope(rawScope, 'phoi-son-han') ? rawScope : MFG_FLOOR_WAREHOUSE_SCOPE)
      : rawScope,
    isPurchaser: !!v.isPurchaser,
    isProductPlanner: !!v.isProductPlanner,
    isSale: !!v.isSale,
  };
}
