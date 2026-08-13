'use client'
import { useEffect, useRef, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { format } from 'date-fns'
import { useFetch } from '../../../hooks/useFetch'
import { useConfirm } from '../../../hooks/useConfirm'
import * as api from '../../../services/api'
import type { BeWeavingIssuePlanItem } from '../../../services/weaving-issues-api'
import type { BeWeavingPoint } from '../../../services/weaving-points-api'
import { errMsg } from '../../../utils/errors'
import { tableWrap, tbl, row, emptyBox, listTh as thStyle, listTd as tdStyle } from '../../../styles/table'
import LoadingState from '../../../components/LoadingState'
import type { Sku } from '../../../types/sku'

/**
 * Xuất đan = xuất mảnh chưa đan (của 1 SKU, tại kho vật tư thành phẩm) cho điểm đan gia công bên
 * ngoài — bắt buộc chọn điểm đan vì 1 loại mảnh có thể xuất cho nhiều điểm đan khác nhau. Số lượng
 * xuất không được vượt quá remainingToIssue (BE tự cộng dồn theo mọi điểm đan đã xuất trước đó -
 * xem WeavingIssuesService.create). Đồng bộ trực tiếp với "Theo dõi nhập đan" (KhoNhapDanPage) -
 * cùng đọc/ghi WeavingIssue/WeavingReceipt qua weaving-issues-api.ts, không phải 2 nguồn độc lập.
 */
export default function KhoXuatDanPage({ readOnly = false, filterExportOrderId }: { readOnly?: boolean; filterExportOrderId?: string } = {}) {
  const { data: skus = [], isLoading } = useFetch(() => api.getSkus(), [])
  const { data: pointsData } = useFetch<BeWeavingPoint[]>(() => api.getWeavingPoints(), [])
  const points = pointsData ?? []
  const pointLabel = (id: string) => {
    const p = points.find(w => String(w.id) === id)
    return p?.fullName ?? p?.code ?? `#${id}`
  }

  const [selectedPf, setSelectedPf] = useState<Sku | null>(null)
  const { data: planData, isLoading: planLoading, refetch } = useFetch<BeWeavingIssuePlanItem[]>(
    () => (selectedPf ? api.getWeavingIssuePlan(selectedPf) : Promise.resolve([])),
    [selectedPf?.id],
  )
  const plan = planData ?? []

  const active = ((skus ?? []) as Sku[]).filter(p => p.status !== 'DRAFT' && (filterExportOrderId === undefined || p.exportOrderId === filterExportOrderId))

  const autoSelectedRef = useRef(false)
  useEffect(() => {
    if (!autoSelectedRef.current && filterExportOrderId !== undefined && active.length > 0) {
      setSelectedPf(active[0])
      autoSelectedRef.current = true
    }
  }, [active, filterExportOrderId])

  const [qty, setQty]         = useState<Record<string, string>>({})
  const [pointId, setPointId] = useState<Record<string, string>>({})
  const [busy, setBusy]       = useState<string | null>(null)
  const [msgs, setMsgs]       = useState<Record<string, string>>({})
  const { ask, confirmModal } = useConfirm()

  const handleXuat = (piece: BeWeavingIssuePlanItem) => {
    const q   = Number(qty[piece.pieceId])
    const pid = pointId[piece.pieceId]
    if (!q || q <= 0 || q > piece.remainingToIssue) { setMsgs(p => ({ ...p, [piece.pieceId]: 'Số lượng không hợp lệ (không được vượt quá còn phải xuất)' })); return }
    if (!pid) { setMsgs(p => ({ ...p, [piece.pieceId]: 'Chọn điểm đan' })); return }
    ask(
      { message: `Xuất đan ${q} "${piece.pieceName}" cho ${pointLabel(pid)}?` },
      async () => {
        if (!selectedPf) return
        setBusy(piece.pieceId)
        setMsgs(p => ({ ...p, [piece.pieceId]: '' }))
        try {
          await api.issueWeaving(selectedPf, { pieceId: piece.pieceId, weavingPointId: pid, qty: q })
          setQty(p => ({ ...p, [piece.pieceId]: '' }))
          await refetch()
        } catch (e) {
          setMsgs(p => ({ ...p, [piece.pieceId]: errMsg(e, 'Không thể xuất đan') }))
        } finally {
          setBusy(null)
        }
      }
    )
  }

  // ── Detail view ───────────────────────────────────────────────────────────────
  if (selectedPf) {
    return (
      <div>
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
            </div>
          </div>
        </div>

        {planLoading ? <LoadingState /> : plan.length === 0 ? (
          <div style={emptyBox}>Chưa có mảnh nào để xuất đan (SKU chưa được Sếp duyệt lệnh sản xuất)</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {plan.map(piece => (
              <div key={piece.pieceId} style={tableWrap}>
                <div style={{ padding: '12px 14px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16, borderBottom: piece.allocations.length > 0 ? '1px solid var(--border)' : undefined }}>
                  <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                    <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{piece.pieceName}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                      Cần {piece.totalQty} · Đã xuất {piece.issuedQty} · Còn phải xuất <b style={{ color: piece.remainingToIssue > 0 ? '#d97706' : '#16a34a' }}>{piece.remainingToIssue}</b>
                    </div>
                  </div>

                  {!readOnly && (
                    piece.remainingToIssue <= 0 ? (
                      <span style={{ fontSize: 12, color: 'var(--text3)' }}>Đã xuất đủ</span>
                    ) : (
                      <div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <select
                            value={pointId[piece.pieceId] ?? ''}
                            onChange={e => setPointId(p => ({ ...p, [piece.pieceId]: e.target.value }))}
                            style={{ padding: '5px 6px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, background: 'var(--surface)', color: 'var(--text)', maxWidth: 140 }}
                          >
                            <option value="">— điểm đan —</option>
                            {points.map(w => <option key={w.id} value={String(w.id)}>{w.fullName ?? w.code}</option>)}
                          </select>
                          <input
                            type="number" min={1} max={piece.remainingToIssue}
                            value={qty[piece.pieceId] ?? ''}
                            onChange={e => setQty(p => ({ ...p, [piece.pieceId]: e.target.value }))}
                            placeholder="SL"
                            style={{ width: 60, padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, textAlign: 'right', background: 'var(--surface)', color: 'var(--text)' }}
                          />
                          <button
                            onClick={() => handleXuat(piece)}
                            disabled={busy === piece.pieceId}
                            style={{ padding: '5px 14px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 6, background: '#d97706', color: '#fff', cursor: busy === piece.pieceId ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
                          >
                            {busy === piece.pieceId ? '...' : 'Xuất'}
                          </button>
                        </div>
                        {msgs[piece.pieceId] && <div style={{ marginTop: 4, fontSize: 11, color: '#dc2626' }}>{msgs[piece.pieceId]}</div>}
                      </div>
                    )
                  )}
                </div>

                {piece.allocations.length > 0 && (
                  <table style={{ ...tbl, tableLayout: 'auto' }}>
                    <thead>
                      <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                        <th style={thStyle}>Điểm đan</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Đã xuất</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Đã nhận</th>
                      </tr>
                    </thead>
                    <tbody>
                      {piece.allocations.map(a => (
                        <tr key={a.weavingPointId} style={row}>
                          <td style={tdStyle}>{a.weavingPointName ?? a.weavingPointCode}</td>
                          <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{a.issuedQty}</td>
                          <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--text2)' }}>{a.receivedQty}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        )}
        {confirmModal}
      </div>
    )
  }

  // ── List view ─────────────────────────────────────────────────────────────────
  return (
    <div>
      <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700 }}>Theo dõi xuất đan</h2>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text3)' }}>
        Nhấn vào dòng để xuất mảnh cho điểm đan gia công bên ngoài
      </p>

      {isLoading ? <LoadingState /> : (
        <div style={tableWrap}>
          <table style={tbl}>
            <colgroup>
              <col style={{ width: 130 }} />
              <col />
              <col style={{ width: 130 }} />
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                <th style={thStyle}>PO</th>
                <th style={thStyle}>SKU</th>
                <th style={thStyle}>Hạn giao</th>
              </tr>
            </thead>
            <tbody>
              {active.map(pf => (
                <tr key={pf.id} onClick={() => setSelectedPf(pf)} style={row}>
                  <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {pf.exportOrder?.poNumber ?? 'Chưa gắn đơn hàng'}
                  </td>
                  <td style={{ ...tdStyle, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ fontWeight: 600 }}>{pf.mfgProduct?.factoryCode}</span>
                    {pf.mfgProduct?.name && (
                      <><span style={{ color: 'var(--text3)', margin: '0 4px' }}>—</span>{pf.mfgProduct.name}</>
                    )}
                  </td>
                  <td style={{ ...tdStyle, whiteSpace: 'nowrap', color: 'var(--text2)' }}>
                    {pf.exportOrder?.deliveryDate
                      ? format(new Date(pf.exportOrder.deliveryDate), 'dd/MM/yyyy')
                      : '—'}
                  </td>
                </tr>
              ))}
              {active.length === 0 && (
                <tr><td colSpan={3} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>Không có PO nào</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
