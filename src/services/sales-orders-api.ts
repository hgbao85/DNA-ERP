/**
 * Adapter SALES ORDERS: FE ⇄ BE thật (module `sales-orders`).
 * BE hợp nhất "salesPOs" (Sales) + "exportOrders" (Mfg) của mock thành 1 bảng duy nhất — xem
 * ghi chú ở services/api.ts. Map ngược về đúng shape `SalesOrder`/`SalesOrderItem` (types/sales.ts)
 * để các trang hiện có (OrderManagementPage, CustomerManagementPage, PurchaseHistoryPage...)
 * không phải sửa logic hiển thị, chỉ khác nguồn dữ liệu.
 *
 * `SalesOrderItem.skuCode` (mock: chuỗi tự do) nay là factoryCode của 1 `MfgProduct` thật — dòng
 * SKU khi tạo/sửa phải resolve-or-create sản phẩm trước (xem resolveMfgProduct trong
 * products-api.ts), KHÔNG còn là chuỗi rời rạc không kiểm soát như mock.
 *
 * id/customerId/salesOrderId/mfgProductId: bigint-as-string thật từ BE — sửa 2026-08-13 (trước đó
 * khai `number` "để khớp interface cũ" như customers-api.ts vẫn đang làm, đã lộ rủi ro mất độ
 * chính xác + so sánh sai kiểu ở mục 07 roadmap). KHÔNG ép Number() ở đâu trong file này.
 */
import { http } from './core/http';
import { resolveMfgProduct } from './products-api';
import type { SalesOrder, SalesOrderItem, SalesOrderStatus } from '../types/sales';

interface BeSalesOrderItem {
  id: string;
  salesOrderId: string;
  mfgProductId: string;
  factoryCode: string;
  skuName: string | null;
  totalQty: number;
  shippedQty: number;
  status: SalesOrderStatus;
  deliveryDate: string | null;
}

interface BeSalesOrder {
  id: string;
  code: string;
  customerId: string;
  customerName: string;
  orderDate: string;
  deliveryDate: string | null;
  depositAmount: number;
  depositConfirmed: boolean;
  paidAmount: number;
  attachmentName: string | null;
  attachmentUrl: string | null;
  note: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  items: BeSalesOrderItem[];
}

function toSalesOrder(o: BeSalesOrder): SalesOrder {
  return {
    id: o.id,
    code: o.code,
    customerId: o.customerId,
    customerName: o.customerName,
    orderDate: o.orderDate,
    deliveryDate: o.deliveryDate ?? o.orderDate,
    items: o.items.map(toSalesOrderItem),
    totalValue: 0, // BE chưa tính (mock cũng chưa từng tính thật, xem finding #9)
    depositAmount: o.depositAmount,
    depositConfirmed: o.depositConfirmed,
    paidAmount: o.paidAmount,
    attachmentName: o.attachmentName ?? undefined,
    attachmentUrl: o.attachmentUrl ?? undefined,
    note: o.note ?? undefined,
    createdAt: o.createdAt,
  };
}

function toSalesOrderItem(it: BeSalesOrderItem): SalesOrderItem {
  return {
    id: it.id,
    skuCode: it.factoryCode,
    skuName: it.skuName ?? undefined,
    totalQty: it.totalQty,
    shippedQty: it.shippedQty,
    status: it.status,
    deliveryDate: it.deliveryDate ?? '',
  };
}

export async function getSalesOrders(): Promise<SalesOrder[]> {
  const res = await http.get<BeSalesOrder[] | { data: BeSalesOrder[] }>('/sales-orders?limit=100');
  const list = Array.isArray(res) ? res : res.data;
  return list.map(toSalesOrder);
}

/** Xuất kho thành phẩm cho khách (WarehouseXuatPage, scope 'thanh-pham') - cộng dồn qty vào
 *  `shippedQty` hiện có của dòng SKU đó. BE tự chặn vượt `totalQty` (409) - không tự check tồn
 *  vật lý ở đây (shipItem() không đụng stock-quant/stock-ledger, chỉ là bút toán đơn hàng). */
export async function shipSalesOrderItem(
  orderId: string,
  itemId: string,
  qty: number,
): Promise<SalesOrderItem> {
  const res = await http.post<BeSalesOrderItem>(`/sales-orders/${orderId}/items/${itemId}/ship`, { qty });
  return toSalesOrderItem(res);
}

export async function createSalesOrder(data: Record<string, unknown>): Promise<SalesOrder> {
  const rawItems = (data.items as Array<Record<string, unknown>>) ?? [];
  const items = await Promise.all(
    rawItems.map(async (it) => {
      const product = await resolveMfgProduct(String(it.skuCode ?? ''), it.skuName as string | undefined);
      return {
        mfgProductId: product.id,
        skuName: it.skuName,
        totalQty: it.totalQty,
        deliveryDate: it.deliveryDate || undefined,
      };
    }),
  );

  const created = await http.post<BeSalesOrder>('/sales-orders', {
    customerId: data.customerId,
    orderDate: data.orderDate ?? new Date().toISOString(),
    attachmentName: data.attachmentName,
    attachmentUrl: data.attachmentUrl,
    note: data.note,
    items,
  });
  return toSalesOrder(created);
}

export async function updateSalesOrder(id: number | string, data: Record<string, unknown>): Promise<SalesOrder | undefined> {
  const { items, ...orderFields } = data as { items?: Array<Record<string, unknown>> } & Record<string, unknown>;

  if (Object.keys(orderFields).length > 0) {
    await http.patch(`/sales-orders/${id}`, {
      attachmentName: orderFields.attachmentName,
      attachmentUrl: orderFields.attachmentUrl,
      note: orderFields.note,
      depositConfirmed: orderFields.depositConfirmed,
    });
  }

  if (items) {
    for (const it of items) {
      if (it.id) {
        await http.patch(`/sales-orders/${id}/items/${it.id}`, {
          skuName: it.skuName,
          totalQty: it.totalQty,
          shippedQty: it.shippedQty,
          status: it.status,
          deliveryDate: it.deliveryDate || undefined,
        });
      }
    }
  }

  const updated = await http.get<BeSalesOrder>(`/sales-orders/${id}`);
  return toSalesOrder(updated);
}
