import { useState } from 'react'
import { ChevronDown, ChevronRight, Printer } from 'lucide-react'
import type { CutAllocationMode } from '../../../../services/floor-api'
import { APPROX_NOTE, explainLines, staleText } from '../cutAllocationModel'
import { btn, card, muted, rowWrap, stack } from '../qlsxUi'

/** Mục "Cách hệ thống chia": gập / mở, mỗi luật một gạch đầu dòng. */
function ExplainFold({ hasLaser }: { hasLaser: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button type="button" style={{ ...btn('ghost'), minHeight: 28, padding: '0 4px', fontSize: 12 }} aria-expanded={open}
        onClick={() => setOpen((v) => !v)}>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />} Cách hệ thống chia
      </button>
      {open && (
        <ul style={{ ...muted, color: 'var(--text3)', margin: '2px 0 0', paddingLeft: 22 }}>
          {explainLines(hasLaser).map((l) => <li key={l} style={{ marginTop: 2 }}>{l}</li>)}
        </ul>
      )}
    </div>
  )
}

interface Props {
  hasRows: boolean
  hasLaser: boolean
  busy: boolean
  staleCount: number
  onAuto: (mode: CutAllocationMode) => void
  onRedo: () => void
  onPrintAll: () => void
}

/** Thanh nút trên đầu bảng: chia / chia lại / in, ghi chú dòng cũ, chú thích ≈ và cách chia. */
export default function BoardToolbar({ hasRows, hasLaser, busy, staleCount, onAuto, onRedo, onPrintAll }: Props) {
  const stale = staleText(staleCount)
  return (
    <div style={{ ...card, ...stack(8) }}>
      <div style={{ ...rowWrap, gap: 8 }}>
        {hasRows ? (
          <>
            <button type="button" style={btn('primary', busy)} disabled={busy} onClick={() => onAuto('append')}>Chia phần còn lại</button>
            <button type="button" style={btn('secondary', busy)} disabled={busy} onClick={onRedo}>Chia lại</button>
          </>
        ) : (
          <button type="button" style={btn('primary', busy)} disabled={busy} onClick={() => onAuto('append')}>Chia tự động</button>
        )}
        <button type="button" style={btn('secondary')} disabled={!hasRows} onClick={onPrintAll}><Printer size={14} /> In tất cả máy</button>
        {busy && <span style={muted}>Đang xử lý…</span>}
      </div>
      {stale && <div style={muted}>{stale}</div>}
      <div style={muted}>{APPROX_NOTE}</div>
      <ExplainFold hasLaser={hasLaser} />
    </div>
  )
}
