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
import { http, withIdempotencyKey } from './core/http';
import type { TransferStatus, WarehouseTransfer, WarehouseTransferItem } from '../types/warehouse-transfer';

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
  createdById: string | null;
  confirmedById: string | null;
  rejectedById: string | null;
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
    createdById: t.createdById,
    confirmedById: t.confirmedById,
    rejectedById: t.rejectedById,
  };
}

export async function getWarehouseTransfer(id: string | number): Promise<WarehouseTransfer> {
  const detail = await http.get<BeWarehouseTransferDetail>(`/warehouse-transfers/${id}`);
  return toTransfer(detail, detail.items);
}

// `status` optional (Medium fix): không truyền = hành vi cũ (top-100 gần nhất, dùng cho Admin
// history - chấp nhận bỏ sót phiếu cũ, không phải hàng đợi xử lý). Truyền `status` = query thẳng
// BE theo đúng trạng thái đó (limit=100 là max cho phép của PaginationQueryDto - @Max(100), không
// tăng được nữa) - dùng cho hộp thư PENDING (InternalTransferSections.tsx): vẫn còn top-100
// PENDING gần nhất thay vì top-100 lẫn lộn mọi status, nên 1 phiếu PENDING không còn bị các phiếu
// CONFIRMED/REJECTED cũ hơn (chiếm phần lớn dữ liệu thực tế) đẩy ra khỏi trang đầu.
export async function getWarehouseTransfers(status?: TransferStatus): Promise<WarehouseTransfer[]> {
  const res = await http.get<BeWarehouseTransfer[] | { data: BeWarehouseTransfer[] }>(
    '/warehouse-transfers',
    { params: status ? { status, limit: 100 } : { limit: 100 } },
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
  const created = await http.post<BeWarehouseTransfer>(
    '/warehouse-transfers',
    {
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
    },
    // Vấn đề #11 audit 26/08 (phần còn thiếu) - BE giờ bắt buộc header này.
    withIdempotencyKey(),
  );
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

// ── Chuyển kho piece-only (mảnh / vật tư thành phẩm — needsHan=true/false, xem
// docs/review-2026-08-17-sanxuat-stage-v16-va-chuyen-kho-manh.md mục 7 ở BE). Tách hẳn khỏi
// createWarehouseTransfer() (vật tư tiêu hao, khác bảng dòng ở BE) — quyết định "không gộp" mục 7.5.

export interface BePieceTransferPlanItem {
  productionOrderId: string;
  /** Mã nội bộ (ProductionOrder.poNumber) - chỉ hệ thống dùng, KHÔNG hiển thị. Dùng `salesOrderCode`. */
  poNumber: string;
  /** Mã đơn hàng Sales gốc - đây mới là mã "PO" hiển thị cho người dùng. */
  salesOrderCode: string | null;
  productName: string;
  pieceId: string;
  pieceCode: string;
  pieceName: string;
  label: 'MANH' | 'VAT_TU_THANH_PHAM';
  readyQty: number;
  transferredQty: number;
  suggestedQty: number;
}

/** Kế hoạch chuyển kho cho 1 hoặc nhiều PO cùng lúc — đơn vị là PO, không phải PI (1 PI có thể
 *  gồm nhiều PO tiến độ khác nhau, xem mục 6 tài liệu trên). */
export async function getPieceTransferPlan(
  productionOrderIds: Array<string | number>,
): Promise<BePieceTransferPlanItem[]> {
  if (productionOrderIds.length === 0) return [];
  const ids = productionOrderIds.map((id) => String(id)).join(',');
  return http.get<BePieceTransferPlanItem[]>(
    `/warehouse-transfers/piece-transfer-plan?productionOrderIds=${encodeURIComponent(ids)}`,
  );
}

export async function createPieceWarehouseTransfer(data: {
  fromWarehouseId: string | number;
  toWarehouseId: string | number;
  note?: string;
  pieceItems: Array<{
    productionOrderId: string | number;
    pieceId: string | number;
    quantity: number;
    note?: string;
  }>;
}): Promise<WarehouseTransfer> {
  const created = await http.post<BeWarehouseTransfer>(
    '/warehouse-transfers/piece-transfer',
    {
      fromWarehouseId: String(data.fromWarehouseId),
      toWarehouseId: String(data.toWarehouseId),
      note: data.note,
      pieceItems: data.pieceItems.map((it) => ({
        productionOrderId: String(it.productionOrderId),
        pieceId: String(it.pieceId),
        quantity: it.quantity,
        note: it.note,
      })),
    },
    // Vấn đề #11 audit 26/08 (phần còn thiếu) - BE giờ bắt buộc header này.
    withIdempotencyKey(),
  );
  // Cùng lý do createWarehouseTransfer(): số lượng có thể đã bị clamp theo kế hoạch tại thời điểm
  // tạo (xem WarehouseTransfersService.createPieceTransfer ở BE) — fetch lại chi tiết thật.
  return getWarehouseTransfer(created.id);
}
