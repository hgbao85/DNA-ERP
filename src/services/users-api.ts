/**
 * Adapter USERS: FE (mô hình phẳng) ⇄ BE (RBAC N-N, 2-call).
 * Toàn bộ khác biệt FE↔BE gói ở đây → UsersPage/AdminEntityPage gần như không phải đổi.
 * Hợp đồng BE: xem docs (FE⇄BE map tạo account) — roleIds UUID, tách firstName/lastName,
 * tạo = POST /users rồi PATCH /users/:id/mfg-attributes, password min 8, response roles[]=tên.
 *
 * ⚠️ Yêu cầu để chạy thật:
 *   1) Đặt NEXT_PUBLIC_API_BASE_URL trỏ tới BE.
 *   2) localStorage.access_token phải là JWT THẬT của BE (đăng nhập hiện vẫn mock →
 *      cần wire login sang BE, hoặc dán token thủ công, nếu không /users trả 401).
 */
import { http } from './http';
import type { SystemUser } from '../types/admin';

// ─── Shape BE ────────────────────────────────────────────────────────────────
interface BeRole { id: string; name: string; description?: string }
interface BeUser {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  roles: string[];          // TÊN role
  mfgRole: string | null;
  phoiOperation: string | null;
  warehouseScope: string | null;
  isPurchaser: boolean;
  isProductPlanner: boolean;
  isSale: boolean;
}

// ─── Cache map tên role → UUID (gọi GET /roles 1 lần) ────────────────────────
let roleMapCache: Record<string, string> | null = null;
async function getRoleMap(): Promise<Record<string, string>> {
  if (roleMapCache) return roleMapCache;
  // GET /roles có phân trang: envelope.data = { data: BeRole[], meta }. limit đủ lớn để lấy hết 15 role 1 lần.
  const page = await http.get<{ data: BeRole[] }>('/roles?limit=100');
  roleMapCache = Object.fromEntries(page.data.map((r) => [r.name, r.id]));
  return roleMapCache;
}

// ─── §5: quy đổi lựa chọn admin (form phẳng) → roleIds[] ─────────────────────
function deriveRoleIds(v: Record<string, unknown>, roleId: Record<string, string>): string[] {
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
function mapBeToFe(u: BeUser): SystemUser {
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
function splitName(name: string): { firstName: string; lastName: string } {
  const s = String(name ?? '').trim();
  const i = s.indexOf(' ');
  if (i < 0) return { firstName: s, lastName: s }; // 1 từ: BE thường yêu cầu lastName → fallback
  return { firstName: s.slice(0, i), lastName: s.slice(i + 1) };
}

// mfg-attributes chỉ gửi khi có ít nhất 1 thuộc tính sản xuất/kho
function hasMfgAttrs(v: Record<string, unknown>): boolean {
  return !!(v.mfgRole || v.warehouseScope || v.isPurchaser || v.isProductPlanner || v.isSale);
}
function mfgAttrsPayload(v: Record<string, unknown>) {
  return {
    mfgRole: (v.mfgRole as string) || null,
    warehouseScope: (v.warehouseScope as string) || null,
    isPurchaser: !!v.isPurchaser,
    isProductPlanner: !!v.isProductPlanner,
    isSale: !!v.isSale,
  };
}

// ─── API công khai (ghi đè hàm mock cùng tên trong facade services/api) ───────

export async function getUsers(): Promise<SystemUser[]> {
  // GET /users có phân trang giống /roles: envelope.data = { data: BeUser[], meta }.
  // Nhận cả 2 shape (mảng thẳng hoặc {data}) cho chắc.
  const res = await http.get<BeUser[] | { data: BeUser[] }>('/users?limit=100');
  const list = Array.isArray(res) ? res : res.data;
  return list.map(mapBeToFe);
}

export async function createUser(data: Record<string, unknown>): Promise<SystemUser> {
  const roleId = await getRoleMap();
  const { firstName, lastName } = splitName(String(data.name ?? ''));
  const created = await http.post<BeUser>('/users', {
    username: data.username,
    email: data.email,
    password: data.password,
    firstName,
    lastName,
    roleIds: deriveRoleIds(data, roleId),
  });
  if (hasMfgAttrs(data)) {
    const updated = await http.patch<BeUser>(`/users/${created.id}/mfg-attributes`, mfgAttrsPayload(data));
    return mapBeToFe(updated ?? created);
  }
  return mapBeToFe(created);
}

export async function updateUser(id: number | string, data: Record<string, unknown>): Promise<SystemUser> {
  const roleId = await getRoleMap();
  const { firstName, lastName } = splitName(String(data.name ?? ''));
  // PATCH thông tin + roleIds (thay thế toàn bộ). Không gửi password ở đây (giữ nguyên).
  let user = await http.patch<BeUser>(`/users/${id}`, {
    firstName,
    lastName,
    isActive: data.isActive,
    roleIds: deriveRoleIds(data, roleId),
  });
  if (hasMfgAttrs(data)) {
    user = await http.patch<BeUser>(`/users/${id}/mfg-attributes`, mfgAttrsPayload(data));
  }
  return mapBeToFe(user);
}

export async function deleteUser(id: number | string): Promise<{ id: number | string }> {
  await http.del(`/users/${id}`); // 204, soft delete
  return { id };
}
