'use client'

/**
 * Màn ĐỊNH MỨC HÀN SƠN (dây & sơn) — role Hàn / Sơn
 * Cấu trúc khớp SpecWirePaintPage: định mức theo SẢN PHẨM, mỗi dòng là
 * mã dây/sơn · loại · đơn vị (kg/lít) · quy cách (specifications).
 * Read-only để tổ Hàn/Sơn xem cho khớp. ĐANG DÙNG DATA MOCK.
 */

import { useMemo, useState } from 'react'
import { Droplets, Search } from 'lucide-react'

const ACCENT = '#e65100'

interface SpecLine {
  id: number
  sku: string
  sanPham: string
  ma: string            // mã dây/sơn (DY-… / SN-…)
  unit: string          // kg / lít
  specifications: string
}

// ── DATA MOCK (khớp catalog/định mức dây & sơn của SpecWirePaintPage) ──
const DATA: SpecLine[] = [
  { id: 1, sku: 'GHE-J55', sanPham: 'Ghế J55', ma: 'DY-PE-001', unit: 'kg', specifications: 'Dây PE xám GSS' },
  { id: 2, sku: 'GHE-J55', sanPham: 'Ghế J55', ma: 'SN-DEN-01', unit: 'lít', specifications: 'Sơn đen tĩnh điện' },
  { id: 3, sku: 'GHE-IEA3', sanPham: 'Ghế IEA-3', ma: 'DY-NH-002', unit: 'kg', specifications: 'Dây nhựa xanh' },
  { id: 4, sku: 'GHE-IEA3', sanPham: 'Ghế IEA-3', ma: 'SN-XM-001', unit: 'lít', specifications: 'Sơn xám tĩnh điện' },
  { id: 5, sku: 'BAN-TB45', sanPham: 'Bàn TB-45', ma: 'SN-DEN-01', unit: 'lít', specifications: 'Sơn đen tĩnh điện' },
]

const loaiOf = (ma: string) => (ma.startsWith('SN-') ? 'Sơn' : ma.startsWith('DY-') ? 'Dây' : '—')

export default function HanSonDinhMucPage() {
  const [q, setQ] = useState('')
  const [sku, setSku] = useState('ALL')

  const skus = useMemo(() => ['ALL', ...Array.from(new Set(DATA.map(d => d.sku)))], [])
  const rows = useMemo(() => DATA.filter(d => {
    if (sku !== 'ALL' && d.sku !== sku) return false
    if (!q.trim()) return true
    const s = q.toLowerCase()
    return d.sku.toLowerCase().includes(s) || d.ma.toLowerCase().includes(s) || d.specifications.toLowerCase().includes(s)
  }), [q, sku])

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <div style={{ width: 34, height: 34, borderRadius: 'var(--radius)', background: '#fff3e0', color: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Droplets size={18} />
        </div>
        <div>
          <h2 style={{ fontSize: 19, fontWeight: 800 }}>Định mức Hàn Sơn (dây & sơn)</h2>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>Định mức dây & sơn theo sản phẩm: mã · loại · đơn vị · quy cách</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', margin: '14px 0', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: 300 }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
          <input placeholder="Tìm SKU, mã dây/sơn, quy cách…" value={q} onChange={e => setQ(e.target.value)} style={{ padding: '7px 10px 7px 32px' }} />
        </div>
        <select value={sku} onChange={e => setSku(e.target.value)} style={{ width: 200 }}>
          {skus.map(s => <option key={s} value={s}>{s === 'ALL' ? '— Tất cả SKU —' : s}</option>)}
        </select>
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>{rows.length} dòng</span>
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
        <table style={tbl}>
          <thead><tr style={trh}>
            <th style={th}>SKU</th><th style={th}>Sản phẩm</th><th style={th}>Mã</th>
            <th style={th}>Loại</th><th style={th}>Quy cách</th><th style={th}>ĐVT</th>
          </tr></thead>
          <tbody>
            {rows.map(d => (
              <tr key={d.id} style={trb}>
                <td style={{ ...td, fontWeight: 700 }}>{d.sku}</td>
                <td style={{ ...td, color: 'var(--text2)' }}>{d.sanPham}</td>
                <td style={{ ...td, fontWeight: 600 }}>{d.ma}</td>
                <td style={td}>
                  <span className={`badge ${loaiOf(d.ma) === 'Sơn' ? 'red' : 'blue'}`}>{loaiOf(d.ma)}</span>
                </td>
                <td style={td}>{d.specifications}</td>
                <td style={td}>{d.unit}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} style={{ ...td, textAlign: 'center', color: 'var(--text3)', padding: 24 }}>Không tìm thấy định mức phù hợp.</td></tr>
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
const td: React.CSSProperties = { padding: '10px 12px', color: 'var(--text)' }
