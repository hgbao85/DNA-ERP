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
  /** QLSX kiểm soát qua nút Bắt đầu/Kết thúc ở "Bảng thống kê" (2026-08-31) - ĐỘC LẬP với
   *  `status` ở trên. Hàn/Sơn chỉ hiện lệnh khi PI của nó có ÍT NHẤT 1 SKU ACTIVE (xem
   *  listProductionOrdersForStage) - không bắt buộc CHÍNH lệnh này phải tự ACTIVE. */
  floorStage: 'PENDING' | 'ACTIVE' | 'FINISHED';
  /** Dùng để gộp theo PI - xem listProductionOrdersForStage. */
  productionInvoiceId: string;
  /** Mã PI hiển thị (vd "PI-2026-003") - dùng để gom giao diện Hàn/Sơn theo PI giống Phôi
   *  (2026-08-31, xem PiListBoard ở core.tsx). */
  piCode: string;
}

/**
 * HAN_STAFF/SON_STAFF liệt kê PO đang hoạt động để chọn báo sản lượng — không có endpoint lọc
 * theo stage/status ở BE (chỉ PaginationQueryDto), cùng kiểu "fetch hết rồi lọc client" đã dùng ở
 * resolveProductionOrderId() (production-invoice-item.ts) — danh sách chưa lớn. Bỏ DRAFT/DONE/
 * CANCELLED, chỉ giữ PO đang chạy thật.
 *
 * Lọc theo floorStage GỘP THEO PI (2026-08-31, đồng nhất với Phôi - xem
 * ListSteelIssuesQueryDto.activeOnly ở BE): 1 PI có nhiều SKU, chỉ cần 1 SKU bất kỳ đã được QLSX
 * bấm "Bắt đầu" (ACTIVE) là MỌI SKU khác cùng PI đó cũng hiện theo, không bắt buộc từng SKU phải
 * tự bấm Bắt đầu riêng - khớp thực tế Phôi cắt sắt chung cho cả PI nên Hàn/Sơn nhận hàng ra cùng
 * lúc, không tách biệt độc lập theo từng SKU như tưởng ban đầu.
 */
export async function listProductionOrdersForStage(): Promise<BeProductionOrderSummary[]> {
  const res = await http.get<BeProductionOrderSummary[] | { data: BeProductionOrderSummary[] }>(
    '/production-orders?limit=100',
  );
  const list = Array.isArray(res) ? res : res.data;
  const activePiIds = new Set(
    list.filter((o) => o.floorStage === 'ACTIVE').map((o) => o.productionInvoiceId),
  );
  return list.filter(
    (o) => (o.status === 'RELEASED' || o.status === 'IN_PROGRESS') && activePiIds.has(o.productionInvoiceId),
  );
}

/** QLSX bấm "Bắt đầu" ở "Bảng thống kê" - PENDING/ACTIVE -> ACTIVE. Không đụng `status`. */
export async function startProductionOrderFloor(productionOrderId: string): Promise<BeProductionOrderSummary> {
  return http.post<BeProductionOrderSummary>(`/production-orders/${productionOrderId}/floor-start`);
}

/** QLSX bấm "Kết thúc" - bất kỳ trạng thái nào -> FINISHED, không kiểm tra tiến độ. */
export async function finishProductionOrderFloor(productionOrderId: string): Promise<BeProductionOrderSummary> {
  return http.post<BeProductionOrderSummary>(`/production-orders/${productionOrderId}/floor-finish`);
}

export interface BeProductionBatchPlanItem {
  pieceId: string;
  pieceCode: string;
  pieceName: string;
  plannedQty: number;
  awaitingQcQty: number;
  passedQty: number;
  /** Chỉ có giá trị cho stage=PHOI khi mảnh có định mức PieceMaterialYield (vd chân nhôm) - tồn
   *  nguyên liệu thô (vd thanh nhôm) hiện có tại kho, để cảnh báo "còn X cây chưa cắt hết"
   *  (chỉ hiển thị, không chặn - quyết định nghiệp vụ 2026-08-22). Null cho mọi trường hợp khác. */
  rawMaterialOnHand: number | null;
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

/** Gộp nhiều ProductionOrder 1 lần, CÙNG stage — "Bảng thống kê" (ThongKePagePlan.tsx) cần tiến
 *  độ Hàn/Sơn cho nhiều SKU cùng lúc (1 lệnh gọi cho HAN, 1 cho SON, thay vì 2×N). Trả về map
 *  orderId -> kế hoạch (order không có trong danh sách trả về sẽ không có key). */
export async function getProductionBatchPlanBatch(
  productionOrderIds: string[],
  stage: ProductionBatchStage,
): Promise<Record<string, BeProductionBatchPlan>> {
  if (productionOrderIds.length === 0) return {};
  return http.get<Record<string, BeProductionBatchPlan>>(
    `/production-orders/production-batch-plan/batch?ids=${encodeURIComponent(productionOrderIds.join(','))}&stage=${stage}`,
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
