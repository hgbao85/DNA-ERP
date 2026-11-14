import { useState } from 'react'
import type { BeCutAllocationMachine, BeCutAllocationRow } from '../../../../services/floor-api'
import { isBundleRow, isRowDone, isValidBarCount } from '../cutAllocationModel'
import { stack } from '../qlsxUi'
import RowEditControls, { MachineOptions } from './RowEditControls'
import RowInfo from './RowInfo'
import { MovePanel, SplitPanel } from './RowPanels'
import type { BoardActions } from './types'

interface Props {
  row: BeCutAllocationRow
  machine: BeCutAllocationMachine
  machines: BeCutAllocationMachine[]
  laserAllowed: boolean
  hasLaser: boolean
  /** Thẻ máy đang ở chế độ Sửa: hiện nút sửa của dòng. */
  editing: boolean
  canUp: boolean
  canDown: boolean
  actions: BoardActions
  onReorder: (row: BeCutAllocationRow, dir: 'up' | 'down') => void
}

/** Một dòng trên máy: mặc định chỉ xem; ở chế độ Sửa thêm nút đổi máy, số cây, thứ tự, tách, xoá. */
export default function AllocRow(p: Props) {
  const { row, actions, editing } = p
  const [bars, setBars] = useState(String(row.barCount))
  const [splitting, setSplitting] = useState(false)
  // Đổi máy đang chờ xác nhận: id máy mới.
  const [moveTo, setMoveTo] = useState<string | null>(null)

  const commitBars = () => {
    const n = Number(bars)
    if (!isValidBarCount(n)) { setBars(String(row.barCount)); return }
    if (n !== row.barCount) actions.patch(row.id, { barCount: n })
  }
  const pickMachine = (id: string) => setMoveTo(id !== row.workstationId ? id : null)

  return (
    <div style={{ ...stack(6), padding: '8px 0 4px', opacity: isRowDone(row) ? 0.6 : 1 }}>
      <RowInfo row={row} machineType={p.machine.cutMachineType} hasLaser={p.hasLaser} />
      {editing && (
        <RowEditControls row={row} machine={p.machine} machines={p.machines} laserAllowed={p.laserAllowed} busy={actions.busy}
          canUp={p.canUp} canDown={p.canDown} bars={bars} onBars={setBars} onCommitBars={commitBars} onPickMachine={pickMachine}
          onToggleSplit={() => setSplitting((v) => !v)} onDelete={() => actions.remove(row)} onMove={(dir) => p.onReorder(row, dir)} />
      )}
      {editing && moveTo !== null && (
        <MovePanel row={row} busy={actions.busy} onCancel={() => setMoveTo(null)}
          onConfirm={(extra) => { actions.patch(row.id, { workstationId: moveTo, ...extra }); setMoveTo(null) }} />
      )}
      {editing && splitting && !isBundleRow(row) && (
        <SplitPanel row={row} busy={actions.busy} onCancel={() => setSplitting(false)}
          machineOptions={<MachineOptions row={row} machines={p.machines} laserAllowed={p.laserAllowed} />}
          onConfirm={(d) => { actions.split(row.id, d); setSplitting(false) }} />
      )}
    </div>
  )
}
