/**
 * Adapter USERS: các lời gọi API BE thật cho module người dùng.
 * Business mapping (BE↔FE) nằm ở `users-mapper.ts` — file này chỉ còn phần gọi `http`.
 *
 * ⚠️ Yêu cầu để chạy thật:
 *   1) Đặt BACKEND_ORIGIN trỏ tới BE (Next.js proxy qua rewrites(), xem next.config.mjs).
 *   2) Đăng nhập qua BE thật (services/auth-api.ts) để có phiên hợp lệ, nếu không /users trả 401.
 */
import { http } from './core/http';
import type { SystemUser } from '../types/admin';
import type { BeRole, BeUserProfile } from '../types/auth';
import { deriveRoleIds, hasMfgAttrs, mapBeToFe, mfgAttrsPayload, splitName } from './users-mapper';

// ─── Map tên role → UUID ──────────────────────────────────────────────────
// Gọi lại GET /roles mỗi lần (không cache): tạo/sửa user là thao tác tần suất thấp,
// nên tránh cache để không phải lo bug đọc phải dữ liệu cũ khi role vừa bị đổi/xoá.
async function getRoleMap(): Promise<Record<string, string>> {
  // GET /roles có phân trang: envelope.data = { data: BeRole[], meta }. limit đủ lớn để lấy hết 15 role 1 lần.
  const page = await http.get<{ data: BeRole[] }>('/roles?limit=100');
  return Object.fromEntries(page.data.map((r) => [r.name, r.id]));
}

// ─── API công khai (ghi đè hàm mock cùng tên trong facade services/api) ───────

export async function getUsers(): Promise<SystemUser[]> {
  // GET /users có phân trang giống /roles: envelope.data = { data: BeUser[], meta }.
  // Nhận cả 2 shape (mảng thẳng hoặc {data}) cho chắc.
  const res = await http.get<BeUserProfile[] | { data: BeUserProfile[] }>('/users?limit=100');
  const list = Array.isArray(res) ? res : res.data;
  return list.map(mapBeToFe);
}

export async function createUser(data: Record<string, unknown>): Promise<SystemUser> {
  const roleId = await getRoleMap();
  const { firstName, lastName } = splitName(String(data.name ?? ''));
  const created = await http.post<BeUserProfile>('/users', {
    username: data.username,
    email: data.email,
    password: data.password,
    firstName,
    lastName,
    roleIds: deriveRoleIds(data, roleId),
  });
  if (hasMfgAttrs(data)) {
    const updated = await http.patch<BeUserProfile>(`/users/${created.id}/mfg-attributes`, mfgAttrsPayload(data));
    return mapBeToFe(updated ?? created);
  }
  return mapBeToFe(created);
}

export async function updateUser(id: number | string, data: Record<string, unknown>): Promise<SystemUser> {
  const roleId = await getRoleMap();
  const { firstName, lastName } = splitName(String(data.name ?? ''));
  // PATCH thông tin + roleIds (thay thế toàn bộ). Không gửi password ở đây (giữ nguyên).
  let user = await http.patch<BeUserProfile>(`/users/${id}`, {
    firstName,
    lastName,
    isActive: data.isActive,
    roleIds: deriveRoleIds(data, roleId),
  });
  if (hasMfgAttrs(data)) {
    user = await http.patch<BeUserProfile>(`/users/${id}/mfg-attributes`, mfgAttrsPayload(data));
  }
  return mapBeToFe(user);
}

export async function deleteUser(id: number | string): Promise<{ id: number | string }> {
  await http.del(`/users/${id}`); // 204, soft delete
  return { id };
}

// Admin cấp lại mật khẩu cho user khác — tách riêng khỏi updateUser để không còn gộp chung
// với form sửa thông tin (UX cũ: 1 ô mật khẩu nằm lẫn trong form, dễ đổi nhầm/quên đổi).
// Endpoint riêng /reset-password (chỉ ADMIN, KHÔNG cần mật khẩu cũ), trả 204. Việc user tự đổi
// mật khẩu (cần mật khẩu cũ) là POST /auth/change-password — chưa nối, làm sau khi cần.
export async function resetUserPassword(id: number | string, newPassword: string): Promise<void> {
  await http.patch<void>(`/users/${id}/reset-password`, { newPassword });
}

// Khóa/mở khóa tài khoản: PATCH có chủ đích CHỈ gửi `isActive` — KHÔNG dùng lại updateUser (vốn
// cần name/roleIds; gọi thiếu sẽ xóa trắng tên + vai trò). BE nhận isActive, tự chặn tự-khóa và
// tự ghi audit (old→new). Trả về user đã cập nhật để UI đồng bộ.
export async function setUserActive(id: number | string, isActive: boolean): Promise<SystemUser> {
  return mapBeToFe(await http.patch<BeUserProfile>(`/users/${id}`, { isActive }));
}
