/**
 * Phần thuần của khối "Năng suất máy cắt": định dạng số / giờ, khoảng ngày, nhãn, dòng "Cách tính",
 * dòng hiển thị, bảng (mảng dòng) cho Excel và tên file. Chỉ ĐO, chưa áp luật chia nào.
 */
import type { BeCutMachineStats } from '../../../services/floor-api'
import { addDays, spanOf, todayVn } from './floorStats'

type Cell = string | number
export type CutMachineType = 'laser' | 'tu_dong'
type Method = BeCutMachineStats['method']
type Machine = BeCutMachineStats['machines'][number]

export const MAX_RANGE_DAYS = 62
export const DEFAULT_RANGE_DAYS = 14
export const EMPTY = '—'

/** Tên sheet Excel (≤ 31 ký tự, không có : \ / ? * [ ]). */
export const CUT_STATS_SHEETS = ['Theo loại máy', 'Theo máy', 'Theo ngày', 'Theo loại sắt', 'Cách tính'] as const

/** Số kiểu VN, đúng 1 chữ số lẻ (1.234,5). */
export const fmt1 = (n: number): string => n.toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
/** Số hoặc "—" khi chưa có. */
export const fmtOrDash = (n: number | null | undefined): string => (n === null || n === undefined ? EMPTY : fmt1(n))
const fmtInt = (n: number): string => n.toLocaleString('vi-VN')

/** 'HH:mm' giờ VN từ ISO; ISO hỏng thì "—". */
export function fmtTimeVn(iso: string): string {
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return EMPTY
  const d = new Date(t + 7 * 3600 * 1000)
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

/** 'YYYY-MM-DD' -> 'DD/MM'. */
export function fmtDayShort(day: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(day)
  return m ? `${m[2]}/${m[1]}` : day
}

export function machineTypeLabel(t: CutMachineType | string): string {
  if (t === 'laser') return 'MC Laser'
  if (t === 'tu_dong') return 'MC Tự động'
  return String(t)
}

/** 14 ngày tính đến hôm nay (giờ VN), gồm cả hôm nay. */
export function defaultRange(today: string = todayVn()): { from: string; to: string } {
  return { from: addDays(today, -(DEFAULT_RANGE_DAYS - 1)), to: today }
}

/** Thông báo lỗi khoảng ngày; null = hợp lệ (đủ hai ngày, từ ≤ đến, tối đa 62 ngày). */
export function rangeError(from: string, to: string): string | null {
  const ok = /^\d{4}-\d{2}-\d{2}$/
  if (!ok.test(from) || !ok.test(to)) return 'Chọn đủ hai ngày.'
  if (from > to) return 'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.'
  if (spanOf(from, to) > MAX_RANGE_DAYS) return `Chỉ xem được tối đa ${MAX_RANGE_DAYS} ngày một lần.`
  return null
}

export function machineById(machines: Machine[]): Map<string, Machine> {
  return new Map(machines.map((m) => [m.id, m]))
}

/** Dòng "Theo máy": mọi máy của xưởng (kể cả máy chưa có số), sắp theo mã máy. */
export function machineRows(data: BeCutMachineStats) {
  const stat = new Map(data.byMachine.map((s) => [s.machineId, s]))
  return data.machines.map((m) => ({ machine: m, stat: stat.get(m.id) ?? null }))
    .sort((a, b) => a.machine.code.localeCompare(b.machine.code, 'vi', { numeric: true }))
}

/** Loại sắt cắt nhiều cây nhất trong ngày (rỗng nếu không có). */
export function topMaterialLabel(materials: { label: string; bars: number }[]): string {
  let best: { label: string; bars: number } | null = null
  for (const m of materials) if (!best || m.bars > best.bars) best = m
  return best?.label ?? ''
}

/** Các dòng chữ "Cách tính", mọi số lấy từ `method`. */
export function methodLines(m: Method): string[] {
  return [
    'Số liệu đo từ giờ công nhân báo qua mã QR tại máy cắt; lần báo đã hoàn tác không tính.',
    'Cây quy đổi = tổng (số đoạn × (cỡ đoạn + lưỡi cắt)) ÷ (chiều dài cây − tề đầu). ' +
      `Lưỡi cắt: MC Laser ${fmtInt(m.blade.laser)} mm, MC Tự động ${fmtInt(m.blade.tu_dong)} mm. ` +
      `Tề đầu: MC Laser ${fmtInt(m.trim.laser)} mm, MC Tự động ${fmtInt(m.trim.tu_dong)} mm.`,
    'Chiều dài cây lấy theo phương án cắt đã duyệt của lệnh; ' +
      `lệnh chưa có thì tính ${fmtInt(m.defaultBarLengthMm)} mm.`,
    'Cây/giờ chỉ tính khoảng thời gian giữa hai lần báo liên tiếp trong ngày: bỏ lần báo đầu ngày, ' +
      `bỏ lần báo sau khoảng nghỉ quá ${fmtInt(m.maxGapMinutes)} phút, trừ nghỉ trưa ${m.lunchBreak.from}–${m.lunchBreak.to}.`,
    `Tổng thời gian tính dưới ${fmtInt(m.minRateMinutes)} phút thì không có cây/giờ (hiện "${EMPTY}").`,
    'Ngày tính theo giờ Việt Nam. Máy chưa gắn xưởng không có trong báo cáo.',
  ]
}

type Day = BeCutMachineStats['days'][number]
type MachineTypeStat = BeCutMachineStats['byMachineType'][number]

/** "MC02 · Máy 2 (đã tắt)": mã đậm đi riêng ở giao diện, hàm này trả phần sau mã. */
export function machineNameSuffix(m: Pick<Machine, 'code' | 'name' | 'isActive'>): string {
  const name = m.name && m.name !== m.code ? ` · ${m.name}` : ''
  return `${name}${m.isActive ? '' : ' (đã tắt)'}`
}

/** Các ngày mới nhất lên trước; cùng ngày thì theo mã máy. */
export function sortedDays(data: Pick<BeCutMachineStats, 'days' | 'machines'>): Day[] {
  const byId = machineById(data.machines)
  const code = (id: string) => byId.get(id)?.code ?? ''
  const byCode = (a: Day, b: Day) => code(a.machineId).localeCompare(code(b.machineId), 'vi', { numeric: true })
  return [...data.days].sort((a, b) => b.day.localeCompare(a.day) || byCode(a, b))
}

/** "08:10–16:45" - giờ báo đầu và cuối trong ngày. */
export function reportWindowText(d: Pick<Day, 'firstAt' | 'lastAt'>): string {
  return `${fmtTimeVn(d.firstAt)}–${fmtTimeVn(d.lastAt)}`
}

/** Thẻ "Theo loại máy": tên loại, số to, và dòng chi tiết. */
export function typeCardView(t: MachineTypeStat) {
  return {
    title: machineTypeLabel(t.machineType),
    value: fmt1(t.barsPerDayMedian),
    unit: 'cây/ngày (trung vị)',
    detail: `TB ${fmt1(t.barsPerDayAvg)} cây/ngày · ${fmtOrDash(t.barsPerHour)} cây/giờ · ${t.machines} máy, ${t.machineDays} ngày-máy`,
  }
}

/** Dòng tóm tắt dưới tiêu đề: "Phú An · 01/11 – 14/11 · cập nhật lúc 08:10" (tách thành 3 phần để tô đậm khoảng ngày). */
export function statsSummaryParts(data: Pick<BeCutMachineStats, 'workshop' | 'range' | 'generatedAt'>) {
  return {
    workshop: data.workshop.name,
    range: `${fmtDayShort(data.range.from)} – ${fmtDayShort(data.range.to)}`,
    updated: `cập nhật lúc ${fmtTimeVn(data.generatedAt)}`,
  }
}

/** Lỗi tải / xuất file thành chữ hiển thị. */
export function statsErrorText(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback
}

const cell = (n: number | null | undefined): Cell => (n === null || n === undefined ? '' : n)

/** Sheet "Theo loại máy". Ô không có số để trống. */
export function typeAoa(data: BeCutMachineStats): Cell[][] {
  return [
    ['Loại máy', 'Số máy', 'Số ngày-máy', 'Cây/ngày TB', 'Cây/ngày trung vị', 'Cây/giờ'],
    ...data.byMachineType.map((t) => [
      machineTypeLabel(t.machineType), t.machines, t.machineDays, t.barsPerDayAvg, t.barsPerDayMedian, cell(t.barsPerHour),
    ]),
  ]
}

/** Sheet "Theo máy". */
export function machineAoa(data: BeCutMachineStats): Cell[][] {
  return [
    ['Mã máy', 'Tên máy', 'Loại máy', 'Ngày có số', 'Tổng cây', 'Cây/ngày TB', 'Cây/ngày trung vị', 'Cây/giờ'],
    ...machineRows(data).map(({ machine: m, stat: s }) => [
      m.code, m.name, machineTypeLabel(m.machineType),
      s ? s.daysWithData : 0, s ? s.totalBars : '', s ? s.barsPerDayAvg : '', s ? s.barsPerDayMedian : '', s ? cell(s.barsPerHour) : '',
    ]),
  ]
}

/** Sheet "Theo ngày". */
export function dayAoa(data: BeCutMachineStats): Cell[][] {
  const byId = machineById(data.machines)
  return [
    [
      'Ngày', 'Mã máy', 'Loại máy', 'Số lần báo', 'Báo đầu', 'Báo cuối', 'Phút tính', 'Số đoạn', 'Mét', 'Cây', 'Cây/giờ',
      'Loại sắt nhiều nhất',
    ],
    ...data.days.map((d) => {
      const m = byId.get(d.machineId)
      return [
        d.day, m?.code ?? '', m ? machineTypeLabel(m.machineType) : '', d.reports, fmtTimeVn(d.firstAt), fmtTimeVn(d.lastAt),
        d.rateMinutes, d.segments, d.meters, d.bars, cell(d.barsPerHour), topMaterialLabel(d.materials),
      ]
    }),
  ]
}

/** Sheet "Theo loại sắt". */
export function materialAoa(data: BeCutMachineStats): Cell[][] {
  return [
    ['Loại máy', 'Loại sắt', 'Cây', 'Phút tính', 'Cây/giờ'],
    ...data.byMaterial.map((x) => [machineTypeLabel(x.machineType), x.label, x.bars, x.rateMinutes, cell(x.barsPerHour)]),
  ]
}

/** Sheet "Cách tính": phần thông tin xưởng + khoảng, rồi các dòng cách tính. */
export function methodAoa(data: BeCutMachineStats): Cell[][] {
  return [
    ['Cách tính'],
    ['Xưởng', data.workshop.name],
    ['Từ ngày', data.range.from],
    ['Đến ngày', data.range.to],
    ...methodLines(data.method).map((l) => [l]),
  ]
}

/** Tên file: nang-suat-may-cat_<mã xưởng>_<from>_<to>.xlsx */
export function cutStatsFileName(workshopCode: string, from: string, to: string): string {
  const code = workshopCode.trim().replace(/[^A-Za-z0-9_-]+/g, '-') || 'xuong'
  return `nang-suat-may-cat_${code}_${from}_${to}.xlsx`
}
