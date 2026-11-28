import { describe, expect, it } from 'vitest'
import { openingRowKey, openingWaitingError, parseOpeningQty } from './openingWaitingModel'

describe('openingWaitingModel (đầu kỳ khung chờ Sơn, 28/11/2026)', () => {
  it('chỉ nhận số nguyên dương', () => {
    expect(parseOpeningQty('100')).toBe(100)
    expect(parseOpeningQty(' 7 ')).toBe(7)
    expect(parseOpeningQty('0')).toBeNull()
    expect(parseOpeningQty('')).toBeNull()
    expect(parseOpeningQty('1.5')).toBeNull()
    expect(parseOpeningQty('-3')).toBeNull()
  })
  it('câu lỗi cho nút Lưu', () => {
    expect(openingWaitingError('')).toMatch(/Nhập số/)
    expect(openingWaitingError('0')).toMatch(/lớn hơn 0/)
    expect(openingWaitingError('12')).toBeNull()
  })
  it('khoá dòng theo SKU + mảnh', () => {
    expect(openingRowKey({ productionOrderId: '70', pieceId: '8' })).toBe('70:8')
  })
})
