import { describe, expect, it } from 'vitest'
import { moduleToAdoptFromUrl } from './urlModuleSync'

const base = { isDirector: true, defaultModule: 'boss' as string | null }

describe('moduleToAdoptFromUrl', () => {
  it('bấm nút về: state đã null, URL còn m cũ chưa đổi -> giữ nguyên (không kéo lại phân hệ cũ)', () => {
    expect(
      moduleToAdoptFromUrl({ ...base, prevUrlModule: 'inbound_warehouse', urlModule: 'inbound_warehouse', activeModule: null }),
    ).toBeUndefined()
  })

  it('sau khi router.replace bỏ m -> giữ nguyên trang chọn phân hệ', () => {
    expect(moduleToAdoptFromUrl({ ...base, prevUrlModule: 'inbound_warehouse', urlModule: null, activeModule: null })).toBeUndefined()
  })

  it('bấm thẻ ở trang chọn: state đã đổi, URL chưa kịp có m -> giữ nguyên; URL bắt kịp -> trùng, giữ nguyên', () => {
    expect(moduleToAdoptFromUrl({ ...base, prevUrlModule: null, urlModule: null, activeModule: 'sales' })).toBeUndefined()
    expect(moduleToAdoptFromUrl({ ...base, prevUrlModule: null, urlModule: 'sales', activeModule: 'sales' })).toBeUndefined()
  })

  it('bấm thông báo (URL đổi m từ ngoài) -> Giám đốc mở đúng phân hệ đó', () => {
    expect(moduleToAdoptFromUrl({ ...base, prevUrlModule: 'sales', urlModule: 'boss', activeModule: 'sales' })).toBe('boss')
    expect(moduleToAdoptFromUrl({ ...base, prevUrlModule: null, urlModule: 'production', activeModule: null })).toBe('production')
  })

  it('tài khoản thường chỉ nhận đúng phân hệ mặc định của mình', () => {
    const user = { isDirector: false, defaultModule: 'sales' }
    expect(moduleToAdoptFromUrl({ ...user, prevUrlModule: null, urlModule: 'sales', activeModule: null })).toBe('sales')
    expect(moduleToAdoptFromUrl({ ...user, prevUrlModule: 'sales', urlModule: 'boss', activeModule: 'sales' })).toBeUndefined()
  })
})
