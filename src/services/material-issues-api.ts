/**
 * Adapter XUẤT VẬT TƯ TIÊU HAO (Hàn/Sơn): FE ⇄ BE thật (module `material-issues`, chốt 2026-08-12).
 * Thay `vat-tu-noi-bo.service.ts` (mock, key theo poNumber/tenVatTu chuỗi tự do — không liên quan gì
 * tới BE thật). Khác weaving-issues-api.ts/steel-issues: BE CÓ ghi StockLedger (MATERIAL_ISSUE) ngay
 * khi tạo issue — vật tư tiêu hao chưa bị trừ tồn ở bước nào trước đó.
 *
 * 2 phía dùng 2 cách truy vấn KHÁC NHAU vì permission khác nhau (rà lại lúc nối FE, xem
 * role-permissions.constant.ts):
 *  - Kho (XuatVatTuTieuHaoPage, WAREHOUSE_STAFF): key theo productionOrderId (giống
 *    weaving-issues-api.ts) — resolve qua resolveProductionOrderId(), vì kho CÓ SKU:VIEW +
 *    PRODUCTION_ORDER:VIEW nên chọn SKU/PO trước rồi mới xem vật tư của PO đó (master-detail,
 *    cùng pattern KhoXuatDanPage/KhoNhapDanPage).
 *  - Tổ Hàn/Sơn (XacNhanVatTuPage, HAN_STAFF/SON_STAFF): CHỈ có MATERIAL_ISSUE:VIEW - KHÔNG có
 *    SKU:VIEW/PRODUCTION_ORDER:VIEW nên không tự resolve SKU→productionOrderId được (403 nếu gọi
 *    getSkus()/resolveProductionOrderId() - đã xác nhận thật khi test bằng tài khoản han@demo.com).
 *    Dùng getMaterialIssuesByStage() gọi thẳng GET /material-issues?stage=X (flat, không cần biết
 *    PO nào) - endpoint riêng cho đúng trường hợp này, xem ListMaterialIssuesQueryDto (BE).
 */
import { http, withIdempotencyKey } from './core/http';
import type { Sku } from '../types/sku';
import { resolveProductionOrderId } from './production-invoice-item';

export type MaterialIssueStage = 'HAN' | 'SON';

export interface BeMaterialIssuePlanItem {
  stage: MaterialIssueStage;
  materialId: string;
  materialCode: string;
  materialName: string;
  requiredQty: number;
  issuedQty: number;
  remainingToIssue: number;
}

export interface BeMaterialIssue {
  id: string;
  productionOrderId: string;
  poNumber: string;
  stage: MaterialIssueStage;
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
 *  phải lỗi cần báo cho thủ kho. */
export async function getMaterialIssuePlan(pf: Sku, stage: MaterialIssueStage): Promise<BeMaterialIssuePlanItem[]> {
  const orderId = await resolveProductionOrderId(pf);
  if (!orderId) return [];
  try {
    const plan = await http.get<BeMaterialIssuePlanItem[]>(`/production-orders/${orderId}/material-issue-plan`);
    return plan.filter((p) => p.stage === stage);
  } catch {
    return [];
  }
}

/** Tổ Hàn/Sơn xem đợt chờ/đã nhận của công đoạn mình — flat qua mọi PO, không cần resolve
 *  productionOrderId (permission không đủ để tự resolve, xem comment đầu file). */
export async function getMaterialIssuesByStage(stage: MaterialIssueStage): Promise<BeMaterialIssue[]> {
  const res = await http.get<BeMaterialIssue[] | { data: BeMaterialIssue[] }>(
    `/material-issues?stage=${stage}&limit=100`,
  );
  return Array.isArray(res) ? res : res.data;
}

export async function issueMaterial(
  pf: Sku,
  data: { stage: MaterialIssueStage; materialId: string; issuedQty: number },
): Promise<void> {
  const orderId = await resolveProductionOrderId(pf);
  if (!orderId) throw new Error('SKU chưa có Lệnh sản xuất (chưa được Sếp duyệt) — chưa thể xuất vật tư');
  await http.post(`/production-orders/${orderId}/material-issues`, data, withIdempotencyKey());
}

export async function receiveMaterialIssue(issueId: string, receivedQty?: number): Promise<void> {
  await http.post(`/material-issues/${issueId}/receive`, { receivedQty });
}
