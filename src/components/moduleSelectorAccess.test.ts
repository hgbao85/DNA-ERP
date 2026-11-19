import { describe, it, expect } from 'vitest'
import { isModuleAccessible } from './moduleSelectorAccess'

const boss = { role: 'BOSS' }
const bossMfg = { role: 'BOSS', mfgRole: 'PRODUCTION_MANAGER' }

describe('isModuleAccessible', () => {
  it('Giám đốc thấy boss + 5 phân hệ đã làm', () => {
    for (const id of ['boss', 'sales', 'production', 'purchasing', 'inbound_warehouse', 'production_plan']) {
      expect(isModuleAccessible(id, boss)).toBe(true)
    }
  })

  it('Giám đốc có mfgRole không vào boss, sales, purchasing, kho, kế hoạch; vẫn vào sản xuất', () => {
    expect(isModuleAccessible('boss', bossMfg)).toBe(false)
    expect(isModuleAccessible('sales', bossMfg)).toBe(false)
    expect(isModuleAccessible('purchasing', bossMfg)).toBe(false)
    expect(isModuleAccessible('inbound_warehouse', bossMfg)).toBe(false)
    expect(isModuleAccessible('production_plan', bossMfg)).toBe(false)
    expect(isModuleAccessible('production', bossMfg)).toBe(true)
  })

  it('Sales / thủ kho / KHSX / mua không vào boss và giữ luật cũ', () => {
    const sale = { role: 'EMPLOYEE', isSale: true }
    const kho = { role: 'WAREHOUSE_STAFF' }
    const khsx = { role: 'EMPLOYEE', isProductPlanner: true }
    const mua = { role: 'EMPLOYEE', isPurchaser: true }
    for (const u of [sale, kho, khsx, mua]) expect(isModuleAccessible('boss', u)).toBe(false)

    expect(isModuleAccessible('sales', sale)).toBe(true)
    expect(isModuleAccessible('purchasing', sale)).toBe(false)
    expect(isModuleAccessible('inbound_warehouse', sale)).toBe(false)

    expect(isModuleAccessible('inbound_warehouse', kho)).toBe(true)
    expect(isModuleAccessible('sales', kho)).toBe(false)
    expect(isModuleAccessible('production', kho)).toBe(false)

    expect(isModuleAccessible('production_plan', khsx)).toBe(true)
    expect(isModuleAccessible('inbound_warehouse', khsx)).toBe(false)

    expect(isModuleAccessible('purchasing', mua)).toBe(true)
    expect(isModuleAccessible('inbound_warehouse', mua)).toBe(false)
  })

  it('Người có mfgRole vào sản xuất nhưng không vào kho', () => {
    const tho = { role: 'EMPLOYEE', mfgRole: 'HAN' }
    expect(isModuleAccessible('production', tho)).toBe(true)
    expect(isModuleAccessible('inbound_warehouse', { role: 'WAREHOUSE_STAFF', mfgRole: 'HAN' })).toBe(false)
  })

  it('thẻ chưa làm luôn false, kể cả Giám đốc; user null không vào đâu', () => {
    for (const id of ['qc', 'shipping', 'ap_accounting', 'ar_accounting']) {
      expect(isModuleAccessible(id, boss)).toBe(false)
    }
    expect(isModuleAccessible('boss', null)).toBe(false)
    expect(isModuleAccessible('sales', undefined)).toBe(false)
  })
})
