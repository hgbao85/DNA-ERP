'use client'

/**
 * Xuất kho Sắt La (→ Pat) / Thanh nhôm (→ chân nhôm) cho Phôi — thêm 2026-09-04.
 *
 * Mirror XuatVatTuTieuHaoPage.tsx (KHÔNG mirror XuatSatPage.tsx): xuất TỰ DO theo định mức
 * PieceMaterialYield, KHÔNG cần qua bước đề xuất/duyệt phương án cắt như Sắt (Sắt La/thanh nhôm
 * không có bài toán tối ưu cắt cần solver giải). Chỉ nhập SỐ LƯỢNG (không có "chiều dài" như
 * SteelIssue.barLengthMm - quy cách material là cố định, không đổi mỗi đợt).
 *
 * Cùng pattern master-detail: chọn SKU/PO trước (BE chỉ có plan THEO 1 productionOrderId, không có
 * "toàn PI cần gì" gộp sẵn như Sắt). Bấm "Xuất" → tạo đợt ISSUED → hiện ngay bên "Xác nhận nhận
 * sắt" (XacNhanNhanSatPage) để Phôi xác nhận đã nhận - phải nhận xong Phôi mới báo sản lượng được
 * (ProductionBatchesService.assertMaterialYieldReceived()).
 */

import { useState } from 'react'
import { ChevronLeft, Check } from 'lucide-react'
import { format } from 'date-fns'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import type { BeMaterialYieldIssuePlanItem } from '../../../services/material-yield-issues-api'
import { usePoInfoFloorGate } from '../../../hooks/usePoInfoFloorGate'
import { errMsg } from '../../../utils/errors'
import { backBtn } from '../../../styles/buttons'
import { tableWrap, tbl, row, emptyBox, listTh as thStyle, listTd as tdStyle } from '../../../styles/table'
import LoadingState from '../../../components/LoadingState'
import type { Sku } from '../../../types/sku'

const ACCENT = '#4527A0'

const th: React.CSSProperties = { padding: '10px 14px', fontSize: 12, fontWeight: 600, color: 'var(--text2)', textAlign: 'left', whiteSpace: 'nowrap' }
const thR: React.CSSProperties = { ...th, textAlign: 'right' }
const td: React.CSSProperties = { padding: '9px 14px', fontSize: 13, verticalAlign: 'middle' }
const tdR: React.CSSProperties = { ...td, textAlign: 'right' }
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }

export default function XuatVatTuThanhPhamPage() {
  const { data: skus = [], isLoading } = useFetch(() => api.getSkus(), [])
  const { poInfoFor, activePiIds } = usePoInfoFloorGate()
  const active = ((skus ?? []) as Sku[]).filter(p => p.status !== 'DRAFT' && activePiIds.has(poInfoFor(p)?.productionInvoiceId ?? ''))

  const [selectedPf, setSelectedPf] = useState<Sku | null>(null)
  const { data: planData, isLoading: planLoading, refetch } = useFetch<BeMaterialYieldIssuePlanItem[]>(
    () => (selectedPf ? api.getMaterialYieldIssuePlan(selectedPf) : Promise.resolve([])),
    [selectedPf?.id],
  )
  const plan = planData ?? []

  const [qty, setQty] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [msgs, setMsgs] = useState<Record<string, string>>({})

  const xuat = async (d: BeMaterialYieldIssuePlanItem) => {
    const n = Math.max(0, Math.min(d.remainingToIssue, Math.floor(Number(qty[d.materialId] ?? d.remainingToIssue) || 0)))
    if (n <= 0 || !selectedPf) return
    setBusy(d.materialId)
    setMsgs(p => ({ ...p, [d.materialId]: '' }))
    try {
      await api.issueMaterialYield(selectedPf, { materialId: d.materialId, issuedQty: n })
      setQty(q => { const { [d.materialId]: _, ...rest } = q; return rest })
      await refetch()
    } catch (e) {
      setMsgs(p => ({ ...p, [d.materialId]: errMsg(e, 'Không thể xuất vật tư') }))
    } finally {
      setBusy(null)
    }
  }

  // ── Detail view ───────────────────────────────────────────────────────────────
  if (selectedPf) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <button onClick={() => setSelectedPf(null)} style={backBtn}>
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
              PO: {poInfoFor(selectedPf)?.poCode ?? 'Chưa gắn đơn hàng'}
              {poInfoFor(selectedPf)?.piCode && <> · PI: {poInfoFor(selectedPf)!.piCode}</>}
            </div>
          </div>
        </div>
        <div style={{ color: 'var(--text3)', fontSize: 13, margin: '0 0 16px' }}>
          Xuất Sắt La (Pat) / Thanh nhôm (chân nhôm) theo lệnh sản xuất. Bấm Xuất → Phôi xác nhận nhận ở <b>Xác nhận nhận sắt</b>.
        </div>

        {planLoading ? <LoadingState /> : plan.length === 0 ? (
          <div style={emptyBox}>
            {poInfoFor(selectedPf)
              ? 'SKU này đã có lệnh sản xuất (PO/PI ở trên) nhưng BOM chưa khai định mức vật tư thành phẩm (PieceMaterialYield) — báo KHSX bổ sung định mức cho sản phẩm này trước khi xuất được.'
              : 'SKU này chưa được Sếp duyệt lệnh sản xuất — chưa có gì để xuất.'}
          </div>
        ) : (
          <div style={{ ...card, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
              <thead>
                <tr style={{ background: 'var(--surface2)' }}>
                  <th style={th}>Vật tư</th>
                  <th style={thR}>Cần</th>
                  <th style={thR}>Đã xuất</th>
                  <th style={thR}>Còn phải xuất</th>
                  <th style={{ ...th, textAlign: 'center', width: 220 }}>Xuất</th>
                </tr>
              </thead>
              <tbody>
                {plan.map(d => {
                  const du = d.remainingToIssue <= 0
                  return (
                    <tr key={d.materialId} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ ...td, fontWeight: 600 }}>
                        {d.materialName} <span style={{ color: 'var(--text3)', fontWeight: 400 }}>({d.materialCode})</span>
                      </td>
                      <td style={tdR}>{d.requiredQty.toLocaleString('vi-VN')}</td>
                      <td style={{ ...tdR, color: 'var(--text3)' }}>{d.issuedQty.toLocaleString('vi-VN')}</td>
                      <td style={{ ...tdR, fontWeight: 700, color: du ? 'var(--green)' : '#dc2626' }}>{d.remainingToIssue.toLocaleString('vi-VN')}</td>
                      <td style={{ ...td, textAlign: 'center' }}>
                        {du ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#16a34a' }}>
                            <Check size={14} /> đã xuất đủ
                          </span>
                        ) : (
                          <div>
                            <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                              <input type="number" min={1} max={d.remainingToIssue}
                                value={qty[d.materialId] ?? String(d.remainingToIssue)}
                                onChange={e => {
                                  const raw = e.target.value
                                  if (raw === '') { setQty(q => ({ ...q, [d.materialId]: '' })); return }
                                  const v = Math.max(0, Math.min(d.remainingToIssue, Math.floor(Number(raw) || 0)))
                                  setQty(q => ({ ...q, [d.materialId]: String(v) }))
                                }}
                                style={{ width: 70, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, textAlign: 'right', background: 'var(--surface)', color: 'var(--text)' }} />
                              <button onClick={() => xuat(d)} disabled={busy === d.materialId}
                                style={{ padding: '5px 14px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 6, background: ACCENT, color: '#fff', cursor: busy === d.materialId ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                                {busy === d.materialId ? '...' : 'Xuất'}
                              </button>
                            </div>
                            {msgs[d.materialId] && <div style={{ marginTop: 4, fontSize: 11, color: '#dc2626' }}>{msgs[d.materialId]}</div>}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  // ── List view ─────────────────────────────────────────────────────────────────
  return (
    <div>
      <div style={{ color: 'var(--text3)', fontSize: 13, margin: '4px 0 16px' }}>
        Xuất Sắt La (Pat) / Thanh nhôm (chân nhôm) cho Phôi theo lệnh sản xuất.
      </div>

      {isLoading ? <LoadingState /> : (
        <div style={tableWrap}>
          <table style={tbl}>
            <colgroup>
              <col style={{ width: 130 }} />
              <col />
              <col style={{ width: 110 }} />
              <col style={{ width: 130 }} />
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                <th style={thStyle}>PO</th>
                <th style={thStyle}>SKU</th>
                <th style={thStyle}>PI</th>
                <th style={thStyle}>Hạn giao</th>
              </tr>
            </thead>
            <tbody>
              {active.map(pf => {
                const poInfo = poInfoFor(pf)
                return (
                  <tr key={pf.id} onClick={() => setSelectedPf(pf)} style={row}>
                    <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {poInfo?.poCode ?? 'Chưa gắn đơn hàng'}
                    </td>
                    <td style={{ ...tdStyle, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span style={{ fontWeight: 600 }}>{pf.mfgProduct?.factoryCode}</span>
                      {pf.mfgProduct?.name && (
                        <><span style={{ color: 'var(--text3)', margin: '0 4px' }}>—</span>{pf.mfgProduct.name}</>
                      )}
                    </td>
                    <td style={{ ...tdStyle, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {poInfo?.piCode ?? '—'}
                    </td>
                    <td style={{ ...tdStyle, whiteSpace: 'nowrap', color: 'var(--text2)' }}>
                      {poInfo?.deliveryDate ? format(new Date(poInfo.deliveryDate), 'dd/MM/yyyy') : '—'}
                    </td>
                  </tr>
                )
              })}
              {active.length === 0 && (
                <tr><td colSpan={4} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>Không có PO nào</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
