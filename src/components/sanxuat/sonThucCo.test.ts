import { describe, it, expect } from 'vitest'
import { tinhKhungSanDeSon, loadHanPassedByPiece, sonThucCoKey } from './sonThucCo'

describe('tinhKhungSanDeSon', () => {
  it('Hàn đạt trừ Sơn đã báo (đợt mở + chờ KCS + đạt)', () => {
    expect(tinhKhungSanDeSon(100, { openQty: 5, awaitingQcQty: 10, passedQty: 20 })).toBe(65)
  })
  it('Hàn có lỗi KCS: chỉ tính số đạt đã truyền vào', () => {
    expect(tinhKhungSanDeSon(90, { awaitingQcQty: 0, passedQty: 30 })).toBe(60)
  })
  it('Sơn báo vượt → 0', () => {
    expect(tinhKhungSanDeSon(10, { awaitingQcQty: 5, passedQty: 20 })).toBe(0)
  })
  it('không có dữ liệu Hàn → undefined', () => {
    expect(tinhKhungSanDeSon(undefined, { awaitingQcQty: 0, passedQty: 0 })).toBeUndefined()
  })
})

describe('loadHanPassedByPiece', () => {
  it('gom theo lệnh+mảnh, lệnh lỗi bị bỏ qua', async () => {
    const m = await loadHanPassedByPiece(['a', 'b', 'a'], async id => {
      if (id === 'b') throw new Error('403')
      return { items: [{ pieceId: '1', passedQty: 7 }] } as never
    })
    expect(m.get(sonThucCoKey('a', '1'))).toBe(7)
    expect(m.size).toBe(1)
  })
})
