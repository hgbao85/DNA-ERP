export type TransferStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED'

export interface WarehouseTransferItem {
  id: string
  materialId: string | null
  materialName: string
  unit: string
  quantity: number
  note?: string | null
}

export interface WarehouseTransfer {
  id: string
  code: string
  fromWarehouseId: string
  fromWarehouseName: string
  fromWarehouseCode: string
  toWarehouseId: string
  toWarehouseName: string
  toWarehouseCode: string
  status: TransferStatus
  items: WarehouseTransferItem[]
  note?: string | null
  rejectionReason?: string | null
  createdAt: string
  confirmedAt?: string | null
  rejectedAt?: string | null
  /** Vấn đề #7 audit 26/08 - trước đây chỉ tra được ai tạo/xác nhận/từ chối qua audit log riêng.
   *  null với phiếu tạo trước khi field này có mặt (không backfill). Raw user id - FE tự resolve
   *  tên qua getUsers() nếu cần hiển thị. */
  createdById?: string | null
  confirmedById?: string | null
  rejectedById?: string | null
}

// Chuỗi chuyển kho MỘT CHIỀU: value = kho ĐÍCH DUY NHẤT được phép nhận hàng từ key.
// 'thanh-pham' cố ý không có entry vì là kho cuối chuỗi — không được chuyển tiếp đi đâu.
// 'phoi-son-han' -> 'thanh-pham' trực tiếp KHÔNG hợp lệ vì không có entry map thẳng như vậy.
// Mirror đúng TRANSFER_ROUTES phía BE (D:\DNA-ERP-BE\src\modules\warehouse-transfers\transfer-routes.constant.ts)
// — chỉ dùng để UI-gate hiển thị (ẩn/hiện nút, tab), BE mới là nguồn sự thật khi tạo phiếu thật.
export const TRANSFER_ROUTES: Record<string, string> = {
  'phoi-son-han': 'vat-tu-tp',
  'vat-tu-tp': 'thanh-pham',
}

export function isValidTransferRoute(fromCode: string, toCode: string): boolean {
  return TRANSFER_ROUTES[fromCode] === toCode
}

export function canSendFrom(code: string): boolean {
  return code in TRANSFER_ROUTES
}

export function canReceiveAt(code: string): boolean {
  return Object.values(TRANSFER_ROUTES).includes(code)
}

export const TRANSFER_STATUS_MAP: Record<TransferStatus, { label: string; bg: string; color: string }> = {
  PENDING: { label: 'Chờ xác nhận', bg: '#fff3e0', color: '#e65100' },
  CONFIRMED: { label: 'Đã xác nhận', bg: '#e8f5e9', color: '#2e7d32' },
  REJECTED: { label: 'Đã từ chối', bg: '#fce4ec', color: '#c62828' },
}
