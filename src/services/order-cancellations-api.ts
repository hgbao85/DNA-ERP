/**
 * Huỷ lệnh theo SKU - đợt 1 (23/11/2026, anh Nhân trả lời 7 câu): KHSX đề nghị huỷ 1 SKU (1 lệnh sản xuất) kèm lý do, Sếp duyệt mới
 * huỷ. BE `/production-order-cancellations` (src/modules/production-invoices/order-cancellation). Kiểu dưới CHÉP theo
 * OrderCancelRequestDto bên BE.
 */
import { http } from './core/http';

export type OrderCancelStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';

export interface OrderCancelRequestDto {
  id: string;
  productionOrderId: string;
  poNumber: string;
  productionInvoiceId: string | null;
  /** Mã PI - chỉ dùng tra cứu, KHÔNG hiện (hiện số LSX / mã lệnh). */
  productionInvoiceCode: string | null;
  productionInvoiceItemId: string;
  lsxCode: string | null;
  /** Mã lệnh để hiện (BE tính: số LSX, số đã chuyển sang dòng mới, hoặc mã lệnh). */
  lenhCode: string;
  factoryCode: string;
  quantity: number;
  status: OrderCancelStatus;
  reason: string;
  requestedById: string;
  requestedByName: string;
  requestedAt: string;
  decidedById: string | null;
  decidedByName: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  /** Dòng SKU mới cấp cho dòng đơn sau khi huỷ (để KHSX lên lệnh lại). */
  replacementItemId: string | null;
}

export async function getOrderCancelRequests(
  q: { status?: OrderCancelStatus; productionInvoiceId?: string; productionOrderId?: string } = {},
): Promise<OrderCancelRequestDto[]> {
  return http.get<OrderCancelRequestDto[]>('/production-order-cancellations', { params: q });
}

/** KHSX (hoặc Admin) đề nghị huỷ 1 SKU. */
export async function requestOrderCancel(productionOrderId: string, reason: string): Promise<OrderCancelRequestDto> {
  return http.post<OrderCancelRequestDto>('/production-order-cancellations', { productionOrderId, reason });
}

/** Người đề nghị rút lại khi Sếp chưa quyết. */
export async function withdrawOrderCancel(requestId: string): Promise<OrderCancelRequestDto> {
  return http.post<OrderCancelRequestDto>(`/production-order-cancellations/${requestId}/withdraw`);
}

/** Sếp duyệt (approve=true) hoặc từ chối (approve=false, bắt buộc ghi lý do vào note). */
export async function decideOrderCancel(
  requestId: string,
  input: { approve: boolean; note?: string },
): Promise<OrderCancelRequestDto> {
  return http.post<OrderCancelRequestDto>(`/production-order-cancellations/${requestId}/decide`, input);
}
