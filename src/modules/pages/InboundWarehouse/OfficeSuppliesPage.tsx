import { useState } from 'react'
import { Plus, Pencil, Trash2, ArrowDownToLine, ArrowUpFromLine, History, X } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import type { BeOfficeSupply, BeOfficeSupplyLedgerEntry, OfficeSupplyLedgerReason } from '../../../services/office-supplies-api'
import Modal from '../../../components/Modal'
import ConfirmModal from '../../../components/ConfirmModal'
import LoadingState from '../../../components/LoadingState'

// Văn phòng phẩm/vật tư sinh hoạt (bút, giấy...) - HOÀN TOÀN tách biệt khỏi "Tổng hợp vật tư"
// (Material sản xuất gắn định mức/BOM, xem VatTuDashboardPage.tsx). RIÊNG THEO TỪNG KHO - không
// dùng chung, 2 kho có thể cùng đặt tên 1 vật tư nhưng tồn/lịch sử độc lập hoàn toàn (xem
// OfficeSuppliesService.assertWarehouseScope ở BE). Nhân viên kho toàn quyền CRUD + nhập/xuất
// trong ĐÚNG kho mình phụ trách, có lịch sử (ledger) cho từng lần thay đổi số lượng.

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8,
  fontSize: 13, background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, color: 'var(--text2)', margin: '10px 0 4px' }
const btnPrimary: React.CSSProperties = {
  padding: '8px 16px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
  color: '#fff', background: '#4527A0', cursor: 'pointer',
}
const btnSecondary: React.CSSProperties = {
  padding: '8px 16px', background: 'var(--surface2)', border: '1px solid var(--border)',
  borderRadius: 8, fontSize: 13, cursor: 'pointer',
}
const iconBtn: React.CSSProperties = {
  padding: 6, background: 'transparent', border: '1px solid var(--border)', borderRadius: 6,
  cursor: 'pointer', display: 'flex',
}

type FormState = { name: string; unit: string; note: string; openingQty: string }
const emptyForm: FormState = { name: '', unit: '', note: '', openingQty: '' }

interface OfficeSuppliesPageProps {
  /** Kho phụ trách của tài khoản đang đăng nhập (User.warehouseScope) - BẮT BUỘC vì vật tư văn
   *  phòng riêng theo từng kho. `undefined` (tài khoản không gán kho, vd Boss/tổng kho) chỉ hiện
   *  thông báo chưa hỗ trợ, cùng idiom tab "Xuất theo đơn hàng" (WarehouseXuatPage) trong file
   *  InboundWarehouseApp.tsx - trên thực tế nhánh này gần như không xảy ra (Boss không có đường
   *  điều hướng vào phân hệ Kho đầu vào). */
  warehouseCode?: string
}

export default function OfficeSuppliesPage({ warehouseCode }: OfficeSuppliesPageProps) {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  // Chỉ Admin mới bật được - vật tư đã xóa lẫn vào cùng danh sách, đánh dấu bằng badge "Đã xóa"
  // (xem cột Tên vật tư) thay vì tách màn riêng, vì tần suất tra cứu lại thấp (chỉ để đối chiếu
  // lịch sử khi có thắc mắc, không phải nghiệp vụ thường xuyên).
  const [showDeleted, setShowDeleted] = useState(false)
  const includeDeleted = isAdmin && showDeleted
  const { data, isLoading, error, refetch } = useFetch(
    () => api.getOfficeSupplies(warehouseCode, includeDeleted),
    [warehouseCode, includeDeleted],
  )
  const supplies = data ?? []

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<BeOfficeSupply | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [adjustTarget, setAdjustTarget] = useState<BeOfficeSupply | null>(null)
  const [adjustDirection, setAdjustDirection] = useState<'IMPORT' | 'EXPORT'>('IMPORT')
  const [adjustQty, setAdjustQty] = useState('')
  const [adjustNote, setAdjustNote] = useState('')
  const [adjustError, setAdjustError] = useState<string | null>(null)
  const [adjusting, setAdjusting] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<BeOfficeSupply | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [ledgerTarget, setLedgerTarget] = useState<BeOfficeSupply | null>(null)

  // Đặt SAU mọi hook (rules-of-hooks) - tài khoản không gán kho (Boss/tổng kho, hoặc trước khi
  // Admin chọn kho ở OfficeSuppliesAdminPage) chỉ hiện thông báo, không có chức năng CRUD nào.
  if (!warehouseCode) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: 'var(--text3)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 14 }}>
        Tài khoản không gán kho phụ trách cụ thể chưa có chức năng văn phòng phẩm — đăng nhập
        bằng tài khoản thủ kho của đúng kho cần quản lý.
      </div>
    )
  }

  const openCreate = () => { setEditing(null); setForm(emptyForm); setFormError(null); setFormOpen(true) }
  const openEdit = (s: BeOfficeSupply) => {
    setEditing(s)
    setForm({ name: s.name, unit: s.unit, note: s.note ?? '', openingQty: '' })
    setFormError(null)
    setFormOpen(true)
  }

  const submitForm = async () => {
    if (!form.name.trim() || !form.unit.trim()) {
      setFormError('Vui lòng nhập Tên vật tư và Đơn vị tính')
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      if (editing) {
        await api.updateOfficeSupply(editing.id, {
          name: form.name.trim(),
          unit: form.unit.trim(),
          note: form.note.trim() || undefined,
        })
      } else {
        await api.createOfficeSupply({
          name: form.name.trim(),
          unit: form.unit.trim(),
          note: form.note.trim() || undefined,
          openingQty: form.openingQty ? Number(form.openingQty) : undefined,
          warehouseCode,
        })
      }
      setFormOpen(false)
      refetch()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Không thể lưu vật tư')
    } finally {
      setSaving(false)
    }
  }

  const openAdjust = (s: BeOfficeSupply, direction: 'IMPORT' | 'EXPORT') => {
    setAdjustTarget(s)
    setAdjustDirection(direction)
    setAdjustQty('')
    setAdjustNote('')
    setAdjustError(null)
  }

  const submitAdjust = async () => {
    if (!adjustTarget) return
    const qty = Number(adjustQty)
    if (!qty || qty <= 0) {
      setAdjustError('Vui lòng nhập số lượng lớn hơn 0')
      return
    }
    setAdjusting(true)
    setAdjustError(null)
    try {
      await api.adjustOfficeSupplyQuantity(adjustTarget.id, {
        changeQty: adjustDirection === 'IMPORT' ? qty : -qty,
        reason: adjustDirection as OfficeSupplyLedgerReason,
        note: adjustNote.trim() || undefined,
      })
      setAdjustTarget(null)
      refetch()
    } catch (e) {
      setAdjustError(e instanceof Error ? e.message : 'Không thể cập nhật số lượng')
    } finally {
      setAdjusting(false)
    }
  }

  const submitDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await api.deleteOfficeSupply(deleteTarget.id)
      setDeleteTarget(null)
      refetch()
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Không thể xóa vật tư')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Văn phòng phẩm</h2>
        <button onClick={openCreate} style={{ ...btnPrimary, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={15} /> Thêm vật tư
        </button>
      </div>
      <p style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 14 }}>
        Đồ dùng sinh hoạt/văn phòng (bút, giấy...) - KHÔNG liên quan định mức sản xuất. Riêng theo
        từng kho - mỗi lần nhập/xuất đều lưu lịch sử.
      </p>

      {isAdmin && (
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text2)', marginBottom: 12, cursor: 'pointer' }}>
          <input type="checkbox" checked={showDeleted} onChange={e => setShowDeleted(e.target.checked)} />
          Hiện vật tư đã xóa (để tra lịch sử)
        </label>
      )}

      {isLoading && <LoadingState />}
      {error && <div style={{ color: '#c62828', fontSize: 13, padding: 12 }}>{error}</div>}

      {!isLoading && !error && (
        supplies.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text3)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 14 }}>
            Chưa có văn phòng phẩm nào - bấm &quot;Thêm vật tư&quot; để tạo mới.
          </div>
        ) : (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                  <th style={{ padding: '10px 14px' }}>Tên vật tư</th>
                  <th style={{ padding: '10px 14px' }}>Đơn vị</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Tồn hiện tại</th>
                  <th style={{ padding: '10px 14px' }}>Ghi chú</th>
                  <th style={{ padding: '10px 14px', width: 200 }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {supplies.map(s => {
                  const isDeleted = !!s.deletedAt
                  return (
                  <tr key={s.id} style={{ borderTop: '1px solid var(--border)', opacity: isDeleted ? 0.55 : 1 }}>
                    <td style={{ padding: '10px 14px', fontWeight: 600 }}>
                      {s.name}
                      {isDeleted && (
                        <span style={{ marginLeft: 8, padding: '1px 7px', fontSize: 10.5, fontWeight: 700, borderRadius: 10, background: 'rgba(198,40,40,.12)', color: '#c62828' }}>
                          Đã xóa
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '10px 14px' }}>{s.unit}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600 }}>{s.quantity}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--text3)' }}>{s.note ?? '—'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {isDeleted ? (
                          <button title="Lịch sử" style={iconBtn} onClick={() => setLedgerTarget(s)}><History size={14} /></button>
                        ) : (
                          <>
                            <button title="Nhập" style={iconBtn} onClick={() => openAdjust(s, 'IMPORT')}><ArrowDownToLine size={14} color="#2e7d32" /></button>
                            <button title="Xuất" style={iconBtn} onClick={() => openAdjust(s, 'EXPORT')}><ArrowUpFromLine size={14} color="#c62828" /></button>
                            <button title="Lịch sử" style={iconBtn} onClick={() => setLedgerTarget(s)}><History size={14} /></button>
                            <button title="Sửa" style={iconBtn} onClick={() => openEdit(s)}><Pencil size={14} /></button>
                            <button title="Xóa" style={iconBtn} onClick={() => { setDeleteTarget(s); setDeleteError(null) }}><Trash2 size={14} color="#c62828" /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Thêm / Sửa - KHÔNG có ô số lượng khi sửa, đổi tồn phải qua Nhập/Xuất */}
      <Modal open={formOpen} onClose={() => setFormOpen(false)}>
        <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 700 }}>{editing ? 'Sửa vật tư' : 'Thêm văn phòng phẩm'}</h3>
        <label style={labelStyle}>Tên vật tư *</label>
        <input style={inputStyle} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="VD: Bút bi Thiên Long" />
        <label style={labelStyle}>Đơn vị tính *</label>
        <input style={inputStyle} value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="VD: cái, hộp, cây" />
        <label style={labelStyle}>Ghi chú</label>
        <input style={inputStyle} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
        {!editing && (
          <>
            <label style={labelStyle}>Tồn ban đầu</label>
            <input type="number" min={0} style={inputStyle} value={form.openingQty} onChange={e => setForm({ ...form, openingQty: e.target.value })} placeholder="0" />
          </>
        )}
        {formError && <div style={{ color: '#c62828', fontSize: 12, marginTop: 10 }}>{formError}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
          <button style={btnSecondary} onClick={() => setFormOpen(false)} disabled={saving}>Hủy</button>
          <button style={{ ...btnPrimary, opacity: saving ? 0.7 : 1 }} onClick={submitForm} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu'}</button>
        </div>
      </Modal>

      {/* Nhập / Xuất */}
      <Modal open={!!adjustTarget} onClose={() => setAdjustTarget(null)} maxWidth={400}>
        <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700 }}>
          {adjustDirection === 'IMPORT' ? 'Nhập' : 'Xuất'} — {adjustTarget?.name}
        </h3>
        <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text2)' }}>Tồn hiện tại: {adjustTarget?.quantity} {adjustTarget?.unit}</p>
        <label style={labelStyle}>Số lượng *</label>
        <input type="number" min={0} autoFocus style={inputStyle} value={adjustQty} onChange={e => setAdjustQty(e.target.value)} />
        <label style={labelStyle}>Ghi chú</label>
        <input style={inputStyle} value={adjustNote} onChange={e => setAdjustNote(e.target.value)} placeholder="VD: mua bổ sung, phát cho phòng kế toán..." />
        {adjustError && <div style={{ color: '#c62828', fontSize: 12, marginTop: 10 }}>{adjustError}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
          <button style={btnSecondary} onClick={() => setAdjustTarget(null)} disabled={adjusting}>Hủy</button>
          <button style={{ ...btnPrimary, opacity: adjusting ? 0.7 : 1 }} onClick={submitAdjust} disabled={adjusting}>
            {adjusting ? 'Đang lưu...' : adjustDirection === 'IMPORT' ? 'Xác nhận nhập' : 'Xác nhận xuất'}
          </button>
        </div>
      </Modal>

      <ConfirmModal
        open={!!deleteTarget}
        title="Xóa văn phòng phẩm"
        message={`Xóa "${deleteTarget?.name}"? Lịch sử nhập/xuất vẫn được giữ lại để tra cứu.`}
        danger
        busy={deleting}
        error={deleteError}
        onConfirm={submitDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {ledgerTarget && (
        <LedgerHistoryModal supply={ledgerTarget} onClose={() => setLedgerTarget(null)} />
      )}
    </div>
  )
}

function LedgerHistoryModal({ supply, onClose }: { supply: BeOfficeSupply; onClose: () => void }) {
  const { data, isLoading, error } = useFetch(() => api.getOfficeSupplyLedger(supply.id), [supply.id])
  const entries: BeOfficeSupplyLedgerEntry[] = data ?? []

  const reasonLabel: Record<OfficeSupplyLedgerReason, string> = {
    INITIAL: 'Tồn ban đầu', IMPORT: 'Nhập', EXPORT: 'Xuất', ADJUST: 'Điều chỉnh',
  }

  return (
    <Modal open onClose={onClose} maxWidth={560}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Lịch sử — {supply.name}</h3>
        <button title="Đóng" onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4 }}><X size={18} /></button>
      </div>
      {isLoading && <LoadingState />}
      {error && <div style={{ color: '#c62828', fontSize: 13 }}>{error}</div>}
      {!isLoading && !error && (
        entries.length === 0
          ? <div style={{ color: 'var(--text3)', fontSize: 13, padding: '12px 0' }}>Chưa có lịch sử nào.</div>
          : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--text3)' }}>
                  <th style={{ padding: '6px 8px' }}>Thời gian</th>
                  <th style={{ padding: '6px 8px' }}>Loại</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>+/-</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Tồn sau</th>
                  <th style={{ padding: '6px 8px' }}>Người thực hiện</th>
                  <th style={{ padding: '6px 8px' }}>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(e => (
                  <tr key={e.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{new Date(e.createdAt).toLocaleString('vi-VN')}</td>
                    <td style={{ padding: '6px 8px' }}>{reasonLabel[e.reason]}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: e.changeQty >= 0 ? '#2e7d32' : '#c62828', fontWeight: 600 }}>
                      {e.changeQty >= 0 ? '+' : ''}{e.changeQty}
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{e.quantityAfter}</td>
                    <td style={{ padding: '6px 8px' }}>{e.createdByUserName ?? '—'}</td>
                    <td style={{ padding: '6px 8px', color: 'var(--text3)' }}>{e.note ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
      )}
    </Modal>
  )
}
