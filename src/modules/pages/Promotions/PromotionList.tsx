import { useState } from 'react'
import { format, isAfter, isBefore } from 'date-fns'
import { useFetch } from '../../../hooks/useFetch'
import { getPromotions, createPromotion, updatePromotion, deletePromotion } from '../../../services/api'
import { useAuth } from '../../../context/AuthContext'
import type { Promotion } from '../../../types'
import { Plus, X, Pencil, Trash2, Users, Building2 } from 'lucide-react'

// ─── Helpers ───────────────────────────────────────────────────────────────

function promotionStatus(p: Promotion): { label: string; bg: string; color: string } {
  const now = new Date()
  const start = new Date(p.startDate)
  const end = new Date(p.endDate)
  if (isBefore(now, start)) return { label: 'Sắp diễn ra', bg: '#dbeafe', color: '#1d4ed8' }
  if (isAfter(now, end))    return { label: 'Đã kết thúc', bg: 'var(--surface2)', color: 'var(--text3)' }
  return { label: 'Đang chạy', bg: '#dcfce7', color: '#15803d' }
}

function OrderTypeBadge({ type }: { type: string }) {
  const isRetail = type === 'RETAIL'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: isRetail ? '#f0fdf4' : '#eff6ff', color: isRetail ? '#15803d' : '#1d4ed8', border: isRetail ? '1px solid #bbf7d0' : '1px solid #bfdbfe' }}>
      {isRetail ? <Users size={10} /> : <Building2 size={10} />}
      {isRetail ? 'Khách lẻ' : 'Khách sỉ'}
    </span>
  )
}

// ─── Form Modal ─────────────────────────────────────────────────────────────

type FormData = {
  name: string; description: string; orderType: string; startDate: string; endDate: string;
}

const EMPTY: FormData = { name: '', description: '', orderType: 'RETAIL', startDate: '', endDate: '' }

function PromotionFormModal({
  initial, onClose, onSaved,
}: {
  initial: Promotion | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<FormData>(
    initial
      ? {
          name: initial.name,
          description: initial.description,
          orderType: initial.orderType,
          startDate: initial.startDate.slice(0, 10),
          endDate: initial.endDate.slice(0, 10),
        }
      : EMPTY
  )
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const set = (k: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async () => {
    setErr('')
    if (form.endDate <= form.startDate) {
      setErr('Ngày kết thúc phải sau ngày bắt đầu')
      return
    }
    setSaving(true)
    try {
      if (initial) await updatePromotion(initial.id, form)
      else await createPromotion(form)
      onSaved()
      onClose()
    } finally { setSaving(false) }
  }

  const isValid = form.name && form.description && form.startDate && form.endDate

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 10, width: 520, padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{initial ? 'Cập nhật ưu đãi' : 'Tạo chương trình ưu đãi'}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 5 }}>Tên chương trình *</label>
            <input value={form.name} onChange={set('name')} placeholder="VD: Giảm 10% mùa hè 2026" style={{ width: '100%' }} />
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 5 }}>Mô tả *</label>
            <textarea value={form.description} onChange={set('description')} rows={3} placeholder="Chi tiết điều kiện, sản phẩm áp dụng..." style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, resize: 'vertical' }} />
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 5 }}>Áp dụng cho</label>
            <select value={form.orderType} onChange={set('orderType')} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', fontSize: 13 }}>
              <option value="RETAIL">Khách lẻ (B2C)</option>
              <option value="WHOLESALE">Khách sỉ (B2B)</option>
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px' }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 5 }}>Ngày bắt đầu *</label>
              <input type="date" value={form.startDate} onChange={set('startDate')} style={{ width: '100%' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 5 }}>Ngày kết thúc *</label>
              <input type="date" value={form.endDate} onChange={set('endDate')} style={{ width: '100%' }} />
            </div>
          </div>

          {err && <div style={{ color: '#dc2626', fontSize: 12 }}>{err}</div>}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ padding: '8px 18px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'transparent', cursor: 'pointer' }}>Hủy</button>
          <button className="primary" onClick={handleSubmit} disabled={saving || !isValid}>
            {saving ? 'Đang lưu...' : 'Lưu'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Confirm Delete ─────────────────────────────────────────────────────────

function ConfirmDeleteModal({ name, onConfirm, onClose }: { name: string; onConfirm: () => void; onClose: () => void }) {
  const [loading, setLoading] = useState(false)
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 10, width: 380, padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 10 }}>Xác nhận xóa</div>
        <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20 }}>
          Bạn có chắc muốn xóa chương trình <strong>"{name}"</strong>? Hành động này không thể hoàn tác.
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ padding: '8px 18px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'transparent', cursor: 'pointer' }}>Hủy</button>
          <button onClick={async () => { setLoading(true); await onConfirm(); }} disabled={loading}
            style={{ padding: '8px 18px', border: 'none', borderRadius: 'var(--radius)', background: '#dc2626', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
            {loading ? 'Đang xóa...' : 'Xóa'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function PromotionList() {
  const { user } = useAuth()
  const isManager = user?.role === 'MANAGER'

  const { data: promotions, isLoading, error, refetch } = useFetch<Promotion[]>(getPromotions)

  const [formPromotion, setFormPromotion] = useState<Promotion | 'new' | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [activeFilter, setActiveFilter] = useState<'all' | 'RETAIL' | 'WHOLESALE' | 'history'>('all')

  if (isLoading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Đang tải...</div>
  if (error) return <div style={{ padding: 40, color: '#E24B4A' }}>Lỗi: {error}</div>

  const list = promotions ?? []
  const active = list.filter(p => promotionStatus(p).label !== 'Đã kết thúc')
  const ended  = list.filter(p => promotionStatus(p).label === 'Đã kết thúc')

  const filtered =
    activeFilter === 'history' ? ended :
    activeFilter === 'all'     ? active :
    active.filter(p => p.orderType === activeFilter)

  const deletingPromotion = deletingId !== null ? list.find(p => p.id === deletingId) : null

  const handleDelete = async () => {
    if (deletingId === null) return
    await deletePromotion(deletingId)
    setDeletingId(null)
    await refetch()
  }

  const running  = active.filter(p => promotionStatus(p).label === 'Đang chạy').length
  const upcoming = active.filter(p => promotionStatus(p).label === 'Sắp diễn ra').length

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 18 }}>Chương trình Ưu đãi</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
            {running > 0 && <span style={{ color: '#15803d', fontWeight: 600 }}>{running} đang chạy</span>}
            {running > 0 && upcoming > 0 && ' · '}
            {upcoming > 0 && <span style={{ color: '#1d4ed8' }}>{upcoming} sắp diễn ra</span>}
            {running === 0 && upcoming === 0 && activeFilter !== 'history' && `${active.length} chương trình`}
            {activeFilter === 'history' && <span style={{ color: 'var(--text3)' }}>{ended.length} đã kết thúc</span>}
          </div>
        </div>
        {isManager && activeFilter !== 'history' && (
          <button className="primary" onClick={() => setFormPromotion('new')} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={14} /> Tạo ưu đãi
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {([['all', 'Tất cả'], ['RETAIL', 'Khách lẻ'], ['WHOLESALE', 'Khách sỉ'], ['history', 'Lịch sử']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setActiveFilter(id)}
            style={{ padding: '6px 14px', border: `1px solid ${activeFilter === id ? (id === 'history' ? 'var(--text3)' : 'var(--blue)') : 'var(--border)'}`, borderRadius: 20, background: activeFilter === id ? (id === 'history' ? 'var(--surface2)' : 'var(--blue-bg)') : 'transparent', color: activeFilter === id ? (id === 'history' ? 'var(--text2)' : 'var(--blue)') : 'var(--text2)', fontWeight: activeFilter === id ? 600 : 400, fontSize: 12, cursor: 'pointer' }}>
            {label}{id === 'history' && ended.length > 0 && ` (${ended.length})`}
          </button>
        ))}
      </div>

      {/* Cards grid */}
      {filtered.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Chưa có chương trình ưu đãi nào</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {filtered.map((p: Promotion) => {
            const status = promotionStatus(p)
            return (
              <div key={p.id} className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.3 }}>{p.name}</div>
                  <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: status.bg, color: status.color }}>{status.label}</span>
                </div>

                <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>{p.description}</div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <OrderTypeBadge type={p.orderType} />
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                    {format(new Date(p.startDate), 'dd/MM/yyyy')} → {format(new Date(p.endDate), 'dd/MM/yyyy')}
                  </span>
                </div>

                {isManager && (
                  <div style={{ display: 'flex', gap: 8, paddingTop: 4, borderTop: '1px solid var(--border)' }}>
                    <button onClick={() => setFormPromotion(p)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'transparent', cursor: 'pointer', fontSize: 12 }}>
                      <Pencil size={12} /> Sửa
                    </button>
                    <button onClick={() => setDeletingId(p.id)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', border: '1px solid #fca5a5', borderRadius: 'var(--radius)', background: 'transparent', color: '#dc2626', cursor: 'pointer', fontSize: 12 }}>
                      <Trash2 size={12} /> Xóa
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {formPromotion && (
        <PromotionFormModal
          initial={formPromotion === 'new' ? null : formPromotion}
          onClose={() => setFormPromotion(null)}
          onSaved={refetch}
        />
      )}

      {deletingPromotion && (
        <ConfirmDeleteModal
          name={deletingPromotion.name}
          onConfirm={handleDelete}
          onClose={() => setDeletingId(null)}
        />
      )}
    </div>
  )
}
