import { useState } from 'react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import type { BeWeavingPointGroup } from '../../../services/weaving-issues-api'
import { AlertCircle, Phone, CheckCircle2 } from 'lucide-react'
import WeavingPointsPage from '../Admin/masterData/WeavingPointsPage'

// ── Màn "Quản lý điểm đan" — 2 tab con: Thông tin điểm đan | Mảnh tại điểm đan ──
// readOnly (giám đốc): cả 2 tab chỉ xem. Đan Trưởng/Quản lý SX: tab Thông tin thêm/sửa được.
type SubTab = 'info' | 'pieces'

export default function QuanLyDiemDanPage({ readOnly = false }: { readOnly?: boolean }) {
  const [sub, setSub] = useState<SubTab>('info')

  const tabs: { id: SubTab; label: string }[] = [
    { id: 'info', label: 'Thông tin điểm đan' },
    { id: 'pieces', label: 'Mảnh tại điểm đan' },
  ]

  return (
    <div>
      <h2 style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 700 }}>Quản lý điểm đan</h2>

      <div style={{ display: 'flex', gap: 2, borderBottom: '2px solid var(--border)', marginBottom: 20 }}>
        {tabs.map((t) => {
          const active = sub === t.id
          return (
            <button key={t.id} onClick={() => setSub(t.id)} style={{
              padding: '10px 20px', border: 'none', fontSize: 13, cursor: 'pointer',
              borderRadius: 'var(--radius) var(--radius) 0 0', background: active ? 'var(--surface)' : 'transparent',
              borderBottom: active ? '2px solid #e65100' : '2px solid transparent', marginBottom: -2,
              color: active ? '#e65100' : 'var(--text2)', fontWeight: active ? 700 : 400,
            }}>
              {t.label}
            </button>
          )
        })}
      </div>

      {sub === 'info' && <WeavingPointsPage readOnly={readOnly} embedded />}
      {sub === 'pieces' && <ManhTaiDiemDan />}
    </div>
  )
}

// ── Tab "Mảnh tại điểm đan": mỗi điểm đan đang giữ những mảnh nào, số lượng bao nhiêu ──
// Type thật (GET /weaving-issues/by-point) không có id riêng cho từng dòng như mock cũ — key React
// dựng từ (pieceCode, poNumber); poNumber đã ưu tiên salesOrderCode nếu có (xem BE).
type PointGroup = BeWeavingPointGroup

const th: React.CSSProperties = { textAlign: 'left', padding: '7px 12px', fontSize: 12, color: 'var(--text3)', fontWeight: 600, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '7px 12px', fontSize: 13, borderBottom: '1px solid var(--border)' }

function ManhTaiDiemDan() {
  const { data, isLoading, error } = useFetch<PointGroup[]>(() => api.getWeavingByPoint(), [])
  const [onlyHolding, setOnlyHolding] = useState(false)
  const all = Array.isArray(data) ? data : []

  if (isLoading) return <div style={{ padding: 40, color: 'var(--text3)' }}>Đang tải...</div>
  if (error) return <div style={{ color: '#c62828', display: 'flex', gap: 6 }}><AlertCircle size={16} />Lỗi tải dữ liệu</div>
  if (all.length === 0) return <div style={{ color: 'var(--text3)', fontSize: 13 }}>Chưa có điểm đan nào nhận mảnh.</div>

  const totalGiao = all.reduce((s, p) => s + p.assignments.reduce((a, x) => a + x.quantity, 0), 0)
  const totalVe = all.reduce((s, p) => s + p.assignments.reduce((a, x) => a + x.completed, 0), 0)
  const totalGiu = all.reduce((s, p) => s + p.totalHolding, 0)
  const holdingCount = all.filter((p) => p.totalHolding > 0).length
  const points = onlyHolding ? all.filter((p) => p.totalHolding > 0) : all

  return (
    <div>
      {/* Thanh tổng + nút lọc */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 13 }}>
          <span style={{ color: 'var(--text3)' }}>Điểm đan: <strong style={{ color: 'var(--text)' }}>{all.length}</strong> <span style={{ color: 'var(--text3)' }}>(đang giữ {holdingCount})</span></span>
          <span style={{ color: 'var(--text3)' }}>Đã giao: <strong style={{ color: 'var(--text)' }}>{totalGiao}</strong></span>
          <span style={{ color: 'var(--text3)' }}>Đã về: <strong style={{ color: '#2e7d32' }}>{totalVe}</strong></span>
          <span style={{ color: 'var(--text3)' }}>Đang giữ: <strong style={{ color: '#e65100' }}>{totalGiu}</strong></span>
        </div>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, color: 'var(--text2)', cursor: 'pointer', userSelect: 'none' }}>
          <input type="checkbox" checked={onlyHolding} onChange={(e) => setOnlyHolding(e.target.checked)} style={{ cursor: 'pointer' }} />
          Chỉ điểm đang giữ hàng
        </label>
      </div>

      {points.length === 0 && (
        <div style={{ color: 'var(--text3)', fontSize: 13 }}>Không có điểm đan nào đang giữ hàng — tất cả đã về kho.</div>
      )}

      {points.map((pt) => {
        const held = pt.totalHolding > 0
        return (
          <div key={pt.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', marginBottom: 16, overflow: 'hidden', opacity: held ? 1 : 0.85 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <strong style={{ fontSize: 14 }}>{pt.code}</strong>
                {pt.fullName && <span style={{ color: 'var(--text3)', marginLeft: 8, fontSize: 12 }}>· {pt.fullName}</span>}
                {pt.phone && <span style={{ color: 'var(--text3)', marginLeft: 8, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Phone size={11} />{pt.phone}</span>}
              </div>
              {held ? (
                <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: '#fff3e0', color: '#e65100' }}>Đang giữ {pt.totalHolding} mảnh</span>
              ) : (
                <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 99, background: '#e8f5e9', color: '#2e7d32', display: 'inline-flex', alignItems: 'center', gap: 5 }}><CheckCircle2 size={12} /> Đã về đủ</span>
              )}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>Mảnh</th>
                    <th style={th}>Lệnh SX / PO</th>
                    <th style={{ ...th, textAlign: 'right' }}>Đã giao</th>
                    <th style={{ ...th, textAlign: 'right' }}>Đã về</th>
                    <th style={{ ...th, textAlign: 'right' }}>Đang giữ</th>
                  </tr>
                </thead>
                <tbody>
                  {pt.assignments.map((a) => (
                    <tr key={`${a.pieceCode}-${a.poNumber}`}>
                      <td style={td}><strong>{a.pieceName}</strong> <span style={{ color: 'var(--text3)', fontSize: 11 }}>{a.pieceCode}</span></td>
                      <td style={{ ...td, fontSize: 12 }}>{a.poNumber}<div style={{ color: 'var(--text3)' }}>{a.productLabel}</div></td>
                      <td style={{ ...td, textAlign: 'right' }}>{a.quantity}</td>
                      <td style={{ ...td, textAlign: 'right', color: '#2e7d32' }}>{a.completed}</td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: a.holding > 0 ? '#e65100' : 'var(--text3)' }}>{a.holding}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}
