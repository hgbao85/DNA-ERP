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
  patterns: CuttingProposalPattern[];
}

export interface CuttingProposal {
  id: string;
  productionOrderId: string;
  /** Mã nội bộ (ProductionOrder.poNumber) - chỉ hệ thống dùng, KHÔNG hiển thị. Dùng `salesOrderCode`. */
  poNumber: string;
  /** Mã đơn hàng Sales gốc - đây mới là mã "PO" hiển thị cho người dùng. */
  salesOrderCode: string | null;
  mfgProductCode: string;
  mfgProductName: string | null;
  status: CuttingProposalStatus;
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

/** Nút "Tính lại" - gọi lại theo productionOrderId (không phải cuttingProposalId). */
export async function retryCuttingProposal(productionOrderId: string): Promise<CuttingProposal> {
  return http.post<CuttingProposal>(
    `/production-orders/${productionOrderId}/cutting-proposals`,
    undefined,
    withIdempotencyKey(),
  );
}

