/**
 * Phần A – Đợt 10a (YC5): ngày giờ của Booking luôn theo GIỜ VN (UTC+7) cố định, không phụ thuộc múi giờ máy.
 * BE lưu ISO UTC cho `cutSiAt`/`cutOffAt`; `pickupDate`/`etd` là 'YYYY-MM-DD'.
 */
const VN_OFFSET_MS = 7 * 3600_000
const DAY_MS = 86400_000

const pad = (n: number) => String(n).padStart(2, '0')

/** 'YYYY-MM-DDTHH:mm' (giờ VN, từ input datetime-local) -> ISO UTC. Sai dạng -> null. */
export function vnLocalToIso(local: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local)
  if (!m) return null
  const ms = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) - VN_OFFSET_MS
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null
}

/** ISO -> 'YYYY-MM-DDTHH:mm' giờ VN (cho input datetime-local). '' khi rỗng/sai. */
export function isoToVnLocal(iso: string | null | undefined): string {
  if (!iso) return ''
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ''
  return new Date(t + VN_OFFSET_MS).toISOString().slice(0, 16)
}

/** 'YYYY-MM-DD' (hoặc ISO bắt đầu bằng ngày) -> 'DD/MM/YYYY'. */
export function fmtDay(day: string | null | undefined): string {
  if (!day) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(day)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ''
}

/** ISO -> '08:00 02/11/2026' giờ VN. '' khi rỗng. */
export function fmtVnDateTime(iso: string | null | undefined): string {
  const local = isoToVnLocal(iso)
  if (!local) return ''
  return `${local.slice(11, 16)} ${fmtDay(local.slice(0, 10))}`
}

/** ISO -> ngày VN 'YYYY-MM-DD'. null khi rỗng/sai. */
export function vnDayOfIso(iso: string | null | undefined): string | null {
  const local = isoToVnLocal(iso)
  return local ? local.slice(0, 10) : null
}

/** "Ngày hạn" của booking = ngày sớm hơn giữa ngày lấy cont và ngày (giờ VN) của CUT OFF. null khi không có cả hai. */
export function bookingDueDay(b: { pickupDate: string | null; cutOffAt: string | null }): string | null {
  const pickup = b.pickupDate ? b.pickupDate.slice(0, 10) : null
  const cutOff = vnDayOfIso(b.cutOffAt)
  if (pickup && cutOff) return pickup <= cutOff ? pickup : cutOff
  return pickup ?? cutOff
}

const dayToUtcMs = (day: string): number => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(day)
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN
}

/** Số ngày từ fromDay tới toDay (toDay sau thì dương). */
export function daysBetween(fromDay: string, toDay: string): number {
  return Math.round((dayToUtcMs(toDay) - dayToUtcMs(fromDay)) / DAY_MS)
}

/** Hôm nay theo giờ VN 'YYYY-MM-DD'. */
export function todayVn(now: Date = new Date()): string {
  const d = new Date(now.getTime() + VN_OFFSET_MS)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}
