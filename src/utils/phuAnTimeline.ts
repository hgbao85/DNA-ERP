// Phần A – Đợt 3 (YC10): mốc ĐỀ XUẤT của 1 dòng SKU theo năng lực. Bản FE của BE `src/common/utils/timeline-suggest.util.ts` -
// CÙNG công thức, CÙNG tên hàm, CÙNG câu cảnh báo, CÙNG bộ ví dụ test (phuAnTimeline.test.ts). Sửa công thức thì sửa cả hai.
// Hàm thuần, ngày là chuỗi 'yyyy-MM-dd' (ngày lịch VN), không đọc DB.
//
// Ý nghĩa ngày: mốc công đoạn là ngày phải XONG; thêm 2 mốc ngày BẮT ĐẦU: M2 = PHOI_START (= N), M4 = PACKAGING_START.
// M1 = materialDeadline, M3 = finishedMaterialDeadline.
//
//   X   = số ngày Phôi (cũng là số ngày Hàn, Sơn): xưởng CONT_PER_DAY (Phú An) ⌈cont ÷ năng lực⌉; xưởng DAYS_PER_CONT
//         (Phước An) ⌈số ngày/cont × cont⌉; tối thiểu 1. Chưa có load cont -> X = 1 + cờ `missingLoadCont`.
//   Xđg = số ngày Đóng gói = ⌈cont ÷ năng lực⌉ (đóng gói theo kho, luôn tính theo cont/ngày).
//   N   = N KHSX đang gõ ?? PHOI_START đã chốt ?? FRAME_PHOI − (X − 1) ?? Khung − (X + 1) ?? hạn giao − (Xđg + 16)
//   M1 = N − 1 · Phôi xong N+X−1 · Hàn xong N+X · Sơn xong = Khung = N+X+1 · Nhập đan N+12 · Chuyền kiểm N+13
//   M4 = M4 gõ ?? PACKAGING_START đã chốt ?? Đóng gói − (Xđg − 1) ?? N + 14 · Đóng gói xong M4 + Xđg − 1 · M3 = M4 − 7
//
// Số ngày tính bằng SỐ NGUYÊN (208 bộ load 80 = 2,6 cont ÷ 1,3 bằng số thực ra 2,0000000000000004 -> làm tròn lên thành 3: sai).

export type TimelineCapacityMode = 'CONT_PER_DAY' | 'DAYS_PER_CONT'

/** Tham số Admin cấu hình (SystemConfig). */
export interface TimelineParams {
  /** Cont/ngày của xưởng CONT_PER_DAY và của mỗi kho đóng gói (mặc định 1,3). */
  capacityContPerDay: number
  /** Số ngày/cont ở Phôi, Hàn của xưởng DAYS_PER_CONT (mặc định 4). */
  daysPerContPhuocAn: number
}

export const DEFAULT_TIMELINE_PARAMS: TimelineParams = {
  capacityContPerDay: 1.3,
  daysPerContPhuocAn: 4,
}

/** Các khoảng cách cố định. */
export const TIMELINE_OFFSETS = {
  /** M1 = N − 1. */
  materialBeforeN: 1,
  /** Nhập đan = N + 12. */
  weaving: 12,
  /** Chuyền kiểm = N + 13. */
  transferCheck: 13,
  /** M4 = N + 14. */
  packagingStart: 14,
  /** M3 = M4 − 7. */
  finishedMaterialBeforePackagingStart: 7,
  /** Đóng gói xong trước hạn giao 3 ngày (khi N phải tính từ hạn giao). */
  deliveryBuffer: 3,
} as const

/** Ngày 'yyyy-MM-dd'. */
export type DayKey = string

export interface TimelineInput {
  quantity: number
  loadCont: number | null | undefined
  /** Chế độ năng lực của xưởng dùng để đề xuất: xưởng của dòng, chưa có thì xưởng dự kiến Phú An (CONT_PER_DAY). */
  capacityMode: TimelineCapacityMode
  /** Mốc đã CHỐT (đã lưu hoặc KHSX vừa sửa tay). Ô còn là đề xuất thì KHÔNG truyền. */
  saved?: {
    PHOI_START?: DayKey | null
    FRAME_PHOI?: DayKey | null
    FRAME?: DayKey | null
    PACKAGING_START?: DayKey | null
    PACKAGING?: DayKey | null
  }
  /** Hạn giao của chính dòng (chưa có thì hạn của lệnh) - chỉ dùng khi không có mốc nào để tính N. */
  delivery?: DayKey | null
}

export type TimelineNSource = 'PHOI_START' | 'FRAME_PHOI' | 'FRAME' | 'DELIVERY'
export type TimelinePackagingStartSource = 'PACKAGING_START' | 'PACKAGING' | 'N'

export interface TimelineDates {
  materialDeadline: DayKey
  PHOI_START: DayKey
  FRAME_PHOI: DayKey
  FRAME_HAN: DayKey
  FRAME_SON: DayKey
  FRAME: DayKey
  WEAVING: DayKey
  TRANSFER_CHECK: DayKey
  PACKAGING_START: DayKey
  PACKAGING: DayKey
  finishedMaterialDeadline: DayKey
}

export type TimelineField = keyof TimelineDates

export interface TimelineSuggestion {
  /** Số cont tương đương (số lượng ÷ load cont); null khi SKU chưa có load cont. */
  cont: number | null
  missingLoadCont: boolean
  /** X - số ngày Phôi (= số ngày Hàn, Sơn). */
  frameDays: number
  /** Xđg - số ngày Đóng gói. */
  packagingDays: number
  n: DayKey
  nSource: TimelineNSource
  packagingStartSource: TimelinePackagingStartSource
  dates: TimelineDates
}

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const DAY_MS = 86_400_000

function dayToUtcMs(day: DayKey): number | null {
  const m = DAY_RE.exec(day)
  if (!m) return null
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  const d = new Date(ms)
  if (d.getUTCMonth() !== Number(m[2]) - 1 || d.getUTCDate() !== Number(m[3])) return null
  return ms
}

/** Hợp lệ 'yyyy-MM-dd' (có thật trên lịch). */
export function isDayKey(day: unknown): day is DayKey {
  return typeof day === 'string' && dayToUtcMs(day) !== null
}

/** Cộng/trừ số ngày lịch cho ngày 'yyyy-MM-dd'. */
export function addDays(day: DayKey, days: number): DayKey {
  const ms = dayToUtcMs(day)
  if (ms === null) throw new Error(`Ngày không hợp lệ: ${day}`)
  return new Date(ms + days * DAY_MS).toISOString().slice(0, 10)
}

/** Số ngày từ `from` tới `to` (âm = `to` trước `from`). */
export function diffDays(from: DayKey, to: DayKey): number {
  const a = dayToUtcMs(from)
  const b = dayToUtcMs(to)
  if (a === null || b === null) throw new Error(`Ngày không hợp lệ: ${from} / ${to}`)
  return Math.round((b - a) / DAY_MS)
}

const isPositive = (n: number | null | undefined): n is number =>
  typeof n === 'number' && Number.isFinite(n) && n > 0

/** Năng lực cont/ngày -> phần trăm nguyên (1,3 -> 130); sai/0 -> mặc định. */
function capacityPercent(params: TimelineParams): number {
  const p = Math.round((params.capacityContPerDay ?? 0) * 100)
  return p > 0 ? p : Math.round(DEFAULT_TIMELINE_PARAMS.capacityContPerDay * 100)
}

function daysPerCont(params: TimelineParams): number {
  return isPositive(params.daysPerContPhuocAn)
    ? Math.round(params.daysPerContPhuocAn)
    : DEFAULT_TIMELINE_PARAMS.daysPerContPhuocAn
}

/** Số cont tương đương; null khi chưa có load cont. */
export function contOf(quantity: number, loadCont: number | null | undefined): number | null {
  if (!isPositive(loadCont)) return null
  return Math.max(0, quantity) / loadCont
}

/**
 * Số ngày 1 công đoạn khung (Phôi = Hàn = Sơn) theo chế độ xưởng. Chưa có load cont / số lượng 0 -> 1 ngày.
 * CONT_PER_DAY: ⌈qty ÷ (loadCont × năng lực)⌉ = ⌈qty·100 ÷ (loadCont · năng lực%)⌉ (số nguyên).
 * DAYS_PER_CONT: ⌈số ngày/cont × qty ÷ loadCont⌉.
 */
export function frameDaysOf(
  quantity: number,
  loadCont: number | null | undefined,
  mode: TimelineCapacityMode,
  params: TimelineParams = DEFAULT_TIMELINE_PARAMS,
): number {
  if (!isPositive(loadCont) || !(quantity > 0)) return 1
  const qty = Math.round(quantity)
  const lc = Math.round(loadCont)
  const days =
    mode === 'DAYS_PER_CONT'
      ? Math.ceil((daysPerCont(params) * qty) / lc)
      : Math.ceil((qty * 100) / (lc * capacityPercent(params)))
  return Math.max(1, days)
}

/** Số ngày Đóng gói (luôn theo cont/ngày của kho đóng gói). */
export function packagingDaysOf(
  quantity: number,
  loadCont: number | null | undefined,
  params: TimelineParams = DEFAULT_TIMELINE_PARAMS,
): number {
  return frameDaysOf(quantity, loadCont, 'CONT_PER_DAY', params)
}

/**
 * Mốc đề xuất của 1 dòng SKU. null khi không có gì để tính N (chưa mốc nào, chưa hạn giao).
 * `overrides.n` / `overrides.packagingStart`: N, M4 KHSX đang gõ ở form (thắng mốc đã chốt).
 */
export function suggestTimeline(
  input: TimelineInput,
  params: TimelineParams = DEFAULT_TIMELINE_PARAMS,
  overrides: { n?: DayKey | null; packagingStart?: DayKey | null } = {},
): TimelineSuggestion | null {
  const saved = input.saved ?? {}
  const cont = contOf(input.quantity, input.loadCont)
  const missingLoadCont = cont === null
  const x = frameDaysOf(input.quantity, input.loadCont, input.capacityMode, params)
  const xPack = packagingDaysOf(input.quantity, input.loadCont, params)

  let n: DayKey | null = null
  let nSource: TimelineNSource = 'PHOI_START'
  if (isDayKey(overrides.n)) {
    n = overrides.n
  } else if (isDayKey(saved.PHOI_START)) {
    n = saved.PHOI_START
  } else if (isDayKey(saved.FRAME_PHOI)) {
    n = addDays(saved.FRAME_PHOI, -(x - 1))
    nSource = 'FRAME_PHOI'
  } else if (isDayKey(saved.FRAME)) {
    n = addDays(saved.FRAME, -(x + 1))
    nSource = 'FRAME'
  } else if (isDayKey(input.delivery)) {
    n = addDays(
      input.delivery,
      -(TIMELINE_OFFSETS.packagingStart + xPack - 1 + TIMELINE_OFFSETS.deliveryBuffer),
    )
    nSource = 'DELIVERY'
  }
  if (n === null) return null

  let m4: DayKey
  let packagingStartSource: TimelinePackagingStartSource = 'PACKAGING_START'
  if (isDayKey(overrides.packagingStart)) {
    m4 = overrides.packagingStart
  } else if (isDayKey(saved.PACKAGING_START)) {
    m4 = saved.PACKAGING_START
  } else if (isDayKey(saved.PACKAGING)) {
    m4 = addDays(saved.PACKAGING, -(xPack - 1))
    packagingStartSource = 'PACKAGING'
  } else {
    m4 = addDays(n, TIMELINE_OFFSETS.packagingStart)
    packagingStartSource = 'N'
  }

  const son = addDays(n, x + 1)
  return {
    cont,
    missingLoadCont,
    frameDays: x,
    packagingDays: xPack,
    n,
    nSource,
    packagingStartSource,
    dates: {
      materialDeadline: addDays(n, -TIMELINE_OFFSETS.materialBeforeN),
      PHOI_START: n,
      FRAME_PHOI: addDays(n, x - 1),
      FRAME_HAN: addDays(n, x),
      FRAME_SON: son,
      FRAME: son,
      WEAVING: addDays(n, TIMELINE_OFFSETS.weaving),
      TRANSFER_CHECK: addDays(n, TIMELINE_OFFSETS.transferCheck),
      PACKAGING_START: m4,
      PACKAGING: addDays(m4, xPack - 1),
      finishedMaterialDeadline: addDays(m4, -TIMELINE_OFFSETS.finishedMaterialBeforePackagingStart),
    },
  }
}

export type TimelineWarningCode =
  | 'PHOI_END_BEFORE_START'
  | 'WEAVING_BEFORE_SON'
  | 'TRANSFER_CHECK_BEFORE_WEAVING'
  | 'PACKAGING_START_BEFORE_TRANSFER_CHECK'
  | 'PACKAGING_END_BEFORE_START'
  | 'PACKAGING_AFTER_DELIVERY'

export interface TimelineWarning {
  code: TimelineWarningCode
  message: string
}

const ddmm = (day: DayKey) => `${day.slice(8, 10)}/${day.slice(5, 7)}`

/**
 * Cảnh báo thứ tự mốc: đặt mốc sớm hơn ngày xong công đoạn trước vẫn LƯU ĐƯỢC, chỉ hiện cảnh báo, không chặn.
 * "Sớm hơn" = trước hẳn 1 ngày trở lên (cùng ngày không báo). Thiếu ngày nào thì bỏ qua phép so đó.
 */
export function timelineWarnings(d: {
  PHOI_START?: DayKey | null
  FRAME_PHOI?: DayKey | null
  FRAME_SON?: DayKey | null
  FRAME?: DayKey | null
  WEAVING?: DayKey | null
  TRANSFER_CHECK?: DayKey | null
  PACKAGING_START?: DayKey | null
  PACKAGING?: DayKey | null
  delivery?: DayKey | null
}): TimelineWarning[] {
  const out: TimelineWarning[] = []
  const before = (a: DayKey | null | undefined, b: DayKey | null | undefined): boolean =>
    isDayKey(a) && isDayKey(b) && diffDays(b, a) < 0
  const sonDone = isDayKey(d.FRAME_SON) ? d.FRAME_SON : d.FRAME

  if (before(d.FRAME_PHOI, d.PHOI_START)) {
    out.push({
      code: 'PHOI_END_BEFORE_START',
      message: `Phôi xong (${ddmm(d.FRAME_PHOI!)}) sớm hơn ngày bắt đầu Phôi (${ddmm(d.PHOI_START!)})`,
    })
  }
  if (before(d.WEAVING, sonDone)) {
    out.push({
      code: 'WEAVING_BEFORE_SON',
      message: `Mốc Nhập đan (${ddmm(d.WEAVING!)}) sớm hơn ngày xong Sơn (${ddmm(sonDone!)})`,
    })
  }
  if (before(d.TRANSFER_CHECK, d.WEAVING)) {
    out.push({
      code: 'TRANSFER_CHECK_BEFORE_WEAVING',
      message: `Mốc Chuyền kiểm (${ddmm(d.TRANSFER_CHECK!)}) sớm hơn Nhập đan (${ddmm(d.WEAVING!)})`,
    })
  }
  if (before(d.PACKAGING_START, d.TRANSFER_CHECK)) {
    out.push({
      code: 'PACKAGING_START_BEFORE_TRANSFER_CHECK',
      message: `Bắt đầu đóng gói (${ddmm(d.PACKAGING_START!)}) sớm hơn Chuyền kiểm (${ddmm(d.TRANSFER_CHECK!)})`,
    })
  }
  if (before(d.PACKAGING, d.PACKAGING_START)) {
    out.push({
      code: 'PACKAGING_END_BEFORE_START',
      message: `Đóng gói xong (${ddmm(d.PACKAGING!)}) sớm hơn ngày bắt đầu đóng gói (${ddmm(d.PACKAGING_START!)})`,
    })
  }
  if (before(d.delivery, d.PACKAGING)) {
    out.push({
      code: 'PACKAGING_AFTER_DELIVERY',
      message: `Đóng gói xong (${ddmm(d.PACKAGING!)}) sau hạn giao (${ddmm(d.delivery!)})`,
    })
  }
  return out
}

/** Nhãn phụ của từng ô theo X, Xđg thật: "N−1", "N", "N+2"... (X = 1 thì Phôi xong ghi "N"). */
export function offsetLabels(x: number, xPack: number): Partial<Record<TimelineField, string>> {
  const plus = (k: number) => (k === 0 ? 'N' : k > 0 ? `N+${k}` : `N−${-k}`)
  return {
    materialDeadline: plus(-1),
    PHOI_START: 'N',
    FRAME_PHOI: plus(x - 1),
    FRAME_HAN: plus(x),
    FRAME_SON: plus(x + 1),
    FRAME: plus(x + 1),
    WEAVING: plus(TIMELINE_OFFSETS.weaving),
    TRANSFER_CHECK: plus(TIMELINE_OFFSETS.transferCheck),
    PACKAGING_START: plus(TIMELINE_OFFSETS.packagingStart),
    // M4 = Bắt đầu đóng gói (tên mốc v8) - không viết "ĐG" vì dễ đọc nhầm thành "Đóng gói xong".
    PACKAGING: xPack > 1 ? `M4+${xPack - 1}` : 'M4',
    finishedMaterialDeadline: FINISHED_MATERIAL_OFFSET_LABEL,
  }
}

// "Mua VT còn lại" (vật tư thành phẩm: thùng, xốp, nệm, gỗ, phụ kiện, nhãn) tính từ NGÀY BẮT ĐẦU ĐÓNG GÓI (M4): hạn chót M4−7.
// Changelog BE 2026-09-25 mục 32.5, 32.7.
export const FINISHED_MATERIAL_BEFORE_PACKAGING_DAYS = TIMELINE_OFFSETS.finishedMaterialBeforePackagingStart
export const FINISHED_MATERIAL_OFFSET_LABEL = `M4−${FINISHED_MATERIAL_BEFORE_PACKAGING_DAYS}`

type DateLike = string | Date | null | undefined

/** Về 0h giờ máy của đúng ngày đó (chuỗi 'yyyy-MM-dd' và ISO từ BE đều cho cùng ngày ở múi giờ VN). */
function dayOf(x: DateLike): Date | null {
  if (!x) return null
  const d = x instanceof Date ? x : new Date(x)
  if (Number.isNaN(d.getTime())) return null
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function addDaysDate(d: Date, days: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + days)
  return r
}

export function finishedMaterialDate(packagingStart: DateLike): Date | null {
  const p = dayOf(packagingStart)
  return p ? addDaysDate(p, -FINISHED_MATERIAL_BEFORE_PACKAGING_DAYS) : null
}

// Hàng vật tư "được về từ" hạn chót − 4 (VT khung N−5 → N−1, VT còn lại M4−11 → M4−7). Chỉ hiển thị, không lưu: KHSX sửa tay
// hạn chót thì ngày "về từ" đi theo.
export const MATERIAL_ARRIVAL_WINDOW_DAYS = 4

// Phần A – Đợt 4 (YC6): N lấy từ cấu hình `materialEarliestArrivalDays` (mặc định 4 = hằng trên khi không truyền).
export function materialArrivalFrom(deadline: DateLike, windowDays: number = MATERIAL_ARRIVAL_WINDOW_DAYS): Date | null {
  const d = dayOf(deadline)
  return d ? addDaysDate(d, -windowDays) : null
}

/** Tên 2 mốc vật tư (Sếp duyệt 2026-10-27): ngắn cho thẻ/tiêu đề bảng, đầy đủ + danh sách vật tư cho chú thích rê chuột. */
export const MATERIAL_MILESTONES = {
  materialDeadline: {
    short: 'Mua VT khung & đan',
    full: 'Mua vật tư khung cơ khí và đan',
    hint: 'Mua vật tư khung cơ khí và đan: sắt, la, tán rút, đá cắt, dây hàn, CO2, sơn bột, hoá chất, dây đan, đinh, nút. Hạn chót N−1, được về từ N−5.',
  },
  finishedMaterialDeadline: {
    short: 'Mua VT còn lại',
    full: 'Mua vật tư còn lại',
    hint: 'Mua vật tư còn lại (vật tư thành phẩm): thùng, xốp, nệm, gỗ, phụ kiện, nhãn... Hạn chót Bắt đầu đóng gói − 7, được về từ Bắt đầu đóng gói − 11.',
  },
} as const

const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

/** "T6 · 02/10/2026" - luôn ngày/tháng/năm, dù ô chọn ngày của trình duyệt đang hiện tháng/ngày. */
export function fmtDayVN(x: DateLike): string {
  const d = dayOf(x)
  if (!d) return ''
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${WEEKDAYS[d.getDay()]} · ${dd}/${mm}/${d.getFullYear()}`
}

/** 'yyyy-MM-dd' theo giờ máy - đúng định dạng value của <input type="date">. */
export function toInputDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

/** Ngày bất kỳ (chuỗi ISO từ BE / Date) -> 'yyyy-MM-dd' theo giờ máy; không hợp lệ -> null. */
export function toDayKey(x: DateLike): DayKey | null {
  const d = dayOf(x)
  return d ? toInputDate(d) : null
}
