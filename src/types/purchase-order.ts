export type PurchaseOrderStatus =
  | 'PENDING_WAREHOUSE'
  | 'WAREHOUSE_CONFIRMED'
  | 'PENDING_APPROVAL'
  | 'REJECTED'
  | 'PURCHASING'
  | 'PURCHASED'
  | 'RECEIVED'

// Loại vật tư — quyết định vật tư của PO này thuộc về kho nào khi tạo phiếu nhập.
export type MaterialCategory = 'sat' | 'son' | 'day' | 'vatTuPhuKien' | 'baoBiDongGoi'

// sat/son -> phôi sơn hàn (gia công + sơn); day/vatTuPhuKien -> vật tư thành phẩm; baoBiDongGoi -> thành phẩm (nơi đóng gói).
export const CATEGORY_WAREHOUSE_CODE: Record<MaterialCategory, string> = {
  sat: 'phoi-son-han',
  son: 'phoi-son-han',
  day: 'vat-tu-tp',
  vatTuPhuKien: 'vat-tu-tp',
  baoBiDongGoi: 'thanh-pham',
}

export interface SupplierQuote {
  id: number
  supplierId?: number | null
  supplierName: string
  unitPrice: number
  expectedDate?: string | null
  note?: string | null
}

export interface PurchaseOrderItem {
  id: number
  materialId?: number | null
  materialName: string
  unit: string
  requiredQty: number
  stockActual?: number | null
  buyQty: number
  quotes?: SupplierQuote[]
  selectedQuoteId?: number | null
  // NCC đã được Giám đốc chọn duyệt (copy từ quote được chọn)
  supplierId?: number | null
  supplierName?: string | null
  unitPrice?: number | null
  expectedDate?: string | null
  note?: string | null
  // Loại vật tư — nếu có đủ ở mọi dòng, createWarehouseReceiptForPO tự tách phiếu nhập theo đúng kho.
  category?: MaterialCategory | null
}

export interface PurchaseOrder {
  id: number
  code: string
  source: 'KHSX' | 'WAREHOUSE' | 'MANUAL'
  sourceRef?: string | null
  // Mã PI (PlanForm/Lệnh sản xuất) mà PO này phục vụ — 1 PI có thể có nhiều PO.
  piCode?: string | null
  skuName?: string | null
  status: PurchaseOrderStatus
  items: PurchaseOrderItem[]
  totalAmount?: number | null
  note?: string | null
  rejectionReason?: string | null
  createdAt: string
  confirmedAt?: string | null
  submittedAt?: string | null
  approvedAt?: string | null
}

export interface WarehouseReceiptItem {
  id: number
  purchaseOrderItemId: number
  materialName: string
  unit: string
  orderedQty: number
  receivedQty?: number | null
  warehouseId?: number | null
  note?: string | null
  category?: MaterialCategory | null
}

export interface WarehouseReceipt {
  id: number
  code: string
  purchaseOrderId: number
  purchaseOrderCode: string
  piCode?: string | null
  skuName?: string | null
  status: 'PENDING' | 'RECEIVED'
  items: WarehouseReceiptItem[]
  note?: string | null
  createdAt: string
  receivedAt?: string | null
}

export const PO_STATUS_MAP: Record<PurchaseOrderStatus, { label: string; bg: string; color: string }> = {
  PENDING_WAREHOUSE:    { label: 'Chờ kho xác nhận',  bg: '#fff3e0', color: '#e65100' },
  WAREHOUSE_CONFIRMED:  { label: 'Kho đã xác nhận',   bg: '#e3f2fd', color: '#1565c0' },
  PENDING_APPROVAL:     { label: 'Chờ GĐ duyệt',      bg: '#ede7f6', color: '#4527a0' },
  REJECTED:             { label: 'Giám đốc từ chối đợi báo giá lại', bg: '#fce4ec', color: '#c62828' },
  PURCHASING:           { label: 'Đang mua hàng',     bg: '#fff8e1', color: '#f57f17' },
  PURCHASED:            { label: 'Đã mua hàng',       bg: '#e8f5e9', color: '#2e7d32' },
  RECEIVED:             { label: 'Đã nhập kho',        bg: '#e0f2f1', color: '#00695c' },
}