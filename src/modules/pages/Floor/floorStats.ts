/**
 * Phần logic thuần của "Báo cáo sản lượng đạt KCS" (2026-10-15, changelog BE
 * docs/changelog-2026-10-08-ke-hoach-tem-qr-bo-sat-phoi.md mục 36), tách khỏi QlsxStats để kiểm thử: chọn kỳ (ngày / tháng /
 * năm / khoảng), cộng số theo loại việc - công nhân - cỡ, trục biểu đồ, bảng cho Excel. Mọi ngày tính theo GIỜ VN (UTC+7).
 */

import type { BeStatPending, BeStatRow, StatOp, StatsGroupBy } from '../../../services/floor-api'
import type { OutputRange } from './floorUi'

// ─── loại việc ───────────────────────────────────────────────────────────────

/** Thứ tự theo quy trình: Cắt → công đoạn phụ → mảnh Phôi/Hàn/Sơn. */
export const OP_ORDER: StatOp[] = ['CAT', 'UON', 'DAP', 'DUC_LO', 'TAN', 'TOP_DAU', 'XE', 'PHOI', 'HAN', 'SON']
export const OP_LABEL: Record<StatOp, string> = {
  CAT: 'Cắt', UON: 'Uốn', DAP: 'Dập', DUC_LO: 'Đục lỗ', TAN: 'Tán', TOP_DAU: 'Tóp đầu', XE: 'Xẻ',
  PHOI: 'Phôi', HAN: 'Hàn', SON: 'Sơn',
}
/** Cắt và công đoạn phụ đếm ĐOẠN sắt; Phôi (mảnh thành phẩm) / Hàn / Sơn đếm MẢNH - không cộng chung hai đơn vị. */
export const OP_UNIT: Record<StatOp, 'đoạn' | 'mảnh'> = {
  CAT: 'đoạn', UON: 'đoạn', DAP: 'đoạn', DUC_LO: 'đoạn', TAN: 'đoạn', TOP_DAU: 'đoạn', XE: 'đoạn',
  PHOI: 'mảnh', HAN: 'mảnh', SON: 'mảnh',
}
export const OP_STAGE: Record<StatOp, 'PHOI' | 'HAN' | 'SON'> = {
  CAT: 'PHOI', UON: 'PHOI', DAP: 'PHOI', DUC_LO: 'PHOI', TAN: 'PHOI', TOP_DAU: 'PHOI', XE: 'PHOI',
  PHOI: 'PHOI', HAN: 'HAN', SON: 'SON',
}
const STAGE_NAME = { PHOI: 'Phôi', HAN: 'Hàn', SON: 'Sơn' } as const

/** "Cắt (đoạn)" / "Hàn (mảnh)". */
export const opTitle = (op: StatOp) => `${OP_LABEL[op]} (${OP_UNIT[op]})`
export const NO_WORKER = 'Chưa rõ người'

// ─── kỳ báo cáo (giờ VN) ─────────────────────────────────────────────────────

export type PeriodMode = 'day' | 'month' | 'year' | 'range'

export interface Period {
  mode: PeriodMode
  /** 'YYYY-MM-DD' - dùng khi mode = day. */
  day: string
  /** 'YYYY-MM' - dùng khi mode = month. */
  month: string
  /** dùng khi mode = year. */
  year: number
  /** 'YYYY-MM-DD' - dùng khi mode = range. */
  from: string
  to: string
}

const VN_OFFSET_MS = 7 * 3600 * 1000
const DAY_MS = 24 * 3600 * 1000
const pad = (n: number) => String(n).padStart(2, '0')
const utcOf = (day: string) => { const [y, m, d] = day.split('-').map(Number); return Date.UTC(y, m - 1, d) }
const dayOf = (utc: number) => { const t = new Date(utc); return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}` }
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate()

/** Hôm nay theo giờ VN ('YYYY-MM-DD'), không phụ thuộc múi giờ máy đang mở. */
export function todayVn(now: Date = new Date()): string {
  return dayOf(now.getTime() + VN_OFFSET_MS)
}

export function addDays(day: string, n: number): string {
  return dayOf(utcOf(day) + n * DAY_MS)
}

/** Số ngày lịch trong [from, to] (gồm hai đầu); âm/0 khi from > to thì trả ≤ 0. */
export function spanOf(from: string, to: string): number {
  return Math.round((utcOf(to) - utcOf(from)) / DAY_MS) + 1
}

export function initialPeriod(today: string = todayVn()): Period {
  return {
    mode: 'month',
    day: today,
    month: today.slice(0, 7),
    year: Number(today.slice(0, 4)),
    from: `${today.slice(0, 8)}01`,
    to: today,
  }
}

/** Khoảng ngày thật + cách chia cột: ngày/tháng → theo ngày, năm → theo tháng, khoảng → theo ngày nếu ≤ 92 ngày. */
export function resolvePeriod(p: Period): { from: string; to: string; groupBy: StatsGroupBy } {
  if (p.mode === 'day') return { from: p.day, to: p.day, groupBy: 'day' }
  if (p.mode === 'month') {
    const [y, m] = p.month.split('-').map(Number)
    return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(daysInMonth(y, m))}`, groupBy: 'day' }
  }
  if (p.mode === 'year') return { from: `${p.year}-01-01`, to: `${p.year}-12-31`, groupBy: 'month' }
  return { from: p.from, to: p.to, groupBy: spanOf(p.from, p.to) <= 92 ? 'day' : 'month' }
}

/** Khoảng tự chọn: cần cả hai ngày, đầu ≤ cuối. Các chế độ khác luôn hợp lệ. */
export function isPeriodValid(p: Period): boolean {
  if (p.mode !== 'range') return true
  return /^\d{4}-\d{2}-\d{2}$/.test(p.from) && /^\d{4}-\d{2}-\d{2}$/.test(p.to) && spanOf(p.from, p.to) >= 1
}

/** Lùi/tiến 1 kỳ (◀ ▶): 1 ngày, 1 tháng, 1 năm, hoặc đúng bằng độ dài khoảng đang chọn. */
export function stepPeriod(p: Period, dir: 1 | -1): Period {
  if (p.mode === 'day') return { ...p, day: addDays(p.day, dir) }
  if (p.mode === 'month') {
    const [y, m] = p.month.split('-').map(Number)
    const idx = y * 12 + (m - 1) + dir
    return { ...p, month: `${Math.floor(idx / 12)}-${pad((idx % 12) + 1)}` }
  }
  if (p.mode === 'year') return { ...p, year: p.year + dir }
  const span = spanOf(p.from, p.to)
  return { ...p, from: addDays(p.from, dir * span), to: addDays(p.to, dir * span) }
}

/**
 * Khoảng ngày VN ('YYYY-MM-DD') của các nút "7 ngày qua / Tháng này / Tháng trước" ở màn công nhân - để hỏi số đã KCS duyệt
 * đúng cùng khoảng với danh sách số đã báo.
 */
export function outputRangeDays(range: OutputRange, today: string = todayVn()): { from: string; to: string } {
  if (range === '7d') return { from: addDays(today, -6), to: today }
  const [y, m] = today.split('-').map(Number)
  if (range === 'month') return { from: `${y}-${pad(m)}-01`, to: today }
  const idx = y * 12 + (m - 1) - 1
  const py = Math.floor(idx / 12)
  const pm = (idx % 12) + 1
  return { from: `${py}-${pad(pm)}-01`, to: `${py}-${pad(pm)}-${pad(daysInMonth(py, pm))}` }
}

/** Không cho tiến sang kỳ bắt đầu sau hôm nay (chưa có số liệu). */
export function canStepForward(p: Period, today: string = todayVn()): boolean {
  return resolvePeriod(stepPeriod(p, 1)).from <= today
}

const dmy = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}`

export function periodLabel(p: Period): string {
  if (p.mode === 'day') return `ngày ${dmy(p.day)}`
  if (p.mode === 'month') return `tháng ${p.month.slice(5, 7)}/${p.month.slice(0, 4)}`
  if (p.mode === 'year') return `năm ${p.year}`
  return `${dmy(p.from)} – ${dmy(p.to)}`
}

/** Nhãn cột/dòng của 1 khoá kỳ: "15/10" | "10/2026" | "2026". */
export function bucketLabel(bucket: string, groupBy: StatsGroupBy): string {
  if (groupBy === 'day') return `${bucket.slice(8, 10)}/${bucket.slice(5, 7)}`
  if (groupBy === 'month') return `${bucket.slice(5, 7)}/${bucket.slice(0, 4)}`
  return bucket
}

// ─── cộng số ─────────────────────────────────────────────────────────────────

export interface Tally { passed: number; failed: number }
export interface OpTotal extends Tally { op: StatOp }

/** Tỷ lệ đạt = đạt / (đạt + lỗi); null khi chưa có gì để tính. */
export function passRate(t: Tally): number | null {
  const all = t.passed + t.failed
  return all === 0 ? null : t.passed / all
}

/**
 * Tỷ lệ đạt theo phần trăm, làm tròn 1 số lẻ - nhưng KHÔNG BAO GIỜ ra 100 khi còn lỗi: 55.541 đạt / 23 lỗi là 99,96% sẽ bị
 * làm tròn thành 100% và che mất lỗi, nên trần ở 99,9. null khi chưa có số.
 */
export function ratePct(r: number | null): number | null {
  if (r === null) return null
  const p = Math.round(r * 1000) / 10
  return r < 1 && p >= 100 ? 99.9 : p
}

/** "99,4%" (1 số lẻ, dấu phẩy kiểu VN); "—" khi không có số. */
export function fmtRate(r: number | null): string {
  const p = ratePct(r)
  return p === null ? '—' : `${p.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`
}

export const fmtQty = (n: number) => n.toLocaleString('vi-VN')

const rank = (op: StatOp) => OP_ORDER.indexOf(op)

/** Tổng đạt/lỗi theo loại việc, đúng thứ tự quy trình. */
export function totalsByOp(rows: BeStatRow[]): OpTotal[] {
  const m = new Map<StatOp, Tally>()
  for (const r of rows) {
    const cur = m.get(r.op) ?? { passed: 0, failed: 0 }
    cur.passed += r.passed
    cur.failed += r.failed
    m.set(r.op, cur)
  }
  return [...m.entries()].map(([op, t]) => ({ op, ...t })).sort((a, b) => rank(a.op) - rank(b.op))
}

/** Loại việc đang xem: giữ lựa chọn nếu còn số liệu, không thì loại nhiều nhất (đạt). null khi trống. */
export function pickOp(totals: OpTotal[], selected: StatOp | null): StatOp | null {
  if (selected && totals.some((t) => t.op === selected)) return selected
  if (!totals.length) return null
  return [...totals].sort((a, b) => b.passed - a.passed || rank(a.op) - rank(b.op))[0].op
}

export interface SeriesPoint extends Tally { bucket: string }

/** Đạt/lỗi của 1 loại việc theo từng kỳ; kỳ không có số = 0 (cột trống thay vì bị nhảy cóc). */
export function seriesFor(rows: BeStatRow[], op: StatOp, buckets: string[]): SeriesPoint[] {
  const m = new Map<string, Tally>(buckets.map((b) => [b, { passed: 0, failed: 0 }]))
  for (const r of rows) {
    if (r.op !== op) continue
    const cur = m.get(r.bucket) ?? { passed: 0, failed: 0 }
    cur.passed += r.passed
    cur.failed += r.failed
    m.set(r.bucket, cur)
  }
  return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([bucket, t]) => ({ bucket, ...t }))
}

export interface WorkerTotal extends Tally { key: string; name: string }

/** Theo công nhân (1 loại việc), nhiều đạt nhất trước; đợt không có người gom vào "Chưa rõ người". */
export function byWorkerFor(rows: BeStatRow[], op: StatOp): WorkerTotal[] {
  const m = new Map<string, WorkerTotal>()
  for (const r of rows) {
    if (r.op !== op) continue
    const key = r.workerId ?? ''
    const cur = m.get(key) ?? { key, name: r.workerId ? (r.workerName ?? r.workerId) : NO_WORKER, passed: 0, failed: 0 }
    cur.passed += r.passed
    cur.failed += r.failed
    m.set(key, cur)
  }
  return [...m.values()].sort((a, b) => b.passed - a.passed || a.name.localeCompare(b.name, 'vi'))
}

export interface LabelTotal extends Tally { label: string }

/** Theo cỡ đoạn / mảnh (1 loại việc), nhiều đạt nhất trước. */
export function byLabelFor(rows: BeStatRow[], op: StatOp): LabelTotal[] {
  const m = new Map<string, LabelTotal>()
  for (const r of rows) {
    if (r.op !== op) continue
    const cur = m.get(r.label) ?? { label: r.label, passed: 0, failed: 0 }
    cur.passed += r.passed
    cur.failed += r.failed
    m.set(r.label, cur)
  }
  return [...m.values()].sort((a, b) => b.passed - a.passed || a.label.localeCompare(b.label, 'vi', { numeric: true }))
}

type PendingLike = Pick<BeStatPending, 'op' | 'notSent' | 'awaitingQc'>

/** Cộng số đang chờ của mọi công nhân lại theo loại việc, đúng thứ tự quy trình. */
export function pendingByOp(pending: PendingLike[]): PendingLike[] {
  const m = new Map<StatOp, PendingLike>()
  for (const p of pending) {
    const cur = m.get(p.op) ?? { op: p.op, notSent: 0, awaitingQc: 0 }
    cur.notSent += p.notSent
    cur.awaitingQc += p.awaitingQc
    m.set(p.op, cur)
  }
  return [...m.values()].sort((a, b) => rank(a.op) - rank(b.op))
}

// ─── lọc theo công nhân (QLSX xem từng người) ────────────────────────────────

/** Giá trị "tất cả công nhân" của bộ lọc. Khoá "Chưa rõ người" là chuỗi rỗng; công nhân thật dùng id. */
export const WORKER_ALL = 'all'
export interface WorkerOption { key: string; name: string }

/** Công nhân có mặt trong số liệu (đã duyệt hoặc đang chờ), xếp theo tên; "Chưa rõ người" để cuối. */
export function workerOptions(rows: BeStatRow[], pending: BeStatPending[]): WorkerOption[] {
  const m = new Map<string, string>()
  for (const x of [...rows, ...pending]) {
    const key = x.workerId ?? ''
    if (!m.has(key)) m.set(key, x.workerId ? (x.workerName ?? x.workerId) : NO_WORKER)
  }
  return [...m.entries()]
    .map(([key, name]) => ({ key, name }))
    .sort((a, b) => (a.key === '' ? 1 : b.key === '' ? -1 : a.name.localeCompare(b.name, 'vi')))
}

/** Giữ lại số của 1 công nhân (hoặc tất cả). Dùng chung cho dòng đã duyệt và dòng đang chờ. */
export function filterByWorker<T extends { workerId: string | null }>(items: T[], key: string): T[] {
  return key === WORKER_ALL ? items : items.filter((i) => (i.workerId ?? '') === key)
}

/** Dạng không dấu, gạch nối - cho tên file: "Nguyễn Văn An" → "Nguyen-Van-An". */
export function slugName(name: string): string {
  return name
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/Đ/g, 'D').replace(/đ/g, 'd')
    .replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

/** "Cắt: 125 đoạn chưa gửi, 136 đoạn chờ KCS · Hàn: 13 mảnh chờ KCS" - số đã báo mà KCS chưa duyệt. Rỗng khi không có gì chờ. */
export function pendingText(pending: PendingLike[]): string {
  return OP_ORDER.map((op) => pendingByOp(pending).find((p) => p.op === op))
    .filter((p): p is PendingLike => !!p && p.notSent + p.awaitingQc > 0)
    .map((p) => {
      const parts: string[] = []
      if (p.notSent > 0) parts.push(`${fmtQty(p.notSent)} ${OP_UNIT[p.op]} chưa gửi`)
      if (p.awaitingQc > 0) parts.push(`${fmtQty(p.awaitingQc)} ${OP_UNIT[p.op]} chờ KCS`)
      return `${OP_LABEL[p.op]}: ${parts.join(', ')}`
    })
    .join(' · ')
}

// ─── trục biểu đồ ────────────────────────────────────────────────────────────

/**
 * Vạch trục tung tròn số (0, 50, 100, 150 / 0, 1, 2, 3...), tối đa 4 khoảng, vạch cuối ≥ `max`. Số nguyên cho đếm
 * đoạn/mảnh nên bước tối thiểu 1.
 */
export function niceTicks(max: number): number[] {
  if (!(max > 0)) return [0, 1]
  let step = 1
  const bases = [1, 2, 5]
  for (let p = 1; ; p *= 10) {
    const hit = bases.map((b) => b * p).find((s) => max / s <= 4)
    if (hit) { step = hit; break }
  }
  const ticks = [0]
  while (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step)
  return ticks
}

/** Chỉ số cột được ghi nhãn trục ngang: tối đa ~`max` nhãn, luôn gồm cột đầu. */
export function labelIndexes(n: number, max = 10): Set<number> {
  const step = Math.max(1, Math.ceil(n / max))
  const s = new Set<number>()
  for (let i = 0; i < n; i += step) s.add(i)
  return s
}

// ─── bảng cho Excel ──────────────────────────────────────────────────────────

type Cell = string | number

/** Sheet "Chi tiết": mỗi dòng 1 (kỳ, loại việc, công nhân, cỡ/mảnh). */
export function detailAoa(rows: BeStatRow[]): Cell[][] {
  return [
    ['Kỳ', 'Tổ', 'Loại việc', 'Công nhân', 'Cỡ đoạn / mảnh', 'Đơn vị', 'Đạt', 'Lỗi'],
    ...rows.map((r) => [
      r.bucket, STAGE_NAME[OP_STAGE[r.op]], OP_LABEL[r.op], r.workerName ?? NO_WORKER, r.label, OP_UNIT[r.op], r.passed, r.failed,
    ]),
  ]
}

/** Sheet "Theo công nhân": mỗi dòng 1 (loại việc, công nhân). */
export function workerAoa(rows: BeStatRow[]): Cell[][] {
  const out: Cell[][] = [['Loại việc', 'Công nhân', 'Đơn vị', 'Đạt', 'Lỗi', 'Tỷ lệ đạt (%)']]
  for (const t of totalsByOp(rows)) {
    for (const w of byWorkerFor(rows, t.op)) {
      out.push([OP_LABEL[t.op], w.name, OP_UNIT[t.op], w.passed, w.failed, ratePct(passRate(w)) ?? ''])
    }
  }
  return out
}

/** Sheet "Tổng": mỗi dòng 1 loại việc, kèm số đang chờ KCS (tính đến lúc xuất). */
export function summaryAoa(rows: BeStatRow[], pending: PendingLike[]): Cell[][] {
  const totals = new Map(totalsByOp(rows).map((t) => [t.op, t]))
  const wait = new Map(pendingByOp(pending).map((p) => [p.op, p]))
  const ops = OP_ORDER.filter((op) => totals.has(op) || wait.has(op))
  return [
    ['Loại việc', 'Đơn vị', 'Đạt', 'Lỗi', 'Tỷ lệ đạt (%)', 'Đã báo, chưa gửi KCS', 'Đã gửi, chờ KCS'],
    ...ops.map((op) => {
      const t = totals.get(op) ?? { passed: 0, failed: 0 }
      return [OP_LABEL[op], OP_UNIT[op], t.passed, t.failed, ratePct(passRate(t)) ?? '', wait.get(op)?.notSent ?? 0, wait.get(op)?.awaitingQc ?? 0]
    }),
  ]
}

/** Tên file: "Bao-cao-san-luong_2026-10-01_2026-10-15.xlsx"; lọc 1 công nhân thì thêm tên: "..._Nguyen-Van-An.xlsx". */
export const statsFileName = (from: string, to: string, worker?: string) =>
  `Bao-cao-san-luong_${from}_${to}${worker ? `_${slugName(worker)}` : ''}.xlsx`
