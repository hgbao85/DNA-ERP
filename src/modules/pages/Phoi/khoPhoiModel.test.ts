import { describe, expect, it } from 'vitest'
import { canhBaoKhoPhoi, chonKhoMacDinh, khoPhoiThat, khoPhoiTuSoDu, trangThaiTaiKhoPhoi } from './khoPhoiModel'

describe('khoPhoiThat', () => {
  it('chỉ giữ kho Phôi thật đang hoạt động, sắp theo tên', () => {
    const r = khoPhoiThat([
      { code: 'b', name: 'Kho B', kind: 'PHOI' },
      { code: 'a', name: 'Kho A', kind: 'PHOI' },
      { code: 'h', name: 'Kho Hàn', kind: 'HAN' },
      { code: 's', name: 'Kho Sơn', kind: 'SON' },
      { code: 'v', name: 'Ảo', kind: 'PHOI', isVirtual: true },
      { code: 'x', name: 'Tắt', kind: 'PHOI', isActive: false },
      { code: 'khong-ro', name: 'Không rõ', kind: null },
    ])
    expect(r.map(w => w.code)).toEqual(['a', 'b'])
  })
  it('kind thiếu thì suy ra từ mã kho cố định', () => {
    expect(khoPhoiThat([{ code: 'phoi-son-han', name: 'Kho Phôi Phú An' }]).length).toBe(1)
  })
})

describe('khoPhoiTuSoDu', () => {
  it('bỏ kho ảo', () => {
    const r = khoPhoiTuSoDu([
      { warehouseCode: 'x', warehouseName: 'X' },
      { warehouseCode: 'OPENING_BALANCE', warehouseName: 'Cân đối' },
      { warehouseCode: 'x', warehouseName: 'X' },
    ])
    expect(r).toEqual([{ code: 'x', name: 'X' }])
  })
})

describe('chonKhoMacDinh', () => {
  const options = [{ code: 'a', name: 'A' }, { code: 'b', name: 'B' }]
  it('ưu tiên kho khoá', () => expect(chonKhoMacDinh({ locked: 'z', picked: 'b', options })).toBe('z'))
  it('kho đã chọn còn trong danh sách', () => expect(chonKhoMacDinh({ picked: 'b', options })).toBe('b'))
  it('kho đã chọn không còn thì theo phạm vi người dùng', () => expect(chonKhoMacDinh({ picked: 'q', options, userScope: 'b' })).toBe('b'))
  it('không có gì thì kho đầu', () => expect(chonKhoMacDinh({ picked: null, options })).toBe('a'))
  it('danh sách rỗng', () => expect(chonKhoMacDinh({ picked: null, options: [] })).toBeNull())
})

describe('canhBaoKhoPhoi', () => {
  it('tồn âm', () => expect(canhBaoKhoPhoi([{ onHandQty: -3, surplusQty: -3 }])).toEqual({ tonAm: true, duAm: false }))
  it('dư âm', () => expect(canhBaoKhoPhoi([{ onHandQty: 2, surplusQty: -2 }])).toEqual({ tonAm: false, duAm: true }))
  it('cả hai', () => expect(canhBaoKhoPhoi([{ onHandQty: -3, surplusQty: -3 }, { onHandQty: 2, surplusQty: -2 }])).toEqual({ tonAm: true, duAm: true }))
  it('không có', () => {
    expect(canhBaoKhoPhoi([])).toEqual({ tonAm: false, duAm: false })
    expect(canhBaoKhoPhoi([{ onHandQty: 5, surplusQty: 0 }])).toEqual({ tonAm: false, duAm: false })
  })
})

describe('trangThaiTaiKhoPhoi', () => {
  const ok = { data: [], isLoading: false, error: null }
  it('màn Admin: số dư về trước danh sách kho (kho còn đang tải) thì vẫn là đang tải, không phải lỗi', () => {
    expect(trangThaiTaiKhoPhoi({ allPhoiWarehouses: true, balances: ok, warehouses: { data: null, isLoading: true, error: null } })).toBe('loading')
  })
  it('màn Admin: danh sách kho lỗi thật thì báo lỗi', () => {
    expect(trangThaiTaiKhoPhoi({ allPhoiWarehouses: true, balances: ok, warehouses: { data: null, isLoading: false, error: 'x' } })).toBe('error')
  })
  it('màn Admin: cả hai đã có thì hiện bình thường', () => {
    expect(trangThaiTaiKhoPhoi({ allPhoiWarehouses: true, balances: ok, warehouses: ok })).toBe('ok')
  })
  it('màn thường: bỏ qua danh sách kho', () => {
    expect(trangThaiTaiKhoPhoi({ allPhoiWarehouses: false, balances: ok, warehouses: { data: null, isLoading: true, error: null } })).toBe('ok')
  })
  it('số dư lỗi thì báo lỗi, đang tải thì đang tải', () => {
    expect(trangThaiTaiKhoPhoi({ allPhoiWarehouses: false, balances: { data: null, isLoading: false, error: 'x' }, warehouses: ok })).toBe('error')
    expect(trangThaiTaiKhoPhoi({ allPhoiWarehouses: false, balances: { data: null, isLoading: true, error: null }, warehouses: ok })).toBe('loading')
  })
})
