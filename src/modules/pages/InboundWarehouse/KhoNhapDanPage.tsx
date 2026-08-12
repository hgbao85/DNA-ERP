'use client'
import { useEffect, useRef, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { format } from 'date-fns'
import { useFetch } from '../../../hooks/useFetch'
import { useConfirm } from '../../../hooks/useConfirm'
import * as api from '../../../services/api'
import type { BeWeavingIssuePlanItem } from '../../../services/weaving-issues-api'
import { errMsg } from '../../../utils/errors'
import { tableWrap, tbl, row, emptyBox, listTh as thStyle, listTd as tdStyle } from '../../../styles/table'
import LoadingState from '../../../components/LoadingState'
import type { Sku } from '../../../types/sku'

/**
 * Nhập đan = kho thành phẩm nhận mảnh đã đan từ điểm đan gia công bên ngoài. Mỗi dòng ứng với 1
 * (mảnh, điểm đan) — 1 loại mảnh có thể được xuất cho nhiều điểm đan khác nhau, kho thành phẩm cần
 * biết chính xác đang nhận về từ điểm đan nào để xác nhận đúng phần đó. Số lượng nhận cap theo
 * remainingToReceive TỪNG điểm đan riêng (BE không cộng dồn qua các điểm khác - xem
 * WeavingIssuesService.receive). Đồng bộ trực tiếp với "Theo dõi xuất đan" (KhoXuatDanPage).
 */
export default function KhoNhapDanPage({ readOnly = false, filterExportOrderId }: { readOnly?: boolean; filterExportOrderId?: number } = {}) {
  const { data: skus = [], isLoading } = useFetch(() => api.getSkus(), [])

  const [selectedPf, setSelectedPf] = useState<Sku | null>(null)
  const { data: planData, isLoading: planLoading, refetch } = useFetch<BeWeavingIssuePlanItem[]>(
    () => (selectedPf ? api.getWeavingIssuePlan(selectedPf) : Promise.resolve([])),
    [selectedPf?.id],
  )
  const plan = (planData ?? []).filter(piece => piece.allocations.length > 0)

  const active = ((skus ?? []) as Sku[]).filter(p => p.status !== 'DRAFT' && (filterExportOrderId === undefined || p.exportOrderId === filterExportOrderId))

  const autoSelectedRef = useRef(false)
  useEffect(() => {
    if (!autoSelectedRef.current && filterExportOrderId !== undefined && active.length > 0) {
      setSelectedPf(active[0])
      autoSelectedRef.current = true
    }
  }, [active, filterExportOrderId])

  const [qty, setQty]   = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [msgs, setMsgs] = useState<Record<string, string>>({})
  const { ask, confirmModal } = useConfirm()

  const rowKey = (pieceId: string, weavingPointId: string) => `${pieceId}::${weavingPointId}`

  const handleNhap = (piece: BeWeavingIssuePlanItem, weavingPointId: string, weavingPointLabel: string, max: number) => {
    const key = rowKey(piece.pieceId, weavingPointId)
    const q = Number(qty[key])
    if (!q || q <= 0 || q > max) { setMsgs(p => ({ ...p, [key]: 'Số lượng không hợp lệ (không được vượt quá còn phải nhận)' })); return }
    ask(
      { message: `Xác nhận đã nhận ${q} "${piece.pieceName}" từ ${weavingPointLabel}? Tồn kho thành phẩm sẽ được cộng ngay.` },
      async () => {
        if (!selectedPf) return
        setBusy(key)
        setMsgs(p => ({ ...p, [key]: '' }))
        try {
          await api.receiveWeaving(selectedPf, { pieceId: piece.pieceId, weavingPointId, qty: q })
          setQty(p => ({ ...p, [key]: '' }))
          await refetch()
        } catch (e) {
          setMsgs(p => ({ ...p, [key]: errMsg(e, 'Không thể xác nhận nhập đan') }))
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
          <div style={emptyBox}>Chưa có mảnh nào được xuất đan cho SKU này</div>
        ) : (
          <div style={tableWrap}>
            <table style={{ ...tbl, tableLayout: 'auto' }}>
              <thead>
                <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                  <th style={thStyle}>Mảnh</th>
                  <th style={thStyle}>Điểm đan</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Đã xuất</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Đã nhận</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Còn phải nhận</th>
                  {!readOnly && <th style={thStyle}>Nhận</th>}
                </tr>
              </thead>
              <tbody>
                {plan.flatMap(piece => piece.allocations.map(a => {
                  const key = rowKey(piece.pieceId, a.weavingPointId)
                  const label = a.weavingPointName ?? a.weavingPointCode
                  const done = a.remainingToReceive <= 0
                  return (
                    <tr key={key} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ ...tdStyle, fontWeight: 500 }}>{piece.pieceName}</td>
                      <td style={{ ...tdStyle, color: 'var(--text3)' }}>{label}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: '#d97706' }}>{a.issuedQty}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: done ? '#16a34a' : 'var(--text)' }}>{a.receivedQty}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: done ? 'var(--text3)' : '#d97706' }}>{a.remainingToReceive}</td>
                      {!readOnly && (
                        <td style={tdStyle}>
                          {done ? (
                            <span style={{ fontSize: 12, color: 'var(--text3)' }}>Đã nhận đủ</span>
                          ) : (
                            <div>
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <input
                                  type="number" min={1} max={a.remainingToReceive}
                                  value={qty[key] ?? ''}
                                  onChange={e => setQty(p => ({ ...p, [key]: e.target.value }))}
                                  placeholder="SL"
                                  style={{ width: 60, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, textAlign: 'right', background: 'var(--surface)', color: 'var(--text)' }}
                                />
                                <button
                                  onClick={() => handleNhap(piece, a.weavingPointId, label, a.remainingToReceive)}
                                  disabled={busy === key}
                                  style={{ padding: '4px 12px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 6, background: '#16a34a', color: '#fff', cursor: busy === key ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
                                >
                                  {busy === key ? '...' : 'Nhận'}
                                </button>
                              </div>
                              {msgs[key] && <div style={{ marginTop: 4, fontSize: 11, color: '#dc2626' }}>{msgs[key]}</div>}
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                }))}
              </tbody>
            </table>
          </div>
        )}
        {!readOnly && confirmModal}
      </div>
    )
  }

  // ── List view ─────────────────────────────────────────────────────────────────
  return (
    <div>
      <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700 }}>Theo dõi nhập đan</h2>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text3)' }}>
        Nhấn vào dòng để xem chi tiết và xác nhận nhận hàng đan từ điểm đan
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
