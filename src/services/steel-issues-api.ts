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
import { getCuttingProposalsForInvoice, getCuttingProposal } from './cutting-proposals-api';
import type { CuttingProposalPattern } from './cutting-proposals-api';

export type SteelIssueStatus = 'ISSUED' | 'RECEIVED' | 'IN_PROCESS' | 'AWAITING_QC' | 'QC_PASSED';

export interface BeCutPatternSegment {
  segmentSpecId: string;
  cutLengthMm: number;
  countPerBar: number;
}

export interface BeCutBundle {
  id: string;
  proposalPatternId: string | null;
  isOffPlan: boolean;
  barCount: number;
  wastePerBarMm: number | null;
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

export async function receiveSteelIssue(id: string): Promise<void> {
  await http.post(`/steel-issues/${id}/receive`, {});
}

export interface CompleteCuttingBundleInput {
  proposalPatternId?: string;
  barCount: number;
  wastePerBarMm?: number;
  segments: { segmentSpecId: string; countPerBar: number }[];
}

export async function completeCutting(
  id: string,
  data: { actualBarCount?: number; bundles: CompleteCuttingBundleInput[] },
): Promise<void> {
  await http.post(`/steel-issues/${id}/complete-cutting`, data);
}

/** Đánh dấu 1 công đoạn chi tiết (uốn/dập/...) xong khi đợt đang IN_PROCESS — tự chuyển sang chờ
 *  KCS khi mọi công đoạn đã chọn sẵn (requiredSteps) đều xong. */
export async function completeStep(id: string, step: ProcessStep): Promise<void> {
  await http.post(`/steel-issues/${id}/complete-step`, { step });
}

/** Các kiểu cắt (pattern) đã duyệt cho đúng vật tư của 1 đợt sắt — để Phôi báo cắt xong đúng theo
 *  phương án đã duyệt (proposalPatternId thật) thay vì nhập tay đoạn/cây. Trả mảng rỗng nếu chưa
 *  có phương án cắt nào APPROVED cho vật tư này (không nên xảy ra — SteelIssuesService.create() đã
 *  chặn xuất sắt khi chưa có phương án duyệt — nhưng không throw để FE có chỗ báo lỗi rõ ràng hơn). */
export async function getApprovedPatternsForMaterial(
  productionInvoiceId: string,
  materialId: string,
): Promise<CuttingProposalPattern[]> {
  const proposals = await getCuttingProposalsForInvoice(productionInvoiceId);
  const approved = proposals.find((p) => p.status === 'APPROVED');
  if (!approved) return [];
  const detail = await getCuttingProposal(approved.id);
  const line = detail.lines?.find((l) => l.materialId === materialId);
  return line?.patterns ?? [];
}

// ── KCS (nhánh Phôi) ────────────────────────────────────────────────────────

export async function reviewSteelIssueQc(
  id: string,
  data: { failedQty: number; scrapQty?: number; reason?: string; defectReasonId?: string; photoUrl?: string },
): Promise<void> {
  await http.post(`/steel-issues/${id}/qc-review`, data);
}

/** 1 dòng qc_reviews (nhánh Phôi, steelIssueId != null) — dùng để dựng lại "đạt bao nhiêu / lỗi bao
 *  nhiêu" cho các đợt QC_PASSED (SteelIssue tự nó KHÔNG giữ lại số liệu duyệt, khác ProductionBatch
 *  không ghi đè reportedQty). Fetch 1 lần, lọc client theo steelIssueId — danh sách chưa lớn, cùng
 *  idiom "fetch hết rồi lọc client" đã dùng ở resolveProductionOrderId(). */
export interface BeQcReview {
  id: string;
  steelIssueId: string | null;
  productionBatchId: string | null;
  failedQty: number;
  scrapQty: number | null;
  defectReasonId: string | null;
  defectReasonLabel: string | null;
  reason: string | null;
  photoUrl: string | null;
  reviewedAt: string;
  reviewedById: string;
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
