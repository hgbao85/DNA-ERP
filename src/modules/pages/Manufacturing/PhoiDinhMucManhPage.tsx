'use client'

/**
 * Màn DANH SÁCH ĐỊNH MỨC MẢNH — thuộc role Phôi (Thống kê Cơ khí)
 * Tra cứu định mức cắt theo từng MẢNH: loại sắt, quy cách, chiều dài cắt, số cây/sản phẩm, công đoạn.
 * ĐANG DÙNG DATA MOCK (state nội bộ) — chưa nối backend/service thật.
 */

import { useMemo, useState } from 'react'
import { Layers, Search } from 'lucide-react'

const ACCENT = '#e65100'

interface ManhDinhMuc {
  id: number
  maManh: string
  tenManh: string
  sku: string
  sanPham: string
  loaiSat: string
  spec: string          // quy cách · chiều dài cây
  cutLengthMm: number   // chiều dài cắt mỗi đoạn
  unit: string          // đơn vị tính của loại sắt
}

// ── DATA MOCK ──────────────────────────────────────────────────────
const DATA: ManhDinhMuc[] = [
  { id: 1, maManh: 'J55-CHAN', tenManh: 'Chân ghế', sku: 'GHE-J55', sanPham: 'Ghế J55', loaiSat: 'Sắt Vuông 6 zem', spec: '40×40 · 660', cutLengthMm: 420, unit: 'cây' },
  { id: 2, maManh: 'J55-TUA', tenManh: 'Tựa lưng', sku: 'GHE-J55', sanPham: 'Ghế J55', loaiSat: 'Sắt Hộp 6 zem', spec: '25×50 · 580', cutLengthMm: 540, unit: 'cây' },
  { id: 3, maManh: 'J55-GIANG', tenManh: 'Giằng ngang', sku: 'GHE-J55', sanPham: 'Ghế J55', loaiSat: 'Sắt dẹt', spec: '20×3 · 660', cutLengthMm: 380, unit: 'cây' },
  { id: 4, maManh: 'IEA3-KHUNG', tenManh: 'Khung chính', sku: 'GHE-IEA3', sanPham: 'Ghế IEA-3', loaiSat: 'Sắt Vuông 6 zem', spec: '30×30 · 660', cutLengthMm: 600, unit: 'cây' },
  { id: 5, maManh: 'IEA3-CHAN', tenManh: 'Chân tròn', sku: 'GHE-IEA3', sanPham: 'Ghế IEA-3', loaiSat: 'Ống sắt tròn', spec: 'Φ16 · 620', cutLengthMm: 450, unit: 'cây' },
  { id: 6, maManh: 'TB45-MAT', tenManh: 'Khung mặt bàn', sku: 'BAN-TB45', sanPham: 'Bàn TB-45', loaiSat: 'Sắt Vuông 6 zem', spec: '50×50 · 700', cutLengthMm: 700, unit: 'cây' },
]

const fmt = (n: number) => n.toLocaleString('vi-VN')

export default function PhoiDinhMucManhPage() {
  const [q, setQ] = useState('')
  const [sku, setSku] = useState('ALL')

  const skus = useMemo(() => ['ALL', ...Array.from(new Set(DATA.map(d => d.sku)))], [])
  const rows = useMemo(() => DATA.filter(d => {
    if (sku !== 'ALL' && d.sku !== sku) return false
    if (!q.trim()) return true
    const s = q.toLowerCase()
    return d.sku.toLowerCase().includes(s) || d.tenManh.toLowerCase().includes(s) || d.loaiSat.toLowerCase().includes(s)
  }), [q, sku])

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <div style={{ width: 34, height: 34, borderRadius: 'var(--radius)', background: '#fff3e0', color: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Layers size={18} />
        </div>
        <div>
          <h2 style={{ fontSize: 19, fontWeight: 800 }}>Danh sách định mức mảnh</h2>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>Định mức cắt theo từng mảnh: loại sắt, quy cách, chiều dài cắt, đơn vị</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', margin: '14px 0', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: 280 }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
          <input placeholder="Tìm SKU, tên mảnh, loại sắt…" value={q} onChange={e => setQ(e.target.value)} style={{ padding: '7px 10px 7px 32px' }} />
        </div>
        <select value={sku} onChange={e => setSku(e.target.value)} style={{ width: 200 }}>
          {skus.map(s => <option key={s} value={s}>{s === 'ALL' ? '— Tất cả SKU —' : s}</option>)}
        </select>
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>{rows.length} mảnh</span>
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
        <table style={tbl}>
          <thead><tr style={trh}>
            <th style={th}>SKU</th><th style={th}>Tên mảnh</th>
            <th style={th}>Loại sắt</th><th style={th}>Quy cách</th>
            <th style={th}>Chiều dài cắt (mm)</th><th style={th}>ĐVT</th>
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
        </table>
      </div>
    </div>
  )
}

const tbl: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }
const trh: React.CSSProperties = { background: 'var(--surface2)', textAlign: 'left' }
const trb: React.CSSProperties = { borderTop: '1px solid var(--border)' }
const th: React.CSSProperties = { padding: '10px 12px', fontWeight: 600, fontSize: 12, color: 'var(--text2)' }
const thR: React.CSSProperties = { ...th, textAlign: 'right' }
const td: React.CSSProperties = { padding: '10px 12px', color: 'var(--text)' }
const tdR: React.CSSProperties = { ...td, textAlign: 'right' }
