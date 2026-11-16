import { describe, expect, it } from 'vitest'
import { buildPendingMovesWarning, canChangeWorkshop, itemApprovalStatuses, workshopChangeAction } from './changeWorkshopRules'

describe('canChangeWorkshop', () => {
  it('KHSX và Admin được', () => {
    expect(canChangeWorkshop({ isProductPlanner: true })).toBe(true)
    expect(canChangeWorkshop({ role: 'ADMIN' })).toBe(true)
  })
  it('QLSX, người khác, chưa đăng nhập không được', () => {
    expect(canChangeWorkshop({ role: 'USER', isProductPlanner: false })).toBe(false)
    expect(canChangeWorkshop({})).toBe(false)
    expect(canChangeWorkshop(null)).toBe(false)
    expect(canChangeWorkshop(undefined)).toBe(false)
  })
})

describe('workshopChangeAction', () => {
  it('mọi SKU chờ QLSX / chờ Sếp / đã duyệt, chưa xuất sắt -> allowed', () => {
    expect(workshopChangeAction(['WAITING_QLSX', 'WAITING_BOSS', 'APPROVED'], false)).toBe('allowed')
    expect(workshopChangeAction(['APPROVED'], undefined)).toBe('allowed')
  })
  it('đã xuất sắt -> blocked', () => {
    expect(workshopChangeAction(['APPROVED'], true)).toBe('blocked')
  })
  it('có SKU chưa gửi / bị từ chối -> none (kể cả đã xuất sắt)', () => {
    expect(workshopChangeAction(['APPROVED', null], false)).toBe('none')
    expect(workshopChangeAction(['REJECTED'], true)).toBe('none')
    expect(workshopChangeAction([], false)).toBe('none')
  })
  it('itemApprovalStatuses đọc trạng thái từng SKU', () => {
    expect(itemApprovalStatuses([{ prodApproval: { status: 'APPROVED' } }, { prodApproval: null }, {}])).toEqual(['APPROVED', null, null])
    expect(itemApprovalStatuses(undefined)).toEqual([])
  })
})

describe('buildPendingMovesWarning', () => {
  const mk = (n: number) => Array.from({ length: n }, (_, i) => ({ id: String(i), code: `PC-${i}`, fromWarehouseName: 'Kho A', toWarehouseName: 'Kho B' }))
  it('ít phiếu: liệt kê hết, không có dòng "và … khác"', () => {
    const w = buildPendingMovesWarning(mk(2))
    expect(w.title).toBe('Lệnh còn 2 phiếu chuyển hàng chưa nhận')
    expect(w.rows).toHaveLength(2)
    expect(w.rows[0].route).toBe('Kho A → Kho B')
    expect(w.moreText).toBeNull()
  })
  it('đúng 5 phiếu: không cắt', () => {
    const w = buildPendingMovesWarning(mk(5))
    expect(w.rows).toHaveLength(5)
    expect(w.moreText).toBeNull()
  })
  it('nhiều hơn 5: cắt còn 5 dòng + "và N phiếu khác"', () => {
    const w = buildPendingMovesWarning(mk(8))
    expect(w.rows).toHaveLength(5)
    expect(w.moreText).toBe('và 3 phiếu khác')
  })
})
