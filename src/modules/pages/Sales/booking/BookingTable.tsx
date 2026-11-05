// Phần A – Đợt 10a (YC5): dạng BẢNG của Lịch xuất hàng - đúng cột bảng booking của bộ phận xuất hàng.
import type { CSSProperties, ReactNode } from 'react'
import { focusAttr } from '../../../../utils/notificationLink'
import { fmtDay, fmtVnDateTime } from '../../../../utils/bookingDates'
import type { Booking } from '../../../../types/booking'
import {
  CUTOFF_STYLE, ReadyBadge, StatusPill, fmtContainerQty, fmtFill, fmtLineSku, isOverCapacity,
} from './bookingShared'

const HEADERS = [
  'STT', 'Khách hàng', 'Tên PI', 'SKU', 'Số lượng', 'Số booking', 'POD', 'Cắt SI', 'Ngày lấy cont', 'CUT OFF', 'ETD',
  'Nơi lấy cont', 'Tên tàu', 'Ghi chú', 'Kho gom', 'Khối', 'Hàng', 'Trạng thái',
]

const dash = <span style={{ color: 'var(--text3)' }}>—</span>
const orDash = (v: ReactNode | string | null | undefined) => (v ? v : dash)

function rowStyle(b: Booking): CSSProperties {
  return {
    borderBottom: '1px solid var(--border)', cursor: 'pointer', verticalAlign: 'top',
    opacity: b.status === 'CANCELLED' ? 0.55 : 1,
  }
}

function FillText({ b }: { b: Booking }) {
  if (b.lines.length === 0) return dash
  const over = isOverCapacity(b.totals.fillPct)
  return (
    <span style={{ color: over ? 'var(--fg-c62828)' : 'var(--text)', fontWeight: over ? 700 : 400 }}>
      {fmtFill(b.totals)}{over ? ' · vượt sức chứa' : ''}
    </span>
  )
}

function SkuLines({ b }: { b: Booking }) {
  if (b.lines.length === 0) return dash
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {b.lines.map(l => (
        <div key={l.id} style={{ color: l.shortQty > 0 && b.status !== 'CANCELLED' ? 'var(--fg-c62828)' : undefined }}>
          {fmtLineSku(l)}
        </div>
      ))}
    </div>
  )
}

interface Props {
  bookings: Booking[]
  onOpen: (b: Booking) => void
  isMobile: boolean
}

export default function BookingTable({ bookings, onOpen, isMobile }: Props) {
  if (bookings.length === 0) {
    return (
      <div style={{ padding: '40px 24px', textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text3)' }}>
        Chưa có booking nào
      </div>
    )
  }

  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {bookings.map(b => (
          <div
            key={b.id}
            {...focusAttr('BOOKING', b.id)}
            onClick={() => onOpen(b)}
            role="button"
            tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter') onOpen(b) }}
            style={{ background: 'var(--surface)', border: `1px solid ${b.totals.shortQty > 0 && b.status !== 'CANCELLED' ? 'var(--fg-c62828)' : 'var(--border)'}`, borderRadius: 12, padding: 14, cursor: 'pointer', opacity: b.status === 'CANCELLED' ? 0.6 : 1 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: 'var(--blue)', wordBreak: 'break-word' }}>{b.bookingNo}</div>
                <div style={{ fontSize: 13, color: 'var(--text2)' }}>{b.customerName}</div>
              </div>
              <StatusPill status={b.status} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 10px', fontSize: 12, marginTop: 10 }}>
              <span style={{ color: 'var(--text3)' }}>PI/PO</span><span>{b.orderCodes.join(', ') || '—'}</span>
              <span style={{ color: 'var(--text3)' }}>Số lượng</span><span>{fmtContainerQty(b)} · POD {b.pod}</span>
              <span style={{ color: 'var(--text3)' }}>Lấy cont</span><span>{fmtDay(b.pickupDate) || '—'}{b.pickupPlace ? ` · ${b.pickupPlace}` : ''}</span>
              <span style={{ color: 'var(--text3)' }}>CUT OFF</span>
              <span>{b.cutOffAt ? <span style={{ ...CUTOFF_STYLE, padding: '1px 6px', borderRadius: 3 }}>{fmtVnDateTime(b.cutOffAt)}</span> : '—'}</span>
              <span style={{ color: 'var(--text3)' }}>Cắt SI</span><span>{fmtVnDateTime(b.cutSiAt) || '—'}</span>
              <span style={{ color: 'var(--text3)' }}>ETD</span><span>{fmtDay(b.etd) || '—'}</span>
              {b.vesselVoyage && <><span style={{ color: 'var(--text3)' }}>Tàu</span><span>{b.vesselVoyage}</span></>}
              <span style={{ color: 'var(--text3)' }}>Kho gom</span><span>{b.warehouseName ?? '—'}</span>
              <span style={{ color: 'var(--text3)' }}>Khối</span><span><FillText b={b} /></span>
              <span style={{ color: 'var(--text3)' }}>Hàng</span><span><ReadyBadge booking={b} /></span>
            </div>
            {b.lines.length > 0 && <div style={{ fontSize: 12, marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border)' }}><SkuLines b={b} /></div>}
            {b.note && <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 8, wordBreak: 'break-word' }}>{b.note}</div>}
          </div>
        ))}
      </div>
    )
  }

  const td: CSSProperties = { padding: '9px 10px', fontSize: 12.5 }
  return (
    <div style={{ overflowX: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
      <table style={{ width: '100%', minWidth: 1800, borderCollapse: 'collapse', textAlign: 'left' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
            {HEADERS.map(h => (
              <th key={h} style={{ padding: '10px', fontSize: 12, color: 'var(--text3)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bookings.map((b, i) => (
            <tr
              key={b.id}
              {...focusAttr('BOOKING', b.id)}
              style={rowStyle(b)}
              onClick={() => onOpen(b)}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              <td style={{ ...td, color: 'var(--text3)' }}>{i + 1}</td>
              <td style={{ ...td, fontWeight: 600 }}>{b.customerName}</td>
              <td style={td}>{orDash(b.orderCodes.join(', '))}</td>
              <td style={{ ...td, minWidth: 220 }}><SkuLines b={b} /></td>
              <td style={{ ...td, whiteSpace: 'nowrap' }}>{fmtContainerQty(b)}</td>
              <td style={{ ...td, fontWeight: 700, color: 'var(--blue)', whiteSpace: 'nowrap', textDecoration: b.status === 'CANCELLED' ? 'line-through' : 'none' }}>{b.bookingNo}</td>
              <td style={td}>{b.pod}</td>
              <td style={{ ...td, whiteSpace: 'nowrap' }}>{orDash(fmtVnDateTime(b.cutSiAt))}</td>
              <td style={{ ...td, whiteSpace: 'nowrap' }}>{orDash(fmtDay(b.pickupDate))}</td>
              <td style={{ ...td, whiteSpace: 'nowrap', ...(b.cutOffAt ? CUTOFF_STYLE : {}) }}>{orDash(fmtVnDateTime(b.cutOffAt))}</td>
              <td style={{ ...td, whiteSpace: 'nowrap' }}>{orDash(fmtDay(b.etd))}</td>
              <td style={td}>{orDash(b.pickupPlace)}</td>
              <td style={td}>{orDash(b.vesselVoyage)}</td>
              <td style={{ ...td, minWidth: 140 }}>{orDash(b.note)}</td>
              <td style={td}>{orDash(b.warehouseName)}</td>
              <td style={{ ...td, whiteSpace: 'nowrap' }}><FillText b={b} /></td>
              <td style={{ ...td, whiteSpace: 'nowrap' }}><ReadyBadge booking={b} /></td>
              <td style={td}><StatusPill status={b.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
