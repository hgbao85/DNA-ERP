/**
 * Adapter SẢN LƯỢNG + QC HÀN/SƠN: FE ⇄ BE thật (module `production-batches`/`qc-reviews`).
 * Thay `san-luong.service.ts` (mock, key theo `ProcLine.id` giả tự sinh ở seed — không liên quan
 * gì tới BE thật, xem `components/sanxuat/core.tsx`).
 *
 * Nối theo 2 đợt độc lập vì độ khó khác hẳn nhau (xem callout roadmap M3):
 *  - QC Hàn/Sơn (KcsStagePage, đợt 1): tự đứng độc lập, dựng toàn bộ từ mảng batches (đã có sẵn
 *    poNumber/partCode/partName inline) — dùng getProductionBatchesByStage()/reviewProductionBatch().
 *    KCS_STAFF chỉ có PRODUCTION_BATCH:VIEW (mới cấp) — KHÔNG có PRODUCTION_ORDER:VIEW/SKU:VIEW nên
 *    không tự resolve productionOrderId được, cùng lý do GET /material-issues?stage= tồn tại cho
 *    HAN/SON — dùng GET /production-batches?stage= (flat).
 *  - Báo sản lượng (LenhSanXuatHan/Son, đợt 2): dùng getProductionBatchPlan()/reportProductionBatch().
 */
import { http } from './core/http';

export type ProductionBatchStage = 'HAN' | 'SON';

export interface BeProductionBatch {
  id: string;
  productionOrderId: string;
  poNumber: string;
  stage: ProductionBatchStage;
  partId: string;
  partCode: string;
  partName: string;
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
  partId: string;
  partCode: string;
  partName: string;
  plannedQty: number;
  awaitingQcQty: number;
  passedQty: number;
}

export interface BeProductionBatchPlan {
  poNumber: string;
  productName: string;
  quantity: number;
  items: BeProductionBatchPlanItem[];
}

/** "Còn phải báo bao nhiêu" theo part cho đúng PO+stage — xem ProductionBatchesService.getBatchPlan()
 *  (BE) tại sao cần đủ cả productionOrderId lẫn stage (Part không có cột stage). */
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
  data: { stage: ProductionBatchStage; partId: string; reportedQty: number },
): Promise<void> {
  await http.post(`/production-orders/${productionOrderId}/production-batches`, data);
}
