/**
 * Adapter XUẤT SẮT CHO PHÔI + QC (KCS) nhánh Phôi: FE ⇄ BE thật (module `steel-issues`/
 * `qc-reviews`, chốt 2026-08-12 — M3 "Xuất sắt Phôi", trước đó bị hoãn). Thay `phoi-sat.service.ts`
 * (mock, key theo `lineId` giả tự sinh ở seed — không liên quan gì đến BE thật).
 *
 * 2 phía dùng 2 cách truy vấn KHÁC NHAU vì permission khác nhau (cùng lý do đã áp cho
 * material-issues-api.ts/weaving-issues-api.ts, xem role-permissions.constant.ts):
 *  - Kho trung tâm (XuatSatPage, WAREHOUSE_STAFF): key theo `productionOrderId`, resolve qua
 *    resolveProductionOrderId() (WAREHOUSE_STAFF có SKU:VIEW + PRODUCTION_ORDER:VIEW) — master-detail
 *    theo SKU/PO, cùng pattern KhoXuatDanPage.
 *  - Tổ Phôi (XacNhanSanLuongPage, PHOI_STAFF) / KCS (KcsPhoiPage, KCS_STAFF): CHỈ có
 *    STEEL_ISSUE:VIEW(+UPDATE/QC_REVIEW) — KHÔNG có SKU:VIEW/PRODUCTION_ORDER:VIEW nên không tự
 *    resolve productionOrderId được. Dùng getSteelIssuesByStatus() gọi thẳng GET /steel-issues?status=
 *    (flat, không cần biết PO nào) — endpoint riêng cho đúng trường hợp này, xem
 *    ListSteelIssuesQueryDto (BE). productionOrderId/poNumber đã có sẵn trong chính response.
 *
 * Khác weaving-issues/material-issues: KHÔNG ghi StockLedger (CuttingProposalsService.approve() đã
 * trừ tồn 1 lần lúc duyệt phương án cắt) — xem comment đầu SteelIssuesService (BE).
 */
import { http } from './core/http';
import type { Sku } from '../types/sku';
import { resolveProductionOrderId } from './production-invoice-item';
import { getCuttingProposalsForOrder, getCuttingProposal } from './cutting-proposals-api';
import type { CuttingProposalPattern } from './cutting-proposals-api';

export type SteelIssueStatus = 'ISSUED' | 'RECEIVED' | 'AWAITING_QC' | 'QC_PASSED';

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
  productionOrderId: string;
  poNumber: string;
  pieceId: string;
  pieceCode: string;
  pieceName: string;
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
  bundles?: BeCutBundle[];
}

export interface BeSteelIssuePlanItem {
  pieceId: string;
  pieceCode: string;
  pieceName: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  /** Σ đoạn cần (theo BOM × số lượng PO) — đơn vị "đoạn", KHÁC barCount (đơn vị "cây"). */
  requiredSegments: number;
  /** Σ cây đã xuất (đợt gốc, không tính rework) cho mảnh này. */
  issuedBarCount: number;
}

function unwrap<T>(res: T[] | { data: T[] }): T[] {
  return Array.isArray(res) ? res : res.data;
}

// ── Kho trung tâm (WAREHOUSE_STAFF) — master-detail theo SKU/PO ────────────────

/** Trả mảng rỗng khi SKU chưa có ProductionOrder (chưa được Sếp duyệt) — chưa có gì để xuất,
 *  không phải lỗi cần báo cho thủ kho. */
export async function getSteelIssuePlan(pf: Sku): Promise<BeSteelIssuePlanItem[]> {
  const orderId = await resolveProductionOrderId(pf);
  if (!orderId) return [];
  try {
    return await http.get<BeSteelIssuePlanItem[]>(`/production-orders/${orderId}/steel-issue-plan`);
  } catch {
    return [];
  }
}

/** Lịch sử các đợt kho đã xuất cho 1 PO (mọi trạng thái) — dùng cho detail view của kho. */
export async function getSteelIssuesForSku(pf: Sku): Promise<BeSteelIssue[]> {
  const orderId = await resolveProductionOrderId(pf);
  if (!orderId) return [];
  const res = await http.get<BeSteelIssue[] | { data: BeSteelIssue[] }>(
    `/production-orders/${orderId}/steel-issues?limit=100`,
  );
  return unwrap(res);
}

export async function issueSteel(
  pf: Sku,
  data: { pieceId: string; barLengthMm: number; barCount: number },
): Promise<BeSteelIssue> {
  const orderId = await resolveProductionOrderId(pf);
  if (!orderId) throw new Error('SKU chưa có Lệnh sản xuất (chưa được Sếp duyệt) — chưa thể xuất sắt');
  return http.post<BeSteelIssue>(`/production-orders/${orderId}/steel-issues`, data, {
    headers: { 'Idempotency-Key': crypto.randomUUID() },
  });
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

/** Các kiểu cắt (pattern) đã duyệt cho đúng vật tư của 1 đợt sắt — để Phôi báo cắt xong đúng theo
 *  phương án đã duyệt (proposalPatternId thật) thay vì nhập tay đoạn/cây. Trả mảng rỗng nếu chưa
 *  có phương án cắt nào APPROVED cho vật tư này (không nên xảy ra — SteelIssuesService.create() đã
 *  chặn xuất sắt khi chưa có phương án duyệt — nhưng không throw để FE có chỗ báo lỗi rõ ràng hơn). */
export async function getApprovedPatternsForMaterial(
  productionOrderId: string,
  materialId: string,
): Promise<CuttingProposalPattern[]> {
  const proposals = await getCuttingProposalsForOrder(productionOrderId);
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

/** Kho cấp bù bằng 1 đợt SteelIssue MỚI đã tạo trước đó (qua issueSteel() thường, cùng pieceId/
 *  materialId với đợt gốc) — không tự tạo đợt, chỉ liên kết. */
export async function fulfillReplenishRequest(id: string, steelIssueId: string): Promise<void> {
  await http.post(`/replenish-requests/${id}/fulfill`, { steelIssueId });
}

export async function rejectReplenishRequest(id: string, reason?: string): Promise<void> {
  await http.post(`/replenish-requests/${id}/reject`, { reason });
}
