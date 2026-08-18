/**
 * Sku chỉ biết `productionInvoiceId` (1 PI) + `mfgProductId`, không biết thẳng
 * `productionInvoiceItemId` (1 PI có thể có nhiều item, 1/mfgProduct) nên phải tra ngược qua
 * GET /production-invoices/:id rồi so khớp mfgProductId. Dùng chung cho mọi adapter key theo
 * productionInvoiceItemId (transfer-check-api.ts, packaging-api.ts).
 *
 * Fallback theo mfgProductId (2026-08-18): SKU tạo độc lập (không chọn Sales Order lúc tạo) thì
 * `productionInvoiceId` để trống mãi mãi trên PlanForm, dù sau đó ai đó "Yêu cầu sản xuất" cho
 * đúng mfgProduct này qua 1 đơn hàng thật (tạo ProductionInvoiceItem riêng, chỉ nối ngầm qua
 * mfgProductId - không ghi ngược lại PlanForm gốc, xem SkusService.create()). Không có fallback
 * thì mọi màn dùng hàm này (Phân phối nội bộ, Mua hàng routing, Chuyển kho, Đóng gói) coi như SKU
 * đó chưa từng được sản xuất, dù ProductionOrder thật đã RELEASED. Quét /production-orders?limit=100
 * theo mfgProductId (cùng kiểu "fetch hết rồi lọc client" đã dùng ở resolveProductionOrderId()) -
 * giả định 1 mfgProduct chỉ có tối đa 1 ProductionOrder đang chạy tại 1 thời điểm (chưa xử lý case
 * 1 SKU tái sử dụng cho nhiều lệnh sản xuất song song).
 */
import { http } from './core/http';
import type { Sku } from '../types/sku';

export async function resolveProductionInvoiceItemId(pf: Sku): Promise<string | null> {
  if (pf.productionInvoiceId) {
    const pi = await http.get<{ items: { id: string; mfgProductId: string }[] }>(
      `/production-invoices/${pf.productionInvoiceId}`,
    );
    const item = pi.items.find((it) => it.mfgProductId === pf.mfgProductId);
    if (item) return String(item.id);
  }
  const res = await http.get<
    { id: string; mfgProductId: string; productionInvoiceItemId: string }[] | { data: { id: string; mfgProductId: string; productionInvoiceItemId: string }[] }
  >('/production-orders?limit=100');
  const list = Array.isArray(res) ? res : res.data;
  const order = list.find((o) => o.mfgProductId === pf.mfgProductId);
  return order ? order.productionInvoiceItemId : null;
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
