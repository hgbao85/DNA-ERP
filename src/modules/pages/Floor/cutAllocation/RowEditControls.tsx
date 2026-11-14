import type { CSSProperties } from 'react'
import { ArrowDown, ArrowUp, Scissors, Trash2 } from 'lucide-react'
import type { BeCutAllocationMachine, BeCutAllocationRow } from '../../../../services/floor-api'
import { useIsMobile } from '../../../../hooks/useMediaQuery'
import {
  BUNDLE_BARS_HINT, BUNDLE_SPLIT_HINT, canSplitRow, isBundleRow, machineOptionLabel, machineTitle, rowAcceptsMachine,
} from '../cutAllocationModel'
import { rowWrap, smallBtn, smallInput } from '../qlsxUi'

interface OptionsProps {
  row: BeCutAllocationRow
  machines: BeCutAllocationMachine[]
  laserAllowed: boolean
}

/** `<option>` của ô chọn máy: máy BE không nhận dòng này thì khoá, kèm lý do. */
export function MachineOptions({ row, machines, laserAllowed }: OptionsProps) {
  return (
    <>
      {machines.map((m) => {
        const accepts = rowAcceptsMachine(row, m, machines, laserAllowed)
        return <option key={m.id} value={m.id} disabled={!accepts}>{machineOptionLabel(m, accepts)}</option>
      })}
    </>
  )
}

interface BarsProps {
  row: BeCutAllocationRow
  value: string
  disabled: boolean
  onChange: (v: string) => void
  onCommit: () => void
}

const LOCKED_INPUT: CSSProperties = { background: 'var(--surface2)', color: 'var(--text2)', cursor: 'not-allowed' }

/** Ô sửa số cây; dòng theo bó khoá. Enter hoặc rời ô thì lưu. */
function BarsField({ row, value, disabled, onChange, onCommit }: BarsProps) {
  const bundleRow = isBundleRow(row)
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <input style={{ ...smallInput, width: 70, ...(bundleRow ? LOCKED_INPUT : {}) }} type="number" min={1} step={1} value={value}
        disabled={disabled || bundleRow} aria-label={`Số cây của ${row.piCode}`} title={bundleRow ? BUNDLE_BARS_HINT : undefined}
        onChange={(e) => onChange(e.target.value)} onBlur={onCommit}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onCommit() } }} />
      <span style={{ fontSize: 13 }}>cây</span>
    </span>
  )
}

interface Props extends OptionsProps {
  machine: BeCutAllocationMachine
  busy: boolean
  canUp: boolean
  canDown: boolean
  bars: string
  onBars: (v: string) => void
  onCommitBars: () => void
  onPickMachine: (id: string) => void
  onToggleSplit: () => void
  onDelete: () => void
  onMove: (dir: 'up' | 'down') => void
}

/** Hàng nút sửa của một dòng: chọn máy, số cây, lên / xuống, Tách, Xoá. Chỉ hiện khi thẻ máy đang ở chế độ Sửa. */
export default function RowEditControls(p: Props) {
  const isMobile = useIsMobile()
  const { row, busy } = p
  const select: CSSProperties = isMobile
    ? { ...smallInput, flex: '1 1 100%', minWidth: 0 }
    : { ...smallInput, flex: '1 1 150px', minWidth: 0, maxWidth: 240 }
  const where = `${row.piCode}, ${machineTitle(p.machine)}`
  const canSplit = canSplitRow(row)
  return (
    <div style={rowWrap}>
      <select style={select} value={row.workstationId} disabled={busy} aria-label={`Máy của ${row.piCode}`}
        onChange={(e) => p.onPickMachine(e.target.value)}>
        <MachineOptions row={row} machines={p.machines} laserAllowed={p.laserAllowed} />
      </select>
      <BarsField row={row} value={p.bars} disabled={busy} onChange={p.onBars} onCommit={p.onCommitBars} />
      <button type="button" style={smallBtn('ghost')} disabled={busy || !p.canUp} onClick={() => p.onMove('up')}
        aria-label={`Cắt sớm hơn: ${where}`} title="Cắt sớm hơn"><ArrowUp size={14} /></button>
      <button type="button" style={smallBtn('ghost')} disabled={busy || !p.canDown} onClick={() => p.onMove('down')}
        aria-label={`Cắt muộn hơn: ${where}`} title="Cắt muộn hơn"><ArrowDown size={14} /></button>
      <button type="button" style={smallBtn('secondary', busy || !canSplit)} disabled={busy || !canSplit}
        title={isBundleRow(row) ? BUNDLE_SPLIT_HINT : undefined} aria-label={`Tách dòng ${where}`} onClick={p.onToggleSplit}>
        <Scissors size={13} /> Tách
      </button>
      <button type="button" style={{ ...smallBtn('ghost'), color: 'var(--red)' }} disabled={busy} onClick={p.onDelete}
        aria-label={`Xoá dòng ${where}`} title="Xoá dòng"><Trash2 size={14} /></button>
    </div>
  )
}
