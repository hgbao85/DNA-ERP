'use client'
import MaterialChoiceTags from '../../../components/MaterialChoiceTags'
import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, Printer } from 'lucide-react'
import { format } from 'date-fns'
import { useFetch } from '../../../hooks/useFetch'
import { useConfirm } from '../../../hooks/useConfirm'
import * as api from '../../../services/api'
import type { BeWeavingIssuePlanItem } from '../../../services/weaving-issues-api'
import type { BeWeavingPoint } from '../../../services/weaving-points-api'
import { createIssueSlip, type IssueSlip } from '../../../services/issue-slips-api'
import { usePoInfoFloorGate } from '../../../hooks/usePoInfoFloorGate'
import { productionOrderRowKey, resolveProductionOrderId } from '../../../services/production-invoice-item'
import { errMsg } from '../../../utils/errors'
import { tableWrap, tbl, row, emptyBox, listTh as thStyle, listTd as tdStyle, tableScrollBox, stickyHeaderRow } from '../../../styles/table'
import LoadingState from '../../../components/LoadingState'
import LoadErrorState from '../../../components/LoadErrorState'
import { pageTitle, pageSubtitle } from '../../../styles/typography'
import type { Sku } from '../../../types/sku'
import { useIsMobile } from '../../../hooks/useMediaQuery'
import MobileListCards from '../../../components/MobileListCards'
import { useRealtimeRefetch } from '../../../realtime/hooks'
import LenhCode from '../../../components/LenhCode'
import { useAuth } from '../../../context/AuthContext'
import { fixedWarehouseName } from '../../../utils/warehouseKinds'
import { printIssueSlip } from './printIssueSlip'

/**
 * Xuất đan - PHIẾU 1 (anh Nhân 09/11/2026): mảnh đã xong công đoạn cuối xuất THẲNG từ kho đang giữ mảnh (kho Sơn; mảnh chỉ hàn ở
 * kho Hàn) ra điểm đan, không còn đi qua kho Phụ kiện. Thủ kho chọn điểm đan, nhập số mảnh rồi "Lập phiếu xuất mảnh" - hệ thống
 * cấp số XK, CHƯA trừ tồn; in phiếu, điểm đan ký, tải ảnh ở tab "Phiếu xuất" rồi mới trừ.
 *
 * Dây, gỗ, đinh, nút KHÔNG nhập ở đây: hệ thống báo kho Phụ kiện số cần cấp kèm (định mức × số mảnh trên phiếu), thủ kho Phụ kiện
 * lập PHIẾU 2 cho cùng điểm đan (KhoVatTuKemDanPage). "Theo dõi nhập đan" (KhoNhapDanPage) vẫn đọc cùng WeavingIssue/WeavingReceipt.
 */
export default function KhoXuatDanPage({ readOnly = false, filterExportOrderId }: { readOnly?: boolean; filterExportOrderId?: string } = {}) {
  const isMobile = useIsMobile()
  const { user } = useAuth()
  const scope = user?.warehouseScope ?? null
  const { data: skus = [], isLoading, error: skusError, refetch: refetchSkus } = useFetch(() => api.getSkus(), [])
  const { data: pointsData } = useFetch<BeWeavingPoint[]>(() => api.getWeavingPoints(), [])
  const points = (pointsData ?? []).filter(p => p.isActive !== false)

  const [selectedPf, setSelectedPf] = useState<Sku | null>(null)
  const { data: planData, isLoading: planLoading, refetch } = useFetch<BeWeavingIssuePlanItem[]>(
    () => (selectedPf ? api.getWeavingIssuePlan(selectedPf) : Promise.resolve([])),
    [productionOrderRowKey(selectedPf)],
  )
  const plan = planData ?? []
  // Phiếu mới / ai khác vừa xác nhận / huỷ phiếu -> tải lại ngầm.
  useRealtimeRefetch(['skus', 'weaving-issues', 'issue-slips'], () => { void refetchSkus(); void refetch() })

  // QLSX phải bấm "Bắt đầu" cho ÍT NHẤT 1 SKU trong PI trước khi kho xuất đan (BE cũng chặn - assertItemPiHasActiveFloor).
  const { poInfoFor, activePiIds, orderRows } = usePoInfoFloorGate()
  const active = orderRows(skus as Sku[]).filter(p =>
    p.status !== 'DRAFT' &&
    (filterExportOrderId === undefined || p.exportOrderId === filterExportOrderId) &&
    activePiIds.has(poInfoFor(p)?.productionInvoiceId ?? ''),
  )

  const autoSelectedRef = useRef(false)
  useEffect(() => {
    if (!autoSelectedRef.current && filterExportOrderId !== undefined && active.length > 0) {
      setSelectedPf(active[0])
      autoSelectedRef.current = true
    }
  }, [active, filterExportOrderId])

  const [qty, setQty] = useState<Record<string, string>>({})
  const [pointId, setPointId] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [created, setCreated] = useState<IssueSlip | null>(null)
  const { ask, confirmModal } = useConfirm()

  // Đổi lệnh thì bỏ số đang gõ / thông báo của lệnh trước.
  const openPf = (pf: Sku | null) => { setSelectedPf(pf); setQty({}); setMsg(''); setCreated(null) }

  // Mảnh do kho khác giữ (vd kho Hàn khi mảnh không sơn) thì thủ kho này không lập được - BE cũng chặn.
  const mine = (p: BeWeavingIssuePlanItem) => !scope || p.sourceWarehouseCode === scope
  const capOf = (p: BeWeavingIssuePlanItem) => Math.max(0, p.canIssueQty)
  const roundQty = (n: number) => Math.round(n * 10000) / 10000

  const handleQtyChange = (piece: BeWeavingIssuePlanItem, value: string) => {
    const cap = capOf(piece)
    const q = Number(value)
    setQty(p => ({ ...p, [piece.pieceId]: value && q > cap ? String(cap) : value }))
  }

  const chosen = plan
    .filter(p => mine(p) && Number(qty[p.pieceId]) > 0)
    .map(p => ({ piece: p, q: Math.floor(Number(qty[p.pieceId])) }))
    .filter(x => x.q > 0)
  const totalChosen = chosen.reduce((s, x) => s + x.q, 0)

  const pointLabel = (id: string) => {
    const p = points.find(w => String(w.id) === id)
    return p?.fullName ?? p?.code ?? `#${id}`
  }

  const handleCreate = () => {
    if (!selectedPf) return
    if (!pointId) { setMsg('Chọn điểm đan'); return }
    if (chosen.length === 0) { setMsg('Nhập số mảnh cần xuất'); return }
    ask(
      { message: `Lập phiếu xuất ${totalChosen} mảnh cho ${pointLabel(pointId)}? Hệ thống cấp số phiếu, chưa trừ tồn tới khi tải ảnh phiếu đã ký.` },
      async () => {
        setBusy(true); setMsg('')
        try {
          const orderId = await resolveProductionOrderId(selectedPf)
          if (!orderId) throw new Error('SKU chưa có lệnh sản xuất')
          const slip = await createIssueSlip({
            weavingPointId: pointId,
            lines: chosen.map(x => ({ kind: 'WEAVING_PIECE', productionOrderId: orderId, pieceId: x.piece.pieceId, qty: x.q })),
          })
          setCreated(slip)
          setQty({})
          await refetch()
        } catch (e) {
          setMsg(errMsg(e, 'Không lập được phiếu xuất đan'))
        } finally {
          setBusy(false)
        }
      },
    )
  }

  // ── Detail view ───────────────────────────────────────────────────────────────
  if (selectedPf) {
    const canCreate = !readOnly && plan.some(p => mine(p) && capOf(p) > 0)
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <button
            onClick={() => openPf(null)}
            style={{ flexShrink: 0, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer' }}
          >
            <ChevronLeft size={15} /> Quay lại
          </button>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
              {selectedPf.mfgProduct?.factoryCode}
              {selectedPf.mfgProduct?.name && (
                <span style={{ fontWeight: 400, color: 'var(--text2)', marginLeft: 6 }}>— {selectedPf.mfgProduct.name}</span>
              )}
              <span style={{ marginLeft: 8 }}><MaterialChoiceTags wire={selectedPf.wireMaterial} cushion={selectedPf.cushionMaterial} /></span>
            </h2>
            <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>
              PO: {poInfoFor(selectedPf)?.poCode ?? '—'} · Lệnh: <LenhCode piCode={poInfoFor(selectedPf)?.piCode} fallback="Chưa gắn đơn hàng" />
            </div>
          </div>
        </div>

        {created && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 14px', marginBottom: 14, borderRadius: 10, background: 'var(--bg-e8f5e9)', color: 'var(--fg-2e7d32)', fontSize: 13 }}>
            <span>Đã lập phiếu <b style={{ fontFamily: 'monospace' }}>{created.code}</b> cho {created.weavingPointName}. In phiếu → điểm đan ký → tải ảnh ở tab <b>Phiếu xuất</b> rồi xác nhận xuất. Kho Phụ kiện đã được báo để lập phiếu vật tư kèm.</span>
            <button onClick={() => printIssueSlip(created)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text2)', cursor: 'pointer' }}>
              <Printer size={13} /> In phiếu
            </button>
          </div>
        )}

        {planLoading ? <LoadingState /> : plan.length === 0 ? (
          <div style={emptyBox}>Chưa có mảnh nào để xuất đan (SKU chưa được Sếp duyệt lệnh sản xuất hoặc không có mảnh đan)</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {canCreate && (
              <div style={{ ...tableWrap, padding: '12px 16px', display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap', background: 'var(--surface2)' }}>
                <div>
                  <FieldLabel>Điểm đan nhận</FieldLabel>
                  <select
                    value={pointId}
                    onChange={e => setPointId(e.target.value)}
                    aria-label="Điểm đan nhận"
                    style={{ padding: '7px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, background: 'var(--surface)', color: 'var(--text)', minWidth: 200 }}
                  >
                    <option value="">Chọn điểm đan…</option>
                    {points.map(w => <option key={w.id} value={String(w.id)}>{w.fullName ?? w.code}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1, minWidth: 200, fontSize: 12, color: 'var(--text3)' }}>
                  Nhập số mảnh ở từng thẻ bên dưới rồi lập 1 phiếu cho cả chuyến. Dây, gỗ, đinh, nút do kho Phụ kiện lập phiếu riêng.
                </div>
                <button
                  onClick={handleCreate}
                  disabled={busy || chosen.length === 0 || !pointId}
                  style={{ padding: '8px 20px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 6, background: busy || chosen.length === 0 || !pointId ? 'var(--border)' : 'var(--bg-d97706)', color: busy || chosen.length === 0 || !pointId ? 'var(--text3)' : '#fff', cursor: busy || chosen.length === 0 || !pointId ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
                >
                  {busy ? 'Đang lập…' : `Lập phiếu xuất mảnh${totalChosen > 0 ? ` (${totalChosen})` : ''}`}
                </button>
                {msg && <div style={{ width: '100%', fontSize: 12, color: 'var(--fg-dc2626)' }}>{msg}</div>}
              </div>
            )}

            {plan.map(piece => {
              const materialLines = [
                ...piece.wire.map(l => ({ ...l, group: 'Dây' as const })),
                ...piece.nail.map(l => ({ ...l, group: 'Đinh' as const })),
                ...piece.plasticButton.map(l => ({ ...l, group: 'Nút nhựa' as const })),
                ...piece.finishedComponent.map(l => ({ ...l, group: 'Vật tư thành phẩm' as const })),
              ]
              const cap = capOf(piece)
              const isMine = mine(piece)
              const q = Number(qty[piece.pieceId]) || 0
              const statusMsg = piece.remainingToIssue <= 0
                ? { text: 'Đã xuất đủ', tone: 'ok' as const }
                : !isMine
                  ? { text: `Mảnh này do ${fixedWarehouseName(piece.sourceWarehouseCode) ?? piece.sourceWarehouseCode ?? 'kho khác'} xuất`, tone: 'ok' as const }
                  : cap <= 0
                    ? { text: piece.onDraftQty > 0 ? 'Phần còn lại đang nằm trên phiếu chờ ký' : 'Chưa có mảnh qua KCS ở kho để xuất', tone: 'blocked' as const }
                    : null

              return (
              <div key={piece.pieceId} style={{ ...tableWrap, overflow: 'hidden' }}>
                <div style={{ padding: '14px 16px 10px', display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{piece.pieceName}</div>
                  {piece.sourceWarehouseCode && (
                    <span style={{ fontSize: 12, color: 'var(--text3)' }}>xuất từ {fixedWarehouseName(piece.sourceWarehouseCode) ?? piece.sourceWarehouseCode}</span>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderTop: '1px solid var(--border)' }}>
                  <StatCell label="Cần" value={piece.totalQty} />
                  <StatCell label="Đã xuất" value={piece.issuedQty} bordered />
                  <StatCell label="Chờ ký" value={piece.onDraftQty} color={piece.onDraftQty > 0 ? 'var(--fg-b45309)' : undefined} bordered />
                  <StatCell label="Có thể xuất" value={cap} color={cap > 0 ? 'var(--fg-15803d)' : 'var(--fg-dc2626)'} bordered />
                </div>

                {!readOnly && (
                  <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--surface2)' }}>
                    {statusMsg ? (
                      <div style={{ fontSize: 13, fontWeight: 600, color: statusMsg.tone === 'ok' ? 'var(--text3)' : 'var(--fg-dc2626)' }}>{statusMsg.text}</div>
                    ) : (
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        <FieldLabel>Số mảnh xuất</FieldLabel>
                        <input
                          type="number" min={1} max={cap}
                          value={qty[piece.pieceId] ?? ''}
                          onChange={e => handleQtyChange(piece, e.target.value)}
                          placeholder={`tối đa ${cap}`}
                          aria-label={`Số mảnh xuất ${piece.pieceName}`}
                          style={{ width: 110, padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, textAlign: 'right', background: 'var(--surface)', color: 'var(--text)' }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Vật tư kèm: chỉ để biết - kho Phụ kiện lập phiếu riêng theo số mảnh trên phiếu này. */}
                {materialLines.length > 0 && (
                  <div style={{ borderTop: '1px solid var(--border)' }}>
                    <div style={{ padding: '10px 16px 2px', fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: 'var(--text3)' }}>
                      Vật tư kèm — kho Phụ kiện cấp theo phiếu riêng
                    </div>
                    {materialLines.map((l, i) => (
                      <div key={`${l.group}-${l.materialId}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 16px', borderTop: i > 0 ? '1px solid var(--border)' : undefined }}>
                        <span style={{ ...GROUP_BADGE[l.group], flexShrink: 0, fontSize: 11, fontWeight: 700, borderRadius: 4, padding: '2px 8px', width: 64, textAlign: 'center' }}>{l.group}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.materialName}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 1 }}>{roundQty(l.qtyPerPiece)} {l.materialUnit}/mảnh · đã cấp {roundQty(l.issuedQty)} {l.materialUnit}</div>
                        </div>
                        {q > 0 && <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', flexShrink: 0 }}>≈ {roundQty(l.qtyPerPiece * q)} {l.materialUnit}</span>}
                      </div>
                    ))}
                  </div>
                )}

                {piece.allocations.length > 0 && (
                  <div style={{ borderTop: '1px solid var(--border)', overflowX: 'auto' }}>
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
                  </div>
                )}
              </div>
              )
            })}
          </div>
        )}
        {confirmModal}
      </div>
    )
  }

  // ── List view ─────────────────────────────────────────────────────────────────
  return (
    <div>
      <h2 style={{ ...pageTitle, margin: 0 }}>Xuất đan</h2>
      <p style={{ ...pageSubtitle, marginBottom: 'var(--space-5)' }}>
        Nhấn vào dòng để lập phiếu xuất mảnh cho điểm đan — dây, gỗ, đinh, nút do kho Phụ kiện lập phiếu riêng
      </p>

      {isLoading ? <LoadingState /> : skusError ? <LoadErrorState error={skusError} onRetry={refetchSkus} /> : isMobile ? (
        <MobileListCards emptyText="Không có lệnh nào" items={active.map(pf => ({ key: productionOrderRowKey(pf), onClick: () => openPf(pf), title: <><b>{pf.mfgProduct?.factoryCode}</b>{pf.mfgProduct?.name && <span style={{ color: 'var(--text3)' }}> — {pf.mfgProduct.name}</span>} <MaterialChoiceTags wire={pf.wireMaterial} cushion={pf.cushionMaterial} /></>, meta: [{ label: 'PO', value: poInfoFor(pf)?.poCode ?? '—' }, { label: 'Lệnh', value: <LenhCode piCode={poInfoFor(pf)?.piCode} fallback="Chưa gắn đơn hàng" /> }, { label: 'Hạn giao', value: poInfoFor(pf)?.deliveryDate ? format(new Date(poInfoFor(pf)!.deliveryDate!), 'dd/MM/yyyy') : '—' }] }))} />
      ) : (
        <div style={{ ...tableWrap, ...tableScrollBox }}>
          <table style={tbl}>
            <colgroup>
              <col style={{ width: 100 }} />
              <col style={{ width: 130 }} />
              <col />
              <col style={{ width: 130 }} />
            </colgroup>
            <thead>
              <tr style={{ ...stickyHeaderRow, textAlign: 'left' }}>
                <th style={thStyle}>PO</th>
                <th style={thStyle}>Lệnh</th>
                <th style={thStyle}>SKU</th>
                <th style={thStyle}>Hạn giao</th>
              </tr>
            </thead>
            <tbody>
              {active.map(pf => (
                <tr key={productionOrderRowKey(pf)} onClick={() => openPf(pf)} style={row}>
                  <td style={{ ...tdStyle, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {poInfoFor(pf)?.poCode ?? '—'}
                  </td>
                  <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <LenhCode piCode={poInfoFor(pf)?.piCode} fallback="Chưa gắn đơn hàng" />
                  </td>
                  <td style={{ ...tdStyle, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ fontWeight: 600 }}>{pf.mfgProduct?.factoryCode}</span>
                    {pf.mfgProduct?.name && (
                      <><span style={{ color: 'var(--text3)', margin: '0 4px' }}>—</span>{pf.mfgProduct.name}</>
                    )}
                    <span style={{ marginLeft: 6 }}><MaterialChoiceTags wire={pf.wireMaterial} cushion={pf.cushionMaterial} /></span>
                  </td>
                  <td style={{ ...tdStyle, whiteSpace: 'nowrap', color: 'var(--text2)' }}>
                    {poInfoFor(pf)?.deliveryDate
                      ? format(new Date(poInfoFor(pf)!.deliveryDate!), 'dd/MM/yyyy')
                      : '—'}
                  </td>
                </tr>
              ))}
              {active.length === 0 && (
                <tr><td colSpan={4} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}><div className="table-empty-msg">Không có lệnh nào</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/** Nhãn nhỏ phía trên 1 ô nhập/chọn trong form - cùng quy ước với FL ở SpecSteelPage.tsx. */
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 4, textTransform: 'uppercase' as const }}>
      {children}
    </div>
  )
}

/** 1 ô trong lưới thống kê đầu thẻ mảnh - nhãn nhỏ phía trên, số liệu lớn phía dưới. */
function StatCell({ label, value, color, bordered }: {
  label: string
  value: number
  color?: string
  bordered?: boolean
}) {
  return (
    <div style={{ padding: '10px 16px', borderLeft: bordered ? '1px solid var(--border)' : undefined }}>
      <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', color: 'var(--text3)' }}>{label}</div>
      <div style={{ fontSize: 19, fontWeight: 700, color: color ?? 'var(--text)', marginTop: 2 }}>{value}</div>
    </div>
  )
}

/** Màu nhãn nhóm vật tư - cùng quy ước GROUP_BADGE_COLORS ở SpecSteelPage.tsx. */
const GROUP_BADGE: Record<'Dây' | 'Đinh' | 'Nút nhựa' | 'Vật tư thành phẩm', { background: string; color: string }> = {
  'Dây': { background: 'var(--bg-fff3e0)', color: 'var(--fg-e65100)' },
  'Đinh': { background: 'var(--bg-f3e5f5)', color: 'var(--fg-7b1fa2)' },
  'Nút nhựa': { background: 'var(--bg-fce4ec)', color: 'var(--fg-ad1457)' },
  'Vật tư thành phẩm': { background: 'var(--bg-ede7f6)', color: 'var(--fg-4527a0)' },
}
