import { useState } from 'react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { format } from 'date-fns'
import { Plus, Trash2, X, Check, ChevronLeft } from 'lucide-react'
import type { SalesPO, SalesPOStatus, SalesCustomer } from '../../../types/sales'
import { SALES_PO_STATUS_LABEL, SALES_PO_STATUS_ORDER, SALES_PRODUCTION_STAGES } from '../../../types/sales'
import { StatusBadge } from './StatusBadge'

const fmtMoney = (n: number) => n.toLocaleString('vi-VN')

type ItemDraft = { skuCode: string; skuName: string; totalQty: string; shippedQty: string; status: SalesPOStatus }
const EMPTY_ITEM: ItemDraft = { skuCode: '', skuName: '', totalQty: '', shippedQty: '0', status: 'MUA_HANG' }
type FormState = {
  customerId: string; orderDate: string; deliveryDate: string; note: string
  totalValue: string; depositAmount: string; depositConfirmed: boolean; paidAmount: string
  items: ItemDraft[]
}
const emptyForm = (): FormState => ({
  customerId: '', orderDate: new Date().toISOString().slice(0, 10), deliveryDate: '', note: '',
  totalValue: '', depositAmount: '', depositConfirmed: false, paidAmount: '',
  items: [{ ...EMPTY_ITEM }],
})

export default function OrderManagementPage() {
  const { data: pos, isLoading, error, refetch } = useFetch<SalesPO[]>(() => api.getSalesPOs())
  const { data: customers } = useFetch<SalesCustomer[]>(() => api.getSalesCustomers())
  const [showCreate, setShowCreate] = useState(false)
  const [detailPO, setDetailPO] = useState<SalesPO | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)

  const openNew = () => { setForm(emptyForm()); setShowCreate(true) }

  const setItem = (i: number, patch: Partial<ItemDraft>) => {
    setForm((f) => ({ ...f, items: f.items.map((it, idx) => idx === i ? { ...it, ...patch } : it) }))
  }
  const addItem = () => setForm((f) => ({ ...f, items: [...f.items, { ...EMPTY_ITEM }] }))
  const removeItem = (i: number) => setForm((f) => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }))

  const handleSave = async () => {
    if (!form.customerId || form.items.length === 0) return
    setSaving(true)
    try {
      const customer = (customers ?? []).find((c) => c.id === Number(form.customerId))
      const payload = {
        customerId: Number(form.customerId),
        customerName: customer?.name ?? '',
        orderDate: new Date(form.orderDate).toISOString(),
        deliveryDate: form.deliveryDate ? new Date(form.deliveryDate).toISOString() : '',
        totalValue: Number(form.totalValue) || 0,
        depositAmount: Number(form.depositAmount) || 0,
        depositConfirmed: form.depositConfirmed,
        paidAmount: Number(form.paidAmount) || 0,
        note: form.note.trim() || undefined,
        items: form.items
          .filter((it) => it.skuCode.trim())
          .map((it) => ({
            skuCode: it.skuCode.trim(),
            skuName: it.skuName.trim() || undefined,
            totalQty: Number(it.totalQty) || 0,
            shippedQty: Number(it.shippedQty) || 0,
            status: it.status,
          })),
      }
      await api.createSalesPO(payload)
      await refetch()
      setShowCreate(false)
    } finally {
      setSaving(false)
    }
  }

  const toggleDeposit = async (e: React.MouseEvent, po: SalesPO) => {
    e.stopPropagation()
    await api.updateSalesPO(po.id, { depositConfirmed: !po.depositConfirmed })
    await refetch()
  }

  if (isLoading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Đang tải...</div>
  if (error) return <div style={{ padding: 40, color: '#E24B4A' }}>Lỗi: {error}</div>

  if (detailPO) {
    return <PODetailView po={detailPO} onBack={() => setDetailPO(null)} />
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 18 }}>Quản lí đơn hàng</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{pos?.length ?? 0} PO</div>
        </div>
        <button className="primary" onClick={openNew} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={14} /> Tạo PO
        </button>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
              {['PO', 'Khách hàng', 'SKU', 'Số lượng', 'Hạn giao', 'Trạng thái', 'Xác nhận cọc'].map(h => (
                <th key={h} style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(pos ?? []).map((po) => {
              const totalQty = po.items.reduce((s, it) => s + it.totalQty, 0)
              const doneCount = po.items.filter((it) => it.status === 'HOAN_THANH').length
              const allDone = doneCount === po.items.length && po.items.length > 0
              const activeStatus = allDone ? 'HOAN_THANH' : po.items.map((it) => it.status).sort((a, b) => SALES_PO_STATUS_ORDER.indexOf(a) - SALES_PO_STATUS_ORDER.indexOf(b))[0]
              return (
                <tr
                  key={po.id}
                  onClick={() => setDetailPO(po)}
                  style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--blue)' }}>{po.code}</td>
                  <td style={{ padding: '10px 12px', fontSize: 13 }}>{po.customerName}</td>
                  <td style={{ padding: '10px 12px', fontSize: 13 }}>{po.items.length} SKU</td>
                  <td style={{ padding: '10px 12px', fontWeight: 600, fontSize: 13 }}>{totalQty.toLocaleString()}</td>
                  <td style={{ padding: '10px 12px', fontSize: 12 }}>{po.deliveryDate ? format(new Date(po.deliveryDate), 'dd/MM/yyyy') : '—'}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <StatusBadge status={activeStatus} />
                    {!allDone && <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 6 }}>({doneCount}/{po.items.length} SKU xong)</span>}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <button
                      onClick={(e) => toggleDeposit(e, po)}
                      style={{
                        fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, cursor: 'pointer', border: 'none',
                        background: po.depositConfirmed ? '#dcfce7' : '#fef3c7',
                        color: po.depositConfirmed ? '#15803d' : '#b45309',
                      }}
                    >
                      {po.depositConfirmed ? 'Đã xác nhận cọc' : 'Chưa xác nhận'}
                    </button>
                  </td>
                </tr>
              )
            })}
            {(pos ?? []).length === 0 && (
              <tr><td colSpan={7} style={{ padding: 20, textAlign: 'center', color: 'var(--text3)' }}>Chưa có PO nào</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 10, width: 680, maxHeight: '90vh', overflowY: 'auto', padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Tạo PO mới</div>
              <button onClick={() => setShowCreate(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
              <Field label="Khách hàng *">
                <select value={form.customerId} onChange={e => setForm(f => ({ ...f, customerId: e.target.value }))}>
                  <option value="">— Chọn khách hàng —</option>
                  {(customers ?? []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Ngày đặt">
                <input type="date" value={form.orderDate} onChange={e => setForm(f => ({ ...f, orderDate: e.target.value }))} />
              </Field>
              <Field label="Hạn giao">
                <input type="date" value={form.deliveryDate} onChange={e => setForm(f => ({ ...f, deliveryDate: e.target.value }))} />
              </Field>
              <Field label="Tổng giá trị PO (VNĐ)">
                <input type="number" value={form.totalValue} onChange={e => setForm(f => ({ ...f, totalValue: e.target.value }))} placeholder="0" />
              </Field>
              <Field label="Tiền cọc (VNĐ)">
                <input type="number" value={form.depositAmount} onChange={e => setForm(f => ({ ...f, depositAmount: e.target.value }))} placeholder="0" />
              </Field>
              <Field label="Đã thanh toán (VNĐ, gồm cọc)">
                <input type="number" value={form.paidAmount} onChange={e => setForm(f => ({ ...f, paidAmount: e.target.value }))} placeholder="0" />
              </Field>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 20, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.depositConfirmed} onChange={e => setForm(f => ({ ...f, depositConfirmed: e.target.checked }))} />
              Đã xác nhận cọc
            </label>

            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', marginBottom: 8 }}>SKU trong PO</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
              {form.items.map((it, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px 80px 1fr 28px', gap: 6, alignItems: 'center' }}>
                  <input value={it.skuCode} onChange={e => setItem(i, { skuCode: e.target.value })} placeholder="Mã SKU *" />
                  <input value={it.skuName} onChange={e => setItem(i, { skuName: e.target.value })} placeholder="Tên SKU" />
                  <input type="number" value={it.totalQty} onChange={e => setItem(i, { totalQty: e.target.value })} placeholder="Tổng số" />
                  <input type="number" value={it.shippedQty} onChange={e => setItem(i, { shippedQty: e.target.value })} placeholder="Đã xuất" />
                  <select value={it.status} onChange={e => setItem(i, { status: e.target.value as SalesPOStatus })}>
                    {SALES_PO_STATUS_ORDER.map(s => <option key={s} value={s}>{SALES_PO_STATUS_LABEL[s]}</option>)}
                  </select>
                  <button onClick={() => removeItem(i)} disabled={form.items.length === 1} style={{ padding: 4, background: 'transparent', border: 'none', cursor: form.items.length === 1 ? 'not-allowed' : 'pointer', opacity: form.items.length === 1 ? 0.3 : 1, display: 'flex' }}>
                    <Trash2 size={13} color="#E24B4A" />
                  </button>
                </div>
              ))}
            </div>
            <button onClick={addItem} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 10px', fontSize: 12, border: '1px dashed var(--border)', borderRadius: 'var(--radius)', background: 'transparent', cursor: 'pointer', color: 'var(--text2)', marginBottom: 16 }}>
              <Plus size={12} /> Thêm SKU
            </button>

            <Field label="Ghi chú">
              <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Ghi chú" />
            </Field>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
              <button onClick={() => setShowCreate(false)} style={{ padding: '8px 18px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'transparent', cursor: 'pointer' }}>Hủy</button>
              <button className="primary" onClick={handleSave} disabled={saving || !form.customerId || form.items.every(it => !it.skuCode.trim())}>
                {saving ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Trang chi tiết: Chi tiết sản xuất + Chi tiết xuất hàng (2 tab riêng) ─────
type DetailTab = 'production' | 'shipping'

function PODetailView({ po, onBack }: { po: SalesPO; onBack: () => void }) {
  const [tab, setTab] = useState<DetailTab>('production')

  const totalQty = po.items.reduce((s, it) => s + it.totalQty, 0)
  const shippedQty = po.items.reduce((s, it) => s + it.shippedQty, 0)
  const remainingQty = totalQty - shippedQty
  const paidExcludingDeposit = po.paidAmount - po.depositAmount
  const remainingAmount = po.totalValue - po.paidAmount

  const TABS: { id: DetailTab; label: string }[] = [
    { id: 'production', label: 'Chi tiết sản xuất' },
    { id: 'shipping', label: 'Chi tiết xuất hàng' },
  ]

  return (
    <div>
      <button
        onClick={onBack}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 12px', fontSize: 12, fontWeight: 500, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text2)', marginBottom: 14 }}
      >
        <ChevronLeft size={13} /> Danh sách đơn hàng
      </button>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 18 }}>{po.code} — {po.customerName}</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
          Ngày đặt {format(new Date(po.orderDate), 'dd/MM/yyyy')}
          {po.deliveryDate && <> · Hạn giao {format(new Date(po.deliveryDate), 'dd/MM/yyyy')}</>}
        </div>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 20px', border: 'none',
              borderBottom: tab === t.id ? '2px solid var(--blue)' : '2px solid transparent',
              background: 'transparent',
              color: tab === t.id ? 'var(--blue)' : 'var(--text3)',
              fontWeight: tab === t.id ? 600 : 400,
              fontSize: 13, cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'production' && (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {po.items.map((item) => (
              <div key={item.id}>
                <div style={{ fontSize: 12, marginBottom: 10 }}>
                  <strong>{item.skuCode}</strong>{item.skuName ? <span style={{ color: 'var(--text3)' }}> — {item.skuName}</span> : ''}
                </div>
                <ProductionStepper status={item.status} />
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'shipping' && (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
            <StatTile label="Tổng số lượng" value={totalQty.toLocaleString()} />
            <StatTile label="Đã xuất hàng" value={shippedQty.toLocaleString()} />
            <StatTile label="Còn lại" value={remainingQty.toLocaleString()} />
            <StatTile label="Đã thanh toán (trừ cọc)" value={`${fmtMoney(paidExcludingDeposit)}đ`} />
            <StatTile label="Số tiền còn lại" value={`${fmtMoney(remainingAmount)}đ`} color={remainingAmount > 0 ? '#A32D2D' : '#3B6D11'} />
          </div>
        </div>
      )}
    </div>
  )
}

function StatTile({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: 'var(--surface2)', borderRadius: 'var(--radius)', padding: '10px 12px' }}>
      <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: color ?? 'var(--text)' }}>{value}</div>
    </div>
  )
}

function ProductionStepper({ status }: { status: SalesPOStatus }) {
  const doneIndex = status === 'HOAN_THANH' ? SALES_PRODUCTION_STAGES.length : SALES_PRODUCTION_STAGES.indexOf(status)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start' }}>
      {SALES_PRODUCTION_STAGES.map((stage, i) => {
        const isDone = i < doneIndex
        const isActive = i === doneIndex
        const isLast = i === SALES_PRODUCTION_STAGES.length - 1
        return (
          <div key={stage} style={{ display: 'flex', alignItems: 'flex-start', flex: isLast ? '0 0 auto' : 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, minWidth: 66 }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isDone ? '#15803d' : isActive ? '#1565c0' : 'var(--surface2)',
                color: isDone || isActive ? '#fff' : 'var(--text3)',
                fontSize: 11, fontWeight: 700, flexShrink: 0,
              }}>
                {isDone ? <Check size={12} /> : i + 1}
              </div>
              <div style={{ fontSize: 10, color: isActive ? '#1565c0' : isDone ? '#15803d' : 'var(--text3)', fontWeight: isActive ? 700 : 500, textAlign: 'center' }}>
                {SALES_PO_STATUS_LABEL[stage]}
              </div>
            </div>
            {!isLast && (
              <div style={{ flex: 1, height: 2, background: isDone ? '#15803d' : 'var(--border)', marginTop: 10 }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  )
}
