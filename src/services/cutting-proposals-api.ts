/**
 * Adapter CẮT SẮT (Phase 7): FE ⇄ BE thật (module `cutting-proposals`).
 *
 * Chưa có màn hình nghiệp vụ riêng nào dùng module này (Phôi/QLSX chưa có UI) - adapter này
 * hiện chỉ phục vụ màn Admin "Cắt sắt" (business-data), nơi tạm đặt nút "Tính lại" (chỉ dùng
 * khi tính lỗi/không khả thi) cho tới khi Phase 7 có màn nghiệp vụ chính thức. Duyệt phương án
 * cắt vẫn chỉ làm qua API (POST /cutting-proposals/:id/approve), chưa có UI.
 */
import { http, withIdempotencyKey } from './core/http';

export type CuttingProposalStatus = 'CALCULATING' | 'DRAFT' | 'FAILED' | 'APPROVED' | 'SUPERSEDED';

/** Trạng thái RÚT GỌN cho hiển thị (2026-08-19) - dùng field này để quyết định chip/màu, KHÔNG
 *  dùng `status` trực tiếp (5 giá trị DB không map 1-1 ra 3 chip). Xem BE
 *  CuttingProposalDisplayStatus cho định nghĩa từng nhánh (bao gồm chống nháy trạng thái khi vừa
 *  tính xong đang chờ tự-duyệt, và chống treo CALCULATING quá lâu). */
export type CuttingProposalDisplayStatus = 'CALCULATING' | 'OK' | 'NEEDS_ACTION' | 'SUPERSEDED';

export interface CuttingProposalSegment {
  segmentSpecId: string;
  cutLengthMm: number;
  countPerBar: number;
}

export interface CuttingProposalPattern {
  id: string;
  patternIndex: number;
  barCount: number;
  wastePerBarMm: number | null;
  /** > 0 nghĩa là cây thuộc pattern này cắt dở - phần còn lại để nguyên, nhập kho. */
  mauNguyenMm: number | null;
  segments: CuttingProposalSegment[];
}

export interface CuttingProposalLine {
  materialId: string;
  materialCode: string;
  materialName: string;
  unit: string;
  feasible: boolean;
  bestStockLengthMm: number | null;
  totalBars: number | null;
  totalWasteMm: number | null;
  wastePercentage: number | null;
  mauNguyenMm: number | null;
  lengthComparison: { length: number; bars: number; wastePct: number }[] | null;
  /** Lý do KHÔNG cắt được, NGUYÊN VĂN từ solver - null khi feasible=true. Ưu tiên hiển thị
   *  `displayReason` (đã dựng sẵn tiếng Việt) thay vì tự ghép field này. */
  reason: string | null;
  bestAchievable: { length: number; waste_pct: number; bars: number } | null;
  timedOut: boolean | null;
  maxWastePctThreshold: number | null;
  overThreshold: boolean | null;
  /** Câu tiếng Việt ĐÃ DỰNG SẴN cho dòng này - null khi dòng không cần xử lý gì. */
  displayReason: string | null;
  patterns: CuttingProposalPattern[];
}

export interface CuttingProposal {
  id: string;
  /** null với phương án neo vào PI gộp (productionInvoiceId có giá trị thay vào đó) - xem
   *  productionInvoiceId bên dưới. */
  productionOrderId: string | null;
  productionInvoiceId: string | null;
  /** Mã nội bộ (ProductionOrder.poNumber) - chỉ hệ thống dùng, KHÔNG hiển thị. Dùng `salesOrderCode`. */
  poNumber: string;
  /** Mã đơn hàng Sales gốc - đây mới là mã "PO" hiển thị cho người dùng. */
  salesOrderCode: string | null;
  mfgProductCode: string;
  mfgProductName: string | null;
  status: CuttingProposalStatus;
  displayStatus: CuttingProposalDisplayStatus;
  /** Câu tiếng Việt ngắn gọn giải thích displayStatus=NEEDS_ACTION (list-level, không đầy đủ bằng
   *  lines[].displayReason - chỉ có khi gọi getCuttingProposal() chi tiết). null ở trạng thái khác. */
  displayReason: string | null;
  totalBarsAll: number | null;
  totalWasteMm: number | null;
  wastePercentage: number | null;
  errorMessage: string | null;
  requestedAt: string;
  completedAt: string | null;
  approvedAt: string | null;
  lines?: CuttingProposalLine[];
}

export async function getCuttingProposals(): Promise<CuttingProposal[]> {
  const res = await http.get<CuttingProposal[] | { data: CuttingProposal[] }>(
    '/cutting-proposals?limit=100',
  );
  return Array.isArray(res) ? res : res.data;
}

export async function getCuttingProposal(id: string): Promise<CuttingProposal> {
  return http.get<CuttingProposal>(`/cutting-proposals/${id}`);
}

/** Mọi phương án cắt (mọi trạng thái) đã tính cho 1 PO — dùng để tìm bản APPROVED mới nhất khi
 *  Phôi cần tra đúng pattern đã duyệt lúc báo cắt xong (xem steel-issues-api.ts). */
export async function getCuttingProposalsForOrder(productionOrderId: string): Promise<CuttingProposal[]> {
  const res = await http.get<CuttingProposal[] | { data: CuttingProposal[] }>(
    `/production-orders/${productionOrderId}/cutting-proposals?limit=100`,
  );
  return Array.isArray(res) ? res : res.data;
}

/** Nút "Tính lại" cho phương án neo VÀO 1 LỆNH SX riêng - gọi theo productionOrderId (không phải
 *  cuttingProposalId). Với phương án neo PI GỘP (productionOrderId=null), dùng
 *  `retryCuttingProposalForInvoice` bên dưới - route BE khác hẳn (trước 2026-08-19 không tồn
 *  tại, gọi nhầm hàm này với id null luôn lỗi). */
export async function retryCuttingProposal(productionOrderId: string): Promise<CuttingProposal> {
  return http.post<CuttingProposal>(
    `/production-orders/${productionOrderId}/cutting-proposals`,
    undefined,
    withIdempotencyKey(),
  );
}

/** Nút "Tính lại" cho phương án neo vào PI GỘP (isMerged) - dùng productionInvoiceId. */
export async function retryCuttingProposalForInvoice(
  productionInvoiceId: string,
): Promise<CuttingProposal> {
  return http.post<CuttingProposal>(
    `/production-invoices/${productionInvoiceId}/cutting-proposals`,
    undefined,
    withIdempotencyKey(),
  );
}
