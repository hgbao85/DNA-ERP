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

export interface BeWeavingPieceMaterialLine {
  materialId: string;
  materialCode: string;
  materialName: string;
  materialSpec: string | null;
  materialUnit: string;
  qtyPerPiece: number;
  /** Σ đã xuất kèm mảnh này (mọi điểm đan, WeavingIssueMaterial thật - 2026-09-11), KHÁC
   *  piece.issuedQty (số mảnh). */
  issuedQty: number;
  /** Tồn kho hiện có (tham khảo, chưa trừ giữ chỗ) tại đúng kho của vật tư này. */
  onHandQty: number;
}

export interface BeWeavingIssuePlanItem {
  pieceId: string;
  pieceCode: string;
  pieceName: string;
  totalQty: number;
  issuedQty: number;
  remainingToIssue: number;
  /** Số mảnh đang nằm trên phiếu xuất đan chờ ký. */
  onDraftQty: number;
  /** Trần để lập phiếu xuất đan (09/11/2026): min(định mức còn lại, mảnh đã qua KCS công đoạn cuối còn ở kho giữ mảnh) - đã trừ
   *  phiếu chờ ký. BE chặn đúng công thức này lúc lập và lúc xác nhận phiếu. */
  canIssueQty: number;
  /** Kho đang giữ mảnh (nơi xuất đan) - thường kho Sơn. */
  sourceWarehouseCode: string | null;
  allocations: BeWeavingAllocation[];
  /** Định mức Dây/Đinh /1 mảnh - đúng nhóm vật tư quyết định "mảnh có đan" (xem
   *  SkusService.isPieceWoven ở BE). Hiển thị tham khảo, không nhân theo số lượng đang xuất. */
  wire: BeWeavingPieceMaterialLine[];
  nail: BeWeavingPieceMaterialLine[];
  /** Định mức Nút nhựa /1 mảnh - CHỈ gồm dòng đã tick "đi kèm xuất đan" ở SpecSteelPage.tsx
   *  (PieceMaterialItem.includeInWeaving), khác wire/nail ở trên (luôn tự động đi kèm). */
  plasticButton: BeWeavingPieceMaterialLine[];
  /** Định mức Vật tư thành phẩm (Sắt, nhóm con Vật tư thành phẩm, vd chân nhôm) /1 mảnh - CHỈ gồm
   *  dòng đã tick "đi kèm xuất đan", cùng điều kiện như plasticButton - vai trò giống hệt Nút nhựa
   *  (2026-10-01). */
  finishedComponent: BeWeavingPieceMaterialLine[];
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

// Xuất đan 1 lần trừ ngay (issueWeaving) ĐÃ GỠ 09/11/2026 - xuất đan đi 2 phiếu XK có ảnh ký (issue-slips-api.ts:
// WEAVING_PIECE từ kho giữ mảnh, WEAVING_MATERIAL từ kho Phụ kiện).

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
