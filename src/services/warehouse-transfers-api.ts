/**
 * Adapter WAREHOUSE TRANSFERS: FE ⇄ BE thật (module `warehouse-transfers`, Phase 3 — Kho vận lõi).
 * BE dùng id dạng bigint-as-string — giữ nguyên string, không ép Number().
 *
 * Lưu ý shape khác mock: GET /warehouse-transfers (list) KHÔNG kèm `items[]` (chỉ
 * GET /warehouse-transfers/:id mới có) — trong khi mock cũ luôn trả object đầy đủ kèm items cho
 * mọi bản ghi. getWarehouseTransfers() bên dưới bù lại bằng cách fetch chi tiết từng phiếu sau khi
 * lấy danh sách, để giữ đúng hợp đồng cũ (mọi WarehouseTransfer trả về đều có items) — chấp nhận
 * N+1 request vì số phiếu đang PENDING/gần đây tại 1 thời điểm vốn nhỏ (mỗi phiếu là 1 lần chuyển
 * hàng vật lý thật). Cân nhắc thêm query `?include=items` ở BE nếu sau này số lượng phiếu lớn.
 *
 * BE không có khái niệm `piCode` (chỉ có `planFormId` thật hoặc `note` tự do) — bỏ hẳn field này,
 * xem WarehouseXuatPage.tsx cho cách nhồi thông tin PI vào `note` thay vì giả một field cấu trúc.
 */
import { http } from './core/http';
import type { WarehouseTransfer, WarehouseTransferItem } from '../types/warehouse-transfer';

interface BeWarehouseTransferItem {
  id: string;
  materialId: string | null;
  materialName: string;
  unit: string;
  quantity: number;
  note: string | null;
}

interface BeWarehouseTransfer {
  id: string;
  code: string;
  fromWarehouseId: string;
  fromWarehouseCode: string;
  fromWarehouseName: string;
  toWarehouseId: string;
  toWarehouseCode: string;
  toWarehouseName: string;
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED';
  planFormId: string | null;
  rejectionReason: string | null;
  note: string | null;
  createdAt: string;
  confirmedAt: string | null;
  rejectedAt: string | null;
}

interface BeWarehouseTransferDetail extends BeWarehouseTransfer {
  items: BeWarehouseTransferItem[];
}

function toItem(it: BeWarehouseTransferItem): WarehouseTransferItem {
  return {
    id: it.id,
    materialId: it.materialId,
    materialName: it.materialName,
    unit: it.unit,
    quantity: it.quantity,
    note: it.note,
  };
}

function toTransfer(t: BeWarehouseTransfer, items: BeWarehouseTransferItem[]): WarehouseTransfer {
  return {
    id: t.id,
    code: t.code,
    fromWarehouseId: t.fromWarehouseId,
    fromWarehouseName: t.fromWarehouseName,
    fromWarehouseCode: t.fromWarehouseCode,
    toWarehouseId: t.toWarehouseId,
    toWarehouseName: t.toWarehouseName,
    toWarehouseCode: t.toWarehouseCode,
    status: t.status,
    items: items.map(toItem),
    note: t.note,
    rejectionReason: t.rejectionReason,
    createdAt: t.createdAt,
    confirmedAt: t.confirmedAt,
    rejectedAt: t.rejectedAt,
  };
}

export async function getWarehouseTransfer(id: string | number): Promise<WarehouseTransfer> {
  const detail = await http.get<BeWarehouseTransferDetail>(`/warehouse-transfers/${id}`);
  return toTransfer(detail, detail.items);
}

export async function getWarehouseTransfers(): Promise<WarehouseTransfer[]> {
  const res = await http.get<BeWarehouseTransfer[] | { data: BeWarehouseTransfer[] }>(
    '/warehouse-transfers?limit=100',
  );
  const list = Array.isArray(res) ? res : res.data;
  return Promise.all(list.map((t) => getWarehouseTransfer(t.id)));
}

export async function createWarehouseTransfer(data: {
  fromWarehouseId: string | number;
  toWarehouseId: string | number;
  note?: string;
  items: Array<{ materialId?: string | number; materialName: string; unit: string; quantity: number; note?: string }>;
}): Promise<WarehouseTransfer> {
  const created = await http.post<BeWarehouseTransfer>('/warehouse-transfers', {
    fromWarehouseId: String(data.fromWarehouseId),
    toWarehouseId: String(data.toWarehouseId),
    note: data.note,
    items: data.items.map((it) => ({
      materialId: it.materialId !== undefined ? String(it.materialId) : undefined,
      materialName: it.materialName,
      unit: it.unit,
      quantity: it.quantity,
      note: it.note,
    })),
  });
  // Phiếu vừa tạo có thể đã bị clamp số lượng theo tồn khả dụng (xem BE WarehouseTransfersService)
  // — fetch lại chi tiết để trả đúng số lượng/items thật thay vì echo nguyên request.
  return getWarehouseTransfer(created.id);
}

/** Trả về response phẳng của BE (không kèm items) — callers hiện tại chỉ refetch danh sách sau
 * khi gọi, không đọc items từ đây, nên không cần fetch chi tiết thêm. */
export async function confirmWarehouseTransfer(id: string | number): Promise<WarehouseTransfer> {
  const t = await http.post<BeWarehouseTransfer>(`/warehouse-transfers/${id}/confirm`);
  return toTransfer(t, []);
}

export async function rejectWarehouseTransfer(id: string | number, reason: string): Promise<WarehouseTransfer> {
  const t = await http.post<BeWarehouseTransfer>(`/warehouse-transfers/${id}/reject`, {
    rejectionReason: reason,
  });
  return toTransfer(t, []);
}
