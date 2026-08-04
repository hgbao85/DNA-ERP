'use client'
import { useEffect, useRef, useState } from 'react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { format } from 'date-fns'
import { ChevronLeft, X } from 'lucide-react'
import type { Sku } from '../../../types/sku'
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
export function mockTotalBoxes(pf: Sku): number {
  const code = pf.mfgProduct?.factoryCode ?? `#${pf.id}`
  return 20 + (strHash(code) % 60)
}

function getStatus(daDong: number, total: number): DGStatus {
  if (daDong <= 0) return 'chua-dong'
  if (daDong >= total) return 'da-dong'
  return 'dang-dong'
}

export default function KhoDongGoiPage({ readOnly = false, filterExportOrderId }: { readOnly?: boolean; filterExportOrderId?: number } = {}) {
  const { data: skus = [], isLoading } = useFetch(() => api.getSkus(), [])
  const [selectedPf, setSelectedPf] = useState<Sku | null>(null)
  const [daDongMap, setDaDongMap]   = useState<Record<number, number>>({})
  const [popupOpen, setPopupOpen]   = useState(false)
  const [popupQty, setPopupQty]     = useState('')

  const active = ((skus ?? []) as Sku[]).filter(p => p.status !== 'DRAFT' && (filterExportOrderId === undefined || p.exportOrderId === filterExportOrderId))

  // Drill-down từ bảng tổng hợp SX (qlsx@) truyền sẵn filterExportOrderId → nhảy thẳng vào chi
  // tiết đúng lệnh đó thay vì bắt bấm lại vào 1 danh sách chỉ có 1 dòng.
  const autoSelectedRef = useRef(false)
  useEffect(() => {
    if (!autoSelectedRef.current && filterExportOrderId !== undefined && active.length > 0) {
      setSelectedPf(active[0])
      autoSelectedRef.current = true
    }
  }, [active, filterExportOrderId])

  const openPopup = () => { setPopupQty(''); setPopupOpen(true) }

  const handleConfirm = () => {
    if (!selectedPf) return
    const qty = Math.max(0, Number(popupQty) || 0)
    if (!qty) return
    setDaDongMap(prev => ({ ...prev, [selectedPf.id]: (prev[selectedPf.id] ?? 0) + qty }))
    setPopupOpen(false)
  }

  const canConfirm = !!popupQty && Number(popupQty) > 0

  // ── Detail view ───────────────────────────────────────────────────────────────
  if (selectedPf) {
    const total  = mockTotalBoxes(selectedPf)
    const daDong = daDongMap[selectedPf.id] ?? 0
    const conLai = Math.max(0, total - daDong)

    return (
      <div>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button
            onClick={() => setSelectedPf(null)}
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
              PO: {selectedPf.exportOrder?.poNumber ?? 'Chưa gắn đơn hàng'}
              {selectedPf.exportOrder?.deliveryDate && (
                <> · Hạn giao: {format(new Date(selectedPf.exportOrder.deliveryDate), 'dd/MM/yyyy')}</>
              )}
            </div>
          </div>
        </div>

        {/* Detail table */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
            <colgroup>
              <col />
              <col style={{ width: 100 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 100 }} />
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                <th style={th}>Hạng mục</th>
                <th style={{ ...th, textAlign: 'right' }}>Tổng thùng</th>
                <th style={{ ...th, textAlign: 'right' }}>Đã đóng gói</th>
                <th style={{ ...th, textAlign: 'right' }}>Còn lại</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ ...td, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Thùng thành phẩm
                </td>
                <td style={{ ...td, textAlign: 'right', color: 'var(--text2)' }}>{total}</td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: daDong > 0 ? '#16a34a' : 'var(--text)' }}>{daDong}</td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: conLai > 0 ? '#d97706' : '#16a34a' }}>{conLai}</td>
                <td style={td}>
                  {readOnly ? (
                    <span style={{ color: 'var(--text3)', fontSize: 12 }}>—</span>
                  ) : (
                    <button
                      onClick={openPopup}
                      style={{ padding: '4px 12px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 6, background: '#e65100', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      Đóng gói
                    </button>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Popup */}
        {popupOpen && (
          <div
            onClick={e => { if (e.target === e.currentTarget) setPopupOpen(false) }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <div style={{ background: 'var(--surface)', borderRadius: 14, width: 380, boxShadow: '0 8px 40px rgba(0,0,0,.2)' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>Nhập số lượng đã đóng</div>
                <button onClick={() => setPopupOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
                  <X size={16} color="var(--text3)" />
                </button>
              </div>

              <div style={{ padding: '16px 18px' }}>
                <label style={lbl}>Số thùng đã đóng *</label>
                <input
                  type="number" min={1}
                  value={popupQty}
                  onChange={e => setPopupQty(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && canConfirm && handleConfirm()}
                  placeholder="Nhập số thùng"
                  style={inp}
                  autoFocus
                />
              </div>

              <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  onClick={() => setPopupOpen(false)}
                  style={{ padding: '7px 18px', fontSize: 13, fontWeight: 600, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer' }}
                >Hủy</button>
                <button
                  onClick={handleConfirm}
                  disabled={!canConfirm}
                  style={{ padding: '7px 18px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 8, background: canConfirm ? '#e65100' : 'var(--surface2)', color: canConfirm ? '#fff' : 'var(--text3)', cursor: canConfirm ? 'pointer' : 'not-allowed' }}
                >Xác nhận</button>
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
                      {pf.exportOrder?.poNumber ?? 'Chưa gắn đơn hàng'}
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

const th:  React.CSSProperties = { padding: '9px 12px', fontWeight: 600, fontSize: 12, color: 'var(--text2)' }
const td:  React.CSSProperties = { padding: '8px 12px', color: 'var(--text)' }
const lbl: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }
const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box' }
