import { describe, expect, it } from 'vitest'
import { deadlineInfo, deadlineLabel, deadlineText, stageEmptyText, stageMissingText } from './stageOutputModel'

describe('stageOutputModel', () => {
  it('còn thiếu / đủ số', () => {
    expect(stageMissingText({ complete: false, missingPieces: 1200 })).toBe('còn thiếu 1.200 mảnh')
    expect(stageMissingText({ complete: false, missingPieces: -2 })).toBe('còn thiếu 0 mảnh')
    expect(stageMissingText({ complete: true, missingPieces: 0 })).toBe('Đủ số')
    expect(stageMissingText({ complete: false, missingPieces: 371 }, 'đoạn / mảnh')).toBe('còn thiếu 371 đoạn / mảnh')
  })
  it('hạn giao dd/mm giờ Việt Nam', () => {
    expect(deadlineText('2026-12-05')).toBe('Hạn 05/12')
    expect(deadlineText(null)).toBeNull()
    expect(deadlineText('x')).toBeNull()
  })
  it('câu hết lệnh của Hàn / Sơn không nhắc xếp lệnh', () => {
    expect(stageEmptyText('HAN')).toContain('mảnh Phôi đạt KCS')
    expect(stageEmptyText('SON')).toContain('khung Hàn đạt KCS')
    expect(stageEmptyText('HAN')).not.toMatch(/xếp lệnh/)
  })
})

describe('deadlineInfo (màu hạn giao)', () => {
  const now = new Date(2026, 11, 20, 9, 0) // 20/12/2026
  it('còn > 3 ngày: bình thường', () => expect(deadlineInfo('2026-12-25', now)).toMatchObject({ date: '25/12', tone: 'normal' }))
  it('còn ≤ 3 ngày (kể cả hôm nay): sắp tới hạn', () => {
    expect(deadlineInfo('2026-12-23', now)?.tone).toBe('soon')
    expect(deadlineInfo('2026-12-20', now)?.tone).toBe('soon')
    expect(deadlineInfo('2026-12-24', now)?.tone).toBe('normal')
  })
  it('quá hạn: đỏ + số ngày', () => expect(deadlineInfo('2026-12-18', now)).toMatchObject({ tone: 'late', lateDays: 2 }))
  it('không có hạn / sai định dạng: null', () => {
    expect(deadlineInfo(null, now)).toBeNull()
    expect(deadlineInfo('x', now)).toBeNull()
  })
  it('nhãn: viết hoa / viết thường, thêm "quá hạn"', () => {
    expect(deadlineLabel('2026-12-25', false, now)).toBe('Hạn 25/12')
    expect(deadlineLabel('2026-12-25', true, now)).toBe('hạn 25/12')
    expect(deadlineLabel('2026-12-18', true, now)).toBe('hạn 18/12 · quá hạn')
    expect(deadlineLabel(null, false, now)).toBeNull()
  })
})
