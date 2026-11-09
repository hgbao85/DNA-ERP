import { describe, expect, it } from 'vitest'
import type { PieceSyncLine, PieceSyncRow } from '../../../services/piece-sync-board-api'
import { bottleneckLine, buildGroups, foldText, limitingText, matchesFilter, pendingQcValue, stepsText, summarizeRows, syncExplainText } from './pieceSyncModel'

const row = (o: Partial<PieceSyncRow>): PieceSyncRow => ({
  productionInvoiceId: 'pi1', piCode: 'PI-001', productionOrderId: 'po1', skuCode: 'GHE-01', skuName: 'Ghế sắt', orderQuantity: 10,
  pieceId: 'p1', pieceCode: 'M1', pieceName: 'Chân', qtyPerUnit: 1, requiredQty: 10,
  phoiSyncedQty: 10, syncPercent: 100, hanDoneQty: 0, hanTodayQty: 0, notWeldedQty: 10, phoiNotSyncedQty: 0,
  hanAheadOfPhoi: false, selfCalcPieceQty: null, lines: [], ...o,
})
const line = (makeablePieces: number, o: Partial<PieceSyncLine> = {}): PieceSyncLine => ({
  segmentSpecId: 's', materialCode: 'S1', materialName: 'Sắt', cutLengthMm: 500, qtyPerPiece: 1, materialSpec: null,
  usableQty: makeablePieces, makeablePieces, steps: ['CAT'], limitingStep: null, ...o,
})

describe('foldText', () => {
  it('bỏ dấu và hạ chữ thường', () => {
    expect(foldText('Hàn Đế')).toBe('han de')
  })
})

describe('matchesFilter', () => {
  it('Phôi chưa đủ: bỏ qua null và 100', () => {
    expect(matchesFilter(row({ syncPercent: 60 }), 'PHOI_THIEU')).toBe(true)
    expect(matchesFilter(row({ syncPercent: 100 }), 'PHOI_THIEU')).toBe(false)
    expect(matchesFilter(row({ syncPercent: null, phoiSyncedQty: null }), 'PHOI_THIEU')).toBe(false)
  })
  it('Hàn vượt Phôi và còn phôi chờ hàn', () => {
    expect(matchesFilter(row({ hanAheadOfPhoi: true }), 'HAN_VUOT')).toBe(true)
    expect(matchesFilter(row({ notWeldedQty: 0 }), 'CON_CHO_HAN')).toBe(false)
    expect(matchesFilter(row({ notWeldedQty: null }), 'CON_CHO_HAN')).toBe(false)
    expect(matchesFilter(row({ notWeldedQty: 3 }), 'CON_CHO_HAN')).toBe(true)
  })
})

describe('summarizeRows', () => {
  it('mảnh qtyPerUnit 2 chia nguyên xuống và là mảnh nghẽn', () => {
    const s = summarizeRows([
      row({ pieceName: 'Chân', qtyPerUnit: 1, phoiSyncedQty: 8, hanDoneQty: 8 }),
      row({ pieceName: 'Tay', qtyPerUnit: 2, phoiSyncedQty: 9, hanDoneQty: 6 }),
    ])
    expect(s.phoiSets).toBe(4)
    expect(s.phoiBottleneckPieceName).toBe('Tay')
    expect(s.hanSets).toBe(3)
  })
  it('mảnh null bị bỏ qua khi tính Phôi, vẫn tính Hàn', () => {
    const s = summarizeRows([
      row({ phoiSyncedQty: null, syncPercent: null, hanDoneQty: 2 }),
      row({ pieceName: 'B', phoiSyncedQty: 5, hanDoneQty: 7 }),
    ])
    expect(s.phoiSets).toBe(5)
    expect(s.phoiBottleneckPieceName).toBe('B')
    expect(s.hanSets).toBe(2)
  })
  it('không mảnh nào có số Phôi thì null', () => {
    const s = summarizeRows([row({ phoiSyncedQty: null, syncPercent: null })])
    expect(s.phoiSets).toBeNull()
    expect(s.phoiBottleneckPieceName).toBeNull()
  })
  it('nhóm rỗng', () => {
    expect(summarizeRows([])).toEqual({ phoiSets: null, phoiBottleneckPieceName: null, hanSets: null })
  })
})

describe('buildGroups', () => {
  const all = [
    row({ pieceId: 'a', pieceName: 'Chân', phoiSyncedQty: 4, syncPercent: 40 }),
    row({ pieceId: 'b', pieceName: 'Tay', pieceCode: 'M2', phoiSyncedQty: 10, syncPercent: 100 }),
    row({ productionInvoiceId: 'pi2', piCode: 'PI-002', productionOrderId: 'po2', skuCode: 'BAN-01', skuName: null, pieceId: 'c', pieceName: 'Mặt' }),
  ]
  it('nhóm theo PI-SKU giữ thứ tự BE', () => {
    const g = buildGroups(all, '', 'ALL')
    expect(g.map(x => x.piCode)).toEqual(['PI-001', 'PI-002'])
    expect(g[0].rows).toHaveLength(2)
  })
  it('lọc theo bộ lọc nhưng tóm tắt vẫn tính cả nhóm', () => {
    const g = buildGroups(all, '', 'PHOI_THIEU')
    expect(g).toHaveLength(1)
    expect(g[0].rows.map(r => r.pieceId)).toEqual(['a'])
    expect(g[0].summary.phoiSets).toBe(4)
  })
  it('tìm không phân biệt hoa thường, bỏ dấu', () => {
    expect(buildGroups(all, 'MAT', 'ALL').map(x => x.piCode)).toEqual(['PI-002'])
    expect(buildGroups(all, 'ban-01', 'ALL')).toHaveLength(1)
    expect(buildGroups(all, 'không có', 'ALL')).toHaveLength(0)
  })
})

describe('stepsText / limitingText', () => {
  it('nối công đoạn theo thứ tự', () => {
    expect(stepsText(['CAT', 'UON', 'DAP'])).toBe('Cắt → Uốn → Dập')
    expect(stepsText(['CAT'])).toBe('Cắt')
  })
  it('nghẽn ở khi có limitingStep, null khi đã đủ', () => {
    expect(limitingText({ limitingStep: 'DAP' })).toBe('nghẽn ở Dập')
    expect(limitingText({ limitingStep: null })).toBeNull()
  })
})

describe('pendingQcValue / syncExplainText', () => {
  it('Chưa qua KCS: undefined (BE cũ) và null đều thành null, 0 giữ nguyên', () => {
    expect(pendingQcValue({})).toBeNull()
    expect(pendingQcValue({ phoiPendingQcQty: null })).toBeNull()
    expect(pendingQcValue({ phoiPendingQcQty: 0 })).toBe(0)
    expect(pendingQcValue({ phoiPendingQcQty: 3 })).toBe(3)
  })
  it('lời giải thích đổi theo cách đếm', () => {
    expect(syncExplainText('PASSED_QC')).toContain('đã đạt KCS')
    expect(syncExplainText('REPORTED')).toContain('trừ đoạn KCS chấm lỗi')
  })
})

describe('bottleneckLine', () => {
  it('chọn dòng làm được ít nhất khi mảnh chưa đủ', () => {
    const l = bottleneckLine(row({ requiredQty: 10, lines: [line(8), line(3, { materialCode: 'S2' }), line(9)] }))
    expect(l?.materialCode).toBe('S2')
  })
  it('đã đủ hoặc không có dòng thì null', () => {
    expect(bottleneckLine(row({ requiredQty: 10, lines: [line(10), line(12)] }))).toBeNull()
    expect(bottleneckLine(row({ lines: [] }))).toBeNull()
  })
})
