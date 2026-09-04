/** Style dùng chung cho LenhSanXuatPhoi.tsx + VatTuTpDetail.tsx - tách riêng để 2 file không phải
 *  import chéo lẫn nhau (vòng lặp module). */
export const ACCENT = '#e65100'
export const GREEN = '#16a34a'
export const RED = '#c62828'
export const AMBER = '#d97706'
export const PURPLE = '#7b1fa2'
export const th: React.CSSProperties = { padding: '10px 14px', fontSize: 12, fontWeight: 600, color: 'var(--text2)', textAlign: 'left', whiteSpace: 'nowrap' }
export const thR: React.CSSProperties = { ...th, textAlign: 'right' }
export const td: React.CSSProperties = { padding: '11px 14px', fontSize: 13, verticalAlign: 'middle' }
export const tdR: React.CSSProperties = { ...td, textAlign: 'right' }
export const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }
export const smallBtn: React.CSSProperties = { padding: '5px 12px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer' }
export const inp: React.CSSProperties = { width: 72, padding: '5px 7px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, textAlign: 'right', background: 'var(--surface)', color: 'var(--text)' }
export const subFilterBtn = (active: boolean): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', padding: '6px 12px', fontSize: 12.5, fontWeight: 600,
  border: '1px solid ' + (active ? ACCENT : 'var(--border)'), borderRadius: 20, cursor: 'pointer',
  background: active ? 'var(--accent-bg, #fff3e8)' : 'var(--surface)', color: active ? ACCENT : 'var(--text2)',
})
