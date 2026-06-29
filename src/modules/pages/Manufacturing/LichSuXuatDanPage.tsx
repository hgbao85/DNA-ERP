'use client'

/**
 * Màn LỊCH SỬ XUẤT ĐAN — role Quản lý xuất đan (WEAVING_EXPORT)
 * Nhật ký các lượt đã xuất mảnh ra điểm đan. ĐANG DÙNG DATA MOCK.
 */

import { useMemo, useState } from 'react'
import { History, Search } from 'lucide-react'

const ACCENT = '#e65100'

interface ExportLog {
  id: number; at: string; po: string; sku: string; manh: string; point: string; qty: number; deadline: string; by: string
}

const ISO = (d: number) => { const x = new Date(); x.setDate(x.getDate() + d); x.setHours(17, 0, 0, 0); return x.toISOString() }
const minsAgo = (m: number) => new Date(Date.now() - m * 60000).toISOString()
const fmt = (n: number) => n.toLocaleString('vi-VN')
const dateVN = (iso: string) => new Date(iso).toLocaleDateString('vi-VN')
const timeVN = (iso: string) => new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })

// ── DATA MOCK ──────────────────────────────────────────────────────
const HISTORY: ExportLog[] = [
  { id: 1, at: minsAgo(120), po: 'PO-2026-001', sku: 'GHE-J55', manh: 'Mặt ghế', point: 'DD-A — Anh Tuấn', qty: 300, deadline: ISO(7), by: 'Xuất đan - Nam' },
  { id: 2, at: minsAgo(118), po: 'PO-2026-001', sku: 'GHE-J55', manh: 'Mặt ghế', point: 'DD-B — Chị Hà', qty: 120, deadline: ISO(10), by: 'Xuất đan - Nam' },
  { id: 3, at: minsAgo(60), po: 'PO-2026-002', sku: 'GHE-IEA3', manh: 'Mặt đan', point: 'DD-C — Anh Phú', qty: 80, deadline: ISO(9), by: 'Xuất đan - Nam' },
]

export default function LichSuXuatDanPage() {
  const [q, setQ] = useState('')

  const rows = useMemo(() => HISTORY.filter(h => {
    if (!q.trim()) return true
    const s = q.toLowerCase()
    return h.po.toLowerCase().includes(s) || h.sku.toLowerCase().includes(s) || h.manh.toLowerCase().includes(s) || h.point.toLowerCase().includes(s)
  }), [q])

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <div style={{ width: 34, height: 34, borderRadius: 'var(--radius)', background: '#fff3e0', color: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <History size={18} />
        </div>
        <div>
          <h2 style={{ fontSize: 19, fontWeight: 800 }}>Lịch sử xuất đan</h2>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>Nhật ký các lượt đã xuất mảnh ra điểm đan</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', margin: '14px 0', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: 300 }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
          <input placeholder="Tìm PO, SKU, mảnh, điểm đan…" value={q} onChange={e => setQ(e.target.value)} style={{ padding: '7px 10px 7px 32px' }} />
        </div>
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>{rows.length} lượt xuất</span>
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
        <table style={tbl}>
          <thead><tr style={trh}>
            <th style={th}>Thời gian</th><th style={th}>PO · SKU</th><th style={th}>Mảnh</th>
            <th style={th}>Điểm đan</th><th style={thR}>Số lượng</th><th style={th}>Deadline</th><th style={th}>Người xuất</th>
          </tr></thead>
          <tbody>
            {rows.map(h => (
              <tr key={h.id} style={trb}>
                <td style={{ ...td, color: 'var(--text3)' }}>{timeVN(h.at)}</td>
                <td style={{ ...td, fontWeight: 600 }}>{h.po} <span style={{ color: 'var(--text3)', fontWeight: 400 }}>· {h.sku}</span></td>
                <td style={td}>{h.manh}</td>
                <td style={td}>{h.point}</td>
                <td style={{ ...tdR, fontWeight: 700 }}>{fmt(h.qty)}</td>
                <td style={td}>{dateVN(h.deadline)}</td>
                <td style={{ ...td, color: 'var(--text2)' }}>{h.by}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: 'var(--text3)', padding: 24 }}>Chưa có lượt xuất đan nào.</td></tr>
            )}
          </tbody>
        </table>
      </div>
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
