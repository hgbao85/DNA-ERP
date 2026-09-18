/**
 * Adapter OFFICE SUPPLIES: FE ⇄ BE thật (module `office-supplies` — vật tư văn phòng/sinh hoạt,
 * bút giấy... HOÀN TOÀN tách biệt khỏi materials-api.ts (vật tư sản xuất gắn định mức/BOM)).
 * id dạng bigint-as-string, giống MaterialsApi.
 */
import { http } from './core/http';

export interface BeOfficeSupply {
  id: number;
  warehouseId: number;
  /** Denormalized từ Warehouse.code/name - vật tư văn phòng RIÊNG theo từng kho, không dùng
   *  chung (mỗi kho tự có danh sách/tồn/lịch sử độc lập, kể cả trùng tên). */
  warehouseCode: string;
  warehouseName: string;
  code: string | null;
  name: string;
  unit: string;
  quantity: number;
  note: string | null;
  isActive: boolean;
  /** null = đang hoạt động. Khác null = đã xóa (soft-delete) - CHỈ có mặt khi gọi kèm
   *  `includeDeleted=true` (xem getOfficeSupplies). */
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type OfficeSupplyLedgerReason = 'INITIAL' | 'IMPORT' | 'EXPORT' | 'ADJUST';

export interface BeOfficeSupplyLedgerEntry {
  id: number;
  officeSupplyId: number;
  changeQty: number;
  quantityAfter: number;
  reason: OfficeSupplyLedgerReason;
  note: string | null;
  createdByUserId: string | null;
  createdByUserName: string | null;
  createdAt: string;
}

/**
 * `warehouseCode` CHỈ có tác dụng khi tài khoản gọi API không có warehouseScope (Boss/Admin/tổng
 * kho) - BE tự bỏ qua param này với thủ kho bình thường, LUÔN trả về đúng kho của họ (xem
 * OfficeSuppliesService.findAll). Không truyền + không có scope = BE trả gộp mọi kho.
 * `includeDeleted` - CHỈ dùng ở màn Admin xem lại vật tư đã xóa để tra lịch sử (không giới hạn ở
 * tầng API, chỉ FE tự hiện nút bật cho Admin - xem OfficeSuppliesPage.tsx).
 */
export async function getOfficeSupplies(warehouseCode?: string, includeDeleted?: boolean): Promise<BeOfficeSupply[]> {
  const qs = [
    warehouseCode ? `&warehouseCode=${encodeURIComponent(warehouseCode)}` : '',
    includeDeleted ? '&includeDeleted=true' : '',
  ].join('');
  const res = await http.get<BeOfficeSupply[] | { data: BeOfficeSupply[] }>(`/office-supplies?limit=100${qs}`);
  return Array.isArray(res) ? res : res.data;
}

export async function createOfficeSupply(data: {
  code?: string;
  name: string;
  unit: string;
  note?: string;
  openingQty?: number;
  /** Bắt buộc nếu tài khoản gọi không có warehouseScope (Boss/Admin) - bị bỏ qua với thủ kho
   *  bình thường (BE luôn tạo trong đúng kho họ phụ trách). */
  warehouseCode?: string;
}): Promise<BeOfficeSupply> {
  return http.post<BeOfficeSupply>('/office-supplies', data);
}

export async function updateOfficeSupply(
  id: number | string,
  data: { code?: string; name?: string; unit?: string; note?: string; isActive?: boolean },
): Promise<BeOfficeSupply> {
  return http.patch<BeOfficeSupply>(`/office-supplies/${id}`, data);
}

export async function adjustOfficeSupplyQuantity(
  id: number | string,
  data: { changeQty: number; reason: OfficeSupplyLedgerReason; note?: string },
): Promise<BeOfficeSupply> {
  return http.post<BeOfficeSupply>(`/office-supplies/${id}/adjust`, data);
}

export async function deleteOfficeSupply(id: number | string): Promise<{ id: number | string }> {
  await http.del(`/office-supplies/${id}`);
  return { id };
}

export async function getOfficeSupplyLedger(id: number | string): Promise<BeOfficeSupplyLedgerEntry[]> {
  const res = await http.get<BeOfficeSupplyLedgerEntry[] | { data: BeOfficeSupplyLedgerEntry[] }>(
    `/office-supplies/${id}/ledger?limit=50`,
  );
  return Array.isArray(res) ? res : res.data;
}
