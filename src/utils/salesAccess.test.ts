import { describe, expect, it } from 'vitest'
import { canWriteSalesOrders } from './salesAccess'

// 20/11/2026 (E2E-4): luật ẩn nút ghi ở Quản lí đơn hàng bám @RequireRole(SALES_STAFF, ADMIN) của BE.
describe('canWriteSalesOrders', () => {
  it('Giám đốc (BOSS) hoặc chưa đăng nhập thì không được ghi', () => {
    expect(canWriteSalesOrders({ role: 'BOSS', isSale: false })).toBe(false)
    expect(canWriteSalesOrders({ role: 'BOSS' })).toBe(false)
    expect(canWriteSalesOrders(null)).toBe(false)
    expect(canWriteSalesOrders(undefined)).toBe(false)
  })

  it('Admin hoặc tài khoản Bán hàng thì được ghi', () => {
    expect(canWriteSalesOrders({ role: 'ADMIN' })).toBe(true)
    expect(canWriteSalesOrders({ role: 'WAREHOUSE_STAFF', isSale: true })).toBe(true)
  })
})
