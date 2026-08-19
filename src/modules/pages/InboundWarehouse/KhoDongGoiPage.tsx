'use client'
import { useEffect, useRef, useState } from 'react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import type { BePackagingProgress } from '../../../services/packaging-api'
import { format } from 'date-fns'
import { ChevronLeft, X } from 'lucide-react'
import type { Sku } from '../../../types/sku'
import LoadingState from '../../../components/LoadingState'


export default function KhoDongGoiPage({ readOnly = false, filterExportOrderId }: { readOnly?: boolean; filterExportOrderId?: string } = {}) {
  const { data: skus = [], isLoading } = useFetch(() => api.getSkus(), [])
  const [selectedPf, setSelectedPf] = useState<Sku | null>(null)

  const { data: progress, isLoading: progressLoading, refetch: refetchProgress } = useFetch<BePackagingProgress>(
    () => (selectedPf ? api.getPackaging(selectedPf) : Promise.resolve({ totalQty: 0, packedQty: 0, remainingQty: 0 })),
    [selectedPf?.id],
  )

  const [popupOpen, setPopupOpen]   = useState(false)
  const [popupQty, setPopupQty]     = useState('')
  const [saving, setSaving]         = useState(false)
  const [saveError, setSaveError]   = useState('')

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

  const openPopup = () => { setPopupQty(''); setSaveError(''); setPopupOpen(true) }

  const handleConfirm = async () => {
    if (!selectedPf) return
    const qty = Math.max(0, Number(popupQty) || 0)
    if (qty <= 0) return

    setSaving(true)
    setSaveError('')
    try {
      await api.recordPackaging(selectedPf, { boxesPacked: qty })
      setPopupOpen(false)
      await refetchProgress()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Không lưu được số lượng đóng gói')
    } finally {
      setSaving(false)
    }
  }

  const canConfirm = !!popupQty && Number(popupQty) > 0 && !saving

  // ── Detail view ───────────────────────────────────────────────────────────────
  if (selectedPf) {
    const total   = progress?.totalQty ?? 0
    const daDong  = progress?.packedQty ?? 0
    const conLai  = progress?.remainingQty ?? 0

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
        {progressLoading ? <LoadingState /> : (
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
                {total === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>
                      Chưa có gì để đóng gói (SKU chưa được Sếp duyệt lệnh sản xuất)
                    </td>
                  </tr>
                ) : (
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
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Popup */}
        {popupOpen && (
          <div
            onClick={e => { if (e.target === e.currentTarget && !saving) setPopupOpen(false) }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <div style={{ background: 'var(--surface)', borderRadius: 14, width: 380, boxShadow: '0 8px 40px rgba(0,0,0,.2)' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>Nhập số lượng đã đóng</div>
                <button onClick={() => !saving && setPopupOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
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
                {saveError && <div style={{ color: '#c62828', fontSize: 12, marginTop: 12 }}>{saveError}</div>}
              </div>

              <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  onClick={() => setPopupOpen(false)}
                  disabled={saving}
                  style={{ padding: '7px 18px', fontSize: 13, fontWeight: 600, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface2)', color: 'var(--text)', cursor: saving ? 'not-allowed' : 'pointer' }}
                >Hủy</button>
                <button
                  onClick={handleConfirm}
                  disabled={!canConfirm}
                  style={{ padding: '7px 18px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 8, background: canConfirm ? '#e65100' : 'var(--surface2)', color: canConfirm ? '#fff' : 'var(--text3)', cursor: canConfirm ? 'pointer' : 'not-allowed' }}
                >{saving ? 'Đang lưu...' : 'Xác nhận'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── List view ─────────────────────────────────────────────────────────────────
  // Chỉ liệt kê PO/SKU/hạn giao - số liệu tiến độ (tổng/đã đóng/còn lại) cần gọi API riêng cho
  // từng SKU nên chỉ tải khi bấm vào xem chi tiết, tránh N lần gọi API cho mỗi dòng trong danh sách
  // (cùng pattern với KhoChuyenKiemPage).
  return (
    <div>
      <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700 }}>Đóng gói</h2>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text3)' }}>
        Nhấn vào dòng để cập nhật số lượng đóng gói
      </p>

      {isLoading ? <LoadingState /> : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 600, borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: 120 }} />
                <col />
                <col style={{ width: 130 }} />
              </colgroup>
              <thead>
                <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                  <th style={th}>PO</th>
                  <th style={th}>SKU</th>
                  <th style={th}>Hạn giao</th>
                </tr>
              </thead>
              <tbody>
                {active.map(pf => (
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
                  </tr>
                ))}
                {active.length === 0 && (
                  <tr>
                    <td colSpan={3} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>
                      Không có PO nào
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

const th:  React.CSSProperties = { padding: '9px 12px', fontWeight: 600, fontSize: 12, color: 'var(--text2)' }
const td:  React.CSSProperties = { padding: '8px 12px', color: 'var(--text)' }
const lbl: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }
const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box' }
