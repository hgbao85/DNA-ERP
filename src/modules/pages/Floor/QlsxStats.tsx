'use client'

/**
 * "Báo cáo sản lượng đạt KCS" (2026-10-15, changelog BE docs/changelog-2026-10-08-ke-hoach-tem-qr-bo-sat-phoi.md mục 36):
 * số ĐẠT / LỖI mà KCS đã chốt, chọn theo ngày / tháng / năm / khoảng (giờ VN), lọc theo tổ, xem theo loại việc ·
 * công nhân · cỡ đoạn, xuất Excel. Tính theo ngày KCS DUYỆT (không phải ngày công nhân báo); số công nhân báo mà KCS chưa
 * duyệt hiện riêng ở "đang chờ KCS" để đối chiếu. Máy chủ trả các dòng chi tiết, màn này tự cộng và lọc nên đổi loại việc
 * không phải gọi lại. Biểu đồ theo hướng dẫn dataviz: cột mảnh, 2px hở giữa đạt/lỗi, lưới mờ, chú giải, chỉ ghi số cột cao
 * nhất, tooltip khi rê/chạm/focus + bảng số liệu thay thế.
 */

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, FileSpreadsheet } from 'lucide-react'
import { floorAdmin, type BeFloorStats, type FloorStage, type StatOp } from '../../../services/floor-api'
import { useRealtimeRefetch } from '../../../realtime/hooks'
import DatePicker from '../../../components/DatePicker'
import { MonthPicker, YearPicker } from '../../../components/MonthYearPicker'
import RefreshButton from '../../../components/RefreshButton'
import LoadErrorState from '../../../components/LoadErrorState'
import LoadingState from '../../../components/LoadingState'
import {
  bucketLabel, byLabelFor, byWorkerFor, canStepForward, filterByWorker, fmtQty, fmtRate, initialPeriod, isPeriodValid,
  labelIndexes, niceTicks, OP_ORDER, OP_UNIT, opTitle, passRate, pendingText, periodLabel, pickOp, resolvePeriod, seriesFor,
  statsFileName, stepPeriod, todayVn, totalsByOp, NO_WORKER, WORKER_ALL, workerOptions,
  type Period, type PeriodMode, type SeriesPoint, type Tally, type WorkerOption,
} from './floorStats'
import { buildStatsWorkbook } from './floorStatsExport'
import { card, input, Notice, STAGE_LABEL, td, th } from './qlsxUi'

const MODES: { id: PeriodMode; label: string }[] = [
  { id: 'day', label: 'Ngày' }, { id: 'month', label: 'Tháng' }, { id: 'year', label: 'Năm' }, { id: 'range', label: 'Khoảng' },
]
const STAGES: FloorStage[] = ['PHOI', 'HAN', 'SON']

const pill = (on: boolean): React.CSSProperties => ({
  minHeight: 36, padding: '0 14px', borderRadius: 999, fontSize: 13, fontWeight: on ? 700 : 500, cursor: 'pointer',
  border: `1px solid ${on ? 'var(--blue)' : 'var(--border2)'}`,
  background: on ? 'var(--blue-bg)' : 'var(--surface)', color: on ? 'var(--blue-text)' : 'var(--text)',
})
// CSS toàn cục đặt `width: 100%` cho input/select - ô chọn nằm trong hàng bộ lọc phải co theo nội dung.
const selectStyle: React.CSSProperties = { ...input, width: 'auto' }
// DatePicker tự đặt `width: 100%` nên phải bọc trong ô có bề rộng cố định, nếu không nó chiếm cả hàng và đẩy ◀ ▶ xuống dòng khác.
const pickerBox: React.CSSProperties = { width: 150 }
// Nút ◀ ▶ lùi/tiến một kỳ. CSS toàn cục cho mọi <button> `padding: 7px 14px` nên nút 36px chỉ còn 6px cho icon (mũi tên bị bóp
// còn một vạch nhỏ) - phải đặt `padding: 0` và không cho icon co lại.
const STEP_UNIT: Record<'day' | 'month' | 'year', string> = { day: 'ngày', month: 'tháng', year: 'năm' }
function StepButton({ dir, unit, disabled, onClick }: { dir: -1 | 1; unit: string; disabled: boolean; onClick: () => void }) {
  const label = `${unit.charAt(0).toUpperCase()}${unit.slice(1)} ${dir < 0 ? 'trước' : 'sau'}`
  const Icon = dir < 0 ? ChevronLeft : ChevronRight
  return (
    <button type="button" aria-label={label} title={disabled ? undefined : label} disabled={disabled} onClick={onClick} style={{
      width: 36, height: 36, padding: 0, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8,
      border: '1px solid var(--border2)', background: 'var(--surface)', color: 'var(--text)',
      cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1, pointerEvents: disabled ? 'none' : 'auto',
    }}>
      <Icon size={18} strokeWidth={2.25} style={{ flexShrink: 0 }} aria-hidden />
    </button>
  )
}

// ─── biểu đồ cột (HTML thuần, theo dataviz: mảnh, hở 2px, lưới mờ, tooltip + bảng thay thế) ───

const PLOT_H = 180

function BarChart({ points, groupBy, unit }: { points: SeriesPoint[]; groupBy: 'day' | 'month' | 'year'; unit: string }) {
  const [hover, setHover] = useState<number | null>(null)
  const totals = points.map((p) => p.passed + p.failed)
  const ticks = niceTicks(Math.max(0, ...totals))
  const top = ticks[ticks.length - 1]
  const labelAt = labelIndexes(points.length)
  const peak = totals.indexOf(Math.max(...totals))
  const colW = points.length > 31 ? 12 : 22
  const px = (v: number) => (v > 0 ? Math.max(2, Math.round((v / top) * PLOT_H)) : 0)
  const h = hover === null ? null : points[hover]

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <div aria-hidden style={{ width: 44, position: 'relative', height: PLOT_H, marginTop: 18, flexShrink: 0 }}>
        {ticks.map((t) => (
          <span key={t} style={{
            position: 'absolute', right: 0, bottom: `${(t / top) * 100}%`, transform: 'translateY(50%)',
            fontSize: 11, color: 'var(--text2)', fontVariantNumeric: 'tabular-nums',
          }}>{fmtQty(t)}</span>
        ))}
      </div>
      <div style={{ flex: 1, overflowX: 'auto' }}>
        <div style={{ position: 'relative', minWidth: points.length * colW }}>
          <div style={{ position: 'relative', height: PLOT_H, marginTop: 18, display: 'flex', alignItems: 'stretch' }}>
            {ticks.map((t) => (
              <div key={t} aria-hidden style={{ position: 'absolute', left: 0, right: 0, bottom: `${(t / top) * 100}%`, borderTop: '1px solid var(--border)' }} />
            ))}
            {points.map((p, i) => {
              const total = p.passed + p.failed
              return (
                <div
                  key={p.bucket} tabIndex={0} role="img"
                  aria-label={`${bucketLabel(p.bucket, groupBy)}: đạt ${fmtQty(p.passed)} ${unit}, lỗi ${fmtQty(p.failed)} ${unit}, tỷ lệ đạt ${fmtRate(passRate(p))}`}
                  onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}
                  onFocus={() => setHover(i)} onBlur={() => setHover(null)}
                  style={{
                    flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center',
                    position: 'relative', outline: 'none', background: hover === i ? 'var(--surface2)' : 'transparent',
                  }}
                >
                  {i === peak && total > 0 && (
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 4, whiteSpace: 'nowrap' }}>{fmtQty(total)}</span>
                  )}
                  <div style={{ width: 'min(24px, 70%)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {p.failed > 0 && <div style={{ height: px(p.failed), background: 'var(--red)', borderRadius: '4px 4px 0 0' }} />}
                    {p.passed > 0 && <div style={{ height: px(p.passed), background: 'var(--blue)', borderRadius: p.failed > 0 ? 0 : '4px 4px 0 0' }} />}
                  </div>
                </div>
              )
            })}
            {h && hover !== null && (
              <div role="status" style={{
                position: 'absolute', top: -14, pointerEvents: 'none', zIndex: 2, minWidth: 150,
                left: `clamp(80px, ${((hover + 0.5) / points.length) * 100}%, calc(100% - 80px))`, transform: 'translateX(-50%)',
                background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 10px', boxShadow: 'var(--shadow-sm)',
              }}>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>{bucketLabel(h.bucket, groupBy)}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700 }}>
                  <span aria-hidden style={{ width: 10, height: 3, background: 'var(--blue)', borderRadius: 2 }} />Đạt {fmtQty(h.passed)} {unit}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text)' }}>
                  <span aria-hidden style={{ width: 10, height: 3, background: 'var(--red)', borderRadius: 2 }} />Lỗi {fmtQty(h.failed)} {unit}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>Tỷ lệ đạt {fmtRate(passRate(h))}</div>
              </div>
            )}
          </div>
          <div style={{ position: 'relative', height: 22, marginTop: 4 }}>
            {points.map((p, i) => labelAt.has(i) && (
              <span key={p.bucket} style={{
                position: 'absolute', top: 0, left: `${((i + 0.5) / points.length) * 100}%`, transform: 'translateX(-50%)',
                fontSize: 11, color: 'var(--text2)', whiteSpace: 'nowrap',
              }}>{bucketLabel(p.bucket, groupBy)}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text)' }}>
      <span aria-hidden style={{ width: 12, height: 12, borderRadius: 3, background: color }} />{label}
    </span>
  )
}

// ─── bảng ────────────────────────────────────────────────────────────────────

function TallyTable({ title, firstCol, rows, hint, onPick }: {
  title: string; firstCol: string; rows: ({ key: string; name: string } & Tally)[]; hint?: string
  /** Có thì tên ở cột đầu bấm được (QLSX bấm tên công nhân để xem riêng người đó). */
  onPick?: (key: string, name: string) => void
}) {
  const num: React.CSSProperties = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }
  return (
    <section style={{ ...card, padding: 0, overflow: 'hidden' }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, padding: '12px 14px 8px' }}>{title}</h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
              <th style={th}>{firstCol}</th>
              <th style={{ ...th, textAlign: 'right' }}>Đạt</th>
              <th style={{ ...th, textAlign: 'right' }}>Lỗi</th>
              <th style={{ ...th, textAlign: 'right' }}>Tỷ lệ đạt</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={td}>
                  {onPick ? (
                    <button type="button" title={`Xem riêng ${r.name}`} onClick={() => onPick(r.key, r.name)} style={{
                      background: 'none', border: 'none', padding: 0, font: 'inherit', textAlign: 'left',
                      color: 'var(--blue-text)', textDecoration: 'underline', cursor: 'pointer',
                    }}>{r.name}</button>
                  ) : r.name}
                </td>
                <td style={{ ...num, fontWeight: 700 }}>{fmtQty(r.passed)}</td>
                <td style={num}>{fmtQty(r.failed)}</td>
                <td style={num}>{fmtRate(passRate(r))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hint && <div style={{ fontSize: 12, color: 'var(--text2)', padding: '8px 14px 12px' }}>{hint}</div>}
    </section>
  )
}

// ─── màn chính ───────────────────────────────────────────────────────────────

type Result = { key: string; data: BeFloorStats | null; err: string | null }

export default function QlsxStats() {
  const today = todayVn()
  const [period, setPeriod] = useState<Period>(() => initialPeriod())
  const [stage, setStage] = useState<'' | FloorStage>('')
  const [selOp, setSelOp] = useState<StatOp | null>(null)
  const [worker, setWorker] = useState<WorkerOption>({ key: WORKER_ALL, name: 'Tất cả công nhân' })
  const [tick, setTick] = useState(0)
  const [result, setResult] = useState<Result | null>(null)
  const [exportErr, setExportErr] = useState<string | null>(null)

  const valid = isPeriodValid(period)
  const { from, to, groupBy } = resolvePeriod(period)
  const key = `${from}|${to}|${groupBy}|${stage}|${tick}`

  // Tải lại khi đổi kỳ / tổ / bấm Làm mới. Kết quả gắn với `key` đã hỏi nên kết quả cũ (về muộn) không đè lên.
  useEffect(() => {
    if (!valid) return
    let alive = true
    floorAdmin.stats({ from, to, groupBy, stage: stage || undefined })
      .then((data) => { if (alive) setResult({ key, data, err: null }) })
      .catch((e) => { if (alive) setResult((prev) => ({ key, data: prev?.data ?? null, err: e instanceof Error ? e.message : 'Không thể tải dữ liệu' })) })
    return () => { alive = false }
  }, [from, to, groupBy, stage, valid, key])

  // KCS vừa duyệt thì số mới - tự cập nhật.
  useRealtimeRefetch(['qc-reviews'], () => setTick((t) => t + 1))

  const loading = valid && (!result || result.key !== key)
  const failed = !loading && result?.key === key && result.err
  const data = result?.data ?? null

  const switchMode = (m: PeriodMode) => {
    const r = resolvePeriod(period)
    const anchor = r.to > today ? today : r.to
    setPeriod({ mode: m, day: anchor, month: anchor.slice(0, 7), year: Number(anchor.slice(0, 4)), from: r.from > anchor ? anchor : r.from, to: anchor })
  }
  const thisYear = Number(today.slice(0, 4))

  // Máy chủ trả số của mọi công nhân; lọc theo người làm ngay tại đây nên đổi người không phải gọi lại. Người đang chọn mà kỳ
  // này không có số vẫn nằm trong ô chọn (không bị trống khi đổi kỳ).
  const allRows = data?.rows ?? []
  const allPending = data?.pending ?? []
  const options = workerOptions(allRows, allPending)
  const shownOptions = worker.key === WORKER_ALL || options.some((o) => o.key === worker.key) ? options : [...options, worker]
  const byOneWorker = worker.key !== WORKER_ALL
  const rows = filterByWorker(allRows, worker.key)
  const pending = filterByWorker(allPending, worker.key)
  const totals = totalsByOp(rows)
  const op = pickOp(totals, selOp)
  const tileOps = OP_ORDER.filter((o) => totals.some((t) => t.op === o) || pending.some((p) => p.op === o && p.notSent + p.awaitingQc > 0))
  const wait = pendingText(pending)
  const series = op && data ? seriesFor(rows, op, data.buckets) : []
  const workers = op ? byWorkerFor(rows, op) : []
  const labels = op ? byLabelFor(rows, op) : []
  const dataGroupBy = data?.range.groupBy ?? groupBy

  const exportXlsx = async () => {
    if (!data) return
    setExportErr(null)
    try {
      const XLSX = await import('xlsx')
      // Xuất đúng những gì đang xem (đang lọc 1 công nhân thì file chỉ có người đó, tên file ghi tên người).
      XLSX.writeFile(buildStatsWorkbook(XLSX, { rows, pending }), statsFileName(data.range.from, data.range.to, byOneWorker ? worker.name : undefined))
    } catch (e) {
      setExportErr(e instanceof Error ? e.message : 'Không xuất được file Excel')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 style={{ fontSize: 16, fontWeight: 700 }}>Báo cáo sản lượng đạt KCS</h2>
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>
          Số KCS đã duyệt, tính theo ngày KCS duyệt (giờ Việt Nam). Số công nhân đã báo mà KCS chưa duyệt nằm ở mục “đang chờ KCS”.
        </div>
      </div>

      {/* một hàng bộ lọc phía trên mọi thứ nó chi phối */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div role="group" aria-label="Xem theo" style={{ display: 'flex', gap: 6 }}>
          {MODES.map((m) => (
            <button key={m.id} type="button" aria-pressed={period.mode === m.id} style={pill(period.mode === m.id)} onClick={() => switchMode(m.id)}>{m.label}</button>
          ))}
        </div>

        {/* ◀ [kỳ] ▶ luôn nằm cùng một hàng (không tách nhau khi màn hẹp); chế độ Khoảng có 2 ô ngày nên được phép xuống dòng */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: period.mode === 'range' ? 'wrap' : 'nowrap' }}>
          {period.mode !== 'range' && (
            <StepButton dir={-1} unit={STEP_UNIT[period.mode]} disabled={false} onClick={() => setPeriod(stepPeriod(period, -1))} />
          )}
          {period.mode === 'day' && (
            <div style={pickerBox}><DatePicker value={period.day} onChange={(v) => v && setPeriod({ ...period, day: v })} title="Chọn ngày" minHeight={36} /></div>
          )}
          {period.mode === 'month' && (
            <MonthPicker value={period.month} max={today.slice(0, 7)} current={today.slice(0, 7)} title="Chọn tháng"
              onChange={(v) => setPeriod({ ...period, month: v })} />
          )}
          {period.mode === 'year' && (
            <YearPicker value={period.year} max={thisYear} current={thisYear} title="Chọn năm"
              onChange={(v) => setPeriod({ ...period, year: v })} />
          )}
          {period.mode === 'range' && (
            <>
              <div style={pickerBox}><DatePicker value={period.from} onChange={(v) => v && setPeriod({ ...period, from: v })} title="Từ ngày" minHeight={36} /></div>
              <span aria-hidden style={{ color: 'var(--text2)' }}>–</span>
              <div style={pickerBox}><DatePicker value={period.to} onChange={(v) => v && setPeriod({ ...period, to: v })} title="Đến ngày" minHeight={36} /></div>
            </>
          )}
          {period.mode !== 'range' && (
            <StepButton dir={1} unit={STEP_UNIT[period.mode]} disabled={!canStepForward(period, today)} onClick={() => setPeriod(stepPeriod(period, 1))} />
          )}
        </div>

        <select aria-label="Tổ" style={selectStyle} value={stage} onChange={(e) => setStage(e.target.value as '' | FloorStage)}>
          <option value="">Tất cả tổ</option>
          {STAGES.map((s) => <option key={s} value={s}>Tổ {STAGE_LABEL[s]}</option>)}
        </select>

        <select aria-label="Công nhân" style={selectStyle} value={worker.key}
          onChange={(e) => {
            const o = shownOptions.find((x) => x.key === e.target.value)
            setWorker(o ?? { key: WORKER_ALL, name: 'Tất cả công nhân' })
          }}>
          <option value={WORKER_ALL}>Tất cả công nhân</option>
          {shownOptions.map((o) => <option key={o.key} value={o.key}>{o.name}</option>)}
        </select>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <RefreshButton onRefresh={() => setTick((t) => t + 1)} loading={loading} />
          <button type="button" disabled={!rows.length} onClick={() => void exportXlsx()} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 36, padding: '0 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            border: '1px solid var(--border2)', background: 'var(--surface)', color: 'var(--text)', cursor: rows.length ? 'pointer' : 'default', opacity: rows.length ? 1 : 0.55,
          }}>
            <FileSpreadsheet size={15} /> Xuất Excel
          </button>
        </div>
      </div>

      {!valid && <Notice tone="warn">Chọn đủ hai ngày, ngày bắt đầu phải trước hoặc bằng ngày kết thúc.</Notice>}
      {exportErr && <Notice tone="err">{exportErr}</Notice>}

      {valid && !data && loading && <LoadingState />}
      {valid && failed && <LoadErrorState error={failed} onRetry={() => setTick((t) => t + 1)} />}

      {valid && data && !failed && (
        // Đang tải lại thì giữ khung cũ, mờ đi (không nháy trắng).
        <div aria-busy={loading} style={{ display: 'flex', flexDirection: 'column', gap: 16, opacity: loading ? 0.55 : 1, transition: 'opacity .15s' }}>
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>
            Đã KCS duyệt · <b style={{ color: 'var(--text)' }}>{periodLabel(period)}</b>
            {byOneWorker && <> · công nhân <b style={{ color: 'var(--text)' }}>{worker.name}</b></>} · cập nhật lúc{' '}
            {new Date(data.generatedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
            {byOneWorker && (
              <button type="button" onClick={() => setWorker({ key: WORKER_ALL, name: 'Tất cả công nhân' })} style={{
                marginLeft: 10, background: 'none', border: 'none', padding: 0, font: 'inherit',
                color: 'var(--blue-text)', textDecoration: 'underline', cursor: 'pointer',
              }}>Xem tất cả công nhân</button>
            )}
          </div>

          {!rows.length && (
            <div style={{ ...card, textAlign: 'center', color: 'var(--text2)', padding: tileOps.length ? '16px' : '32px 16px' }}>
              Chưa có sản lượng nào được KCS duyệt trong {periodLabel(period)}{byOneWorker ? ` của ${worker.name}` : ''}.
            </div>
          )}

          {tileOps.length > 0 && (
            <>
              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
                {tileOps.map((o) => {
                  const t = totals.find((x) => x.op === o) ?? { op: o, passed: 0, failed: 0 }
                  const on = o === op
                  return (
                    <button key={o} type="button" aria-pressed={on} onClick={() => setSelOp(o)} style={{
                      ...card, textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 2,
                      border: `${on ? 2 : 1}px solid ${on ? 'var(--blue)' : 'var(--border)'}`,
                      background: on ? 'var(--blue-bg)' : 'var(--surface)', color: 'var(--text)', padding: on ? 15 : 16,
                    }}>
                      <span style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 600 }}>{opTitle(o)}</span>
                      <span style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2 }}>{fmtQty(t.passed)}</span>
                      <span style={{ fontSize: 13, color: 'var(--text2)' }}>Lỗi {fmtQty(t.failed)} {OP_UNIT[o]} · tỷ lệ đạt {fmtRate(passRate(t))}</span>
                    </button>
                  )
                })}
              </div>
              {wait && <Notice tone="info"><b>Đang chờ KCS{byOneWorker ? ` của ${worker.name}` : ''}</b> (tính đến bây giờ, không theo kỳ) — {wait}</Notice>}
            </>
          )}

          {op && data.buckets.length > 1 && (
            <section style={card}>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700 }}>
                  {opTitle(op)} · số đạt theo {dataGroupBy === 'day' ? 'ngày' : dataGroupBy === 'month' ? 'tháng' : 'năm'}
                </h3>
                <div style={{ display: 'flex', gap: 14 }}>
                  <Swatch color="var(--blue)" label="Đạt" />
                  <Swatch color="var(--red)" label="Lỗi" />
                </div>
              </div>
              <BarChart points={series} groupBy={dataGroupBy} unit={OP_UNIT[op]} />
              <details style={{ marginTop: 12 }}>
                <summary style={{ cursor: 'pointer', fontSize: 13, color: 'var(--text2)' }}>Xem số liệu từng {dataGroupBy === 'day' ? 'ngày' : 'tháng'}</summary>
                <div style={{ overflowX: 'auto', marginTop: 8 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <th style={th}>{dataGroupBy === 'day' ? 'Ngày' : 'Tháng'}</th>
                        <th style={{ ...th, textAlign: 'right' }}>Đạt</th>
                        <th style={{ ...th, textAlign: 'right' }}>Lỗi</th>
                        <th style={{ ...th, textAlign: 'right' }}>Tỷ lệ đạt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {series.map((p) => (
                        <tr key={p.bucket} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={td}>{bucketLabel(p.bucket, dataGroupBy)}</td>
                          <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtQty(p.passed)}</td>
                          <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtQty(p.failed)}</td>
                          <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtRate(passRate(p))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </section>
          )}

          {op && (
            <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', alignItems: 'start' }}>
              <TallyTable
                title={`${opTitle(op)} · theo công nhân`} firstCol="Công nhân"
                rows={workers.map((w) => ({ key: w.key, name: w.name, passed: w.passed, failed: w.failed }))}
                onPick={byOneWorker ? undefined : (k, name) => setWorker({ key: k, name })}
                hint={workers.some((w) => w.name === NO_WORKER) ? `“${NO_WORKER}”: đợt báo trước khi có QR, hoặc đợt công đoạn phụ gom nhiều người.` : undefined}
              />
              <TallyTable
                title={`${opTitle(op)} · theo ${OP_UNIT[op] === 'đoạn' ? 'cỡ đoạn' : 'mảnh'}`} firstCol={OP_UNIT[op] === 'đoạn' ? 'Cỡ đoạn · loại sắt' : 'Mảnh'}
                rows={labels.map((l) => ({ key: l.label, name: l.label, passed: l.passed, failed: l.failed }))}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
