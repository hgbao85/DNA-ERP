import { describe, expect, it } from 'vitest'
import { cachGhiChieuDai, docChieuDaiCay, laSatCay, lyDoKhoaSuaTon, quyenTrenKho, tachDongTheoO, type QuantRow } from './mfgWarehousesModel'

const q = (stockLengthMm: number, qty: number, spec = ''): QuantRow => ({ materialId: '1', warehouseId: '9', stockLengthMm, qty, availableQty: qty, spec })

describe('quyenTrenKho', () => {
  it('kho ảo không sửa không xoá', () => expect(quyenTrenKho(true, { code: 'SCRAP', isVirtual: true })).toEqual({ canWrite: false, isDeletable: false }))
  it('kho cố định sửa được, không xoá', () => expect(quyenTrenKho(true, { code: 'vat-tu-tp', isVirtual: false })).toEqual({ canWrite: true, isDeletable: false }))
  it('kho phụ sửa và xoá được', () => expect(quyenTrenKho(true, { code: 'thanh-pham-123', isVirtual: false })).toEqual({ canWrite: true, isDeletable: true }))
  it('không phải Admin', () => expect(quyenTrenKho(false, { code: 'thanh-pham-123', isVirtual: false })).toEqual({ canWrite: false, isDeletable: false }))
})

describe('tachDongTheoO', () => {
  it('giữ ô 0 có tồn, bỏ ô tồn 0', () => {
    const r = tachDongTheoO({ x: 1 }, [q(0, 4), q(6000, 7), q(4000, 0)])
    expect(r.map(i => [i.stockLengthMm, i.qty])).toEqual([[0, 4], [6000, 7]])
  })
  it('không có ô nào thì 1 dòng null, tồn 0', () => {
    const r = tachDongTheoO({ x: 1 }, [q(0, 0)])
    expect(r).toHaveLength(1)
    expect(r[0].stockLengthMm).toBeNull()
    expect(r[0].qty).toBe(0)
  })
})

describe('laSatCay', () => {
  const groups = [{ id: 1, systemKey: 'STEEL_BAR' }, { id: 2, systemKey: 'OTHER' }]
  it('sắt phần mềm hoặc nhóm con trống', () => {
    expect(laSatCay({ materialGroupId: 1, steelSubGroup: 'SOFTWARE' }, groups)).toBe(true)
    expect(laSatCay({ materialGroupId: 1, steelSubGroup: null }, groups)).toBe(true)
  })
  it('sắt tự tính, thành phẩm, nhóm khác, không nhóm', () => {
    expect(laSatCay({ materialGroupId: 1, steelSubGroup: 'SELF_CALC' }, groups)).toBe(false)
    expect(laSatCay({ materialGroupId: 1, steelSubGroup: 'FINISHED_COMPONENT' }, groups)).toBe(false)
    expect(laSatCay({ materialGroupId: 2, steelSubGroup: null }, groups)).toBe(false)
    expect(laSatCay({ materialGroupId: null }, groups)).toBe(false)
  })
})

describe('cachGhiChieuDai', () => {
  it('ô 0 có tồn thì ghi đúng ô 0', () => expect(cachGhiChieuDai({ stockLengthMm: 0 }, true)).toEqual({ kind: 'dung-o', stockLengthMm: 0 }))
  it('ô 6000', () => expect(cachGhiChieuDai({ stockLengthMm: 6000 }, false)).toEqual({ kind: 'dung-o', stockLengthMm: 6000 }))
  it('sắt chưa có ô', () => expect(cachGhiChieuDai({ stockLengthMm: null }, true)).toEqual({ kind: 'chon-chieu-dai', macDinh: 6000 }))
  it('vật tư khác chưa có ô', () => expect(cachGhiChieuDai({ stockLengthMm: null }, false)).toEqual({ kind: 'mac-dinh' }))
})

describe('docChieuDaiCay', () => {
  it('hợp lệ', () => { expect(docChieuDaiCay('6000')).toBe(6000); expect(docChieuDaiCay(' 450 ')).toBe(450) })
  it('sai thì null', () => {
    for (const s of ['', '6010', '-50', 'abc', '0', '6000.5', '1e3']) expect(docChieuDaiCay(s)).toBeNull()
  })
})

describe('lyDoKhoaSuaTon', () => {
  it('nhóm chưa tải: vật tư có nhóm bị khoá, kèm câu đang tải', () => {
    expect(lyDoKhoaSuaTon({ materialGroupId: 1 }, 'dang-tai')).toBe('Đang tải nhóm vật tư…')
  })
  it('nhóm tải lỗi: vật tư có nhóm bị khoá, câu nhắc thử lại', () => {
    expect(lyDoKhoaSuaTon({ materialGroupId: '1' }, 'loi')).toContain('Thử lại')
  })
  it('nhóm đã tải thì không khoá', () => {
    expect(lyDoKhoaSuaTon({ materialGroupId: 1 }, 'ok')).toBeNull()
  })
  it('vật tư không có nhóm thì không cần danh sách nhóm', () => {
    expect(lyDoKhoaSuaTon({ materialGroupId: null }, 'loi')).toBeNull()
    expect(lyDoKhoaSuaTon(undefined, 'loi')).toBeNull()
  })
})
