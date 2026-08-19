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

export interface ProductionOrderInfo {
  /** Mã đơn hàng Sales gốc (SalesOrder.code) — mã "PO" hiển thị cho người dùng. null nếu lệnh sản
   *  xuất này không gắn đơn hàng nào (tạo tay). */
  poCode: string | null;
  /** Id PI cha (ProductionInvoice.id) — dùng gọi endpoint gộp theo PI (vd steel-issues-api.ts). */
  productionInvoiceId: string;
  /** Mã PI cha (ProductionInvoice.code). */
  piCode: string;
  /** Hạn giao (ProductionInvoiceItem.deliveryDeadline) — null nếu chưa khai. */
  deliveryDate: string | null;
}

/**
 * Map mfgProductId -> PO/PI THẬT (từ ProductionOrder Sếp đã duyệt) — PHẢI dùng thay cho
 * `Sku.exportOrder`/`Sku.piCode` khi hiển thị cột PO/PI ở "Phân phối nội bộ": field trên Sku chỉ
 * phản ánh PlanForm.salesOrderId tĩnh (gắn được ngay khi Sales tạo PO, dù Sếp chưa duyệt sản
 * xuất gì), trong khi PO/PI thật chỉ tồn tại SAU khi Sếp duyệt 1 ProductionInvoiceItem sinh ra
 * ProductionOrder (xem ProductionOrdersService.createFromApproval, BE) — đúng lúc kho mới có gì
 * để xuất (sắt/vật tư phải được mua/nhập kho theo lệnh sản xuất đó trước). 1 mfgProduct chỉ lấy
 * ProductionOrder đầu tiên tìm thấy — cùng giả định đơn giản hoá của resolveProductionOrderId().
 */
export async function buildProductionOrderInfoByMfgProduct(): Promise<Map<string, ProductionOrderInfo>> {
  interface BeProductionOrder {
    id: string;
    mfgProductId: string;
    salesOrderCode: string | null;
    productionInvoiceId: string;
    piCode: string;
    deliveryDeadline: string | null;
  }
  const res = await http.get<BeProductionOrder[] | { data: BeProductionOrder[] }>(
    '/production-orders?limit=100',
  );
  const list = Array.isArray(res) ? res : res.data;
  const map = new Map<string, ProductionOrderInfo>();
  for (const o of list) {
    if (!map.has(o.mfgProductId)) {
      map.set(o.mfgProductId, {
        poCode: o.salesOrderCode,
        productionInvoiceId: o.productionInvoiceId,
        piCode: o.piCode,
        deliveryDate: o.deliveryDeadline,
      });
    }
  }
  return map;
}
