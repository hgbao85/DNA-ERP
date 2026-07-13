'use client'

/**
 * Kho phôi (Phôi) — mục sidebar dưới "Lịch sử nhận sắt", READ-ONLY.
 *
 * Lưu trữ số sắt tổ Phôi đã gia công (cắt) & đã được KCS duyệt đạt, cùng đoạn sắt
 * cắt thừa còn dùng được. Chỉ 3 cột: Tên vật liệu · Số lượng · ĐVT.
 */

import { useMemo, useState } from 'react'
import { Warehouse, Check, Scissors } from 'lucide-react'

// ── Mock data UI (chỉ hiển thị demo, chưa nối BE) ────────────
interface KhoItem {
  id: string
  tenVatLieu: string
  soLuong: number
  dvt: string          // đơn vị tính: cây / cái
}

// Sắt tổ Phôi đã gia công & KCS duyệt đạt (chờ chuyển Hàn)
const DUYET_DATA: KhoItem[] = [
  { id: 'k1', tenVatLieu: 'Sắt Vuông 6 zem 18×18 — đoạn 745mm', soLuong: 240, dvt: 'cái' },
  { id: 'k2', tenVatLieu: 'Sắt Hộp 6 zem 25×50 — đoạn 930mm', soLuong: 50, dvt: 'cái' },
  { id: 'k3', tenVatLieu: 'Sắt Hộp 6 zem 25×50 — đoạn 765mm', soLuong: 50, dvt: 'cái' },
  { id: 'k4', tenVatLieu: 'Sắt Hộp 6 zem 25×50 — đoạn 695mm', soLuong: 30, dvt: 'cái' },
  { id: 'k5', tenVatLieu: 'Sắt Hộp 6 zem 25×50 — đoạn 200mm', soLuong: 70, dvt: 'cái' },
  { id: 'k6', tenVatLieu: 'Sắt Hộp 8 zem 20×40 — đoạn 1150mm', soLuong: 60, dvt: 'cái' },
]

// Đoạn sắt cắt thừa (đầu thừa / đoạn dư) còn dùng được
const THUA_DATA: KhoItem[] = [
  { id: 't1', tenVatLieu: 'Sắt Hộp 6 zem 25×50 — đoạn thừa 200mm', soLuong: 8, dvt: 'cái' },
  { id: 't2', tenVatLieu: 'Sắt Hộp 6 zem 25×50 — đoạn thừa 145mm', soLuong: 12, dvt: 'cái' },
  { id: 't3', tenVatLieu: 'Sắt Vuông 6 zem 18×18 — đoạn thừa 320mm', soLuong: 6, dvt: 'cái' },
  { id: 't4', tenVatLieu: 'Sắt Hộp 8 zem 20×40 — đoạn thừa 410mm', soLuong: 4, dvt: 'cái' },
]

const th: React.CSSProperties = { padding: '10px 14px', fontSize: 12, fontWeight: 600, color: 'var(--text2)', textAlign: 'left', whiteSpace: 'nowrap' }
const thR: React.CSSProperties = { ...th, textAlign: 'right' }
const td: React.CSSProperties = { padding: '11px 14px', fontSize: 13 }
const tdR: React.CSSProperties = { ...td, textAlign: 'right' }
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }

type Tab = 'duyet' | 'thua'

export default function KhoPhoiPage() {
  const [tab, setTab] = useState<Tab>('duyet')

  const tongDuyet = useMemo(() => DUYET_DATA.reduce((s, i) => s + i.soLuong, 0), [])
  const tongThua = useMemo(() => THUA_DATA.reduce((s, i) => s + i.soLuong, 0), [])

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <Warehouse size={20} /> Kho phôi
      </h2>
      <div style={{ color: 'var(--text3)', fontSize: 13, margin: '4px 0 16px' }}>
        Số sắt tổ Phôi đã gia công & KCS duyệt đạt (chờ chuyển Hàn), cùng đoạn sắt cắt thừa còn dùng được.
      </div>

      {/* Tab switch */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        <TabBtn active={tab === 'duyet'} onClick={() => setTab('duyet')} icon={<Check size={15} />}
          label="Đã KCS duyệt" badge={tongDuyet} />
        <TabBtn active={tab === 'thua'} onClick={() => setTab('thua')} icon={<Scissors size={15} />}
          label="Đoạn thừa (tái sử dụng)" badge={tongThua} />
      </div>

      <KhoTable rows={tab === 'duyet' ? DUYET_DATA : THUA_DATA} qtyColor={tab === 'duyet' ? '#e65100' : '#d97706'} />
    </div>
  )
}

function TabBtn({ active, onClick, icon, label, badge }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; badge: number }) {
  return (
    <button onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', fontSize: 13, fontWeight: 600,
        border: '1px solid', borderColor: active ? '#e65100' : 'var(--border)', borderRadius: 8, cursor: 'pointer',
        background: active ? '#fff3e0' : 'var(--surface)', color: active ? '#e65100' : 'var(--text2)',
      }}>
      {icon}{label}
      <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 20, background: active ? '#e65100' : 'var(--surface2)', color: active ? '#fff' : 'var(--text3)' }}>{badge}</span>
    </button>
  )
}

// ── Bảng 3 cột: Tên vật liệu · Số lượng · ĐVT ────────────────
function KhoTable({ rows, qtyColor }: { rows: KhoItem[]; qtyColor: string }) {
  return (
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
          {rows.map(r => (
            <tr key={r.id} style={{ borderTop: '1px solid var(--border)' }}>
              <td style={{ ...td, fontWeight: 600 }}>{r.tenVatLieu}</td>
              <td style={{ ...tdR, fontWeight: 700, color: qtyColor }}>{r.soLuong.toLocaleString('vi-VN')}</td>
              <td style={{ ...td, color: 'var(--text3)' }}>{r.dvt}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={3} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>Chưa có vật liệu nào</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
