import type { BeCutAllocationMachine, BeCutAllocationRow } from '../../../../services/floor-api'
import { fmtNum } from '../../../../utils/numberFormat'
import { BARS_EST_TITLE, cutPatternText, isRowDone, rowBarsText, rowClassLabel, rowNotes, stepBadges } from '../cutAllocationModel'
import { muted, Pill } from '../qlsxUi'

interface Props {
  row: BeCutAllocationRow
  machineType: BeCutAllocationMachine['cutMachineType']
  hasLaser: boolean
}

/** Thông tin gọn của một dòng: kiểu cắt + chip bước, số cây đã cắt, ghi chú (theo bó, đoạn dập). */
export default function RowInfo({ row, machineType, hasLaser }: Props) {
  const label = rowClassLabel(row.machineClass, machineType, hasLaser)
  return (
    <>
      <div style={{ fontSize: 13, overflowWrap: 'anywhere' }}>
        <b>{cutPatternText(row.segments)}</b>
        <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap', marginLeft: 6, verticalAlign: 'middle' }}>
          {row.segments.flatMap((s) => stepBadges(s.steps).map((b) => (
            <Pill key={`${s.cutLengthMm}-${b}`} tone="gray">{fmtNum(s.cutLengthMm)} {b}</Pill>
          )))}
          {label && <Pill tone={label.tone}>{label.text}</Pill>}
          {isRowDone(row) && <Pill tone="green">Xong</Pill>}
        </span>
      </div>
      <div style={muted} title={BARS_EST_TITLE}>{rowBarsText(row)}</div>
      {rowNotes(row).map((n) => <div key={n} style={muted}>{n}</div>)}
    </>
  )
}
