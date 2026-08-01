/**
 * Adapter CUSTOMERS: FE ⇄ BE thật (module `customers`).
 * BE hợp nhất "khách hàng nội địa" và "khách hàng xuất khẩu" thành 1 bảng duy nhất (không có
 * field phân biệt loại) — 2 màn Admin riêng biệt (Khách hàng bán hàng / Khách hàng xuất khẩu)
 * vì vậy cùng đọc/ghi chung 1 danh sách BE, xem ghi chú ở services/api.ts.
 * Id bigint-as-string; khai `number` ở type để khớp interface `{ id: number }` cũ (xem ghi chú
 * ở materials-api.ts).
 */
import { http } from './core/http';

export interface BeCustomer {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  country: string | null;
  market: string | null;
  contactName: string | null;
  note: string | null;
  createdAt: string;
}

export async function getCustomers(): Promise<BeCustomer[]> {
  const res = await http.get<BeCustomer[] | { data: BeCustomer[] }>('/customers?limit=100');
  return Array.isArray(res) ? res : res.data;
}

export async function createCustomer(data: Record<string, unknown>): Promise<BeCustomer> {
  return http.post<BeCustomer>('/customers', {
    name: data.name,
    phone: data.phone,
    email: data.email || undefined,
    address: data.address,
    country: data.country,
    market: data.market,
    contactName: data.contactName,
    note: data.note,
  });
}

export async function updateCustomer(id: number | string, data: Record<string, unknown>): Promise<BeCustomer> {
  return http.patch<BeCustomer>(`/customers/${id}`, {
    name: data.name,
    phone: data.phone,
    email: data.email || undefined,
    address: data.address,
    country: data.country,
    market: data.market,
    contactName: data.contactName,
    note: data.note,
  });
}

export async function deleteCustomer(id: number | string): Promise<{ id: number | string }> {
  await http.del(`/customers/${id}`);
  return { id };
}
