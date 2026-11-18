import { describe, expect, it } from 'vitest'
import { chuNguoiSuaHienThi, nguoiSuaCuaDong } from './warehouseLedgerModel'

describe('nguoiSuaCuaDong', () => {
  it('ADJUST và OPENING_BALANCE có tên thì hiện người sửa', () => {
    expect(nguoiSuaCuaDong({ refType: 'ADJUST', createdByName: 'A' })).toBe('Người sửa: A')
    expect(nguoiSuaCuaDong({ refType: 'OPENING_BALANCE', createdByName: 'A' })).toBe('Người sửa: A')
  })
  it('dòng khác thì null', () => {
    expect(nguoiSuaCuaDong({ refType: 'WAREHOUSE_TRANSFER', createdByName: 'A' })).toBeNull()
  })
  it('không có tên thì null', () => {
    expect(nguoiSuaCuaDong({ refType: 'ADJUST', createdByName: null })).toBeNull()
    expect(nguoiSuaCuaDong({ refType: 'ADJUST', createdByName: '  ' })).toBeNull()
  })
})

describe('chuNguoiSuaHienThi', () => {
  it('dòng sửa tay không có tên hiện "—"', () => {
    expect(chuNguoiSuaHienThi({ refType: 'OPENING_BALANCE', createdByName: null })).toBe('Người sửa: —')
  })
  it('dòng nhập xuất thường không hiện gì', () => {
    expect(chuNguoiSuaHienThi({ refType: 'STEEL_ISSUE', createdByName: null })).toBeNull()
  })
})
