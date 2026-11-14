'use client'

/** Style + phần tử nhỏ dùng chung cho màn QLSX "Sản lượng xưởng" - xem QlsxFloorPage. */

import type { CSSProperties, ReactNode } from 'react'
import type { BeWorkstation } from '../../../services/floor-api'
import { MACHINE_LABEL } from '../../../utils/cutMachine'
import { STAGE_LABEL, STEP_LABEL } from './floorUi'

export { STAGE_LABEL, STEP_LABEL }
export const KIND_LABEL: Record<string, string> = {
  CUT: 'Máy cắt', STEP: 'Máy công đoạn phụ', PIECE: 'Điểm làm việc (Hàn/Sơn)', STEEL_RECEIVE: 'Khu nhận sắt',
}

/** Nhãn loại máy cắt ("MC Laser" / "MC Tự động"); không phải máy cắt hoặc BE cũ chưa trả thì null. */
export const cutTypeLabel = (w: Pick<BeWorkstation, 'kind' | 'cutMachineType'>): string | null =>
  w.kind === 'CUT' && w.cutMachineType ? MACHINE_LABEL[w.cutMachineType] : null

/** "Máy cắt · MC Laser" cho máy cắt, các loại khác giữ nhãn gốc. */
export const kindWithMachine = (w: Pick<BeWorkstation, 'kind' | 'cutMachineType'>): string => {
  const t = cutTypeLabel(w)
  return t ? `${KIND_LABEL[w.kind]} · ${t}` : KIND_LABEL[w.kind]
}

/**
 * Tóm tắt máy cắt ĐANG HOẠT ĐỘNG theo xưởng, vd "Phú An: 4 MC Laser, 1 MC Tự động · Chưa gán xưởng: 1".
 * Xưởng sắp theo `workshopOrder` (tên), xưởng lạ theo tên; máy chưa gán xưởng gom cuối. Không có máy cắt -> chuỗi rỗng.
 */
export function summarizeCutMachines(list: BeWorkstation[], workshopOrder: string[] = []): string {
  const byShop = new Map<string, { laser: number; tu_dong: number }>()
  let unassigned = 0
  for (const w of list) {
    if (!w.isActive || w.kind !== 'CUT') continue
    if (!w.workshopName) { unassigned += 1; continue }
    const e = byShop.get(w.workshopName) ?? { laser: 0, tu_dong: 0 }
    if (w.cutMachineType === 'tu_dong') e.tu_dong += 1; else e.laser += 1
    byShop.set(w.workshopName, e)
  }
  const rank = (n: string) => { const i = workshopOrder.indexOf(n); return i < 0 ? workshopOrder.length : i }
  const parts = [...byShop.entries()]
    .sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0], 'vi'))
    .map(([name, c]) => {
      const bits: string[] = []
      if (c.laser > 0) bits.push(`${c.laser} ${MACHINE_LABEL.laser}`)
      if (c.tu_dong > 0) bits.push(`${c.tu_dong} ${MACHINE_LABEL.tu_dong}`)
      return `${name}: ${bits.join(', ')}`
    })
  if (unassigned > 0) parts.push(`Chưa gán xưởng: ${unassigned}`)
  return parts.join(' · ')
}

/** Máy cắt chưa gán xưởng: chưa được chia sắt, bảng Máy & tem QR tô viền cảnh báo ô Xưởng. */
export const isCutUnassigned = (w: Pick<BeWorkstation, 'kind' | 'workshopId'>): boolean => w.kind === 'CUT' && !w.workshopId
export const UNASSIGNED_WORKSHOP_TITLE = 'Chưa gán xưởng: máy này chưa được chia sắt'

export const card: CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16,
}
export const th: CSSProperties = {
  padding: '9px 12px', fontSize: 12, fontWeight: 600, color: 'var(--text2)', textAlign: 'left', whiteSpace: 'nowrap',
}
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
    <div role={tone === 'err' ? 'alert' : 'status'}
      style={{ background: c[0], color: c[1], borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 500 }}>
      {children}
    </div>
  )
}

export function Pill({ tone, children }: { tone: 'gray' | 'blue' | 'green' | 'amber' | 'red'; children: ReactNode }) {
  const c = {
    gray: ['var(--surface2)', 'var(--text2)'], blue: ['var(--blue-bg)', 'var(--blue-text)'],
    green: ['var(--green-bg)', 'var(--green)'], amber: ['var(--amber-bg)', 'var(--amber)'], red: ['var(--red-bg)', 'var(--red)'],
  }[tone]
  return (
    <span style={{
      background: c[0], color: c[1], fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  )
}

export const fmtMm = (n: number) => n.toLocaleString('vi-VN')

/** "08:10 13/10/2026" - cùng dạng ngày dd/MM/yyyy với mọi màn khác của QLSX. */
export function fmtTime(iso: string): string {
  const d = new Date(iso)
  const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  return `${time} ${d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}`
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

/** Ngăn số của tiến độ (cùng định nghĩa progressModel / BE floor-progress.util). */
export interface ProgressParts { required: number; passed: number; awaiting: number; open: number; failed?: number }

/**
 * Thanh tiến độ xếp chồng 3 ngăn: KCS đạt / chờ KCS / chưa gửi KCS. Màu kèm chú giải bằng chữ (không
 * chỉ dựa vào màu); `percent` lấy từ BE/progressModel để khớp số ở màn khác.
 */
export function StackedProgress({ parts, percent, legend = true }: { parts: ProgressParts; percent: number; legend?: boolean }) {
  const w = (n: number) => (parts.required > 0 ? `${(Math.min(n, parts.required) / parts.required) * 100}%` : '0%')
  const segs = [
    { key: 'passed', n: parts.passed, color: 'var(--green)', label: 'Đạt KCS' },
    { key: 'awaiting', n: parts.awaiting, color: 'var(--amber)', label: 'Chờ KCS' },
    { key: 'open', n: parts.open, color: 'var(--blue)', label: 'Chưa gửi KCS' },
  ]
  const fmt = (n: number) => n.toLocaleString('vi-VN')
  const missing = Math.max(0, parts.required - parts.passed - parts.awaiting - parts.open)
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div role="img" aria-label={`${percent}%: đạt ${fmt(parts.passed)}, chờ KCS ${fmt(parts.awaiting)}, ` +
          `chưa gửi ${fmt(parts.open)}, còn thiếu ${fmt(missing)} trên ${fmt(parts.required)}`}
          style={{ flex: 1, height: 10, background: 'var(--border)', borderRadius: 5, overflow: 'hidden', display: 'flex' }}>
          {segs.map((s) => s.n > 0 && <div key={s.key} style={{ width: w(s.n), background: s.color }} />)}
        </div>
        <span style={{ fontSize: 15, fontWeight: 700, minWidth: 40, textAlign: 'right' }}>{percent}%</span>
      </div>
      {legend && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 12px', marginTop: 4, fontSize: 12, color: 'var(--text2)' }}>
          {segs.map((s) => (
            <span key={s.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span aria-hidden style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />
              {s.label} <b>{fmt(s.n)}</b>
            </span>
          ))}
          {(parts.failed ?? 0) > 0 && <span style={{ color: 'var(--red)' }}>Lỗi <b>{fmt(parts.failed ?? 0)}</b></span>}
          <span>Còn thiếu <b>{fmt(missing)}</b>/{fmt(parts.required)}</span>
        </div>
      )}
    </div>
  )
}

// ─── Primitive dùng chung cho các khối bảng / thẻ ────────────────────────────

export const divider = '1px solid var(--border)'
export const muted: CSSProperties = { fontSize: 12, color: 'var(--text2)' }
export const sectionTitle: CSSProperties = { fontSize: 15, fontWeight: 700 }
/** Hàng ngang tự xuống dòng (nút, chip, ô nhập). */
export const rowWrap: CSSProperties = { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }
/** Cột dọc co được (minWidth 0 để chữ dài không đẩy tràn). */
export const stack = (gap: number): CSSProperties => ({ display: 'flex', flexDirection: 'column', gap, minWidth: 0 })
/** Ô nhập nhỏ trong thẻ. */
export const smallInput: CSSProperties = { ...input, minHeight: 30, padding: '4px 8px', fontSize: 12 }
/** Khung nền nhạt cho phần nhập phụ (đổi máy, tách). */
export const subPanel: CSSProperties = { ...rowWrap, background: 'var(--surface2)', borderRadius: 8, padding: 8 }
/** Ô thông báo giữa khung (chưa chọn xưởng, chưa có máy). */
export const emptyBox: CSSProperties = { ...card, textAlign: 'center', color: 'var(--text3)', padding: 28 }
export const rowLine: CSSProperties = { borderBottom: divider }
export const headLine: CSSProperties = { borderTop: divider, borderBottom: divider }
export const numTh: CSSProperties = { ...th, textAlign: 'right' }
export const numTd: CSSProperties = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }

/** Nút nhỏ trong thẻ (cao 30 px). */
export function smallBtn(kind: 'primary' | 'secondary' | 'danger' | 'ghost', disabled = false): CSSProperties {
  return { ...btn(kind, disabled), minHeight: 30 }
}

/** Bảng cuộn ngang trong khung riêng: trang không tràn ngang trên điện thoại. */
export function TableScroll({ children, minWidth }: { children: ReactNode; minWidth: number }) {
  return (
    <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
      <table style={{ width: '100%', minWidth, borderCollapse: 'collapse' }}>{children}</table>
    </div>
  )
}

/** Khối gập / mở bằng thẻ details. */
export function Fold({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details style={{ borderTop: divider, paddingTop: 10 }}>
      <summary style={{ cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>{title}</summary>
      <div style={{ marginTop: 8 }}>{children}</div>
    </details>
  )
}

/** Nhãn đặc (nền đỏ chữ trắng) cho trạng thái cần để ý, vd "Máy rảnh". */
export function SolidBadge({ children }: { children: ReactNode }) {
  return (
    <span style={{
      fontSize: 13, fontWeight: 800, padding: '2px 10px', borderRadius: 999, background: 'var(--red)', color: '#fff', whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  )
}
