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
import type { ProcessStep } from '../types/sku';

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
  /** Mã PI (ProductionInvoice.code) - dự phòng hiển thị "PO/PI" khi salesOrderCode null (PI gộp
   *  không gắn 1 đơn Sales cụ thể, cùng idiom SteelIssue.piCode ở steel-issues-api.ts). Null nếu
   *  SKU chưa được KHSX gom vào PI nào. */
  piCode: string | null;
  stage: ProductionBatchStage;
  pieceId: string;
  pieceCode: string;
  pieceName: string;
  reportedQty: number;
  /** OPEN (2026-09-08) - CHỈ stage PHOI, mảnh không khai processSteps (ChotPanel "Lưu đợt", chưa
   *  gửi KCS) - xem ProductionBatchesService.recordProductionBatch(). */
  status: 'OPEN' | 'AWAITING_QC' | 'QC_DONE';
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

/** Tổ Phôi xem lại các lô ĐÃ báo (QC_DONE) của CHÍNH order này để tìm lô còn "Bù đủ" (2026-09-07,
 *  xem VatTuTpDetail.tsx) - khác getProductionBatchesByStage() (flat cho KCS), ở đây scope theo
 *  đúng 1 productionOrderId (endpoint GET /production-orders/:id/production-batches). */
export async function getProductionBatchesForOrder(
  productionOrderId: string,
  stage: ProductionBatchStage,
): Promise<BeProductionBatch[]> {
  const res = await http.get<BeProductionBatch[] | { data: BeProductionBatch[] }>(
    `/production-orders/${productionOrderId}/production-batches?limit=100`,
  );
  const list = Array.isArray(res) ? res : res.data;
  return list.filter((b) => b.stage === stage);
}

export async function reviewProductionBatch(
  batchId: string,
  data: { failedQty: number; reason?: string; defectReasonId?: string; photoUrl?: string },
): Promise<void> {
  await http.post(`/production-batches/${batchId}/qc-review`, data);
}

/** 1 dòng qc_reviews nhánh Hàn/Sơn/VTTP (productionBatchId != null). failedQty BẤT BIẾN - số lịch
 *  sử cộng dồn (2026-09-08 lần 2, xem changelog "Bù đủ dồn về bảng tổng") - bỏ hẳn phân loại "Sửa
 *  được/Phế" (scrapQty) + cơ chế report-done/recheck (resolvedQty/phoiReportedAt/phoiReportedQty). */
export interface BeProductionBatchQcReview {
  id: string;
  productionBatchId: string | null;
  failedQty: number;
  defectReasonId: string | null;
  defectReasonLabel: string | null;
  reason: string | null;
  photoUrl: string | null;
  reviewedAt: string;
  reviewedById: string;
}

/** Fetch hết rồi lọc client theo productionBatchId != null - cùng idiom getQcReviewsForSteelIssues()
 *  (steel-issues-api.ts), danh sách chưa lớn. */
export async function getQcReviewsForProductionBatches(): Promise<BeProductionBatchQcReview[]> {
  const res = await http.get<BeProductionBatchQcReview[] | { data: BeProductionBatchQcReview[] }>(
    '/qc-reviews?limit=100',
  );
  const list = Array.isArray(res) ? res : res.data;
  return list.filter((r) => r.productionBatchId != null);
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
  floorStage: 'PENDING' | 'ACTIVE' | 'PAUSED' | 'FINISHED';
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

/** QLSX bấm "Bắt đầu" (từ PENDING) hoặc "Tiếp tục" (từ PAUSED) - cùng route, luôn -> ACTIVE. Không đụng `status`. */
export async function startProductionOrderFloor(productionOrderId: string): Promise<BeProductionOrderSummary> {
  return http.post<BeProductionOrderSummary>(`/production-orders/${productionOrderId}/floor-start`);
}

/** QLSX bấm "Tạm dừng" - bất kỳ trạng thái nào -> PAUSED. */
export async function pauseProductionOrderFloor(productionOrderId: string): Promise<BeProductionOrderSummary> {
  return http.post<BeProductionOrderSummary>(`/production-orders/${productionOrderId}/floor-pause`);
}

/** QLSX bấm "Kết thúc" - bất kỳ trạng thái nào -> FINISHED, không kiểm tra tiến độ. */
export async function finishProductionOrderFloor(productionOrderId: string): Promise<BeProductionOrderSummary> {
  return http.post<BeProductionOrderSummary>(`/production-orders/${productionOrderId}/floor-finish`);
}

/** Tiến độ 1 công đoạn (Cắt/Uốn/...) cho 1 mảnh vật tư thành phẩm - required LUÔN = plannedQty
 *  (mọi mảnh đều phải qua từng bước đã khai), done = Σ đã báo qua recordPieceStepBatch(). */
export interface BePieceStepProgress {
  step: ProcessStep;
  requiredQty: number;
  doneQty: number;
  /** Σ PieceStepBundle.qty (MỌI status) - "còn chưa gửi KCS" = doneQty - submittedQty (2026-09-07). */
  submittedQty: number;
  /** Σ PieceStepBundle.qty đã KCS duyệt (status=QC_PASSED) - dùng hiện cảnh báo (không chặn) khi
   *  bước sau vượt bước liền trước, từ khi BE bỏ ràng buộc thứ tự cứng. */
  passedQty: number;
  /** Σ QcReview.failedQty CỘNG DỒN LỊCH SỬ của đúng bước này (2026-09-07 lần 2, xem changelog
   *  "Bù đủ dồn về bảng tổng") - KHÔNG tự giảm (bỏ hẳn report-done/recheck theo công đoạn). FE
   *  hiện nút "Bù đủ" khi remaining > 0 && failedQty > 0, chỉ gợi ý sẵn số lượng vào ô nhập - Phôi
   *  làm thêm rồi gửi KCS như đợt mới. */
  failedQty: number;
}

// ── QC theo TỪNG CÔNG ĐOẠN (PieceStepBundle, 2026-09-07) ───────────────────────
// Thay ràng buộc CŨ "phải xong hết công đoạn mới gửi KCS" - giờ mỗi công đoạn tự gửi KCS riêng,
// KHÔNG chờ công đoạn khác (quyết định nghiệp vụ, Sếp Trương Văn Nhân). KHÔNG đụng
// ProductionBatch.reportedQty - bundle này thuần là cổng kiểm tra chất lượng theo công đoạn, không
// sinh sản lượng (xem PieceStepBundle doc comment BE).

export interface BePieceStepBundle {
  id: string;
  productionOrderId: string;
  poNumber: string;
  salesOrderCode: string | null;
  /** Mã PI (ProductionInvoice.code) - dự phòng hiển thị "PO/PI" khi salesOrderCode null, khớp
   *  shape BeProductionBatch. */
  piCode: string | null;
  pieceId: string;
  pieceCode: string;
  pieceName: string;
  step: ProcessStep;
  qty: number;
  status: 'AWAITING_QC' | 'QC_PASSED';
  submittedAt: string;
  submittedById: string;
}

/** Phôi gom mọi PieceStepBatch CHƯA gửi (pieceStepBundleId NULL) của (piece, step) thành 1 đợt
 *  gửi KCS - service tự tính qty, không cần truyền. */
export async function submitPieceStep(
  productionOrderId: string,
  data: { pieceId: string; step: ProcessStep },
): Promise<BePieceStepBundle> {
  return http.post<BePieceStepBundle>(`/production-orders/${productionOrderId}/piece-step-bundles`, data);
}

/** Phôi xem lại bundle CỦA CHÍNH order này (mọi status) - trạng thái theo công đoạn + khối "Các đợt
 *  đã gửi" (lịch sử thuần xem, VatTuTpDetail.tsx). Không phân trang (1 order hiếm khi có quá vài
 *  chục bundle). */
export async function getPieceStepBundlesForOrder(productionOrderId: string): Promise<BePieceStepBundle[]> {
  return http.get<BePieceStepBundle[]>(`/production-orders/${productionOrderId}/piece-step-bundles`);
}

/** KCS xem bundle đang chờ/đã duyệt - flat qua mọi PO, cùng lý do getProductionBatchesByStage().
 *  Bỏ trống `status` để lấy CẢ 2 (dùng cho màn KCS gộp chung với ProductionBatch cùng 1 bảng). */
export async function getPieceStepBundles(status?: 'AWAITING_QC' | 'QC_PASSED'): Promise<BePieceStepBundle[]> {
  const res = await http.get<BePieceStepBundle[] | { data: BePieceStepBundle[] }>(
    `/piece-step-bundles?limit=100${status ? `&status=${status}` : ''}`,
  );
  return Array.isArray(res) ? res : res.data;
}

/** 1 dòng qc_reviews nhánh công đoạn VTTP (pieceStepBundleId != null) - mirror
 *  BeProductionBatchQcReview, dùng cho khối "Các đợt đã gửi" (Lỗi của từng đợt). */
export interface BePieceStepBundleQcReview {
  id: string;
  pieceStepBundleId: string | null;
  failedQty: number;
  reviewedAt: string;
  reviewedById: string;
}

/** Fetch hết rồi lọc client theo pieceStepBundleId != null - cùng idiom
 *  getQcReviewsForProductionBatches() ở trên, danh sách chưa lớn. */
export async function getQcReviewsForPieceStepBundles(): Promise<BePieceStepBundleQcReview[]> {
  const res = await http.get<BePieceStepBundleQcReview[] | { data: BePieceStepBundleQcReview[] }>(
    '/qc-reviews?limit=100',
  );
  const list = Array.isArray(res) ? res : res.data;
  return list.filter((r) => r.pieceStepBundleId != null);
}

export async function reviewPieceStepQc(
  pieceStepBundleId: string,
  data: { failedQty: number; reason?: string; defectReasonId?: string; photoUrl?: string },
): Promise<void> {
  await http.post(`/piece-step-bundles/${pieceStepBundleId}/qc-review`, data);
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
  /** PieceMaterialYield.processSteps (2026-09-04) - ĐÃ chuẩn hoá thứ tự nghiệp vụ ở BE. Mảng rỗng
   *  cho stage khác PHOI, hoặc mảnh chưa khai công đoạn nào (giữ nguyên luồng báo thẳng cũ). */
  processSteps: ProcessStep[];
  /** Rỗng khi processSteps rỗng - xem BePieceStepProgress. */
  stepProgress: BePieceStepProgress[];
  /** PieceMaterialYield.qtyPerPiece - chỉ để hiện phụ chú "= N miếng" đối chiếu, KHÔNG dùng để
   *  tính required/done (đơn vị báo cáo luôn là MẢNH). Null khi mảnh không có PieceMaterialYield. */
  qtyPerPiece: number | null;
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

/** "Lưu đợt" (Phôi/Hàn/Sơn, 2026-09-09 mở rộng - ban đầu 2026-09-08 CHỈ VTTP ChotPanel dùng) -
 *  tích luỹ vào 1 ProductionBatch đang OPEN, mirror recordCutBatch() bên Sắt. */
// 2026-09-11 (QA audit C2, ĐÍNH CHÍNH sau khi đọc lại BE): phát hiện gốc đề xuất thêm
// withIdempotencyKey() ở cả 2 hàm dưới - ĐÃ THỬ rồi REVERT vì BE tự ghi rõ đây là quyết định thiết
// kế CÓ CHỦ Ý, không phải lỗ hổng: `recordProductionBatch()` là hành động CỘNG DỒN, BE comment "KHÔNG
// cần Idempotency-Key dedup như create() - double-submit chỉ gây cộng dư số lượng (dễ nhận ra + tự
// sửa lại)... FE tự khoá nút lúc đang gửi (busy state)". `finishProductionBatch()` tự bảo vệ bằng
// kiểm tra `status !== OPEN` (ConflictException) - double-click chỉ nhận lỗi 409 vô hại, không tạo
// dữ liệu sai. Thêm Idempotency-Key ở FE cũng vô nghĩa vì BE không đọc header này cho 2 route này.
export async function recordProductionBatch(
  productionOrderId: string,
  data: { stage: ProductionBatchStage; pieceId: string; qty: number },
): Promise<void> {
  await http.post(`/production-orders/${productionOrderId}/production-batches/record`, data)
}

/** "Gửi KCS" ChotPanel - đóng ProductionBatch đang OPEN, chuyển AWAITING_QC (mirror finishCutBundle()). */
export async function finishProductionBatch(productionBatchId: string): Promise<void> {
  await http.post(`/production-batches/${productionBatchId}/finish`, {})
}

/** Phôi báo "vừa {step} xong N mảnh" cho vật tư thành phẩm có PieceMaterialYield.processSteps -
 *  trước khi chốt lô thật qua reportProductionBatch() để gửi KCS (xem VatTuTpDetail.tsx). */
export async function recordPieceStepBatch(
  productionOrderId: string,
  data: { stage: ProductionBatchStage; pieceId: string; step: ProcessStep; qty: number },
): Promise<void> {
  await http.post(
    `/production-orders/${productionOrderId}/piece-step-batches`,
    data,
    withIdempotencyKey(),
  );
}
