'use client'

/**
 * Phần giao diện dùng chung của vị trí kho Thành phẩm (25/11/2026): kiểu bảng / nút, ô quét tem (camera trong app hoặc máy quét cầm
 * tay / dán link vào ô nhập). Tem ô = link `<origin>/floor?loc=<token>`.
 */
import { useState, type CSSProperties } from 'react'
import { ScanLine } from 'lucide-react'
import QrScanner from '../../Floor/scan/QrScanner'
import { locationTokenOf, type FloorQr } from '../../Floor/scan/qrScan'

export const th: CSSProperties = { padding: '9px 12px', fontWeight: 600, fontSize: 12, color: 'var(--text2)', textAlign: 'left', whiteSpace: 'nowrap' }
export const thR: CSSProperties = { ...th, textAlign: 'right' }
export const td: CSSProperties = { padding: '8px 12px', color: 'var(--text)', fontSize: 13, verticalAlign: 'top' }
export const tdR: CSSProperties = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }
export const box: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflowX: 'auto' }
export const panel: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 14 }
export const inputStyle: CSSProperties = {
  padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, background: 'var(--surface)', color: 'var(--text)',
}
export const numStyle: CSSProperties = { ...inputStyle, width: 80, textAlign: 'right' }
export const sub: CSSProperties = { fontSize: 11, color: 'var(--text3)' }
export const btn = (primary: boolean, disabled = false, color = 'var(--bg-2563eb)'): CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', fontSize: 13, fontWeight: 600, borderRadius: 8,
  border: primary ? 'none' : '1px solid var(--border)', whiteSpace: 'nowrap',
  background: disabled ? 'var(--surface2)' : primary ? color : 'var(--surface)',
  color: disabled ? 'var(--text3)' : primary ? '#fff' : 'var(--text2)', cursor: disabled ? 'not-allowed' : 'pointer',
})
export const tabBtn = (on: boolean): CSSProperties => ({
  padding: '6px 12px', fontSize: 12, fontWeight: 600, borderRadius: 999, cursor: 'pointer',
  border: `1px solid ${on ? 'var(--blue)' : 'var(--border)'}`, background: on ? 'var(--blue-bg)' : 'var(--surface)',
  color: on ? 'var(--blue-text)' : 'var(--text2)',
})
export const note = (tone: 'ok' | 'err' | 'warn'): CSSProperties => ({
  fontSize: 13, padding: '8px 12px', borderRadius: 8,
  color: tone === 'ok' ? 'var(--fg-16a34a)' : tone === 'err' ? 'var(--fg-c62828)' : 'var(--fg-b45309)',
  background: tone === 'ok' ? 'rgba(22,163,74,.08)' : tone === 'err' ? 'rgba(198,40,40,.08)' : 'rgba(180,83,9,.08)',
})

const ACCEPT_LOC: readonly FloorQr['kind'][] = ['loc']

/**
 * Ô quét tem vị trí: bấm camera (điện thoại / máy tính bảng) hoặc máy quét cầm tay gõ nguyên link tem vào ô rồi Enter. Gọi `onToken`
 * với token của tem (BE nhận cả link). Gõ tay mã ô (A-01-02) KHÔNG nhận - quét tem là bằng chứng đứng đúng ô.
 */
export function ScanInput({ label, onToken, disabled, placeholder = 'Quét / dán tem ô' }: {
  label: string
  onToken: (token: string) => void
  disabled?: boolean
  placeholder?: string
}) {
  const [text, setText] = useState('')
  const [scanning, setScanning] = useState(false)
  const [bad, setBad] = useState(false)
  const submit = () => {
    const t = locationTokenOf(text)
    if (!t) { setBad(true); return }
    setBad(false); setText(''); onToken(t)
  }
  return (
    <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <input value={text} disabled={disabled} aria-label={label} placeholder={placeholder}
        onChange={(e) => { setText(e.target.value); setBad(false) }}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit() } }}
        style={{ ...inputStyle, minWidth: 200, borderColor: bad ? 'var(--fg-c62828)' : 'var(--border)' }} />
      <button type="button" disabled={disabled} onClick={() => setScanning(true)} style={btn(false, !!disabled)} title="Quét bằng camera">
        <ScanLine size={14} /> {label}
      </button>
      {bad && <span style={{ fontSize: 12, color: 'var(--fg-c62828)' }}>Không phải tem vị trí kho</span>}
      {scanning && (
        <QrScanner accept={ACCEPT_LOC} title="Đưa tem vị trí kho vào khung"
          onScanned={(qr) => { setScanning(false); if (qr.kind === 'loc') onToken(qr.loc) }}
          onClose={() => setScanning(false)} />
      )}
    </div>
  )
}
