import { useState } from 'react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { AlertCircle, Plus, Pencil, ChevronDown, ChevronUp, Save, X, Bell, Mail } from 'lucide-react'
import { format, differenceInCalendarDays } from 'date-fns'

// ── Types ──────────────────────────────────────────────────────────────────────
interface ExportCustomer {
  id: number; name: string; country: string; market: string | null
  contactName: string | null; contactEmail: string | null; note: string | null
}
interface OrderItem { productVariant: { mfgProduct: { name: string } }; quantity: number }
interface ExportOrder {
  id: number; poNumber: string; deliveryDate: string
  status: string; totalValue: number | null; depositAmount: number | null
  portArrivalDate: string | null; paymentStatus: 'UNPAID' | 'DEPOSITED' | 'PAID'
  exportCustomer: { id: number }; items: OrderItem[]
}

const PAY_LABEL: Record<string, string> = { UNPAID: 'Chưa TT', DEPOSITED: 'Đã cọc', PAID: 'Đã trả đủ' }
const PAY_COLOR: Record<string, string> = { UNPAID: '#c62828', DEPOSITED: '#e65100', PAID: '#2e7d32' }
const REMIND_DAYS = 10

const fmt = (n: number | null | undefined) => (n ?? 0).toLocaleString()
// Công nợ 1 đơn = giá trị − cọc (0 khi đã trả đủ)
const debtOf = (o: ExportOrder) => o.paymentStatus === 'PAID' ? 0 : Math.max(0, (o.totalValue ?? 0) - (o.depositAmount ?? 0))
// Nhắc: còn công nợ + có ngày tàu đến + tàu đến trong ≤10 ngày (gồm cả đã trễ)
const isRemind = (o: ExportOrder) => debtOf(o) > 0 && !!o.portArrivalDate && differenceInCalendarDays(new Date(o.portArrivalDate), new Date()) <= REMIND_DAYS

type CustForm = Partial<ExportCustomer>

export default function DanhSachKhachHangPage() {
  const { data: custRaw, isLoading, error, refetch } = useFetch<ExportCustomer[]>(() => api.getMfgExportCustomers(), [])
  const { data: orderRaw, refetch: refetchOrders } = useFetch<ExportOrder[]>(() => api.getExportOrders(), [])
  const customers = Array.isArray(custRaw) ? custRaw : []
  const orders = Array.isArray(orderRaw) ? orderRaw : []

  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [form, setForm] = useState<CustForm | null>(null) // null=đóng; {}=thêm; {id}=sửa
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const ordersOf = (custId: number) => orders.filter((o) => o.exportCustomer?.id === custId)

  const saveCustomer = async () => {
    if (!form?.name?.trim() || !form?.country?.trim()) { setErr('Tên và quốc gia bắt buộc'); return }
    const payload = {
      name: form.name.trim(), country: form.country.trim(),
      market: form.market || undefined, contactName: form.contactName || undefined,
      contactEmail: form.contactEmail?.trim() ? form.contactEmail.trim() : undefined,
      note: form.note || undefined,
    }
    try {
      setBusy(true); setErr('')
      if (form.id) await api.updateMfgExportCustomer(form.id, payload)
      else await api.createMfgExportCustomer(payload)
      setForm(null); refetch()
    } catch (e) {
      const ex = e as { response?: { data?: { error?: string } } }
      setErr(ex?.response?.data?.error ?? 'Lỗi lưu khách hàng')
    } finally { setBusy(false) }
  }

  if (isLoading) return <div style={{ padding: 40, color: 'var(--text3)' }}>Đang tải...</div>
  if (error) return <div style={{ color: '#c62828', display: 'flex', gap: 6 }}><AlertCircle size={16} />Lỗi tải dữ liệu</div>

  const remindCount = orders.filter(isRemind).length

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Danh sách khách hàng</h2>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>{customers.length} khách · lịch sử mua hàng, công nợ, ngày tàu đến</div>
        </div>
        <button onClick={() => { setForm({}); setErr('') }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#e65100', color: '#fff', border: 'none', borderRadius: 'var(--radius)', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
          <Plus size={15} /> Thêm khách
        </button>
      </div>

      {/* Cảnh báo tổng: số đơn cần nhắc */}
      {remindCount > 0 && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#fff3e0', color: '#e65100', padding: '8px 14px', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 600, margin: '8px 0 18px' }}>
          <Bell size={15} /> {remindCount} đơn sắp tới ngày tàu (≤{REMIND_DAYS} ngày) mà khách chưa trả đủ công nợ — nên gọi nhắc.
        </div>
      )}
      {remindCount === 0 && <div style={{ height: 14 }} />}

      {customers.length === 0 && <div style={{ color: 'var(--text3)', fontSize: 13 }}>Chưa có khách hàng nào. Bấm &quot;+ Thêm khách&quot;.</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {customers.map((c) => {
          const myOrders = ordersOf(c.id)
          const totalDebt = myOrders.reduce((s, o) => s + debtOf(o), 0)
          const hasRemind = myOrders.some(isRemind)
          const open = expandedId === c.id
          return (
            <div key={c.id} style={{ background: 'var(--surface)', border: `1px solid ${hasRemind ? '#ffcc80' : 'var(--border)'}`, borderRadius: 'var(--radius)', overflow: 'hidden' }}>
              {/* Customer header */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 12, padding: '12px 16px', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {c.name} <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 400 }}>· {c.country}{c.market ? ` · ${c.market}` : ''}</span>
                    {hasRemind && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 700, background: '#fff3e0', color: '#e65100', padding: '2px 8px', borderRadius: 99 }}><Bell size={11} /> Cần nhắc</span>}
                  </div>
                  {(c.contactName || c.contactEmail) && (
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3, display: 'flex', gap: 12 }}>
                      {c.contactName && <span>{c.contactName}</span>}
                      {c.contactEmail && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Mail size={11} />{c.contactEmail}</span>}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 12, textAlign: 'right' }}>
                  <div style={{ color: 'var(--text3)' }}>Công nợ</div>
                  <div style={{ fontWeight: 700, color: totalDebt > 0 ? '#c62828' : '#2e7d32' }}>{fmt(totalDebt)} USD</div>
                </div>
                <button onClick={() => { setForm(c); setErr('') }} title="Sửa khách" style={{ padding: 6, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer', display: 'flex', color: 'var(--text2)' }}>
                  <Pencil size={14} />
                </button>
                <button onClick={() => setExpandedId(open ? null : c.id)} title="Lịch sử mua hàng" style={{ padding: '6px 10px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text2)' }}>
                  {myOrders.length} đơn {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
              </div>

              {/* Purchase history */}
              {open && (
                <div style={{ borderTop: '1px solid var(--border)', background: 'var(--surface2)', padding: 12 }}>
                  {myOrders.length === 0 ? (
                    <div style={{ color: 'var(--text3)', fontSize: 13, padding: 8 }}>Khách này chưa có đơn hàng.</div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr>
                            <th style={hth}>PO</th>
                            <th style={hth}>Sản phẩm</th>
                            <th style={{ ...hth, textAlign: 'right' }}>Giá trị</th>
                            <th style={{ ...hth, textAlign: 'right' }}>Cọc</th>
                            <th style={{ ...hth, textAlign: 'right' }}>Công nợ</th>
                            <th style={hth}>Ngày tàu đến</th>
                            <th style={hth}>Thanh toán</th>
                            <th style={hth} />
                          </tr>
                        </thead>
                        <tbody>
                          {myOrders.map((o) => (
                            <OrderRow key={o.id} order={o} onSaved={refetchOrders} />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Customer modal */}
      {form && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setForm(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: 24, width: 460, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 18px', fontSize: 16, fontWeight: 700 }}>{form.id ? 'Sửa khách hàng' : 'Thêm khách hàng'}</h3>
            {err && <div style={{ background: '#ffebee', color: '#c62828', padding: '8px 12px', borderRadius: 'var(--radius)', marginBottom: 14, fontSize: 13 }}>{err}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Tên khách *"><input style={inp} value={form.name ?? ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></Field>
              <Field label="Quốc gia *"><input style={inp} value={form.country ?? ''} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} placeholder="US, DE, AU..." /></Field>
              <Field label="Thị trường / kênh"><input style={inp} value={form.market ?? ''} onChange={(e) => setForm((f) => ({ ...f, market: e.target.value }))} /></Field>
              <Field label="Người liên hệ"><input style={inp} value={form.contactName ?? ''} onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))} /></Field>
              <Field label="Email liên hệ"><input style={inp} value={form.contactEmail ?? ''} onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))} /></Field>
              <Field label="Ghi chú"><input style={inp} value={form.note ?? ''} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} /></Field>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setForm(null)} style={{ padding: '8px 16px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: 13 }}>Hủy</button>
              <button onClick={saveCustomer} disabled={busy} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: 'var(--radius)', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                <Save size={14} /> {busy ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── 1 dòng đơn trong lịch sử: hiện + sửa nhanh cọc/TT/ngày tàu ────────────────────
function OrderRow({ order, onSaved }: { order: ExportOrder; onSaved: () => void }) {
  const [editing, setEditing] = useState(false)
  const [tv, setTv] = useState(String(order.totalValue ?? ''))
  const [dep, setDep] = useState(String(order.depositAmount ?? ''))
  const [arr, setArr] = useState(order.portArrivalDate ? order.portArrivalDate.slice(0, 10) : '')
  const [ps, setPs] = useState(order.paymentStatus)
  const [busy, setBusy] = useState(false)
  const debt = debtOf(order)
  const remind = isRemind(order)

  const save = async () => {
    try {
      setBusy(true)
      await api.updateOrderPayment(order.id, {
        totalValue: tv ? Number(tv) : undefined,
        depositAmount: dep ? Number(dep) : undefined,
        portArrivalDate: arr || undefined,
        paymentStatus: ps,
      })
      setEditing(false); onSaved()
    } finally { setBusy(false) }
  }

  if (editing) {
    return (
      <tr style={{ background: 'var(--surface)' }}>
        <td style={dtd}><strong style={{ fontFamily: 'monospace', fontSize: 12 }}>{order.poNumber}</strong></td>
        <td style={dtd} colSpan={1}><span style={{ fontSize: 11, color: 'var(--text3)' }}>{order.items.map((i) => `${i.productVariant?.mfgProduct?.name} ×${i.quantity}`).join(', ')}</span></td>
        <td style={dtd}><input type="number" value={tv} onChange={(e) => setTv(e.target.value)} style={{ ...inp, width: 100, textAlign: 'right' }} /></td>
        <td style={dtd}><input type="number" value={dep} onChange={(e) => setDep(e.target.value)} style={{ ...inp, width: 90, textAlign: 'right' }} /></td>
        <td style={{ ...dtd, textAlign: 'right', color: '#c62828', fontWeight: 700 }}>{fmt(Math.max(0, (Number(tv) || 0) - (Number(dep) || 0)))}</td>
        <td style={dtd}><input type="date" value={arr} onChange={(e) => setArr(e.target.value)} style={{ ...inp, width: 140 }} /></td>
        <td style={dtd}>
          <select value={ps} onChange={(e) => setPs(e.target.value as ExportOrder['paymentStatus'])} style={{ ...inp, width: 110 }}>
            <option value="UNPAID">Chưa TT</option>
            <option value="DEPOSITED">Đã cọc</option>
            <option value="PAID">Đã trả đủ</option>
          </select>
        </td>
        <td style={{ ...dtd, whiteSpace: 'nowrap' }}>
          <button onClick={save} disabled={busy} style={{ padding: 5, background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 'var(--radius)', cursor: 'pointer', marginRight: 4 }}><Save size={13} color="#2e7d32" /></button>
          <button onClick={() => setEditing(false)} style={{ padding: 5, background: '#ffebee', border: '1px solid #ef9a9a', borderRadius: 'var(--radius)', cursor: 'pointer' }}><X size={13} color="#c62828" /></button>
        </td>
      </tr>
    )
  }

  return (
    <tr style={remind ? { background: '#fff8f0' } : undefined}>
      <td style={dtd}><strong style={{ fontFamily: 'monospace', fontSize: 12 }}>{order.poNumber}</strong></td>
      <td style={{ ...dtd, fontSize: 12, color: 'var(--text3)', maxWidth: 200 }}>{order.items.map((i) => `${i.productVariant?.mfgProduct?.name} ×${i.quantity}`).join(', ')}</td>
      <td style={{ ...dtd, textAlign: 'right' }}>{fmt(order.totalValue)}</td>
      <td style={{ ...dtd, textAlign: 'right', color: 'var(--text2)' }}>{fmt(order.depositAmount)}</td>
      <td style={{ ...dtd, textAlign: 'right', fontWeight: 700, color: debt > 0 ? '#c62828' : '#2e7d32' }}>{fmt(debt)}</td>
      <td style={dtd}>
        {order.portArrivalDate
          ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              {format(new Date(order.portArrivalDate), 'dd/MM/yyyy')}
              {remind && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, background: '#fff3e0', color: '#e65100', padding: '1px 6px', borderRadius: 99 }}><Bell size={9} /> nhắc</span>}
            </span>
          : <span style={{ color: 'var(--text3)' }}>—</span>}
      </td>
      <td style={dtd}><span style={{ fontWeight: 600, color: PAY_COLOR[order.paymentStatus] }}>{PAY_LABEL[order.paymentStatus]}</span></td>
      <td style={dtd}>
        <button onClick={() => setEditing(true)} title="Sửa thanh toán" style={{ padding: 5, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer', display: 'flex', color: 'var(--text2)' }}><Pencil size={12} /></button>
      </td>
    </tr>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {children}
    </label>
  )
}

const hth: React.CSSProperties = { textAlign: 'left', padding: '6px 10px', fontSize: 11, color: 'var(--text3)', fontWeight: 600, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
const dtd: React.CSSProperties = { padding: '7px 10px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }
const inp: React.CSSProperties = { padding: '6px 9px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, background: 'var(--surface)', width: '100%', boxSizing: 'border-box' }
