/**
 * Adapter MATERIAL GROUPS: FE ⇄ BE thật (module `material-groups`). Id bigint-as-string; khai
 * `number` ở type để khớp interface `{ id: number }` cũ (xem ghi chú ở materials-api.ts).
 */
import { http } from './core/http';

export interface BeMaterialGroup {
  id: number;
  name: string;
  /** Khoá kỹ thuật cố định cho 6 nhóm hệ thống (xem constants/materialGroupSystemKeys.ts) -
   *  null nếu là nhóm admin tự tạo. Không phải field admin sửa được qua form. */
  systemKey: string | null;
}

export async function getMaterialGroups(): Promise<BeMaterialGroup[]> {
  const res = await http.get<BeMaterialGroup[] | { data: BeMaterialGroup[] }>('/material-groups?limit=100');
  return Array.isArray(res) ? res : res.data;
}

export async function createMaterialGroup(name: string): Promise<BeMaterialGroup> {
  return http.post<BeMaterialGroup>('/material-groups', { name });
}

export async function updateMaterialGroup(id: number | string, data: Record<string, unknown>): Promise<BeMaterialGroup> {
  return http.patch<BeMaterialGroup>(`/material-groups/${id}`, { name: data.name });
}

export async function deleteMaterialGroup(id: number | string): Promise<{ id: number | string }> {
  await http.del(`/material-groups/${id}`);
  return { id };
}
