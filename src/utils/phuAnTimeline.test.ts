import { describe, expect, it } from 'vitest'
import {
  FINISHED_MATERIAL_OFFSET_LABEL,
  finishedMaterialDate,
  fmtDayVN,
  materialArrivalFrom,
  phuAnAnchor,
  phuAnDate,
  phuAnOffsetLabel,
  toInputDate,
  type PhuAnField,
} from './phuAnTimeline'

const FIELDS: PhuAnField[] = ['materialDeadline', 'PHOI', 'HAN', 'SON', 'FRAME', 'WEAVING', 'PACKAGING']
const all = (frame: string | null, delivery: string | null) => {
  const a = phuAnAnchor(frame, delivery)
  if (!a) return null
  return Object.fromEntries(FIELDS.map((f) => [f, toInputDate(phuAnDate(a, f))]))
}

describe('phuAnAnchor', () => {
  it('có Khung cơ khí thì N = Khung − 2, kể cả khi có hạn giao', () => {
    const a = phuAnAnchor('2026-09-26', '2026-10-12')
    expect(a?.source).toBe('frame')
    expect(toInputDate(a!.n)).toBe('2026-09-24')
  })

  it('chưa có Khung thì N = hạn giao − 17', () => {
    const a = phuAnAnchor(null, '2026-10-12')
    expect(a?.source).toBe('delivery')
    expect(toInputDate(a!.n)).toBe('2026-09-25')
  })

  it('nhận cả chuỗi ISO từ BE, không có ngày nào thì null', () => {
    expect(toInputDate(phuAnAnchor('2026-09-26T00:00:00.000Z', null)!.n)).toBe('2026-09-24')
    expect(phuAnAnchor('', undefined)).toBeNull()
    expect(phuAnAnchor('khong-phai-ngay', null)).toBeNull()
  })
})

describe('phuAnDate', () => {
  it('PI-2026-035: Khung 26/09 → Mua hàng 23/09, Phôi/Hàn/Sơn 24–26/09, Đan 06/10, Đóng gói 08/10', () => {
    expect(all('2026-09-26', '2026-10-12')).toEqual({
      materialDeadline: '2026-09-23',
      PHOI: '2026-09-24',
      HAN: '2026-09-25',
      SON: '2026-09-26',
      FRAME: '2026-09-26',
      WEAVING: '2026-10-06',
      PACKAGING: '2026-10-08',
    })
  })

  it('chỉ có hạn giao 12/10 → đóng gói xong 09/10, trước hạn giao 3 ngày', () => {
    expect(all(null, '2026-10-12')).toMatchObject({ materialDeadline: '2026-09-24', FRAME: '2026-09-27', PACKAGING: '2026-10-09' })
  })

  it('qua tháng, qua năm vẫn đúng', () => {
    expect(all(null, '2027-01-10')).toMatchObject({ PHOI: '2026-12-24', WEAVING: '2027-01-05', PACKAGING: '2027-01-07' })
  })
})

describe('Mua VT còn lại + ngày "về từ" (Sếp làm rõ 2026-10-27)', () => {
  const ymd = (d: Date | null) => (d ? toInputDate(d) : null)

  it('PI-2026-035: N = T5 24/09, ĐG = T5 08/10 → VT khung 19/09 → 23/09, VT còn lại 27/09 → 01/10', () => {
    const a = phuAnAnchor('2026-09-26', '2026-10-12')!
    const vtKhung = phuAnDate(a, 'materialDeadline')
    const dg = phuAnDate(a, 'PACKAGING')
    const vtConLai = finishedMaterialDate(dg)
    expect(ymd(vtKhung)).toBe('2026-09-23')
    expect(ymd(materialArrivalFrom(vtKhung))).toBe('2026-09-19')
    expect(ymd(vtConLai)).toBe('2026-10-01')
    expect(ymd(materialArrivalFrom(vtConLai))).toBe('2026-09-27')
  })

  it('đi theo ngày Đóng gói đã lưu (không theo N), nhận chuỗi ISO từ BE', () => {
    expect(ymd(finishedMaterialDate('2026-10-10'))).toBe('2026-10-03')
    expect(ymd(finishedMaterialDate('2026-10-10T00:00:00.000Z'))).toBe('2026-10-03')
  })

  it('qua năm vẫn đúng; không có ngày thì null', () => {
    expect(ymd(finishedMaterialDate('2027-01-03'))).toBe('2026-12-27')
    expect(ymd(materialArrivalFrom('2027-01-02'))).toBe('2026-12-29')
    expect(finishedMaterialDate(null)).toBeNull()
    expect(materialArrivalFrom('')).toBeNull()
  })

  it('nhãn ĐG−7', () => {
    expect(FINISHED_MATERIAL_OFFSET_LABEL).toBe('ĐG−7')
  })
})

describe('nhãn', () => {
  it('phuAnOffsetLabel ghi N−1 / N / N+12', () => {
    expect(phuAnOffsetLabel('materialDeadline')).toBe('N−1')
    expect(phuAnOffsetLabel('PHOI')).toBe('N')
    expect(phuAnOffsetLabel('WEAVING')).toBe('N+12')
  })

  it('fmtDayVN luôn ngày/tháng/năm kèm thứ', () => {
    expect(fmtDayVN('2026-10-02')).toBe('T6 · 02/10/2026')
    expect(fmtDayVN('2026-09-27')).toBe('CN · 27/09/2026')
    expect(fmtDayVN('')).toBe('')
  })
})
