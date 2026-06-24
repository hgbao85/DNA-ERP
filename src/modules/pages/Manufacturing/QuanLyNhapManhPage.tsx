import { useState } from 'react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { AlertCircle } from 'lucide-react'
import DanManhPanel, { type ManhPI } from './DanManhPanel'

// ── Màn "Quản lý nhập mảnh": chọn Lệnh SX → bảng theo mảnh (cần/đã thu/chưa xuất đan/chưa thu) ──
// Đan Trưởng + Quản lý SX thao tác; Giám đốc xem (readOnly). Dùng chung DanManhPanel với thẻ tiến độ.
export default function QuanLyNhapManhPage({ readOnly = false }: { readOnly?: boolean }) {
  const { data, isLoading, error, refetch } = useFetch<ManhPI[]>(() => api.getWeavingManhSummary(), [])
  const pis = Array.isArray(data) ? data : []
  const totalPieces = pis.reduce((sum, item) => sum + item.pieces.length, 0)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const activePi = pis.find((p) => p.piId === selectedId) ?? pis[0] ?? null

  if (isLoading) return <div style={{ padding: 40, color: 'var(--text3)' }}>Đang tải...</div>
  if (error) return <div style={{ color: '#c62828', display: 'flex', gap: 6 }}><AlertCircle size={16} />Lỗi tải dữ liệu</div>

  return (
    <div>
      <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700 }}>Quản lý nhập mảnh</h2>
      <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text3)' }}>
        Theo dõi mảnh đan theo từng Lệnh SX: cần · đã thu · chưa xuất đan · chưa thu. Bấm "Nhập mảnh" để thu hàng về kho.
      </p>
      {pis.length > 0 && (
        <div style={{ color: 'var(--text3)', fontSize: 12, marginBottom: 16 }}>
          Hiện có {pis.length} lệnh SX có mảnh đan — tổng {totalPieces} loại mảnh.
        </div>
      )}

      {pis.length === 0 && <div style={{ color: 'var(--text3)', fontSize: 13 }}>Chưa có Lệnh SX nào có mảnh đan. Kiểm tra sản phẩm hoặc lệnh SX đang chạy.</div>}

      {pis.length > 0 && (
        <>
          {/* PI selector */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {pis.map((pi) => {
              const isSel = (selectedId ?? pis[0]?.piId) === pi.piId
              return (
                <button key={pi.piId} onClick={() => setSelectedId(pi.piId)} style={{
                  padding: '6px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                  background: isSel ? '#e65100' : 'var(--surface)', color: isSel ? '#fff' : 'var(--text)',
                  fontWeight: 600, fontSize: 12, cursor: 'pointer',
                }}>
                  {pi.code}
                </button>
              )
            })}
          </div>

          {activePi && (
            <>
              <div style={{ background: 'var(--surface2)', borderRadius: 'var(--radius)', padding: '10px 16px', marginBottom: 16, fontSize: 13, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                <span><strong>{activePi.code}</strong></span>
                {activePi.poNumber && <span style={{ color: 'var(--text3)' }}>PO: {activePi.poNumber}</span>}
                <span style={{ color: 'var(--text3)' }}>{activePi.productLabel}</span>
              </div>
              <DanManhPanel pi={activePi} readOnly={readOnly} onChanged={refetch} />
            </>
          )}
        </>
      )}
    </div>
  )
}
