/**
 * Adapter MATERIAL GROUPS: FE ⇄ BE thật (module `material-groups`). Id bigint-as-string; khai
 * `number` ở type để khớp interface `{ id: number }` cũ (xem ghi chú ở materials-api.ts).
 */
import { http } from './core/http';
import { getAllPages } from './core/getAllPages';

export interface BeMaterialGroup {
  id: number;
  name: string;
  /** Khoá kỹ thuật cố định cho 6 nhóm hệ thống (xem constants/materialGroupSystemKeys.ts) -
   *  null nếu là nhóm admin tự tạo. Không phải field admin sửa được qua form. */
  systemKey: string | null;
  /** Tiền tố mã vật tư tự sinh cho nhóm này (vd "SAT" -> "SAT-001"...) - bắt buộc + duy nhất,
   *  xem MaterialsService.resolveCodePrefix bên BE. */
  codePrefix: string;
}

export async function getMaterialGroups(): Promise<BeMaterialGroup[]> {
  return getAllPages<BeMaterialGroup>('/material-groups');
}

export async function createMaterialGroup(name: string, codePrefix: string): Promise<BeMaterialGroup> {
  return http.post<BeMaterialGroup>('/material-groups', { name, codePrefix });
}

export async function updateMaterialGroup(id: number | string, data: Record<string, unknown>): Promise<BeMaterialGroup> {
  return http.patch<BeMaterialGroup>(`/material-groups/${id}`, { name: data.name, codePrefix: data.codePrefix });
}

export async function deleteMaterialGroup(id: number | string): Promise<{ id: number | string }> {
  await http.del(`/material-groups/${id}`);
  return { id };
}
