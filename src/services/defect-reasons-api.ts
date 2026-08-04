/**
 * Adapter DEFECT REASONS: FE ⇄ BE thật (module `defect-reasons`). Id bigint-as-string; khai
 * `number` ở type để khớp interface `{ id: number }` cũ (xem ghi chú ở materials-api.ts).
 * BE không hỗ trợ filter theo stageType trên query — lọc phía client như bản mock cũ.
 */
import { http } from './core/http';

export interface BeDefectReason {
  id: number;
  label: string;
  stageType: string | null;
}

export async function getDefectReasons(stageType?: string): Promise<BeDefectReason[]> {
  const res = await http.get<BeDefectReason[] | { data: BeDefectReason[] }>('/defect-reasons?limit=100');
  const list = Array.isArray(res) ? res : res.data;
  return stageType ? list.filter((d) => d.stageType === stageType) : list;
}

export async function createDefectReason(data: Record<string, unknown>): Promise<BeDefectReason> {
  return http.post<BeDefectReason>('/defect-reasons', { label: data.label, stageType: data.stageType || undefined });
}

export async function updateDefectReason(id: number | string, data: Record<string, unknown>): Promise<BeDefectReason> {
  return http.patch<BeDefectReason>(`/defect-reasons/${id}`, { label: data.label, stageType: data.stageType || undefined });
}

export async function deleteDefectReason(id: number | string): Promise<{ id: number | string }> {
  await http.del(`/defect-reasons/${id}`);
  return { id };
}
