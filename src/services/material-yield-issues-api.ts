/**
 * Adapter XUẤT KHO Sắt La/Thanh nhôm cho Phôi (module `material-yield-issues`, thêm 2026-09-04).
 * Mirror material-issues-api.ts (KHÔNG mirror steel-issues-api.ts): xuất TỰ DO theo định mức
 * PieceMaterialYield, KHÔNG cần qua bước đề xuất/duyệt phương án trước như Sắt. Chỉ nhập SỐ LƯỢNG
 * (không có "chiều dài" như SteelIssue.barLengthMm). Không có field `stage` (khác MaterialIssue
 * dùng chung HAN/SON) vì luôn PHÔI.
 *
 * Cùng cách resolve như material-issues-api.ts: nhận thẳng `Sku`, tự resolveProductionOrderId()
 * bên trong - trang thủ kho (XuatVatTuThanhPhamPage) dùng chung pattern master-detail với
 * XuatVatTuTieuHaoPage (chọn SKU trước, plan/issue theo đúng productionOrderId của SKU đó).
 */
import { http, withIdempotencyKey } from './core/http';
import type { Sku } from '../types/sku';
import { resolveProductionOrderId } from './production-invoice-item';

export interface BeMaterialYieldIssuePlanItem {
  materialId: string;
  materialCode: string;
  materialName: string;
  requiredQty: number;
  issuedQty: number;
  remainingToIssue: number;
}

export interface BeMaterialYieldIssue {
  id: string;
  productionOrderId: string;
  /** Mã nội bộ (ProductionOrder.poNumber) - chỉ hệ thống dùng, KHÔNG hiển thị. Dùng `salesOrderCode`. */
  poNumber: string;
  /** Mã đơn hàng Sales gốc - đây mới là mã "PO" hiển thị cho người dùng. */
  salesOrderCode: string | null;
  materialId: string;
  materialCode: string;
  materialName: string;
  issuedQty: number;
  status: 'ISSUED' | 'RECEIVED';
  issuedAt: string;
  issuedById: string;
  receivedQty: number | null;
  receivedAt: string | null;
  receivedById: string | null;
}

/** Trả mảng rỗng khi SKU chưa có ProductionOrder (chưa được Sếp duyệt) — chưa có gì để xuất, không
 *  phải lỗi cần báo cho thủ kho (cùng idiom getMaterialIssuePlan()). */
export async function getMaterialYieldIssuePlan(pf: Sku): Promise<BeMaterialYieldIssuePlanItem[]> {
  const orderId = await resolveProductionOrderId(pf);
  if (!orderId) return [];
  try {
    return await http.get<BeMaterialYieldIssuePlanItem[]>(
      `/production-orders/${orderId}/material-yield-issue-plan`,
    );
  } catch {
    return [];
  }
}

export async function getMaterialYieldIssuesForOrder(
  productionOrderId: string,
): Promise<BeMaterialYieldIssue[]> {
  const res = await http.get<BeMaterialYieldIssue[] | { data: BeMaterialYieldIssue[] }>(
    `/production-orders/${productionOrderId}/material-yield-issues?limit=100`,
  );
  return Array.isArray(res) ? res : res.data;
}

/** Phôi xem đợt chờ/đã nhận của mình — flat qua mọi PO, không cần resolve productionOrderId
 *  (permission không đủ để tự resolve, cùng lý do getMaterialIssuesByStage() bên vật tư tiêu hao). */
export async function getMaterialYieldIssuesByStatus(
  status?: 'ISSUED' | 'RECEIVED',
): Promise<BeMaterialYieldIssue[]> {
  const qs = status ? `status=${status}&limit=100` : 'limit=100';
  const res = await http.get<BeMaterialYieldIssue[] | { data: BeMaterialYieldIssue[] }>(
    `/material-yield-issues?${qs}`,
  );
  return Array.isArray(res) ? res : res.data;
}

export async function issueMaterialYield(
  pf: Sku,
  data: { materialId: string; issuedQty: number },
): Promise<void> {
  const orderId = await resolveProductionOrderId(pf);
  if (!orderId) throw new Error('SKU chưa có Lệnh sản xuất (chưa được Sếp duyệt) — chưa thể xuất vật tư');
  await http.post(`/production-orders/${orderId}/material-yield-issues`, data, withIdempotencyKey());
}

export async function receiveMaterialYieldIssue(issueId: string, receivedQty?: number): Promise<void> {
  await http.post(`/material-yield-issues/${issueId}/receive`, { receivedQty });
}
