/**
 * Adapter GỢI Ý GỘP ĐỢT CẮT: FE ⇄ BE thật (GET /cutting-batch-suggestions).
 *
 * Chỉ đọc - endpoint không ghi gì, không gọi solver, không đụng tồn kho. Tính lại mỗi lần gọi
 * (BE cố ý không cache) nên luôn phản ánh đúng các đơn Sales vừa tạo.
 */
import { http } from './core/http';

/** Trạng thái duyệt sản xuất của SKU. null = Sales vừa tạo, KHSX chưa gửi QLSX. */
export type ProdApprovalStatus = 'WAITING_QLSX' | 'WAITING_BOSS' | 'APPROVED' | 'REJECTED';

export type CuttingBatchOutcome = 'FIXED_BY_MERGE' | 'UNFIXABLE_BY_MERGE';

export interface CuttingBatchOrder {
  productionInvoiceItemId: string;
  /** Mã đơn hàng khách (vd "PO-4") - đây là mã người dùng gọi là "PO". */
  salesOrderCode: string | null;
  productionInvoiceCode: string;
  mfgProductCode: string;
  mfgProductName: string | null;
  quantity: number;
  prodApprovalStatus: ProdApprovalStatus | null;
  deadline: string | null;
}

export interface CuttingBatchLevel {
  orderCount: number;
  orderLabels: string[];
  cutSizesMm: number[];
  stockLengthMm: number;
  /** GIỚI HẠN DƯỚI - hiển thị PHẢI kèm dấu "≥", không bao giờ trình bày như số sẽ đạt được. */
  minWastePct: number;
  minWastePerBarMm: number;
  /** Số cây khi cắt CHUNG cả nhóm. */
  minBars: number;
  /** Số cây nếu cắt RIÊNG từng đơn rồi cộng lại. */
  barsSeparate: number;
  /** barsSeparate − minBars. CÓ THỂ = 0 dù % giảm mạnh (số lượng nhỏ chưa đủ bớt trọn 1 cây). */
  barsSavedVsSeparate: number;
  /** Đơn hạn xa nhất phải cắt sớm bao nhiêu ngày. null = chỉ 1 đơn hoặc thiếu dữ liệu hạn. */
  daysCutEarly: number | null;
  meetsThreshold: boolean;
}

export interface CuttingBatchSuggestion {
  materialId: string;
  materialCode: string;
  materialName: string;
  thresholdPct: number;
  outcome: CuttingBatchOutcome;
  anchor: CuttingBatchOrder;
  orders: CuttingBatchOrder[];
  levels: CuttingBatchLevel[];
}

export async function getCuttingBatchSuggestions(): Promise<CuttingBatchSuggestion[]> {
  const res = await http.get<CuttingBatchSuggestion[] | { data: CuttingBatchSuggestion[] }>(
    '/cutting-batch-suggestions',
  );
  return Array.isArray(res) ? res : res.data;
}

// ── Bảng chọn của KHSX ────────────────────────────────────────────────────────

export interface CandidateMaterial {
  materialId: string;
  materialCode: string;
  materialName: string;
  /** Hao hụt khi SKU này cắt loại sắt đó MỘT MÌNH. Hiển thị kèm dấu "≥". */
  standaloneWastePct: number;
  thresholdPct: number;
  overThreshold: boolean;
  /** Mã SKU của các đơn KHÁC cũng dùng loại sắt này = danh sách "gộp được với ai". */
  mergeableWithSkus: string[];
}

export interface CuttingBatchCandidate {
  productionInvoiceItemId: string;
  mfgProductCode: string;
  mfgProductName: string | null;
  quantity: number;
  salesOrderCode: string | null;
  productionInvoiceCode: string;
  deadline: string | null;
  prodApprovalStatus: ProdApprovalStatus | null;
  /** Lý do bị từ chối lần gần nhất - SKU quay lại bảng này sau khi Sếp bác một đợt gộp. */
  rejectReason: string | null;
  materials: CandidateMaterial[];
  /** false = sản phẩm chưa có định mức ACTIVE nên không tính được gì cho SKU này. */
  hasActiveBom: boolean;
}

export interface CuttingBatchCandidateList {
  items: CuttingBatchCandidate[];
  /** Tổ hợp hệ thống tự đề xuất - tick sẵn, KHSX vẫn sửa được. */
  recommendedItemIds: string[];
}

export interface CuttingBatchPreviewLine {
  materialId: string;
  materialCode: string;
  materialName: string;
  thresholdPct: number;
  contributingSkus: string[];
  cutSizesMm: number[];
  minWastePct: number;
  minBars: number;
  barsSeparate: number;
  barsSavedVsSeparate: number;
  meetsThreshold: boolean;
  daysCutEarly: number | null;
}

export interface CuttingBatchPreview {
  lines: CuttingBatchPreviewLine[];
  /** Tổng số cây bớt được trên MỌI loại sắt - con số trả lời "gộp có đáng không". */
  totalBarsSaved: number;
  daysCutEarly: number | null;
}

export async function getCuttingBatchCandidates(): Promise<CuttingBatchCandidateList> {
  return http.get<CuttingBatchCandidateList>('/cutting-batch-candidates');
}

/** Tính thử theo tổ hợp đang tick. POST vì danh sách id có thể dài - vẫn là thao tác CHỈ ĐỌC. */
export async function previewCuttingBatch(
  productionInvoiceItemIds: string[],
): Promise<CuttingBatchPreview> {
  return http.post<CuttingBatchPreview>('/cutting-batch-preview', { productionInvoiceItemIds });
}

/**
 * CHỐT nhóm: gộp các SKU đã tick thành 1 lệnh sản xuất (PI) để cắt chung một đợt. Khác 2 hàm trên
 * - đây là thao tác GHI: tạo PI mới và chuyển các SKU sang đó.
 *
 * KHÔNG chạy solver ở bước này. Phương án cắt chỉ tính khi Sếp duyệt cả cụm, đúng luồng duyệt sẵn
 * có (yêu cầu Sếp 2026-08-14) - gộp xong PI đi tiếp qua màn "Lệnh sản xuất mới" như bình thường.
 */
export async function mergeCuttingBatch(
  productionInvoiceItemIds: string[],
): Promise<{ id: string; code: string }> {
  return http.post<{ id: string; code: string }>('/production-invoices/merge', {
    productionInvoiceItemIds,
  });
}
