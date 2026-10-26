import { describe, expect, it } from 'vitest'
import { DEFAULT_MERGE_MAX_SKUS, DEFAULT_MERGE_WINDOW_DAYS, maxGapDays, steelNeedDate, steelNeedSpan, steelNeedSpanMessage } from './steelNeedWindow'

describe('mặc định', () => {
  it('khung 3 ngày, tối đa 2 SKU mỗi lệnh gộp', () => {
    expect(DEFAULT_MERGE_WINDOW_DAYS).toBe(3)
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

describe('steelNeedSpanMessage', () => {
  const at = (a: string, b: string) => steelNeedSpan([{ code: 'GHE-J55', date: a }, { code: 'BAN-J55', date: b }])

  it('ví dụ của Sếp: khung 3 ngày - ngày 1 gộp được ngày 3, không gộp được ngày 4', () => {
    expect(steelNeedSpanMessage(at('2026-11-01', '2026-11-01'), 3)).toBeNull() // cùng ngày
    expect(steelNeedSpanMessage(at('2026-11-01', '2026-11-02'), 3)).toBeNull()
    expect(steelNeedSpanMessage(at('2026-11-01', '2026-11-03'), 3)).toBeNull() // chênh 2 = N - 1: được
    expect(steelNeedSpanMessage(at('2026-11-01', '2026-11-04'), 3)).not.toBeNull() // chênh 3: chặn
  })

  it('khung 1 ngày = chỉ gộp cùng ngày; không có span thì không báo', () => {
    expect(steelNeedSpanMessage(at('2026-11-01', '2026-11-01'), 1)).toBeNull()
    expect(steelNeedSpanMessage(at('2026-11-01', '2026-11-02'), 1)).not.toBeNull()
    expect(steelNeedSpanMessage(null, 3)).toBeNull()
  })

  it('báo đúng lời văn của BE khi vượt khung', () => {
    expect(steelNeedSpanMessage(at('2026-11-12', '2026-11-20'), 3)).toBe(
      'Mốc cần sắt của các SKU trong lệnh gộp cách nhau 8 ngày (sớm nhất 12/11 – GHE-J55, muộn nhất 20/11 – BAN-J55) - ' +
        'chỉ được gộp trong khung 3 ngày (chênh tối đa 2 ngày, vd ngày 1 gộp được ngày 3). ' +
        'Dời lại mốc hoặc tách SKU ra lệnh riêng.',
    )
  })

  it('nêu đúng khung / chênh tối đa theo cấu hình khác', () => {
    expect(steelNeedSpanMessage(at('2026-11-01', '2026-11-08'), 5)).toContain('khung 5 ngày (chênh tối đa 4 ngày, vd ngày 1 gộp được ngày 5)')
    expect(steelNeedSpanMessage(at('2026-11-01', '2026-11-02'), 1)).toContain('khung 1 ngày (chênh tối đa 0 ngày, vd ngày 1 gộp được ngày 1)')
  })

  it('thêm năm khi hai mốc ở hai năm khác nhau', () => {
    expect(steelNeedSpanMessage(at('2026-12-28', '2027-01-05'), 3)).toContain('sớm nhất 28/12/2026 – GHE-J55, muộn nhất 05/01/2027 – BAN-J55')
  })
})
