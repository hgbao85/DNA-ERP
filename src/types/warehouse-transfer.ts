import { warehouseFamilyOf } from '../utils/warehouseFamily'

export type TransferStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED'

export interface WarehouseTransferItem {
  id: string
  materialId: string | null
  materialName: string
  /** Quy cách vật tư (Material.spec) - null cho dòng "ghi tự do" cũ hoặc vật tư chưa khai báo quy
   *  cách (2026-09-15). */
  materialSpec: string | null
  unit: string
  quantity: number
  note?: string | null
}

/** Dòng "mảnh"/vật tư thành phẩm - bảng con riêng ở BE (WarehouseTransferPieceItem), không
 *  chung với WarehouseTransferItem (vật tư tiêu hao). 1 phiếu chỉ có items HOẶC pieceItems,
 *  không cả hai - xem createPieceTransfer() ở BE. */
export interface WarehouseTransferPieceItem {
  id: string
  productionOrderId: string
  poNumber: string
  salesOrderCode: string | null
  pieceId: string
  pieceCode: string
  pieceName: string
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
  pieceItems: WarehouseTransferPieceItem[]
  note?: string | null
  rejectionReason?: string | null
  createdAt: string
  confirmedAt?: string | null
  rejectedAt?: string | null
  /** Vấn đề #7 audit 26/08 - trước đây chỉ tra được ai tạo/xác nhận/từ chối qua audit log riêng.
   *  null với phiếu tạo trước khi field này có mặt (không backfill). */
  createdById?: string | null
  confirmedById?: string | null
  rejectedById?: string | null
  /** Tên đọc được - BE trả sẵn (thủ kho không có quyền USER:VIEW để tự resolve qua getUsers()). */
  createdByName?: string | null
  confirmedByName?: string | null
  rejectedByName?: string | null
}

// Chuỗi chuyển kho MỘT CHIỀU theo GIA ĐÌNH: value = gia đình ĐÍCH DUY NHẤT được phép nhận hàng từ
// gia đình key. 'thanh-pham' cố ý không có entry vì là kho cuối chuỗi — không được chuyển tiếp đi
// đâu. 'phoi-son-han' -> 'thanh-pham' trực tiếp KHÔNG hợp lệ vì không có entry map thẳng như vậy.
// Mirror đúng FAMILY_ROUTES phía BE (D:\DNA-ERP-BE\src\modules\warehouse-transfers\transfer-routes.constant.ts)
// — chỉ dùng để UI-gate hiển thị (ẩn/hiện nút, tab), BE mới là nguồn sự thật khi tạo phiếu thật.
//
// 2026-09-03: trước đây map theo ĐÚNG 1 code cố định - kho phụ (thanh-pham-2, rồi cả
// phoi-son-han-2/vat-tu-tp-2) không có entry nên mọi hàm dưới đây luôn coi kho phụ "không thuộc
// chuỗi chuyển kho nội bộ". Đổi sang so khớp theo GIA ĐÌNH (warehouseFamilyOf) - người tạo phiếu
// tự CHỌN kho đích cụ thể trong gia đình hợp lệ (quyết định nghiệp vụ 2026-09-03), các hàm dưới
// đây chỉ còn xác nhận "gia đình có hợp lệ" chứ không suy ra 1 kho đích duy nhất nữa.
export const TRANSFER_ROUTES: Record<string, string> = {
  'phoi-son-han': 'vat-tu-tp',
  'vat-tu-tp': 'thanh-pham',
}

export function isValidTransferRoute(fromCode: string, toCode: string): boolean {
  const fromFamily = warehouseFamilyOf(fromCode)
  const toFamily = warehouseFamilyOf(toCode)
  if (!fromFamily || !toFamily) return false
  return TRANSFER_ROUTES[fromFamily] === toFamily
}

export function canSendFrom(code: string): boolean {
  const family = warehouseFamilyOf(code)
  return !!family && family in TRANSFER_ROUTES
}

// Chuyển kho TỰ DO (quyết định nghiệp vụ, gỡ isValidTransferRoute() ở BE create()) - hộp thư
// "chờ nhập" (NhapNoiBoSection) giờ nhận từ MỌI kho, không còn giới hạn theo gia đình. Luôn trả
// true - chỉ còn kiểm tra warehouseCode có resolve ra 1 kho thật hay không ở nơi gọi (myWarehouse).
// TRANSFER_ROUTES/isValidTransferRoute/canSendFrom KHÔNG đổi - vẫn dùng cho luồng piece-transfer
// (mảnh/vật tư thành phẩm gắn PI, xem pieceDestOptions ở WarehouseXuatPage.tsx).
export function canReceiveAt(_code: string): boolean {
  return true
}

export const TRANSFER_STATUS_MAP: Record<TransferStatus, { label: string; bg: string; color: string }> = {
  PENDING: { label: 'Chờ xác nhận', bg: 'var(--bg-fff3e0)', color: 'var(--fg-e65100)' },
  CONFIRMED: { label: 'Đã xác nhận', bg: 'var(--bg-e8f5e9)', color: 'var(--fg-2e7d32)' },
  REJECTED: { label: 'Đã từ chối', bg: 'var(--bg-fce4ec)', color: 'var(--fg-c62828)' },
}
