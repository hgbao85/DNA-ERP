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
  taxCode: string | null;
  contactName: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** BE giới hạn `limit` tối đa 100 - gọi lần lượt từng trang rồi gộp (13/11/2026: người mua tự thêm NCC nên danh sách sẽ
 *  dài dần; trước đây chỉ lấy 100 NCC đầu, NCC thứ 101 trở đi không chọn được khi tạo đơn đặt hàng). */
const SUPPLIERS_PAGE_SIZE = 100;
const SUPPLIERS_MAX_PAGES = 50; // chặn vòng lặp vô hạn nếu BE trả meta sai

export async function getSuppliers(): Promise<BeSupplier[]> {
  const all: BeSupplier[] = [];
  for (let page = 1; page <= SUPPLIERS_MAX_PAGES; page += 1) {
    const res = await http.get<BeSupplier[] | { data: BeSupplier[]; meta?: { totalPages?: number } }>(
      `/suppliers?limit=${SUPPLIERS_PAGE_SIZE}&page=${page}`,
    );
    if (Array.isArray(res)) return res;
    all.push(...res.data);
    const totalPages = res.meta?.totalPages ?? 1;
    if (page >= totalPages || res.data.length === 0) break;
  }
  return all;
}

// CreateSupplierDto (BE) nhận name/phone/address/taxCode/contactName/isActive; không gửi isActive thì BE mặc định true
// (test tay 09/11 điểm 21).
export async function createSupplier(data: Record<string, unknown>): Promise<BeSupplier> {
  return http.post<BeSupplier>('/suppliers', {
    name: data.name,
    phone: data.phone,
    address: data.address,
    taxCode: data.taxCode,
    contactName: data.contactName,
    isActive: data.isActive,
  });
}

export async function updateSupplier(id: number | string, data: Record<string, unknown>): Promise<BeSupplier> {
  return http.patch<BeSupplier>(`/suppliers/${id}`, {
    name: data.name,
    phone: data.phone,
    address: data.address,
    taxCode: data.taxCode,
    contactName: data.contactName,
    isActive: data.isActive,
  });
}

export async function deleteSupplier(id: number | string): Promise<{ id: number | string }> {
  await http.del(`/suppliers/${id}`);
  return { id };
}
