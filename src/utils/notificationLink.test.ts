import { describe, expect, it } from 'vitest'
import { buildNotificationLinkUrl, canOpenModule, focusAttr, focusAttrAny, isLinkUnreachable, resolveNotificationUrl } from './notificationLink'

describe('buildNotificationLinkUrl', () => {
  it('ghép module + page', () => {
    expect(buildNotificationLinkUrl({ module: 'production', page: 'lenh-sx' })).toBe(
      '/?m=production&p=lenh-sx',
    )
  })

  it('bỏ qua page khi không có', () => {
    expect(buildNotificationLinkUrl({ module: 'production' } as never)).toBe('/?m=production')
  })

  it('thêm params thành query string riêng, KHÔNG lồng vào 1 key duy nhất', () => {
    expect(
      buildNotificationLinkUrl({
        module: 'inbound_warehouse',
        page: 'nhap-kho',
        params: { sub: 'noi-bo' },
      }),
    ).toBe('/?m=inbound_warehouse&p=nhap-kho&sub=noi-bo')
  })

  it('bỏ qua giá trị null trong params (không ghi "null" vào URL)', () => {
    expect(
      buildNotificationLinkUrl({
        module: 'production',
        page: 'lenh-sx',
        params: { piId: '123', ignored: null },
      }),
    ).toBe('/?m=production&p=lenh-sx&piId=123')
  })

  it('quy đổi giá trị số trong params sang chuỗi', () => {
    expect(
      buildNotificationLinkUrl({ module: 'production', page: 'lenh-sx', params: { qty: 5 } }),
    ).toBe('/?m=production&p=lenh-sx&qty=5')
  })
})

describe('mở thẳng đúng mục + chọn đích theo quyền (mục 29.3)', () => {
  const qlsx = { role: 'USER', mfgRole: 'PRODUCTION_MANAGER' } as never
  const khsx = { role: 'USER', isProductPlanner: true } as never
  const purchaser = { role: 'USER', isPurchaser: true } as never
  const boss = { role: 'BOSS' } as never

  it('thêm focus=<entityType>:<entityId> khi thông báo có đối tượng', () => {
    expect(
      buildNotificationLinkUrl({ module: 'production', page: 'lenh-sx' }, { entityType: 'PRODUCTION_INVOICE', entityId: '42' }),
    ).toBe('/?m=production&p=lenh-sx&focus=PRODUCTION_INVOICE%3A42')
  })

  it('không thêm focus khi thiếu entityId', () => {
    expect(buildNotificationLinkUrl({ module: 'production', page: 'lenh-sx' }, { entityType: 'SKU', entityId: null })).toBe(
      '/?m=production&p=lenh-sx',
    )
  })

  it('focusAttr cùng dạng khoá với URL; id rỗng thì không rải thuộc tính', () => {
    expect(focusAttr('SKU', 7)).toEqual({ 'data-focus-id': 'SKU:7' })
    expect(focusAttr('SKU', null)).toEqual({})
  })

  it('focus do BE chỉ định trong link.params thắng khoá suy từ entity (vd theo mã PI)', () => {
    expect(
      buildNotificationLinkUrl(
        { module: 'production', page: 'ke-hoach', params: { focus: 'PI_CODE:PI-2026-038' } },
        { entityType: 'PURCHASE_PROPOSAL', entityId: '29' },
      ),
    ).toBe('/?m=production&p=ke-hoach&focus=PI_CODE%3API-2026-038')
  })

  it('focusAttrAny gom nhiều khoá vào 1 thuộc tính (cách nhau khoảng trắng), bỏ khoá rỗng', () => {
    expect(focusAttrAny(['CUT_BUNDLE:1', null, 'CUT_BUNDLE:2'])).toEqual({ 'data-focus-id': 'CUT_BUNDLE:1 CUT_BUNDLE:2' })
    expect(focusAttrAny([null, undefined])).toEqual({})
  })

  it('chọn link chính nếu mở được, không thì link thay thế đầu tiên mở được', () => {
    const n = {
      entityType: 'PRODUCTION_INVOICE',
      entityId: '9',
      link: {
        module: 'production',
        page: 'ke-hoach',
        alternatives: [{ module: 'production_plan', page: 'lenh-sx' }],
      },
    }
    expect(resolveNotificationUrl(n, qlsx)).toBe('/?m=production&p=ke-hoach&focus=PRODUCTION_INVOICE%3A9')
    expect(resolveNotificationUrl(n, khsx)).toBe('/?m=production_plan&p=lenh-sx&focus=PRODUCTION_INVOICE%3A9')
  })

  it('không có đích nào mở được -> null và isLinkUnreachable = true (Mua hàng nhận thông báo kho)', () => {
    const n = { entityType: null, entityId: null, link: { module: 'inbound_warehouse', page: 'nhap-kho' } }
    expect(resolveNotificationUrl(n, purchaser)).toBeNull()
    expect(isLinkUnreachable(n, purchaser)).toBe(true)
  })

  it('không có link -> null và KHÔNG tính là unreachable', () => {
    const n = { entityType: null, entityId: null, link: null }
    expect(resolveNotificationUrl(n, qlsx)).toBeNull()
    expect(isLinkUnreachable(n, qlsx)).toBe(false)
  })

  it('Giám đốc mở được mọi phân hệ', () => {
    expect(canOpenModule(boss, 'purchasing')).toBe(true)
    expect(canOpenModule(purchaser, 'production')).toBe(false)
  })
})
