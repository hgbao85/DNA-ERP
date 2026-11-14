'use client'

/** Một loại sắt vượt ngưỡng trong khối "Đợt đang chọn": số hao hụt ở cây chuẩn + lưới 3 cách xử lý. */

import { AlertTriangle } from 'lucide-react'
import { fmtNum, fmtPct } from '../../../../utils/numberFormat'
import { bestFixKey, overThresholdText, pctColor, stdLabelFor } from '../gomDotCatUi'
import { buildFixRows, fixGrid, FixRowView, type FixRowsCtx } from './FixRows'

type Shared = Omit<FixRowsCtx, 'm' | 'std' | 'thr'>

const GRID_HEAD: React.CSSProperties = {
  ...fixGrid, padding: '0 10px', fontSize: 11, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--text3)',
}
const BAD: React.CSSProperties = { color: pctColor('checked', false), fontWeight: 700 }
const HEAD_TIP = 'Số do bộ giải tính ở cây chuẩn: xanh = đạt ngưỡng, đỏ = vượt ngưỡng. '
  + 'Số chưa kiểm (ước tính) hiện màu vàng cam. Số thật chốt khi bấm Tính.'

export default function FixMaterialBlock({ m, label, stdLenMm, shared }: {
  m: FixRowsCtx['m']; label: string; stdLenMm: number; shared: Shared
}) {
  const thr = fmtNum(m.thresholdPct)
  const std = stdLabelFor(m.stockLengthMm, stdLenMm)
  // "scan" = có cây hao quá ngưỡng (luật mỗi cây ≤ ngưỡng); số % đi kèm là TỔNG tốt nhất khi chấp nhận các cây đó - nói rõ cả hai,
  // không để "0,87%" đứng một mình bên chữ "vượt 1%".
  const isScan = m.verifiedLengthSource === 'scan'
  const curText = isScan ? overThresholdText(`${thr}%`, fmtPct(m.wastePct ?? 0)) : fmtPct(m.wastePct ?? 0)
  const rows = buildFixRows({ ...shared, m, std, thr })
  const bestKey = bestFixKey(m, shared.hasWsRule)
  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
      <div style={{ fontSize: 13, color: 'var(--text)' }}>
        <AlertTriangle size={13} style={{ color: 'var(--fg-b91c1c)', verticalAlign: '-2px' }} /> <b title={m.materialCode}>{label}</b>
        <span style={{ color: 'var(--text2)' }}>
          {' '}— cắt chung ở {std}: {isScan ? curText : <span style={BAD}>{curText}</span>}
        </span>
      </div>
      <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {!shared.isMobile && (
          <div style={GRID_HEAD}>
            <span>Cách xử lý</span>
            <span style={{ gridColumn: '2 / 4' }} title={HEAD_TIP}>Kết quả ước tính</span>
          </div>
        )}
        {rows.map((r) => <FixRowView key={r.key} r={r} best={r.key === bestKey} isMobile={shared.isMobile} />)}
      </div>
    </div>
  )
}
