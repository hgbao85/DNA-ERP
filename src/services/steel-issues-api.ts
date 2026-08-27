/**
 * Adapter XUẤT SẮT CHO PHÔI + QC (KCS) nhánh Phôi: FE ⇄ BE thật (module `steel-issues`/
 * `qc-reviews`, chốt 2026-08-12 — M3 "Xuất sắt Phôi", trước đó bị hoãn). Thay `phoi-sat.service.ts`
 * (mock, key theo `lineId` giả tự sinh ở seed — không liên quan gì đến BE thật).
 *
 * B4 Đợt 3d (2026-08-19, changelog 2026-08-18-xuat-sat-po-pi-vat-tu.md mục 2) - gộp theo CẢ PI
 * thay vì theo (production_order, piece): 1 PI có thể có nhiều SKU/PO, phần mềm đề xuất mua/cắt
 * sắt vốn đã tính gộp ở cấp PI, và Phôi tự phân bổ vật lý theo mảnh nào khi cắt thật. Kho trung
 * tâm (XuatSatPage) giờ key theo `productionInvoiceId` (không phải productionOrderId/pieceId
 * nữa) — resolve qua `ProductionOrderInfo.productionInvoiceId` (production-invoice-item.ts).
 *
 * Tổ Phôi (XacNhanSanLuongPage, PHOI_STAFF) / KCS (KcsPhoiPage, KCS_STAFF): CHỈ có
 * STEEL_ISSUE:VIEW(+UPDATE/QC_REVIEW) — KHÔNG có SKU:VIEW/PRODUCTION_ORDER:VIEW nên không tự
 * resolve productionInvoiceId được. Dùng getSteelIssuesByStatus() gọi thẳng GET /steel-issues?status=
 * (flat, không cần biết PI nào) — endpoint riêng cho đúng trường hợp này, xem
 * ListSteelIssuesQueryDto (BE). productionInvoiceId/piCode đã có sẵn trong chính response.
 *
 * Khác weaving-issues/material-issues: KHÔNG ghi StockLedger (CuttingProposalsService.approve() đã
 * trừ tồn 1 lần lúc duyệt phương án cắt) — xem comment đầu SteelIssuesService (BE).
 */
import { http, withIdempotencyKey } from './core/http';
import type { ProcessStep } from '../types/sku';

export type SteelIssueStatus = 'ISSUED' | 'RECEIVED' | 'IN_PROCESS' | 'AWAITING_QC' | 'QC_PASSED';

export interface BeCutPatternSegment {
  segmentSpecId: string;
  cutLengthMm: number;
  /** TỔNG số đoạn cỡ này trong đợt - KHÔNG phải "trên mỗi cây" (đổi tên từ countPerBar,
   *  2026-08-22). Phôi khai số THỰC cắt được. */
  qty: number;
}

/** 1 đợt cắt Phôi đã báo (append-only - mỗi lần "Nhập đợt cắt" tạo 1 dòng mới, cộng dồn). */
export interface BeCutBundle {
  id: string;
  /** Kiểu cắt gợi ý mà đợt này bám theo - THUẦN THAM CHIẾU/audit, không dùng để suy ra đoạn. */
  proposalPatternId: string | null;
  isOffPlan: boolean;
  barCount: number;
  /** Mẩu sắt còn nguyên (mm) từ cây cắt dở trong đợt - nhập lại kho (thủ kho tự hàn nối đủ 6m
   *  rồi nhập vào tồn CÂY), KHÔNG phải phế liệu. */
  mauNguyenMm: number;
  /** Phế liệu (mm) - phần dư của phương trình cân bằng, HỆ THỐNG TỰ TÍNH, không cần gõ. */
  scrapMm: number;
  segments: BeCutPatternSegment[];
}

export interface BeSteelIssue {
  id: string;
  productionInvoiceId: string;
  /** Mã PI (ProductionInvoice.code) - luôn có, kể cả PI gộp không gắn 1 đơn Sales cụ thể nào. */
  piCode: string;
  /** Mã đơn hàng Sales gốc - null cho PI gộp (isMerged). */
  salesOrderCode: string | null;
  materialId: string;
  materialCode: string;
  materialName: string;
  barLengthMm: number;
  barCount: number;
  status: SteelIssueStatus;
  actualBarCount: number | null;
  issuedAt: string;
  issuedById: string;
  completedAt: string | null;
  reworkOfId: string | null;
  /** Công đoạn đã đánh dấu xong (luôn có CAT sau khi báo cắt xong). */
  completedSteps: ProcessStep[];
  /** Hợp (union) công đoạn của MỌI mảnh dùng loại sắt này trong cả PI (+ CAT mặc định) — phải
   *  xong hết mới vào chờ KCS (hệ thống không biết trước cây sắt về mảnh nào). */
  requiredSteps: ProcessStep[];
  bundles?: BeCutBundle[];
}

export interface BeSteelIssuePlanItem {
  materialId: string;
  materialCode: string;
  materialName: string;
  /** Σ đoạn cần (theo BOM × số lượng, cộng dồn mọi mảnh/SKU dùng vật tư này trong cả PI) — đơn vị
   *  "đoạn", KHÁC barCount (đơn vị "cây"). */
  requiredSegments: number;
  /** Σ cây đã xuất (đợt gốc, không tính rework) cho loại sắt này trong cả PI. */
  issuedBarCount: number;
  /** Còn được xuất theo giữ chỗ (B4 Đợt 3c) — null = phương án duyệt trước mốc đảo cơ chế trừ
   *  tồn (không giữ chỗ) hoặc chưa có phương án cắt nào đã duyệt, KHÔNG phải "không được xuất". */
  remainingToIssue: number | null;
  /** Tồn vật lý thật trong kho lúc xem màn hình — null nếu vật tư chưa gán Kho. */
  physicalStockQty: number | null;
}

function unwrap<T>(res: T[] | { data: T[] }): T[] {
  return Array.isArray(res) ? res : res.data;
}

// ── Kho trung tâm (WAREHOUSE_STAFF) — master-detail theo PI ────────────────────

/** BE tự trả mảng rỗng (200) khi PI chưa có ProductionOrder nào (chưa được Sếp duyệt) —
 *  không có case lỗi nghiệp vụ nào cần nuốt ở đây, lỗi thật (network/500/403...) phải throw
 *  ra ngoài như mọi hàm khác trong file này để FE hiển thị được. */
export async function getSteelIssuePlan(productionInvoiceId: string): Promise<BeSteelIssuePlanItem[]> {
  return http.get<BeSteelIssuePlanItem[]>(
    `/production-invoices/${productionInvoiceId}/steel-issue-plan`,
  );
}

/** Lịch sử các đợt kho đã xuất cho 1 PI (mọi trạng thái) — dùng cho detail view của kho. */
export async function getSteelIssuesForInvoice(productionInvoiceId: string): Promise<BeSteelIssue[]> {
  const res = await http.get<BeSteelIssue[] | { data: BeSteelIssue[] }>(
    `/production-invoices/${productionInvoiceId}/steel-issues?limit=100`,
  );
  return unwrap(res);
}

export async function issueSteel(
  productionInvoiceId: string,
  data: { materialId: string; barLengthMm: number; barCount: number },
): Promise<BeSteelIssue> {
  return http.post<BeSteelIssue>(
    `/production-invoices/${productionInvoiceId}/steel-issues`,
    data,
    withIdempotencyKey(),
  );
}

// ── Tổ Phôi (PHOI_STAFF) / KCS (KCS_STAFF) — flat, không cần biết PO trước ─────

/** Xem ListSteelIssuesQueryDto tại sao endpoint này tồn tại riêng (permission Phôi/KCS không đủ
 *  để tự resolve productionOrderId). Bỏ trống `status` để lấy mọi trạng thái. */
export async function getSteelIssuesByStatus(status?: SteelIssueStatus): Promise<BeSteelIssue[]> {
  const qs = status ? `?status=${status}&limit=100` : '?limit=100';
  const res = await http.get<BeSteelIssue[] | { data: BeSteelIssue[] }>(`/steel-issues${qs}`);
  return unwrap(res);
}

export async function getSteelIssue(id: string): Promise<BeSteelIssue> {
  return http.get<BeSteelIssue>(`/steel-issues/${id}`);
}

/** Mọi đợt cắt (bundle) đã báo cho 1 SteelIssue - dùng để hiện "Lịch sử đợt đã nhập". */
export async function getCutBundles(steelIssueId: string): Promise<BeCutBundle[]> {
  const res = await http.get<BeCutBundle[] | { data: BeCutBundle[] }>(
    `/steel-issues/${steelIssueId}/bundles`,
  );
  return unwrap(res);
}

export async function receiveSteelIssue(id: string): Promise<void> {
  await http.post(`/steel-issues/${id}/receive`, {});
}

/** 1 dòng nhập đợt cắt - segments phải khớp cỡ trong định mức của PI (BE chặn cỡ lạ), tổng
 *  cây dùng cộng dồn không được vượt SteelIssue.barCount (BE chặn). */
export interface RecordCutBatchInput {
  barCount: number;
  /** mm mẩu sắt còn nguyên từ cây cắt dở - mặc định 0 (cắt hết cây). */
  mauNguyenMm?: number;
  /** Kiểu cắt gợi ý đợt này bám theo - THUẦN THAM CHIẾU, tuỳ chọn. */
  proposalPatternId?: string;
  segments: { segmentSpecId: string; qty: number }[];
}

/** Nhập 1 đợt cắt (cộng dồn, KHÔNG đổi trạng thái SteelIssue). Thay `completeCutting` cũ
 *  (2026-08-22) - route đó vừa nhận số liệu (chép từ pattern) vừa chuyển sang chờ KCS trong cùng
 *  1 lần bấm; giờ tách hẳn 2 việc, xem finishCutting(). */
export async function recordCutBatch(id: string, data: RecordCutBatchInput): Promise<BeCutBundle> {
  return http.post<BeCutBundle>(`/steel-issues/${id}/cut-batches`, data);
}

/** "Xong, mời KCS" - tín hiệu thuần, không mang số liệu (đã nhập ở các đợt recordCutBatch trước
 *  đó). RECEIVED -> AWAITING_QC (hoặc IN_PROCESS nếu còn công đoạn chi tiết chưa đánh dấu). */
export async function finishCutting(id: string): Promise<void> {
  await http.post(`/steel-issues/${id}/finish-cutting`, {});
}

/** Đánh dấu 1 công đoạn chi tiết (uốn/dập/...) xong khi đợt đang IN_PROCESS — tự chuyển sang chờ
 *  KCS khi mọi công đoạn đã chọn sẵn (requiredSteps) đều xong. */
export async function completeStep(id: string, step: ProcessStep): Promise<void> {
  await http.post(`/steel-issues/${id}/complete-step`, { step });
}

export interface BePhoiProgressSegment {
  segmentSpecId: string;
  cutLengthMm: number;
  /** Cần theo định mức (đoạn), cộng dồn mọi mảnh/SKU dùng cỡ này trong cả PI. */
  required: number;
  /** Đã báo cắt (đoạn) - Σ tất cả các đợt recordCutBatch. BẤT BIẾN theo lỗi KCS - đây là việc ĐÃ
   *  XẢY RA rồi, không rút lại được (2026-08-24, sửa lỗi ERP: trước trừ thẳng lỗi vào đây làm mâu
   *  thuẫn với "Lịch sử đợt đã nhập"). */
  done: number;
  /** Số đoạn ĐANG thực sự lỗi (KCS đã chấm, chưa duyệt lại xác nhận đạt). "Còn lại" tự tính
   *  = required - (done - failed), KHÔNG lấy thẳng từ BE. */
  failed: number;
}

/** Tiến độ cắt theo (loại sắt -> cỡ đoạn) cho cả 1 PI - nguồn dữ liệu bảng "Cần / Đã cắt / Còn
 *  lại". Cố ý KHÔNG bóc theo SKU (nghiệp vụ chốt 2026-08-21: Phôi không cần biết đoạn thuộc SKU
 *  nào, cắt đủ tổng theo định mức là xong). */
export interface BePhoiProgressItem {
  materialId: string;
  materialCode: string;
  materialName: string;
  issuedBarCount: number;
  segments: BePhoiProgressSegment[];
}

export async function getPhoiProgress(productionInvoiceId: string): Promise<BePhoiProgressItem[]> {
  return http.get<BePhoiProgressItem[]>(`/production-invoices/${productionInvoiceId}/phoi-progress`);
}

/** Tiến độ 1 công đoạn chi tiết SAU Cắt (Uốn/Dập/...) - cùng khuôn dạng "Cần/Đã.../Còn lại" như
 *  getPhoiProgress, khác nguồn `done` (StepBatchSegment thay vì CutPatternSegment). Không gọi với
 *  step=CAT (dùng getPhoiProgress). */
export async function getStepProgress(productionInvoiceId: string, step: ProcessStep): Promise<BePhoiProgressItem[]> {
  return http.get<BePhoiProgressItem[]>(`/production-invoices/${productionInvoiceId}/step-progress/${step}`);
}

/** 1 dòng nhập đợt gia công cho công đoạn chi tiết SAU Cắt - mirror RecordCutBatchInput nhưng
 *  không có barCount/mauNguyenMm (bước này không tác động lên cây sắt). BE chặn vượt số đã cắt. */
export interface RecordStepBatchInput {
  step: ProcessStep
  segments: { segmentSpecId: string; qty: number }[]
}

export interface BeStepBatch {
  id: string
  step: ProcessStep
  segments: { segmentSpecId: string; cutLengthMm: number; qty: number }[]
}

/** Nhập 1 đợt "đã gia công" cho công đoạn chi tiết (cộng dồn, KHÔNG đổi trạng thái SteelIssue). */
export async function recordStepBatch(id: string, data: RecordStepBatchInput): Promise<BeStepBatch> {
  return http.post<BeStepBatch>(`/steel-issues/${id}/step-batches`, data);
}

/** Danh sách PO/SKU thuộc 1 PI - khối tham khảo cho màn Lệnh sản xuất Phôi, KHÔNG mang số liệu
 *  tiến độ (tiến độ chỉ có ở cấp PI × loại sắt, xem getPhoiProgress). */
export interface BePiOrderSummary {
  poNumber: string;
  salesOrderCode: string | null;
  productName: string;
  quantity: number;
}

export async function getPiOrderSummary(productionInvoiceId: string): Promise<BePiOrderSummary[]> {
  return http.get<BePiOrderSummary[]>(`/production-invoices/${productionInvoiceId}/order-summary`);
}

// ── KCS (nhánh Phôi) ────────────────────────────────────────────────────────

/** 1 dòng lỗi theo cỡ đoạn (2026-08-24, vòng 2) - CHỈ 2 kết quả Đạt/Không đạt, không phân loại
 *  "sửa được" nữa. failedQty BẤT BIẾN (số KCS chấm lần đầu); resolvedQty là phần KCS đã DUYỆT LẠI
 *  xác nhận đạt sau khi Phôi tự bù (ngoài hệ thống, không đụng cây sắt kho cấp). Outstanding =
 *  failedQty - resolvedQty. phoiReportedAt != null = Phôi đã bấm "Bù đủ", đang chờ KCS duyệt lại. */
export interface BeQcReviewSegment {
  segmentSpecId: string;
  cutLengthMm: number;
  failedQty: number;
  resolvedQty: number;
  phoiReportedAt: string | null;
}

/** KCS chấm 1 SteelIssue THEO TỪNG CỠ ĐOẠN - segments rỗng = đạt hết. */
export async function reviewSteelIssueQc(
  id: string,
  data: {
    segments: { segmentSpecId: string; failedQty: number }[];
    reason?: string;
    defectReasonId?: string;
    photoUrl?: string;
  },
): Promise<void> {
  await http.post(`/steel-issues/${id}/qc-review`, data);
}

/** Phôi tự báo đã bù đủ cho 1 cỡ đoạn không đạt (đã tự kiếm sắt bù ngoài thực tế, KHÔNG đụng cây
 *  sắt kho đã cấp) - CHỜ KCS recheck() mới tính là đạt. */
export async function reportSegmentDone(steelIssueId: string, segmentSpecId: string): Promise<void> {
  await http.post(`/steel-issues/${steelIssueId}/qc-segments/${segmentSpecId}/report-done`, {});
}

/** KCS duyệt lại các cỡ đoạn Phôi đã báo "Bù đủ" - remainingFailedQty=0 nghĩa là đạt hết cho cỡ
 *  đó, >0 là còn hỏng bấy nhiêu (segment quay lại chờ Phôi bù tiếp). */
export async function recheckQc(
  steelIssueId: string,
  segments: { segmentSpecId: string; remainingFailedQty: number }[],
): Promise<void> {
  await http.post(`/steel-issues/${steelIssueId}/qc-recheck`, { segments });
}

/** 1 dòng qc_reviews (nhánh Phôi, steelIssueId != null) — dùng để dựng lại "đạt bao nhiêu / lỗi bao
 *  nhiêu" cho các đợt QC_PASSED (SteelIssue tự nó KHÔNG giữ lại số liệu duyệt, khác ProductionBatch
 *  không ghi đè reportedQty). Fetch 1 lần, lọc client theo steelIssueId — danh sách chưa lớn, cùng
 *  idiom "fetch hết rồi lọc client" đã dùng ở resolveProductionOrderId(). */
export interface BeQcReview {
  id: string;
  steelIssueId: string | null;
  productionBatchId: string | null;
  /** Tổng dẫn xuất từ segments[] (nhánh Phôi) - nhánh Hàn/Sơn là số gốc, segments luôn rỗng. */
  failedQty: number;
  scrapQty: number | null;
  defectReasonId: string | null;
  defectReasonLabel: string | null;
  reason: string | null;
  photoUrl: string | null;
  reviewedAt: string;
  reviewedById: string;
  segments: BeQcReviewSegment[];
}

export async function getQcReviewsForSteelIssues(): Promise<BeQcReview[]> {
  const res = await http.get<BeQcReview[] | { data: BeQcReview[] }>('/qc-reviews?limit=100');
  return unwrap(res).filter((r) => r.steelIssueId != null);
}

// ── Kho trung tâm — cấp bù sắt phế (KCS đề xuất qua qc-review) ─────────────────

export type ReplenishRequestStatus = 'OPEN' | 'FULFILLED' | 'REJECTED';

export interface BeReplenishRequest {
  id: string;
  qcReviewId: string;
  status: ReplenishRequestStatus;
  qty: number;
  fulfilledByIssueId: string | null;
  fulfilledAt: string | null;
  fulfilledById: string | null;
  rejectionReason: string | null;
}

export async function getReplenishRequests(
  status: ReplenishRequestStatus = 'OPEN',
): Promise<BeReplenishRequest[]> {
  const res = await http.get<BeReplenishRequest[] | { data: BeReplenishRequest[] }>(
    `/replenish-requests?status=${status}&limit=100`,
  );
  return unwrap(res);
}

/** Kho cấp bù bằng 1 đợt SteelIssue MỚI đã tạo trước đó (qua issueSteel() thường, cùng materialId
 *  với đợt gốc) — không tự tạo đợt, chỉ liên kết. */
export async function fulfillReplenishRequest(id: string, steelIssueId: string): Promise<void> {
  await http.post(`/replenish-requests/${id}/fulfill`, { steelIssueId });
}

export async function rejectReplenishRequest(id: string, reason?: string): Promise<void> {
  await http.post(`/replenish-requests/${id}/reject`, { reason });
}
