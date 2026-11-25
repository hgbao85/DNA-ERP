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
import { getAllPages } from './core/getAllPages';
import { resolveMfgProduct } from './products-api';
import type { SalesOrder, SalesOrderItem, SalesOrderStatus } from '../types/sales';
import type { MaterialChoice } from '../types/sku';
import type { ContainerLoad } from '../types/containerLoad';

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
  wireMaterial?: MaterialChoice | null;
  cushionMaterial?: MaterialChoice | null;
  containerLoad?: ContainerLoad | null;
  cancelledAt?: string | null;
  cancelReason?: string | null;
}

interface BeSalesOrder {
  id: string;
  code: string;
  orderCode: string;
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
  /** null = xoá được. Có giá trị = lý do không xoá được (đã gộp PI/đã giao hàng một phần) - dùng
   *  thẳng làm tooltip cho nút Xoá, xem SalesOrdersService.buildDeleteBlockReason() ở BE. */
  deleteBlockedReason: string | null;
  /** Mã các PI đơn đã gộp vào (BE: SalesOrdersService.resolvePiCodes). */
  piCodes?: string[];
  createdAt: string;
  updatedAt: string;
  items: BeSalesOrderItem[];
}

function toSalesOrder(o: BeSalesOrder): SalesOrder {
  return {
    id: o.id,
    code: o.code,
    orderCode: o.orderCode,
    customerId: o.customerId,
    customerName: o.customerName,
    orderDate: o.orderDate,
    // KHÔNG rơi về orderDate khi đơn chưa có hạn giao (2026-10-12): trước đây đơn bỏ trống hạn vẫn
    // hiện "Hạn giao = ngày đặt" ở màn Bán hàng, Kinh doanh tưởng đơn đã có hạn trong khi lệnh sản
    // xuất bên dưới không có hạn nào. Rỗng -> các màn tự hiện "—".
    deliveryDate: o.deliveryDate ?? '',
    items: o.items.map(toSalesOrderItem),
    totalValue: 0, // BE chưa tính (mock cũng chưa từng tính thật, xem finding #9)
    depositAmount: o.depositAmount,
    depositConfirmed: o.depositConfirmed,
    paidAmount: o.paidAmount,
    attachmentName: o.attachmentName ?? undefined,
    attachmentUrl: o.attachmentUrl ?? undefined,
    note: o.note ?? undefined,
    deleteBlockedReason: o.deleteBlockedReason,
    piCodes: o.piCodes ?? [],
    createdAt: o.createdAt,
  };
}

function toSalesOrderItem(it: BeSalesOrderItem): SalesOrderItem {
  return {
    id: it.id,
    mfgProductId: it.mfgProductId,
    skuCode: it.factoryCode,
    skuName: it.skuName ?? undefined,
    totalQty: it.totalQty,
    shippedQty: it.shippedQty,
    status: it.status,
    deliveryDate: it.deliveryDate ?? '',
    wireMaterial: it.wireMaterial ?? null,
    cushionMaterial: it.cushionMaterial ?? null,
    containerLoad: it.containerLoad ?? null,
    cancelledAt: it.cancelledAt ?? null,
    cancelReason: it.cancelReason ?? null,
  };
}

export async function getSalesOrders(): Promise<SalesOrder[]> {
  const list = await getAllPages<BeSalesOrder>('/sales-orders');
  return list.map(toSalesOrder);
}

export async function createSalesOrder(data: Record<string, unknown>): Promise<SalesOrder> {
  const rawItems = (data.items as Array<Record<string, unknown>>) ?? [];
  const items = await Promise.all(
    rawItems.map(async (it) => {
      // Có mfgProductId (chọn từ SKU đã duyệt) thì dùng thẳng — mã SKU không unique, resolve theo
      // mã có thể gắn nhầm sang sản phẩm cùng mã của khách khác.
      const mfgProductId = it.mfgProductId
        ? String(it.mfgProductId)
        : (await resolveMfgProduct(String(it.skuCode ?? ''), it.skuName as string | undefined)).id;
      return {
        mfgProductId,
        skuName: it.skuName,
        totalQty: it.totalQty,
        deliveryDate: it.deliveryDate || undefined,
        // Loại dây/nệm chọn từ định mức đã duyệt của SKU - BE bắt buộc khi SKU có tick loại đó.
        wireMaterialId: it.wireMaterialId || undefined,
        cushionMaterialId: it.cushionMaterialId || undefined,
      };
    }),
  );

  const created = await http.post<BeSalesOrder>('/sales-orders', {
    orderCode: data.orderCode,
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

  // K6 16/11: thông tin đơn + mọi dòng đi chung 1 request, BE ghi trong 1 transaction - trước đây patch từng dòng lần lượt,
  // 1 dòng lỗi thì các dòng trước đã lưu, đơn sửa nửa vời.
  const lineEdits = (items ?? [])
    .filter((it) => it.id)
    .map((it) => ({
      id: String(it.id),
      skuName: it.skuName,
      totalQty: it.totalQty,
      status: it.status,
      deliveryDate: it.deliveryDate || undefined,
    }));
  if (Object.keys(orderFields).length > 0 || lineEdits.length > 0) {
    await http.patch(`/sales-orders/${id}`, {
      attachmentName: orderFields.attachmentName,
      attachmentUrl: orderFields.attachmentUrl,
      note: orderFields.note,
      depositConfirmed: orderFields.depositConfirmed,
      ...(lineEdits.length > 0 ? { items: lineEdits } : {}),
    });
  }

  const updated = await http.get<BeSalesOrder>(`/sales-orders/${id}`);
  return toSalesOrder(updated);
}

/** LS2 19/11: đổi / bỏ chọn màu dây, vải nệm của 1 dòng đơn chưa được Sếp duyệt sản xuất. null = bỏ chọn
 *  (bản định mức mới không còn tick loại đó); undefined = giữ nguyên. Trả lại đơn đã tải lại. */
export async function updateSalesOrderItemChoice(
  orderId: number | string,
  itemId: number | string,
  choice: { wireMaterialId?: string | null; cushionMaterialId?: string | null },
): Promise<SalesOrder> {
  await http.patch(`/sales-orders/${orderId}/items/${itemId}`, choice);
  return toSalesOrder(await http.get<BeSalesOrder>(`/sales-orders/${orderId}`));
}

/** Huỷ lệnh câu 2 (anh Nhân 24/11/2026): khách huỷ hẳn - Sales huỷ 1 dòng đơn (bắt buộc lý do). BE chặn khi dòng đã xuất,
 *  còn lệnh sản xuất sống (KHSX đề nghị huỷ lệnh trước), đang tính phương án cắt hoặc đang nằm trong booking. */
export async function cancelSalesOrderItem(
  orderId: number | string,
  itemId: number | string,
  reason: string,
): Promise<SalesOrder> {
  await http.post(`/sales-orders/${orderId}/items/${itemId}/cancel`, { reason });
  return toSalesOrder(await http.get<BeSalesOrder>(`/sales-orders/${orderId}`));
}

export async function deleteSalesOrder(id: string): Promise<void> {
  await http.del(`/sales-orders/${id}`);
}
