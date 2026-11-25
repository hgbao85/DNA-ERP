import { describe, expect, it } from 'vitest'
import { DEFAULT_MERGE_MAX_SKUS, DEFAULT_MERGE_WINDOW_DAYS, maxGapDays, steelNeedDate, steelNeedSpan, steelNeedSpanMessage } from './steelNeedWindow'

describe('mặc định', () => {
  it('khung 5 ngày, tối đa 2 SKU mỗi lệnh gộp', () => {
    expect(DEFAULT_MERGE_WINDOW_DAYS).toBe(5)
    expect(DEFAULT_MERGE_MAX_SKUS).toBe(2)
  })
})

describe('maxGapDays', () => {
  it('khung tính cả hai đầu: chênh tối đa = khung - 1, không âm', () => {
    expect(maxGapDays(3)).toBe(2)
    expect(maxGapDays(2)).toBe(1)
    expect(maxGapDays(1)).toBe(0)
    expect(maxGapDays(0)).toBe(0)
  })
})

describe('steelNeedDate', () => {
  it('ưu tiên Mua hàng, không có thì lấy Khung cơ khí, cả hai trống thì null', () => {
    expect(steelNeedDate('2026-11-12', '2026-11-20')).toBe('2026-11-12')
    expect(steelNeedDate('', '2026-11-20')).toBe('2026-11-20')
    expect(steelNeedDate(null, '2026-11-20')).toBe('2026-11-20')
    expect(steelNeedDate(undefined, undefined)).toBeNull()
    expect(steelNeedDate('', '')).toBeNull()
  })
})

describe('steelNeedSpan', () => {
  it('trả null khi dưới 2 SKU có mốc (SKU không có mốc bị bỏ qua)', () => {
    expect(steelNeedSpan([])).toBeNull()
    expect(steelNeedSpan([{ code: 'A', date: '2026-11-12' }])).toBeNull()
    expect(steelNeedSpan([{ code: 'A', date: '2026-11-12' }, { code: 'B', date: null }])).toBeNull()
  })

  it('tìm SKU sớm nhất / muộn nhất và số ngày giữa hai mốc', () => {
    const span = steelNeedSpan([
      { code: 'GHE-J55', date: '2026-11-12' },
      { code: 'BAN-J55', date: '2026-11-20' },
      { code: 'TU-J55', date: '2026-11-15' },
      { code: 'KHONG-MOC', date: undefined },
    ])
    expect(span).toEqual({
      days: 8,
      earliest: { code: 'GHE-J55', date: '2026-11-12' },
      latest: { code: 'BAN-J55', date: '2026-11-20' },
    })
  })

  it('tính đúng khi vắt qua cuối tháng / cuối năm và khi cùng ngày', () => {
    expect(steelNeedSpan([{ code: 'A', date: '2026-12-30' }, { code: 'B', date: '2027-01-02' }])?.days).toBe(3)
    expect(steelNeedSpan([{ code: 'A', date: '2026-03-01' }, { code: 'B', date: '2026-02-26' }])?.days).toBe(3)
    expect(steelNeedSpan([{ code: 'A', date: '2026-11-12' }, { code: 'B', date: '2026-11-12' }])?.days).toBe(0)
  })
})

// 24/11/2026 (anh Nhân): bỏ chặn khung N ngày khi gộp / sửa hạn lệnh gộp - không còn câu báo nào, kể cả khi mốc cách rất xa.
describe('steelNeedSpanMessage', () => {
  const at = (a: string, b: string) => steelNeedSpan([{ code: 'GHE-J55', date: a }, { code: 'BAN-J55', date: b }])

  it('không còn chặn theo khung ngày (24/11/2026), kể cả mốc cách xa hoặc khác năm', () => {
    expect(steelNeedSpanMessage(at('2026-11-01', '2026-11-04'), 3)).toBeNull()
    expect(steelNeedSpanMessage(at('2026-11-10', '2026-11-30'), DEFAULT_MERGE_WINDOW_DAYS)).toBeNull()
    expect(steelNeedSpanMessage(at('2026-12-28', '2027-01-05'), 1)).toBeNull()
    expect(steelNeedSpanMessage(null, 3)).toBeNull()
  })
})
