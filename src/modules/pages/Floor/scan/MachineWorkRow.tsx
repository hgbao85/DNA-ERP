'use client'

/** Một dòng việc của máy cắt trên màn quét: lệnh, loại sắt, số cây, kiểu cắt, bước làm và nút "Báo cho lệnh này". */

import type { ReactNode } from 'react'
import type { BeCutAllocationRow } from '../../../../services/floor-api'
import {
  BARS_EST_TITLE, cutPatternText, pieceNamesOf, rowBarsText, rowStepLabels, wastePerBarText,
} from '../cutAllocationModel'
import { fmtMm, fmtQty, PICKED_ROW_TEXT, rowBadges, type RowBadgeTone } from './scanModel'
import { divider, hint, nowrap, pill, rowButton } from './scanUi'

const BADGE_STYLE: Record<RowBadgeTone, React.CSSProperties> = {
  run: pill('var(--green-bg)', 'var(--green)'),
  pick: pill('var(--blue-bg)', 'var(--blue-text)'),
  done: pill('var(--green-bg)', 'var(--green)'),
  bundle: pill('var(--surface2)', 'var(--text2)', 600),
}

const line: React.CSSProperties = { fontSize: 15 }

export default function MachineWorkRow({ row: r, index, lenhText, running, picked, done, onPick }: {
  row: BeCutAllocationRow; index: number; lenhText: ReactNode
  running: boolean; picked: boolean; done: boolean; onPick: (piId: string) => void
}) {
  const steps = rowStepLabels(r)
  const names = pieceNamesOf(r.segments)
  const waste = wastePerBarText(r.wastePerBarMm)
  return (
    <li style={{ display: 'flex', gap: 10, padding: '10px 0', minWidth: 0, opacity: done ? 0.6 : 1, ...divider(index) }}>
      <span style={{ width: 24, flexShrink: 0, fontSize: 15, fontWeight: 700, color: 'var(--text3)' }}
        aria-label={done ? 'Đã cắt xong' : undefined}>{done ? '✓' : index + 1}</span>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3, overflowWrap: 'anywhere' }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <b style={{ fontSize: 16 }}>{lenhText}</b>
          {rowBadges({ running, picked, done, isBundle: r.isBundle }).map((b) => (
            <span key={b.tone} style={BADGE_STYLE[b.tone]}>{b.text}</span>
          ))}
        </div>
        <div style={line}>{r.materialLabel}</div>
        <div style={line}>
          Cây <b style={nowrap}>{r.barLengthMm != null ? `${fmtMm(r.barLengthMm)} mm` : '—'}</b>
          {' · '}<b style={nowrap}>{fmtQty(r.barCount)} cây</b>
        </div>
        <div style={line} title={BARS_EST_TITLE}>{rowBarsText(r)}</div>
        <div style={line}>Cắt: <b>{cutPatternText(r.segments)}</b></div>
        {steps.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {steps.map((b) => <span key={b} style={pill('var(--amber-bg)', 'var(--amber)', 600)}>{b}</span>)}
          </div>
        )}
        {names.length > 0 && <div style={hint}>Chi tiết ra: {names.join(', ')}</div>}
        {waste && <div style={hint}>Dư mỗi cây: <span style={nowrap}>{waste}</span></div>}
        {!done && (
          <button type="button" aria-pressed={picked} onClick={() => onPick(r.productionInvoiceId)}
            style={{ ...rowButton(picked), marginTop: 4 }}>
            {picked ? PICKED_ROW_TEXT : 'Báo cho lệnh này'}
          </button>
        )}
      </div>
    </li>
  )
}
