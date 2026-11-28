import { describe, expect, it } from 'vitest'
import { butToanKiemKe, docSoDem, dongTonManh } from './kiemKeManhModel'

describe('dongTonManh', () => {
  it('chỉ lấy dòng mảnh của đúng kho, gộp cùng mảnh, sắp theo mã', () => {
    const rows = dongTonManh([
      { warehouseId: '5', pieceId: '2', pieceCode: 'M-10', pieceName: 'Tựa', qty: 3 },
      { warehouseId: '5', pieceId: '1', pieceCode: 'M-2', pieceName: 'Chân', qty: 4 },
      { warehouseId: '5', pieceId: '2', pieceCode: 'M-10', pieceName: 'Tựa', qty: 1.5 },
      { warehouseId: '5', pieceId: null, qty: 99 },
      { warehouseId: '6', pieceId: '1', pieceCode: 'M-2', qty: 7 },
    ], '5')
    expect(rows).toEqual([
      { pieceId: '1', pieceCode: 'M-2', pieceName: 'Chân', qty: 4 },
      { pieceId: '2', pieceCode: 'M-10', pieceName: 'Tựa', qty: 4.5 },
    ])
  })

  it('chưa biết kho thì rỗng', () => {
    expect(dongTonManh([{ warehouseId: '5', pieceId: '1', qty: 1 }], null)).toEqual([])
  })
})

describe('docSoDem', () => {
  it('chỉ nhận số nguyên không âm', () => {
    expect(docSoDem(' 12 ')).toBe(12)
    expect(docSoDem('0')).toBe(0)
    expect(docSoDem('2,5')).toBeNull()
    expect(docSoDem('-1')).toBeNull()
    expect(docSoDem('')).toBeNull()
  })
})

describe('butToanKiemKe', () => {
  const base = { warehouseId: '5', openingBalanceWarehouseId: '1', pieceId: '9', tonHeThong: 40, ghiChu: ' Kiểm kê ngày nghỉ ' }

  it('đếm ít hơn: trừ kho Sơn sang "Cân đối tồn kho", kèm tồn lúc mở', () => {
    expect(butToanKiemKe({ ...base, soDem: 36 })).toEqual({
      fromWarehouseId: '5', toWarehouseId: '1', pieceId: '9', qty: 4,
      note: 'Kiểm kê mảnh: 40 → 36. Kiểm kê ngày nghỉ', expectedWarehouseId: '5', expectedCurrentQty: 40,
    })
  })

  it('đếm nhiều hơn: cộng vào kho Sơn từ "Cân đối tồn kho"', () => {
    const b = butToanKiemKe({ ...base, soDem: 43 })
    expect(b).toMatchObject({ fromWarehouseId: '1', toWarehouseId: '5', qty: 3 })
  })

  it('đếm khớp: không ghi gì', () => {
    expect(butToanKiemKe({ ...base, soDem: 40 })).toBeNull()
  })
})
