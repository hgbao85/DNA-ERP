/**
 * Adapter SẢN LƯỢNG + QC HÀN/SƠN: FE ⇄ BE thật (module `production-batches`/`qc-reviews`).
 * Thay `san-luong.service.ts` (mock, key theo `ProcLine.id` giả tự sinh ở seed — không liên quan
 * gì tới BE thật, xem `components/sanxuat/core.tsx`).
 *
 * Hàn/Sơn báo sản lượng theo MẢNH (Piece) — khớp Phôi và Đan, vốn cũng làm việc theo mảnh (chỉ
 * Phôi làm theo từng thanh sắt cấu thành mảnh). Trước đây gắn Part (chi tiết, trục BOM riêng
 * chưa từng có UI nhập liệu thật) — đã đổi hẳn sang Piece ở BE (xem
 * ProductionBatchesService.getBatchPlan()).
 *
 * Nối theo 2 đợt độc lập vì độ khó khác hẳn nhau (xem callout roadmap M3):
 *  - QC Hàn/Sơn (KcsStagePage, đợt 1): tự đứng độc lập, dựng toàn bộ từ mảng batches (đã có sẵn
 *    poNumber/pieceCode/pieceName inline) — dùng getProductionBatchesByStage()/reviewProductionBatch().
 *    KCS_STAFF chỉ có PRODUCTION_BATCH:VIEW (mới cấp) — KHÔNG có PRODUCTION_ORDER:VIEW/SKU:VIEW nên
 *    không tự resolve productionOrderId được, cùng lý do GET /material-issues?stage= tồn tại cho
 *    HAN/SON — dùng GET /production-batches?stage= (flat).
 *  - Báo sản lượng (LenhSanXuatHan/Son, đợt 2): dùng getProductionBatchPlan()/reportProductionBatch().
 */
import { http, withIdempotencyKey } from './core/http';

/** PHOI ở đây là "Phôi tự báo cắt xong vật tư thành phẩm" (needsHan=false, vd chân nhôm - cắt
 *  xong là hết, không hàn) - thêm 21/08/2026, khác hẳn công đoạn cắt sắt cho mảnh needsHan=true
 *  (steel-issues-api.ts, dùng SteelIssue chứ không phải ProductionBatch). */
export type ProductionBatchStage = 'PHOI' | 'HAN' | 'SON';

export interface BeProductionBatch {
  id: string;
  productionOrderId: string;
  /** Mã nội bộ (ProductionOrder.poNumber) - chỉ hệ thống dùng, KHÔNG hiển thị. Dùng `salesOrderCode`. */
  poNumber: string;
  /** Mã đơn hàng Sales gốc - đây mới là mã "PO" hiển thị cho người dùng. */
  salesOrderCode: string | null;
  stage: ProductionBatchStage;
  pieceId: string;
  pieceCode: string;
  pieceName: string;
  reportedQty: number;
  status: 'AWAITING_QC' | 'QC_DONE';
  reportedAt: string;
  reportedById: string;
  reworkOfId: string | null;
}

/** KCS xem lô đang chờ/đã duyệt của công đoạn mình — flat qua mọi PO, không cần resolve
 *  productionOrderId (permission không đủ để tự resolve, xem comment đầu file). */
export async function getProductionBatchesByStage(stage: ProductionBatchStage): Promise<BeProductionBatch[]> {
  const res = await http.get<BeProductionBatch[] | { data: BeProductionBatch[] }>(
    `/production-batches?stage=${stage}&limit=100`,
  );
  return Array.isArray(res) ? res : res.data;
}

export async function reviewProductionBatch(
  batchId: string,
  data: { failedQty: number; scrapQty?: number; reason?: string; defectReasonId?: string; photoUrl?: string },
): Promise<void> {
  await http.post(`/production-batches/${batchId}/qc-review`, data);
}

// ── Báo sản lượng (LenhSanXuatHan/LenhSanXuatSon) ──────────────────────────────

export interface BeProductionOrderSummary {
  id: string;
  poNumber: string;
  salesOrderCode: string | null;
  status: 'DRAFT' | 'RELEASED' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
}

/** HAN_STAFF/SON_STAFF liệt kê PO đang hoạt động để chọn báo sản lượng — không có endpoint lọc
 *  theo stage/status ở BE (chỉ PaginationQueryDto), cùng kiểu "fetch hết rồi lọc client" đã dùng ở
 *  resolveProductionOrderId() (production-invoice-item.ts) — danh sách chưa lớn. Bỏ DRAFT/DONE/
 *  CANCELLED, chỉ giữ PO đang chạy thật. */
export async function listProductionOrdersForStage(): Promise<BeProductionOrderSummary[]> {
  const res = await http.get<BeProductionOrderSummary[] | { data: BeProductionOrderSummary[] }>(
    '/production-orders?limit=100',
  );
  const list = Array.isArray(res) ? res : res.data;
  return list.filter((o) => o.status === 'RELEASED' || o.status === 'IN_PROGRESS');
}

export interface BeProductionBatchPlanItem {
  pieceId: string;
  pieceCode: string;
  pieceName: string;
  plannedQty: number;
  awaitingQcQty: number;
  passedQty: number;
}

export interface BeProductionBatchPlan {
  poNumber: string;
  salesOrderCode: string | null;
  productName: string;
  quantity: number;
  items: BeProductionBatchPlanItem[];
}

/** "Còn phải báo bao nhiêu" theo mảnh cho đúng PO+stage — xem ProductionBatchesService.getBatchPlan()
 *  (BE) tại sao cần đủ cả productionOrderId lẫn stage (Piece không có cột stage). */
export async function getProductionBatchPlan(
  productionOrderId: string,
  stage: ProductionBatchStage,
): Promise<BeProductionBatchPlan> {
  return http.get<BeProductionBatchPlan>(
    `/production-orders/${productionOrderId}/production-batch-plan?stage=${stage}`,
  );
}

export async function reportProductionBatch(
  productionOrderId: string,
  data: { stage: ProductionBatchStage; pieceId: string; reportedQty: number },
): Promise<void> {
  await http.post(
    `/production-orders/${productionOrderId}/production-batches`,
    data,
    withIdempotencyKey(),
  );
}
