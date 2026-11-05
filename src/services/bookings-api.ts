/**
 * Phần A – Đợt 10a (YC5): adapter BOOKING (Lịch xuất hàng) FE ⇄ BE (module `bookings`). Kiểu: types/booking.ts (hợp đồng).
 * id là bigint-as-string - KHÔNG ép Number().
 */
import { http } from './core/http';
import type {
  Booking, BookingCandidate, BookingListQuery, BookingMeta, CreateBookingBody, UpdateBookingBody,
} from '../types/booking';

export async function listBookings(query: BookingListQuery = {}): Promise<Booking[]> {
  const params: Record<string, string> = {};
  if (query.from) params.from = query.from;
  if (query.to) params.to = query.to;
  if (query.status) params.status = query.status;
  if (query.customerId) params.customerId = query.customerId;
  if (query.search) params.search = query.search;
  if (query.includeCancelled) params.includeCancelled = 'true';
  return http.get<Booking[]>('/bookings', { params });
}

export async function getBooking(id: string): Promise<Booking> {
  return http.get<Booking>(`/bookings/${id}`);
}

export async function getBookingMeta(): Promise<BookingMeta> {
  return http.get<BookingMeta>('/bookings/meta');
}

export async function getBookingCandidates(customerId: string, bookingId?: string): Promise<BookingCandidate[]> {
  const params: Record<string, string> = { customerId };
  if (bookingId) params.bookingId = bookingId;
  return http.get<BookingCandidate[]>('/bookings/candidates', { params });
}

export async function createBooking(body: CreateBookingBody): Promise<Booking> {
  return http.post<Booking>('/bookings', body);
}

export async function updateBooking(id: string, body: UpdateBookingBody): Promise<Booking> {
  return http.patch<Booking>(`/bookings/${id}`, body);
}

export async function confirmBooking(id: string): Promise<Booking> {
  return http.post<Booking>(`/bookings/${id}/confirm`);
}

export async function cancelBooking(id: string, reason: string): Promise<Booking> {
  return http.post<Booking>(`/bookings/${id}/cancel`, { reason });
}
