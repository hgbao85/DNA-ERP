'use client'
import { useEffect, useRef, useState } from 'react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { format } from 'date-fns'
import { ChevronLeft, Package } from 'lucide-react'
import type { PlanForm } from '../../../types/plan-form'
import LoadingState from '../../../components/LoadingState'

type DGStatus = 'chua-dong' | 'dang-dong' | 'da-dong'

const STATUS_DG: Record<DGStatus, { label: string; color: string; bg: string }> = {
  'chua-dong': { label: 'Chưa đóng', color: '#92400e', bg: '#fef3c7' },
  'dang-dong': { label: 'Đang đóng', color: '#1e40af', bg: '#dbeafe' },
  'da-dong':   { label: 'Đã đóng',   color: '#166534', bg: '#dcfce7' },
}

function strHash(s: string): number {
  return s.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
}

// Dùng chung với "Chi tiết từng công đoạn" bên Bảng thống kê KHSX (xem ThongKePagePlan.tsx) để số
// liệu "tổng thùng" luôn khớp với đúng những gì thủ kho thành phẩm (khotp@demo.com) đang thấy ở đây.
export function mockTotalBoxes(pf: PlanForm): number {
  const code = pf.mfgProduct?.factoryCode ?? `#${pf.id}`
  return 20 + (strHash(code) % 60)
}

function getStatus(daDong: number, total: number): DGStatus {
  if (daDong <= 0) return 'chua-dong'
  if (daDong >= total) return 'da-dong'
  return 'dang-dong'
}

export default function KhoDongGoiPage({ readOnly = false, filterExportOrderId }: { readOnly?: boolean; filterExportOrderId?: number } = {}) {
  const { data: planForms = [], isLoading } = useFetch(() => api.getPlanForms(), [])
  const [selectedPf, setSelectedPf] = useState<PlanForm | null>(null)
  const [daDongMap, setDaDongMap]   = useState<Record<number, number>>({})
  const [inputQty, setInputQty]     = useState('')
  const [showConfirm, setShowConfirm] = useState(false)

  const active = ((planForms ?? []) as PlanForm[]).filter(p => p.status !== 'DRAFT' && (filterExportOrderId === undefined || p.exportOrderId === filterExportOrderId))

  // Drill-down từ bảng tổng hợp SX (qlsx@) truyền sẵn filterExportOrderId → nhảy thẳng vào chi
  // tiết đúng lệnh đó thay vì bắt bấm lại vào 1 danh sách chỉ có 1 dòng.
  const autoSelectedRef = useRef(false)
  useEffect(() => {
    if (!autoSelectedRef.current && filterExportOrderId !== undefined && active.length > 0) {
      setSelectedPf(active[0])
      autoSelectedRef.current = true
    }
  }, [active, filterExportOrderId])

  const commitConfirm = () => {
    if (!selectedPf) return
    const qty = Math.max(0, Number(inputQty) || 0)
    if (!qty) return
    setDaDongMap(prev => ({ ...prev, [selectedPf.id]: (prev[selectedPf.id] ?? 0) + qty }))
    setInputQty('')
    setShowConfirm(false)
  }

  const goBack = () => { setSelectedPf(null); setInputQty(''); setShowConfirm(false) }

  // ── Detail view ───────────────────────────────────────────────────────────────
  if (selectedPf) {
    const total      = mockTotalBoxes(selectedPf)
    const daDong     = daDongMap[selectedPf.id] ?? 0
    const conLai     = Math.max(0, total - daDong)
    const inputNum   = Math.max(0, Number(inputQty) || 0)
    const canConfirm = inputNum > 0
    const pct        = Math.min(100, Math.round(daDong / total * 100))
    const isDone     = conLai === 0 && daDong > 0

    return (
      <div>
        {/* Page header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <button
            onClick={goBack}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer' }}
          >
            <ChevronLeft size={15} /> Quay lại
          </button>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
              {selectedPf.mfgProduct?.factoryCode}
              {selectedPf.mfgProduct?.name && (
                <span style={{ fontWeight: 400, color: 'var(--text2)', marginLeft: 6 }}>— {selectedPf.mfgProduct.name}</span>
              )}
            </h2>
            <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>
              PO: {selectedPf.exportOrder?.poNumber ?? `#${selectedPf.exportOrderId}`}
              {selectedPf.exportOrder?.deliveryDate && (
                <> · Hạn giao: {format(new Date(selectedPf.exportOrder.deliveryDate), 'dd/MM/yyyy')}</>
              )}
            </div>
          </div>
        </div>

        {/* Main card */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', maxWidth: 580 }}>

          {/* Progress section */}
          <div style={{ padding: '22px 24px 20px', borderBottom: '1px solid var(--border)', background: isDone ? '#f0fdf4' : 'var(--surface)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <Package size={16} color={isDone ? '#16a34a' : 'var(--text3)'} />
                <span style={{ fontSize: 14, fontWeight: 600, color: isDone ? '#16a34a' : 'var(--text2)' }}>
                  {isDone ? 'Đã đóng gói hoàn tất' : 'Tiến độ đóng gói'}
                </span>
              </div>
              <span style={{ fontSize: 26, fontWeight: 800, lineHeight: 1, color: isDone ? '#16a34a' : pct > 0 ? '#e65100' : 'var(--text3)' }}>
                {pct}%
              </span>
            </div>
            <div style={{ height: 10, background: 'var(--border)', borderRadius: 5, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: isDone ? '#16a34a' : '#e65100', borderRadius: 5, transition: 'width .4s ease' }} />
            </div>
          </div>

          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', borderBottom: '1px solid var(--border)' }}>
            <div style={{ padding: '18px 20px', borderRight: '1px solid var(--border)', textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>Tổng thùng</div>
              <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--text)' }}>{total}</div>
            </div>
            <div style={{ padding: '18px 20px', borderRight: '1px solid var(--border)', textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>Đã đóng gói</div>
              <div style={{ fontSize: 30, fontWeight: 800, color: daDong > 0 ? '#16a34a' : 'var(--text3)' }}>{daDong}</div>
            </div>
            <div style={{ padding: '18px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>Còn lại</div>
              <div style={{ fontSize: 30, fontWeight: 800, color: conLai > 0 ? '#d97706' : '#16a34a' }}>{conLai}</div>
            </div>
          </div>

          {/* Input section */}
          {!readOnly && (
            <div style={{ padding: '20px 24px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginBottom: 12 }}>
                Nhập số lượng đã đóng
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  type="number" min={1}
                  value={inputQty}
                  onChange={e => setInputQty(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && canConfirm && setShowConfirm(true)}
                  placeholder="Nhập số thùng..."
                  style={{ flex: 1, padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 9, fontSize: 15, background: 'var(--surface)', color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }}
                  autoFocus
                />
                <button
                  onClick={() => canConfirm && setShowConfirm(true)}
                  disabled={!canConfirm}
                  style={{ padding: '10px 22px', fontSize: 14, fontWeight: 700, border: 'none', borderRadius: 9, background: canConfirm ? '#e65100' : 'var(--surface2)', color: canConfirm ? '#fff' : 'var(--text3)', cursor: canConfirm ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}
                >
                  Xác nhận
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Confirmation dialog */}
        {!readOnly && showConfirm && (
          <div
            onClick={e => { if (e.target === e.currentTarget) setShowConfirm(false) }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <div style={{ background: 'var(--surface)', borderRadius: 14, width: 380, boxShadow: '0 8px 40px rgba(0,0,0,.25)', overflow: 'hidden' }}>
              <div style={{ padding: '22px 24px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Package size={20} color="#e65100" />
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>Xác nhận đóng gói</div>
                </div>
                <div style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.6 }}>
                  Xác nhận đã đóng thêm{' '}
                  <span style={{ fontWeight: 700, color: '#e65100', fontSize: 16 }}>{inputNum} thùng</span>?
                </div>
                <div style={{ marginTop: 14, padding: '12px 14px', background: 'var(--surface2)', borderRadius: 9, display: 'flex', gap: 20 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginBottom: 3 }}>TRƯỚC</div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{daDong} / {total}</div>
                  </div>
                  <div style={{ color: 'var(--text3)', alignSelf: 'center', fontSize: 18 }}>→</div>
                  <div>
                    <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 600, marginBottom: 3 }}>SAU</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#16a34a' }}>{Math.min(daDong + inputNum, total)} / {total}</div>
                  </div>
                </div>
              </div>
              <div style={{ padding: '14px 24px 20px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  onClick={() => setShowConfirm(false)}
                  style={{ padding: '8px 18px', fontSize: 13, fontWeight: 600, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer' }}
                >
                  Hủy
                </button>
                <button
                  onClick={commitConfirm}
                  style={{ padding: '8px 20px', fontSize: 13, fontWeight: 700, border: 'none', borderRadius: 8, background: '#e65100', color: '#fff', cursor: 'pointer' }}
                >
                  Xác nhận đóng gói
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── List view ─────────────────────────────────────────────────────────────────
  return (
    <div>
      <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700 }}>Đóng gói</h2>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text3)' }}>
        Nhấn vào dòng để cập nhật số lượng đóng gói
      </p>

      {isLoading ? <LoadingState /> : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 130 }} />
              <col />
              <col style={{ width: 110 }} />
              <col style={{ width: 130 }} />
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                <th style={th}>PO</th>
                <th style={th}>SKU</th>
                <th style={th}>Hạn giao</th>
                <th style={th}>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {active.map(pf => {
                const total  = mockTotalBoxes(pf)
                const daDong = daDongMap[pf.id] ?? 0
                const status = getStatus(daDong, total)
                const cfg    = STATUS_DG[status]
                return (
                  <tr
                    key={pf.id}
                    onClick={() => setSelectedPf(pf)}
                    style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                  >
                    <td style={{ ...td, fontWeight: 600, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {pf.exportOrder?.poNumber ?? `#${pf.exportOrderId}`}
                    </td>
                    <td style={{ ...td, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span style={{ fontWeight: 600 }}>{pf.mfgProduct?.factoryCode}</span>
                      {pf.mfgProduct?.name && (
                        <><span style={{ color: 'var(--text3)', margin: '0 4px' }}>—</span>{pf.mfgProduct.name}</>
                      )}
                    </td>
                    <td style={{ ...td, whiteSpace: 'nowrap', color: 'var(--text2)' }}>
                      {pf.exportOrder?.deliveryDate
                        ? format(new Date(pf.exportOrder.deliveryDate), 'dd/MM/yyyy')
                        : '—'}
                    </td>
                    <td style={td}>
                      <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20, color: cfg.color, background: cfg.bg }}>
                        {cfg.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {active.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>
                    Không có PO nào
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const th: React.CSSProperties = { padding: '9px 12px', fontWeight: 600, fontSize: 12, color: 'var(--text2)' }
const td: React.CSSProperties = { padding: '8px 12px', color: 'var(--text)' }
