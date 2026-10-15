import { describe, expect, it } from 'vitest'
import QRCode from 'qrcode'
import jsQR from 'jsqr'
import { isLocalOrigin, workstationLink } from './qrPrint'

/** Vẽ ma trận QR thành ảnh RGBA như camera thấy (viền trắng 4 ô, mỗi ô 8px) rồi giải mã bằng jsQR. */
function decode(text: string): string | null {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'Q' })
  const n = qr.modules.size
  const scale = 8
  const quiet = 4
  const size = (n + quiet * 2) * scale
  const data = new Uint8ClampedArray(size * size * 4).fill(255)
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!qr.modules.get(x, y)) continue
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const i = (((y + quiet) * scale + dy) * size + (x + quiet) * scale + dx) * 4
          data[i] = data[i + 1] = data[i + 2] = 0
        }
      }
    }
  }
  return jsQR(data, size, size)?.data ?? null
}

describe('tem QR máy', () => {
  it('link trên tem giải mã lại đúng như camera đọc, và mã máy nằm trong tham số ws của link', () => {
    const token = 'o-34kYIvouVC7Ol9m6UW_qyq'
    const link = workstationLink(token, 'https://erp.example.vn')
    expect(link).toBe(`https://erp.example.vn/floor?ws=${token}`)
    const read = decode(link)
    expect(read).toBe(link)
    expect(new URL(read!).searchParams.get('ws')).toBe(token)
  })
})

describe('isLocalOrigin', () => {
  it('nhận localhost và IP mạng LAN là địa chỉ nội bộ (điện thoại ngoài mạng đó không mở được)', () => {
    for (const o of ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://192.168.1.20:3000', 'http://10.0.0.5', 'http://172.20.1.1:3000', 'http://erp.local']) {
      expect(isLocalOrigin(o)).toBe(true)
    }
  })

  it('địa chỉ công khai thì không phải nội bộ', () => {
    for (const o of ['https://erpdna.vercel.app', 'https://erp.congty.vn:8443', 'http://172.32.0.1', 'http://8.8.8.8']) {
      expect(isLocalOrigin(o)).toBe(false)
    }
  })

  it('chuỗi rác -> false (không ném lỗi)', () => {
    expect(isLocalOrigin('')).toBe(false)
    expect(isLocalOrigin('abc')).toBe(false)
  })
})
