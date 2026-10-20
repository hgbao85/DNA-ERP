import type { CSSProperties } from 'react'

/** `percent` (tuỳ chọn): % đã tính sẵn theo quy tắc riêng của màn (vd tiến độ tổ ở "Sản lượng xưởng" làm tròn xuống như
 *  "Tổng hợp lệnh SX") - để thanh và số không lệch 1% so với màn khác. Bỏ trống = tự làm tròn như cũ. */
export default function ProgressBar({ value, max, percent }: { value: number; max: number; percent?: number }) {
  const pct   = percent ?? (max > 0 ? Math.min(100, Math.round(value / max * 100)) : 0)
  const color = pct === 100 ? 'var(--fg-16a34a)' : pct >= 60 ? 'var(--fg-2563eb)' : 'var(--fg-d97706)'
  const trackStyle: CSSProperties = { flex: 1, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={trackStyle}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color, minWidth: 32 }}>{pct}%</span>
    </div>
  )
}
