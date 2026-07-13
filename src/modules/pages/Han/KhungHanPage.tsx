'use client'

/**
 * Khung hàn (Hàn) — mục sidebar dưới "Danh sách định mức mảnh", READ-ONLY.
 *
 * Kho chứa các mảnh/khung Tổ Hàn đã hàn xong & đã được KCS duyệt đạt (chờ chuyển
 * sang Sơn). Tương tự "Kho phôi" bên Tổ Phôi — bảng gọn 3 cột: Tên vật liệu · Số
 * lượng · ĐVT.
 */

import { useMemo } from 'react'
import { Frame, Check } from 'lucide-react'

// ── Mock data UI (chỉ hiển thị demo, chưa nối BE) ────────────
interface KhoItem {
  id: string
  tenVatLieu: string
  soLuong: number
  dvt: string          // đơn vị tính: cái
}

// Mảnh/khung Tổ Hàn đã hàn & KCS duyệt đạt (chờ chuyển Sơn) — bám theo GHE-J55.
const KHUNG_HAN_DATA: KhoItem[] = [
  { id: 'h1', tenVatLieu: 'Ráp khung tựa — J55-TUA', soLuong: 500, dvt: 'cái' },
  { id: 'h2', tenVatLieu: 'Ráp chân ghế — J55-CHAN', soLuong: 300, dvt: 'cái' },
  { id: 'h3', tenVatLieu: 'Hàn giằng ngang — J55-GIANG', soLuong: 280, dvt: 'cái' },
]

const th: React.CSSProperties = { padding: '10px 14px', fontSize: 12, fontWeight: 600, color: 'var(--text2)', textAlign: 'left', whiteSpace: 'nowrap' }
const thR: React.CSSProperties = { ...th, textAlign: 'right' }
const td: React.CSSProperties = { padding: '11px 14px', fontSize: 13 }
const tdR: React.CSSProperties = { ...td, textAlign: 'right' }
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }

export default function KhungHanPage() {
  const tong = useMemo(() => KHUNG_HAN_DATA.reduce((s, i) => s + i.soLuong, 0), [])

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <Frame size={20} /> Khung hàn
      </h2>
      <div style={{ color: 'var(--text3)', fontSize: 13, margin: '4px 0 16px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <Check size={14} style={{ color: '#16a34a' }} /> Kho chứa các mảnh/khung Tổ Hàn đã hàn & KCS duyệt đạt — chờ chuyển sang Sơn.
      </div>

      <div style={card}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 480 }}>
          <colgroup><col /><col style={{ width: 140 }} /><col style={{ width: 120 }} /></colgroup>
          <thead>
            <tr style={{ background: 'var(--surface2)' }}>
              <th style={th}>Tên vật liệu</th>
              <th style={thR}>Số lượng</th>
              <th style={th}>ĐVT</th>
            </tr>
          </thead>
          <tbody>
            {KHUNG_HAN_DATA.map(r => (
              <tr key={r.id} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ ...td, fontWeight: 600 }}>{r.tenVatLieu}</td>
                <td style={{ ...tdR, fontWeight: 700, color: '#e65100' }}>{r.soLuong.toLocaleString('vi-VN')}</td>
                <td style={{ ...td, color: 'var(--text3)' }}>{r.dvt}</td>
              </tr>
            ))}
            {KHUNG_HAN_DATA.length === 0 && (
              <tr><td colSpan={3} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>Chưa có khung hàn nào được KCS duyệt</td></tr>
            )}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--surface2)' }}>
              <td style={{ ...td, fontWeight: 700 }}>Tổng</td>
              <td style={{ ...tdR, fontWeight: 700, color: '#e65100' }}>{tong.toLocaleString('vi-VN')}</td>
              <td style={{ ...td, color: 'var(--text3)' }}>cái</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
