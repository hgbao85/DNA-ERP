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
}

export async function getWarehouses(): Promise<BeWarehouse[]> {
  const res = await http.get<BeWarehouse[] | { data: BeWarehouse[] }>('/warehouses?limit=100');
  return Array.isArray(res) ? res : res.data;
}
