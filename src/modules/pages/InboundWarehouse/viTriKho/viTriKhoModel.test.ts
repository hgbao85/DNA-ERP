import { describe, expect, it } from 'vitest'
import type { VtkStockRow } from '../../../../services/vi-tri-kho-api'
import {
  bulkLocationCodes, compareLocationCode, containerCloseProblems, dgLocationCheck, matchesStock, moveCheck, normalizeZone, pickCheck,
  shipQtyFromContainers, shipReadiness, stockTotal, toQty, tripleText,
} from './viTriKhoModel'

const row = (o: Partial<VtkStockRow> = {}): VtkStockRow => ({
  itemId: '1', lenhCode: 'MY-313', sku: 'GHE-01', productName: 'Ghế J55', poCode: 'PO-9', salesOrderItemId: '7', orderQty: 10,
  inStockQty: 4, locations: [{ id: 'l1', code: 'A-01-02', qty: 4 }], loadingQty: 2, unplacedQty: 1, toPackQty: 3, ...o,
})

describe('viTriKhoModel (vị trí kho Thành phẩm, 25/11/2026)', () => {
  it('V1: khai hàng loạt khu A dãy 1-3 ô 1-10 = 30 ô A-01-01 … A-03-10; sai khoảng / quá 500 báo lỗi', () => {
    const codes = bulkLocationCodes({ zone: 'a', aisleFrom: 1, aisleTo: 3, slotFrom: 1, slotTo: 10 })
    expect(Array.isArray(codes) && codes.length).toBe(30)
    if (!Array.isArray(codes)) throw new Error('unreachable')
    expect([codes[0], codes[10], codes[29]]).toEqual(['A-01-01', 'A-02-01', 'A-03-10'])
    expect(bulkLocationCodes({ zone: 'A', aisleFrom: 2, aisleTo: 1, slotFrom: 1, slotTo: 1 })).toMatch(/Dãy "từ"/)
    expect(bulkLocationCodes({ zone: 'A', aisleFrom: 1, aisleTo: 99, slotFrom: 1, slotTo: 99 })).toMatch(/tối đa 500/)
    expect(bulkLocationCodes({ zone: 'A-1', aisleFrom: 1, aisleTo: 1, slotFrom: 1, slotTo: 1 })).toMatch(/Khu/)
    expect(normalizeZone(' b2 ')).toBe('B2')
  })

  it('thứ tự ô ổn định theo số (A-01-02 trước A-01-10)', () => {
    expect(['A-01-10', 'B-01-01', 'A-01-02'].sort(compareLocationCode)).toEqual(['A-01-02', 'A-01-10', 'B-01-01'])
  })

  it('V9: nhãn luôn đủ lệnh · SKU · PO; dòng không có PO ghi —', () => {
    expect(tripleText({ lenhCode: 'MY-1', sku: 'S', poCode: null })).toBe('MY-1 · S · PO —')
  })

  it('V4: tồn thùng - tìm theo lệnh / SKU / PO / ô; dòng tổng cộng đủ 4 cột (không có cột đã xuất)', () => {
    const rows = [row(), row({ itemId: '2', poCode: 'PO-10', locations: [{ id: 'l2', code: 'B-01-01', qty: 6 }], inStockQty: 6 })]
    expect(rows.filter((r) => matchesStock(r, 'b-01')).map((r) => r.itemId)).toEqual(['2'])
    expect(rows.filter((r) => matchesStock(r, 'po-9')).map((r) => r.itemId)).toEqual(['1'])
    expect(stockTotal(rows)).toEqual({ inStockQty: 10, loadingQty: 4, unplacedQty: 2, toPackQty: 6 })
    expect(Object.keys(stockTotal([]))).not.toContain('shippedQty')
  })

  it('V2: bật vị trí kho thì phải quét ô trước khi lưu đóng gói', () => {
    expect(dgLocationCheck({ required: false, locationId: null }).ok).toBe(true)
    expect(dgLocationCheck({ required: true, locationId: null })).toEqual({ ok: false, reason: 'Quét tem ô cất thùng trước' })
    expect(dgLocationCheck({ required: true, locationId: '5' }).ok).toBe(true)
  })

  it('V4: chuyển ô - đủ bước, ô đi khác ô đến, không vượt số ở ô đi', () => {
    const base = { fromCode: 'A-01-01', toCode: 'A-01-02', itemId: '1', qty: 3, available: 3 }
    expect(moveCheck(base).ok).toBe(true)
    expect(moveCheck({ ...base, fromCode: null }).reason).toBe('Quét ô lấy ra')
    expect(moveCheck({ ...base, itemId: null }).reason).toMatch(/Chọn hàng/)
    expect(moveCheck({ ...base, toCode: 'A-01-01' }).reason).toBe('Ô đi và ô đến trùng nhau')
    expect(moveCheck({ ...base, qty: 4 }).reason).toBe('Ô A-01-01 chỉ có 3 bộ')
    expect(moveCheck({ ...base, qty: 0 }).reason).toBe('Nhập số bộ')
  })

  it('V6: lấy hàng - cần cont đang load, không vượt còn phải lấy / tồn ô', () => {
    const open = { status: 'OPEN' as const }
    expect(pickCheck({ container: null, line: { remainingQty: 3 }, stockQty: 5, qty: 1 }).reason).toMatch(/Tạo \/ chọn cont/)
    expect(pickCheck({ container: { status: 'LOADED' }, line: { remainingQty: 3 }, stockQty: 5, qty: 1 }).reason).toMatch(/Cont đã đóng/)
    expect(pickCheck({ container: open, line: { remainingQty: 0 }, stockQty: 5, qty: 1 }).reason).toBe('Dòng này đã lấy đủ')
    expect(pickCheck({ container: open, line: { remainingQty: 3 }, stockQty: 5, qty: 4 }).reason).toBe('Booking chỉ còn phải lấy 3 bộ')
    expect(pickCheck({ container: open, line: { remainingQty: 3 }, stockQty: 2, qty: 3 }).reason).toBe('Ô này chỉ có 2 bộ')
    expect(pickCheck({ container: open, line: { remainingQty: 3 }, stockQty: 5, qty: 3 }).ok).toBe(true)
  })

  it('V7: đóng cont cần số cont, seal, ≥ 1 ảnh, có hàng (cùng luật BE)', () => {
    expect(containerCloseProblems({ containerNo: '', sealNo: ' ', photoUrls: [], totalQty: 0 }))
      .toEqual(['nhập số cont', 'nhập số seal', 'chụp ít nhất 1 ảnh load cont', 'cont chưa có hàng'])
    expect(containerCloseProblems({ containerNo: 'MSCU1', sealNo: 'S1', photoUrls: ['https://x/a.jpg'], totalQty: 2 })).toEqual([])
  })

  it('xuất booking: số thực xuất = tổng hàng trong mọi cont theo dòng; chỉ xác nhận khi mọi cont đã đóng', () => {
    const lines = (q: [string, number][]) => q.map(([bookingLineId, qty]) => ({ bookingLineId, qty, itemId: 'i', lenhCode: 'L', sku: 'S', productName: '', poCode: null, salesOrderItemId: null, orderQty: 0 }))
    expect(shipQtyFromContainers([{ lines: lines([['1', 2], ['2', 1]]) }, { lines: lines([['1', 3]]) }])).toEqual({ '1': 5, '2': 1 })
    expect(shipReadiness([]).ok).toBe(false)
    expect(shipReadiness([{ status: 'LOADED', containerNo: 'A', totalQty: 2 }, { status: 'OPEN', containerNo: null, totalQty: 0 }]).reason)
      .toBe('Còn 1 cont chưa đóng')
    expect(shipReadiness([{ status: 'LOADED', containerNo: 'A', totalQty: 2 }]).ok).toBe(true)
  })

  it('toQty bỏ ký tự lạ', () => {
    expect(toQty('1a2')).toBe(12)
    expect(toQty('')).toBe(0)
  })
})
