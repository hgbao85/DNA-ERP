/**
 * Adapter CẮT SẮT (Phase 7): FE ⇄ BE thật (module `cutting-proposals`).
 *
 * Chưa có màn hình nghiệp vụ riêng nào dùng module này (Phôi/QLSX chưa có UI) - adapter này
 * hiện chỉ phục vụ màn Admin "Cắt sắt" (business-data), nơi tạm đặt nút "Tính lại" (chỉ dùng
 * khi tính lỗi/không khả thi) cho tới khi Phase 7 có màn nghiệp vụ chính thức. Duyệt phương án
 * cắt vẫn chỉ làm qua API (POST /cutting-proposals/:id/approve), chưa có UI.
 */
import { http } from './core/http';

export type CuttingProposalStatus = 'CALCULATING' | 'DRAFT' | 'FAILED' | 'APPROVED' | 'SUPERSEDED';

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
}

export interface CuttingProposal {
  id: string;
  productionOrderId: string;
  poNumber: string;
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

/** Nút "Tính lại" - gọi lại theo productionOrderId (không phải cuttingProposalId). */
export async function retryCuttingProposal(productionOrderId: string): Promise<CuttingProposal> {
  return http.post<CuttingProposal>(
    `/production-orders/${productionOrderId}/cutting-proposals`,
    undefined,
    { headers: { 'Idempotency-Key': crypto.randomUUID() } },
  );
}

