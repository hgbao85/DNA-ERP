'use client'
import { useEffect, useRef, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { format } from 'date-fns'
import { useFetch } from '../../../hooks/useFetch'
import { useConfirm } from '../../../hooks/useConfirm'
import * as api from '../../../services/api'
import type { BeWeavingIssuePlanItem } from '../../../services/weaving-issues-api'
import type { BeWeavingPoint } from '../../../services/weaving-points-api'
import { usePoInfoFloorGate } from '../../../hooks/usePoInfoFloorGate'
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

  // PO/PI thật (từ ProductionOrder Sếp đã duyệt) - xem comment ở buildProductionOrderInfoByMfgProduct().
  // QLSX phải bấm "Bắt đầu" cho ÍT NHẤT 1 SKU trong PI trước khi kho được xuất đan cho BẤT KỲ SKU
  // nào cùng PI đó (2026-08-31, gộp theo PI - cùng quy tắc XuatSatPage/XuatVatTuTieuHaoPage/
  // WeavingIssuesService.assertItemPiHasActiveFloor() ở backend). Ẩn hẳn khỏi danh sách, backend
  // cũng chặn cứng, đây chỉ là lớp UI khớp theo.
  const { poInfoFor, activePiIds } = usePoInfoFloorGate()
  const active = ((skus ?? []) as Sku[]).filter(p =>
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

  const [qty, setQty]         = useState<Record<string, string>>({})
  const [pointId, setPointId] = useState<Record<string, string>>({})
  const [busy, setBusy]       = useState<string | null>(null)
  const [msgs, setMsgs]       = useState<Record<string, string>>({})
  // Số lượng vật tư (Dây/Đinh/Nút nhựa) thủ kho mang kèm mảnh đi đan - key
  // `${pieceId}:${materialId}`. Dữ liệu THẬT (2026-09-11) - gửi kèm lúc "Xuất", BE trừ tồn thật
  // (WeavingIssueMaterial + StockLedger, xem WeavingIssuesService.issueMaterialsForWeaving).
  // Tự điền sẵn theo định mức × SL mảnh đang nhập (2026-09-11, xem handleQtyChange) - vẫn sửa tay
  // được sau khi điền, chỉ là gợi ý ban đầu chứ không khoá cứng.
  const [materialQty, setMaterialQty] = useState<Record<string, string>>({})
  const { ask, confirmModal } = useConfirm()

  // qtyPerPiece là Decimal(14,4) ở BE - nhân trực tiếp với JS number dễ dính rác dấu phẩy động
  // (vd 0.1 × 3 = 0.30000000000000004), làm tròn lại 4 chữ số thập phân trước khi điền vào ô.
  const roundQty = (n: number) => Math.round(n * 10000) / 10000

  // Gõ SL mảnh -> tự điền lại CẢ 3 ô vật tư theo định mức × SL (ghi đè giá trị đang có, kể cả đã
  // sửa tay trước đó) - đúng yêu cầu "nhập ở đây thì 3 ô tự lấy số sẵn luôn". SL rỗng/không hợp lệ
  // thì xoá sạch gợi ý (không để lại số cũ gây hiểu nhầm).
  // Chặn NGAY LÚC GÕ (2026-09-12, theo yêu cầu trực tiếp - chắc hơn để tới lúc bấm Xuất mới báo
  // lỗi): gõ số vượt min(remainingToIssue, canIssueQty) thì tự kẹp về đúng số tối đa được phép,
  // không để ô SL bao giờ giữ được số vượt trần - input HTML `max` chỉ là gợi ý thị giác, không
  // thật sự chặn gõ tay/dán số.
  const handleQtyChange = (piece: BeWeavingIssuePlanItem, value: string) => {
    const cap = Math.min(piece.remainingToIssue, piece.canIssueQty)
    const q = Number(value)
    const clamped = value && q > cap ? String(cap) : value
    setQty(p => ({ ...p, [piece.pieceId]: clamped }))
    const clampedQty = Number(clamped)
    setMaterialQty(p => {
      const next = { ...p }
      for (const l of [...piece.wire, ...piece.nail, ...piece.plasticButton]) {
        const key = `${piece.pieceId}:${l.materialId}`
        if (clamped && clampedQty > 0) next[key] = String(roundQty(l.qtyPerPiece * clampedQty))
        else delete next[key]
      }
      return next
    })
  }

  // Bắt buộc nhập đủ MỌI dòng vật tư đi kèm (Dây/Đinh/Nút nhựa) trước khi cho xuất - mảnh không
  // có dòng vật tư nào (wire/nail/plasticButton đều rỗng) thì coi như luôn "đủ", không chặn gì.
  const allMaterialsFilled = (piece: BeWeavingIssuePlanItem) => {
    const lines = [...piece.wire, ...piece.nail, ...piece.plasticButton]
    return lines.every(l => Number(materialQty[`${piece.pieceId}:${l.materialId}`]) > 0)
  }

  const handleXuat = (piece: BeWeavingIssuePlanItem) => {
    const q   = Number(qty[piece.pieceId])
    const pid = pointId[piece.pieceId]
    if (!q || q <= 0 || q > piece.remainingToIssue) { setMsgs(p => ({ ...p, [piece.pieceId]: 'Số lượng không hợp lệ (không được vượt quá còn phải xuất)' })); return }
    if (q > piece.canIssueQty) { setMsgs(p => ({ ...p, [piece.pieceId]: `Vượt số mảnh thực tế đã nhận từ kho phôi-sơn-hàn (chỉ còn ${piece.canIssueQty} có thể xuất)` })); return }
    if (!pid) { setMsgs(p => ({ ...p, [piece.pieceId]: 'Chọn điểm đan' })); return }
    if (!allMaterialsFilled(piece)) { setMsgs(p => ({ ...p, [piece.pieceId]: 'Nhập đủ số lượng cho mọi vật tư đi kèm trước khi xuất' })); return }
    const materials = [...piece.wire, ...piece.nail, ...piece.plasticButton]
      .map(l => ({ materialId: l.materialId, qty: Number(materialQty[`${piece.pieceId}:${l.materialId}`]) || 0 }))
      .filter(m => m.qty > 0)
    ask(
      { message: `Xuất đan ${q} "${piece.pieceName}" cho ${pointLabel(pid)}?` },
      async () => {
        if (!selectedPf) return
        setBusy(piece.pieceId)
        setMsgs(p => ({ ...p, [piece.pieceId]: '' }))
        try {
          await api.issueWeaving(selectedPf, { pieceId: piece.pieceId, weavingPointId: pid, qty: q, materials })
          setQty(p => ({ ...p, [piece.pieceId]: '' }))
          setMaterialQty(p => {
            const next = { ...p }
            for (const m of materials) delete next[`${piece.pieceId}:${m.materialId}`]
            return next
          })
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
              PO: {poInfoFor(selectedPf)?.poCode ?? '—'} · PI: {poInfoFor(selectedPf)?.piCode ?? 'Chưa gắn đơn hàng'}
            </div>
          </div>
        </div>

        {planLoading ? <LoadingState /> : plan.length === 0 ? (
          <div style={emptyBox}>Chưa có mảnh nào để xuất đan (SKU chưa được Sếp duyệt lệnh sản xuất)</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {plan.map(piece => {
              const materialLines = [
                ...piece.wire.map(l => ({ ...l, group: 'Dây' as const })),
                ...piece.nail.map(l => ({ ...l, group: 'Đinh' as const })),
                ...piece.plasticButton.map(l => ({ ...l, group: 'Nút nhựa' as const })),
              ]
              const cap = Math.min(piece.remainingToIssue, piece.canIssueQty)
              // Chỉ cho thao tác khi: chưa xuất đủ theo định mức, VÀ kho đã thực nhận đủ hàng từ
              // Phân phối nội bộ - 2 điều kiện tách biệt nên cần 2 thông báo khác nhau (xem statusMsg).
              const canAct = !readOnly && piece.remainingToIssue > 0 && piece.canIssueQty > 0
              const statusMsg = piece.remainingToIssue <= 0
                ? { text: 'Đã xuất đủ', tone: 'ok' as const }
                : piece.canIssueQty <= 0
                  ? { text: 'Chưa đủ mảnh đã nhận từ kho phôi-sơn-hàn', tone: 'blocked' as const }
                  : null

              return (
              <div key={piece.pieceId} style={{ ...tableWrap, overflow: 'hidden' }}>
                {/* Tên mảnh */}
                <div style={{ padding: '14px 16px 10px' }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{piece.pieceName}</div>
                </div>

                {/* Lưới thống kê - thay dòng chữ nối dấu chấm bằng ô số liệu rõ ràng, dễ quét mắt */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderTop: '1px solid var(--border)' }}>
                  <StatCell label="Cần" value={piece.totalQty} />
                  <StatCell label="Đã xuất" value={piece.issuedQty} bordered />
                  <StatCell label="Còn phải xuất" value={piece.remainingToIssue} color={piece.remainingToIssue > 0 ? '#b45309' : '#15803d'} bordered />
                  <StatCell label="Có thể xuất" value={piece.canIssueQty} color={piece.canIssueQty > 0 ? '#15803d' : '#dc2626'} bordered />
                </div>

                {/* Khu vực thao tác - form có nhãn rõ ràng thay vì nhồi 1 hàng ngang, hoặc thông báo trạng thái khi không thao tác được */}
                {!readOnly && (
                  <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--surface2)' }}>
                    {statusMsg ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: statusMsg.tone === 'ok' ? 'var(--text3)' : '#dc2626' }}>
                        {statusMsg.text}
                        {statusMsg.tone === 'blocked' && (
                          <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text3)' }} title="Kho vật tư-TP chưa nhận đủ mảnh từ Phân phối nội bộ (phôi-sơn-hàn) để xuất đan tiếp">
                            (định mức còn cho phép, nhưng kho chưa nhận đủ hàng thật)
                          </span>
                        )}
                      </div>
                    ) : (
                      <div>
                        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                          <div>
                            <FieldLabel>Điểm đan</FieldLabel>
                            <select
                              value={pointId[piece.pieceId] ?? ''}
                              onChange={e => setPointId(p => ({ ...p, [piece.pieceId]: e.target.value }))}
                              style={{ padding: '7px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, background: 'var(--surface)', color: 'var(--text)', minWidth: 160 }}
                            >
                              <option value="">Chọn điểm đan…</option>
                              {points.map(w => <option key={w.id} value={String(w.id)}>{w.fullName ?? w.code}</option>)}
                            </select>
                          </div>
                          <div>
                            <FieldLabel>Số lượng</FieldLabel>
                            <input
                              type="number" min={1} max={cap}
                              value={qty[piece.pieceId] ?? ''}
                              onChange={e => handleQtyChange(piece, e.target.value)}
                              placeholder={`tối đa ${cap}`}
                              style={{ width: 100, padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, textAlign: 'right', background: 'var(--surface)', color: 'var(--text)' }}
                            />
                          </div>
                          <button
                            onClick={() => handleXuat(piece)}
                            disabled={busy === piece.pieceId || !allMaterialsFilled(piece)}
                            title={!allMaterialsFilled(piece) ? 'Nhập đủ số lượng cho mọi vật tư đi kèm trước khi xuất' : undefined}
                            style={{ padding: '8px 20px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 6, background: busy === piece.pieceId || !allMaterialsFilled(piece) ? 'var(--border)' : '#d97706', color: busy === piece.pieceId || !allMaterialsFilled(piece) ? 'var(--text3)' : '#fff', cursor: busy === piece.pieceId || !allMaterialsFilled(piece) ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
                          >
                            {busy === piece.pieceId ? 'Đang xuất…' : 'Xuất đan'}
                          </button>
                        </div>
                        {msgs[piece.pieceId] && <div style={{ marginTop: 8, fontSize: 12, color: '#dc2626' }}>{msgs[piece.pieceId]}</div>}
                      </div>
                    )}
                  </div>
                )}

                {/* Vật tư đi kèm mảnh (Dây/Đinh/Nút nhựa) - danh sách gọn thay vì nhiều "viên kẹo"
                    màu sặc sỡ. Ô nhập số lượng THẬT chỉ hiện khi còn thao tác được (canAct) - hết
                    hạn mức thì không có gì để gửi nên chỉ hiển thị tham khảo, không cho gõ số vô
                    nghĩa. Số nhập gửi kèm lúc "Xuất", BE trừ tồn ngay (WeavingIssueMaterial +
                    StockLedger). "Đã xuất"/"Tồn" là dữ liệu thật từ BE, không phải suy diễn ở FE. */}
                {materialLines.length > 0 && (
                  <div style={{ borderTop: '1px solid var(--border)' }}>
                    <div style={{ padding: '10px 16px 2px', fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: 'var(--text3)' }}>
                      Vật tư mang kèm{canAct ? ' — nhập số lượng thực tế' : ''}
                    </div>
                    <div>
                      {materialLines.map((l, i) => (
                        <div key={`${l.group}-${l.materialId}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 16px', borderTop: i > 0 ? '1px solid var(--border)' : undefined }}>
                          <span style={{ ...GROUP_BADGE[l.group], flexShrink: 0, fontSize: 11, fontWeight: 700, borderRadius: 4, padding: '2px 8px', width: 64, textAlign: 'center' }}>{l.group}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.materialName}</div>
                            <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 1 }}>Đã xuất {l.issuedQty} · Tồn {l.onHandQty} {l.materialUnit}</div>
                          </div>
                          {canAct ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                              <input
                                type="number" min={0}
                                value={materialQty[`${piece.pieceId}:${l.materialId}`] ?? ''}
                                onChange={e => setMaterialQty(p => ({ ...p, [`${piece.pieceId}:${l.materialId}`]: e.target.value }))}
                                style={{ width: 72, padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, textAlign: 'right', background: 'var(--surface)', color: 'var(--text)' }}
                              />
                              <span style={{ fontSize: 12, color: 'var(--text3)', width: 34 }}>{l.materialUnit}</span>
                            </div>
                          ) : (
                            <span style={{ fontSize: 13, color: 'var(--text3)', flexShrink: 0 }}>—</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {piece.allocations.length > 0 && (
                  <div style={{ borderTop: '1px solid var(--border)' }}>
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
      <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700 }}>Theo dõi xuất đan</h2>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text3)' }}>
        Nhấn vào dòng để xuất mảnh cho điểm đan gia công bên ngoài
      </p>

      {isLoading ? <LoadingState /> : (
        <div style={tableWrap}>
          <table style={tbl}>
            <colgroup>
              <col style={{ width: 100 }} />
              <col style={{ width: 130 }} />
              <col />
              <col style={{ width: 130 }} />
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                <th style={thStyle}>PO</th>
                <th style={thStyle}>PI</th>
                <th style={thStyle}>SKU</th>
                <th style={thStyle}>Hạn giao</th>
              </tr>
            </thead>
            <tbody>
              {active.map(pf => (
                <tr key={pf.id} onClick={() => setSelectedPf(pf)} style={row}>
                  <td style={{ ...tdStyle, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {poInfoFor(pf)?.poCode ?? '—'}
                  </td>
                  <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {poInfoFor(pf)?.piCode ?? 'Chưa gắn đơn hàng'}
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
                <tr><td colSpan={4} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>Không có PI nào</td></tr>
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

/** 1 ô trong lưới thống kê đầu thẻ mảnh (Cần/Đã xuất/Còn phải xuất/Có thể xuất) - nhãn nhỏ phía
 *  trên, số liệu lớn phía dưới, thay cho 1 dòng chữ nối dấu chấm khó quét mắt. */
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

/** Màu nhãn nhóm vật tư - cùng quy ước GROUP_BADGE_COLORS ở SpecSteelPage.tsx (Dây/Đinh/Nút nhựa
 *  giữ đúng màu đã dùng ở màn Định mức mảnh, chỉ áp cho cái nhãn nhỏ, không loang ra cả dòng). */
const GROUP_BADGE: Record<'Dây' | 'Đinh' | 'Nút nhựa', { background: string; color: string }> = {
  'Dây': { background: '#fff3e0', color: '#e65100' },
  'Đinh': { background: '#f3e5f5', color: '#7b1fa2' },
  'Nút nhựa': { background: '#fce4ec', color: '#ad1457' },
}
