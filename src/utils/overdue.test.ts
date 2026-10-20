import { describe, expect, it } from 'vitest'
import { overdueDays } from './overdue'

describe('overdueDays', () => {
  const now = new Date(2026, 9, 20, 9, 30) // 20/10/2026 09:30 giờ máy

  it('hạn đã qua: số ngày lịch, không phụ thuộc giờ trong ngày', () => {
    expect(overdueDays(new Date(2026, 9, 7, 23, 59), now)).toBe(13)
    expect(overdueDays(new Date(2026, 9, 19, 0, 0), now)).toBe(1)
  })

  it('hạn hôm nay hoặc tương lai: chưa quá hạn', () => {
    expect(overdueDays(new Date(2026, 9, 20, 0, 0), now)).toBe(0)
    expect(overdueDays(new Date(2026, 9, 31), now)).toBe(0)
  })

  it('qua tháng/năm vẫn đúng', () => {
    expect(overdueDays(new Date(2025, 11, 31), new Date(2026, 0, 2))).toBe(2)
  })
})
