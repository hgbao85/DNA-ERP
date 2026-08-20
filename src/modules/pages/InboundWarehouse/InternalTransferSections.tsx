'use client'
import { useState } from 'react'
import { useFetch } from '../../../hooks/useFetch'
import { useConfirm } from '../../../hooks/useConfirm'
import * as api from '../../../services/api'
import { CheckCircle2, ChevronDown, ChevronUp, XCircle } from 'lucide-react'
import type { WarehouseTransfer } from '../../../types/warehouse-transfer'
import { TRANSFER_STATUS_MAP, canReceiveAt } from '../../../types/warehouse-transfer'
import { safeArr } from '../../../utils/array'
import { errMsg } from '../../../utils/errors'
import ReasonModal from '../../../components/ReasonModal'
import { compactTh as th, compactTd as td, tableWrap, tbl, row, badge, emptyBox } from '../../../styles/table'

interface Wh { id: string; name: string; code: string }

/**
 * Mục "Nhập nội bộ" — nhúng trong trang Nhập kho, chỉ có tác dụng ở kho được phép NHẬN
 * trong chuỗi chuyển kho (Vật tư thành phẩm, Thành phẩm). Xác nhận hoặc từ chối phiếu
 * chuyển kho gửi tới; tồn kho hai bên chỉ thay đổi khi bấm xác nhận ở đây.
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
  const { data: historyData, refetch: refetchHistory } = useFetch<WarehouseTransfer[]>(
    () => api.getWarehouseTransfers(), []
  )
  const refetchTransfers = () => { refetchPending(); refetchHistory() }

  if (!canReceiveAt(warehouseCode) || !myWarehouse) {
    return <div style={emptyBox}>Kho này không thuộc bước nhận trong chuỗi chuyển kho nội bộ</div>
  }

  const pending = safeArr(pendingData).filter(t => t.toWarehouseId === myWarehouse.id)
  const history = safeArr(historyData)
    .filter(t => t.toWarehouseId === myWarehouse.id && t.status !== 'PENDING')
    .sort((a, b) => (b.confirmedAt ?? b.rejectedAt ?? '').localeCompare(a.confirmedAt ?? a.rejectedAt ?? ''))

  return (
    <div>
      <IncomingInbox pending={pending} onChanged={refetchTransfers} />
      <TransferHistoryTable title="Lịch sử nhập nội bộ" transfers={history} />
    </div>
  )
}

// ── Hộp thư chờ nhận (bên nhận) ──────────────────────────────────────────────

function IncomingInbox({ pending, onChanged }: { pending: WarehouseTransfer[]; onChanged: () => void }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [rejectModal, setRejectModal] = useState<WarehouseTransfer | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const { ask, confirmModal } = useConfirm()

  const handleConfirm = (t: WarehouseTransfer) => {
    ask(
      { message: `Xác nhận đã nhận đủ hàng cho phiếu ${t.code} từ "${t.fromWarehouseName}"? Tồn kho của cả 2 kho sẽ được cập nhật ngay.` },
      async () => {
        setBusy(t.id)
        try {
          await api.confirmWarehouseTransfer(t.id)
          setExpandedId(null)
          onChanged()
        } catch (e) {
          alert(errMsg(e))
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
    try {
      await api.rejectWarehouseTransfer(rejectModal.id, reason)
      setRejectModal(null)
      setRejectReason('')
      setExpandedId(null)
      onChanged()
    } catch (e) {
      alert(errMsg(e))
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
              <div key={t.id} style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--surface)' }}>
                <div
                  onClick={() => setExpandedId(isExpanded ? null : t.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer' }}
                >
                  <span style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 14 }}>{t.code}</span>
                  <span style={{ fontSize: 13, color: 'var(--text2)' }}>Từ: {t.fromWarehouseName}</span>
                  <span style={{ fontSize: 12, color: 'var(--text3)' }}>{t.items.length} vật tư</span>
                  <div style={{ flex: 1 }} />
                  <span style={{ fontSize: 12, color: 'var(--text3)' }}>{new Date(t.createdAt).toLocaleDateString('vi-VN')}</span>
                  {isExpanded ? <ChevronUp size={16} color="var(--text3)" /> : <ChevronDown size={16} color="var(--text3)" />}
                </div>

                {isExpanded && (
                  <div style={{ borderTop: '1px solid var(--border)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                          <th style={th}>Vật tư</th>
                          <th style={{ ...th, textAlign: 'right' }}>Số lượng</th>
                          <th style={th}>ĐVT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {t.items.map(it => (
                          <tr key={it.id} style={{ borderTop: '1px solid var(--border)' }}>
                            <td style={{ ...td, fontWeight: 600 }}>{it.materialName}</td>
                            <td style={{ ...td, textAlign: 'right' }}>{it.quantity}</td>
                            <td style={{ ...td, color: 'var(--text3)' }}>{it.unit}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {t.note && (
                      <div style={{ padding: '8px 16px', fontSize: 12, color: 'var(--text2)', borderTop: '1px solid var(--border)' }}>Ghi chú: {t.note}</div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--surface2)' }}>
                      <button
                        onClick={() => { setRejectModal(t); setRejectReason('') }}
                        disabled={busy === t.id}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '8px 16px', background: '#fce4ec', border: '1px solid #ef9a9a', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#c62828', cursor: 'pointer' }}
                      >
                        <XCircle size={14} /> Từ chối
                      </button>
                      <button
                        onClick={() => handleConfirm(t)}
                        disabled={busy === t.id}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', background: '#2e7d32', color: '#fff', cursor: busy === t.id ? 'not-allowed' : 'pointer', opacity: busy === t.id ? 0.7 : 1 }}
                      >
                        <CheckCircle2 size={15} /> {busy === t.id ? 'Đang xử lý...' : 'Xác nhận nhận hàng'}
                      </button>
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
        confirmColor="#c62828"
      />
    </div>
  )
}

// ── Lịch sử (dùng chung cho cả 2 mục) ────────────────────────────────────────

function TransferHistoryTable({ title, transfers }: { title: string; transfers: WarehouseTransfer[] }) {
  return (
    <div>
      <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>{title}</h3>
      {transfers.length === 0 ? (
        <div style={emptyBox}>Chưa có phiếu chuyển kho nào đã xử lý</div>
      ) : (
        <div style={tableWrap}>
          <table style={tbl}>
            <thead>
              <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                <th style={th}>Mã phiếu</th>
                <th style={th}>Từ kho</th>
                <th style={th}>Đến kho</th>
                <th style={th}>Vật tư</th>
                <th style={th}>Trạng thái</th>
                <th style={th}>Ngày xử lý</th>
              </tr>
            </thead>
            <tbody>
              {transfers.map(t => {
                const st = TRANSFER_STATUS_MAP[t.status]
                return (
                  <tr key={t.id} style={row}>
                    <td style={{ ...td, fontWeight: 600, fontFamily: 'monospace' }}>{t.code}</td>
                    <td style={td}>{t.fromWarehouseName}</td>
                    <td style={td}>{t.toWarehouseName}</td>
                    <td style={{ ...td, color: 'var(--text3)' }}>{t.items.length} loại</td>
                    <td style={td}>
                      <span style={{ ...badge, background: st.bg, color: st.color }}>{st.label}</span>
                    </td>
                    <td style={{ ...td, color: 'var(--text3)' }}>
                      {new Date(t.confirmedAt ?? t.rejectedAt ?? t.createdAt).toLocaleDateString('vi-VN')}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {transfers.some(t => t.status === 'REJECTED' && t.rejectionReason) && (
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text3)' }}>
          {transfers.filter(t => t.status === 'REJECTED' && t.rejectionReason).map(t => (
            <div key={t.id}>Lý do từ chối {t.code}: {t.rejectionReason}</div>
          ))}
        </div>
      )}
    </div>
  )
}
