'use client'

/** Mảnh giao diện dùng chung của màn quét QR: banner, thanh nút dính đáy, bảng xác nhận trước khi lưu. */

import { useEffect, useId, useRef, type ReactNode } from 'react'
import type { ScanAction } from './scanModel'
import { btn, card, column, rowBetween } from './scanUi'

const TONES = {
  ok: ['var(--green-bg)', 'var(--green)'], err: ['var(--red-bg)', 'var(--red)'],
  warn: ['var(--amber-bg)', 'var(--amber)'], info: ['var(--blue-bg)', 'var(--blue-text)'],
} as const

export function Banner({ tone, alert, children }: { tone: 'ok' | 'err' | 'warn' | 'info'; alert?: boolean; children: ReactNode }) {
  const c = TONES[tone]
  return (
    <div role={tone === 'err' || alert ? 'alert' : 'status'} style={{
      background: c[0], color: c[1], borderRadius: 10, padding: '12px 14px', fontSize: 15, fontWeight: 500,
    }}>{children}</div>
  )
}

export function StickyBar({ children }: { children: ReactNode }) {
  return (
    <div style={{
      position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 20,
      background: 'var(--surface)', borderTop: '1px solid var(--border)',
      padding: '12px 16px calc(12px + env(safe-area-inset-bottom))',
    }}>
      <div style={{ maxWidth: 528, margin: '0 auto' }}>{children}</div>
    </div>
  )
}

/**
 * Nút chính ở cuối màn. Nút tắt thì nền xám + viền đứt và có dòng lý do ngay trên nút (đọc được bằng trình đọc màn hình
 * nhờ aria-describedby). `leading` là ô nhập đặt cạnh nút (Hàn/Sơn).
 */
export function ActionBar({ action, onClick, leading }: { action: ScanAction; onClick: () => void; leading?: ReactNode }) {
  const reasonId = useId()
  return (
    <StickyBar>
      {action.reason && (
        <div id={reasonId} style={{ fontSize: 14, fontWeight: 600, color: 'var(--text2)', textAlign: 'center', marginBottom: 8 }}>
          {action.reason}
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        {leading}
        <button type="button" disabled={action.disabled} aria-describedby={action.reason ? reasonId : undefined} onClick={onClick}
          style={{ ...btn(true, action.disabled), ...(action.disabled ? { border: '1px dashed var(--border2)' } : null) }}>
          {action.label}
        </button>
      </div>
    </StickyBar>
  )
}

export interface ConfirmRow { label: string; value: string; warn?: string }

function ConfirmRows({ rows }: { rows: ConfirmRow[] }) {
  return (
    <div style={{ ...card, padding: 0 }}>
      {rows.map((r, i) => (
        <div key={i} style={{ padding: '12px 16px', borderTop: i ? '1px solid var(--border)' : 'none' }}>
          <div style={rowBetween}>
            <span style={{ fontSize: 18, fontWeight: 700 }}>{r.label}</span>
            <span style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{r.value}</span>
          </div>
          {r.warn && <div style={{ fontSize: 14, color: 'var(--amber)', fontWeight: 600 }}><span aria-hidden>⚠ </span>{r.warn}</div>}
        </div>
      ))}
    </div>
  )
}

/**
 * Bảng xác nhận TRƯỚC KHI lưu: công nhân không tự sửa được, chỉ QLSX đảo trước khi gửi KCS nên đếm lại một lần ở đây rẻ hơn.
 * Liệt kê đúng những gì sắp ghi; dòng nào vượt kế hoạch thì nói rõ. Đóng bằng "Sửa lại", nút nền mờ hoặc phím Esc;
 * trả focus về nút Lưu.
 */
export function ConfirmSheet({ title, context, rows, total, notes, confirmLabel, busy, onConfirm, onCancel }: {
  title: string
  context: string
  rows: ConfirmRow[]
  total?: string
  notes?: string[]
  confirmLabel: string
  busy: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    ref.current?.focus()
    return () => prev?.focus?.()
  }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onCancel])
  return (
    <div
      onClick={() => { if (!busy) onCancel() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        ref={ref} role="dialog" aria-modal="true" aria-labelledby="floor-confirm-title" tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{
          ...column(12), width: '100%', maxWidth: 560, maxHeight: '90dvh', overflowY: 'auto', outline: 'none',
          background: 'var(--surface)', borderRadius: '16px 16px 0 0',
          padding: '16px 16px calc(16px + env(safe-area-inset-bottom))',
        }}
      >
        <div>
          <h2 id="floor-confirm-title" style={{ fontSize: 20, fontWeight: 700 }}>{title}</h2>
          <div style={{ fontSize: 14, color: 'var(--text2)' }}>{context}</div>
        </div>
        <ConfirmRows rows={rows} />
        {total && <div style={{ fontSize: 16, fontWeight: 700, textAlign: 'right' }}>{total}</div>}
        {(notes ?? []).map((n) => <Banner key={n} tone="warn">{n}</Banner>)}
        <button type="button" disabled={busy} style={btn(true, busy)} onClick={onConfirm}>{busy ? 'Đang lưu…' : confirmLabel}</button>
        <button type="button" disabled={busy} style={btn(false, busy)} onClick={onCancel}>Sửa lại</button>
      </div>
    </div>
  )
}
