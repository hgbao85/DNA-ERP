import { describe, expect, it } from 'vitest'
import type { Pallet, PalletLoad, PalletPieceRow } from '../../../services/pallets-api'
import {
  addPalletToLines, buildWeavingLines, checkLoad, checkShort, countByStatus, filterPallets, loadTiles, palletQueryOf,
  palletWeavingError, removePalletFromLines, setLineQty, workerPalletNote,
} from './palletModel'

const load = (o: Partial<PalletLoad> = {}): PalletLoad => ({
  id: 'L1', productionInvoiceId: '100', piCode: 'PI-1', lenhCode: 'LSX-1', productionOrderId: '70', sku: 'SKU70', productName: 'Ghế',
  pieceId: '8', pieceCode: 'M8', pieceName: 'Tựa', qty: 6, capacity: null, overCapacity: false, loadedAt: '2026-11-24T08:00:00Z',
  loadedByName: 'Kho', paintedQty: 6, shortReason: null, paintedAt: '2026-11-24T09:00:00Z', paintedByName: 'An',
  productionBatchId: '1', slip: null, clearedAt: null, clearedByName: null, clearedReason: null, ...o,
})
const pallet = (o: Partial<Pallet> = {}, l: Partial<PalletLoad> | null = {}): Pallet => ({
  id: '5', code: 'PL-005', qrToken: 't5', status: 'PAINTED', statusLabel: 'Sơn xong', warehouseCode: 'son', warehouseName: 'Kho Sơn',
  note: null, updatedAt: '2026-11-24T09:00:00Z', load: l === null ? null : load(l), ...o,
})
const row = (o: Partial<PalletPieceRow> = {}): PalletPieceRow => ({
  productionOrderId: '70', sku: 'SKU70', productName: 'Ghế', pieceId: '8', pieceCode: 'M8', pieceName: 'Tựa', plannedQty: 10,
  receivedQty: 7, reportedQty: 2, pendingQty: 3, loadedQty: 5, reportableQty: 5, remainingQty: 2, capacity: 4, ...o,
})

describe('palletModel - danh sách', () => {
  const list = [
    pallet({ id: '1', code: 'PL-001', status: 'EMPTY' }, null),
    pallet({ id: '2', code: 'PL-002', status: 'LOADED' }, { lenhCode: 'LSX-9', paintedQty: null }),
    pallet({ id: '3', code: 'PL-003' }),
  ]
  it('lọc theo trạng thái + chữ (mã pallet / lệnh / SKU / mảnh)', () => {
    expect(filterPallets(list, 'ALL', '').map(p => p.code)).toEqual(['PL-001', 'PL-002', 'PL-003'])
    expect(filterPallets(list, 'LOADED', '').map(p => p.code)).toEqual(['PL-002'])
    expect(filterPallets(list, 'ALL', 'lsx-9').map(p => p.code)).toEqual(['PL-002'])
    expect(filterPallets(list, 'ALL', ' pl-00 ')).toHaveLength(3)
    expect(filterPallets(list, 'EMPTY', 'tựa')).toEqual([])
  })
  it('đếm theo trạng thái', () => {
    expect(countByStatus(list)).toEqual({ ALL: 3, EMPTY: 1, LOADED: 1, PAINTED: 1, ON_SLIP: 0 })
  })
})

describe('palletModel - xếp pallet', () => {
  it('chặn vượt "Còn xếp được", cảnh báo vượt sức chứa (vẫn xếp được)', () => {
    expect(checkLoad(null, '5', '1').error).toBe('Chọn mảnh')
    expect(checkLoad(row(), null, '1').error).toBe('Chọn pallet trống')
    expect(checkLoad(row(), '5', '').error).toBe('Nhập số mảnh')
    expect(checkLoad(row(), '5', '0').error).toBe('Nhập số mảnh')
    expect(checkLoad(row(), '5', '3').error).toContain('tối đa 2')
    expect(checkLoad(row(), '5', '2')).toEqual({ error: null, warning: null, qty: 2 })
    const over = checkLoad(row({ remainingQty: 9, capacity: 4 }), '5', '6')
    expect(over.error).toBeNull()
    expect(over.warning).toContain('sức chứa 4')
  })
  it('4 ô số: Sơn đã nhận / Đã xếp pallet / Còn xếp được / Kế hoạch', () => {
    expect(loadTiles(row()).map(t => [t.label, t.value])).toEqual([
      ['Sơn đã nhận', '7'], ['Đã xếp pallet', '5'], ['Còn xếp được', '2'], ['Kế hoạch', '10'],
    ])
    expect(loadTiles(row({ receivedQty: null }))[0]).toMatchObject({ value: '—', hint: 'chưa bật giao nhận giữa tổ' })
  })
})

describe('palletModel - xuất đan theo pallet', () => {
  it('chỉ pallet Sơn xong, chưa có trong phiếu, không nằm trên phiếu khác', () => {
    expect(palletWeavingError(pallet(), [])).toBeNull()
    expect(palletWeavingError(pallet({ status: 'LOADED' }, { paintedQty: null }), [])).toContain('Chờ sơn')
    expect(palletWeavingError(pallet({ status: 'ON_SLIP' }, { slip: { id: '9', code: 'XK-1', status: 'DRAFT' } }), [])).toContain('XK-1')
    const lines = addPalletToLines([], pallet())
    expect(palletWeavingError(pallet(), lines)).toContain('đã có trong phiếu')
  })

  it('cùng SKU + mảnh gộp 1 dòng (cộng số), khác mảnh thêm dòng; gửi kèm palletIds', () => {
    let lines = addPalletToLines([], pallet())
    lines = addPalletToLines(lines, pallet({ id: '6', code: 'PL-006' }, { paintedQty: 4 }))
    lines = addPalletToLines(lines, pallet({ id: '7', code: 'PL-007' }, { pieceId: '9', pieceName: 'Đáy', paintedQty: 3 }))
    expect(lines.map(l => [l.key, l.maxQty, l.qty, l.pallets.map(p => p.code)])).toEqual([
      ['70:8', 10, 10, ['PL-005', 'PL-006']],
      ['70:9', 3, 3, ['PL-007']],
    ])
    expect(buildWeavingLines(lines)).toEqual([
      { kind: 'WEAVING_PIECE', productionOrderId: '70', pieceId: '8', qty: 10, palletIds: ['5', '6'] },
      { kind: 'WEAVING_PIECE', productionOrderId: '70', pieceId: '9', qty: 3, palletIds: ['7'] },
    ])
  })

  it('số chỉ sửa GIẢM; bỏ pallet thì giảm trần, dòng hết pallet thì bỏ', () => {
    let lines = addPalletToLines([], pallet())
    lines = addPalletToLines(lines, pallet({ id: '6', code: 'PL-006' }, { paintedQty: 4 }))
    expect(setLineQty(lines, '70:8', '99')[0].qty).toBe(10)
    expect(setLineQty(lines, '70:8', '7')[0].qty).toBe(7)
    expect(setLineQty(lines, '70:8', '')[0].qty).toBe(10)
    const lower = setLineQty(lines, '70:8', '9')
    const removed = removePalletFromLines(lower, '5')
    expect(removed[0]).toMatchObject({ maxQty: 4, qty: 4, pallets: [{ code: 'PL-006' }] })
    expect(removePalletFromLines(removed, '6')).toEqual([])
  })

  it('mã quét / gõ: link tem -> token, PL-xxx viết hoa', () => {
    expect(palletQueryOf('https://erp.vn/floor?pallet=abc%2F1')).toBe('abc/1')
    expect(palletQueryOf(' pl-007 ')).toBe('PL-007')
    expect(palletQueryOf('tokenXYZ')).toBe('tokenXYZ')
  })
})

describe('palletModel - công nhân Sơn', () => {
  it('báo thiếu: số < số trên pallet, ≥ 1, lý do ≥ 3 ký tự', () => {
    expect(checkShort(6, '', 'abc').error).toContain('Nhập số')
    expect(checkShort(6, '6', 'abc').error).toContain('nhỏ hơn 6')
    expect(checkShort(6, '4', ' ab ').error).toContain('lý do')
    expect(checkShort(6, '4', ' rơi vỡ ')).toEqual({ error: null, qty: 4, reason: 'rơi vỡ' })
  })
  it('câu trạng thái: Chờ sơn báo được, Trống / đã sơn thì báo rõ', () => {
    expect(workerPalletNote(pallet({ status: 'LOADED' }, { paintedQty: null }))).toBeNull()
    expect(workerPalletNote(pallet({ status: 'EMPTY' }, null))?.text).toContain('đang trống')
    expect(workerPalletNote(pallet())?.text).toContain('đã báo Sơn xong 6 mảnh (An)')
  })
})
