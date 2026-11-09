/**
 * Phiếu xuất kho XK (Đợt 6, 2026-11-06 - BE IssueSlipsService, bản v8 YC4): 1 phiếu = 1 kho, nhiều dòng (sắt theo lệnh, vật tư
 * tiêu hao theo SKU, dòng "Dùng chung"). 2 bước: tạo phiếu (cấp số, chưa trừ tồn) -> in, người nhận ký -> tải ảnh phiếu đã ký và
 * "Xác nhận xuất" (lúc đó mới trừ tồn mọi dòng). Thay route xuất từng dòng cũ (đã gỡ).
 */
import { http } from './core/http';

/** WEAVING_PIECE / WEAVING_MATERIAL: 2 phiếu xuất đan (anh Nhân 09/11/2026) - mảnh từ kho Sơn, dây/gỗ/đinh/nút từ kho Phụ kiện. */
export type IssueSlipLineKind = 'STEEL' | 'CONSUMABLE' | 'SHARED' | 'WEAVING_PIECE' | 'WEAVING_MATERIAL';
export type IssueSlipStatus = 'DRAFT' | 'ISSUED' | 'CANCELLED';

export interface IssueSlipLineInput {
  kind: IssueSlipLineKind;
  /** Không có ở dòng mảnh (WEAVING_PIECE). */
  materialId?: string;
  pieceId?: string;
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
  materialId: string | null;
  /** Dòng mảnh: mã/tên mảnh. */
  materialCode: string;
  materialName: string;
  pieceId: string | null;
  /** Dòng vật tư kèm đan: mảnh mà vật tư đi kèm. */
  pieceName: string | null;
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
  /** Phiếu xuất đan: điểm đan nhận. */
  weavingPointId: string | null;
  weavingPointName: string | null;
  /** Phiếu vật tư kèm -> phiếu mảnh cùng chuyến. */
  pairedSlipId: string | null;
  pairedSlipCode: string | null;
  lines: IssueSlipLine[];
}

export function getIssueSlips(status?: IssueSlipStatus): Promise<IssueSlip[]> {
  return http.get<IssueSlip[]>(`/issue-slips${status ? `?status=${status}` : ''}`);
}

export function createIssueSlip(input: {
  lines: IssueSlipLineInput[];
  recipientName?: string;
  note?: string;
  /** Phiếu mảnh xuất đan. */
  weavingPointId?: string;
  /** Phiếu vật tư kèm đan: phiếu mảnh cùng chuyến. */
  pairedSlipId?: string;
}): Promise<IssueSlip> {
  return http.post<IssueSlip>('/issue-slips', input);
}

/** `idempotencyKey` giữ nguyên giữa các lần bấm lại của CÙNG 1 lần xác nhận - mạng chập chờn không xuất 2 lần. */
export function confirmIssueSlip(id: string, signedSlipUrls: string[], idempotencyKey: string): Promise<IssueSlip> {
  return http.post<IssueSlip>(`/issue-slips/${id}/confirm`, { signedSlipUrls }, { headers: { 'Idempotency-Key': idempotencyKey } });
}

export interface WeavingMaterialDemandLine {
  productionOrderId: string;
  lenhCode: string | null;
  sku: string | null;
  pieceId: string;
  pieceCode: string;
  pieceName: string;
  pieceQty: number;
  materialId: string;
  materialCode: string;
  materialName: string;
  unit: string;
  warehouseCode: string | null;
  qtyPerPiece: number;
  demandQty: number;
  /** Đã nằm trên phiếu vật tư kèm (chờ ký hoặc đã xuất) của chuyến này. */
  coveredQty: number;
  remainingQty: number;
  onHandQty: number;
}

/** 1 phiếu mảnh xuất đan còn thiếu vật tư kèm. */
export interface WeavingMaterialDemand {
  slipId: string;
  slipCode: string;
  slipStatus: IssueSlipStatus;
  warehouseName: string;
  weavingPointId: string | null;
  weavingPointName: string | null;
  createdAt: string;
  pairedSlipCodes: string[];
  lines: WeavingMaterialDemandLine[];
}

/** Vật tư cần cấp kèm đan (kho Phụ kiện) - chỉ vật tư thuộc kho của tài khoản. */
export function getWeavingMaterialDemand(): Promise<WeavingMaterialDemand[]> {
  return http.get<WeavingMaterialDemand[]>('/issue-slips/weaving-material-demand');
}

export function cancelIssueSlip(id: string, reason: string): Promise<IssueSlip> {
  return http.post<IssueSlip>(`/issue-slips/${id}/cancel`, { reason });
}
