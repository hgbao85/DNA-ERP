/**
 * Sku chỉ biết `productionInvoiceId` (1 PI) + `mfgProductId`, không biết thẳng
 * `productionInvoiceItemId` (1 PI có thể có nhiều item, 1/mfgProduct) nên phải tra ngược qua
 * GET /production-invoices/:id rồi so khớp mfgProductId. Dùng chung cho mọi adapter key theo
 * productionInvoiceItemId (transfer-check-api.ts, packaging-api.ts).
 */
import { http } from './core/http';
import type { Sku } from '../types/sku';

export async function resolveProductionInvoiceItemId(pf: Sku): Promise<string | null> {
  if (!pf.productionInvoiceId) return null;
  const pi = await http.get<{ items: { id: number; mfgProductId: number }[] }>(
    `/production-invoices/${pf.productionInvoiceId}`,
  );
  const item = pi.items.find((it) => it.mfgProductId === pf.mfgProductId);
  return item ? String(item.id) : null;
}

/**
 * ProductionOrder tự sinh 1-1 với productionInvoiceItemId ngay khi Sếp duyệt (xem
 * ProductionOrdersService.createFromApproval, BE) - không có endpoint lọc theo
 * productionInvoiceItemId nên phải quét GET /production-orders?limit=100 rồi so khớp (cùng kiểu
 * "fetch hết rồi lọc client" đã dùng ở getPurchaseProposals/getInspectionRequests - danh sách
 * này chưa lớn, xem ghi chú M4 "chưa có phân trang thật" ở roadmap). Dùng cho adapter key theo
 * productionOrderId (weaving-issues-api.ts) - khác productionInvoiceItemId (transfer-check-api.ts/
 * packaging-api.ts).
 */
export async function resolveProductionOrderId(pf: Sku): Promise<string | null> {
  const itemId = await resolveProductionInvoiceItemId(pf);
  if (!itemId) return null;
  const res = await http.get<{ id: string; productionInvoiceItemId: string }[] | { data: { id: string; productionInvoiceItemId: string }[] }>(
    '/production-orders?limit=100',
  );
  const list = Array.isArray(res) ? res : res.data;
  const order = list.find((o) => o.productionInvoiceItemId === itemId);
  return order ? order.id : null;
}
