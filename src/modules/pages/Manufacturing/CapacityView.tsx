import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { RefreshCw, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import { useIsMobile } from '../../../hooks/useMediaQuery'
import { useRealtimeRefetch } from '../../../realtime/hooks'
import LoadingState from '../../../components/LoadingState'
import LoadErrorState from '../../../components/LoadErrorState'
import { pageTitle, pageSubtitle } from '../../../styles/typography'
import { tableWrap, tableScrollBox, stickyHeaderRow, emptyBox } from '../../../styles/table'
import { getCapacityBoard, type CapacityBoard, type CapacityDayCell, type CapacityRow } from '../../../services/production-capacity-api'
import { addDays, ddmm, fmtCap, fmtCont, groupRows, limitWarnings, todayKey, weekdayLabel } from './capacityView.utils'

// Tab "Năng lực" (Phần A – Đợt 3, YC10) của trang "Tổng hợp lệnh SX" (?view=nang-luc): cont mỗi ngày theo xưởng/kho × công đoạn,
// so với trần 1,3 cont/ngày. CHỈ ĐỂ CẢNH BÁO (ô đỏ = vượt), không khoá việc nào. Số do BE (production-capacity) tính, FE chỉ hiển thị.

const SPAN_DAYS = 14
const MAX_WARNINGS = 8
const FIRST_COL = 168
// Điện thoại: cột đầu hẹp lại (tên công đoạn ngắn, tên xưởng/kho nằm ở dòng nhóm) để thấy được nhiều ngày hơn.
const FIRST_COL_MOBILE = 104
const DAY_COL = 58

const rowKey = (r: CapacityRow) => `${r.groupKind}:${r.groupCode}:${r.stage}`

export default function CapacityView({ viewSwitch }: { viewSwitch: ReactNode }) {
  const today = todayKey()
  const firstCol = useIsMobile() ? FIRST_COL_MOBILE : FIRST_COL
  const [from, setFrom] = useState(today)
  const to = addDays(from, SPAN_DAYS - 1)
  const [reloading, setReloading] = useState(false)
  const [showAllWarnings, setShowAllWarnings] = useState(false)
  const [selected, setSelected] = useState<{ row: string; day: string } | null>(null)
  const { data, isLoading, error, refetch } = useFetch<CapacityBoard>(
    () => getCapacityBoard(from, to).finally(() => setReloading(false)),
    [from],
  )
  // Mốc / xưởng / tiến độ đổi ở nhiều phòng - tải lại ngầm, gom 5 giây 1 lần (bảng chỉ để xem, không có ô nhập bị đè).
  useRealtimeRefetch(['production-orders', 'production-invoices'], () => { void refetch() }, { debounceMs: 5000 })
  const reload = () => { setReloading(true); void refetch() }
  const move = (days: number) => { setFrom((f) => addDays(f, days)); setSelected(null) }
  const goToday = () => { setFrom(today); setSelected(null) }

  const groups = useMemo(() => groupRows(data?.rows ?? []), [data])
  const warn = useMemo(() => limitWarnings(data?.warnings ?? [], showAllWarnings ? Infinity : MAX_WARNINGS), [data, showAllWarnings])
  const days = data?.rows[0]?.days.map((d) => d.day) ?? []
  // Đang chờ khoảng ngày mới (bấm ‹ ›): vẫn hiện bảng cũ, mờ đi cho tới khi xong.
  const stale = !!data && data.from !== from

  const header = (
    <div style={{ marginBottom: 'var(--space-5)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <h2 style={{ ...pageTitle, margin: 0 }}>Tổng hợp lệnh SX</h2>
        {viewSwitch}
      </div>
      <p style={{ ...pageSubtitle, margin: '2px 0 0' }}>
        {data ? `Cont mỗi ngày, ${ddmm(data.from)} – ${ddmm(data.to)}` : isLoading ? 'Đang tải năng lực…' : 'Chưa tải được năng lực'}
        {warn.shown.length > 0 && <span style={{ color: 'var(--red)', fontWeight: 700 }}> · {(data?.warnings.length ?? 0)} cảnh báo vượt năng lực</span>}
      </p>
    </div>
  )

  if (isLoading && !data) return <div>{header}<LoadingState /></div>
  if (error && !data) return <div>{header}<LoadErrorState error={error} onRetry={refetch} /></div>
  if (!data) return <div>{header}</div>

  const pill: CSSProperties = {
    padding: '5px 12px', fontSize: 12, fontWeight: 600, borderRadius: 20, border: 'none', cursor: 'pointer',
    background: 'var(--surface2)', color: 'var(--text)', display: 'inline-flex', alignItems: 'center', gap: 4,
  }

  const selRow = selected ? data.rows.find((r) => rowKey(r) === selected.row) : undefined
  const selCell = selRow?.days.find((c) => c.day === selected?.day)

  return (
    <div>
      {header}
      {error && (
        <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 8, background: 'var(--red-bg)', color: 'var(--red)', fontSize: 12.5 }}>
          Không tải lại được - đang hiện số cũ. Bấm Tải lại để thử lại.
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        <button type="button" onClick={() => move(-7)} style={pill}><ChevronLeft size={13} /> 7 ngày</button>
        <button type="button" onClick={goToday} disabled={from === today} style={{ ...pill, opacity: from === today ? 0.55 : 1, cursor: from === today ? 'default' : 'pointer' }}>Hôm nay</button>
        <button type="button" onClick={() => move(7)} style={pill}>7 ngày <ChevronRight size={13} /></button>
        <button type="button" onClick={reload} disabled={reloading} title="Tải lại" style={{ ...pill, cursor: reloading ? 'wait' : 'pointer', opacity: reloading ? 0.7 : 1 }}>
          <RefreshCw size={12} /> {reloading ? 'Đang tải…' : 'Tải lại'}
        </button>
      </div>

      <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>
        Trần {fmtCap(data.capacityContPerDay)} cont/ngày mỗi xưởng (Phú An) và mỗi kho đóng gói · Phước An: {data.daysPerContPhuocAn.toLocaleString('vi-VN')} ngày/cont,
        báo khi 2 lệnh cùng chiếm 1 ngày · Chỉ để cảnh báo, không khoá. Sửa ở Cấu hình hệ thống.
      </p>

      {warn.shown.length > 0 && (
        <div role="alert" style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 8, background: 'var(--red-bg)', color: 'var(--red)', fontSize: 12.5, lineHeight: 1.5 }}>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {warn.shown.map((m) => <li key={m}>{m}</li>)}
          </ul>
          {warn.rest > 0 && (
            <button type="button" onClick={() => setShowAllWarnings(true)} style={{ marginTop: 4, padding: 0, border: 'none', background: 'none', color: 'inherit', fontWeight: 700, fontSize: 12.5, textDecoration: 'underline', cursor: 'pointer' }}>
              Xem thêm {warn.rest} cảnh báo
            </button>
          )}
          {showAllWarnings && (data.warnings.length > MAX_WARNINGS) && (
            <button type="button" onClick={() => setShowAllWarnings(false)} style={{ marginTop: 4, padding: 0, border: 'none', background: 'none', color: 'inherit', fontWeight: 700, fontSize: 12.5, textDecoration: 'underline', cursor: 'pointer' }}>
              Thu gọn
            </button>
          )}
        </div>
      )}

      {data.missingLoadCont.length > 0 && (
        <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 8, background: 'var(--amber-bg)', color: 'var(--amber)', fontSize: 12.5, lineHeight: 1.5 }}>
          Chưa tính được (SKU chưa có load cont): {data.missingLoadCont.map((m) => `${m.displayCode} · ${m.skuCode}`).join(', ')}
        </div>
      )}

      {groups.length === 0 ? (
        <div style={emptyBox}>Chưa có lệnh nào đã chọn xưởng trong khoảng này</div>
      ) : (
        <div style={{ ...tableWrap, ...tableScrollBox, opacity: stale ? 0.6 : 1 }}>
          <table style={{ width: '100%', minWidth: firstCol + days.length * DAY_COL, borderCollapse: 'separate', borderSpacing: 0, fontSize: 12.5 }}>
            <thead>
              <tr style={stickyHeaderRow}>
                <th style={{ ...stickyFirst(true), padding: '8px 10px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text2)', minWidth: firstCol, width: firstCol, zIndex: 3 }}>{firstCol === FIRST_COL ? 'Xưởng / kho · công đoạn' : 'Công đoạn'}</th>
                {days.map((d) => {
                  const isToday = d === today
                  return (
                    <th key={d} style={{ padding: '6px 2px', textAlign: 'center', fontSize: 11.5, fontWeight: isToday ? 800 : 600, color: isToday ? 'var(--blue)' : 'var(--text2)', background: isToday ? 'var(--blue-bg)' : 'var(--surface2)', width: DAY_COL, whiteSpace: 'nowrap' }}>
                      {ddmm(d)}
                      <div style={{ fontSize: 10.5, fontWeight: isToday ? 700 : 500, opacity: 0.8 }}>{weekdayLabel(d)}</div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <GroupRows key={g.key} name={g.groupName} rows={g.rows} dayCount={days.length} today={today} selected={selected} onPick={setSelected} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selRow && selCell && selCell.orders.length > 0 && (
        <DetailBox row={selRow} cell={selCell} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}

/** Cột đầu dính khi cuộn ngang. */
function stickyFirst(head = false): CSSProperties {
  return { position: 'sticky', left: 0, zIndex: head ? 3 : 1, background: head ? 'var(--surface2)' : 'var(--surface)', boxShadow: '1px 0 0 var(--border)' }
}

function GroupRows({ name, rows, dayCount, today, selected, onPick }: {
  name: string
  rows: CapacityRow[]
  dayCount: number
  today: string
  selected: { row: string; day: string } | null
  onPick: (s: { row: string; day: string } | null) => void
}) {
  return (
    <>
      <tr>
        <td colSpan={dayCount + 1} style={{ ...stickyFirst(), padding: '7px 10px', fontWeight: 700, fontSize: 12.5, borderTop: '1px solid var(--border)', background: 'var(--surface2)' }}>{name}</td>
      </tr>
      {rows.map((r) => {
        const k = rowKey(r)
        return (
          <tr key={k}>
            <td style={{ ...stickyFirst(), padding: '5px 8px 5px 16px', borderTop: '1px solid var(--border)', whiteSpace: 'nowrap', color: 'var(--text2)' }}>{r.stageLabel}</td>
            {r.days.map((c) => (
              <td key={c.day} style={{ padding: 2, borderTop: '1px solid var(--border)', background: c.day === today ? 'var(--blue-bg)' : undefined, textAlign: 'center' }}>
                <DayCell cell={c} active={selected?.row === k && selected.day === c.day} onClick={() => onPick(selected?.row === k && selected.day === c.day ? null : { row: k, day: c.day })} />
              </td>
            ))}
          </tr>
        )
      })}
    </>
  )
}

function DayCell({ cell, active, onClick }: { cell: CapacityDayCell; active: boolean; onClick: () => void }) {
  const has = cell.orders.length > 0
  if (!has) return <span style={{ color: 'var(--text3)', opacity: 0.5 }}>·</span>
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={cell.over ? 'Vượt năng lực - bấm để xem các lệnh' : 'Bấm để xem các lệnh'}
      style={{
        width: '100%', minHeight: 30, padding: '2px 0', borderRadius: 6, cursor: 'pointer', fontSize: 12.5,
        fontWeight: cell.over ? 700 : 600,
        background: cell.over ? 'var(--red-bg)' : 'var(--surface2)',
        color: cell.over ? 'var(--red)' : 'var(--text)',
        border: active ? '2px solid var(--blue)' : '1px solid transparent',
      }}
    >
      {fmtCont(cell.cont)}
    </button>
  )
}

function DetailBox({ row, cell, onClose }: { row: CapacityRow; cell: CapacityDayCell; onClose: () => void }) {
  const limit = row.mode === 'CONT_PER_DAY' && row.capacity != null ? ` · trần ${fmtCap(row.capacity)}` : ''
  return (
    <div style={{ marginTop: 12, background: 'var(--surface)', border: `1px solid ${cell.over ? 'var(--red)' : 'var(--border)'}`, borderRadius: 12, padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 13, minWidth: 0 }}>
          {row.groupName} · {row.stageLabel} · {ddmm(cell.day)} ({weekdayLabel(cell.day)})
          <div style={{ fontWeight: 500, fontSize: 12, color: cell.over ? 'var(--red)' : 'var(--text3)' }}>
            {fmtCont(cell.cont)} cont{limit}{cell.over ? ' · vượt' : ''}
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Đóng" style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 2, flexShrink: 0 }}><X size={16} /></button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
        {cell.orders.map((o) => (
          <div key={o.itemId} style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', fontSize: 13 }}>
            <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--fg-1d4ed8)' }}>{o.displayCode}</span>
            <span style={{ fontWeight: 600, wordBreak: 'break-word' }}>{o.skuCode}</span>
            <span style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }}>{fmtCont(o.cont)} cont</span>
            <span style={{ color: 'var(--text3)', fontSize: 12, whiteSpace: 'nowrap' }}>{ddmm(o.from)} – {ddmm(o.to)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
