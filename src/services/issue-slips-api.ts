/**
 * Phiếu xuất kho XK (Đợt 6, 2026-11-06 - BE IssueSlipsService, bản v8 YC4): 1 phiếu = 1 kho, nhiều dòng (sắt theo lệnh, vật tư
 * tiêu hao theo SKU, dòng "Dùng chung"). 2 bước: tạo phiếu (cấp số, chưa trừ tồn) -> in, người nhận ký -> tải ảnh phiếu đã ký và
 * "Xác nhận xuất" (lúc đó mới trừ tồn mọi dòng). Thay route xuất từng dòng cũ (đã gỡ).
 */
import { http } from './core/http';

export type IssueSlipLineKind = 'STEEL' | 'CONSUMABLE' | 'SHARED';
export type IssueSlipStatus = 'DRAFT' | 'ISSUED' | 'CANCELLED';

export interface IssueSlipLineInput {
  kind: IssueSlipLineKind;
  materialId: string;
  productionInvoiceId?: string;
  productionOrderId?: string;
  stage?: 'HAN' | 'SON';
  barLengthMm?: number;
  qty: number;
  note?: string;
}

export interface IssueSlipLine {
  id: string;
  kind: IssueSlipLineKind;
  materialId: string;
  materialCode: string;
  materialName: string;
  unit: string;
  productionInvoiceId: string | null;
  productionOrderId: string | null;
  lenhCode: string | null;
  sku: string | null;
  stage: 'HAN' | 'SON' | null;
  barLengthMm: number | null;
  qty: number;
  note: string | null;
}

export interface IssueSlip {
  id: string;
  /** XK-yymmdd-NNN */
  code: string;
  status: IssueSlipStatus;
  warehouseCode: string;
  warehouseName: string;
  recipientName: string | null;
  note: string | null;
  signedSlipUrls: string[];
  createdByName: string | null;
  createdAt: string;
  issuedByName: string | null;
  issuedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  lines: IssueSlipLine[];
}

export function getIssueSlips(status?: IssueSlipStatus): Promise<IssueSlip[]> {
  return http.get<IssueSlip[]>(`/issue-slips${status ? `?status=${status}` : ''}`);
}

export function createIssueSlip(input: {
  lines: IssueSlipLineInput[];
  recipientName?: string;
  note?: string;
}): Promise<IssueSlip> {
  return http.post<IssueSlip>('/issue-slips', input);
}

/** `idempotencyKey` giữ nguyên giữa các lần bấm lại của CÙNG 1 lần xác nhận - mạng chập chờn không xuất 2 lần. */
export function confirmIssueSlip(id: string, signedSlipUrls: string[], idempotencyKey: string): Promise<IssueSlip> {
  return http.post<IssueSlip>(`/issue-slips/${id}/confirm`, { signedSlipUrls }, { headers: { 'Idempotency-Key': idempotencyKey } });
}

export function cancelIssueSlip(id: string, reason: string): Promise<IssueSlip> {
  return http.post<IssueSlip>(`/issue-slips/${id}/cancel`, { reason });
}
