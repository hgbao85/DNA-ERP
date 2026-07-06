import type { CSSProperties } from 'react'

export default function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct   = max > 0 ? Math.min(100, Math.round(value / max * 100)) : 0
  const color = pct === 100 ? '#16a34a' : pct >= 60 ? '#2563eb' : '#d97706'
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
