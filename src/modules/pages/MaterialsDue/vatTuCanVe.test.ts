import { describe, expect, it } from 'vitest'
import {
  canReceiveRow, receiveUrl, emptyMessage, fmtDayFull, fmtDayMonth, fmtQty, isRedState, overdueHint, parseView, pillCount, qtyNeedText, skuChip, stateInfo, supplierText, vnToday, windowText,
} from './vatTuCanVe'

describe('định dạng ngày', () => {
  it('cắt chuỗi, không lệch múi giờ', () => {
    expect(fmtDayMonth('2026-11-10')).toBe('10/11')
    expect(fmtDayFull('2026-11-10T17:00:00.000Z')).toBe('10/11/2026')
    expect(fmtDayMonth(null)).toBe('')
    expect(fmtDayFull('abc')).toBe('')
  })
  it('vnToday theo giờ VN (UTC+7)', () => {
    expect(vnToday(new Date('2026-11-05T18:00:00Z'))).toBe('2026-11-06')
    expect(vnToday(new Date('2026-11-05T10:00:00Z'))).toBe('2026-11-05')
  })
  it('windowText', () => {
    expect(windowText({ earliestArrival: '2026-11-06', deadline: '2026-11-10' })).toBe('06/11 – 10/11/2026')
    expect(windowText({ earliestArrival: null, deadline: null })).toBe('—')
  })
})

describe('trạng thái', () => {
  it('hạn chót hôm nay: đỏ nổi bật', () => {
    expect(stateInfo({ state: 'DEADLINE_TODAY', daysLeft: 0, earliestArrival: '2026-11-01' })).toEqual({ text: 'HẠN CHÓT HÔM NAY', tone: 'critical' })
  })
  it('quá hạn N ngày với N = -daysLeft', () => {
    expect(stateInfo({ state: 'OVERDUE', daysLeft: -3, earliestArrival: null })).toEqual({ text: 'Quá hạn 3 ngày', tone: 'red' })
  })
  it('trong khoảng: Còn N ngày tới hạn (vàng)', () => {
    expect(stateInfo({ state: 'IN_WINDOW', daysLeft: 2, earliestArrival: null })).toEqual({ text: 'Còn 2 ngày tới hạn', tone: 'amber' })
  })
  it('chưa tới: Về từ dd/mm; chưa có hạn', () => {
    expect(stateInfo({ state: 'UPCOMING', daysLeft: 9, earliestArrival: '2026-11-14' })).toEqual({ text: 'Về từ 14/11', tone: 'grey' })
    expect(stateInfo({ state: 'NO_DEADLINE', daysLeft: null, earliestArrival: null })).toEqual({ text: 'Chưa có hạn', tone: 'muted' })
  })
  it('isRedState', () => {
    expect(isRedState('OVERDUE')).toBe(true)
    expect(isRedState('DEADLINE_TODAY')).toBe(true)
    expect(isRedState('IN_WINDOW')).toBe(false)
  })
})

describe('số lượng, lệnh gộp, NCC', () => {
  it('chốt mua > cần thì ghi cả hai', () => {
    expect(qtyNeedText({ needQty: 100, orderQty: 120, unit: 'kg' })).toBe('Cần 100 · chốt mua 120 kg')
    expect(qtyNeedText({ needQty: 100, orderQty: 100, unit: 'kg' })).toBe('100 kg')
    expect(fmtQty(1234.5)).toBe('1.234,5')
  })
  it('skuChip', () => {
    expect(skuChip({ itemId: 'a', lenhCode: 'MY-313', skuCode: 'SKU-1', deadline: '2026-11-10' })).toEqual({ code: 'MY-313', sku: 'SKU-1', deadlineText: 'hạn 10/11' })
    expect(skuChip({ itemId: 'a', lenhCode: 'MY-313', skuCode: 'MY-313', deadline: null })).toEqual({ code: 'MY-313', sku: '', deadlineText: 'chưa có hạn' })
  })
  it('NCC: chưa đặt khi chưa PURCHASING', () => {
    expect(supplierText({ supplierName: null, supplierOrderCode: null, purchaseStatus: 'SUBMITTED' })).toEqual({ name: 'Chưa đặt NCC', order: '', placed: false })
    expect(supplierText({ supplierName: 'Kim Phát', supplierOrderCode: '52/2026', purchaseStatus: 'PURCHASING' })).toEqual({ name: 'Kim Phát', order: 'Đơn 52/2026', placed: true })
    expect(supplierText({ supplierName: null, supplierOrderCode: null, purchaseStatus: 'PURCHASING' }).name).toBe('Chưa ghi NCC')
  })
})

describe('nhắc quá hạn ở lọc Hôm nay (U2)', () => {
  const counts = { overdue: 2, deadlineToday: 1, inWindow: 3, upcoming: 0, noDeadline: 0 }
  it('chỉ ở Hôm nay và khi có quá hạn', () => {
    expect(overdueHint('today', counts)).toBe(2)
    expect(overdueHint('overdue', counts)).toBeNull()
    expect(overdueHint('all', counts)).toBeNull()
    expect(overdueHint('today', { ...counts, overdue: 0 })).toBeNull()
    expect(overdueHint('today', undefined)).toBeNull()
  })
})

describe('lọc', () => {
  const counts = { overdue: 2, deadlineToday: 1, inWindow: 3, upcoming: 4, noDeadline: 5 }
  it('số trên nút lọc lấy từ counts', () => {
    expect(pillCount(counts, 'overdue')).toBe(2)
    expect(pillCount(counts, 'today')).toBe(4)
    expect(pillCount(counts, 'all')).toBe(15)
    expect(pillCount(counts, 'date')).toBeUndefined()
    expect(pillCount(undefined, 'today')).toBeUndefined()
  })
  it('parseView mặc định Hôm nay', () => {
    expect(parseView(null)).toBe('today')
    expect(parseView('all')).toBe('all')
    expect(parseView('lung tung')).toBe('today')
  })
  it('câu rỗng theo lọc', () => {
    expect(emptyMessage('overdue', null)).toBe('Không có vật tư quá hạn.')
    expect(emptyMessage('date', '2026-11-10')).toContain('10/11/2026')
  })
})

describe('nút Nhập kho', () => {
  const thuKho = (warehouseScope: string | null) => ({ role: 'WAREHOUSE_STAFF' as const, warehouseScope })
  const row = { purchaseStatus: 'PURCHASING' as const, warehouseCode: 'phoi-son-han' }
  it('chỉ thủ kho, đúng kho mình, dòng đã đặt NCC', () => {
    expect(canReceiveRow(thuKho('phoi-son-han'), row)).toBe(true)
    expect(canReceiveRow(thuKho(null), row)).toBe(true)
    expect(canReceiveRow(thuKho('vat-tu-tp'), row)).toBe(false)
    expect(canReceiveRow(thuKho('phoi-son-han'), { ...row, purchaseStatus: 'NEW' })).toBe(false)
  })
  it('người mua, Sếp, KHSX, chưa đăng nhập: không có nút', () => {
    expect(canReceiveRow({ role: 'WAREHOUSE_STAFF', warehouseScope: null, isPurchaser: true }, row)).toBe(false)
    expect(canReceiveRow({ role: 'BOSS', warehouseScope: null }, row)).toBe(false)
    expect(canReceiveRow({ role: 'WAREHOUSE_STAFF', warehouseScope: null, isProductPlanner: true }, row)).toBe(false)
    expect(canReceiveRow(null, row)).toBe(false)
  })
  it('link: ưu tiên đơn đặt hàng NCC, không thì theo vật tư', () => {
    expect(receiveUrl({ supplierOrderId: '52', materialId: '9' })).toBe('/?m=inbound_warehouse&p=nhap-kho&focus=SUPPLIER_ORDER%3A52')
    expect(receiveUrl({ supplierOrderId: null, materialId: '9' })).toBe('/?m=inbound_warehouse&p=nhap-kho&focus=MATERIAL%3A9')
  })
})
