import { describe, expect, it } from 'vitest'
import { buildNotificationLinkUrl } from './notificationLink'

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
