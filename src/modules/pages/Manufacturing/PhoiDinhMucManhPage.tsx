'use client'

/**
 * Màn DANH SÁCH ĐỊNH MỨC MẢNH — dùng cho Phôi / Hàn / Sơn (theo công đoạn).
 *  - Phôi / Hàn: định mức theo SẮT (loại sắt, quy cách, chiều dài cắt, đơn vị cây)
 *  - Sơn:        định mức theo SƠN (loại sơn, mã sơn, đơn vị lít)
 * ĐANG DÙNG DATA MOCK (state nội bộ) — chưa nối backend/service thật.
 */

import { useMemo, useState } from 'react'
import { Layers, Search } from 'lucide-react'

const ACCENT = '#e65100'

export type DinhMucStage = 'PHOI' | 'HAN' | 'SON'

interface ManhDinhMuc {
  id: number
  tenManh: string
  sku: string
  sanPham: string
  // Phôi/Hàn (sắt)
  loaiSat: string
  spec: string          // quy cách · chiều dài cây
  cutLengthMm: number   // chiều dài cắt mỗi đoạn
  unit: string          // đơn vị sắt (cây)
  // Sơn
  sonName: string       // loại sơn
  sonCode: string       // mã sơn (SN-…)
  sonUnit: string       // đơn vị sơn (lít)
}

// ── DATA MOCK ──────────────────────────────────────────────────────
const DATA: ManhDinhMuc[] = [
  { id: 1, tenManh: 'Chân ghế', sku: 'GHE-J55', sanPham: 'Ghế J55', loaiSat: 'Sắt Vuông 6 zem', spec: '40×40 · 660', cutLengthMm: 420, unit: 'cây', sonName: 'Sơn đen tĩnh điện', sonCode: 'SN-DEN-01', sonUnit: 'lít' },
  { id: 2, tenManh: 'Tựa lưng', sku: 'GHE-J55', sanPham: 'Ghế J55', loaiSat: 'Sắt Hộp 6 zem', spec: '25×50 · 580', cutLengthMm: 540, unit: 'cây', sonName: 'Sơn đen tĩnh điện', sonCode: 'SN-DEN-01', sonUnit: 'lít' },
  { id: 3, tenManh: 'Giằng ngang', sku: 'GHE-J55', sanPham: 'Ghế J55', loaiSat: 'Sắt dẹt', spec: '20×3 · 660', cutLengthMm: 380, unit: 'cây', sonName: 'Sơn đen tĩnh điện', sonCode: 'SN-DEN-01', sonUnit: 'lít' },
  { id: 4, tenManh: 'Khung chính', sku: 'GHE-IEA3', sanPham: 'Ghế IEA-3', loaiSat: 'Sắt Vuông 6 zem', spec: '30×30 · 660', cutLengthMm: 600, unit: 'cây', sonName: 'Sơn xám tĩnh điện', sonCode: 'SN-XM-001', sonUnit: 'lít' },
  { id: 5, tenManh: 'Chân tròn', sku: 'GHE-IEA3', sanPham: 'Ghế IEA-3', loaiSat: 'Ống sắt tròn', spec: 'Φ16 · 620', cutLengthMm: 450, unit: 'cây', sonName: 'Sơn xám tĩnh điện', sonCode: 'SN-XM-001', sonUnit: 'lít' },
  { id: 6, tenManh: 'Khung mặt bàn', sku: 'BAN-TB45', sanPham: 'Bàn TB-45', loaiSat: 'Sắt Vuông 6 zem', spec: '50×50 · 700', cutLengthMm: 700, unit: 'cây', sonName: 'Sơn đen tĩnh điện', sonCode: 'SN-DEN-01', sonUnit: 'lít' },
]

const fmt = (n: number) => n.toLocaleString('vi-VN')

export default function PhoiDinhMucManhPage({ stage = 'PHOI' }: { stage?: DinhMucStage }) {
  const isSon = stage === 'SON'
  const [q, setQ] = useState('')
  const [sku, setSku] = useState('ALL')

  const skus = useMemo(() => ['ALL', ...Array.from(new Set(DATA.map(d => d.sku)))], [])
  const rows = useMemo(() => DATA.filter(d => {
    if (sku !== 'ALL' && d.sku !== sku) return false
    if (!q.trim()) return true
    const s = q.toLowerCase()
    const hay = isSon
      ? `${d.sku} ${d.tenManh} ${d.sonName} ${d.sonCode}`
      : `${d.sku} ${d.tenManh} ${d.loaiSat}`
    return hay.toLowerCase().includes(s)
  }), [q, sku, isSon])

  const subtitle = isSon
    ? 'Định mức sơn theo từng mảnh: loại sơn, mã sơn, đơn vị'
    : 'Định mức cắt theo từng mảnh: loại sắt, quy cách, chiều dài cắt, đơn vị'

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <div style={{ width: 34, height: 34, borderRadius: 'var(--radius)', background: '#fff3e0', color: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Layers size={18} />
        </div>
        <div>
          <h2 style={{ fontSize: 19, fontWeight: 800 }}>Danh sách định mức mảnh</h2>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>{subtitle}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', margin: '14px 0', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: 280 }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
          <input placeholder={isSon ? 'Tìm SKU, tên mảnh, loại sơn…' : 'Tìm SKU, tên mảnh, loại sắt…'} value={q} onChange={e => setQ(e.target.value)} style={{ padding: '7px 10px 7px 32px' }} />
        </div>
        <select value={sku} onChange={e => setSku(e.target.value)} style={{ width: 200 }}>
          {skus.map(s => <option key={s} value={s}>{s === 'ALL' ? '— Tất cả SKU —' : s}</option>)}
        </select>
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>{rows.length} mảnh</span>
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
        <table style={tbl}>
          {isSon ? (
            <>
              <thead><tr style={trh}>
                <th style={th}>SKU</th><th style={th}>Tên mảnh</th><th style={th}>Loại sơn</th><th style={th}>Mã sơn</th><th style={th}>ĐVT</th>
              </tr></thead>
              <tbody>
                {rows.map(d => (
                  <tr key={d.id} style={trb}>
                    <td style={{ ...td, fontWeight: 700 }}>{d.sku}</td>
                    <td style={td}>{d.tenManh}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{d.sonName}</td>
                    <td style={{ ...td, color: 'var(--text3)' }}>{d.sonCode}</td>
                    <td style={td}>{d.sonUnit}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={5} style={{ ...td, textAlign: 'center', color: 'var(--text3)', padding: 24 }}>Không tìm thấy mảnh phù hợp.</td></tr>
                )}
              </tbody>
            </>
          ) : (
            <>
              <thead><tr style={trh}>
                <th style={th}>SKU</th><th style={th}>Tên mảnh</th><th style={th}>Loại sắt</th><th style={th}>Quy cách</th><th style={th}>Chiều dài cắt (mm)</th><th style={th}>ĐVT</th>
              </tr></thead>
              <tbody>
                {rows.map(d => (
                  <tr key={d.id} style={trb}>
                    <td style={{ ...td, fontWeight: 700 }}>{d.sku}</td>
                    <td style={td}>{d.tenManh}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{d.loaiSat}</td>
                    <td style={{ ...td, color: 'var(--text3)' }}>{d.spec.split('·')[0].trim()}</td>
                    <td style={td}>{fmt(d.cutLengthMm)}</td>
                    <td style={td}>{d.unit}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={6} style={{ ...td, textAlign: 'center', color: 'var(--text3)', padding: 24 }}>Không tìm thấy mảnh phù hợp.</td></tr>
                )}
              </tbody>
            </>
          )}
        </table>
      </div>
    </div>
  )
}

const tbl: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }
const trh: React.CSSProperties = { background: 'var(--surface2)', textAlign: 'left' }
const trb: React.CSSProperties = { borderTop: '1px solid var(--border)' }
const th: React.CSSProperties = { padding: '10px 12px', fontWeight: 600, fontSize: 12, color: 'var(--text2)' }
const td: React.CSSProperties = { padding: '10px 12px', color: 'var(--text)' }
