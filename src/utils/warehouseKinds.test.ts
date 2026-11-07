import { describe, expect, it } from 'vitest'
import { fixedWarehouseName, inWarehouseCatalog, warehouseKindOf } from './warehouseKinds'
import { khoCheckboxes } from '../modules/pages/InboundWarehouse/slipPrintTemplate'

describe('warehouseKinds (Đợt 7 - chia 9 kho)', () => {
  it('loại kho theo mã: kho cố định, kho phụ theo nhóm, kho phụ phoi-son-han cũ không rõ loại', () => {
    expect(warehouseKindOf('phoi-son-han')).toBe('PHOI')
    expect(warehouseKindOf('phoi-son-han-han-pha')).toBe('HAN')
    expect(warehouseKindOf('phoi-son-han-son-pa')).toBe('SON')
    expect(warehouseKindOf('vat-tu-tp-2')).toBe('PHU_KIEN')
    expect(warehouseKindOf('thanh-pham-1788485485362')).toBe('THANH_PHAM')
    expect(warehouseKindOf('phoi-son-han-1788485485362')).toBeNull()
    expect(fixedWarehouseName('phoi-son-han-phoi-pha')).toBe('Kho Phôi Phước An')
  })

  it('danh mục: kho Phôi Phước An thấy sắt khai kho Phôi Phú An, KHÔNG thấy vật tư Hàn/Sơn', () => {
    expect(inWarehouseCatalog('phoi-son-han-phoi-pha', 'phoi-son-han')).toBe(true)
    expect(inWarehouseCatalog('phoi-son-han-phoi-pha', 'phoi-son-han-han-pa')).toBe(false)
    expect(inWarehouseCatalog('phoi-son-han-han-pha', 'phoi-son-han-han-pa')).toBe(true)
    expect(inWarehouseCatalog('phoi-son-han-son-pa', 'phoi-son-han')).toBe(false)
    expect(inWarehouseCatalog('thanh-pham-2', 'thanh-pham')).toBe(true)
  })

  it('ô kho trên phiếu in: Phú An chung 1 ô, Phước An ô riêng, thành phẩm theo số trong tên', () => {
    const ticked = (code: string, name: string) =>
      khoCheckboxes(code, name).split('&nbsp;').map(s => s.trim()).filter(s => s.startsWith('[x]'))
    expect(ticked('phoi-son-han-han-pa', 'Kho Hàn Phú An')).toEqual(['[x] Phôi – sơn – hàn (Phú An)'])
    expect(ticked('phoi-son-han-son-pa', 'Kho Sơn Phú An')).toEqual(['[x] Phôi – sơn – hàn (Phú An)'])
    expect(ticked('phoi-son-han-han-pha', 'Kho Hàn Phước An')).toEqual(['[x] Phước An'])
    expect(ticked('vat-tu-tp', 'Kho Phụ kiện')).toEqual(['[x] Phụ kiện'])
    expect(ticked('thanh-pham-1792489603061', 'Kho thành phẩm 3')).toEqual(['[x] Thành phẩm 3'])
    expect(ticked('kho-la', 'Kho lạ')).toEqual(['[x] Kho lạ'])
  })
})
