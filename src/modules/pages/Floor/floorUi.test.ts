import { describe, expect, it } from 'vitest'
import { ApiError } from '../../../services/core/apiError'
import type { BeMyOutputRow } from '../../../services/floor-api'
import { describeError, dayKey, hhmm, outputTotals, overBy, rangeBounds, receiveVerdict } from './floorUi'

describe('describeError', () => {
  it('mất mạng khi gửi số: cảnh báo (không phải lỗi đỏ), nói số còn nguyên và không bị cộng 2 lần', () => {
    const r = describeError(new ApiError('Network Error', 0, 'NetworkError'), true)
    expect(r.tone).toBe('warn')
    expect(r.offline).toBe(true)
    expect(r.text).toContain('còn nguyên')
    expect(r.text).toContain('không bị cộng 2 lần')
  })

  it('mất mạng ở màn khác (đăng nhập...): câu ngắn, không nhắc số', () => {
    const r = describeError(new ApiError('x', 0, 'NetworkError'))
    expect(r.offline).toBe(true)
    expect(r.text).toBe('Mất kết nối - kiểm tra mạng rồi thử lại.')
  })

  it('máy chủ từ chối: lỗi đỏ, giữ nguyên lý do tiếng Việt từ BE', () => {
    const r = describeError(new ApiError('Loại sắt này chưa nhận - quét mã khu nhận sắt', 409, 'ConflictException'), true)
    expect(r).toEqual({ tone: 'err', offline: false, text: 'Loại sắt này chưa nhận - quét mã khu nhận sắt' })
  })

  it('429 (đăng nhập quá nhanh): câu thân thiện, không lộ "ThrottlerException"', () => {
    const r = describeError(new ApiError('ThrottlerException: Too Many Requests', 429, 'ThrottlerException'))
    expect(r.text).not.toContain('Throttler')
    expect(r.text).toContain('1 phút')
  })

  it('lỗi lạ (không phải ApiError)', () => {
    expect(describeError(new Error('boom'))).toEqual({ tone: 'err', offline: false, text: 'Có lỗi, thử lại' })
    expect(describeError(undefined).tone).toBe('err')
  })
})

describe('receiveVerdict - nhận sắt', () => {
  it('chưa nhập (hoặc chỉ khoảng trắng) = empty: không cho xác nhận', () => {
    expect(receiveVerdict('', 14)).toEqual({ kind: 'empty' })
    expect(receiveVerdict('  ', 14)).toEqual({ kind: 'empty' })
  })
  it('đúng số kho xuất = exact (vẫn hỏi xác nhận trước khi nhận - người dùng 2026-10-15: lưu gì cũng xác nhận)', () => {
    expect(receiveVerdict('14', 14)).toEqual({ kind: 'exact', diff: 0 })
  })
  it('thiếu / thừa = hỏi lại 1 lần, diff = đếm − xuất', () => {
    expect(receiveVerdict('13', 14)).toEqual({ kind: 'short', diff: -1 })
    expect(receiveVerdict('0', 14)).toEqual({ kind: 'short', diff: -14 })
    expect(receiveVerdict('16', 14)).toEqual({ kind: 'over', diff: 2 })
  })
})

describe('overBy - cảnh báo vượt ở bảng xác nhận', () => {
  it('chưa vượt = 0, đúng bằng số cần cũng là 0', () => {
    expect(overBy(120, 0, 100)).toBe(0)
    expect(overBy(120, 20, 100)).toBe(0)
  })
  it('vượt = phần dư so với số cần', () => {
    expect(overBy(120, 20, 110)).toBe(10)
    expect(overBy(120, 130, 5)).toBe(15) // đã vượt từ trước, báo thêm càng vượt
    expect(overBy(0, 0, 3)).toBe(3)
  })
})

describe('rangeBounds - khoảng thời gian "Sản lượng của tôi"', () => {
  const now = new Date(2026, 9, 15, 7, 50) // 15/10/2026 07:50
  it('7 ngày qua: từ ĐẦU ngày cách đây 6 ngày (7 ngày lịch, không cắt đôi ngày làm việc) đến bây giờ', () => {
    const r = rangeBounds('7d', now)
    expect(r.from).toEqual(new Date(2026, 9, 9, 0, 0))
    expect(r.to).toEqual(now)
  })
  it('7 ngày qua qua ranh giới tháng', () => {
    expect(rangeBounds('7d', new Date(2026, 10, 3, 9, 0)).from).toEqual(new Date(2026, 9, 28, 0, 0))
  })
  it('tháng này: từ mùng 1 đến bây giờ', () => {
    const r = rangeBounds('month', now)
    expect(r.from).toEqual(new Date(2026, 9, 1))
    expect(r.to).toEqual(now)
    expect(r.label).toBe('tháng 10/2026')
  })
  it('tháng trước: trọn tháng (đến mili-giây cuối), qua ranh giới năm cũng đúng', () => {
    const r = rangeBounds('lastMonth', now)
    expect(r.from).toEqual(new Date(2026, 8, 1))
    expect(r.to).toEqual(new Date(2026, 8, 30, 23, 59, 59, 999))
    const jan = rangeBounds('lastMonth', new Date(2027, 0, 5))
    expect(jan.from).toEqual(new Date(2026, 11, 1))
    expect(jan.to).toEqual(new Date(2026, 11, 31, 23, 59, 59, 999))
    expect(jan.label).toBe('tháng 12/2026')
  })
})

describe('dayKey / outputTotals - cộng theo ngày', () => {
  const row = (over: Partial<BeMyOutputRow> & { qty?: number[] }): BeMyOutputRow => ({
    id: '1', kind: 'CUT', createdAt: new Date(2026, 9, 15, 8, 0).toISOString(), piCode: 'PI-1', step: null,
    workstation: null, state: 'OPEN', reversed: null,
    lines: (over.qty ?? [1]).map((q) => ({ qty: q, segment: { cutLengthMm: 185, materialCode: 'S' }, piece: null })),
    ...over,
  })

  it('dayKey theo giờ máy, 2 chữ số', () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 59).toISOString())).toBe('2026-01-05')
    expect(dayKey(new Date(2026, 9, 15, 0, 1).toISOString())).toBe('2026-10-15')
  })

  it('cộng theo loại việc, không gộp Cắt với Uốn và không trộn đoạn với mảnh', () => {
    const t = outputTotals([
      row({ qty: [20, 100] }),
      row({ qty: [5] }),
      row({ kind: 'STEP', step: 'UON', qty: [40] }),
      row({ kind: 'PIECE', qty: [7] }),
    ])
    expect(t).toEqual([{ op: 'CAT', qty: 125 }, { op: 'UON', qty: 40 }, { op: 'PIECE', qty: 7 }])
  })

  it('bỏ lần báo đã bị QLSX đảo', () => {
    const reversed = row({ qty: [50], reversed: { reason: 'nhập nhầm', at: '', byName: null } })
    expect(outputTotals([row({ qty: [3] }), reversed])).toEqual([{ op: 'CAT', qty: 3 }])
    expect(outputTotals([reversed])).toEqual([])
  })

  it('thứ tự cố định: Cắt trước, công đoạn phụ theo quy trình, mảnh sau cùng', () => {
    const t = outputTotals([row({ kind: 'PIECE' }), row({ kind: 'STEP', step: 'TAN' }), row({ kind: 'STEP', step: 'UON' }), row({})])
    expect(t.map((x) => x.op)).toEqual(['CAT', 'UON', 'TAN', 'PIECE'])
  })
})

describe('hhmm', () => {
  it('giờ:phút 2 chữ số', () => {
    expect(hhmm(new Date(2026, 9, 14, 8, 5))).toMatch(/^08[:.]05$/)
  })
})
