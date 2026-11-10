'use client'
import { focusAttr } from '../../../utils/notificationLink'
import { useRef, useState } from 'react'
import { useFetch } from '../../../hooks/useFetch'
import { useRealtimeRefetch } from '../../../realtime/hooks'
import { useConfirm } from '../../../hooks/useConfirm'
import * as api from '../../../services/api'
import { CheckCircle2, ChevronDown, ChevronUp, Paperclip, Printer, X, XCircle } from 'lucide-react'
import { uploadDocument } from '../../../services/uploads-api'
import { printTransferSlip } from './printTransferSlip'
import { createWorkshopMove, getWorkshopMovePlans, type WorkshopMovePlan } from '../../../services/warehouse-transfers-api'
import type { WarehouseTransfer } from '../../../types/warehouse-transfer'
import { canReceiveAt } from '../../../types/warehouse-transfer'
import { safeArr } from '../../../utils/array'
import { errMsg } from '../../../utils/errors'
import ReasonModal from '../../../components/ReasonModal'
import { compactTh as th, compactTd as td, emptyBox } from '../../../styles/table'

interface Wh { id: string; name: string; code: string }

/**
 * Mục "Nhập nội bộ" — nhúng trong trang Nhập kho, chỉ có tác dụng ở kho được phép NHẬN
 * trong chuỗi chuyển kho (Vật tư thành phẩm, Thành phẩm). Xác nhận hoặc từ chối phiếu
 * chuyển kho gửi tới; tồn kho hai bên chỉ thay đổi khi bấm xác nhận ở đây.
 *
 * KHÔNG còn bảng "Lịch sử nhập nội bộ" riêng ở đây (2026-09-12, theo yêu cầu người dùng) - phiếu
 * đã xác nhận/bị từ chối giờ xem ở tab "Lịch sử kho" (WarehouseLedgerHistory.tsx), gộp chung với
 * mọi loại bút toán khác của kho thay vì tách riêng theo từng nghiệp vụ. Mục này chỉ còn giữ đúng
 * việc "đang chờ xử lý" (PENDING) - phần duy nhất Lịch sử kho không có, vì đó là sổ CÁI (chỉ ghi
 * việc đã xảy ra), không có khái niệm "đang chờ".
 */
export function NhapNoiBoSection({ warehouseCode }: { warehouseCode: string }) {
  const { data: warehouses } = useFetch<Wh[]>(() => api.getWarehouses(), [])
  const myWarehouse = safeArr(warehouses).find(w => w.code === warehouseCode) ?? null

  // Tách riêng fetch PENDING (Medium fix) - trước đây lọc client-side trên top-100 chung, 1 phiếu
  // PENDING cũ có thể bị đẩy khỏi top-100 khi tổng số phiếu vượt 100, biến mất khỏi hộp thư chờ
  // xử lý dù vẫn PENDING thật trong DB. getWarehouseTransfers('PENDING') query thẳng BE nên luôn
  // đầy đủ, không phụ thuộc bao nhiêu phiếu CONFIRMED/REJECTED cũ hơn chen vào.
  const { data: pendingData, refetch: refetchPending } = useFetch<WarehouseTransfer[]>(
    () => api.getWarehouseTransfers('PENDING'), []
  )
  // Realtime: phiếu chuyển kho mới/đã xử lý từ kho khác hiện ngay trong hộp đến, không cần F5.
  useRealtimeRefetch(['warehouse-transfers'], refetchPending)

  if (!canReceiveAt(warehouseCode) || !myWarehouse) {
    return <div style={emptyBox}>Kho này không thuộc bước nhận trong chuỗi chuyển kho nội bộ</div>
  }

  const pending = safeArr(pendingData).filter(t => t.toWarehouseId === myWarehouse.id)

  return <IncomingInbox pending={pending} onChanged={refetchPending} />
}

// ── Hộp thư chờ nhận (bên nhận) ──────────────────────────────────────────────

function IncomingInbox({ pending, onChanged }: { pending: WarehouseTransfer[]; onChanged: () => void }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [rejectModal, setRejectModal] = useState<WarehouseTransfer | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [rejectError, setRejectError] = useState<string | null>(null)
  const { ask, confirmModal } = useConfirm()

  // v8 4.7 (09/11/2026): số thực nhận từng dòng (mặc định = số gửi) + ảnh phiếu đã ký bắt buộc (4.1/4.2).
  const [received, setReceived] = useState<Record<string, string>>({})
  const [files, setFiles] = useState<Record<string, File[]>>({})
  const [confirmError, setConfirmError] = useState<Record<string, string>>({})
  const uploaded = useRef(new WeakMap<File, string>())
  const recvOf = (key: string, sent: number) => {
    const v = received[key]
    return v === undefined || v === '' ? sent : Number(v)
  }

  const handleConfirm = (t: WarehouseTransfer) => {
    const lines = [
      ...t.items.map(it => ({ key: `i:${it.id}`, id: it.id, name: it.materialName, unit: it.unit, sent: it.quantity, piece: false })),
      ...t.pieceItems.map(it => ({ key: `p:${it.id}`, id: it.id, name: `${it.pieceCode} — ${it.pieceName}`, unit: 'mảnh', sent: it.quantity, piece: true })),
    ]
    const bad = lines.find(l => !(recvOf(l.key, l.sent) >= 0) || recvOf(l.key, l.sent) > l.sent || (l.piece && !Number.isInteger(recvOf(l.key, l.sent))))
    if (bad) { setConfirmError(p => ({ ...p, [t.id]: `${bad.name}: số thực nhận phải từ 0 tới ${bad.sent}${bad.piece ? ', số nguyên' : ''}` })); return }
    const myFiles = files[t.id] ?? []
    if (myFiles.length === 0) { setConfirmError(p => ({ ...p, [t.id]: 'Cần ảnh phiếu chuyển kho đã ký' })); return }
    const short = lines.filter(l => recvOf(l.key, l.sent) < l.sent)
    ask(
      {
        message: short.length === 0
          ? `Xác nhận đã nhận ĐỦ hàng của phiếu ${t.code} từ "${t.fromWarehouseName}"? Tồn kho 2 kho cập nhật ngay.`
          : `Nhận THIẾU ${short.length} dòng (${short.map(l => `${l.name}: ${recvOf(l.key, l.sent)}/${l.sent} ${l.unit}`).join('; ')}). Tồn kho nhận chỉ cộng số thực nhận, phần thiếu ở lại "${t.fromWarehouseName}" để lập phiếu bù. Xác nhận?`,
      },
      async () => {
        setBusy(t.id)
        setConfirmError(p => ({ ...p, [t.id]: '' }))
        try {
          const urls: string[] = []
          for (const f of myFiles) {
            let u = uploaded.current.get(f)
            if (!u) { u = await uploadDocument(f); uploaded.current.set(f, u) }
            urls.push(u)
          }
          await api.confirmWarehouseTransfer(t.id, {
            signedSlipUrls: urls,
            items: t.items.map(it => ({ id: it.id, receivedQty: recvOf(`i:${it.id}`, it.quantity) })),
            pieceItems: t.pieceItems.map(it => ({ id: it.id, receivedQty: recvOf(`p:${it.id}`, it.quantity) })),
          })
          setExpandedId(null)
          onChanged()
        } catch (e) {
          setConfirmError(p => ({ ...p, [t.id]: errMsg(e, 'Không xác nhận được') }))
        } finally {
          setBusy(null)
        }
      }
    )
  }

  const handleReject = async () => {
    if (!rejectModal) return
    const reason = rejectReason.trim()
    if (!reason) return // nút Xác nhận từ chối đã disable khi rỗng, đây là chặn phòng hờ
    setRejecting(true)
    setRejectError(null)
    try {
      await api.rejectWarehouseTransfer(rejectModal.id, reason)
      setRejectModal(null)
      setRejectReason('')
      setExpandedId(null)
      onChanged()
    } catch (e) {
      setRejectError(errMsg(e))
    } finally {
      setRejecting(false)
    }
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Nhập nội bộ — phiếu chuyển kho đang chờ nhận</h3>
      {pending.length === 0 ? (
        <div style={emptyBox}>Không có phiếu chuyển kho nào đang chờ xác nhận</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {pending.map(t => {
            const isExpanded = expandedId === t.id
            return (
              <div key={t.id} {...focusAttr('WAREHOUSE_TRANSFER', t.id)} style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--surface)' }}>
                <div
                  onClick={() => setExpandedId(isExpanded ? null : t.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer' }}
                >
                  <span style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 14 }}>{t.code}</span>
                  <span style={{ fontSize: 13, color: 'var(--text2)' }}>Từ: {t.fromWarehouseName}</span>
                  <span style={{ fontSize: 12, color: 'var(--text3)' }}>{t.items.length + t.pieceItems.length} vật tư</span>
                  <div style={{ flex: 1 }} />
                  <span style={{ fontSize: 12, color: 'var(--text3)' }}>{new Date(t.createdAt).toLocaleDateString('vi-VN')}</span>
                  {isExpanded ? <ChevronUp size={16} color="var(--text3)" /> : <ChevronDown size={16} color="var(--text3)" />}
                </div>

                {isExpanded && (
                  <div style={{ borderTop: '1px solid var(--border)', overflowX: 'auto' }}>
                    <table style={{ width: '100%', minWidth: 520, borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                          <th style={th}>Vật tư</th>
                          <th style={th}>Quy cách</th>
                          <th style={{ ...th, textAlign: 'right' }}>Số gửi</th>
                          <th style={{ ...th, textAlign: 'right' }}>Thực nhận</th>
                          <th style={th}>ĐVT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {t.items.map(it => (
                          <tr key={it.id} style={{ borderTop: '1px solid var(--border)' }}>
                            <td style={{ ...td, fontWeight: 600 }}>{it.materialName}</td>
                            <td style={{ ...td, color: 'var(--text3)' }}>{[it.materialSpec, it.stockLengthMm ? `cây ${it.stockLengthMm}mm` : ''].filter(Boolean).join(' · ') || '—'}</td>
                            <td style={{ ...td, textAlign: 'right' }}>{it.quantity}</td>
                            <td style={{ ...td, textAlign: 'right' }}>
                              <input type="number" min={0} max={it.quantity} step="any" value={received[`i:${it.id}`] ?? String(it.quantity)}
                                onChange={e => setReceived(p => ({ ...p, [`i:${it.id}`]: e.target.value }))}
                                aria-label={`Thực nhận ${it.materialName}`}
                                style={{ width: 90, padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, textAlign: 'right', background: 'var(--surface)', color: 'var(--text)' }} />
                            </td>
                            <td style={{ ...td, color: 'var(--text3)' }}>{it.unit}</td>
                          </tr>
                        ))}
                        {t.pieceItems.map(it => (
                          <tr key={it.id} style={{ borderTop: '1px solid var(--border)' }}>
                            <td style={{ ...td, fontWeight: 600 }}>{it.pieceCode} — {it.pieceName}</td>
                            <td style={{ ...td, color: 'var(--text3)' }}>—</td>
                            <td style={{ ...td, textAlign: 'right' }}>{it.quantity}</td>
                            <td style={{ ...td, textAlign: 'right' }}>
                              <input type="number" min={0} max={it.quantity} step={1} value={received[`p:${it.id}`] ?? String(it.quantity)}
                                onChange={e => setReceived(p => ({ ...p, [`p:${it.id}`]: e.target.value }))}
                                aria-label={`Thực nhận ${it.pieceName}`}
                                style={{ width: 90, padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, textAlign: 'right', background: 'var(--surface)', color: 'var(--text)' }} />
                            </td>
                            <td style={{ ...td, color: 'var(--text3)' }}>mảnh</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {t.note && (
                      <div style={{ padding: '8px 16px', fontSize: 12, color: 'var(--text2)', borderTop: '1px solid var(--border)' }}>Ghi chú: {t.note}</div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--surface2)' }}>
                      <button onClick={() => printTransferSlip(t)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', fontSize: 12, fontWeight: 600, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text2)', cursor: 'pointer' }}>
                        <Printer size={13} /> In phiếu
                      </button>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', fontSize: 12, fontWeight: 600, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text2)', cursor: 'pointer' }}>
                        <Paperclip size={13} /> Ảnh phiếu đã ký <span style={{ color: 'var(--fg-dc2626, #dc2626)' }}>*</span>
                        <input type="file" accept="image/*,application/pdf" multiple hidden onChange={e => { const fl = Array.from(e.target.files ?? []); setFiles(p => ({ ...p, [t.id]: [...(p[t.id] ?? []), ...fl] })); e.target.value = '' }} />
                      </label>
                      {(files[t.id] ?? []).map((f, i) => (
                        <span key={i} style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          {f.name}
                          <button onClick={() => setFiles(p => ({ ...p, [t.id]: (p[t.id] ?? []).filter((_, j) => j !== i) }))} aria-label={`Bỏ ${f.name}`} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 0 }}><X size={12} /></button>
                        </span>
                      ))}
                      <div style={{ flex: 1 }} />
                      <button
                        onClick={() => { setRejectModal(t); setRejectReason(''); setRejectError(null) }}
                        disabled={busy === t.id}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '8px 16px', background: 'var(--bg-fce4ec)', border: '1px solid var(--fg-ef9a9a)', borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'var(--fg-c62828)', cursor: 'pointer' }}
                      >
                        <XCircle size={14} /> Từ chối
                      </button>
                      <button
                        onClick={() => handleConfirm(t)}
                        disabled={busy === t.id}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', background: 'var(--bg-2e7d32)', color: '#fff', cursor: busy === t.id ? 'not-allowed' : 'pointer', opacity: busy === t.id ? 0.7 : 1 }}
                      >
                        <CheckCircle2 size={15} /> {busy === t.id ? 'Đang xử lý...' : 'Xác nhận nhận hàng'}
                      </button>
                    </div>
                    <div style={{ padding: '0 16px 10px', background: 'var(--surface2)', fontSize: 12, color: confirmError[t.id] ? 'var(--fg-dc2626, #dc2626)' : 'var(--text3)' }}>
                      {confirmError[t.id] || 'Đếm hàng, ghi số thực nhận (thiếu thì sửa số), ký phiếu, chụp tải lên rồi xác nhận. Tồn kho chỉ cộng số thực nhận; phần thiếu kho giao lập phiếu bù.'}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {confirmModal}
      <ReasonModal
        open={!!rejectModal}
        title={`Từ chối phiếu chuyển kho — ${rejectModal?.code ?? ''}`}
        description="Phiếu sẽ chuyển sang trạng thái từ chối. Tồn kho của cả 2 kho sẽ KHÔNG thay đổi. Vui lòng nhập lý do từ chối."
        reason={rejectReason}
        onReasonChange={setRejectReason}
        placeholder="VD: Sai số lượng, không đúng vật tư..."
        onCancel={() => setRejectModal(null)}
        onConfirm={handleReject}
        busy={rejecting}
        confirmDisabled={!rejectReason.trim()}
        confirmColor="var(--fg-c62828)"
        error={rejectError}
      />
    </div>
  )
}

// ── Phiếu đã gửi, chờ kho nhận (bên giao) ────────────────────────────────────

/**
 * Phiếu chuyển kho mình đã lập, đang chờ kho nhận - có nút "In phiếu" (09/11/2026, v8 4.1/4.2: kho giao in phiếu, người nhận ký,
 * kho nhận chụp tải lên khi xác nhận). Dùng ở "Chuyển kho ngoài đơn hàng" và "Xuất theo đơn hàng" (chuyển mảnh).
 */
export function OutgoingTransfersPanel({ warehouseId, title = 'Phiếu đã gửi — chờ kho nhận xác nhận' }: { warehouseId: string | null; title?: string }) {
  const { data, refetch } = useFetch<WarehouseTransfer[]>(() => api.getWarehouseTransfers('PENDING'), [])
  useRealtimeRefetch(['warehouse-transfers'], refetch)
  const mine = safeArr(data).filter(t => t.fromWarehouseId === warehouseId)
  return (
    <div style={{ marginTop: 20 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>{title}</h3>
      {mine.length === 0 ? (
        <div style={emptyBox}>Chưa có phiếu nào đang chờ</div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                <th style={th}>Số phiếu</th>
                <th style={th}>Kho nhận</th>
                <th style={th}>Hàng</th>
                <th style={th}>Ngày lập</th>
                <th style={th} />
              </tr>
            </thead>
            <tbody>
              {mine.map(t => (
                <tr key={t.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ ...td, fontWeight: 700, fontFamily: 'monospace' }}>{t.code}</td>
                  <td style={td}>{t.toWarehouseName}</td>
                  <td style={{ ...td, color: 'var(--text3)' }}>{[...t.items.map(it => `${it.materialName} (${it.quantity} ${it.unit})`), ...t.pieceItems.map(it => `${it.pieceName} (${it.quantity} mảnh)`)].join(', ')}</td>
                  <td style={{ ...td, color: 'var(--text3)' }}>{new Date(t.createdAt).toLocaleDateString('vi-VN')}</td>
                  <td style={td}>
                    <button onClick={() => printTransferSlip(t)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', fontSize: 12, fontWeight: 600, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text2)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      <Printer size={13} /> In phiếu
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Hàng của lệnh đổi xưởng cần chuyển (bên giao) ────────────────────────────

/**
 * Đổi xưởng (anh Nhân 10/11/2026): lệnh đổi sang xưởng khác mà hàng đang giữ cho lệnh (sắt, vật tư Phôi/Hàn) còn ở kho xưởng
 * cũ - thủ kho kho cũ lập phiếu chuyển sang kho cùng loại của xưởng mới. Sắt và vật tư khác lập 2 phiếu riêng: phiếu sắt chờ KHSX
 * bấm "Đã kiểm" phương án cắt, phiếu vật tư khác lập ngay (anh Nhân 10/11).
 * Kho mới nhận ở "Nhập nội bộ" (ghi thực nhận, ảnh ký) - giữ chỗ của lệnh chuyển theo.
 */
export function WorkshopMovePanel() {
  const { data, refetch } = useFetch(() => getWorkshopMovePlans(), [])
  useRealtimeRefetch(['warehouse-transfers', 'production-invoices'], refetch)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<Record<string, string>>({})
  const plans = safeArr(data)
  if (plans.length === 0) return null

  const create = async (p: WorkshopMovePlan) => {
    const key = `${p.productionInvoiceId}:${p.fromWarehouseId}:${p.part}`
    setBusy(key); setMsg(m => ({ ...m, [key]: '' }))
    try {
      const t = await createWorkshopMove(p.productionInvoiceId, p.fromWarehouseId, p.part)
      setMsg(m => ({ ...m, [key]: `Đã lập phiếu ${t.code} - in phiếu ở bảng "Phiếu đã gửi" bên dưới, kho nhận ký và xác nhận.` }))
      refetch()
    } catch (e) {
      setMsg(m => ({ ...m, [key]: errMsg(e, 'Không lập được phiếu chuyển') }))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Hàng của lệnh đổi xưởng — cần chuyển sang kho xưởng mới</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {plans.map(p => {
          const key = `${p.productionInvoiceId}:${p.fromWarehouseId}:${p.part}`
          return (
            <div key={key} style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--surface)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 14px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                <b style={{ fontFamily: 'monospace' }}>{p.lenhCode}</b>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: p.part === 'STEEL' ? 'var(--bg-fef3c7, #fef3c7)' : 'var(--bg-e0f2fe, #e0f2fe)', color: p.part === 'STEEL' ? 'var(--fg-b45309)' : 'var(--fg-0369a1, #0369a1)' }}>
                  {p.part === 'STEEL' ? 'Sắt' : 'Vật tư khác'}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text2)' }}>{p.fromWarehouseName} → <b>{p.toWarehouseName}</b></span>
                <div style={{ flex: 1 }} />
                {p.recheckPending
                  ? <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-b45309)' }}>Chờ KHSX kiểm lại phương án cắt</span>
                  : (
                    <button onClick={() => void create(p)} disabled={busy === key}
                      style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 8, background: busy === key ? 'var(--surface2)' : 'var(--bg-2563eb)', color: busy === key ? 'var(--text3)' : '#fff', cursor: busy === key ? 'not-allowed' : 'pointer' }}>
                      {busy === key ? 'Đang lập…' : 'Lập phiếu chuyển'}
                    </button>
                  )}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ textAlign: 'left' }}><th style={th}>Vật tư</th><th style={th}>Quy cách</th><th style={{ ...th, textAlign: 'right' }}>Số lượng</th><th style={th}>ĐVT</th></tr></thead>
                <tbody>
                  {p.lines.map(l => (
                    <tr key={`${l.materialId}:${l.stockLengthMm}:${l.spec}`} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ ...td, fontWeight: 600 }}>{l.materialCode} <span style={{ fontWeight: 400, color: 'var(--text2)' }}>{l.materialName}</span></td>
                      <td style={{ ...td, color: 'var(--text3)' }}>{[l.spec, l.stockLengthMm ? `cây ${l.stockLengthMm}mm` : ''].filter(Boolean).join(' · ') || '—'}</td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{l.qty}</td>
                      <td style={{ ...td, color: 'var(--text3)' }}>{l.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {msg[key] && <div style={{ padding: '8px 14px', fontSize: 12, color: msg[key].startsWith('Đã lập') ? 'var(--fg-2e7d32)' : 'var(--fg-dc2626, #dc2626)' }}>{msg[key]}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

