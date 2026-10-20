import { describe, expect, it } from 'vitest'
import { monthKey, YEAR_PAGE, yearPageEnd } from './monthYearLogic'

const pageOf = (value: number, max?: number) => {
  const end = yearPageEnd(value, max)
  return { start: end - YEAR_PAGE + 1, end }
}

describe('yearPageEnd', () => {
  it('trang đầu kết thúc đúng ở max: năm hiện tại nằm cuối, 11 năm trước nằm trước nó', () => {
    expect(pageOf(2026, 2026)).toEqual({ start: 2015, end: 2026 })
    expect(pageOf(2015, 2026)).toEqual({ start: 2015, end: 2026 })
  })

  it('ranh giới giữa hai trang: max-11 vẫn ở trang đầu, max-12 sang trang trước (và là năm cuối của nó)', () => {
    expect(pageOf(2015, 2026).start).toBe(2015)
    expect(pageOf(2014, 2026)).toEqual({ start: 2003, end: 2014 })
    expect(pageOf(2003, 2026)).toEqual({ start: 2003, end: 2014 })
    expect(pageOf(2002, 2026)).toEqual({ start: 1991, end: 2002 })
  })

  it('năm lớn hơn max vẫn ra trang chứa nó', () => {
    expect(pageOf(2030, 2026)).toEqual({ start: 2027, end: 2038 })
  })

  it('không có max: năm đang chọn nằm gần cuối trang', () => {
    expect(pageOf(2026)).toEqual({ start: 2018, end: 2029 })
  })

  it('với mọi năm, trang trả về luôn chứa năm đó và dài đúng 12 năm (có/không có max)', () => {
    for (const max of [undefined, 2026, 2031]) {
      for (let value = 1990; value <= 2040; value++) {
        const { start, end } = pageOf(value, max)
        expect({ value, max, inside: value >= start && value <= end, len: end - start + 1 }).toEqual({ value, max, inside: true, len: YEAR_PAGE })
      }
    }
  })
})

describe('monthKey', () => {
  it('đệm số 0 và so sánh chuỗi đúng thứ tự thời gian (dùng để mờ các tháng sau tháng hiện tại)', () => {
    expect(monthKey(2026, 3)).toBe('2026-03')
    expect(monthKey(2026, 10)).toBe('2026-10')
    expect(monthKey(2026, 9) < monthKey(2026, 10)).toBe(true)
    expect(monthKey(2025, 12) < monthKey(2026, 1)).toBe(true)
    expect(monthKey(2026, 11) > monthKey(2026, 10)).toBe(true)
  })
})
