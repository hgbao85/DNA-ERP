import { useState } from 'react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { AlertCircle, Plus, Pencil, Power, Save, X } from 'lucide-react'

interface WeavingPoint {
  id: number; code: string; fullName: string | null; aliasNote: string | null
  phone: string | null; address: string | null
  dayDaiPercent: number; ketThucPercent: number; hangQuanPercent: number
  note: string | null; isActive: boolean
}
type FormState = Partial<WeavingPoint>

const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', fontSize: 12, color: 'var(--text3)', fontWeight: 600, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '8px 10px', fontSize: 13, borderBottom: '1px solid var(--border)', verticalAlign: 'top' }
const inp: React.CSSProperties = { padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, background: 'var(--surface)', width: '100%', boxSizing: 'border-box' }

// readOnly: chỉ xem (tab "Điểm đan" bên Quản lý SX). embedded: ẩn tiêu đề riêng (dùng trong
// tab con "Thông tin điểm đan" của màn "Quản lý điểm đan" — tiêu đề do màn cha cung cấp).
export default function WeavingPointsPage({ readOnly = false, embedded = false }: { readOnly?: boolean; embedded?: boolean } = {}) {
  const { data, isLoading, error, refetch } = useFetch<WeavingPoint[]>(() => api.getWeavingPoints(true), [])
  const points = Array.isArray(data) ? data : []
  const [form, setForm] = useState<FormState | null>(null) // null = đóng; {} = thêm mới; {id} = sửa
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const set = (k: keyof WeavingPoint, v: string | number) => setForm((f) => ({ ...f, [k]: v }))

  const save = async () => {
    if (!form?.code?.trim()) { setErr('Tên điểm đan không được trống'); return }
    try {
      setBusy(true); setErr('')
      const payload = {
        code: form.code, fullName: form.fullName, aliasNote: form.aliasNote, phone: form.phone, address: form.address,
        note: form.note,
      }
      if (form.id) await api.updateWeavingPoint(form.id, payload)
      else await api.createWeavingPoint(payload)
      setForm(null); refetch()
    } catch (e) {
      const ex = e as { response?: { data?: { error?: string } } }
      setErr(ex?.response?.data?.error ?? 'Lỗi lưu')
    } finally { setBusy(false) }
  }

  const toggleActive = async (p: WeavingPoint) => {
    try { setBusy(true); setErr(''); await api.updateWeavingPoint(p.id, { isActive: !p.isActive }); refetch() }
    catch (e) {
      const ex = e as { response?: { data?: { error?: string } } }
      setErr(ex?.response?.data?.error ?? 'Lỗi cập nhật')
    } finally { setBusy(false) }
  }

  if (isLoading) return <div style={{ padding: 40, color: 'var(--text3)' }}>Đang tải...</div>
  if (error) return <div style={{ color: '#c62828', display: 'flex', gap: 6 }}><AlertCircle size={16} />Lỗi tải dữ liệu</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12 }}>
        <div>
          {!embedded && <h2 style={{ margin: '0 0 2px', fontSize: 20, fontWeight: 700 }}>Điểm đan</h2>}
          {!embedded && <p style={{ margin: 0, fontSize: 13, color: 'var(--text3)' }}>Danh sách điểm gia công đan thuê ngoài.</p>}
        </div>
        {!readOnly && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <ConfigBar />
            <button onClick={() => { setForm({}); setErr('') }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#e65100', color: '#fff', border: 'none', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <Plus size={15} /> Thêm điểm đan
            </button>
          </div>
        )}
      </div>

      {err && <div style={{ background: '#ffebee', color: '#c62828', padding: '8px 12px', borderRadius: 'var(--radius)', marginBottom: 14, fontSize: 13 }}>{err}</div>}

      {form && (
        <div style={{ background: 'var(--surface)', border: '1px solid #e65100', borderRadius: 'var(--radius-lg)', padding: 16, marginBottom: 18 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>{form.id ? 'Sửa điểm đan' : 'Thêm điểm đan'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            <Field label="Tên điểm đan *"><input style={inp} value={form.code ?? ''} onChange={(e) => set('code', e.target.value)} /></Field>
            <Field label="Tên đầy đủ (pháp nhân)"><input style={inp} value={form.fullName ?? ''} onChange={(e) => set('fullName', e.target.value)} /></Field>
            <Field label="Tên gọi khác / mã cũ"><input style={inp} value={form.aliasNote ?? ''} onChange={(e) => set('aliasNote', e.target.value)} /></Field>
            <Field label="SĐT"><input style={inp} value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} /></Field>
            <Field label="Địa chỉ"><input style={inp} value={form.address ?? ''} onChange={(e) => set('address', e.target.value)} /></Field>
            <Field label="Ghi chú"><input style={inp} value={form.note ?? ''} onChange={(e) => set('note', e.target.value)} /></Field>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button onClick={save} disabled={busy} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}><Save size={14} /> Lưu</button>
            <button onClick={() => { setForm(null); setErr('') }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}><X size={14} /> Hủy</button>
          </div>
        </div>
      )}

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Điểm đan</th>
              <th style={th}>Tên đầy đủ</th>
              <th style={th}>SĐT</th>
              <th style={th}>Địa chỉ</th>
              {!readOnly && <th style={{ ...th, textAlign: 'center' }}></th>}
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.id} style={{ opacity: p.isActive ? 1 : 0.45 }}>
                <td style={td}>
                  <strong>{p.code}</strong>
                  {p.aliasNote && <div style={{ fontSize: 11, color: 'var(--text3)' }}>({p.aliasNote})</div>}
                  {!p.isActive && <div style={{ fontSize: 11, color: '#c62828' }}>Ngừng hoạt động</div>}
                </td>
                <td style={td}>{p.fullName ?? '—'}</td>
                <td style={td}>{p.phone ?? '—'}</td>
                <td style={{ ...td, fontSize: 12, color: 'var(--text2)', maxWidth: 280 }}>{p.address ?? '—'}</td>
                {!readOnly && (
                  <td style={{ ...td, textAlign: 'center', whiteSpace: 'nowrap' }}>
                    <button onClick={() => { setForm(p); setErr('') }} title="Sửa" style={{ padding: 5, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer', marginRight: 6 }}><Pencil size={13} /></button>
                    <button onClick={() => toggleActive(p)} disabled={busy} title={p.isActive ? 'Ngừng hoạt động' : 'Kích hoạt'} style={{ padding: 5, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer', color: p.isActive ? '#c62828' : '#2e7d32' }}><Power size={13} /></button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
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

// Cấu hình tối thiểu cấp đan (inline ở header)
function ConfigBar() {
  const { data, refetch } = useFetch<{ minAllocationQty: number }>(() => api.getWeavingConfig(), [])
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState('')
  const [busy, setBusy] = useState(false)
  const min = data?.minAllocationQty ?? 200

  const save = async () => {
    try { setBusy(true); await api.updateWeavingConfig(Number(val)); setEditing(false); refetch() }
    finally { setBusy(false) }
  }

  if (editing) {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>Tối thiểu cấp:</span>
        <input type="number" min={1} value={val} onChange={(e) => setVal(e.target.value)} style={{ ...inp, width: 90 }} />
        <button onClick={save} disabled={busy} style={{ padding: 6, background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 'var(--radius)', cursor: 'pointer', display: 'flex' }}><Save size={13} color="#2e7d32" /></button>
        <button onClick={() => setEditing(false)} style={{ padding: 6, background: '#ffebee', border: '1px solid #ef9a9a', borderRadius: 'var(--radius)', cursor: 'pointer', display: 'flex' }}><X size={13} color="#c62828" /></button>
      </div>
    )
  }
  return (
    <button onClick={() => { setVal(String(min)); setEditing(true) }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--text2)', cursor: 'pointer' }}>
      Tối thiểu cấp: <strong>{min}</strong> <Pencil size={12} />
    </button>
  )
}
