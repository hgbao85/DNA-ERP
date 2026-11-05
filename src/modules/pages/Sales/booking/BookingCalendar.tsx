// Phần A – Đợt 10a (YC5): lịch tháng của Lịch xuất hàng. Tự dựng bằng date-fns, không thêm thư viện lịch.
import { useMemo, useState } from 'react'
import {
  addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, isToday, startOfMonth, startOfWeek,
} from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Modal from '../../../../components/Modal'
import { focusAttr } from '../../../../utils/notificationLink'
import { fmtDay, fmtVnDateTime, vnDayOfIso } from '../../../../utils/bookingDates'
import type { Booking } from '../../../../types/booking'
import { CUTOFF_STYLE } from './bookingShared'

type EventKind = 'CUTOFF' | 'PICKUP' | 'ETD' | 'SI'
interface CalEvent { day: string; kind: EventKind; booking: Booking }

const KIND_LABEL: Record<EventKind, string> = { CUTOFF: 'CUT OFF', PICKUP: 'Lấy cont', ETD: 'ETD', SI: 'Cắt SI' }
const KIND_ORDER: Record<EventKind, number> = { CUTOFF: 0, PICKUP: 1, ETD: 2, SI: 3 }
const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
const WEEKDAYS_LONG = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy']
const MAX_PER_CELL = 3

export function calendarRange(month: Date): { from: string; to: string } {
  return {
    from: format(startOfWeek(startOfMonth(month), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
    to: format(endOfWeek(endOfMonth(month), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
  }
}

function buildEvents(bookings: Booking[]): Map<string, CalEvent[]> {
  const map = new Map<string, CalEvent[]>()
  const add = (day: string | null, kind: EventKind, booking: Booking) => {
    if (!day) return
    const list = map.get(day) ?? []
    list.push({ day, kind, booking })
    map.set(day, list)
  }
  for (const b of bookings) {
    add(b.pickupDate ? b.pickupDate.slice(0, 10) : null, 'PICKUP', b)
    add(vnDayOfIso(b.cutOffAt), 'CUTOFF', b)
    add(b.etd ? b.etd.slice(0, 10) : null, 'ETD', b)
    add(vnDayOfIso(b.cutSiAt), 'SI', b)
  }
  for (const list of map.values()) {
    list.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.booking.bookingNo.localeCompare(b.booking.bookingNo))
  }
  return map
}

function chipStyle(ev: CalEvent): React.CSSProperties {
  const b = ev.booking
  let base: React.CSSProperties
  if (ev.kind === 'CUTOFF') base = { ...CUTOFF_STYLE }
  else if (ev.kind === 'PICKUP') base = { background: 'var(--bg-e3f2fd)', color: 'var(--fg-1565c0)', fontWeight: 600 }
  else if (ev.kind === 'ETD') base = { background: 'var(--bg-e8f5e9)', color: 'var(--fg-2e7d32)', fontWeight: 500 }
  else base = { background: 'var(--surface2)', color: 'var(--text3)', fontWeight: 400 }
  const cancelled = b.status === 'CANCELLED'
  return {
    ...base,
    border: b.totals.shortQty > 0 && !cancelled ? '1.5px solid var(--fg-c62828)' : '1px solid transparent',
    opacity: cancelled ? 0.55 : 1,
    textDecoration: cancelled ? 'line-through' : 'none',
  }
}

function EventChip({ ev, onOpen, big = false }: { ev: CalEvent; onOpen: (b: Booking) => void; big?: boolean }) {
  const b = ev.booking
  const time = ev.kind === 'CUTOFF' ? fmtVnDateTime(b.cutOffAt).slice(0, 5) : ev.kind === 'SI' ? fmtVnDateTime(b.cutSiAt).slice(0, 5) : ''
  return (
    <button
      type="button"
      onClick={() => onOpen(b)}
      {...focusAttr('BOOKING', b.id)}
      title={`${KIND_LABEL[ev.kind]} · ${b.bookingNo} · ${b.customerName}${b.totals.shortQty > 0 ? ` · thiếu ${b.totals.shortQty} bộ` : ''}`}
      style={{
        ...chipStyle(ev), display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer', borderRadius: 4,
        padding: big ? '10px 12px' : '2px 5px', fontSize: big ? 13 : 11, lineHeight: 1.35, minHeight: big ? 44 : undefined,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: big ? 'normal' : 'nowrap',
      }}
    >
      {KIND_LABEL[ev.kind]}{time ? ` ${time}` : ''} · {b.bookingNo} · {b.customerName}
    </button>
  )
}

interface Props {
  bookings: Booking[]
  month: Date
  onMonthChange: (m: Date) => void
  onOpen: (b: Booking) => void
  isMobile: boolean
}

export default function BookingCalendar({ bookings, month, onMonthChange, onOpen, isMobile }: Props) {
  const events = useMemo(() => buildEvents(bookings), [bookings])
  const [dayList, setDayList] = useState<string | null>(null)
  const days = useMemo(() => eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  }), [month])

  const nav = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
      <button type="button" aria-label="Tháng trước" onClick={() => onMonthChange(addMonths(month, -1))} style={navBtn}><ChevronLeft size={16} /></button>
      <div style={{ fontWeight: 700, fontSize: 15, minWidth: 110, textAlign: 'center' }}>Tháng {format(month, 'MM/yyyy')}</div>
      <button type="button" aria-label="Tháng sau" onClick={() => onMonthChange(addMonths(month, 1))} style={navBtn}><ChevronRight size={16} /></button>
      <button type="button" onClick={() => onMonthChange(new Date())} style={{ ...navBtn, width: 'auto', padding: '0 14px', fontSize: 13 }}>Hôm nay</button>
      <Legend />
    </div>
  )

  if (isMobile) {
    const monthDays = days.filter(d => isSameMonth(d, month))
    const withEvents = monthDays.filter(d => events.has(format(d, 'yyyy-MM-dd')))
    return (
      <div>
        {nav}
        {withEvents.length === 0 && (
          <div style={{ padding: 28, textAlign: 'center', color: 'var(--text3)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
            Tháng này chưa có mốc nào
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {withEvents.map(d => {
            const key = format(d, 'yyyy-MM-dd')
            return (
              <div key={key} style={{ background: 'var(--surface)', border: `1px solid ${isToday(d) ? 'var(--blue)' : 'var(--border)'}`, borderRadius: 12, padding: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: isToday(d) ? 'var(--blue)' : 'var(--text2)', marginBottom: 8 }}>
                  {WEEKDAYS_LONG[d.getDay()]} · {fmtDay(key)}{isToday(d) ? ' · hôm nay' : ''}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {(events.get(key) ?? []).map(ev => <EventChip key={`${ev.kind}-${ev.booking.id}`} ev={ev} onOpen={onOpen} big />)}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const listEvents = dayList ? events.get(dayList) ?? [] : []
  return (
    <div>
      {nav}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--surface)' }}>
        {WEEKDAYS.map(w => (
          <div key={w} style={{ padding: '8px 6px', fontSize: 12, fontWeight: 600, color: 'var(--text3)', textAlign: 'center', background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>{w}</div>
        ))}
        {days.map((d, i) => {
          const key = format(d, 'yyyy-MM-dd')
          const list = events.get(key) ?? []
          const inMonth = isSameMonth(d, month)
          const today = isToday(d)
          return (
            <div key={key} style={{
              minHeight: 112, padding: 4, display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0,
              borderRight: i % 7 === 6 ? 'none' : '1px solid var(--border)', borderTop: i >= 7 ? '1px solid var(--border)' : 'none',
              background: inMonth ? 'var(--surface)' : 'var(--surface2)', opacity: inMonth ? 1 : 0.65,
            }}>
              <div style={{ textAlign: 'right', fontSize: 12, fontWeight: today ? 700 : 500, color: today ? '#fff' : 'var(--text2)' }}>
                <span style={{ display: 'inline-block', minWidth: 20, padding: '0 5px', borderRadius: 10, background: today ? 'var(--blue)' : 'transparent' }}>{d.getDate()}</span>
              </div>
              {list.slice(0, MAX_PER_CELL).map(ev => <EventChip key={`${ev.kind}-${ev.booking.id}`} ev={ev} onOpen={onOpen} />)}
              {list.length > MAX_PER_CELL && (
                <button type="button" onClick={() => setDayList(key)} style={{ border: 'none', background: 'transparent', color: 'var(--blue)', fontSize: 11, fontWeight: 600, cursor: 'pointer', textAlign: 'left', padding: '2px 4px' }}>
                  +{list.length - MAX_PER_CELL} mốc khác
                </button>
              )}
            </div>
          )
        })}
      </div>

      <Modal open={!!dayList} onClose={() => setDayList(null)} maxWidth={440}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Các mốc ngày {dayList ? fmtDay(dayList) : ''}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {listEvents.map(ev => (
            <EventChip key={`${ev.kind}-${ev.booking.id}`} ev={ev} onOpen={b => { setDayList(null); onOpen(b) }} big />
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
          <button type="button" onClick={() => setDayList(null)} style={{ padding: '9px 20px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, cursor: 'pointer' }}>Đóng</button>
        </div>
      </Modal>
    </div>
  )
}

const navBtn: React.CSSProperties = {
  // padding 0: nút mặc định có padding làm icon mũi tên co còn ~6 px.
  width: 36, height: 36, padding: 0, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)',
}

function Legend() {
  const item = (style: React.CSSProperties, label: string) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text2)' }}>
      <span style={{ ...style, width: 14, height: 10, borderRadius: 2, display: 'inline-block' }} />{label}
    </span>
  )
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginLeft: 'auto' }}>
      {item({ background: '#fff59d' }, 'CUT OFF')}
      {item({ background: 'var(--bg-e3f2fd)' }, 'Lấy cont')}
      {item({ background: 'var(--bg-e8f5e9)' }, 'ETD')}
      {item({ background: 'var(--surface2)', border: '1px solid var(--border)' }, 'Cắt SI')}
      {item({ border: '1.5px solid var(--fg-c62828)' }, 'Thiếu hàng')}
    </div>
  )
}
