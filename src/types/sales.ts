export interface SalesCustomer {
  id: number;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  note?: string;
  createdAt: string;
}

export type SalesPOStatus = 'MUA_HANG' | 'KHUNG_CO_KHI' | 'DAN' | 'CHUYEN_KIEM' | 'DONG_GOI' | 'HOAN_THANH';

export interface SalesPOItem {
  id: number;
  skuCode: string;
  skuName?: string;
  totalQty: number;
  shippedQty: number;
  status: SalesPOStatus;
}

export interface SalesPO {
  id: number;
  code: string;
  customerId: number;
  customerName: string;
  orderDate: string;
  deliveryDate: string;
  items: SalesPOItem[];
  totalValue: number;
  depositAmount: number;
  depositConfirmed: boolean;
  paidAmount: number;
  attachmentName?: string;
  attachmentUrl?: string;
  note?: string;
  createdAt: string;
}

export const SALES_PO_STATUS_LABEL: Record<SalesPOStatus, string> = {
  MUA_HANG: 'Mua hàng',
  KHUNG_CO_KHI: 'Khung cơ khí',
  DAN: 'Đan',
  CHUYEN_KIEM: 'Chuyền kiểm',
  DONG_GOI: 'Đóng gói',
  HOAN_THANH: 'Hoàn thành',
};

export const SALES_PO_STATUS_ORDER: SalesPOStatus[] = ['MUA_HANG', 'KHUNG_CO_KHI', 'DAN', 'CHUYEN_KIEM', 'DONG_GOI', 'HOAN_THANH'];

/** Các mốc chi tiết sản xuất — không gồm HOAN_THANH (đạt được khi xong hết Đóng gói). */
export const SALES_PRODUCTION_STAGES: SalesPOStatus[] = ['MUA_HANG', 'KHUNG_CO_KHI', 'DAN', 'CHUYEN_KIEM', 'DONG_GOI'];
