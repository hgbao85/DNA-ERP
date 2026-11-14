'use client'

/**
 * Khối "Việc của máy" trên màn quét máy cắt: các dòng QLSX đã chia cho máy này, theo thứ tự cắt. Chỉ để xem, không đổi
 * luồng báo. Dòng của lệnh tổ đang chạy được đánh dấu "Đang chạy". Chữ gọn cho khổ 375 px: số và đơn vị dính nhau.
 */

import { useState } from 'react'
import { useLenhCodeLookup } from '../../../../components/LenhCode'
import type { BeScanContext } from '../../../../services/floor-api'
import {
  barsLeftText, barsPercent, BARS_EST_TITLE, IDLE_NOTICE, isRowDone, openRowsFirst, sortMachineRows,
} from '../cutAllocationModel'
import MachineWorkRow from './MachineWorkRow'
import { APPROX_NOTE, MACHINE_WORK_PREVIEW, showMoreToggle } from './scanModel'
import { card, hintFaint, label, rowButton } from './scanUi'

type Work = NonNullable<BeScanContext['machineWork']>

function Summary({ work }: { work: Work }) {
  const pct = barsPercent(work.barsDoneEst, work.barsDoneEst + work.barsLeftEst)
  return (
    <>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }} title={BARS_EST_TITLE}>{barsLeftText(work.barsLeftEst)}</div>
      <div role="progressbar" aria-label="Tiến độ cắt của máy" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}
        style={{ height: 6, borderRadius: 999, background: 'var(--surface2)', overflow: 'hidden', marginBottom: 6 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--green)' }} />
      </div>
      <div style={{ ...hintFaint, marginBottom: 4 }}>{APPROX_NOTE}</div>
      {work.status === 'IDLE' && <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--red)', marginBottom: 4 }}>{IDLE_NOTICE}</div>}
    </>
  )
}

export default function MachineWork({ work, runningPiId, selectedPiId, onPick }: {
  work: Work; runningPiId: string | null; selectedPiId: string | null; onPick: (piId: string) => void
}) {
  // Dòng còn việc trước (thứ tự cắt), dòng đã xong xuống cuối: việc máy rảnh tự kéo về nằm cuối danh sách chia.
  const sorted = openRowsFirst(sortMachineRows(work.rows))
  const lenhOf = useLenhCodeLookup(sorted.map((r) => r.piCode))
  // Công nhân quét chủ yếu để BÁO số: chỉ hiện vài dòng đầu (việc đang và sắp cắt) để ô nhập số đoạn không bị đẩy xa.
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? sorted : sorted.slice(0, MACHINE_WORK_PREVIEW)
  const hidden = sorted.length - visible.length
  return (
    <section style={card} aria-label="Việc của máy">
      <div style={{ ...label, marginBottom: 4 }}>Việc của máy</div>
      {sorted.length === 0 ? (
        <div style={{ fontSize: 15, color: 'var(--text2)' }}>Máy chưa được chia việc - hỏi QLSX.</div>
      ) : (
        <>
          <Summary work={work} />
          <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' }}>
            {visible.map((r, i) => (
              <MachineWorkRow key={r.id} row={r} index={i} lenhText={lenhOf(r.piCode)} done={isRowDone(r)}
                running={!!runningPiId && r.productionInvoiceId === runningPiId}
                picked={!!selectedPiId && r.productionInvoiceId === selectedPiId} onPick={onPick} />
            ))}
          </ol>
        </>
      )}
      {showMoreToggle(sorted.length, hidden, showAll) && (
        <button type="button" onClick={() => setShowAll((v) => !v)} style={{ ...rowButton(false), marginTop: 6, width: '100%' }}>
          {showAll ? 'Thu gọn' : `Xem thêm ${hidden} dòng`}
        </button>
      )}
    </section>
  )
}
