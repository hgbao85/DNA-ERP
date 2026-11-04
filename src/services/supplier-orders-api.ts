/**
 * Adapter ĐƠN ĐẶT HÀNG NCC (2026-11-04, bản v8 mục 4.10, 4.13) - module BE `supplier-orders`.
 * Người mua gom các dòng chờ duyệt vào 1 đơn (bắt buộc chọn NCC), hệ thống cấp "Số đơn đặt hàng"
 * theo NCC + năm (vd 52/2026); "Sếp đã duyệt" làm theo từng đơn, 1 phiếu ký cho 1 đơn.
 */
import { http } from './core/http';

export type SupplierOrderStatus = 'DRAFT' | 'APPROVED' | 'CANCELLED';

export interface SupplierOrderItem {
  id: string;
  proposalId: string;
  materialCode: string;
  materialName: string;
  unit: string;
  buyQty: number;
  purchaseQty: number;
  status: string;
}

export interface SupplierOrder {
  id: string;
  /** "52/2026" */
  code: string;
  year: number;
  seq: number;
  status: SupplierOrderStatus;
  supplierId: string;
  supplierName: string;
  createdById: string;
  createdByName: string | null;
  createdAt: string;
  approvalFileUrl: string | null;
  approvedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  items: SupplierOrderItem[];
}

export interface SupplierOrderCounter {
  supplierId: string;
  supplierName: string;
  year: number;
  /** Số đơn cuối cùng (đã nạp hoặc đã cấp) - đơn tiếp theo = lastSeq + 1. */
  lastSeq: number;
  /** Số lớn nhất hệ thống đã thực sự cấp - không nạp được số nhỏ hơn. */
  maxIssuedSeq: number;
}

export function createSupplierOrder(supplierId: string, itemIds: string[]): Promise<SupplierOrder> {
  return http.post<SupplierOrder>('/supplier-orders', { supplierId, itemIds });
}

export function approveSupplierOrder(id: string, approvalFileUrl: string): Promise<SupplierOrder> {
  return http.post<SupplierOrder>(`/supplier-orders/${id}/boss-approve`, { approvalFileUrl });
}

export function cancelSupplierOrder(id: string, reason: string): Promise<SupplierOrder> {
  return http.post<SupplierOrder>(`/supplier-orders/${id}/cancel`, { reason });
}

export function removeSupplierOrderItem(id: string, itemId: string): Promise<SupplierOrder> {
  return http.del<SupplierOrder>(`/supplier-orders/${id}/items/${itemId}`);
}

export function getSupplierOrderCounters(year?: number): Promise<SupplierOrderCounter[]> {
  return http.get<SupplierOrderCounter[]>(`/supplier-orders/counters${year ? `?year=${year}` : ''}`);
}

export function setSupplierOrderCounter(
  supplierId: string,
  year: number,
  lastSeq: number,
): Promise<SupplierOrderCounter> {
  return http.put<SupplierOrderCounter>(`/supplier-orders/counters/${supplierId}`, { year, lastSeq });
}
