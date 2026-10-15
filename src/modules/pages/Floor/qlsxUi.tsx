'use client'

/** Style + phần tử nhỏ dùng chung cho màn QLSX "Sản lượng xưởng" (2026-10-13) - xem QlsxFloorPage. */

import type { CSSProperties, ReactNode } from 'react'

export const STAGE_LABEL: Record<string, string> = { PHOI: 'Phôi', HAN: 'Hàn', SON: 'Sơn' }
export const STEP_LABEL: Record<string, string> = {
  CAT: 'Cắt', UON: 'Uốn', DAP: 'Dập', DUC_LO: 'Đục lỗ', TAN: 'Tán', TOP_DAU: 'Tóp đầu', XE: 'Xẻ',
}
export const KIND_LABEL: Record<string, string> = {
  CUT: 'Máy cắt laser', STEP: 'Máy công đoạn phụ', PIECE: 'Điểm làm việc (Hàn/Sơn)', STEEL_RECEIVE: 'Khu nhận sắt',
}

export const card: CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16,
}
export const th: CSSProperties = { padding: '9px 12px', fontSize: 12, fontWeight: 600, color: 'var(--text2)', textAlign: 'left', whiteSpace: 'nowrap' }
export const td: CSSProperties = { padding: '10px 12px', fontSize: 13, verticalAlign: 'middle' }
export const input: CSSProperties = {
  padding: '8px 10px', fontSize: 13, border: '1px solid var(--border2)', borderRadius: 8,
  background: 'var(--surface)', color: 'var(--text)', minHeight: 36,
}

export function btn(kind: 'primary' | 'secondary' | 'danger' | 'ghost', disabled = false): CSSProperties {
  const base: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 36,
    padding: '0 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
    cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.55 : 1,
  }
  if (kind === 'primary') return { ...base, background: 'var(--blue)', color: '#fff', border: 'none' }
  if (kind === 'danger') return { ...base, background: 'transparent', color: 'var(--red)', border: '1px solid var(--red)' }
  if (kind === 'ghost') return { ...base, background: 'transparent', color: 'var(--text2)', border: 'none', padding: '0 8px' }
  return { ...base, background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border2)' }
}

export function Notice({ tone, children }: { tone: 'ok' | 'warn' | 'err' | 'info'; children: ReactNode }) {
  const c = {
    ok: ['var(--green-bg)', 'var(--green)'], warn: ['var(--amber-bg)', 'var(--amber)'],
    err: ['var(--red-bg)', 'var(--red)'], info: ['var(--blue-bg)', 'var(--blue-text)'],
  }[tone]
  return (
    <div role={tone === 'err' ? 'alert' : 'status'} style={{ background: c[0], color: c[1], borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 500 }}>
      {children}
    </div>
  )
}

export function Pill({ tone, children }: { tone: 'gray' | 'blue' | 'green' | 'amber' | 'red'; children: ReactNode }) {
  const c = {
    gray: ['var(--surface2)', 'var(--text2)'], blue: ['var(--blue-bg)', 'var(--blue-text)'],
    green: ['var(--green-bg)', 'var(--green)'], amber: ['var(--amber-bg)', 'var(--amber)'], red: ['var(--red-bg)', 'var(--red)'],
  }[tone]
  return <span style={{ background: c[0], color: c[1], fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap' }}>{children}</span>
}

export const fmtMm = (n: number) => n.toLocaleString('vi-VN')

export function fmtTime(iso: string): string {
  const d = new Date(iso)
  return `${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ${d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}`
}

/** "5 phút" / "3 giờ" / "2 ngày" - đã chờ bao lâu. */
export function ageText(iso: string, now = Date.now()): string {
  const min = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000))
  if (min < 60) return `${min} phút`
  if (min < 60 * 24) return `${Math.round(min / 60)} giờ`
  return `${Math.round(min / 1440)} ngày`
}

/** Đợt chờ quá lâu (>= 4 giờ) thì tô màu để QLSX không bỏ sót. */
export const isStale = (iso: string, now = Date.now()) => now - new Date(iso).getTime() >= 4 * 3600 * 1000
