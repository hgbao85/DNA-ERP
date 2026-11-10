/**
 * Adapter SUPPLIERS: FE ⇄ BE thật (module `suppliers`). Id bigint-as-string; khai `number` ở
 * type để khớp interface `{ id: number }` cũ (xem ghi chú ở materials-api.ts).
 */
import { http } from './core/http';

export interface BeSupplier {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function getSuppliers(): Promise<BeSupplier[]> {
  const res = await http.get<BeSupplier[] | { data: BeSupplier[] }>('/suppliers?limit=100');
  return Array.isArray(res) ? res : res.data;
}

// CreateSupplierDto (BE) nhận name/phone/address/isActive; không gửi isActive thì BE mặc định true
// (test tay 09/11 điểm 21).
export async function createSupplier(data: Record<string, unknown>): Promise<BeSupplier> {
  return http.post<BeSupplier>('/suppliers', {
    name: data.name,
    phone: data.phone,
    address: data.address,
    isActive: data.isActive,
  });
}

export async function updateSupplier(id: number | string, data: Record<string, unknown>): Promise<BeSupplier> {
  return http.patch<BeSupplier>(`/suppliers/${id}`, {
    name: data.name,
    phone: data.phone,
    address: data.address,
    isActive: data.isActive,
  });
}

export async function deleteSupplier(id: number | string): Promise<{ id: number | string }> {
  await http.del(`/suppliers/${id}`);
  return { id };
}
