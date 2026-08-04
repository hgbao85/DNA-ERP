/**
 * Adapter SALES ORDERS: FE ⇄ BE thật (module `sales-orders`).
 * BE hợp nhất "salesPOs" (Sales) + "exportOrders" (Mfg) của mock thành 1 bảng duy nhất — xem
 * ghi chú ở services/api.ts. Map ngược về đúng shape `SalesPO`/`SalesPOItem` (types/sales.ts)
 * để các trang hiện có (OrderManagementPage, CustomerManagementPage, PurchaseHistoryPage...)
 * không phải sửa logic hiển thị, chỉ khác nguồn dữ liệu.
 *
 * `SalesPOItem.skuCode` (mock: chuỗi tự do) nay là factoryCode của 1 `MfgProduct` thật — dòng
 * SKU khi tạo/sửa phải resolve-or-create sản phẩm trước (xem resolveMfgProduct trong
 * products-api.ts), KHÔNG còn là chuỗi rời rạc không kiểm soát như mock.
 */
import { http } from './core/http';
import { resolveMfgProduct } from './products-api';
import type { SalesPO, SalesPOItem, SalesPOStatus } from '../types/sales';

interface BeSalesOrderItem {
  id: number;
  salesOrderId: number;
  mfgProductId: number;
  factoryCode: string;
  skuName: string | null;
  totalQty: number;
  shippedQty: number;
  status: SalesPOStatus;
  deliveryDate: string | null;
}

interface BeSalesOrder {
  id: number;
  code: string;
  customerId: number;
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

function toSalesPO(o: BeSalesOrder): SalesPO {
  return {
    id: o.id,
    code: o.code,
    customerId: o.customerId,
    customerName: o.customerName,
    orderDate: o.orderDate,
    deliveryDate: o.deliveryDate ?? o.orderDate,
    items: o.items.map(toSalesPOItem),
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

function toSalesPOItem(it: BeSalesOrderItem): SalesPOItem {
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

export async function getSalesPOs(): Promise<SalesPO[]> {
  const res = await http.get<BeSalesOrder[] | { data: BeSalesOrder[] }>('/sales-orders?limit=100');
  const list = Array.isArray(res) ? res : res.data;
  return list.map(toSalesPO);
}

export async function createSalesPO(data: Record<string, unknown>): Promise<SalesPO> {
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
  return toSalesPO(created);
}

export async function updateSalesPO(id: number | string, data: Record<string, unknown>): Promise<SalesPO | undefined> {
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
  return toSalesPO(updated);
}
