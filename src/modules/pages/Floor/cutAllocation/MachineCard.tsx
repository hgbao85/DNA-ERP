import { useState } from 'react'
import { Pencil, Check, Printer } from 'lucide-react'
import type { BeCutAllocationMachine } from '../../../../services/floor-api'
import { MACHINE_LABEL } from '../../../../utils/cutMachine'
import {
  barsPercent, barsProgressText, editToggleLabel, groupAdjacentRows, loadBarSegments, loadBarText, LOAD_BAR_TITLE,
  machineProgressTitle, machineStatusBadge, machineTitle, type MachineGroup,
} from '../cutAllocationModel'
import { btn, card, divider, muted, Pill, rowWrap, SolidBadge } from '../qlsxUi'
import AllocRow from './AllocRow'
import { RunFooter, RunHeader } from './RunParts'
import type { BoardActions } from './types'

function StatusBadge({ status }: { status: BeCutAllocationMachine['status'] }) {
  const b = machineStatusBadge(status)
  if (!b) return null
  return b.tone === 'red' ? <SolidBadge>{b.text}</SolidBadge> : <Pill tone={b.tone}>{b.text}</Pill>
}

/** Một thanh cho cả tải lẫn tiến độ: xanh lá = cây ước đã cắt, xanh dương = còn lại. */
function LoadBar({ machine, maxBars }: { machine: BeCutAllocationMachine; maxBars: number }) {
  const seg = loadBarSegments(machine.totalBars, maxBars, machine.barsDoneEst)
  return (
    <div role="progressbar" aria-label={`Tải và tiến độ cắt của máy ${machineTitle(machine)}`} aria-valuemin={0} aria-valuemax={100}
      aria-valuenow={barsPercent(machine.barsDoneEst, machine.totalBars)} aria-valuetext={loadBarText(machine, maxBars)}
      title={LOAD_BAR_TITLE}
      style={{ display: 'flex', height: 6, borderRadius: 999, background: 'var(--surface2)', overflow: 'hidden', marginBottom: 8 }}>
      <div style={{ width: `${seg.donePct}%`, height: '100%', background: 'var(--green)' }} />
      <div style={{ width: `${seg.leftPct}%`, height: '100%', background: 'var(--blue)' }} />
    </div>
  )
}

interface HeaderProps {
  machine: BeCutAllocationMachine
  editing: boolean
  canEdit: boolean
  onToggleEdit: () => void
  onPrint: () => void
}

/** Đầu thẻ: tên máy, nút Sửa / Xong, In phiếu, chip loại + trạng thái, một dòng tiến độ. */
function MachineHeader({ machine, editing, canEdit, onToggleEdit, onPrint }: HeaderProps) {
  return (
    <div style={{ ...rowWrap, alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, overflowWrap: 'anywhere' }}>{machineTitle(machine)}</div>
        <div style={{ ...rowWrap, marginTop: 2 }}>
          <Pill tone={machine.cutMachineType === 'laser' ? 'red' : 'gray'}>{MACHINE_LABEL[machine.cutMachineType]}</Pill>
          <StatusBadge status={machine.status} />
          <span style={{ fontSize: 13 }}>Tổng <b>{machine.totalBars}</b> cây</span>
        </div>
        {machine.totalBars > 0 && (
          <div style={{ fontSize: 13, marginTop: 2 }} title={machineProgressTitle(machine)}>{barsProgressText(machine)}</div>
        )}
      </div>
      {canEdit && (
        <button type="button" style={btn(editing ? 'primary' : 'secondary')} aria-pressed={editing}
          aria-label={editToggleLabel(editing, machine)} onClick={onToggleEdit}>
          {editing ? <><Check size={14} /> Xong</> : <><Pencil size={14} /> Sửa</>}
        </button>
      )}
      <button type="button" style={btn('secondary')} aria-label={`In phiếu máy ${machineTitle(machine)}`} onClick={onPrint}>
        <Printer size={14} /> In phiếu
      </button>
    </div>
  )
}

interface Props {
  group: MachineGroup
  machines: BeCutAllocationMachine[]
  maxBars: number
  laserAllowed: boolean
  hasLaser: boolean
  actions: BoardActions
}

/** Thẻ của một máy cắt: đầu thẻ, thanh tải, các dòng gom theo lệnh. Nút sửa chỉ hiện khi bấm "Sửa". */
export default function MachineCard({ group: g, machines, maxBars, laserAllowed, hasLaser, actions }: Props) {
  const [editing, setEditing] = useState(false)
  return (
    <section style={{ ...card, padding: 14, minWidth: 0 }} aria-label={`Máy ${machineTitle(g.machine)}`}>
      <MachineHeader machine={g.machine} editing={editing} canEdit={g.rows.length > 0}
        onToggleEdit={() => setEditing((v) => !v)} onPrint={() => actions.print([g], false)} />
      <LoadBar machine={g.machine} maxBars={maxBars} />
      {g.rows.length === 0 && <div style={{ ...muted, padding: '10px 0', borderTop: divider }}>Chưa có việc.</div>}
      {groupAdjacentRows(g.rows).map((run) => (
        <div key={run.key} style={{ borderTop: divider, padding: '10px 0', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <RunHeader run={run} />
          {run.rows.map((r) => {
            const i = g.rows.indexOf(r)
            return (
              <AllocRow key={`${r.id}:${r.barCount}:${r.workstationId}:${editing}`} row={r} machine={g.machine} machines={machines}
                laserAllowed={laserAllowed} hasLaser={hasLaser} editing={editing} canUp={i > 0} canDown={i < g.rows.length - 1}
                actions={actions} onReorder={(row, dir) => actions.reorder(g, row, dir)} />
            )
          })}
          <RunFooter run={run} />
        </div>
      ))}
    </section>
  )
}
