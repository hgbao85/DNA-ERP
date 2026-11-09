import { describe, expect, it } from 'vitest'
import { matchPrefixByCustomerName, suggestLsxPrefix } from './lsxSuggest'

describe('matchPrefixByCustomerName', () => {
  const prefixes = ['MY', 'GP']
  it('khớp chữ đầu tên khách', () => {
    expect(matchPrefixByCustomerName('GOPLUS', prefixes)).toBe('GP')
    expect(matchPrefixByCustomerName('MEYING', prefixes)).toBe('MY')
    expect(matchPrefixByCustomerName('Meiying Co.', prefixes)).toBe('MY')
  })
  it('không khớp -> null (không tự điền MY)', () => {
    expect(matchPrefixByCustomerName('ACME', prefixes)).toBeNull()
    expect(matchPrefixByCustomerName('', prefixes)).toBeNull()
    expect(matchPrefixByCustomerName(null, prefixes)).toBeNull()
  })
  it('mơ hồ (nhiều tiền tố cùng khớp) -> null', () => {
    expect(matchPrefixByCustomerName('GOPLUS', ['GP', 'GL'])).toBeNull()
  })
})

describe('suggestLsxPrefix', () => {
  const prefixes = ['MY', 'GP']
  it('lấy tiền tố của số LSX gần nhất (id lớn nhất) cùng khách', () => {
    const items = [
      { id: 1, lsxCode: 'MY-300', customerName: 'GOPLUS' },
      { id: 5, lsxCode: 'GP-12', customerName: 'goplus' },
      { id: 9, lsxCode: 'MY-313', customerName: 'MEYING' },
    ]
    expect(suggestLsxPrefix('GOPLUS', items, prefixes)).toBe('GP')
    expect(suggestLsxPrefix('MEYING', items, prefixes)).toBe('MY')
  })
  it('chưa có LSX nào cho khách -> dò theo tên; không khớp -> null', () => {
    expect(suggestLsxPrefix('GOPLUS', [{ id: 1, lsxCode: 'MY-1', customerName: 'MEYING' }], prefixes)).toBe('GP')
    expect(suggestLsxPrefix('ACME', [{ id: 1, lsxCode: 'MY-1', customerName: 'MEYING' }], prefixes)).toBeNull()
  })
  it('bỏ qua tiền tố không còn trong danh sách cấu hình', () => {
    expect(suggestLsxPrefix('GOPLUS', [{ id: 1, lsxCode: 'XX-1', customerName: 'GOPLUS' }], prefixes)).toBe('GP')
  })
  it('không có tên khách -> null', () => {
    expect(suggestLsxPrefix(null, [], prefixes)).toBeNull()
  })
})
