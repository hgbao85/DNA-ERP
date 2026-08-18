import { useState } from 'react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { format } from 'date-fns'
import { Plus, Trash2, X, Check, ChevronLeft, Paperclip } from 'lucide-react'
import type { SalesOrder, SalesOrderStatus, SalesCustomer } from '../../../types/sales'
import { SALES_ORDER_STATUS_LABEL, SALES_PRODUCTION_STAGES } from '../../../types/sales'
import type { Sku } from '../../../types/sku'
import { StatusBadge } from './StatusBadge'
import SearchableSelect from '../../../components/SearchableSelect'

const fmtMoney = (n: number) => n.toLocaleString('vi-VN')

type ItemDraft = { skuCode: string; skuName: string; totalQty: string; deliveryDate: string }
const EMPTY_ITEM: ItemDraft = { skuCode: '', skuName: '', totalQty: '', deliveryDate: '' }
type FormState = {
  customerId: string; orderDate: string; note: string
  attachmentName: string; attachmentUrl: string
  items: ItemDraft[]
}
const emptyForm = (): FormState => ({
  customerId: '', orderDate: new Date().toISOString().slice(0, 10), note: '',
  attachmentName: '', attachmentUrl: '',
  items: [{ ...EMPTY_ITEM }],
})

export default function OrderManagementPage() {
  const { data: pos, isLoading, error, refetch } = useFetch<SalesOrder[]>(() => api.getSalesOrders())
  const { data: customers } = useFetch<SalesCustomer[]>(() => api.getSalesCustomers())
  const { data: skus } = useFetch<Sku[]>(() => api.getSkus())
  const [showCreate, setShowCreate] = useState(false)
  const [detailPO, setDetailPO] = useState<SalesOrder | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)

  // SKU đã duyệt (danh sách SKU của productplan@demo.com) — nguồn chọn SKU khi tạo PO
  const skuOptions = (() => {
    const byCode = new Map<string, { code: string; name: string }>()
    for (const pf of skus ?? []) {
      if (pf.status === 'APPROVED' && pf.mfgProduct) {
        byCode.set(pf.mfgProduct.factoryCode, { code: pf.mfgProduct.factoryCode, name: pf.mfgProduct.name })
      }
    }
    return [...byCode.values()]
  })()

  // SKU đã duyệt, đã gán sẵn cho 1 khách hàng cụ thể (customerName nhập lúc "Tạo SKU mới")
  // và CHƯA gắn PO nào (exportOrderId null) — nguồn auto-fill "SKU trong PO" khi chọn khách hàng.
  const skusForCustomer = (customerName: string) => {
    const key = customerName.trim().toLowerCase()
    if (!key) return []
    return (skus ?? []).filter((pf) =>
      pf.status === 'APPROVED' && !pf.exportOrderId && pf.mfgProduct &&
      (pf.customerName ?? '').trim().toLowerCase() === key
    )
  }

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
      const customer = (customers ?? []).find((c) => String(c.id) === form.customerId)
      const items = form.items
        .filter((it) => it.skuCode.trim())
        .map((it) => ({
          skuCode: it.skuCode.trim(),
          skuName: it.skuName.trim() || undefined,
          totalQty: Number(it.totalQty) || 0,
          shippedQty: 0,
          status: 'LEN_KE_HOACH' as SalesOrderStatus,
          deliveryDate: it.deliveryDate ? new Date(it.deliveryDate).toISOString() : '',
        }))
      // Hạn giao PO = hạn giao xa nhất trong các SKU
      const deliveryDate = items.reduce((latest, it) => (
        it.deliveryDate && (!latest || it.deliveryDate > latest) ? it.deliveryDate : latest
      ), '')
      const payload = {
        customerId: form.customerId,
        customerName: customer?.name ?? '',
        orderDate: new Date(form.orderDate).toISOString(),
        deliveryDate,
        attachmentName: form.attachmentName || undefined,
        attachmentUrl: form.attachmentUrl || undefined,
        note: form.note.trim() || undefined,
        items,
      }
      await api.createSalesOrder(payload)
      await refetch()
      setShowCreate(false)
    } finally {
      setSaving(false)
    }
  }

  const toggleDeposit = async (e: React.MouseEvent, po: SalesOrder) => {
    e.stopPropagation()
    await api.updateSalesOrder(po.id, { depositConfirmed: !po.depositConfirmed })
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
              const notDoneCount = po.items.length - doneCount
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
                  <td style={{ padding: '10px 12px', fontSize: 12 }}>
                    <span style={{ fontWeight: 700, color: '#15803d' }}>{doneCount}</span>
                    <span style={{ color: 'var(--text3)' }}> xong</span>
                    <span style={{ color: 'var(--text3)' }}> · </span>
                    <span style={{ fontWeight: 700, color: notDoneCount > 0 ? '#b45309' : 'var(--text3)' }}>{notDoneCount}</span>
                    <span style={{ color: 'var(--text3)' }}> chưa xong</span>
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
                <SearchableSelect
                  displayValue={(customers ?? []).find(c => String(c.id) === form.customerId)?.name ?? ''}
                  options={customers ?? []}
                  getKey={c => String(c.id)}
                  getSearchText={c => `${c.name} ${c.phone}`}
                  renderOption={c => <><strong>{c.name}</strong> <span style={{ color: 'var(--text3)' }}>— {c.phone}</span></>}
                  onSelect={c => setForm(f => {
                    const preAssigned = skusForCustomer(c.name)
                    return {
                      ...f,
                      customerId: String(c.id),
                      // Khách hàng đã có sẵn SKU đã duyệt (gán lúc "Tạo SKU mới") thì tự fill vào
                      // "SKU trong PO" luôn, khỏi phải tìm/chọn lại thủ công từng dòng.
                      items: preAssigned.length > 0
                        ? preAssigned.map((pf) => ({
                            skuCode: pf.mfgProduct!.factoryCode,
                            skuName: pf.mfgProduct!.name,
                            totalQty: '',
                            deliveryDate: '',
                          }))
                        : f.items,
                    }
                  })}
                  placeholder="Tìm hoặc chọn khách hàng *"
                  emptyText="Không tìm thấy khách hàng"
                />
              </Field>
              <Field label="Ngày đặt">
                <input type="date" value={form.orderDate} onChange={e => setForm(f => ({ ...f, orderDate: e.target.value }))} />
              </Field>
            </div>

            <div style={{ marginBottom: 20 }}>
              <Field label="File đính kèm (PO, hợp đồng...)">
                <input
                  type="file"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    setForm(f => ({ ...f, attachmentName: file?.name ?? '', attachmentUrl: file ? URL.createObjectURL(file) : '' }))
                  }}
                />
              </Field>
              {form.attachmentName && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text2)', marginTop: 6 }}>
                  <Paperclip size={12} /> {form.attachmentName}
                </div>
              )}
            </div>

            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', marginBottom: 8 }}>SKU trong PO</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 135px 100px 28px', gap: 6, marginBottom: 6 }}>
              {['SKU', 'Hạn giao', 'Tổng số', ''].map(h => (
                <div key={h} style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)' }}>{h}</div>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
              {form.items.map((it, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.6fr 135px 100px 28px', gap: 6, alignItems: 'center' }}>
                  <SearchableSelect
                    displayValue={it.skuCode ? `${it.skuCode} — ${it.skuName}` : ''}
                    options={skuOptions}
                    getKey={o => o.code}
                    getSearchText={o => `${o.code} ${o.name}`}
                    renderOption={o => <><strong>{o.code}</strong> <span style={{ color: 'var(--text3)' }}>— {o.name}</span></>}
                    onSelect={o => setItem(i, { skuCode: o.code, skuName: o.name })}
                    placeholder="Tìm hoặc chọn SKU đã duyệt *"
                    emptyText="Không tìm thấy SKU đã duyệt"
                  />
                  <input type="date" value={it.deliveryDate} onChange={e => setItem(i, { deliveryDate: e.target.value })} title="Hạn giao" />
                  <input type="number" value={it.totalQty} onChange={e => setItem(i, { totalQty: e.target.value })} placeholder="Tổng số" />
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

function PODetailView({ po, onBack }: { po: SalesOrder; onBack: () => void }) {
  const [tab, setTab] = useState<DetailTab>('production')

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
        {po.attachmentUrl && (
          <a href={po.attachmentUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--blue)', textDecoration: 'none', marginTop: 6 }}>
            <Paperclip size={12} /> {po.attachmentName || 'File đính kèm'}
          </a>
        )}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginBottom: 10 }}>
                  <strong>{item.skuCode}</strong>{item.skuName ? <span style={{ color: 'var(--text3)' }}> — {item.skuName}</span> : ''}
                  <StatusBadge status={item.status} />
                </div>
                <ProductionStepper status={item.status} />
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'shipping' && (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 18 }}>
            {po.items.map((item) => {
              const itemRemaining = item.totalQty - item.shippedQty
              return (
                <div key={item.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginBottom: 8 }}>
                    <strong>{item.skuCode}</strong>{item.skuName ? <span style={{ color: 'var(--text3)' }}> — {item.skuName}</span> : ''}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                    <StatTile label="Tổng số lượng" value={item.totalQty.toLocaleString()} />
                    <StatTile label="Đã xuất hàng" value={item.shippedQty.toLocaleString()} />
                    <StatTile label="Còn lại" value={itemRemaining.toLocaleString()} />
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
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

function ProductionStepper({ status }: { status: SalesOrderStatus }) {
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
                {SALES_ORDER_STATUS_LABEL[stage]}
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

// ── Combobox tìm kiếm dùng chung: nhập để tìm hoặc mở dropdown để chọn ───────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  )
}
