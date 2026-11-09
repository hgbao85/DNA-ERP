/**
 * Người B – Đợt 10b (YC5 5.5–5.7): kho thành phẩm xuất hàng theo booking. Booking Sales đã xác nhận gom về 1 kho thành phẩm;
 * thủ kho in phiếu xuất XK, người nhận ký, tải ảnh, nhập số thực xuất từng dòng rồi xác nhận. Thay nút "Xuất giao" cũ.
 */
import { http } from './core/http'
import type { Booking } from '../types/booking'

/** Booking đã xác nhận cần đóng cont ở kho mình (tổng kho: mọi kho). */
export function getBookingsToShip(): Promise<Booking[]> {
  return http.get<Booking[]>('/booking-shipments')
}

/** Giữ số phiếu XK để in; in lại truyền số cũ thì giữ nguyên số. */
export function reserveShipSlipCode(reuse?: string): Promise<{ code: string }> {
  return http.post<{ code: string }>('/booking-shipments/slip-code', reuse ? { reuse } : {})
}

/** `idempotencyKey` giữ nguyên giữa các lần bấm lại của CÙNG 1 lần xác nhận. */
export function shipBooking(
  id: string,
  body: { slipCode: string; signedSlipUrls: string[]; lines: { lineId: string; qty: number }[] },
  idempotencyKey: string,
): Promise<Booking> {
  return http.post<Booking>(`/booking-shipments/${id}/ship`, body, { headers: { 'Idempotency-Key': idempotencyKey } })
}
