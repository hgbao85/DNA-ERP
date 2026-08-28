'use client'
import { useEffect, useRef, useState } from 'react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import type { BeTransferCheckPiece } from '../../../services/transfer-check-api'
import { format } from 'date-fns'
import { ChevronLeft, Plus, X, Image as ImageIcon } from 'lucide-react'
import type { Sku } from '../../../types/sku'
import LoadingState from '../../../components/LoadingState'

interface LoiEntry { id: number; lyDo: string; file: File | null }

export default function KhoChuyenKiemPage({ readOnly = false, filterExportOrderId }: { readOnly?: boolean; filterExportOrderId?: string } = {}) {
  const { data: skus = [], isLoading } = useFetch(() => api.getSkus(), [])
  const [selectedPf, setSelectedPf] = useState<Sku | null>(null)

  const { data: piecesData, isLoading: piecesLoading, refetch: refetchPieces } = useFetch<BeTransferCheckPiece[]>(
    () => (selectedPf ? api.getTransferCheckPieces(selectedPf) : Promise.resolve([])),
    [selectedPf?.id],
  )
  const pieces = piecesData ?? []

  // Popup state
  const [checkingPiece, setCheckingPiece] = useState<BeTransferCheckPiece | null>(null)
  const [popupQty, setPopupQty]           = useState('')
  const [loiEntries, setLoiEntries]       = useState<LoiEntry[]>([])
  const [saving, setSaving]               = useState(false)
  const [saveError, setSaveError]         = useState('')

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

  const openPopup = (piece: BeTransferCheckPiece) => {
    setCheckingPiece(piece)
    setPopupQty('')
    setLoiEntries([{ id: Date.now(), lyDo: '', file: null }])
    setSaveError('')
  }

  const addLoi    = () => setLoiEntries(prev => [...prev, { id: Date.now(), lyDo: '', file: null }])
  const removeLoi = (id: number) => setLoiEntries(prev => prev.filter(e => e.id !== id))

  const handleConfirm = async () => {
    if (!checkingPiece || !selectedPf) return
    const qty      = Math.max(0, Number(popupQty) || 0)
    if (qty <= 0) return
    const validLoi = loiEntries.filter(e => e.lyDo.trim())

    setSaving(true)
    setSaveError('')
    try {
      // Ảnh lỗi upload thật lên Cloudinary trước khi ghi kết quả kiểm - cùng pattern với
      // AdminEntityPage (upload lúc Lưu, không phải lúc chọn file).
      const defects = await Promise.all(validLoi.map(async (e) => ({
        reason: e.lyDo.trim(),
        imageUrl: e.file ? await api.uploadImage(e.file) : undefined,
      })))

      await api.recordTransferCheck(selectedPf, {
        pieceId: checkingPiece.pieceId,
        checkedQty: qty,
        defects: defects.length > 0 ? defects : undefined,
      })
      setCheckingPiece(null)
      await refetchPieces()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Không lưu được kết quả kiểm')
    } finally {
      setSaving(false)
    }
  }

  // Phần còn lại cần kiểm (Vấn đề #12 audit 26/08 - trước đây ô này chỉ chặn <=0, không chặn vượt
  // phần còn lại, khiến "Đã kiểm" có thể hiện âm/vượt 100% nếu lỡ tay nhập quá).
  const remainingToCheck = checkingPiece ? checkingPiece.totalQty - checkingPiece.checkedQty : 0
  const popupQtyNum = Number(popupQty)
  const overRemaining = !!popupQty && popupQtyNum > remainingToCheck
  const canConfirm = !!popupQty && popupQtyNum > 0 && !overRemaining && !saving

  // ── Detail view ───────────────────────────────────────────────────────────────
  if (selectedPf) {
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
        {piecesLoading ? <LoadingState /> : (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
              <colgroup>
                <col />
                <col style={{ width: 80 }} />
                <col style={{ width: 72 }} />
                <col style={{ width: 60 }} />
                <col style={{ width: 100 }} />
              </colgroup>
              <thead>
                <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                  <th style={th}>Mảnh</th>
                  <th style={{ ...th, textAlign: 'right' }}>Tổng cần</th>
                  <th style={{ ...th, textAlign: 'right' }}>Đã kiểm</th>
                  <th style={{ ...th, textAlign: 'right' }}>Lỗi</th>
                  <th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {pieces.map(piece => (
                  <tr key={piece.pieceId} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ ...td, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {piece.pieceName}
                    </td>
                    <td style={{ ...td, textAlign: 'right', color: 'var(--text2)' }}>{piece.totalQty}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: piece.checkedQty > 0 ? '#16a34a' : 'var(--text)' }}>{piece.checkedQty}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: piece.defectCount > 0 ? '#dc2626' : 'var(--text3)' }}>{piece.defectCount}</td>
                    <td style={td}>
                      {readOnly ? (
                        <span style={{ color: 'var(--text3)', fontSize: 12 }}>—</span>
                      ) : (
                        <button
                          onClick={() => openPopup(piece)}
                          style={{ padding: '4px 12px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 6, background: '#e65100', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                          Kiểm
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {pieces.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>
                      Chưa có mảnh nào để kiểm (SKU chưa được Sếp duyệt lệnh sản xuất)
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Popup */}
        {checkingPiece && (
          <div
            onClick={e => { if (e.target === e.currentTarget && !saving) setCheckingPiece(null) }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <div style={{ background: 'var(--surface)', borderRadius: 14, width: 480, maxHeight: '85vh', overflow: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,.2)' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>Nhập kết quả kiểm - {checkingPiece.pieceName}</div>
                <button onClick={() => !saving && setCheckingPiece(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
                  <X size={16} color="var(--text3)" />
                </button>
              </div>

              <div style={{ padding: '16px 18px' }}>
                <label style={lbl}>Số lượng đã kiểm * <span style={{ fontWeight: 400, color: 'var(--text3)' }}>(còn lại {remainingToCheck})</span></label>
                <input
                  type="number" min={1} max={remainingToCheck}
                  value={popupQty}
                  onChange={e => setPopupQty(e.target.value)}
                  placeholder="Nhập số lượng"
                  style={{ ...inp, borderColor: overRemaining ? '#dc2626' : undefined }}
                  autoFocus
                />
                {overRemaining && (
                  <div style={{ color: '#dc2626', fontSize: 12, marginTop: 4 }}>
                    Vượt quá số lượng còn lại cần kiểm ({remainingToCheck})
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, marginBottom: 10 }}>
                  <span style={lbl}>Lỗi phát hiện</span>
                  <button
                    onClick={addLoi}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', fontSize: 12, fontWeight: 600, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface2)', color: 'var(--text2)', cursor: 'pointer' }}
                  >
                    <Plus size={13} /> Thêm lỗi
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {loiEntries.map((entry, idx) => (
                    <div key={entry.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', background: 'var(--surface2)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)' }}>Lỗi #{idx + 1}</span>
                        {loiEntries.length > 1 && (
                          <button onClick={() => removeLoi(entry.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' }}>
                            <X size={13} color="var(--text3)" />
                          </button>
                        )}
                      </div>
                      <input
                        value={entry.lyDo}
                        onChange={e => setLoiEntries(prev => prev.map(en => en.id === entry.id ? { ...en, lyDo: e.target.value } : en))}
                        placeholder="Lý do lỗi..."
                        style={{ ...inp, marginBottom: 8 }}
                      />
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: entry.file ? 'var(--text)' : 'var(--text3)', cursor: 'pointer', padding: '5px 0' }}>
                        <ImageIcon size={14} />
                        <span style={{ textDecoration: 'underline', textDecorationStyle: 'dashed' }}>
                          {entry.file ? entry.file.name : 'Đính kèm ảnh lỗi'}
                        </span>
                        <input
                          type="file" accept="image/*"
                          onChange={e => setLoiEntries(prev => prev.map(en => en.id === entry.id ? { ...en, file: e.target.files?.[0] ?? null } : en))}
                          style={{ display: 'none' }}
                        />
                      </label>
                    </div>
                  ))}
                </div>

                {saveError && <div style={{ color: '#c62828', fontSize: 12, marginTop: 12 }}>{saveError}</div>}
              </div>

              <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  onClick={() => setCheckingPiece(null)}
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
  // Chỉ liệt kê PO/SKU/hạn giao - số liệu tiến độ (tổng/đã kiểm/lỗi) cần gọi API riêng cho từng
  // SKU nên chỉ tải khi bấm vào xem chi tiết, tránh N lần gọi API cho mỗi dòng trong danh sách.
  return (
    <div>
      <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700 }}>Chuyền kiểm</h2>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text3)' }}>
        Nhấn vào dòng để xem chi tiết mảnh và nhập kết quả kiểm
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
