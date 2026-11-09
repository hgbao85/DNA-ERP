import { describe, it, expect } from 'vitest'
import { buildHanThucCoMap, loadHanThucCo, hanThucCoKey } from './hanThucCo'
import type { PieceSyncRow } from '../../services/piece-sync-board-api'

const row = (over: Partial<PieceSyncRow>): PieceSyncRow => ({
  productionInvoiceId: 'pi1', piCode: 'PI1', productionOrderId: '10', skuCode: 'S', skuName: null, orderQuantity: 1,
  pieceId: '5', pieceCode: 'P5', pieceName: 'Khung', qtyPerUnit: 1, requiredQty: 10,
  phoiSyncedQty: 6, syncPercent: 60, hanDoneQty: 2, hanTodayQty: 0, notWeldedQty: 4, phoiNotSyncedQty: 4,
  hanAheadOfPhoi: false, selfCalcPieceQty: null, lines: [], ...over,
})

describe('hanThucCo', () => {
  it('map có dữ liệu + lines', () => {
    const m = buildHanThucCoMap({
      rows: [row({
        lines: [{
          segmentSpecId: 's1', materialCode: 'V15', materialName: 'Sắt V', materialSpec: '15', cutLengthMm: 500, qtyPerPiece: 2,
          usableQty: 8, makeablePieces: 4, steps: ['CAT', 'DAP'], limitingStep: 'DAP',
        }],
      })],
    })
    const v = m.get(hanThucCoKey('10', '5'))!
    expect(v.thucCoQty).toBe(4)
    // usable 8 đoạn − đã hàn 2 mảnh × 2 đoạn = 4 đoạn còn trong tay (= 2 mảnh nữa).
    expect(v.parts).toEqual([{ loaiSat: 'Sắt V', quyCach: '15', len: 500, perChiTiet: 2, thucCo: 4, nghenO: 'Dập' }])
  })
  it('dòng đã đủ (limitingStep null) thì không có nghenO', () => {
    const v = buildHanThucCoMap({
      rows: [row({
        lines: [{
          segmentSpecId: 's1', materialCode: 'V15', materialName: 'Sắt V', materialSpec: '15', cutLengthMm: 500, qtyPerPiece: 2,
          usableQty: 8, makeablePieces: 4, steps: ['CAT'], limitingStep: null,
        }],
      })],
    }).get('10:5')!
    expect(v.parts?.[0]).not.toHaveProperty('nghenO')
  })
  it('materialSpec null → quy cách = mã vật tư', () => {
    const v = buildHanThucCoMap({
      rows: [row({
        lines: [{
          segmentSpecId: 's1', materialCode: 'V15', materialName: 'Sắt V', materialSpec: null, cutLengthMm: 500, qtyPerPiece: 2,
          usableQty: 8, makeablePieces: 4, steps: ['CAT'], limitingStep: null,
        }],
      })],
    }).get('10:5')!
    expect(v.parts?.[0].quyCach).toBe('V15')
  })
  it('đoạn còn trong tay không âm khi Hàn đã báo vượt', () => {
    const v = buildHanThucCoMap({
      rows: [row({
        hanDoneQty: 9,
        lines: [{
          segmentSpecId: 's1', materialCode: 'V15', materialName: 'Sắt V', cutLengthMm: 500, qtyPerPiece: 2, materialSpec: null,
          usableQty: 8, makeablePieces: 4, steps: ['CAT'], limitingStep: null,
        }],
      })],
    }).get('10:5')!
    expect(v.parts?.[0].thucCo).toBe(0)
  })
  it('notWeldedQty null và không có lines → để undefined', () => {
    const v = buildHanThucCoMap({ rows: [row({ notWeldedQty: null })] }).get('10:5')!
    expect(v.thucCoQty).toBeUndefined()
    expect(v.parts).toBeUndefined()
  })
  it('lỗi API → map rỗng', async () => {
    const m = await loadHanThucCo(['pi1'], async () => { throw new Error('403') })
    expect(m.size).toBe(0)
  })
  it('gộp id trùng, không có id thì không gọi API', async () => {
    let got: string[] = []
    await loadHanThucCo(['a', 'a', 'b'], async ids => { got = ids; return { rows: [] } })
    expect(got).toEqual(['a', 'b'])
    let called = false
    await loadHanThucCo([], async () => { called = true; return { rows: [] } })
    expect(called).toBe(false)
  })
})
