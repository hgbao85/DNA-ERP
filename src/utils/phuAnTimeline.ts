// Mốc ĐỀ XUẤT của 1 SKU theo quy tắc Phú An (Sếp chốt 2026-10-27): mọi mốc tính xuôi từ N = ngày bắt đầu phôi.
// Chỉ là đề xuất - KHSX tự cập nhật ngày thật ở "Sửa thời hạn". Mốc Phước An (+2 ngày) KHÔNG dùng cho đề xuất.
// Bảng gốc: changelog BE 2026-09-25 mục 32.1-32.2 (sắt/vật tư phôi về hết N−1, phôi xong - xuất đan đủ N+2,
// thu mảnh về đủ N+12, đóng gói xong N+14).

export type PhuAnField = 'materialDeadline' | 'PHOI' | 'HAN' | 'SON' | 'FRAME' | 'WEAVING' | 'PACKAGING'

/** Số ngày cộng vào N. Phôi/Hàn/Sơn chia đều 3 ngày N → N+2 (quy tắc chỉ nói "phôi xong, xuất đan đủ N+2"). */
export const PHU_AN_OFFSETS: Record<PhuAnField, number> = {
  materialDeadline: -1,
  PHOI: 0,
  HAN: 1,
  SON: 2,
  FRAME: 2,
  WEAVING: 12,
  PACKAGING: 14,
}

export const PHU_AN_FIELDS = Object.keys(PHU_AN_OFFSETS) as PhuAnField[]

/** Đóng gói xong trước hạn giao bao nhiêu ngày khi N phải tính từ hạn giao (giữ như mặc định cũ "Đóng gói −3"). */
export const PHU_AN_DELIVERY_BUFFER_DAYS = 3

export type PhuAnSource = 'frame' | 'delivery'
export type PhuAnAnchor = { n: Date; source: PhuAnSource; from: Date }

type DateLike = string | Date | null | undefined

/** Về 0h giờ máy của đúng ngày đó (chuỗi 'yyyy-MM-dd' và ISO từ BE đều cho cùng ngày ở múi giờ VN). */
function dayOf(x: DateLike): Date | null {
  if (!x) return null
  const d = x instanceof Date ? x : new Date(x)
  if (Number.isNaN(d.getTime())) return null
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + days)
  return r
}

/**
 * N lấy từ Khung cơ khí đã có (N = Khung − 2) vì Khung là mốc KHSX hay chốt trước; chưa có thì từ hạn giao
 * (N = hạn giao − 17: đóng gói N+14 xong trước hạn giao 3 ngày). Truyền hạn giao CỦA CHÍNH SKU - lệnh gộp có nhiều hạn.
 */
export function phuAnAnchor(frame: DateLike, delivery: DateLike): PhuAnAnchor | null {
  const f = dayOf(frame)
  if (f) return { n: addDays(f, -PHU_AN_OFFSETS.FRAME), source: 'frame', from: f }
  const d = dayOf(delivery)
  if (d) return { n: addDays(d, -(PHU_AN_OFFSETS.PACKAGING + PHU_AN_DELIVERY_BUFFER_DAYS)), source: 'delivery', from: d }
  return null
}

export function phuAnDate(anchor: PhuAnAnchor, field: PhuAnField): Date {
  return addDays(anchor.n, PHU_AN_OFFSETS[field])
}

/** "N−1", "N", "N+12" - ghi kèm ngày đề xuất cho KHSX biết ngày đó tính thế nào. */
export function phuAnOffsetLabel(field: PhuAnField): string {
  const o = PHU_AN_OFFSETS[field]
  return o === 0 ? 'N' : o > 0 ? `N+${o}` : `N−${-o}`
}

// "Mua VT còn lại" (vật tư thành phẩm: thùng, xốp, nệm, gỗ, phụ kiện, nhãn) tính từ NGÀY ĐÓNG GÓI, không từ N (Sếp làm rõ 2026-10-27):
// hạn chót ĐG−7. ĐG = ngày Đóng gói đang có (đã lưu hoặc đề xuất N+14). Changelog BE 2026-09-25 mục 32.5, 32.7.
export const FINISHED_MATERIAL_BEFORE_PACKAGING_DAYS = 7
export const FINISHED_MATERIAL_OFFSET_LABEL = `ĐG−${FINISHED_MATERIAL_BEFORE_PACKAGING_DAYS}`

export function finishedMaterialDate(packaging: DateLike): Date | null {
  const p = dayOf(packaging)
  return p ? addDays(p, -FINISHED_MATERIAL_BEFORE_PACKAGING_DAYS) : null
}

// Hàng vật tư "được về từ" hạn chót − 4 (VT khung N−5 → N−1, VT còn lại ĐG−11 → ĐG−7). Chỉ hiển thị, không lưu: KHSX sửa tay
// hạn chót thì ngày "về từ" đi theo.
export const MATERIAL_ARRIVAL_WINDOW_DAYS = 4

export function materialArrivalFrom(deadline: DateLike): Date | null {
  const d = dayOf(deadline)
  return d ? addDays(d, -MATERIAL_ARRIVAL_WINDOW_DAYS) : null
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
    hint: 'Mua vật tư còn lại (vật tư thành phẩm): thùng, xốp, nệm, gỗ, phụ kiện, nhãn... Hạn chót Đóng gói − 7, được về từ Đóng gói − 11.',
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
