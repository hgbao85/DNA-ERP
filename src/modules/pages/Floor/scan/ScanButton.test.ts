import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { isQrScanEnabled } from '../../../../constants/featureFlags'
import ScanButton from './ScanButton'

const html = (label?: string) => renderToStaticMarkup(createElement(ScanButton, { onClick: () => {}, ...(label ? { label } : {}) }))

describe('công tắc NEXT_PUBLIC_QR_SCAN_ENABLED', () => {
  afterEach(() => { vi.unstubAllEnvs() })

  it('không đặt biến -> tắt, không hiện nút quét', () => {
    vi.stubEnv('NEXT_PUBLIC_QR_SCAN_ENABLED', '')
    expect(isQrScanEnabled()).toBe(false)
    expect(html()).toBe('')
  })

  it.each(['false', 'TRUE', 'True', '1', 'yes', ' true'])('giá trị "%s" -> vẫn tắt', (v) => {
    vi.stubEnv('NEXT_PUBLIC_QR_SCAN_ENABLED', v)
    expect(isQrScanEnabled()).toBe(false)
    expect(html()).toBe('')
  })

  it('đúng chuỗi "true" -> bật, hiện nút quét', () => {
    vi.stubEnv('NEXT_PUBLIC_QR_SCAN_ENABLED', 'true')
    expect(isQrScanEnabled()).toBe(true)
    expect(html()).toContain('Quét mã QR')
    expect(html('Quét mã QR khác')).toContain('Quét mã QR khác')
  })
})
