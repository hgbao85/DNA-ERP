'use client'

/**
 * Khung hàn (Hàn) — mục sidebar dưới "Danh sách định mức mảnh", READ-ONLY.
 *
 * Kho chứa các mảnh/khung Tổ Hàn đã hàn xong & đã được KCS duyệt đạt (chờ chuyển
 * sang Sơn). Tương tự "Kho phôi" bên Tổ Phôi — bảng gọn 3 cột: Tên vật liệu · Số
 * lượng · ĐVT.
 *
 * Đã nối BE thật (M3, đợt 2): không cần endpoint tổng hợp riêng — gộp production-batches trạng
 * thái QC_DONE theo part, tái dùng đúng GET /production-batches?stage= (Phase 1, KcsStagePage),
 * chỉ đổi trục nhóm (part thay vì PO). reportedQty của batch QC_DONE đã là passed-qty (BE ghi đè
 * sau khi KCS duyệt), không phải qty gốc đã báo.
 */

import { useMemo } from 'react'
import { Frame, Check } from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import type { BeProductionBatch } from '../../../services/production-batches-api'
import LoadingState from '../../../components/LoadingState'

interface KhoItem {
  id: string
  tenVatLieu: string
  soLuong: number
  dvt: string          // đơn vị tính: cái
}

const th: React.CSSProperties = { padding: '10px 14px', fontSize: 12, fontWeight: 600, color: 'var(--text2)', textAlign: 'left', whiteSpace: 'nowrap' }
const thR: React.CSSProperties = { ...th, textAlign: 'right' }
const td: React.CSSProperties = { padding: '11px 14px', fontSize: 13 }
const tdR: React.CSSProperties = { ...td, textAlign: 'right' }
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }

export default function KhungHanPage() {
  const { data: batches, isLoading } = useFetch<BeProductionBatch[]>(() => api.getProductionBatchesByStage('HAN'), [])

  const rows: KhoItem[] = useMemo(() => {
    const byPart = new Map<string, KhoItem>()
    for (const b of batches ?? []) {
      if (b.status !== 'QC_DONE') continue
      const cur = byPart.get(b.partId)
      if (cur) cur.soLuong += b.reportedQty
      else byPart.set(b.partId, { id: b.partId, tenVatLieu: `${b.partName} — ${b.partCode}`, soLuong: b.reportedQty, dvt: 'cái' })
    }
    return Array.from(byPart.values())
  }, [batches])

  const tong = useMemo(() => rows.reduce((s, i) => s + i.soLuong, 0), [rows])

  if (isLoading) return <LoadingState />

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
            {rows.map(r => (
              <tr key={r.id} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ ...td, fontWeight: 600 }}>{r.tenVatLieu}</td>
                <td style={{ ...tdR, fontWeight: 700, color: '#e65100' }}>{r.soLuong.toLocaleString('vi-VN')}</td>
                <td style={{ ...td, color: 'var(--text3)' }}>{r.dvt}</td>
              </tr>
            ))}
            {rows.length === 0 && (
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
