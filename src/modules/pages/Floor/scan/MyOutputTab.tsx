'use client'

/** Tab "Sản lượng của tôi": số đã kiểm xong (KCS duyệt) và danh sách các lần mình đã báo, gom theo ngày. */

import { useEffect, useState } from 'react'
import LenhCode from '../../../../components/LenhCode'
import { getMyOutput, getMyStats, type BeFloorStats, type BeMyOutputRow } from '../../../../services/floor-api'
import { fmtRate, OP_UNIT, opTitle, outputRangeDays, passRate, pendingText, totalsByOp } from '../floorStats'
import { outputTotals, RANGE_LABEL, rangeBounds, type OutputRange } from '../floorUi'
import {
  errText, fmtMm, fmtQty, groupByDay, MAX_OUTPUT_ROWS, opCaption, outputKindText, STATE_LABEL, totalsText, workerPendingText,
} from './scanModel'
import { Banner } from './ScanParts'
import { card, cardFlush, chip, chipRow, divider, hint, label, loadingText, pill, rowBetween, tabColumn } from './scanUi'

type OutputResult = { range: OutputRange; rows: BeMyOutputRow[] | null; err: string | null }
type KcsResult = { range: OutputRange; data: BeFloorStats | null }

/** Đổi khoảng thời gian thì tải lại; kết quả gắn với khoảng đã hỏi nên kết quả cũ (trả về muộn) không đè lên. */
function useMyOutput(range: OutputRange) {
  const [result, setResult] = useState<OutputResult | null>(null)
  const [kcs, setKcs] = useState<KcsResult | null>(null)
  useEffect(() => {
    let alive = true
    const { from, to } = rangeBounds(range)
    getMyOutput(from.toISOString(), to.toISOString())
      .then((rows) => { if (alive) setResult({ range, rows, err: null }) })
      .catch((e) => { if (alive) setResult({ range, rows: null, err: errText(e) }) })
    return () => { alive = false }
  }, [range])
  // Số ĐÃ KCS duyệt của chính mình (BE lấy id từ token). Lỗi tải thì chỉ ẩn thẻ này, danh sách "đã báo" vẫn dùng được.
  useEffect(() => {
    let alive = true
    const { from, to } = outputRangeDays(range)
    getMyStats({ from, to, groupBy: 'month' })
      .then((data) => { if (alive) setKcs({ range, data }) })
      .catch(() => { if (alive) setKcs({ range, data: null }) })
    return () => { alive = false }
  }, [range])
  return {
    cur: result && result.range === range ? result : null,
    kcsNow: kcs && kcs.range === range ? kcs : null,
  }
}

function KcsCard({ kcs, periodLabel }: { kcs: KcsResult | null; periodLabel: string }) {
  const totals = kcs?.data ? totalsByOp(kcs.data.rows) : []
  const wait = kcs?.data ? workerPendingText(pendingText(kcs.data.pending)) : ''
  return (
    <section aria-label="Số đã kiểm xong" style={card}>
      <div style={label}>Đã kiểm xong · {periodLabel}</div>
      <div style={{ ...hint, marginBottom: 8 }}>Đây là số được tính cho bạn.</div>
      {!kcs ? (
        <div style={loadingText}>Đang tải…</div>
      ) : !kcs.data ? (
        <div style={hint}>Chưa xem được số đã kiểm lúc này.</div>
      ) : totals.length === 0 ? (
        <div style={hint}>Trong {periodLabel} chưa có số nào của bạn được kiểm xong.</div>
      ) : (
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {totals.map((t) => (
            <div key={t.op}>
              <div style={{ ...hint, fontWeight: 600 }}>{opTitle(t.op)} đạt</div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{fmtQty(t.passed)}</div>
              <div style={hint}>Lỗi {fmtQty(t.failed)} {OP_UNIT[t.op]} · đạt {fmtRate(passRate(t))}</div>
            </div>
          ))}
        </div>
      )}
      {wait && <div style={{ ...hint, marginTop: 10 }}>Chưa kiểm xong: {wait}</div>}
    </section>
  )
}

function OutputItem({ r, index }: { r: BeMyOutputRow; index: number }) {
  const st = STATE_LABEL[r.state]
  const lineStyle = {
    display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 16, fontWeight: 600,
    textDecoration: r.reversed ? 'line-through' : 'none', color: r.reversed ? 'var(--floor-hint)' : 'var(--text)',
  } as const
  return (
    <div style={{ padding: '12px 16px', ...divider(index) }}>
      <div style={{ ...rowBetween, gap: 8 }}>
        <div style={hint}>
          <b style={{ fontSize: 16, color: 'var(--text)' }}>
            {new Date(r.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
          </b>
          {r.piCode ? <> · <LenhCode piCode={r.piCode} /></> : null}
          {outputKindText(r)}
          {r.workstation ? ` · ${r.workstation.name}` : ' · báo trên máy tính'}
        </div>
        {!r.reversed && <span style={pill(st[1], st[2], 600)}>{st[0]}</span>}
      </div>
      <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {r.lines.map((l, j) => (
          <div key={j} style={lineStyle}>
            <span>{l.segment ? `${fmtMm(l.segment.cutLengthMm)} mm` : (l.piece?.name ?? 'Mảnh')}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtQty(l.qty)} {l.segment ? 'đoạn' : 'mảnh'}</span>
          </div>
        ))}
      </div>
      {r.reversed && (
        <div style={{ marginTop: 6 }}>
          <Banner tone="warn">
            {r.reversed.byName ? `${r.reversed.byName} đã hủy lần này` : 'Quản lý đã hủy lần này'}.
            {' '}Lý do: {r.reversed.reason ?? 'không ghi'}
          </Banner>
        </div>
      )}
    </div>
  )
}

function DayGroup({ list }: { list: BeMyOutputRow[] }) {
  const totals = outputTotals(list)
  return (
    <div>
      <div style={{ ...rowBetween, gap: 8, marginBottom: 8 }}>
        <div style={{ ...label, marginBottom: 0 }}>
          {new Date(list[0].createdAt).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' })}
        </div>
        {totals.length > 0 && <div style={{ fontSize: 14, fontWeight: 600, textAlign: 'right' }}>{totalsText(totals)}</div>}
      </div>
      <div style={cardFlush}>{list.map((r, i) => <OutputItem key={r.id} r={r} index={i} />)}</div>
    </div>
  )
}

function ReportedList({ rows, periodLabel }: { rows: BeMyOutputRow[]; periodLabel: string }) {
  const totals = outputTotals(rows)
  return (
    <>
      {totals.length > 0 && (
        <div style={{ ...card, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {totals.map((t) => (
            <div key={t.op}>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{fmtQty(t.qty)}</div>
              <div style={hint}>{opCaption(t)}</div>
            </div>
          ))}
          <div style={{ ...hint, flexBasis: '100%' }}>{rows.filter((r) => !r.reversed).length} lần báo trong {periodLabel}</div>
        </div>
      )}
      {groupByDay(rows).map(([k, list]) => <DayGroup key={k} list={list} />)}
      {rows.length >= MAX_OUTPUT_ROWS && <div style={hint}>Chỉ hiện {MAX_OUTPUT_ROWS} lần báo gần nhất trong khoảng này.</div>}
    </>
  )
}

export default function MyOutputTab() {
  const [range, setRange] = useState<OutputRange>('7d')
  const { cur, kcsNow } = useMyOutput(range)
  const periodLabel = rangeBounds(range).label

  let body: React.ReactNode
  if (!cur) body = <div style={loadingText}>Đang tải…</div>
  else if (cur.err) body = <Banner tone="err">{cur.err}</Banner>
  else if (!cur.rows?.length) body = <Banner tone="info">Không có lần báo nào trong {periodLabel}.</Banner>
  else body = <ReportedList rows={cur.rows} periodLabel={periodLabel} />

  return (
    <div style={tabColumn}>
      <div role="group" aria-label="Khoảng thời gian" style={chipRow}>
        {(Object.keys(RANGE_LABEL) as OutputRange[]).map((k) => (
          <button key={k} type="button" aria-pressed={range === k} style={chip(range === k)} onClick={() => setRange(k)}>
            {RANGE_LABEL[k]}
          </button>
        ))}
      </div>
      <KcsCard kcs={kcsNow} periodLabel={periodLabel} />
      <div style={hint}>
        Dưới đây là số bạn <b>đã báo</b> trong {periodLabel}. Số được tính là số đã kiểm xong ở trên. Lần nào quản lý hủy sẽ có ghi lý do.
      </div>
      {body}
    </div>
  )
}
