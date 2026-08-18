'use client'

/**
 * Xuất sắt cho Phôi (kho Phôi Sơn Hàn) — mục sidebar dưới "Xuất kho".
 *
 * Đã nối BE thật (M3, 2026-08-12 — "Xuất sắt Phôi", trước đó bị hoãn): module `steel-issues`,
 * thay `phoi-sat.service.ts` mock. Master-detail theo SKU/PO — cùng pattern KhoXuatDanPage
 * (WAREHOUSE_STAFF có SKU:VIEW + PRODUCTION_ORDER:VIEW để tự resolve productionOrderId).
 *
 * Khác mock cũ: bỏ hẳn "kế hoạch xuất sắt" tự tính sẵn số cây mục tiêu (planCay) và highlight
 * "chưa đồng bộ" — không có gì tương ứng ở BE (solver chỉ tính tổng cây/vật tư cho CẢ PO, không
 * chia sẵn theo từng mảnh). Thay vào đó hiện "Σ đoạn cần theo BOM" (steel-issue-plan) làm tham
 * chiếu, thủ kho tự quyết định xuất bao nhiêu cây/chiều dài dựa trên đó — cùng cách đơn giản hoá
 * đã áp cho Sản lượng Hàn/Sơn (bỏ "thanh sắt cấu thành"/"làm tuần tự", xem roadmap M3).
 */

import { useState } from 'react'
import { ArrowUpFromLine, ChevronLeft, PackagePlus, Check } from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import { useConfirm } from '../../../hooks/useConfirm'
import * as api from '../../../services/api'
import type { BeSteelIssuePlanItem, BeSteelIssue, BeReplenishRequest } from '../../../services/steel-issues-api'
import { errMsg } from '../../../utils/errors'
import { tableWrap, tbl, row, emptyBox, listTh as thStyle, listTd as tdStyle } from '../../../styles/table'
import LoadingState from '../../../components/LoadingState'
import type { Sku } from '../../../types/sku'

const ACCENT = '#4527A0'

export default function XuatSatPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { data: skus = [], isLoading } = useFetch(() => api.getSkus(), [])
  const { data: replenish, refetch: refetchReplenish } = useFetch<BeReplenishRequest[]>(() => api.getReplenishRequests('OPEN'), [])

  const [selectedPf, setSelectedPf] = useState<Sku | null>(null)
  const { data: planData, isLoading: planLoading, refetch } = useFetch<BeSteelIssuePlanItem[]>(
    () => (selectedPf ? api.getSteelIssuePlan(selectedPf) : Promise.resolve([])),
    [selectedPf?.id],
  )
  const plan = planData ?? []
  const { data: historyData, refetch: refetchHistory } = useFetch<BeSteelIssue[]>(
    () => (selectedPf ? api.getSteelIssuesForSku(selectedPf) : Promise.resolve([])),
    [selectedPf?.id],
  )
  const history = historyData ?? []

  const active = ((skus ?? []) as Sku[]).filter(p => p.status !== 'DRAFT')

  const [barLen, setBarLen] = useState<Record<string, string>>({})
  const [barCount, setBarCount] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [msgs, setMsgs] = useState<Record<string, string>>({})
  const { ask, confirmModal } = useConfirm()

  const issuedForPiece = (pieceId: string) =>
    history.filter(h => h.pieceId === pieceId).reduce((s, h) => s + h.barCount, 0)

  const handleXuat = (piece: BeSteelIssuePlanItem) => {
    const len = Number(barLen[piece.pieceId])
    const n = Number(barCount[piece.pieceId])
    if (!len || len <= 0) { setMsgs(p => ({ ...p, [piece.pieceId]: 'Nhập chiều dài cây hợp lệ' })); return }
    if (!n || n <= 0) { setMsgs(p => ({ ...p, [piece.pieceId]: 'Nhập số cây hợp lệ' })); return }
    ask(
      { message: `Xuất ${n} cây ${piece.materialName} (dài ${len}mm) cho Phôi?` },
      async () => {
        if (!selectedPf) return
        setBusy(piece.pieceId)
        setMsgs(p => ({ ...p, [piece.pieceId]: '' }))
        try {
          await api.issueSteel(selectedPf, { pieceId: piece.pieceId, barLengthMm: len, barCount: n })
          setBarLen(p => ({ ...p, [piece.pieceId]: '' }))
          setBarCount(p => ({ ...p, [piece.pieceId]: '' }))
          await Promise.all([refetch(), refetchHistory()])
        } catch (e) {
          setMsgs(p => ({ ...p, [piece.pieceId]: errMsg(e, 'Không thể xuất sắt') }))
        } finally {
          setBusy(null)
        }
      }
    )
  }

  const doCapLai = async (r: BeReplenishRequest) => {
    setMsgs(p => ({ ...p, [`cap-${r.id}`]: '' }))
    // Cấp bù = tạo 1 đợt xuất mới (issueSteel) rồi liên kết vào request — cần biết đúng
    // pieceId/materialId/barLengthMm của đợt gốc, tra qua qc-review→steelIssue (không lộ trực
    // tiếp ở ReplenishRequest) nên yêu cầu chọn lại PO/mảnh thủ công thay vì tự động hoá 1 click
    // như mock cũ — đơn giản hoá vì BE tách hẳn "tạo đợt" và "fulfill" thành 2 bước độc lập.
    setMsgs(p => ({ ...p, [`cap-${r.id}`]: 'Chọn PO/mảnh tương ứng ở bảng trên, xuất 1 đợt mới rồi bấm "Gắn vào đề xuất" bên dưới.' }))
  }

  const doFulfill = async (r: BeReplenishRequest, steelIssueId: string) => {
    try {
      await api.fulfillReplenishRequest(r.id, steelIssueId)
      await refetchReplenish()
    } catch (e) {
      setMsgs(p => ({ ...p, [`cap-${r.id}`]: errMsg(e, 'Không cấp bù được') }))
    }
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
          <div style={emptyBox}>Chưa có mảnh nào cần xuất sắt (SKU chưa được Sếp duyệt lệnh sản xuất, hoặc chưa có phương án cắt sắt đã duyệt)</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {plan.map(piece => (
              <div key={piece.pieceId} style={tableWrap}>
                <div style={{ padding: '12px 14px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
                  <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                    <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {piece.pieceName} <span style={{ fontWeight: 400, color: 'var(--text3)' }}>— {piece.materialName}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                      Σ đoạn cần (BOM) <b style={{ color: 'var(--text2)' }}>{piece.requiredSegments}</b> · Đã xuất <b style={{ color: piece.issuedBarCount > 0 ? ACCENT : 'var(--text2)' }}>{issuedForPiece(piece.pieceId)}</b> cây
                      {piece.remainingToIssue != null && (
                        <> · Còn được xuất <b style={{ color: piece.remainingToIssue > 0 ? 'var(--text2)' : '#dc2626' }}>{piece.remainingToIssue}</b> cây</>
                      )}
                      {piece.physicalStockQty != null && (
                        <> · Tồn kho <b style={{ color: 'var(--text2)' }}>{piece.physicalStockQty}</b> cây</>
                      )}
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input
                        type="number" min={1} placeholder="dài (mm)"
                        value={barLen[piece.pieceId] ?? ''}
                        onChange={e => setBarLen(p => ({ ...p, [piece.pieceId]: e.target.value }))}
                        style={{ width: 90, padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, textAlign: 'right', background: 'var(--surface)', color: 'var(--text)' }}
                      />
                      <input
                        type="number" min={1} placeholder="SL cây"
                        value={barCount[piece.pieceId] ?? ''}
                        onChange={e => setBarCount(p => ({ ...p, [piece.pieceId]: e.target.value }))}
                        style={{ width: 70, padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, textAlign: 'right', background: 'var(--surface)', color: 'var(--text)' }}
                      />
                      <button
                        onClick={() => handleXuat(piece)}
                        disabled={busy === piece.pieceId}
                        style={{ padding: '5px 14px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 6, background: ACCENT, color: '#fff', cursor: busy === piece.pieceId ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
                      >
                        {busy === piece.pieceId ? '...' : 'Xuất'}
                      </button>
                    </div>
                    {msgs[piece.pieceId] && <div style={{ marginTop: 4, fontSize: 11, color: '#dc2626' }}>{msgs[piece.pieceId]}</div>}
                  </div>
                </div>

                {history.some(h => h.pieceId === piece.pieceId) && (
                  <table style={{ ...tbl, tableLayout: 'auto' }}>
                    <thead>
                      <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                        <th style={thStyle}>Thời gian</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Dài (mm)</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Số cây</th>
                        <th style={thStyle}>Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.filter(h => h.pieceId === piece.pieceId).map(h => (
                        <tr key={h.id} style={row}>
                          <td style={tdStyle}>{new Date(h.issuedAt).toLocaleString('vi-VN')}</td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>{h.barLengthMm.toLocaleString('vi-VN')}</td>
                          <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{h.barCount}</td>
                          <td style={tdStyle}>{statusLabel(h.status)}</td>
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
      {!embedded && (
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <ArrowUpFromLine size={20} /> Xuất sắt cho Phôi
        </h2>
      )}
      <p style={{ margin: '4px 0 16px', fontSize: 13, color: 'var(--text3)' }}>
        Nhấn vào dòng để xem mảnh cần xuất sắt (theo phương án cắt sắt đã duyệt) và xuất theo chiều dài/số cây.
      </p>

      {replenish && replenish.length > 0 && (
        <div style={{ border: '1px solid #fca5a5', borderRadius: 12, background: 'var(--red-bg, #fef2f2)', padding: '10px 14px', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#b91c1c', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
            <PackagePlus size={16} /> Cần cấp lại — KCS chấm phế ({replenish.reduce((s, c) => s + c.qty, 0)} cây)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {replenish.map(r => (
              <ReplenishRow key={r.id} r={r} msg={msgs[`cap-${r.id}`]} onCapLai={() => doCapLai(r)} onFulfill={steelIssueId => doFulfill(r, steelIssueId)} />
            ))}
          </div>
        </div>
      )}

      {isLoading ? <LoadingState /> : (
        <div style={tableWrap}>
          <table style={tbl}>
            <colgroup>
              <col style={{ width: 130 }} />
              <col />
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                <th style={thStyle}>PO</th>
                <th style={thStyle}>SKU</th>
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
                </tr>
              ))}
              {active.length === 0 && (
                <tr><td colSpan={2} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>Không có PO nào</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function statusLabel(status: BeSteelIssue['status']) {
  if (status === 'ISSUED') return <span style={{ color: 'var(--text3)' }}>Chờ Phôi nhận</span>
  if (status === 'RECEIVED') return <span style={{ color: '#d97706' }}>Đang cắt</span>
  if (status === 'AWAITING_QC') return <span style={{ color: '#d97706' }}>Chờ KCS duyệt</span>
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#16a34a', fontWeight: 600 }}><Check size={12} /> KCS đạt</span>
}

/** 1 dòng đề xuất cấp lại — nhập id đợt (SteelIssue) vừa xuất bù để gắn vào request. Đơn giản
 *  hoá so với mock cũ (1 click) vì BE tách "tạo đợt" và "fulfill" thành 2 bước độc lập, xem
 *  QcReviewsService.fulfillReplenishRequest (BE). */
function ReplenishRow({ r, msg, onCapLai, onFulfill }: {
  r: BeReplenishRequest; msg?: string; onCapLai: () => void; onFulfill: (steelIssueId: string) => void
}) {
  const [issueId, setIssueId] = useState('')
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '7px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}>
      <span style={{ flex: 1, minWidth: 200 }}>
        <b style={{ color: '#c62828' }}>{r.qty} cây phế</b> · đề xuất #{r.id}
      </span>
      <button onClick={onCapLai} style={{ padding: '4px 10px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface2)', color: 'var(--text2)', cursor: 'pointer' }}>Hướng dẫn</button>
      <input value={issueId} onChange={e => setIssueId(e.target.value)} placeholder="id đợt đã xuất bù"
        style={{ width: 140, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, background: 'var(--surface)', color: 'var(--text)' }} />
      <button onClick={() => issueId && onFulfill(issueId)} disabled={!issueId}
        style={{ padding: '5px 14px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 6, background: ACCENT, color: '#fff', cursor: issueId ? 'pointer' : 'not-allowed' }}>
        Gắn vào đề xuất
      </button>
      {msg && <div style={{ width: '100%', fontSize: 11, color: 'var(--text3)' }}>{msg}</div>}
    </div>
  )
}
