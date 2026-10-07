'use client'

/**
 * Xuất nguyên liệu vào (vd Thanh nhôm) cho Phôi gia công vật tư thành phẩm KHÔNG gắn piece
 * (MaterialYieldRecipe, vd chân nhôm, 2026-10-01) - mirror phần "Detail view" của
 * XuatVatTuThanhPhamPage.tsx (xuất TỰ DO theo định mức, không qua đề xuất/duyệt phương án) NHƯNG
 * chọn PI trước thay vì SKU/PO - vật tư này không gắn 1 SKU cụ thể nào, nhu cầu tính theo CẢ PI
 * (xem MaterialYieldRecipesService.getProductionDemand() doc comment BE).
 */

import { useState } from 'react'
import { ChevronLeft, Check } from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import type { BeProductionOrderSummary } from '../../../services/production-batches-api'
import type { BeMaterialYieldRecipeDemandItem, BeMaterialYieldRecipeIssue } from '../../../services/material-yield-recipe-production-api'
import { errMsg } from '../../../utils/errors'
import { backBtn } from '../../../styles/buttons'
import LoadingState from '../../../components/LoadingState'
import LoadErrorState from '../../../components/LoadErrorState'
import { useIsMobile } from '../../../hooks/useMediaQuery'
import MobileListCards from '../../../components/MobileListCards'
import { pageSubtitle } from '../../../styles/typography'
import { useRealtimeChangeNotice } from '../../../realtime/hooks'
import RealtimeUpdateNotice from '../../../realtime/RealtimeUpdateNotice'

const ACCENT = 'var(--fg-4527a0)'

const th: React.CSSProperties = { padding: '10px 14px', fontSize: 12, fontWeight: 600, color: 'var(--text2)', textAlign: 'left', whiteSpace: 'nowrap' }
const thR: React.CSSProperties = { ...th, textAlign: 'right' }
const td: React.CSSProperties = { padding: '9px 14px', fontSize: 13, verticalAlign: 'middle' }
const tdR: React.CSSProperties = { ...td, textAlign: 'right' }
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }

interface PiOption { productionInvoiceId: string; piCode: string }

export default function ChanNhomXuatSection() {
  const isMobile = useIsMobile()
  const { data: orders, isLoading, error, refetch } = useFetch<BeProductionOrderSummary[]>(
    () => api.listProductionOrdersForStage(), [],
  )
  const piOptions: PiOption[] = Array.from(
    new Map((orders ?? []).map(o => [o.productionInvoiceId, { productionInvoiceId: o.productionInvoiceId, piCode: o.piCode }])).values(),
  )

  const [selPi, setSelPi] = useState<PiOption | null>(null)
  const { data: demand, isLoading: demandLoading, error: demandError, refetch: refetchDemand } = useFetch<BeMaterialYieldRecipeDemandItem[]>(
    () => (selPi ? api.getMaterialYieldRecipeDemand(selPi.productionInvoiceId) : Promise.resolve([])),
    [selPi?.productionInvoiceId],
  )
  const { data: issues, refetch: refetchIssues } = useFetch<BeMaterialYieldRecipeIssue[]>(
    () => (selPi ? api.getMaterialYieldRecipeIssuesForInvoice(selPi.productionInvoiceId) : Promise.resolve([])),
    [selPi?.productionInvoiceId],
  )
  const issueChange = useRealtimeChangeNotice(['material-yield-issues'])
  const issuedByRecipe = new Map<string, number>()
  for (const i of issues ?? []) issuedByRecipe.set(i.recipeId, (issuedByRecipe.get(i.recipeId) ?? 0) + i.issuedQty)

  const items = (demand ?? []).filter(d => d.requiredOutputQty > 0)

  const [qty, setQty] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [msgs, setMsgs] = useState<Record<string, string>>({})

  const xuat = async (d: BeMaterialYieldRecipeDemandItem) => {
    const remaining = Math.max(0, d.requiredInputQty - (issuedByRecipe.get(d.recipeId) ?? 0))
    const n = Math.max(0, Math.min(remaining, Math.floor(Number(qty[d.recipeId] ?? remaining) || 0)))
    if (n <= 0 || !selPi) return
    setBusy(d.recipeId)
    setMsgs(p => ({ ...p, [d.recipeId]: '' }))
    try {
      await api.issueMaterialYieldRecipe(selPi.productionInvoiceId, { recipeId: d.recipeId, issuedQty: n })
      setQty(q => { const { [d.recipeId]: _, ...rest } = q; return rest })
      await Promise.all([refetchDemand(), refetchIssues()])
    } catch (e) {
      setMsgs(p => ({ ...p, [d.recipeId]: errMsg(e, 'Không thể xuất vật tư') }))
    } finally {
      setBusy(null)
    }
  }

  if (selPi) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <button onClick={() => setSelPi(null)} style={backBtn}>
            <ChevronLeft size={15} /> Quay lại
          </button>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, fontFamily: 'monospace' }}>{selPi.piCode}</h2>
        </div>
        <div style={{ color: 'var(--text3)', fontSize: 13, margin: '0 0 16px' }}>
          Xuất nguyên liệu vào (vd Thanh nhôm) theo nhu cầu vật tư thành phẩm của cả PI này. Bấm Xuất → Phôi xác nhận nhận ở <b>Xác nhận nhận sắt</b>.
        </div>

        {demandLoading ? <LoadingState /> : demandError ? (
          <div style={{ color: 'var(--fg-dc2626)', fontSize: 13 }}>Lỗi tải nhu cầu: {demandError}</div>
        ) : items.length === 0 ? (
          <div style={{ ...card, padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
            PI này chưa cần vật tư thành phẩm không gắn mảnh nào (vd chân nhôm).
          </div>
        ) : (
          <div style={{ ...card, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
              <thead>
                <tr style={{ background: 'var(--surface2)' }}>
                  <th style={th}>Vật tư ra</th>
                  <th style={th}>Vật tư vào</th>
                  <th style={thR}>Cần SX thêm</th>
                  <th style={thR}>Cần nguyên liệu</th>
                  <th style={thR}>Đã xuất</th>
                  <th style={{ ...th, textAlign: 'center', width: 220 }}>Xuất</th>
                </tr>
              </thead>
              <tbody>
                {items.map(d => {
                  const issued = issuedByRecipe.get(d.recipeId) ?? 0
                  const remaining = Math.max(0, d.requiredInputQty - issued)
                  const du = remaining <= 0
                  return (
                    <tr key={d.recipeId} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ ...td, fontWeight: 600 }}>
                        {d.outputMaterialName} <span style={{ color: 'var(--text3)', fontWeight: 400 }}>({d.outputMaterialCode})</span>
                      </td>
                      <td style={td}>
                        {d.inputMaterialName} <span style={{ color: 'var(--text3)' }}>({d.inputMaterialCode})</span>
                      </td>
                      <td style={tdR}>{d.shortfallOutputQty.toLocaleString('vi-VN')}</td>
                      <td style={tdR}>{d.requiredInputQty.toLocaleString('vi-VN')}</td>
                      <td style={{ ...tdR, color: 'var(--text3)' }}>{issued.toLocaleString('vi-VN')}</td>
                      <td style={{ ...td, textAlign: 'center' }}>
                        {du ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: 'var(--fg-16a34a)' }}>
                            <Check size={14} /> đã xuất đủ
                          </span>
                        ) : (
                          <div>
                            <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                              <input type="number" min={1} max={remaining}
                                value={qty[d.recipeId] ?? String(remaining)}
                                onChange={e => {
                                  const raw = e.target.value
                                  if (raw === '') { setQty(q => ({ ...q, [d.recipeId]: '' })); return }
                                  const v = Math.max(0, Math.min(remaining, Math.floor(Number(raw) || 0)))
                                  setQty(q => ({ ...q, [d.recipeId]: String(v) }))
                                }}
                                style={{ width: 70, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, textAlign: 'right', background: 'var(--surface)', color: 'var(--text)' }} />
                              <button onClick={() => xuat(d)} disabled={busy === d.recipeId}
                                style={{ padding: '5px 14px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 6, background: ACCENT, color: '#fff', cursor: busy === d.recipeId ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                                {busy === d.recipeId ? '...' : 'Xuất'}
                              </button>
                            </div>
                            {msgs[d.recipeId] && <div style={{ marginTop: 4, fontSize: 11, color: 'var(--fg-dc2626)' }}>{msgs[d.recipeId]}</div>}
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

  return (
    <div>
      <RealtimeUpdateNotice visible={issueChange.changed} onReload={() => { issueChange.clear(); void refetchDemand(); void refetchIssues() }} />
      <div style={{ ...pageSubtitle, marginBottom: 'var(--space-5)' }}>
        Chọn PI để xuất nguyên liệu vào cho vật tư thành phẩm KHÔNG gắn mảnh (vd chân nhôm).
      </div>

      {isLoading ? <LoadingState /> : error ? <LoadErrorState error={error} onRetry={refetch} /> : isMobile ? (
        <MobileListCards emptyText="Không có PI nào" items={piOptions.map(p => ({ key: p.productionInvoiceId, onClick: () => setSelPi(p), title: <b style={{ fontFamily: 'monospace' }}>{p.piCode}</b>, meta: [] }))} />
      ) : (
        <div style={card}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface2)' }}>
                <th style={th}>PI</th>
              </tr>
            </thead>
            <tbody>
              {piOptions.map(p => (
                <tr key={p.productionInvoiceId} onClick={() => setSelPi(p)} style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}>
                  <td style={{ ...td, fontFamily: 'monospace', fontWeight: 700 }}>{p.piCode}</td>
                </tr>
              ))}
              {piOptions.length === 0 && (
                <tr><td style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>Không có PI nào</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
