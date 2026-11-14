import type { BeCutAllocationLogByOrder, BeCutAllocationLogEntry } from '../../../../services/floor-api'
import {
  logActionLabel, logBarsText, logDetailText, logMachineText, logTimeText, logActorText, logWhenWhoText, reasonLabel,
} from '../cutAllocationModel'
import { divider, muted, numTd, numTh, Pill, rowLine, smallInput, stack, TableScroll, td, th } from '../qlsxUi'

type Entry = BeCutAllocationLogEntry

const labelStyle = { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 } as const

interface FilterProps {
  from: string
  to: string
  onChange: (r: { from: string; to: string }) => void
}

/** Chọn khoảng ngày của nhật ký. */
export function HistoryFilters({ from, to, onChange }: FilterProps) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <label style={labelStyle}>Từ
        <input style={smallInput} type="date" value={from} max={to || undefined} aria-label="Từ ngày"
          onChange={(e) => onChange({ from: e.target.value, to })} />
      </label>
      <label style={labelStyle}>đến
        <input style={smallInput} type="date" value={to} min={from || undefined} aria-label="Đến ngày"
          onChange={(e) => onChange({ from, to: e.target.value })} />
      </label>
      <span style={muted}>Mặc định 30 ngày gần nhất.</span>
    </div>
  )
}

/** Bảng "Lệnh có điều chuyển". */
export function OrdersTable({ orders }: { orders: BeCutAllocationLogByOrder[] }) {
  return (
    <TableScroll minWidth={360}>
      <thead>
        <tr style={{ background: 'var(--surface2)' }}>
          <th style={th}>Lệnh</th><th style={numTh}>Lần đổi máy</th><th style={numTh}>Lần tách</th><th style={numTh}>Vì máy hư</th>
        </tr>
      </thead>
      <tbody>
        {orders.map((o) => (
          <tr key={o.productionInvoiceId} style={{ borderTop: divider }}>
            <td style={td}><b>{o.piCode}</b></td>
            <td style={numTd}>{o.moves}</td>
            <td style={numTd}>{o.splits}</td>
            <td style={{ ...numTd, color: o.machineBrokenMoves > 0 ? 'var(--red)' : undefined }}>{o.machineBrokenMoves}</td>
          </tr>
        ))}
      </tbody>
    </TableScroll>
  )
}

const BundleTag = ({ e }: { e: Entry }) => (e.isBundle ? <> <Pill tone="gray">Theo bó</Pill></> : null)

/** Nhật ký dạng thẻ cho điện thoại. */
export function LogList({ entries }: { entries: Entry[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {entries.map((e) => (
        <div key={e.id} style={{ ...stack(2), borderTop: divider, padding: '8px 0', fontSize: 13, overflowWrap: 'anywhere' }}>
          <div><b>{e.piCode}</b> · {logActionLabel(e.action)}<BundleTag e={e} /></div>
          <div>{logMachineText(e)}</div>
          <div style={{ whiteSpace: 'nowrap' }}>{logBarsText(e)}</div>
          {logDetailText(e) && <div>{logDetailText(e)}</div>}
          <div style={muted}>{logWhenWhoText(e)}</div>
        </div>
      ))}
    </div>
  )
}

/** Nhật ký dạng bảng cho màn rộng. */
export function LogTable({ entries }: { entries: Entry[] }) {
  return (
    <TableScroll minWidth={760}>
      <thead>
        <tr style={{ background: 'var(--surface2)' }}>
          <th style={th}>Thời gian</th><th style={th}>Người</th><th style={th}>Lệnh</th><th style={th}>Thao tác</th>
          <th style={th}>Từ máy → sang máy</th><th style={numTh}>Số cây</th><th style={th}>Lý do</th><th style={th}>Ghi chú</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((e) => (
          <tr key={e.id} style={rowLine}>
            <td style={{ ...td, whiteSpace: 'nowrap' }}>{logTimeText(e.createdAt)}</td>
            <td style={td}>{logActorText(e)}</td>
            <td style={td}><b>{e.piCode}</b><BundleTag e={e} /></td>
            <td style={td}>{logActionLabel(e.action)}</td>
            <td style={td}>{logMachineText(e)}</td>
            <td style={{ ...numTd, whiteSpace: 'nowrap' }}>{logBarsText(e)}</td>
            <td style={{ ...td, color: e.reason === 'MACHINE_BROKEN' ? 'var(--red)' : undefined }}>{reasonLabel(e.reason) || '—'}</td>
            <td style={{ ...td, overflowWrap: 'anywhere' }}>{e.note ?? ''}</td>
          </tr>
        ))}
      </tbody>
    </TableScroll>
  )
}
