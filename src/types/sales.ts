export interface SalesCustomer {
  id: number;
  name: string;
  phone: string | null;
  email?: string | null;
  address?: string | null;
  note?: string | null;
  createdAt: string;
}

export type SalesOrderStatus = 'LEN_KE_HOACH' | 'MUA_HANG' | 'KHUNG_CO_KHI' | 'DAN' | 'CHUYEN_KIEM' | 'DONG_GOI' | 'HOAN_THANH';

export interface SalesOrderItem {
  /** bigint-as-string thật từ BE (SalesOrderItem.id) — KHÔNG ép Number(), có thể vượt Number.MAX_SAFE_INTEGER. */
  id: string;
  skuCode: string;
  skuName?: string;
  totalQty: number;
  shippedQty: number;
  status: SalesOrderStatus;
  deliveryDate: string;
}

export interface SalesOrder {
  /** bigint-as-string thật từ BE (SalesOrder.id) — KHÔNG ép Number(). */
  id: string;
  code: string;
  /** bigint-as-string thật từ BE (SalesOrder.customerId) — so sánh với SalesCustomer.id (vẫn number,
   *  ngoài phạm vi domain Sales) phải bọc String(), xem CustomerManagementPage/PurchaseHistoryPage. */
  customerId: string;
  customerName: string;
  orderDate: string;
  /** Hạn giao xa nhất trong các SKU của PO — suy ra từ items, không nhập trực tiếp. */
  deliveryDate: string;
  items: SalesOrderItem[];
  totalValue: number;
  depositAmount: number;
  depositConfirmed: boolean;
  paidAmount: number;
  attachmentName?: string;
  attachmentUrl?: string;
  note?: string;
  createdAt: string;
}

export const SALES_ORDER_STATUS_LABEL: Record<SalesOrderStatus, string> = {
  LEN_KE_HOACH: 'Lên kế hoạch',
  MUA_HANG: 'Mua hàng',
  KHUNG_CO_KHI: 'Khung cơ khí',
  DAN: 'Đan',
  CHUYEN_KIEM: 'Chuyền kiểm',
  DONG_GOI: 'Đóng gói',
  HOAN_THANH: 'Hoàn thành',
};

export const SALES_ORDER_STATUS_ORDER: SalesOrderStatus[] = ['LEN_KE_HOACH', 'MUA_HANG', 'KHUNG_CO_KHI', 'DAN', 'CHUYEN_KIEM', 'DONG_GOI', 'HOAN_THANH'];

/** Các mốc chi tiết sản xuất — không gồm HOAN_THANH (đạt được khi xong hết Đóng gói). */
export const SALES_PRODUCTION_STAGES: SalesOrderStatus[] = ['LEN_KE_HOACH', 'MUA_HANG', 'KHUNG_CO_KHI', 'DAN', 'CHUYEN_KIEM', 'DONG_GOI'];
