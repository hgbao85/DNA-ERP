'use client'

/**
 * Màn THÀNH PHẨM KHUNG SƠN — khung đã hàn + sơn xong, chờ chuyển sang Đan / đóng gói.
 * Theo dõi: hoàn thành (khung sơn) · đã chuyển đan · còn tồn chờ.
 * ĐANG DÙNG DATA MOCK (state nội bộ) — chưa nối backend/service thật.
 */

import { useMemo, useState } from 'react'
import { PackageCheck, Search } from 'lucide-react'

const ACCENT = '#e65100'

interface KhungSon {
  id: number
  sku: string
  sanPham: string
  manh: string          // tên mảnh khung
  code: string
  hoanThanh: number     // khung đã sơn xong
  chuyenDan: number     // đã chuyển sang đan
  capNhat: string       // cập nhật lúc
}

const ISO = (mins: number) => new Date(Date.now() - mins * 60000).toISOString()
const fmt = (n: number) => n.toLocaleString('vi-VN')
const timeVN = (iso: string) => new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })

// ── DATA MOCK ──────────────────────────────────────────────────────
const DATA: KhungSon[] = [
  { id: 1, sku: 'GHE-J55', sanPham: 'Ghế J55', manh: 'Chân ghế', code: 'J55-CHAN', hoanThanh: 480, chuyenDan: 300, capNhat: ISO(45) },
  { id: 2, sku: 'GHE-J55', sanPham: 'Ghế J55', manh: 'Tựa lưng', code: 'J55-TUA', hoanThanh: 500, chuyenDan: 500, capNhat: ISO(120) },
  { id: 3, sku: 'GHE-J55', sanPham: 'Ghế J55', manh: 'Giằng ngang', code: 'J55-GIANG', hoanThanh: 920, chuyenDan: 250, capNhat: ISO(30) },
  { id: 4, sku: 'GHE-IEA3', sanPham: 'Ghế IEA-3', manh: 'Khung chính', code: 'IEA3-KHUNG', hoanThanh: 150, chuyenDan: 0, capNhat: ISO(15) },
  { id: 5, sku: 'GHE-IEA3', sanPham: 'Ghế IEA-3', manh: 'Chân tròn', code: 'IEA3-CHAN', hoanThanh: 600, chuyenDan: 320, capNhat: ISO(200) },
  { id: 6, sku: 'BAN-TB45', sanPham: 'Bàn TB-45', manh: 'Khung mặt bàn', code: 'TB45-MAT', hoanThanh: 0, chuyenDan: 0, capNhat: ISO(5) },
]

export default function KhungSonPage() {
  const [q, setQ] = useState('')
  const [sku, setSku] = useState('ALL')

  const skus = useMemo(() => ['ALL', ...Array.from(new Set(DATA.map(d => d.sku)))], [])
  const rows = useMemo(() => DATA.filter(d => {
    if (sku !== 'ALL' && d.sku !== sku) return false
    if (!q.trim()) return true
    const s = q.toLowerCase()
    return d.sku.toLowerCase().includes(s) || d.manh.toLowerCase().includes(s) || d.code.toLowerCase().includes(s)
  }), [q, sku])

  const tHoanThanh = rows.reduce((s, d) => s + d.hoanThanh, 0)
  const tChuyen = rows.reduce((s, d) => s + d.chuyenDan, 0)
  const tTon = tHoanThanh - tChuyen

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <div style={{ width: 34, height: 34, borderRadius: 'var(--radius)', background: '#fff3e0', color: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <PackageCheck size={18} />
        </div>
        <div>
          <h2 style={{ fontSize: 19, fontWeight: 800 }}>Thành phẩm khung sơn</h2>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>Khung đã hàn + sơn xong, chờ chuyển sang đan / đóng gói</div>
        </div>
      </div>

      {/* Thẻ tổng */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(140px, 220px))', gap: 12, margin: '14px 0' }}>
        <Stat label="Hoàn thành (khung sơn)" value={tHoanThanh} tone="text" />
        <Stat label="Đã chuyển đan" value={tChuyen} tone="green" />
        <Stat label="Tồn chờ chuyển" value={tTon} tone="accent" />
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: 280 }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
          <input placeholder="Tìm SKU, mảnh, mã…" value={q} onChange={e => setQ(e.target.value)} style={{ padding: '7px 10px 7px 32px' }} />
        </div>
        <select value={sku} onChange={e => setSku(e.target.value)} style={{ width: 200 }}>
          {skus.map(s => <option key={s} value={s}>{s === 'ALL' ? '— Tất cả SKU —' : s}</option>)}
        </select>
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>{rows.length} mảnh khung</span>
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
        <table style={tbl}>
          <thead><tr style={trh}>
            <th style={th}>SKU</th><th style={th}>Sản phẩm</th><th style={th}>Mảnh khung</th>
            <th style={thR}>Hoàn thành</th><th style={thR}>Đã chuyển đan</th><th style={thR}>Tồn chờ</th><th style={th}>Cập nhật</th>
          </tr></thead>
          <tbody>
            {rows.map(d => {
              const ton = d.hoanThanh - d.chuyenDan
              return (
                <tr key={d.id} style={trb}>
                  <td style={{ ...td, fontWeight: 700 }}>{d.sku}</td>
                  <td style={{ ...td, color: 'var(--text2)' }}>{d.sanPham}</td>
                  <td style={td}>{d.manh} <span style={{ color: 'var(--text3)' }}>· {d.code}</span></td>
                  <td style={tdR}>{fmt(d.hoanThanh)}</td>
                  <td style={{ ...tdR, color: 'var(--green)' }}>{fmt(d.chuyenDan)}</td>
                  <td style={{ ...tdR, fontWeight: 600, color: ton > 0 ? ACCENT : 'var(--text3)' }}>{fmt(ton)}</td>
                  <td style={{ ...td, color: 'var(--text3)' }}>{timeVN(d.capNhat)}</td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: 'var(--text3)', padding: 24 }}>Không tìm thấy mảnh khung phù hợp.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'text' | 'green' | 'accent' }) {
  const color = tone === 'green' ? 'var(--green)' : tone === 'accent' ? ACCENT : 'var(--text)'
  return (
    <div className="card" style={{ textAlign: 'center', padding: '12px 10px' }}>
      <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color, lineHeight: 1 }}>{fmt(value)}</div>
    </div>
  )
}

const tbl: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 13 }
const trh: React.CSSProperties = { background: 'var(--surface2)', textAlign: 'left' }
const trb: React.CSSProperties = { borderTop: '1px solid var(--border)' }
const th: React.CSSProperties = { padding: '10px 12px', fontWeight: 600, fontSize: 12, color: 'var(--text2)' }
const thR: React.CSSProperties = { ...th, textAlign: 'right' }
const td: React.CSSProperties = { padding: '10px 12px', color: 'var(--text)' }
const tdR: React.CSSProperties = { ...td, textAlign: 'right' }
