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
import { buildProductionOrderInfoByMfgProduct } from '../../../services/production-invoice-item'
import { errMsg } from '../../../utils/errors'
import { tableWrap, tbl, row, emptyBox, listTh as thStyle, listTd as tdStyle } from '../../../styles/table'
import LoadingState from '../../../components/LoadingState'
import type { Sku } from '../../../types/sku'

const ACCENT = '#4527A0'

export default function XuatSatPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { data: skus = [], isLoading } = useFetch(() => api.getSkus(), [])
  const { data: replenish, refetch: refetchReplenish } = useFetch<BeReplenishRequest[]>(() => api.getReplenishRequests('OPEN'), [])
  // PO/PI thật (từ ProductionOrder Sếp đã duyệt) - KHÔNG dùng Sku.exportOrder/Sku.piCode, xem
  // comment ở buildProductionOrderInfoByMfgProduct().
  const { data: poInfoByProduct } = useFetch(() => buildProductionOrderInfoByMfgProduct(), [])
  const poInfoFor = (pf: Sku) => poInfoByProduct?.get(pf.mfgProductId)

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
  // Chiều dài cây mặc định — cây sắt nguyên liệu chuẩn luôn là 6000mm (chốt 2026-08-18), vẫn sửa
  // được vì kho vật lý có thể đang có cây dài khác. Bỏ hẳn hướng lấy bestStockLengthMm từ phương
  // án cắt (getApprovedBarLengthByMaterial) — quá phức tạp so với lợi ích, số đó cũng không đại
  // diện chung cho cả PI khi 1 vật tư dùng ở nhiều sản phẩm/phương án cắt khác nhau.
  const DEFAULT_BAR_LENGTH_MM = 6000
  const suggestedBarLen = () => DEFAULT_BAR_LENGTH_MM

  // Gộp danh sách kế hoạch (1 dòng/loại sắt) theo mảnh để hiển thị gọn — mỗi mảnh 1 khối, bên
  // trong liệt kê các loại sắt của mảnh đó thay vì lặp lại tên mảnh trên từng dòng.
  const pieceGroups: { pieceId: string; pieceName: string; items: BeSteelIssuePlanItem[] }[] = []
  for (const item of plan) {
    const g = pieceGroups.find(g => g.pieceId === item.pieceId)
    if (g) g.items.push(item)
    else pieceGroups.push({ pieceId: item.pieceId, pieceName: item.pieceName, items: [item] })
  }

  const active = ((skus ?? []) as Sku[]).filter(p => p.status !== 'DRAFT')

  const [barLen, setBarLen] = useState<Record<string, string>>({})
  const [barCount, setBarCount] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [msgs, setMsgs] = useState<Record<string, string>>({})
  const { ask, confirmModal } = useConfirm()

  // Key = `${pieceId}:${materialId}` — 1 mảnh có thể dùng nhiều loại sắt, mỗi loại 1 dòng kế
  // hoạch riêng (xem SteelIssuesService.getIssuePlan, BE), nên pieceId một mình không còn là khoá
  // duy nhất trong danh sách plan/state ở đây.
  const planKey = (p: { pieceId: string; materialId: string }) => `${p.pieceId}:${p.materialId}`

  const issuedForPiece = (pieceId: string, materialId: string) =>
    history.filter(h => h.pieceId === pieceId && h.materialId === materialId).reduce((s, h) => s + h.barCount, 0)

  const handleXuat = (piece: BeSteelIssuePlanItem) => {
    const key = planKey(piece)
    const lenRaw = barLen[key] ?? suggestedBarLen().toString()
    const len = Number(lenRaw)
    const n = Number(barCount[key])
    if (!len || len <= 0) { setMsgs(p => ({ ...p, [key]: 'Nhập chiều dài cây hợp lệ' })); return }
    if (!n || n <= 0) { setMsgs(p => ({ ...p, [key]: 'Nhập số cây hợp lệ' })); return }
    ask(
      { message: `Xuất ${n} cây ${piece.materialName} (dài ${len}mm) cho Phôi?` },
      async () => {
        if (!selectedPf) return
        setBusy(key)
        setMsgs(p => ({ ...p, [key]: '' }))
        try {
          await api.issueSteel(selectedPf, { pieceId: piece.pieceId, materialId: piece.materialId, barLengthMm: len, barCount: n })
          setBarLen(p => ({ ...p, [key]: '' }))
          setBarCount(p => ({ ...p, [key]: '' }))
          await Promise.all([refetch(), refetchHistory()])
        } catch (e) {
          setMsgs(p => ({ ...p, [key]: errMsg(e, 'Không thể xuất sắt') }))
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
              PO: {poInfoFor(selectedPf)?.poCode ?? 'Chưa gắn đơn hàng'}
              {poInfoFor(selectedPf)?.piCode && <> · PI: {poInfoFor(selectedPf)!.piCode}</>}
            </div>
          </div>
        </div>

        {planLoading ? <LoadingState /> : plan.length === 0 ? (
          <div style={emptyBox}>
            {poInfoFor(selectedPf)
              ? 'SKU này đã có lệnh sản xuất (PO/PI ở trên) nhưng chưa khai định mức mảnh sắt (BOM) — báo KHSX bổ sung mảnh sắt cho sản phẩm này trước khi xuất được.'
              : 'SKU này chưa được Sếp duyệt lệnh sản xuất — chưa có gì để xuất sắt.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {pieceGroups.map(g => (
              <div key={g.pieceId} style={tableWrap}>
                <div style={{ padding: '10px 14px', fontWeight: 700, fontSize: 14, borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
                  {g.pieceName}
                  <span style={{ fontWeight: 400, color: 'var(--text3)', fontSize: 12, marginLeft: 8 }}>{g.items.length} loại sắt</span>
                </div>
                <table style={{ ...tbl, tableLayout: 'auto' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                      <th style={thStyle}>Vật tư</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Cần</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Đã xuất</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Còn được xuất</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Tồn kho</th>
                      <th style={{ ...thStyle, textAlign: 'center', width: 240 }}>Xuất</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.items.map(piece => {
                      const key = planKey(piece)
                      const suggested = suggestedBarLen()
                      return (
                        <tr key={key} style={row}>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>{piece.materialName}</td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>{piece.requiredSegments}</td>
                          <td style={{ ...tdStyle, textAlign: 'right', color: piece.issuedBarCount > 0 ? ACCENT : 'var(--text2)' }}>
                            {issuedForPiece(piece.pieceId, piece.materialId)}
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'right', color: piece.remainingToIssue != null && piece.remainingToIssue <= 0 ? '#dc2626' : 'var(--text2)' }}>
                            {piece.remainingToIssue ?? '—'}
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>{piece.physicalStockQty ?? '—'}</td>
                          <td style={{ ...tdStyle, textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                              <input
                                type="number" min={1} placeholder="dài (mm)"
                                title={`Mặc định cây chuẩn ${suggested}mm — sửa lại nếu kho đang có cây dài khác`}
                                value={barLen[key] ?? String(suggested)}
                                onChange={e => setBarLen(p => ({ ...p, [key]: e.target.value }))}
                                style={{ width: 80, padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, textAlign: 'right', background: 'var(--surface)', color: 'var(--text)' }}
                              />
                              <input
                                type="number" min={1} placeholder="SL cây"
                                value={barCount[key] ?? ''}
                                onChange={e => setBarCount(p => ({ ...p, [key]: e.target.value }))}
                                style={{ width: 64, padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, textAlign: 'right', background: 'var(--surface)', color: 'var(--text)' }}
                              />
                              <button
                                onClick={() => handleXuat(piece)}
                                disabled={busy === key}
                                style={{ padding: '5px 14px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 6, background: ACCENT, color: '#fff', cursor: busy === key ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
                              >
                                {busy === key ? '...' : 'Xuất'}
                              </button>
                            </div>
                            {msgs[key] && <div style={{ marginTop: 4, fontSize: 11, color: '#dc2626' }}>{msgs[key]}</div>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                {history.some(h => h.pieceId === g.pieceId) && (
                  <table style={{ ...tbl, tableLayout: 'auto', borderTop: '1px solid var(--border)' }}>
                    <thead>
                      <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                        <th style={thStyle}>Thời gian</th>
                        <th style={thStyle}>Vật tư</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Dài (mm)</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Số cây</th>
                        <th style={thStyle}>Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.filter(h => h.pieceId === g.pieceId).map(h => (
                        <tr key={h.id} style={row}>
                          <td style={tdStyle}>{new Date(h.issuedAt).toLocaleString('vi-VN')}</td>
                          <td style={tdStyle}>{g.items.find(it => it.materialId === h.materialId)?.materialName ?? h.materialId}</td>
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
              <col style={{ width: 110 }} />
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                <th style={thStyle}>PO</th>
                <th style={thStyle}>SKU</th>
                <th style={thStyle}>PI</th>
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
                  </tr>
                )
              })}
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
