// Phần A – Đợt 10a (YC5): màn "Lịch xuất hàng" - booking của hãng tàu, Sales chọn hàng từ từng lệnh SX xếp lên cont.
// `readOnly`: KHSX / Sếp dùng lại màn này chỉ để xem (ẩn nút ghi).
import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, List, Plus } from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import { useIsMobile } from '../../../hooks/useMediaQuery'
import { useUrlParamValue, useUrlState } from '../../../hooks/useUrlState'
import { getCustomers, type BeCustomer } from '../../../services/customers-api'
import { listBookings } from '../../../services/bookings-api'
import LoadErrorState from '../../../components/LoadErrorState'
import LoadingState from '../../../components/LoadingState'
import SearchInput from '../../../components/SearchInput'
import { pageSubtitle, pageTitle } from '../../../styles/typography'
import type { Booking, BookingStatus } from '../../../types/booking'
import BookingCalendar, { calendarRange } from './booking/BookingCalendar'
import BookingFormModal from './booking/BookingFormModal'
import BookingTable from './booking/BookingTable'
import { BOOKING_STATUS_LABEL } from './booking/bookingShared'

type View = 'calendar' | 'table'
const isView = (v: string | null): v is View => v === 'calendar' || v === 'table'
const STATUSES: BookingStatus[] = ['DRAFT', 'CONFIRMED', 'SHIPPED', 'CANCELLED']

/** Xếp theo ngày lấy cont (chưa có ngày thì xuống cuối), rồi CUT OFF, rồi số booking. */
function sortBookings(list: Booking[]): Booking[] {
  return [...list].sort((a, b) => {
    const pa = a.pickupDate ?? '9999-99-99'
    const pb = b.pickupDate ?? '9999-99-99'
    if (pa !== pb) return pa < pb ? -1 : 1
    const ca = a.cutOffAt ?? '9999'
    const cb = b.cutOffAt ?? '9999'
    if (ca !== cb) return ca < cb ? -1 : 1
    return a.bookingNo.localeCompare(b.bookingNo)
  })
}

export default function BookingSchedulePage({ readOnly = false }: { readOnly?: boolean }) {
  const isMobile = useIsMobile()
  const [urlView, setUrlView] = useUrlState('bv')
  const focus = useUrlParamValue('focus')
  // Link thông báo BOOKING_SHORT trỏ vào 1 booking cụ thể: mở dạng bảng (liệt kê hết, không phụ thuộc tháng đang xem).
  const [view, setViewState] = useState<View>(() => (isView(urlView) ? urlView : focus?.startsWith('BOOKING:') ? 'table' : 'calendar'))
  const setView = (v: View) => { setViewState(v); setUrlView(v) }

  const [month, setMonth] = useState(() => new Date())
  const [customerId, setCustomerId] = useState('')
  const [status, setStatus] = useState<BookingStatus | ''>('')
  const [showCancelled, setShowCancelled] = useState(false)
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  const { data: customers } = useFetch<BeCustomer[]>(() => getCustomers())
  const range = useMemo(() => (view === 'calendar' ? calendarRange(month) : null), [view, month])
  const includeCancelled = showCancelled || status === 'CANCELLED'

  const { data, isLoading, error, refetch } = useFetch<Booking[]>(
    () => listBookings({
      from: range?.from, to: range?.to,
      status: status || undefined,
      customerId: customerId || undefined,
      search: debounced || undefined,
      includeCancelled,
    }),
    [range?.from, range?.to, status, customerId, debounced, includeCancelled],
  )

  const [form, setForm] = useState<{ id: string | null; n: number } | null>(null)
  const openForm = (id: string | null) => setForm(f => ({ id, n: (f?.n ?? 0) + 1 }))
  const sorted = useMemo(() => sortBookings(data ?? []), [data])

  // CSS chung đặt select width 100% - ô lọc ở đây phải tự co theo nội dung.
  const control: React.CSSProperties = { minHeight: 38, width: 'auto' }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: isMobile ? 'var(--space-4)' : 'var(--space-5)' }}>
        <div>
          <div style={pageTitle}>Lịch xuất hàng</div>
          <div style={pageSubtitle}>Booking của hãng tàu và hàng xếp lên từng container</div>
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={() => openForm(null)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 40, padding: '9px 18px', border: 'none', borderRadius: 'var(--radius)', background: 'var(--bg-15803d)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            <Plus size={16} /> Tạo booking
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <div style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          {([['calendar', 'Lịch tháng', <CalendarDays key="c" size={14} />], ['table', 'Bảng', <List key="t" size={14} />]] as const).map(([id, label, icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              aria-pressed={view === id}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 38, padding: '0 14px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: view === id ? 700 : 500, background: view === id ? 'var(--bg-e8f5e9)' : 'var(--surface)', color: view === id ? 'var(--fg-2e7d32)' : 'var(--text2)' }}
            >
              {icon}{label}
            </button>
          ))}
        </div>
        <select value={customerId} onChange={e => setCustomerId(e.target.value)} aria-label="Lọc theo khách hàng" style={{ ...control, minWidth: 150, maxWidth: '100%' }}>
          <option value="">Tất cả khách hàng</option>
          {(customers ?? []).map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value as BookingStatus | '')} aria-label="Lọc theo trạng thái" style={{ ...control, minWidth: 140 }}>
          <option value="">Mọi trạng thái</option>
          {STATUSES.map(s => <option key={s} value={s}>{BOOKING_STATUS_LABEL[s]}</option>)}
        </select>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text2)', minHeight: 38, whiteSpace: 'nowrap', cursor: status === 'CANCELLED' ? 'default' : 'pointer' }}>
          <input type="checkbox" checked={includeCancelled} disabled={status === 'CANCELLED'} onChange={e => setShowCancelled(e.target.checked)} />
          Hiện booking đã huỷ
        </label>
        <SearchInput value={search} onChange={setSearch} placeholder="Tìm số booking, PO, lệnh, tàu, POD..." width={320} />
      </div>

      {isLoading ? <LoadingState /> : error || !data ? (
        <LoadErrorState error={error ?? 'Không rõ nguyên nhân'} onRetry={refetch} />
      ) : view === 'calendar' ? (
        <BookingCalendar bookings={data} month={month} onMonthChange={setMonth} onOpen={b => openForm(b.id)} isMobile={isMobile} />
      ) : (
        <BookingTable bookings={sorted} onOpen={b => openForm(b.id)} isMobile={isMobile} />
      )}

      {form && (
        <BookingFormModal
          key={form.n}
          bookingId={form.id}
          readOnly={readOnly}
          onClose={() => setForm(null)}
          onChanged={refetch}
        />
      )}
    </div>
  )
}
