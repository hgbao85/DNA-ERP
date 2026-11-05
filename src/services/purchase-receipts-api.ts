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
  status: 'RECEIVED' | 'REJECTED';
  receivedQty: number;
  allocation: ReceiptAllocationLine[];
  allocationAdjusted: boolean;
}

export interface CreatePurchaseReceiptInput {
  itemIds: string[];
  unitRateQty: number;
  supplierUnitQty?: number;
  deliveredQty: number;
  supplierSlipUrls: string[];
  approvalFileUrls?: string[];
  receiptSlipUrls: string[];
  weighSlipUrls?: string[];
  allocation?: { itemId: string; qty: number }[];
}

export interface RejectPurchaseReceiptInput {
  itemIds: string[];
  deliveredQty: number;
  reason: string;
  fileUrls: string[];
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
