/**
 * Adapter WEAVING POINTS: FE ⇄ BE thật (module `weaving-points` — chỉ CRUD danh mục cơ bản).
 * Id bigint-as-string. Nghiệp vụ phân bổ/nhận đan, chuyển kiểm... vẫn ở mock (mfg.service.ts,
 * WeavingService) vì BE chưa có API tương ứng — xem services/api.ts.
 * `id` khai `number` ở type để khớp interface `{ id: number }` cũ (xem ghi chú ở materials-api.ts).
 */
import { http } from './core/http';

export interface BeWeavingPoint {
  id: number;
  code: string;
  fullName: string | null;
  aliasNote: string | null;
  phone: string | null;
  address: string | null;
  dayDaiPercent: number | null;
  ketThucPercent: number | null;
  hangQuanPercent: number | null;
  note: string | null;
  isActive: boolean;
}

export async function getWeavingPoints(): Promise<BeWeavingPoint[]> {
  const res = await http.get<BeWeavingPoint[] | { data: BeWeavingPoint[] }>('/weaving-points?limit=100');
  return Array.isArray(res) ? res : res.data;
}

export async function createWeavingPoint(data: Record<string, unknown>): Promise<BeWeavingPoint> {
  return http.post<BeWeavingPoint>('/weaving-points', {
    code: data.code,
    fullName: data.fullName,
    aliasNote: data.aliasNote,
    phone: data.phone,
    address: data.address,
    dayDaiPercent: data.dayDaiPercent,
    ketThucPercent: data.ketThucPercent,
    hangQuanPercent: data.hangQuanPercent,
    note: data.note,
  });
}

export async function updateWeavingPoint(id: number | string, data: Record<string, unknown>): Promise<BeWeavingPoint> {
  return http.patch<BeWeavingPoint>(`/weaving-points/${id}`, {
    code: data.code,
    fullName: data.fullName,
    aliasNote: data.aliasNote,
    phone: data.phone,
    address: data.address,
    dayDaiPercent: data.dayDaiPercent,
    ketThucPercent: data.ketThucPercent,
    hangQuanPercent: data.hangQuanPercent,
    note: data.note,
    isActive: data.isActive,
  });
}

export async function deleteWeavingPoint(id: number | string): Promise<{ id: number | string }> {
  await http.del(`/weaving-points/${id}`);
  return { id };
}
