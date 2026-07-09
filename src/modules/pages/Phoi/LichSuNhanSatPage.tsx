'use client'

/**
 * Lịch sử nhận sắt (Phôi) — mục sidebar riêng, READ-ONLY.
 *
 * Kho xuất sắt qua = Phôi tự động nhận (không cần bấm xác nhận). Trang này chỉ ghi
 * lại các đợt đã nhận + thời gian gửi (cũng là thời gian bắt đầu cắt). Việc xác nhận
 * cắt xong làm ở "Lệnh sản xuất" (trong từng mảnh). Bấm 1 dòng xem đoạn quy đổi.
 */

import { useState } from 'react'
import { ArrowDownToLine, Check, CircleAlert, Clock, ChevronDown, ChevronRight } from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import type { SatIssueView } from '../../../services/api'
import { moTaKieuCat } from '../../../lib/quy-doi-sat'
import LoadingState from '../../../components/LoadingState'

const cayThuc = (l: SatIssueView) => l.soCayThuc ?? l.soCay
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }

export default function LichSuNhanSatPage() {
  const { data: lines, isLoading } = useFetch<SatIssueView[]>(() => api.getDotXuatSat(), [])
  if (isLoading || !lines) return <LoadingState />

  // Đã nhận = mọi đợt kho đã gửi qua (đang chờ cắt hoặc đã cắt), mới nhất trước.
  const daNhan = lines
    .filter(l => l.status === 'DA_NHAN' || l.status === 'DA_CAT')
    .sort((a, b) => b.dotThoiGian.localeCompare(a.dotThoiGian))

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <ArrowDownToLine size={20} /> Lịch sử nhận sắt
      </h2>
      <div style={{ color: 'var(--text3)', fontSize: 13, margin: '4px 0 18px' }}>
        Kho xuất sắt qua theo từng đợt — Phôi tự động nhận. <b>Thời gian nhận = thời gian bắt đầu cắt.</b> Bấm 1 dòng để xem đoạn quy đổi.
      </div>

      {daNhan.length === 0
        ? <div style={{ ...card, padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Chưa nhận đợt sắt nào</div>
        : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {daNhan.map(l => <Row key={l.id} l={l} />)}
          </div>}
    </div>
  )
}

function Row({ l }: { l: SatIssueView }) {
  const [open, setOpen] = useState(false)
  const cut = l.status === 'DA_CAT'
  const sai = cut && l.soCayThuc != null && l.soCayThuc !== l.soCay
  return (
    <div style={{ ...card, padding: '12px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button onClick={() => setOpen(o => !o)} title="Xem đoạn quy đổi"
          style={{ display: 'inline-flex', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 2 }}>
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        <div style={{ flex: '1 1 320px' }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>
            <span style={{ fontFamily: 'monospace', color: 'var(--text3)', fontWeight: 700, marginRight: 8 }}>{l.poNumber}</span>
            {l.loaiSat} <span style={{ color: 'var(--text3)', fontWeight: 400 }}>· {l.quyCach} · cây {l.barLen}mm</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            {l.sku} · {l.bundles.length} kiểu cắt · <Clock size={12} /> Nhận & bắt đầu cắt: {l.dotThoiGian}
          </div>
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, minWidth: 66, textAlign: 'right' }}>
          {l.soCay} <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 400 }}>cây</span>
        </div>
        <div style={{ minWidth: 130, textAlign: 'right' }}>
          {cut ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#16a34a' }}>
              <Check size={14} /> Đã cắt {cayThuc(l)} cây
            </span>
          ) : (
            <span style={{ fontSize: 12, fontWeight: 600, color: '#1e40af' }}>Đang cắt</span>
          )}
          {sai && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#d97706', marginLeft: 6 }}>
              <CircleAlert size={12} /> lệch {l.soCayThuc! - l.soCay > 0 ? '+' : ''}{l.soCayThuc! - l.soCay}
            </div>
          )}
        </div>
      </div>
      {open && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed var(--border)' }}>
          <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600, marginBottom: 6 }}>Kiểu cắt (do hệ thống cắt sắt tính):</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 12 }}>
            {l.bundles.map((b, i) => (
              <div key={i} style={{ fontSize: 12, color: 'var(--text)' }}>
                <b>{b.soCay} cây</b> <span style={{ color: 'var(--text3)' }}>→ mỗi cây:</span> {moTaKieuCat(b)}
                <span style={{ color: 'var(--text3)' }}> · hao hụt {b.hhPerCay}mm/cây</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600, marginBottom: 6 }}>
            Đoạn thu được: <span style={{ color: 'var(--text3)', fontWeight: 400 }}>hao hụt {l.hhTongMm.toLocaleString('vi-VN')}mm</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {l.doanQuyDoi.map(d => (
              <span key={d.len} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4, fontSize: 12, padding: '3px 10px', borderRadius: 20, background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                <b style={{ color: '#e65100' }}>{d.count}</b> đoạn <span style={{ color: 'var(--text2)' }}>{d.len}mm</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
