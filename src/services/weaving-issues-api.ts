/**
 * Adapter PHÂN BỔ/NHẬN HÀNG ĐAN: FE ⇄ BE thật (module `weaving-issues`, chốt 2026-08-11). Thay
 * `manh.service.ts` (mock, key theo `ManhLine.id` giả tự sinh ở seed.ts - không liên quan gì đến
 * BE thật, xem types/manh.ts).
 * Khác transfer-check-api.ts/packaging-api.ts: key theo `productionOrderId` (không phải
 * `productionInvoiceItemId`) - resolve qua resolveProductionOrderId(). `pieceId`/`weavingPointId`
 * là bigint-as-string thật, không cần tra ngược (client tự có sẵn từ getWeavingIssuePlan()).
 */
import { http, withIdempotencyKey } from './core/http';
import type { Sku } from '../types/sku';
import { resolveProductionOrderId } from './production-invoice-item';

export interface BeWeavingAllocation {
  weavingPointId: string;
  weavingPointCode: string;
  weavingPointName: string | null;
  issuedQty: number;
  receivedQty: number;
  remainingToReceive: number;
}

export interface BeWeavingIssuePlanItem {
  pieceId: string;
  pieceCode: string;
  pieceName: string;
  totalQty: number;
  issuedQty: number;
  remainingToIssue: number;
  allocations: BeWeavingAllocation[];
}

/** Trả mảng rỗng khi SKU chưa có ProductionOrder (chưa được Sếp duyệt) - chưa có gì để xuất/nhận
 *  đan, không phải lỗi cần báo cho thủ kho. */
export async function getWeavingIssuePlan(pf: Sku): Promise<BeWeavingIssuePlanItem[]> {
  const orderId = await resolveProductionOrderId(pf);
  if (!orderId) return [];
  try {
    return await http.get<BeWeavingIssuePlanItem[]>(`/production-orders/${orderId}/weaving-issue-plan`);
  } catch {
    return [];
  }
}

/** Gộp nhiều ProductionOrder 1 lần — "Bảng thống kê" (ThongKePagePlan.tsx) cần tiến độ Đan cho
 *  nhiều SKU cùng lúc, thay vì N lệnh gọi getWeavingIssuePlan() riêng. Trả về map orderId -> danh
 *  sách mảnh (order không có trong danh sách trả về key rỗng []). */
export async function getWeavingIssuePlanBatch(
  productionOrderIds: string[],
): Promise<Record<string, BeWeavingIssuePlanItem[]>> {
  if (productionOrderIds.length === 0) return {};
  return http.get<Record<string, BeWeavingIssuePlanItem[]>>(
    `/production-orders/weaving-issue-plan/batch?ids=${encodeURIComponent(productionOrderIds.join(','))}`,
  );
}

async function requireOrderId(pf: Sku, action: string): Promise<string> {
  const orderId = await resolveProductionOrderId(pf);
  if (!orderId) {
    throw new Error(`SKU chưa có Lệnh sản xuất (chưa được Sếp duyệt) - chưa thể ${action}`);
  }
  return orderId;
}

export async function issueWeaving(
  pf: Sku,
  data: { pieceId: string; weavingPointId: string; qty: number },
): Promise<void> {
  const orderId = await requireOrderId(pf, 'xuất đan');
  await http.post(`/production-orders/${orderId}/weaving-issues`, data, withIdempotencyKey());
}

export async function receiveWeaving(
  pf: Sku,
  data: { pieceId: string; weavingPointId: string; qty: number },
): Promise<void> {
  const orderId = await requireOrderId(pf, 'nhập đan');
  await http.post(`/production-orders/${orderId}/weaving-receipts`, data, withIdempotencyKey());
}

// ── "Quản lý điểm đan" (QuanLyDiemDanPage) ─────────────────────────────────
// Thay WeavingService.getByPoint() mock. Flat, gộp qua MỌI production order - không cần
// resolveProductionOrderId (không scope theo 1 Sku).

export interface BeWeavingPointAssignment {
  poNumber: string;
  productLabel: string;
  pieceCode: string;
  pieceName: string;
  quantity: number;
  completed: number;
  holding: number;
}

export interface BeWeavingPointGroup {
  id: string;
  code: string;
  fullName: string | null;
  phone: string | null;
  totalHolding: number;
  assignments: BeWeavingPointAssignment[];
}

export async function getWeavingByPoint(): Promise<BeWeavingPointGroup[]> {
  return http.get<BeWeavingPointGroup[]>('/weaving-issues/by-point');
}
