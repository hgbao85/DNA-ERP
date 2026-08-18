'use client'

/**
 * Xuất vật tư TIÊU HAO cho 1 tổ (Hàn / Sơn) — dùng chung cho 2 subtab của "Phân phối nội bộ".
 * Khác "Xuất sắt cho Phôi": đây là vật tư phụ (khí CO₂, dây hàn / bột sơn, dung môi…), KHÔNG phải
 * WIP — BE (module material-issues) CÓ ghi StockLedger MATERIAL_ISSUE ngay khi xuất (khác
 * weaving-issues/steel-issues: vật tư tiêu hao chưa bị trừ tồn ở bước nào trước đó).
 * BE chỉ có material-issue-plan THEO 1 productionOrderId (không có "toàn bộ PO cần gì" gộp sẵn)
 * nên phải chọn SKU/PO trước — cùng pattern master-detail với KhoXuatDanPage/KhoNhapDanPage.
 * Bấm "Xuất" → tạo đợt ISSUED → hiện ngay bên "Xác nhận sản lượng" của tổ (XacNhanVatTuPage) để
 * họ xác nhận đã nhận.
 */

import { useState } from 'react'
import { ChevronLeft, Check } from 'lucide-react'
import { format } from 'date-fns'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import type { BeMaterialIssuePlanItem, MaterialIssueStage } from '../../../services/material-issues-api'
import { buildProductionOrderInfoByMfgProduct } from '../../../services/production-invoice-item'
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

export default function XuatVatTuTieuHaoPage({ stage, desc }: { stage: MaterialIssueStage; desc: string }) {
  const { data: skus = [], isLoading } = useFetch(() => api.getSkus(), [])
  const active = ((skus ?? []) as Sku[]).filter(p => p.status !== 'DRAFT')
  // PO/PI/hạn giao thật (từ ProductionOrder Sếp đã duyệt) - KHÔNG dùng Sku.exportOrder/Sku.piCode,
  // xem comment ở buildProductionOrderInfoByMfgProduct().
  const { data: poInfoByProduct } = useFetch(() => buildProductionOrderInfoByMfgProduct(), [])
  const poInfoFor = (pf: Sku) => poInfoByProduct?.get(pf.mfgProductId)

  const [selectedPf, setSelectedPf] = useState<Sku | null>(null)
  const { data: planData, isLoading: planLoading, refetch } = useFetch<BeMaterialIssuePlanItem[]>(
    () => (selectedPf ? api.getMaterialIssuePlan(selectedPf, stage) : Promise.resolve([])),
    [selectedPf?.id, stage],
  )
  const plan = planData ?? []

  const [qty, setQty] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [msgs, setMsgs] = useState<Record<string, string>>({})

  const clampN = (d: BeMaterialIssuePlanItem) =>
    Math.max(0, Math.min(d.remainingToIssue, Math.floor(Number(qty[d.materialId] ?? d.remainingToIssue) || 0)))

  const xuat = async (d: BeMaterialIssuePlanItem) => {
    const n = clampN(d)
    if (n <= 0 || !selectedPf) return
    setBusy(d.materialId)
    setMsgs(p => ({ ...p, [d.materialId]: '' }))
    try {
      await api.issueMaterial(selectedPf, { stage, materialId: d.materialId, issuedQty: n })
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
        <div style={{ color: 'var(--text3)', fontSize: 13, margin: '0 0 16px' }}>{desc}</div>

        {planLoading ? <LoadingState /> : plan.length === 0 ? (
          <div style={emptyBox}>
            {poInfoFor(selectedPf)
              ? 'SKU này đã có lệnh sản xuất (PO/PI ở trên) nhưng BOM chưa khai định mức vật tư tiêu hao — báo KHSX bổ sung định mức cho sản phẩm này trước khi xuất được.'
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
      <div style={{ color: 'var(--text3)', fontSize: 13, margin: '4px 0 16px' }}>{desc}</div>

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
