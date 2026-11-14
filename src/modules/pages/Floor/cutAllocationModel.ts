/**
 * Hàm thuần của tab "Chia máy cắt": gom dòng theo máy, dựng chữ hiển thị và HTML phiếu in.
 * Nghiệp vụ chia nằm ở BE (`/floor/cut-allocation`); ở đây chỉ trình bày bảng BE trả về.
 */
import type {
  BeCutAllocationBoard, BeCutAllocationLogByOrder, BeCutAllocationLogEntry, BeCutAllocationMachine, BeCutAllocationRow,
  BeCutAllocationSegment, CutAllocationReason, CutMachineStatus, CutSegmentStep,
} from '../../../services/floor-api'
import { fmtBundles, MACHINE_LABEL } from '../../../utils/cutMachine'
import { fmtNum } from '../../../utils/numberFormat'

/** Nhãn bước trên đoạn; DUC_LO (đục lỗ) gọi là "Khoan" theo cách xưởng nói. */
export const STEP_BADGE: Record<CutSegmentStep, string> = { UON: 'Uốn', DAP: 'Dập', DUC_LO: 'Khoan', TAN: 'Tán' }
const STEP_ORDER: CutSegmentStep[] = ['UON', 'DAP', 'DUC_LO', 'TAN']

export interface MachineGroup {
  machine: BeCutAllocationMachine
  rows: BeCutAllocationRow[]
}

/** Gom dòng theo máy, giữ thứ tự máy của BE; trong máy sắp theo seq rồi id (BE đã sắp, sắp lại cho chắc). */
export function groupRowsByMachine(board: Pick<BeCutAllocationBoard, 'machines' | 'rows'>): MachineGroup[] {
  return board.machines.map((machine) => ({
    machine,
    rows: board.rows
      .filter((r) => r.workstationId === machine.id)
      .sort((a, b) => a.seq - b.seq || Number(a.id) - Number(b.id)),
  }))
}

/** "2026-11-13" -> "13/11"; rỗng/sai dạng -> null. */
export function fmtDayMonth(ymd: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd ?? '')
  return m ? `${m[3]}/${m[2]}` : null
}

/** "2026-11-13" -> "13/11/2026". */
export function fmtDayMonthYear(ymd: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd ?? '')
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null
}

export interface PriorityChip { key: 'phoiStart' | 'bookingDue' | 'deadline'; text: string }

/** Chip ưu tiên của dòng: "N1 13/11", "Booking 15/11", "Hạn 20/11" - cái nào có thì hiện. */
export function priorityChips(p: BeCutAllocationRow['priority']): PriorityChip[] {
  const out: PriorityChip[] = []
  const n1 = fmtDayMonth(p.phoiStart)
  const bk = fmtDayMonth(p.bookingDue)
  const dl = fmtDayMonth(p.deadline)
  if (n1) out.push({ key: 'phoiStart', text: `N1 ${n1}` })
  if (bk) out.push({ key: 'bookingDue', text: `Booking ${bk}` })
  if (dl) out.push({ key: 'deadline', text: `Hạn ${dl}` })
  return out
}

/** "425×3 + 590×2" (đoạn × số đoạn trên 1 cây). */
export function cutPatternText(segments: Pick<BeCutAllocationSegment, 'cutLengthMm' | 'countPerBar'>[]): string {
  return segments.map((s) => `${fmtNum(s.cutLengthMm)}×${s.countPerBar}`).join(' + ')
}

/** Các bước của đoạn theo thứ tự cố định Uốn, Dập, Khoan, Tán -> nhãn tiếng Việt. */
export function stepBadges(steps: CutSegmentStep[]): string[] {
  return STEP_ORDER.filter((s) => steps.includes(s)).map((s) => STEP_BADGE[s])
}

/** "Dập 590×2" cho đoạn dập trên cây (BE: punchedSegments); rỗng/null -> "". */
export function punchedText(punched: { cutLengthMm: number; countPerBar: number }[] | null | undefined): string {
  return (punched ?? []).map((s) => `${fmtNum(s.cutLengthMm)}×${s.countPerBar}`).join(' + ')
}

/** "Đoạn dư cả loại: 425×3" - rỗng khi không dư. */
export function surplusText(surplus: { cutLengthMm: number; surplus: number }[]): string {
  return surplus.filter((s) => s.surplus > 0).map((s) => `${fmtNum(s.cutLengthMm)}×${s.surplus}`).join(' + ')
}

/** Giải thích số đoạn đã báo (hiện trong title của dòng tiến độ). */
export const PROGRESS_TITLE =
  'Số đoạn đã báo qua QR tại máy, cộng theo từng cặp lệnh và loại sắt - chỉ là số xấp xỉ'

/** "Đã báo ≈12/40 đoạn" - số đã báo là xấp xỉ nên luôn có dấu ≈. */
export function progressText(m: Pick<BeCutAllocationMachine, 'reportedSegments' | 'plannedSegments'>): string {
  return `Đã báo ≈${fmtNum(m.reportedSegments)}/${fmtNum(m.plannedSegments)} đoạn`
}

/** Chi tiết ra: gộp tên mảnh của mọi đoạn, bỏ trùng, giữ thứ tự gặp. */
export function pieceNamesOf(segments: BeCutAllocationSegment[]): string[] {
  const seen = new Set<string>()
  for (const s of segments) for (const n of s.pieceNames) if (n) seen.add(n)
  return [...seen]
}

/** Thứ tự dòng mới của máy khi đưa dòng `id` lên/xuống 1 bậc; không đổi được (đầu/cuối/không thấy) -> null. */
export function moveRowIds(orderedIds: string[], id: string, dir: 'up' | 'down'): string[] | null {
  const i = orderedIds.indexOf(id)
  if (i < 0) return null
  const j = dir === 'up' ? i - 1 : i + 1
  if (j < 0 || j >= orderedIds.length) return null
  const next = [...orderedIds]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}

/**
 * LUẬT DỰ PHÒNG khi BE chưa trả `allowedMachineIds`: dòng LASER (cây có đoạn dập) không sang máy tự động khi xưởng
 * cho laze và có máy laze. Xưởng khoá máy tự động hoặc chưa có laze thì máy nào cũng nhận.
 */
export function machineAcceptsRow(
  machine: Pick<BeCutAllocationMachine, 'cutMachineType'>,
  row: Pick<BeCutAllocationRow, 'machineClass'>,
  machines: Pick<BeCutAllocationMachine, 'cutMachineType'>[],
  laserAllowed: boolean,
): boolean {
  if (row.machineClass !== 'LASER' || !laserAllowed) return true
  if (!machines.some((m) => m.cutMachineType === 'laser')) return true
  return machine.cutMachineType === 'laser'
}

/** Số cây hợp lệ cho ô sửa số cây / tách (BE kiểm chặt hơn và báo lỗi nguyên câu). */
export function isValidBarCount(v: number): boolean {
  return Number.isInteger(v) && v >= 1
}

/** Nhãn lớp máy của dòng: null = không hiện nhãn. */
export interface ClassLabel { text: string; tone: 'gray' | 'amber' | 'red' }

/**
 * Nhãn lớp máy theo (lớp của dòng, loại máy của thẻ, xưởng có laze hay không). Chỉ hiện khi có điều cần lưu ý,
 * để cây không có đoạn dập trên máy laze khỏi mang nhãn "MC Tự động".
 */
export function rowClassLabel(
  rowClass: BeCutAllocationRow['machineClass'], machineType: BeCutAllocationMachine['cutMachineType'], hasLaser: boolean,
): ClassLabel | null {
  if (!hasLaser) return rowClass === 'LASER' ? { text: 'Lỗ làm tay', tone: 'amber' } : null
  if (rowClass === 'LASER') return machineType === 'laser' ? null : { text: 'Cây có đoạn dập – nên cắt laze', tone: 'red' }
  return machineType === 'laser' ? { text: 'Cắt được máy tự động', tone: 'gray' } : null
}

/** Xưởng có laze thật: cho phép laze và có ít nhất 1 máy laze. */
export function workshopHasLaser(laserAllowed: boolean, machines: Pick<BeCutAllocationMachine, 'cutMachineType'>[]): boolean {
  return laserAllowed && machines.some((m) => m.cutMachineType === 'laser')
}

/** Luật chia hiển thị trong "Cách hệ thống chia": mỗi câu một gạch đầu dòng, chỉ nói luật đúng với xưởng đang xem. */
export function explainLines(hasLaser: boolean): string[] {
  return [
    'Lệnh có N1 sớm, booking gần thì chia trước.',
    'Chỉ chia loại sắt đã đủ sắt; chưa đủ nằm ở “Chờ sắt”.',
    hasLaser
      ? 'Cây có đoạn dập cắt máy laze; cây không lỗ hoặc chỉ khoan, tán cắt máy tự động.'
      : 'Mọi cây vào máy tự động; cây có đoạn dập thì làm lỗ tay.',
    'Lệnh ít quy cách thì chia đều cây cho các máy.',
    'Lệnh nhiều quy cách thì chia theo tỉ lệ, tối đa 3 máy cho quy cách lớn nhất.',
    'Mỗi máy tính theo số cây còn phải cắt, nên máy sắp rảnh nhận phần lớn.',
    'Trên mỗi máy, kiểu cắt có đoạn uốn được cắt trước để chuyển uốn sớm.',
    'Máy cắt hết việc được chia thì hệ thống tự kéo lệnh kế tiếp đủ sắt mà máy cắt được, thêm vào cuối việc của máy.',
    'Chỉ kéo lệnh đã Bắt đầu và không chờ KHSX kiểm lại phương án cắt; lệnh gần nhất trước. Sau đó báo QLSX và KHSX.',
    'Sắt còn trong kho thì báo thủ kho xuất ngay.',
  ]
}

/** Nhóm các dòng LIỀN NHAU cùng lệnh + loại sắt + chiều dài cây. */
export interface RowRun { key: string; rows: BeCutAllocationRow[] }

/**
 * Gom dòng kề nhau cùng lệnh + loại sắt + chiều dài cây. Thứ tự dòng trên máy là thứ tự cắt (seq) nên chỉ gom các dòng
 * đứng cạnh nhau, không xếp lại: lệnh A, B, A cho 3 nhóm.
 */
export function groupAdjacentRows(rows: BeCutAllocationRow[]): RowRun[] {
  const runs: RowRun[] = []
  for (const r of rows) {
    const last = runs[runs.length - 1]
    const l = last?.rows[0]
    if (last && l && l.productionInvoiceId === r.productionInvoiceId && l.materialId === r.materialId && l.barLengthMm === r.barLengthMm) {
      last.rows.push(r)
    } else {
      runs.push({ key: r.id, rows: [r] })
    }
  }
  return runs
}

/** Tổng cây lớn nhất trong các máy của bảng - mẫu số của thanh tải. */
export function maxMachineBars(machines: Pick<BeCutAllocationMachine, 'totalBars'>[]): number {
  return machines.reduce((mx, m) => Math.max(mx, m.totalBars), 0)
}

/** Độ dài thanh tải (0-100, làm tròn) = cây của máy ÷ cây của máy nhiều nhất. */
export function loadPercent(totalBars: number, maxBars: number): number {
  if (!(maxBars > 0) || !(totalBars > 0)) return 0
  return Math.min(100, Math.round((totalBars / maxBars) * 100))
}

/** Chú thích thanh trên thẻ máy (một thanh cho cả tải lẫn tiến độ). */
export const LOAD_BAR_TITLE =
  'Độ dài phần tô màu = số cây của máy so với máy nhiều việc nhất; ' +
  'trong đó xanh lá = cây ước đã cắt, xanh dương = cây còn lại'

/**
 * Một thanh cho thẻ máy: phần tô màu dài = tải (cây của máy ÷ cây của máy nhiều nhất); trong phần đó xanh lá =
 * cây ước đã cắt, xanh dương = cây còn lại. Trả % theo CẢ thanh.
 */
export function loadBarSegments(totalBars: number, maxBars: number, barsDoneEst: number): { donePct: number; leftPct: number } {
  const load = loadPercent(totalBars, maxBars)
  if (load === 0) return { donePct: 0, leftPct: 0 }
  const share = Math.min(1, Math.max(0, barsDoneEst) / totalBars)
  const donePct = Math.round(load * share * 10) / 10
  return { donePct, leftPct: Math.round((load - donePct) * 10) / 10 }
}

// ─── Phiếu in ────────────────────────────────────────────────────────────────

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Ô "Khoan/Dập/Uốn" của phiếu: "Uốn 425; Dập 590; Khoan 425" - rỗng khi cây chỉ cắt thẳng. */
export function stepsCellText(segments: BeCutAllocationSegment[]): string {
  const parts: string[] = []
  for (const step of STEP_ORDER) {
    const lens = segments.filter((s) => s.steps.includes(step)).map((s) => fmtNum(s.cutLengthMm))
    if (lens.length > 0) parts.push(`${STEP_BADGE[step]} ${lens.join(', ')}`)
  }
  return parts.join('; ')
}

/** "Xưởng Phú An" - tên xưởng đã có chữ "Xưởng" thì không thêm lần nữa. */
export function workshopLabel(name: string | null | undefined): string {
  const n = (name ?? '').trim()
  return /^xưởng\s/i.test(n) ? n : `Xưởng ${n}`.trim()
}

export function machineTitle(m: Pick<BeCutAllocationMachine, 'code' | 'name'>): string {
  return `${m.code} · ${m.name}`
}

/** Tiêu đề phiếu: "PHIẾU CẮT · LASER-01 · Máy 1 · Phú An · 13/11/2026". */
export function sheetTitle(m: Pick<BeCutAllocationMachine, 'code' | 'name'>, workshopName: string, dateText: string): string {
  return `PHIẾU CẮT · ${machineTitle(m)} · ${workshopName} · ${dateText}`
}

const SHEET_COLS = [4, 10, 14, 8, 6, 18, 14, 16, 10]
const SHEET_HEAD = [
  '<th class="num">STT</th>', '<th>Lệnh</th>', '<th>Loại sắt</th>', '<th class="num">Cây (mm)</th>', '<th class="num">Số cây</th>',
  '<th>Kiểu cắt (đoạn × số)</th>', '<th>Khoan/Dập/Uốn</th>', '<th>Chi tiết ra</th>', '<th>Đoạn dư</th>',
].join('')

/** Một trang phiếu của 1 máy. `pageBreakBefore` dùng khi in nhiều máy (mỗi máy 1 trang). */
export function buildMachineSheetHtml(
  group: MachineGroup, workshopName: string, dateText: string, pageBreakBefore: boolean,
): string {
  const { machine, rows } = group
  const body = rows.map((r, i) => {
    const bundle = fmtBundles(r.bundles) ?? ''
    const pattern = cutPatternText(r.segments) + (bundle ? ` (${bundle})` : '')
    const surplus = surplusText(r.lineSurplus)
    return `<tr><td class="num">${i + 1}</td><td>${escapeHtml(r.piCode)}</td><td>${escapeHtml(r.materialLabel)}</td>` +
      `<td class="num">${fmtNum(r.barLengthMm)}</td><td class="num">${fmtNum(r.barCount)}</td>` +
      `<td>${escapeHtml(pattern)}</td><td>${escapeHtml(stepsCellText(r.segments))}</td>` +
      `<td>${escapeHtml(pieceNamesOf(r.segments).join(', '))}</td><td>${escapeHtml(surplus)}</td></tr>`
  }).join('')
  const empty = rows.length === 0 ? '<tr><td colspan="9">Máy này chưa có dòng nào.</td></tr>' : ''
  return `
    <div${pageBreakBefore ? ' style="page-break-before: always"' : ''}>
      <h2>${escapeHtml(sheetTitle(machine, workshopName, dateText))}</h2>
      <p>${escapeHtml(MACHINE_LABEL[machine.cutMachineType] ?? '')} · Tổng <b>${fmtNum(machine.totalBars)} cây</b>
        · ${fmtNum(rows.length)} dòng</p>
      <table><colgroup>${SHEET_COLS.map((w) => `<col style="width:${w}%">`).join('')}</colgroup>
        <thead><tr>${SHEET_HEAD}</tr></thead>
        <tbody>${body}${empty}</tbody></table>
    </div>`
}

export const SHEET_CSS = `
    @media print { @page { size: A4 landscape; margin: 1cm; } .no-print { display: none; } }
    :root { color-scheme: light; }
    body { font-family: Arial, sans-serif; background: #fff; color: #111; }
    h2 { font-size: 1.1rem; margin: 0 0 4px; }
    p { margin: 0 0 8px; font-size: 0.85rem; }
    table { width: 100%; border-collapse: collapse; font-size: 0.8rem; table-layout: fixed; margin-bottom: 16px; }
    th, td { border: 1px solid #ccc; padding: 5px; text-align: left; vertical-align: middle; word-wrap: break-word; }
    th.num, td.num { text-align: right; }
    th { background-color: #f2f2f2; font-weight: bold; }
    .no-print { margin-bottom: 12px; }
    .no-print button {
      padding: 8px 16px; font-size: 14px; font-weight: 600; border: none; border-radius: 6px;
      background: #e65100; color: #fff; cursor: pointer;
    }
  `

/** Cả tài liệu in: mỗi máy 1 trang. Máy không có dòng nào bị bỏ khi in nhiều máy (`skipEmpty`). */
export function buildCutSheetsDocument(
  groups: MachineGroup[], workshopName: string, dateText: string, skipEmpty = false,
): string {
  const list = skipEmpty ? groups.filter((g) => g.rows.length > 0) : groups
  const sections = list.map((g, i) => buildMachineSheetHtml(g, workshopName, dateText, i > 0)).join('')
  const title = list.length === 1 ? sheetTitle(list[0].machine, workshopName, dateText) : `Phiếu cắt · ${workshopName} · ${dateText}`
  return `<html><head><title>${escapeHtml(title)}</title><style>${SHEET_CSS}</style></head><body>` +
    `<div class="no-print"><button onclick="window.print()">In / Lưu PDF</button></div>${sections}</body></html>`
}

// ─── Dòng theo bó, lý do điều chuyển, lịch sử chia tay ───────────────────────

export const BUNDLE_SPLIT_HINT = 'Kiểu cắt theo bó không tách sang máy khác'
export const BUNDLE_BARS_HINT = 'Kiểu cắt theo bó không đổi số cây'
export const BUNDLE_MOVE_HINT = 'Kiểu cắt theo bó chỉ đổi máy khi máy hư'
export const NOTE_MAX = 300

/** Dòng theo bó: khoá nút Tách và ô số cây; đổi máy phải qua hộp xác nhận "Máy hư". */
export function isBundleRow(row: Pick<BeCutAllocationRow, 'isBundle'>): boolean {
  return row.isBundle === true
}

/** Nút "Tách" bấm được: dòng thường có từ 2 cây trở lên; dòng theo bó thì không. */
export function canSplitRow(row: Pick<BeCutAllocationRow, 'isBundle' | 'barCount'>): boolean {
  return !isBundleRow(row) && row.barCount >= 2
}

export type ReasonChoice = CutAllocationReason | ''

export const REASON_LABEL: Record<CutAllocationReason, string> = { MACHINE_BROKEN: 'Máy hư', OTHER: 'Khác' }

export function reasonLabel(reason: CutAllocationReason | null | undefined): string {
  return reason ? REASON_LABEL[reason] : ''
}

/**
 * Phần lý do + ghi chú gửi lên BE. Dòng theo bó đổi máy: luôn là "Máy hư". Chưa chọn lý do thì không gửi `reason`;
 * ghi chú rỗng thì bỏ, quá 300 ký tự thì cắt.
 */
export function reasonPayload(reason: ReasonChoice, note: string): { reason?: CutAllocationReason; note?: string } {
  const out: { reason?: CutAllocationReason; note?: string } = {}
  if (reason) out.reason = reason
  const n = note.trim().slice(0, NOTE_MAX)
  if (n) out.note = n
  return out
}

/** Hộp xác nhận đổi máy của dòng theo bó chỉ cho bấm khi đã chọn "Máy hư". */
export function canConfirmBundleMove(reason: ReasonChoice): boolean {
  return reason === 'MACHINE_BROKEN'
}

export const LOG_ACTION_LABEL: Record<BeCutAllocationLogEntry['action'], string> = {
  ADD: 'Thêm', SPLIT: 'Tách', MOVE: 'Đổi máy', BARS: 'Đổi số cây', REMOVE: 'Xoá', AUTO_PULL: 'Hệ thống kéo (máy rảnh)',
}

export function logActionLabel(action: BeCutAllocationLogEntry['action']): string {
  return LOG_ACTION_LABEL[action] ?? action
}

/** Người làm của dòng nhật ký; không có tên thì là hệ thống (kéo tự động) hoặc "—". */
export function logActorText(e: Pick<BeCutAllocationLogEntry, 'createdByName' | 'action'>): string {
  return e.createdByName ?? (e.action === 'AUTO_PULL' ? 'Hệ thống' : '—')
}

/** "Máy 1 → Máy 2"; thiếu đầu nào ghi "—". */
export function logMachineText(e: Pick<BeCutAllocationLogEntry, 'fromMachine' | 'toMachine'>): string {
  return `${e.fromMachine?.name ?? '—'} → ${e.toMachine?.name ?? '—'}`
}

/** Số cây của dòng nhật ký: đổi số cây thì "10 → 8 cây", còn lại "8 cây". */
export function logBarsText(e: Pick<BeCutAllocationLogEntry, 'action' | 'barCount' | 'previousBarCount'>): string {
  if (e.action === 'BARS' && e.previousBarCount != null) return `${fmtNum(e.previousBarCount)} → ${fmtNum(e.barCount)} cây`
  return `${fmtNum(e.barCount)} cây`
}

/** "13/11 08:10" - giờ máy người xem. Sai dạng -> "". */
export function logTimeText(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** Ngày dạng YYYY-MM-DD theo giờ máy người xem. */
export function toYmd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Khoảng ngày mặc định của lịch sử: 30 ngày gần nhất tính cả hôm nay. */
export function defaultLogRange(now: Date = new Date(), days = 30): { from: string; to: string } {
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1))
  return { from: toYmd(from), to: toYmd(now) }
}

/** Khoảng ngày hợp lệ: cả hai có dạng ngày và từ <= đến. */
export function isValidLogRange(from: string, to: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to) && from <= to
}

/** Lệnh có điều chuyển: giữ lệnh có ít nhất 1 lần đổi máy hoặc tách, nhiều lần nhất lên trước. */
export function ordersWithMoves(byOrder: BeCutAllocationLogByOrder[]): BeCutAllocationLogByOrder[] {
  return byOrder
    .filter((o) => o.moves + o.splits > 0)
    .sort((a, b) => (b.moves + b.splits) - (a.moves + a.splits) || a.piCode.localeCompare(b.piCode, 'vi'))
}

// ─── Việc của máy trên màn quét ──────────────────────────────────────────────

/** Nhãn Dập / Khoan / Uốn (và Tán) của dòng: gộp bước của mọi đoạn, thêm Uốn khi dòng có uốn, Dập khi có đoạn dập. */
export function rowStepLabels(row: Pick<BeCutAllocationRow, 'segments' | 'punchedSegments' | 'hasBend'>): string[] {
  const steps = new Set<CutSegmentStep>(row.segments.flatMap((s) => s.steps))
  if (row.hasBend) steps.add('UON')
  if ((row.punchedSegments ?? []).length > 0) steps.add('DAP')
  return stepBadges([...steps])
}

/** "Dư 25 mm mỗi cây" - rỗng khi không biết hoặc bằng 0. */
export function wastePerBarText(mm: number | null | undefined): string {
  return mm != null && mm > 0 ? `${fmtNum(mm)} mm` : ''
}

/** Dòng của máy theo thứ tự cắt (seq rồi id). */
export function sortMachineRows(rows: BeCutAllocationRow[]): BeCutAllocationRow[] {
  return [...rows].sort((a, b) => a.seq - b.seq || Number(a.id) - Number(b.id))
}

// ─── Ước số cây máy đã cắt ───────────────────────────────────────────────────

/** Công nhân báo theo đoạn, hệ thống ước ra số cây nên luôn có dấu ≈. */
export const BARS_EST_TITLE =
  'Công nhân báo theo đoạn, hệ thống ước ra số cây máy đã cắt - chỉ là số xấp xỉ'
export const IDLE_NOTICE = 'Máy đã cắt hết việc được chia - báo QLSX chia thêm.'

/** "Đã cắt ≈ 12/40 cây · còn ≈ 28 cây" (thẻ máy bảng chia). */
export function barsProgressText(m: Pick<BeCutAllocationMachine, 'barsDoneEst' | 'barsLeftEst' | 'totalBars'>): string {
  return `Đã cắt ≈ ${fmtNum(m.barsDoneEst)}/${fmtNum(m.totalBars)} cây · còn ≈ ${fmtNum(m.barsLeftEst)} cây`
}

/** "Còn ≈ 28 cây" (khối việc của máy trên màn quét). */
export function barsLeftText(left: number): string {
  return `Còn ≈ ${fmtNum(left)} cây`
}

/** Thanh tiến độ theo cây (0-100, làm tròn, kẹp). */
export function barsPercent(done: number, total: number): number {
  if (!(total > 0) || !(done > 0)) return 0
  return Math.min(100, Math.round((done / total) * 100))
}

export interface StatusBadge { text: string; tone: 'red' | 'amber' | 'gray' }

/** Nhãn trạng thái máy; BUSY (còn nhiều việc) không cần nhãn. */
export function machineStatusBadge(status: CutMachineStatus | null | undefined): StatusBadge | null {
  if (status === 'IDLE') return { text: 'Máy rảnh', tone: 'red' }
  if (status === 'LOW') return { text: 'Sắp hết việc', tone: 'amber' }
  if (status === 'EMPTY') return { text: 'Chưa có việc', tone: 'gray' }
  return null
}

/** "≈ đã cắt 3/10 cây" của 1 dòng. */
export function rowBarsText(row: Pick<BeCutAllocationRow, 'barsDoneEst' | 'barCount'>): string {
  return `≈ đã cắt ${fmtNum(row.barsDoneEst ?? 0)}/${fmtNum(row.barCount)} cây`
}

/** Dòng đã cắt đủ số cây được chia. */
export function isRowDone(row: Pick<BeCutAllocationRow, 'barsDoneEst' | 'barCount'>): boolean {
  return row.barCount > 0 && (row.barsDoneEst ?? 0) >= row.barCount
}

/**
 * Màn quét máy cắt: dòng còn việc lên trước (giữ thứ tự cắt), dòng đã cắt xong xuống cuối. Việc máy rảnh tự kéo về
 * được nối vào cuối nên nếu giữ nguyên thứ tự, các dòng "Xong" phía trên sẽ đẩy việc mới ra khỏi phần xem trước.
 */
export function openRowsFirst<T extends Pick<BeCutAllocationRow, 'barsDoneEst' | 'barCount'>>(rows: T[]): T[] {
  return [...rows.filter((r) => !isRowDone(r)), ...rows.filter((r) => isRowDone(r))]
}

// ─── Trình bày bảng chia (tách khỏi component) ────────────────────────────────

/** Chú thích dấu ≈, ghi một lần trên đầu bảng. */
export const APPROX_NOTE = '≈ là số ước từ số đoạn công nhân đã báo'

/** Máy có nhận được dòng không: ưu tiên danh sách BE trả về, thiếu thì dùng luật dự phòng `machineAcceptsRow`. */
export function rowAcceptsMachine(
  row: Pick<BeCutAllocationRow, 'machineClass' | 'allowedMachineIds'>,
  machine: Pick<BeCutAllocationMachine, 'id' | 'cutMachineType'>,
  machines: Pick<BeCutAllocationMachine, 'cutMachineType'>[],
  laserAllowed: boolean,
): boolean {
  if (row.allowedMachineIds) return row.allowedMachineIds.includes(machine.id)
  return machineAcceptsRow(machine, row, machines, laserAllowed)
}

/** Chữ trong ô chọn máy: máy bị khoá ghi thêm lý do. */
export function machineOptionLabel(m: Pick<BeCutAllocationMachine, 'code' | 'name'>, accepts: boolean): string {
  return accepts ? machineTitle(m) : `${machineTitle(m)} - máy này không nhận dòng này`
}

/** Các dòng ghi chú nhỏ dưới kiểu cắt của dòng (theo bó, đoạn dập). */
export function rowNotes(row: Pick<BeCutAllocationRow, 'bundles' | 'isBundle' | 'punchedSegments'>): string[] {
  const out: string[] = []
  const bundle = fmtBundles(row.bundles)
  if (bundle) out.push(`Cắt theo bó: ${bundle}`)
  if (isBundleRow(row)) out.push(`${BUNDLE_SPLIT_HINT}. ${BUNDLE_MOVE_HINT}.`)
  const punched = punchedText(row.punchedSegments)
  if (punched) out.push(`Đoạn dập trên cây: ${punched}`)
  return out
}

/** Lời nhắc trong khung xác nhận đổi máy. */
export function moveHint(bundleRow: boolean): string {
  return bundleRow ? 'Kiểu cắt theo bó chỉ đổi máy khi máy hư. Chọn lý do “Máy hư” để đổi.' : 'Đổi máy. Ghi lý do nếu cần.'
}

/** Nhãn nút "Sửa" / "Xong" của thẻ máy (aria-label nói rõ máy nào). */
export function editToggleLabel(editing: boolean, machine: Pick<BeCutAllocationMachine, 'code' | 'name'>): string {
  return `${editing ? 'Xong sửa' : 'Sửa'} máy ${machineTitle(machine)}`
}

/** Dòng cảnh báo dòng cũ sẽ được dọn; rỗng khi không có. */
export function staleText(count: number): string {
  if (!(count > 0)) return ''
  return `${fmtNum(count)} dòng cũ (phương án cắt đã tính lại, lệnh đã xong Phôi hoặc máy ngừng) sẽ được dọn khi bấm Chia.`
}

/** "N cây còn giữ ở kho xưởng khác, chờ chuyển kho"; rỗng khi không có. */
export function heldElsewhereText(bars: number | null | undefined): string {
  if (!bars || bars <= 0) return ''
  return `${fmtNum(bars)} cây còn giữ ở kho xưởng khác, chờ chuyển kho`
}

export const WAITING_NOTE = 'Chưa đủ sắt nên hệ thống chưa tự chia. Nếu sắt đã có, bấm “Chia luôn”.'
export const REDO_MESSAGE =
  'Chia lại các dòng hệ thống đã chia?\nCác dòng bạn đã sửa tay được giữ nguyên; ' +
  'phần còn lại chia lại từ đầu và thứ tự cắt trên máy xếp lại theo ưu tiên.'

export function addAnywayMessage(label: string): string {
  return `Hệ thống chưa thấy đủ sắt cho loại này. Vẫn chia?\n${label}\n` +
    'Các dòng chia luôn được giữ khi bấm “Chia lại”, như dòng sửa tay.'
}

export function deleteMessage(row: Pick<BeCutAllocationRow, 'piCode' | 'materialLabel' | 'barCount'>): string {
  return `Xoá dòng ${row.piCode} · ${row.materialLabel} (${row.barCount} cây) khỏi máy?\nSố cây này quay về mục “Chưa chia”.`
}

/** Chi tiết của dòng nhật ký: lý do + ghi chú. */
export function logDetailText(e: Pick<BeCutAllocationLogEntry, 'reason' | 'note'>): string {
  return [reasonLabel(e.reason), e.note].filter(Boolean).join(' · ')
}

/** "13/11 08:10 · Tên người" (bỏ phần người khi không có). */
export function logWhenWhoText(e: Pick<BeCutAllocationLogEntry, 'createdAt' | 'createdByName' | 'action'>): string {
  const who = logActorText(e)
  return who === '—' ? logTimeText(e.createdAt) : `${logTimeText(e.createdAt)} · ${who}`
}

/** Title của dòng tiến độ thẻ máy: số đoạn đã báo (nếu máy có đoạn trong kế hoạch) + chú thích dấu ≈. */
export function machineProgressTitle(
  m: Pick<BeCutAllocationMachine, 'reportedSegments' | 'plannedSegments'>,
): string {
  return m.plannedSegments > 0 ? `${progressText(m)}. ${APPROX_NOTE}` : APPROX_NOTE
}

/** Chữ đọc cho thanh tải + tiến độ của máy (aria-valuetext). */
export function loadBarText(
  m: Pick<BeCutAllocationMachine, 'barsDoneEst' | 'barsLeftEst' | 'totalBars'>, maxBars: number,
): string {
  return `${barsProgressText(m)}; tải ${loadPercent(m.totalBars, maxBars)}% so với máy nhiều việc nhất`
}
