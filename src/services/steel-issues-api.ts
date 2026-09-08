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

/** Vòng đời 1 đợt cắt (2026-09-05) - từ nay là ĐƠN VỊ MANG TRẠNG THÁI của công đoạn Phôi, xem
 *  BeCutBundle. Trước đây trạng thái nằm ở cả lô nhận (SteelIssue.status) - đổi vì sắt giao BÙ
 *  sau khi lô cũ đã gửi KCS không cắt tiếp được (không có đường quay lại RECEIVED). */
export type CutBundleStatus = 'CUTTING' | 'AWAITING_QC' | 'QC_PASSED';

export interface BeCutPatternSegment {
  segmentSpecId: string;
  cutLengthMm: number;
  /** TỔNG số đoạn cỡ này trong đợt - KHÔNG phải "trên mỗi cây" (đổi tên từ countPerBar,
   *  2026-08-22). Phôi khai số THỰC cắt được. */
  qty: number;
}

export interface BeStepBundleSegment {
  segmentSpecId: string;
  cutLengthMm: number;
  qty: number;
}

/**
 * "Đợt gửi KCS" cho 1 CÔNG ĐOẠN PHỤ (Uốn/Dập/Đục lỗ/Tán/Tóp đầu/Xẻ) của 1 LOẠI SẮT trong 1 PI
 * (2026-09-07, đổi scope lần 2 theo Sếp Trương Văn Nhân - Phôi làm các công đoạn SONG SONG, không
 * cần biết đúng đợt cắt nào ra đoạn đó - KHÔNG còn `cutBundleId`, scope theo PI + vật tư mirror
 * `BeStepBatch`/getStepProgress()).
 */
export interface BeStepBundle {
  id: string;
  productionInvoiceId: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  step: ProcessStep;
  status: 'AWAITING_QC' | 'QC_PASSED';
  submittedAt: string;
  submittedById: string;
  segments: BeStepBundleSegment[];
}

/**
 * 1 đợt cắt Phôi đã báo (append-only - mỗi lần "Nhập đợt cắt" tạo 1 dòng mới). Từ 2026-09-05 đây
 * là ĐƠN VỊ MANG TRẠNG THÁI của công đoạn Phôi (`status`) - mỗi đợt tự đi
 * CUTTING → AWAITING_QC → QC_PASSED, KCS duyệt theo từng đợt (không còn chờ cắt hết cả lô nhận).
 */
export interface BeCutBundle {
  id: string;
  /** Lô nhận (SteelIssue) đợt này ghi vào - lô chỉ còn ISSUED/RECEIVED (việc của kho) từ khi
   *  trạng thái hạ xuống cấp đợt cắt. */
  steelIssueId: string;
  /** Kiểu cắt gợi ý mà đợt này bám theo - THUẦN THAM CHIẾU/audit, không dùng để suy ra đoạn. */
  proposalPatternId: string | null;
  isOffPlan: boolean;
  /** Luôn 0 với đợt tạo từ 2026-09-05 (bỏ ô nhập "số cây đã dùng") - chỉ còn ý nghĩa với dữ liệu CŨ. */
  barCount: number;
  /** Luôn 0 với đợt tạo từ 2026-09-05 (bỏ ô nhập "mẩu nguyên"). */
  mauNguyenMm: number;
  /** Luôn 0 với đợt tạo từ 2026-09-05 (không còn cân bằng vật chất để suy ra phế liệu). */
  scrapMm: number;
  status: CutBundleStatus;
  /** LỊCH SỬ/THAM KHẢO - từ 2026-09-07 không còn dùng để chặn "Báo cắt xong" nữa. Luôn có CAT
   *  ngay khi tạo. */
  completedSteps: ProcessStep[];
  /** Công đoạn bắt buộc theo định mức của loại sắt này - dùng để biết cần hiện bảng tổng gửi KCS
   *  cho công đoạn phụ nào (xem getStepProgress()/BeStepBundle - scope PI+vật tư, KHÔNG còn gắn
   *  với đúng đợt cắt này nữa, đổi 2026-09-07 lần 2). */
  requiredSteps: ProcessStep[];
  completedAt: string | null;
  createdAt: string;
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
  /** Σ cây cần mua/cắt theo phương án cắt sắt đã duyệt (CuttingProposalLine.totalBars, cộng dồn
   *  mọi phương án còn phủ vật tư này trong cả PI) — đơn vị "cây", khớp với số Mua hàng đã mua. 0
   *  nếu vật tư chỉ còn lịch sử đã xuất (phương án phủ nó đã bị tính lại). */
  requiredBars: number;
  /** Chiều dài cây (mm) mà phương án cắt đã chốt dùng chung cho vật tư này trong PI — null nếu
   *  không còn phương án nào hiệu lực. */
  bestStockLengthMm: number | null;
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

/** Gộp nhiều PI 1 lần — "Bảng thống kê" (ThongKePagePlan.tsx) cần tiến độ Phôi cho nhiều SKU
 *  cùng lúc, nhiều SKU có thể chung 1 PI (đợt gộp). Trả về map piId -> danh sách đợt xuất (PI
 *  không có trong danh sách trả về key rỗng []). */
export async function getSteelIssuesForInvoiceBatch(
  productionInvoiceIds: string[],
): Promise<Record<string, BeSteelIssue[]>> {
  if (productionInvoiceIds.length === 0) return {};
  return http.get<Record<string, BeSteelIssue[]>>(
    `/production-invoices/steel-issues/batch?ids=${encodeURIComponent(productionInvoiceIds.join(','))}`,
  );
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

/**
 * Xem ListSteelIssuesQueryDto tại sao endpoint này tồn tại riêng (permission Phôi/KCS không đủ
 * để tự resolve productionOrderId). Bỏ trống `status` để lấy mọi trạng thái.
 *
 * `activeOnly` (2026-08-31): chỉ trả PI có ÍT NHẤT 1 SKU đang ProductionOrder.floorStage=ACTIVE
 * (QLSX đã bấm "Bắt đầu" ở Bảng thống kê) - dùng riêng cho LenhSanXuatPhoi.tsx, KHÔNG truyền ở
 * "Xác nhận nhận sắt"/KcsPhoiPage (2 nơi đó vẫn cần thấy mọi PI như cũ, không phụ thuộc floorStage).
 */
export async function getSteelIssuesByStatus(
  status?: SteelIssueStatus,
  activeOnly?: boolean,
): Promise<BeSteelIssue[]> {
  const params = new URLSearchParams({ limit: '100' });
  if (status) params.set('status', status);
  if (activeOnly) params.set('activeOnly', 'true');
  const res = await http.get<BeSteelIssue[] | { data: BeSteelIssue[] }>(`/steel-issues?${params.toString()}`);
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

/**
 * Mọi đợt cắt của 1 PI (2026-09-05) - nguồn dữ liệu chính cho màn Phôi sau khi GỘP hiển thị theo
 * loại sắt (1 loại sắt chỉ còn 1 mục dù kho giao nhiều lần, bên trong liệt kê các đợt cắt). Bỏ
 * trống `productionInvoiceId` để KCS lấy MỌI đợt đang chờ duyệt qua `status`.
 */
export async function getAllCutBundles(
  productionInvoiceId?: string,
  status?: CutBundleStatus,
): Promise<BeCutBundle[]> {
  const params = new URLSearchParams();
  if (productionInvoiceId) params.set('productionInvoiceId', productionInvoiceId);
  if (status) params.set('status', status);
  const qs = params.toString();
  const res = await http.get<BeCutBundle[] | { data: BeCutBundle[] }>(
    `/cut-bundles${qs ? `?${qs}` : ''}`,
  );
  return unwrap(res);
}

/** "Báo cắt xong" cho ĐÚNG đợt cắt này - các đợt khác của cùng lô vẫn cắt tiếp bình thường. */
export async function finishCutBundle(bundleId: string): Promise<BeCutBundle> {
  return http.post<BeCutBundle>(`/cut-bundles/${bundleId}/finish`, {});
}

export async function receiveSteelIssue(id: string): Promise<void> {
  await http.post(`/steel-issues/${id}/receive`, {});
}

/** 1 dòng nhập đợt cắt - segments phải khớp cỡ trong định mức của PI (BE chặn cỡ lạ). Không còn
 *  bắt buộc barCount/mauNguyenMm từ 2026-09-05 (bỏ 2 ô nhập theo yêu cầu nghiệp vụ - 1 loại sắt
 *  giờ gộp nhiều lần kho giao, tách cây theo từng đợt cắt là tuỳ tiện). */
export interface RecordCutBatchInput {
  segments: { segmentSpecId: string; qty: number }[];
  /** Kiểu cắt gợi ý đợt này bám theo - THUẦN THAM CHIẾU, tuỳ chọn. */
  proposalPatternId?: string;
}

/** Nhập 1 đợt cắt (cộng dồn, KHÔNG đổi trạng thái SteelIssue). Thay `completeCutting` cũ
 *  (2026-08-22) - route đó vừa nhận số liệu (chép từ pattern) vừa chuyển sang chờ KCS trong cùng
 *  1 lần bấm; giờ tách hẳn 2 việc, xem finishCutting(). */
export async function recordCutBatch(id: string, data: RecordCutBatchInput): Promise<BeCutBundle> {
  return http.post<BeCutBundle>(`/steel-issues/${id}/cut-batches`, data);
}

/** Hoàn tác ĐÚNG lần recordCutBatch() gần nhất (2026-09-07) - gửi lại chính xác `segments` vừa
 *  submit để trừ đối xứng lại. Chỉ 1 cấp duy nhất, chỉ hoạt động khi đợt còn CUTTING. */
export async function undoLastCutBatch(
  cutBundleId: string,
  segments: { segmentSpecId: string; qty: number }[],
): Promise<void> {
  await http.post(`/cut-bundles/${cutBundleId}/undo-last-batch`, { segments });
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
  /** Σ đoạn KCS đã chấm KHÔNG ĐẠT, CỘNG DỒN LỊCH SỬ (2026-09-07 lần 2 - không tự giảm, bỏ hẳn cơ
   *  chế report-done/recheck). "Còn lại" tự tính = required - (done - failed), KHÔNG lấy thẳng từ
   *  BE - tự đúng khi Phôi làm thêm rồi gửi KCS như đợt mới (done tăng), KHÔNG cần "failed" giảm. */
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
 *  không có barCount/mauNguyenMm (bước này không tác động lên cây sắt). BE chặn vượt TỔNG đã cắt
 *  CẢ PI cho loại sắt này (2026-09-07 lần 2 - đổi scope từ CutBundle sang PI+vật tư, Phôi làm các
 *  công đoạn song song không cần biết đúng đợt cắt nào). */
export interface RecordStepBatchInput {
  materialId: string
  step: ProcessStep
  segments: { segmentSpecId: string; qty: number }[]
}

export interface BeStepBatch {
  id: string
  step: ProcessStep
  segments: { segmentSpecId: string; cutLengthMm: number; qty: number }[]
}

/** Nhập 1 đợt "đã gia công" cho công đoạn chi tiết CỦA CẢ PI + loại sắt (cộng dồn, KHÔNG tự gửi
 *  KCS - xem submitStepBundle() để gửi). Route `/production-invoices/:id/step-batches`
 *  (2026-09-07 lần 2, đổi từ `/cut-bundles/:id/step-batches`). */
export async function recordStepBatch(productionInvoiceId: string, data: RecordStepBatchInput): Promise<BeStepBatch> {
  return http.post<BeStepBatch>(`/production-invoices/${productionInvoiceId}/step-batches`, data);
}

/** Gom mọi StepBatch CHƯA gửi (của 1 công đoạn phụ, CẢ PI + loại sắt) thành 1 "đợt gửi KCS" mới -
 *  mirror finishCutBundle() nhưng cho công đoạn phụ. Lỗi nếu chưa có gì mới để gửi. Route
 *  `/production-invoices/:id/step-bundles` (2026-09-07 lần 2). */
export async function submitStepBundle(
  productionInvoiceId: string,
  materialId: string,
  step: ProcessStep,
): Promise<BeStepBundle> {
  return http.post<BeStepBundle>(`/production-invoices/${productionInvoiceId}/step-bundles`, {
    materialId,
    step,
  });
}

/** Lịch sử mọi StepBundle của 1 PI (mọi loại sắt/công đoạn) - màn Phôi xem THUẦN, không thao tác
 *  được (2026-09-07 lần 2, mọi thao tác dồn về bảng tổng - xem getStepProgress()). */
export async function getStepBundlesForInvoice(productionInvoiceId: string): Promise<BeStepBundle[]> {
  return http.get<BeStepBundle[]>(`/production-invoices/${productionInvoiceId}/step-bundles`);
}

/** Flat, không cần productionInvoiceId - màn KCS lấy thẳng AWAITING_QC, cùng lý do
 *  getSteelIssuesByStatus()/getAllCutBundles() tồn tại riêng. */
export async function getAllStepBundles(status?: 'AWAITING_QC' | 'QC_PASSED'): Promise<BeStepBundle[]> {
  const params = new URLSearchParams({ limit: '100' });
  if (status) params.set('status', status);
  const res = await http.get<BeStepBundle[] | { data: BeStepBundle[] }>(`/step-bundles?${params.toString()}`);
  return unwrap(res);
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
 *  "sửa được" nữa. failedQty BẤT BIẾN (số KCS chấm lần đầu, không sửa sau khi tạo). "Lỗi" hiển
 *  thị ở bảng tổng (BePhoiProgressItem.segments[].failed) là Σ failedQty CỘNG DỒN LỊCH SỬ của mọi
 *  lần chấm (2026-09-07 lần 2, bỏ hẳn resolvedQty/phoiReportedAt/report-done+recheck - xem
 *  changelog "Bù đủ dồn về bảng tổng") - không tự giảm, Phôi bù bằng cách làm thêm rồi gửi KCS
 *  như 1 đợt HOÀN TOÀN MỚI, "Còn lại" tự đúng vì cộng thêm "Đã làm". */
export interface BeQcReviewSegment {
  segmentSpecId: string;
  cutLengthMm: number;
  failedQty: number;
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

/** KCS chấm 1 ĐỢT CẮT (2026-09-05) - thay reviewSteelIssueQc() ở luồng mới, cùng khuôn tham số. */
export async function reviewCutBundleQc(
  cutBundleId: string,
  data: {
    segments: { segmentSpecId: string; failedQty: number }[];
    reason?: string;
    defectReasonId?: string;
    photoUrl?: string;
  },
): Promise<void> {
  await http.post(`/cut-bundles/${cutBundleId}/qc-review`, data);
}

/** KCS chấm 1 "đợt gửi KCS" công đoạn PHỤ (2026-09-07) - cùng khuôn tham số reviewCutBundleQc,
 *  CHỈ Đạt/Không đạt (không có "phế/sửa được" - mirror hành vi gốc của Sắt). */
export async function reviewStepBundleQc(
  stepBundleId: string,
  data: {
    segments: { segmentSpecId: string; failedQty: number }[];
    reason?: string;
    defectReasonId?: string;
    photoUrl?: string;
  },
): Promise<void> {
  await http.post(`/step-bundles/${stepBundleId}/qc-review`, data);
}

/** 1 dòng qc_reviews (nhánh Phôi - steelIssueId != null HOẶC stepBundleId != null) — dùng để
 *  dựng lại "đạt bao nhiêu / lỗi bao nhiêu" cho các đợt QC_PASSED (2026-09-07 lần 2: StepBundle
 *  review không còn kèm steelIssueId nữa, xem BeStepBundle). Fetch 1 lần, lọc client — danh sách
 *  chưa lớn, cùng idiom "fetch hết rồi lọc client" đã dùng ở resolveProductionOrderId(). */
export interface BeQcReview {
  id: string;
  steelIssueId: string | null;
  productionBatchId: string | null;
  /** Đợt cắt được chấm (2026-09-05) - null với review CŨ (chấm cả lô) hoặc nhánh Hàn/Sơn. */
  cutBundleId: string | null;
  /** Đợt gửi KCS công đoạn PHỤ được chấm (2026-09-07) - null với mọi nhánh khác. */
  stepBundleId: string | null;
  /** Tổng dẫn xuất từ segments[] (nhánh Phôi) - nhánh Hàn/Sơn là số gốc, segments luôn rỗng. BẤT
   *  BIẾN mọi nhánh - số lịch sử cộng dồn (2026-09-08 lần 2, xem changelog "Bù đủ dồn về bảng
   *  tổng") - không còn scrapQty/resolvedQty/phoiReportedAt/phoiReportedQty ở đâu cả. */
  failedQty: number;
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
  return unwrap(res).filter((r) => r.steelIssueId != null || r.stepBundleId != null);
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
