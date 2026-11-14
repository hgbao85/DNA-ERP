import { useState, type ReactNode } from 'react'
import type { BeCutAllocationRow } from '../../../../services/floor-api'
import { canConfirmBundleMove, canSplitRow, isBundleRow, moveHint, reasonPayload, type ReasonChoice } from '../cutAllocationModel'
import { muted, smallBtn, smallInput, subPanel } from '../qlsxUi'
import ReasonFields from './ReasonFields'
import type { MoveExtra, SplitData } from './types'

function useReason() {
  const [reason, setReason] = useState<ReasonChoice>('')
  const [note, setNote] = useState('')
  return { reason, note, setReason, setNote, payload: (): MoveExtra => reasonPayload(reason, note) }
}

interface MoveProps {
  row: BeCutAllocationRow
  busy: boolean
  onConfirm: (extra: MoveExtra) => void
  onCancel: () => void
}

/** Khung xác nhận đổi máy: dòng theo bó bắt buộc lý do "Máy hư". */
export function MovePanel({ row, busy, onConfirm, onCancel }: MoveProps) {
  const r = useReason()
  const bundleRow = isBundleRow(row)
  const ok = !bundleRow || canConfirmBundleMove(r.reason)
  return (
    <div style={subPanel} role="group" aria-label={`Đổi máy của ${row.piCode}`}>
      <span style={{ ...muted, flex: '1 1 100%' }}>{moveHint(bundleRow)}</span>
      <ReasonFields reason={r.reason} note={r.note} onReason={r.setReason} onNote={r.setNote} required={bundleRow} disabled={busy} />
      <button type="button" style={smallBtn('primary', busy || !ok)} disabled={busy || !ok} onClick={() => onConfirm(r.payload())}>
        Đổi máy
      </button>
      <button type="button" style={smallBtn('secondary')} onClick={onCancel}>Huỷ</button>
    </div>
  )
}

interface SplitProps {
  row: BeCutAllocationRow
  busy: boolean
  /** Các `<option>` chọn máy nhận cây tách (máy không nhận đã khoá). */
  machineOptions: ReactNode
  onConfirm: (d: SplitData) => void
  onCancel: () => void
}

/** Khung tách dòng: số cây tách ra + máy nhận + lý do. */
export function SplitPanel({ row, busy, machineOptions, onConfirm, onCancel }: SplitProps) {
  const [bars, setBars] = useState('1')
  const [to, setTo] = useState(row.workstationId)
  const r = useReason()
  const n = Number(bars)
  const ok = canSplitRow(row) && Number.isInteger(n) && n >= 1 && n < row.barCount && to !== ''
  return (
    <div style={subPanel} role="group" aria-label={`Tách dòng ${row.piCode}`}>
      <span style={muted}>Tách</span>
      <input style={{ ...smallInput, width: 64 }} type="number" min={1} max={row.barCount - 1} step={1} value={bars}
        onChange={(e) => setBars(e.target.value)} aria-label="Số cây tách ra" />
      <span style={muted}>cây sang</span>
      <select style={{ ...smallInput, minWidth: 0, maxWidth: '100%' }} value={to} onChange={(e) => setTo(e.target.value)}
        aria-label="Máy nhận cây tách">
        {machineOptions}
      </select>
      <ReasonFields reason={r.reason} note={r.note} onReason={r.setReason} onNote={r.setNote} disabled={busy} />
      <button type="button" style={smallBtn('primary', busy || !ok)} disabled={busy || !ok}
        onClick={() => onConfirm({ barCount: n, workstationId: to, ...r.payload() })}>Tách</button>
      <button type="button" style={smallBtn('secondary')} onClick={onCancel}>Huỷ</button>
    </div>
  )
}
