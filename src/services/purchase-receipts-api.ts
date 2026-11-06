/**
 * Nhận hàng mua theo phiếu (Đợt 5d, 2026-11-05 - BE PurchaseReceiptsService): đơn gộp nhiều lệnh nhập 1 lần, hệ thống tự
 * chia cho các lệnh (YC8), chứng từ bắt buộc ngay lúc nhập (YC4), "Từ chối nhận" (4.5). Thay route nhận từng dòng cũ.
 */
import { http } from './core/http';

export interface ReceiptAllocationLine {
  itemId: string;
  proposalId: string;
  lenhCode: string;
  deadline: string | null;
  buyQty: number;
  purchaseQty: number;
  receivedQty: number;
  /** Phần chia của lần nhận này. */
  qty: number;
}

export interface PurchaseReceiptResult {
  id: string;
  /** Số phiếu nhập NK-yymmdd-NNN (Đợt 6). */
  code: string | null;
  status: 'RECEIVED' | 'REJECTED';
  receivedQty: number;
  /** Phần vượt số còn lại của đơn (Đợt 5e, 4.12). */
  overQty: number;
  allocation: ReceiptAllocationLine[];
  allocationAdjusted: boolean;
}

export interface CreatePurchaseReceiptInput {
  /** Số phiếu nhập NK đã giữ lúc in (Đợt 6). */
  slipCode: string;
  itemIds: string[];
  unitRateQty: number;
  supplierUnitQty?: number;
  deliveredQty: number;
  supplierSlipUrls: string[];
  approvalFileUrls?: string[];
  receiptSlipUrls: string[];
  weighSlipUrls?: string[];
  allocation?: { itemId: string; qty: number }[];
  /** Bắt buộc khi nhận vượt số còn lại của đơn (4.12). */
  overReason?: string;
  overFileUrls?: string[];
}

export interface RejectPurchaseReceiptInput {
  itemIds: string[];
  deliveredQty: number;
  reason: string;
  fileUrls: string[];
}

/** "In phiếu nhập" (Đợt 6): giữ 1 số NK-yymmdd-NNN; `reuse` = số đã giữ trước đó của chính mình (in lại thì giữ số cũ). */
export function reserveReceiptSlipCode(reuse?: string): Promise<{ code: string }> {
  return http.post<{ code: string }>('/purchase-receipts/slip-code', { reuse });
}

export function previewPurchaseReceipt(itemIds: string[], qty: number): Promise<ReceiptAllocationLine[]> {
  return http.post<ReceiptAllocationLine[]>('/purchase-receipts/preview', { itemIds, qty });
}

/** `idempotencyKey` giữ nguyên giữa các lần bấm lại của CÙNG 1 lần nhận - lỡ mạng chập chờn mà BE đã ghi thì lần bấm
 *  lại trả đúng phiếu cũ, không nhập kho 2 lần. */
export function createPurchaseReceipt(
  input: CreatePurchaseReceiptInput,
  idempotencyKey: string,
): Promise<PurchaseReceiptResult> {
  return http.post<PurchaseReceiptResult>('/purchase-receipts', input, { headers: { 'Idempotency-Key': idempotencyKey } });
}

export function rejectPurchaseReceipt(
  input: RejectPurchaseReceiptInput,
  idempotencyKey: string,
): Promise<PurchaseReceiptResult> {
  return http.post<PurchaseReceiptResult>('/purchase-receipts/reject', input, { headers: { 'Idempotency-Key': idempotencyKey } });
}

export interface OverReceiptRow {
  id: string;
  createdAt: string;
  supplierName: string;
  orderCode: string | null;
  materialCode: string;
  materialName: string;
  unit: string;
  receivedQty: number;
  overQty: number;
  overReason: string;
  overFileUrls: string[];
  createdByName: string;
}

export interface OverReceiptStats {
  from: string;
  to: string;
  items: OverReceiptRow[];
  bySupplier: { name: string; count: number }[];
  byMaterial: { code: string; name: string; unit: string; count: number; overQty: number }[];
  byUser: { name: string; count: number }[];
}

/** Thống kê nhận vượt (Đợt 5e, 4.12) - ngày theo giờ VN, dạng YYYY-MM-DD; bỏ trống = 30 ngày gần nhất. */
export function getOverReceiptStats(from?: string, to?: string): Promise<OverReceiptStats> {
  const q = new URLSearchParams();
  if (from) q.set('from', from);
  if (to) q.set('to', to);
  const qs = q.toString();
  return http.get<OverReceiptStats>(`/purchase-receipts/over-stats${qs ? `?${qs}` : ''}`);
}
