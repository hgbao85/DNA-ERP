export type PurchaseOrderStatus =
  | 'PENDING_WAREHOUSE'
  | 'WAREHOUSE_CONFIRMED'
  | 'PENDING_APPROVAL'
  | 'REJECTED'
  | 'PURCHASING'
  | 'PURCHASED'
  | 'RECEIVED'

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
}

export interface PurchaseOrder {
  id: number
  code: string
  source: 'KHSX' | 'WAREHOUSE' | 'MANUAL'
  sourceRef?: string | null
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
}

export interface WarehouseReceipt {
  id: number
  code: string
  purchaseOrderId: number
  purchaseOrderCode: string
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
