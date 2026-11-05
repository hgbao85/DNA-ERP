/**
 * Phần A – Đợt 10a (YC5): Booking / Lịch xuất hàng của Sales. HỢP ĐỒNG với BE `src/modules/bookings/dto/*.ts`
 * (booking-response.dto.ts, create-booking.dto.ts, update-booking.dto.ts, booking-query.dto.ts) - đổi 2 bên cùng lúc.
 *
 * Ngày chỉ-ngày (`pickupDate`, `etd`): 'YYYY-MM-DD'. Ngày giờ (`cutSiAt`, `cutOffAt`): chuỗi ISO 8601 (BE lưu UTC) - FE hiển thị
 * và nhập theo giờ VN. id là bigint-as-string, KHÔNG ép Number().
 *
 * Số liệu 1 dòng đơn (BE tính, không lưu):
 * - orderQty         = SL dòng đơn (bộ).
 * - orderShippedQty  = đã xuất của dòng đơn.
 * - bookedOtherQty   = đã xếp ở booking KHÁC chưa huỷ (phần chưa xuất).
 * - availableQty     = max(0, orderQty − orderShippedQty − bookedOtherQty) = số tối đa booking này được giữ cho dòng đó.
 * - packedQty        = đã đóng gói (bộ).
 * - readyQty         = max(0, packedQty − orderShippedQty) - "đã đóng gói − đã xuất" (v8 5.8).
 * - shortQty (dòng booking) = số bộ còn thiếu hàng sẵn sau khi chia hàng sẵn (readyQty) cho các booking cùng dòng đơn theo
 *   "ngày hạn" = ngày sớm hơn giữa ngày lấy cont và ngày (giờ VN) của CUT OFF.
 */

export type BookingStatus = 'DRAFT' | 'CONFIRMED' | 'SHIPPED' | 'CANCELLED'

export interface BookingAttachment {
  name: string
  url: string
  uploadedAt: string | null
}

/** Phần chung của dòng booking và dòng ứng viên. */
export interface BookingItemInfo {
  productionInvoiceItemId: string
  salesOrderItemId: string
  salesOrderId: string
  /** Mã PO của khách (SalesOrder.orderCode). */
  orderCode: string
  mfgProductId: string
  factoryCode: string
  skuName: string
  /** Hạn giao của dòng đơn (ISO). */
  deliveryDate: string | null
  /** Mã lệnh của dòng: số LSX ?? mã PI ?? null (chưa gom lệnh). */
  lenhCode: string | null
  productionInvoiceId: string | null
  piCode: string | null
  /** Kho thành phẩm QLSX chọn cho dòng (nơi đóng gói). */
  itemWarehouseCode: string | null
  itemWarehouseName: string | null
  orderQty: number
  orderShippedQty: number
  bookedOtherQty: number
  availableQty: number
  packedQty: number
  readyQty: number
  /** Thể tích 1 thùng (m³). null = SKU chưa có kích thước thùng. */
  boxVolumeM3: number | null
  boxesPerSet: number
  /** Thể tích 1 bộ (m³) = boxVolumeM3 × boxesPerSet. */
  setVolumeM3: number | null
  loadCont: number | null
}

export interface BookingLine extends BookingItemInfo {
  id: string
  qty: number
  /** Số thực xuất (kho TP xác nhận - 10b). */
  shippedQty: number
  /** qty × setVolumeM3; null khi thiếu kích thước. */
  lineM3: number | null
  shortQty: number
}

export interface BookingCandidate extends BookingItemInfo {
  /** Số đang xếp trong booking đang sửa (0 khi tạo mới). */
  currentQty: number
  piStatus: 'PLANNING' | 'PRODUCING' | 'DONE' | null
}

export interface BookingTotals {
  qty: number
  totalM3: number
  capacityM3: number
  fillPct: number | null
  /** Mã SKU chưa có kích thước thùng -> "chưa tính được m³ của SKU …". */
  missingVolumeSkus: string[]
  shortQty: number
  shortLines: number
}

export interface Booking {
  id: string
  bookingNo: string
  customerId: string
  customerName: string
  containerType: string
  containerQty: number
  pod: string
  cutSiAt: string | null
  pickupDate: string | null
  cutOffAt: string | null
  etd: string | null
  pickupPlace: string | null
  vesselVoyage: string | null
  warehouseCode: string | null
  warehouseName: string | null
  note: string | null
  attachments: BookingAttachment[]
  status: BookingStatus
  /** Mã PO khách (khác nhau) từ các dòng - cột "Tên PI" của bảng booking. */
  orderCodes: string[]
  lenhCodes: string[]
  createdById: string
  createdByName: string | null
  createdAt: string
  updatedAt: string
  confirmedAt: string | null
  cancelledAt: string | null
  cancelReason: string | null
  totals: BookingTotals
  lines: BookingLine[]
}

export interface BookingMeta {
  finishedWarehouses: { code: string; name: string }[]
  containerVolumeM3: number
}

export interface BookingLineInput {
  productionInvoiceItemId: string
  qty: number
}

export interface BookingAttachmentInput {
  name: string
  url: string
}

/** Body POST /bookings. */
export interface CreateBookingBody {
  bookingNo: string
  customerId: string
  containerType?: string
  containerQty?: number
  pod: string
  cutSiAt?: string | null
  pickupDate?: string | null
  cutOffAt?: string | null
  etd?: string | null
  pickupPlace?: string | null
  vesselVoyage?: string | null
  warehouseCode?: string | null
  note?: string | null
  attachments?: BookingAttachmentInput[]
  lines?: BookingLineInput[]
}

/** Body PATCH /bookings/:id - bỏ field = giữ nguyên, null = xoá; có `lines` = thay toàn bộ hàng. */
export type UpdateBookingBody = Partial<CreateBookingBody>

export interface BookingListQuery {
  from?: string
  to?: string
  status?: BookingStatus
  customerId?: string
  search?: string
  includeCancelled?: boolean
}
