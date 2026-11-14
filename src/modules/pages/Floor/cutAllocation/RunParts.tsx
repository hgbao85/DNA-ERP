import { fmtMm } from '../../../../utils/numberFormat'
import { pieceNamesOf, priorityChips, surplusText, type PriorityChip, type RowRun } from '../cutAllocationModel'
import { muted, Pill, rowWrap, stack } from '../qlsxUi'

const CHIP_TONE: Record<PriorityChip['key'], 'blue' | 'amber' | 'gray'> = { phoiStart: 'blue', bookingDue: 'amber', deadline: 'gray' }

/** Đầu nhóm: lệnh + chip ưu tiên + "Đã sửa tay" (nếu có dòng sửa tay) + loại sắt, chiều dài cây. */
export function RunHeader({ run }: { run: RowRun }) {
  const first = run.rows[0]
  return (
    <div style={stack(4)}>
      <div style={rowWrap}>
        <b style={{ fontSize: 13 }}>{first.piCode}</b>
        {priorityChips(first.priority).map((c) => <Pill key={c.key} tone={CHIP_TONE[c.key]}>{c.text}</Pill>)}
        {run.rows.some((r) => r.isManual) && <Pill tone="green">Đã sửa tay</Pill>}
      </div>
      <div style={{ fontSize: 13, overflowWrap: 'anywhere' }}>
        {first.materialLabel} · cây <b>{fmtMm(first.barLengthMm)}</b>
      </div>
    </div>
  )
}

/** Cuối nhóm: "Chi tiết ra" và "Đoạn dư cả loại" ghi một lần (đoạn dư tính cả loại sắt nên các dòng trong nhóm giống nhau). */
export function RunFooter({ run }: { run: RowRun }) {
  const names = pieceNamesOf(run.rows.flatMap((r) => r.segments))
  const surplus = surplusText(run.rows[run.rows.length - 1].lineSurplus)
  if (names.length === 0 && !surplus) return null
  return (
    <div style={{ ...stack(2), paddingTop: 2 }}>
      {names.length > 0 && <div style={muted}>Chi tiết ra: {names.join(', ')}</div>}
      {surplus && <div style={muted}>Đoạn dư cả loại: {surplus}</div>}
    </div>
  )
}
