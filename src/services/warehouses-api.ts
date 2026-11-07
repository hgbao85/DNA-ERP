/**
 * Adapter WAREHOUSES: FE ⇄ BE thật (module `warehouses` — Phase 2, chưa từng được FE gọi tới
 * cho tới khi warehouse-transfers cần resolve code -> id thật, xem warehouse-transfers-api.ts).
 * BE dùng id dạng bigint-as-string — giữ nguyên string, không ép Number().
 */
import { http } from './core/http';

export interface BeWarehouse {
  id: string;
  code: string;
  name: string;
  isVirtual: boolean;
  note: string | null;
  isActive: boolean;
  /** Đợt 7 - loại kho (PHOI/HAN/SON/PHU_KIEN/THANH_PHAM), null = kho ảo / chưa phân loại. */
  kind?: string | null;
  /** Đợt 7 - xưởng sở hữu (chỉ kho Phôi/Hàn), null = dùng chung. */
  workshopId?: string | null;
}

export async function getWarehouses(): Promise<BeWarehouse[]> {
  const res = await http.get<BeWarehouse[] | { data: BeWarehouse[] }>('/warehouses?limit=100');
  return Array.isArray(res) ? res : res.data;
}

export async function createWarehouse(data: { code: string; name: string; isVirtual?: boolean; note?: string }): Promise<BeWarehouse> {
  return http.post<BeWarehouse>('/warehouses', data);
}

export async function deleteWarehouse(id: string): Promise<{ id: string }> {
  await http.del(`/warehouses/${id}`);
  return { id };
}
