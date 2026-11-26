import { describe, expect, it } from 'vitest'
import { create } from 'qrcode'
import jsQR from 'jsqr'
import { locationLink, locationTemsHtml, palletLink, palletTemsHtml, workstationLink } from '../qrPrint'
import { cameraErrorText, floorHrefOf, locationTokenOf, NOT_A_TEM, parseWorkstationQr, wrongKindText } from './qrScan'

describe('parseWorkstationQr', () => {
  it('đọc mã máy từ link tem (cả khi tem in ở tên miền khác)', () => {
    expect(parseWorkstationQr('https://dna-erp.vercel.app/floor?ws=abc123')).toEqual({ ok: true, kind: 'ws', ws: 'abc123' })
    expect(parseWorkstationQr(' http://localhost:3000/floor/?ws=x%2Fy ')).toEqual({ ok: true, kind: 'ws', ws: 'x/y' })
  })

  it('khớp đúng link do qrPrint.workstationLink tạo', () => {
    expect(parseWorkstationQr(workstationLink('TOK-9 a', 'https://erp.example.com'))).toEqual({ ok: true, kind: 'ws', ws: 'TOK-9 a' })
  })

  it('tem pallet Sơn (24/11/2026): /floor?pallet= -> kind pallet; khớp link do qrPrint.palletLink tạo', () => {
    expect(parseWorkstationQr('https://dna-erp.vercel.app/floor?pallet=PTOK1')).toEqual({ ok: true, kind: 'pallet', pallet: 'PTOK1' })
    expect(parseWorkstationQr(palletLink('p a/1', 'https://erp.example.com'))).toEqual({ ok: true, kind: 'pallet', pallet: 'p a/1' })
    // cả 2 tham số: ưu tiên tem máy (tem cũ)
    expect(parseWorkstationQr('https://x.vn/floor?ws=W1&pallet=P1')).toEqual({ ok: true, kind: 'ws', ws: 'W1' })
  })

  it('đường dẫn trong app sau khi quét', () => {
    expect(floorHrefOf({ ok: true, kind: 'ws', ws: 'a b' })).toBe('/floor?ws=a%20b')
    expect(floorHrefOf({ ok: true, kind: 'pallet', pallet: 'P/1' })).toBe('/floor?pallet=P%2F1')
  })

  it.each([
    'abc123',
    'https://dna-erp.vercel.app/floor?pallet=',
    `https://dna-erp.vercel.app/floor?pallet=${'x'.repeat(201)}`,
    'https://dna-erp.vercel.app/pallet?pallet=abc',
    'https://google.com/search?q=1',
    'https://dna-erp.vercel.app/floor',
    'https://dna-erp.vercel.app/floor?ws=',
    'https://dna-erp.vercel.app/login?ws=abc',
    'WIFI:S:Cong ty;T:WPA;P:123;;',
    'javascript:alert(1)//floor?ws=1',
  ])('không phải tem: %s', (text) => {
    expect(parseWorkstationQr(text)).toEqual({ ok: false, error: NOT_A_TEM })
  })
})

describe('jsQR đọc được tem in ra', () => {
  it('ảnh QR của link tem -> đúng mã máy', () => {
    const link = workstationLink('ws-token-001', 'https://dna-erp.vercel.app')
    const qr = create(link, { errorCorrectionLevel: 'M' })
    const n = qr.modules.size
    const scale = 6
    const quiet = 4
    const side = (n + quiet * 2) * scale
    const px = new Uint8ClampedArray(side * side * 4).fill(255)
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (!qr.modules.get(y, x)) continue
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            const i = (((y + quiet) * scale + dy) * side + (x + quiet) * scale + dx) * 4
            px[i] = px[i + 1] = px[i + 2] = 0
          }
        }
      }
    }
    const code = jsQR(px, side, side)
    expect(code?.data).toBe(link)
    expect(parseWorkstationQr(code!.data)).toEqual({ ok: true, kind: 'ws', ws: 'ws-token-001' })
  })
})

describe('cameraErrorText', () => {
  it('chưa cho phép camera / trang không https', () => {
    expect(cameraErrorText('NotAllowedError')).toMatch(/cho phép/)
    expect(cameraErrorText('NO_MEDIA')).toMatch(/https/)
    expect(cameraErrorText(undefined)).toMatch(/Không mở được camera/)
  })
})

describe('tem pallet in ra', () => {
  it('mỗi pallet 1 tem, có mã + ảnh QR, mã được thoát HTML', () => {
    const html = palletTemsHtml([
      { code: 'PL-001', img: 'data:image/png;base64,AAA', warehouseName: 'Kho Sơn' },
      { code: '<b>PL-002</b>', img: 'data:x', warehouseName: null },
    ])
    expect(html.match(/class="tem"/g)).toHaveLength(2)
    expect(html).toContain('PL-001')
    expect(html).toContain('&lt;b&gt;PL-002&lt;/b&gt;')
    expect(html).toContain('PALLET SƠN')
  })
})

describe('tem vị trí kho Thành phẩm (25/11/2026, VI_TRI_KHO)', () => {
  it('/floor?loc= -> kind loc; khớp link do qrPrint.locationLink tạo; tem máy / pallet vẫn ưu tiên', () => {
    expect(parseWorkstationQr('https://dna-erp.vercel.app/floor?loc=L1')).toEqual({ ok: true, kind: 'loc', loc: 'L1' })
    expect(parseWorkstationQr(locationLink('l a/1', 'https://erp.example.com'))).toEqual({ ok: true, kind: 'loc', loc: 'l a/1' })
    expect(parseWorkstationQr('https://x.vn/floor?pallet=P1&loc=L1')).toEqual({ ok: true, kind: 'pallet', pallet: 'P1' })
    expect(parseWorkstationQr('https://x.vn/floor?loc=')).toEqual({ ok: false, error: NOT_A_TEM })
    expect(floorHrefOf({ ok: true, kind: 'loc', loc: 'L/1' })).toBe('/floor?loc=L%2F1')
  })

  it('ô nhập của màn kho: nhận link tem ô hoặc token, từ chối tem máy / link lạ', () => {
    expect(locationTokenOf(' https://erp.x/floor?loc=abc ')).toBe('abc')
    expect(locationTokenOf('abc_1')).toBe('abc_1')
    expect(locationTokenOf('https://erp.x/floor?ws=w1')).toBeNull()
    expect(locationTokenOf('https://google.com')).toBeNull()
    expect(locationTokenOf('  ')).toBeNull()
  })

  it('quét sai loại tem: giữ câu cũ của màn máy / pallet, báo rõ khi màn cần tem ô', () => {
    expect(wrongKindText('pallet', ['ws'])).toBe('Đây là tem pallet, không phải tem máy.')
    expect(wrongKindText('ws', ['pallet'])).toBe('Đây là tem máy, không phải tem pallet.')
    expect(wrongKindText('ws', ['loc'])).toBe('Đây là tem máy, không phải tem vị trí kho.')
    expect(wrongKindText('loc', ['ws', 'pallet'])).toBe('Đây là tem vị trí kho, không phải tem máy / tem pallet.')
  })

  it('HTML tem ô: mã ô to, tên kho, thoát ký tự HTML', () => {
    const html = locationTemsHtml([{ code: 'A-01-02', img: 'data:image/png;base64,x', warehouseName: 'Kho <TP>' }])
    expect(html).toContain('VỊ TRÍ KHO')
    expect(html).toContain('A-01-02')
    expect(html).toContain('Kho &lt;TP&gt;')
  })

  it('QR của tem ô đọc lại ra đúng token', () => {
    const link = locationLink('tok-9', 'https://erp.example.com')
    const qr = create(link, { errorCorrectionLevel: 'Q' })
    expect(qr.modules.size).toBeGreaterThan(20)
    expect(parseWorkstationQr(link)).toEqual({ ok: true, kind: 'loc', loc: 'tok-9' })
  })
})
