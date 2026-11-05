// Phần A – Đợt 10a (YC5): tiện ích dùng chung của màn Lịch xuất hàng (nhãn, màu, định dạng).
import type { CSSProperties, ReactNode } from 'react'
import type { Booking, BookingStatus } from '../../../../types/booking'
import { fmtM3 } from '../../../../utils/containerLoad'

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  DRAFT: 'Nháp',
  CONFIRMED: 'Đã xác nhận',
  SHIPPED: 'Đã xuất',
  CANCELLED: 'Đã huỷ',
}

export const BOOKING_STATUS_COLOR: Record<BookingStatus, { bg: string; fg: string }> = {
  DRAFT: { bg: 'var(--surface2)', fg: 'var(--text2)' },
  CONFIRMED: { bg: 'var(--bg-e3f2fd)', fg: 'var(--fg-1565c0)' },
  SHIPPED: { bg: 'var(--bg-dcfce7)', fg: 'var(--fg-15803d)' },
  CANCELLED: { bg: 'var(--bg-fee2e2)', fg: 'var(--fg-c62828)' },
}

/** Nền vàng nổi bật của CUT OFF (như file Excel của bộ phận xuất hàng). */
export const CUTOFF_STYLE: CSSProperties = { background: '#fff59d', color: '#3e2723', fontWeight: 700 }

export const CONTAINER_TYPE_SUGGESTIONS = ['40HC', '40GP', '20GP']

/** '40HC' -> "40'HC"; loại lạ giữ nguyên. */
export function fmtContainerType(type: string): string {
  const m = /^(\d{2})\s*'?\s*([A-Za-z]{2})$/.exec(type.trim())
  return m ? `${m[1]}'${m[2].toUpperCase()}` : type
}

/** "1×40'HC" */
export function fmtContainerQty(b: Pick<Booking, 'containerQty' | 'containerType'>): string {
  return `${b.containerQty}×${fmtContainerType(b.containerType)}`
}

/** "67,52 / 68 m³ (99,3%)" */
export function fmtFill(totals: Booking['totals']): string {
  const pct = totals.fillPct === null ? '' : ` (${totals.fillPct.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%)`
  return `${fmtM3(totals.totalM3)} / ${fmtM3(totals.capacityM3)} m³${pct}`
}

export const isOverCapacity = (fillPct: number | null): boolean => fillPct !== null && fillPct > 100

export function StatusPill({ status }: { status: BookingStatus }) {
  const c = BOOKING_STATUS_COLOR[status]
  return (
    <span style={{ display: 'inline-block', padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: c.bg, color: c.fg, whiteSpace: 'nowrap' }}>
      {BOOKING_STATUS_LABEL[status]}
    </span>
  )
}

/** "Đủ hàng" / "Thiếu N bộ" của 1 booking; null khi chưa có hàng hoặc booking đã đóng. */
export function ReadyBadge({ booking }: { booking: Booking }) {
  if (booking.status === 'CANCELLED' || booking.status === 'SHIPPED' || booking.lines.length === 0) {
    return <span style={{ color: 'var(--text3)' }}>—</span>
  }
  if (booking.totals.shortQty > 0) {
    return <span style={{ color: 'var(--fg-c62828)', fontWeight: 700 }}>Thiếu {booking.totals.shortQty.toLocaleString('vi-VN')} bộ</span>
  }
  return <span style={{ color: 'var(--fg-15803d)', fontWeight: 600 }}>Đủ hàng</span>
}

export function ErrorBanner({ children }: { children: ReactNode }) {
  return (
    <div role="alert" style={{ padding: '8px 12px', marginBottom: 'var(--space-4)', borderRadius: 'var(--radius)', background: 'rgba(226,75,74,.1)', border: '1px solid var(--fg-e24b4a)', color: 'var(--fg-e24b4a)', fontSize: 13, whiteSpace: 'pre-wrap' }}>
      {children}
    </div>
  )
}

/** Lỗi bất kỳ -> chữ để hiện (message BE tiếng Việt giữ nguyên văn). */
export function errText(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback
}

/** Ghép 1 dòng hàng: "GHE-001 – Ghế A × 80". */
export function fmtLineSku(l: { factoryCode: string; skuName: string; qty: number }): string {
  return `${l.factoryCode} – ${l.skuName} × ${l.qty.toLocaleString('vi-VN')}`
}
