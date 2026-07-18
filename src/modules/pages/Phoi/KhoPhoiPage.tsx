'use client'

/**
 * Kho phôi (Phôi) — mục sidebar dưới "Lịch sử nhận sắt", READ-ONLY.
 *
 * Lưu trữ số sắt tổ Phôi đã gia công (cắt) & được KCS duyệt đạt, cùng đoạn sắt cắt thừa.
 * DỮ LIỆU DERIVE TỪ LUỒNG THẬT (không hard-code):
 *   Kho xuất → Phôi cắt → KCS đạt (getDoanTonKho) → Hàn tiêu hao (san-luong HAN).
 *   - "Đã KCS duyệt"  = đoạn tồn còn phục vụ phần Hàn chưa xong (chờ chuyển Hàn).
 *   - "Đoạn thừa"     = đoạn tồn không chi tiết nào còn dùng (đầu mẩu 200mm / chi tiết đã hàn đủ).
 * Xem computeDoanKho (lib/mock/phan-loai-doan-sat) — cùng công thức "thực có" bên màn Hàn.
 */

import { useMemo, useState } from 'react'
import { Warehouse, Check, Scissors } from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import type { DoanTon, SanLuongBatch } from '../../../services/api'
import { computeDoanKho, type DoanKhoRow } from '../../../lib/mock/phan-loai-doan-sat'
import { hanSeed } from '../Han/LenhSanXuatHan'

const th: React.CSSProperties = { padding: '10px 14px', fontSize: 12, fontWeight: 600, color: 'var(--text2)', textAlign: 'left', whiteSpace: 'nowrap' }
const thR: React.CSSProperties = { ...th, textAlign: 'right' }
const td: React.CSSProperties = { padding: '11px 14px', fontSize: 13 }
const tdR: React.CSSProperties = { ...td, textAlign: 'right' }
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }

type Tab = 'duyet' | 'thua'

const tenVatLieu = (r: DoanKhoRow, thua: boolean) =>
  `${r.loaiSat} ${r.quyCach} — đoạn ${thua ? 'thừa ' : ''}${r.len}mm`

export default function KhoPhoiPage() {
  const [tab, setTab] = useState<Tab>('duyet')

  const { data: doanTon } = useFetch<DoanTon[]>(() => api.getDoanTonKho(), [])
  const { data: batches } = useFetch<SanLuongBatch[]>(() => api.getSanLuongByStage('HAN'), [])

  const { duyet, thua } = useMemo(
    () => computeDoanKho(hanSeed(), batches ?? [], doanTon ?? []),
    [batches, doanTon],
  )

  const tongDuyet = useMemo(() => duyet.reduce((s, i) => s + i.soDoan, 0), [duyet])
  const tongThua = useMemo(() => thua.reduce((s, i) => s + i.soDoan, 0), [thua])

  const rows = tab === 'duyet' ? duyet : thua

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <Warehouse size={20} /> Kho phôi
      </h2>
      <div style={{ color: 'var(--text3)', fontSize: 13, margin: '4px 0 16px' }}>
        Đoạn sắt tổ Phôi đã gia công & KCS duyệt đạt — <b>Cần</b> còn chờ chuyển Hàn, phần <b>Thừa</b> (đầu mẩu / dôi ra) chờ xử lý.
      </div>

      {/* Tab switch */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        <TabBtn active={tab === 'duyet'} onClick={() => setTab('duyet')} icon={<Check size={15} />}
          label="Đã KCS duyệt (chờ chuyển Hàn)" badge={tongDuyet} />
        <TabBtn active={tab === 'thua'} onClick={() => setTab('thua')} icon={<Scissors size={15} />}
          label="Đoạn thừa (chờ xử lý)" badge={tongThua} />
      </div>

      <KhoTable rows={rows} thua={tab === 'thua'} qtyColor={tab === 'duyet' ? '#e65100' : '#d97706'} />
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
      <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 20, background: active ? '#e65100' : 'var(--surface2)', color: active ? '#fff' : 'var(--text3)' }}>{badge.toLocaleString('vi-VN')}</span>
    </button>
  )
}

// ── Bảng 3 cột: Tên vật liệu · Số lượng · ĐVT ────────────────
function KhoTable({ rows, thua, qtyColor }: { rows: DoanKhoRow[]; thua: boolean; qtyColor: string }) {
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
            <tr key={r.key} style={{ borderTop: '1px solid var(--border)' }}>
              <td style={{ ...td, fontWeight: 600 }}>{tenVatLieu(r, thua)}</td>
              <td style={{ ...tdR, fontWeight: 700, color: qtyColor }}>{r.soDoan.toLocaleString('vi-VN')}</td>
              <td style={{ ...td, color: 'var(--text3)' }}>cái</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={3} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>
              {thua ? 'Chưa có đoạn thừa' : 'Chưa có đoạn nào chờ chuyển Hàn'}
            </td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
