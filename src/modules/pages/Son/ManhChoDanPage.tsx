'use client'

/**
 * Mảnh chờ đan (Sơn) — mục sidebar dưới "Danh sách định mức mảnh", READ-ONLY.
 *
 * Kho chứa các mảnh Tổ Sơn đã sơn xong & đã được KCS duyệt đạt — chờ chuyển sang
 * công đoạn Đan. KCS duyệt xong sẽ đẩy thông tin về đây. Tương tự "Kho phôi" (Phôi)
 * và "Khung hàn" (Hàn) — bảng gọn 3 cột: Tên vật liệu · Số lượng · ĐVT.
 */

import { useMemo } from 'react'
import { Layers, Check } from 'lucide-react'

// ── Mock data UI (chỉ hiển thị demo, chưa nối BE) ────────────
interface KhoItem {
  id: string
  tenVatLieu: string
  soLuong: number
  dvt: string          // đơn vị tính: cái
}

// Mảnh Tổ Sơn đã sơn & KCS duyệt đạt (chờ chuyển Đan) — bám theo GHE-J55.
const MANH_CHO_DAN_DATA: KhoItem[] = [
  { id: 's1', tenVatLieu: 'Khung tựa J55 (đã sơn) — J55-TUA', soLuong: 60, dvt: 'cái' },
  { id: 's2', tenVatLieu: 'Chân ghế J55 (đã sơn) — J55-CHAN', soLuong: 48, dvt: 'cái' },
  { id: 's3', tenVatLieu: 'Giằng ngang J55 (đã sơn) — J55-GIANG', soLuong: 90, dvt: 'cái' },
]

const th: React.CSSProperties = { padding: '10px 14px', fontSize: 12, fontWeight: 600, color: 'var(--text2)', textAlign: 'left', whiteSpace: 'nowrap' }
const thR: React.CSSProperties = { ...th, textAlign: 'right' }
const td: React.CSSProperties = { padding: '11px 14px', fontSize: 13 }
const tdR: React.CSSProperties = { ...td, textAlign: 'right' }
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }

export default function ManhChoDanPage() {
  const tong = useMemo(() => MANH_CHO_DAN_DATA.reduce((s, i) => s + i.soLuong, 0), [])

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <Layers size={20} /> Mảnh chờ đan
      </h2>
      <div style={{ color: 'var(--text3)', fontSize: 13, margin: '4px 0 16px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <Check size={14} style={{ color: '#16a34a' }} /> Kho chứa các mảnh Tổ Sơn đã sơn & KCS duyệt đạt — chờ chuyển sang Đan.
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
            {MANH_CHO_DAN_DATA.map(r => (
              <tr key={r.id} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ ...td, fontWeight: 600 }}>{r.tenVatLieu}</td>
                <td style={{ ...tdR, fontWeight: 700, color: '#e65100' }}>{r.soLuong.toLocaleString('vi-VN')}</td>
                <td style={{ ...td, color: 'var(--text3)' }}>{r.dvt}</td>
              </tr>
            ))}
            {MANH_CHO_DAN_DATA.length === 0 && (
              <tr><td colSpan={3} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>Chưa có mảnh nào được KCS duyệt</td></tr>
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
