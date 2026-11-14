import type { BeCutAllocationBoard } from '../../../../services/floor-api'
import { heldElsewhereText, WAITING_NOTE } from '../cutAllocationModel'
import { btn, card, divider, muted, numTd, numTh, sectionTitle, TableScroll, td, th } from '../qlsxUi'

interface UnallocatedProps {
  items: BeCutAllocationBoard['unallocated']
  busy: boolean
  onAuto: () => void
}

/** Khối "Chưa chia": số cây chưa vào máy nào. */
export function UnallocatedPanel({ items, busy, onAuto }: UnallocatedProps) {
  return (
    <section style={card} aria-label="Chưa chia">
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
        <div style={{ ...sectionTitle, flex: 1 }}>Chưa chia</div>
        <button type="button" style={btn('primary', busy)} disabled={busy} onClick={onAuto}>Chia phần còn lại</button>
      </div>
      {items.map((u) => (
        <div key={`${u.productionInvoiceId}:${u.materialId}`}
          style={{ fontSize: 13, padding: '4px 0', borderTop: divider, overflowWrap: 'anywhere' }}>
          <b>{u.piCode}</b> · {u.materialLabel} · <b>{u.bars}</b> cây
        </div>
      ))}
    </section>
  )
}

type Waiting = BeCutAllocationBoard['waiting'][number]

/** Ô loại sắt; lệnh có cây còn giữ ở kho xưởng khác thì ghi thêm dưới tên. */
function MaterialCell({ w }: { w: Waiting }) {
  const held = heldElsewhereText(w.heldElsewhereBars)
  return (
    <td style={{ ...td, overflowWrap: 'anywhere' }}>
      {w.materialLabel}
      {held && <div style={muted}>{held}</div>}
    </td>
  )
}

interface WaitingProps {
  items: Waiting[]
  busy: boolean
  onAddAnyway: (w: Waiting) => void
}

/** Khối "Chờ sắt": loại sắt chưa đủ nên hệ thống chưa tự chia; có nút "Chia luôn". */
export function WaitingPanel({ items, busy, onAddAnyway }: WaitingProps) {
  return (
    <section style={{ ...card, padding: 0 }} aria-label="Chờ sắt">
      <div style={{ padding: '14px 16px 6px' }}>
        <div style={sectionTitle}>Chờ sắt</div>
        <div style={muted}>{WAITING_NOTE}</div>
      </div>
      <TableScroll minWidth={520}>
        <thead>
          <tr style={{ background: 'var(--surface2)' }}>
            <th style={th}>Lệnh</th><th style={th}>Loại sắt</th><th style={numTh}>Cần (cây)</th>
            <th style={numTh}>Có (cây)</th><th style={numTh}>Thiếu (cây)</th><th style={th}> </th>
          </tr>
        </thead>
        <tbody>
          {items.map((w) => (
            <tr key={`${w.productionInvoiceId}:${w.materialId}`} style={{ borderTop: divider }}>
              <td style={td}><b>{w.piCode}</b></td>
              <MaterialCell w={w} />
              <td style={numTd}>{w.requiredBars}</td>
              <td style={numTd}>{w.availableBars}</td>
              <td style={{ ...numTd, color: 'var(--red)', fontWeight: 600 }}>{w.shortBars}</td>
              <td style={numTd}>
                <button type="button" style={btn('secondary', busy)} disabled={busy} onClick={() => onAddAnyway(w)}>Chia luôn</button>
              </td>
            </tr>
          ))}
        </tbody>
      </TableScroll>
    </section>
  )
}
