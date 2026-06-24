import { useState } from 'react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { Search, Plus, Trash2, Pencil, X, Building2, Check } from 'lucide-react'

interface Material { id: number; code: string; name: string; unit: string }
interface Supplier { id: number; name: string; phone?: string | null; address?: string | null; _count?: { materials: number } }
interface Link { id: number; price?: number | null; leadTimeDays?: number | null; quotedAt?: string | null; note?: string | null; supplier?: { id: number; name: string; phone?: string | null } | null }

const safeArr = <T,>(d: T[] | null | undefined): T[] => (Array.isArray(d) ? d : [])
const errMsg = (e: unknown) => (e as { response?: { data?: { error?: string } } })?.response?.data?.error

export default function VatTuNCCPage() {
  const { data: materials } = useFetch<Material[]>(() => api.getMaterials())
  const { data: suppliers, refetch: refetchSup } = useFetch<Supplier[]>(() => api.getSuppliers())
  const [search, setSearch] = useState('')
  const [selMat, setSelMat] = useState<number | null>(null)
  const { data: links, refetch: refetchLinks } = useFetch<Link[]>(() => (selMat ? api.getMaterialSuppliers(selMat) : Promise.resolve([])), [selMat])

  const [showSupplierMgr, setShowSupplierMgr] = useState(false)
  const [linkSup, setLinkSup] = useState<number | ''>('')
  const [linkPrice, setLinkPrice] = useState('')
  const [linkLead, setLinkLead] = useState('')
  const [err, setErr] = useState('')

  const matList = safeArr(materials).filter(m => {
    const q = search.trim().toLowerCase()
    return !q || m.name.toLowerCase().includes(q) || m.code.toLowerCase().includes(q)
  })
  const linkedSupIds = new Set(safeArr(links).map(l => l.supplier?.id))
  const availSuppliers = safeArr(suppliers).filter(s => !linkedSupIds.has(s.id))
  const selMatObj = safeArr(materials).find(m => m.id === selMat)

  const addLink = async () => {
    setErr('')
    if (!linkSup) { setErr('Chọn nhà cung cấp'); return }
    try {
      await api.createMaterialSupplier({ materialId: selMat, supplierId: Number(linkSup), price: linkPrice ? Number(linkPrice) : undefined, leadTimeDays: linkLead ? Number(linkLead) : undefined })
      setLinkSup(''); setLinkPrice(''); setLinkLead(''); refetchLinks()
    } catch (e) { setErr(errMsg(e) ?? 'Lỗi gắn NCC') }
  }
  const saveLink = async (id: number, price: string, lead: string) => {
    try { await api.updateMaterialSupplier(id, { price: price ? Number(price) : undefined, leadTimeDays: lead ? Number(lead) : undefined }); refetchLinks() }
    catch (e) { alert(errMsg(e) ?? 'Lỗi lưu') }
  }
  const delLink = async (id: number) => { if (confirm('Bỏ gắn NCC này?')) { await api.deleteMaterialSupplier(id); refetchLinks() } }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Vật tư – Nhà cung cấp</h2>
        <button onClick={() => setShowSupplierMgr(true)} style={btnGhost}><Building2 size={15} /> Quản lý nhà cung cấp ({safeArr(suppliers).length})</button>
      </div>
      <div style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 16 }}>Mỗi vật tư mua từ NCC nào — kèm giá tham khảo & thời gian giao</div>
      <div style={{ color: 'var(--text3)', fontSize: 12, marginBottom: 16 }}>
        {safeArr(materials).length} vật tư · {safeArr(suppliers).length} NCC hiện có
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16, alignItems: 'start' }}>
        {/* Trái: danh sách vật tư */}
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          <div style={{ position: 'relative', padding: 8, borderBottom: '1px solid var(--border)' }}>
            <Search size={14} style={{ position: 'absolute', left: 16, top: 17, color: 'var(--text3)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm vật tư…" style={{ ...inp, paddingLeft: 28 }} />
          </div>
          <div style={{ maxHeight: 520, overflowY: 'auto' }}>
            {matList.map(m => (
              <button key={m.id} onClick={() => setSelMat(m.id)} style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', border: 'none', borderBottom: '1px solid var(--border)',
                background: selMat === m.id ? '#ede7f6' : 'transparent', color: selMat === m.id ? '#4527a0' : 'var(--text)', cursor: 'pointer', fontSize: 13,
              }}>
                <div style={{ fontWeight: selMat === m.id ? 700 : 500 }}>{m.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{m.code} · {m.unit}</div>
              </button>
            ))}
            {matList.length === 0 && <div style={{ padding: 14, color: 'var(--text3)', fontSize: 13 }}>Không có vật tư</div>}
          </div>
        </div>

        {/* Phải: NCC của vật tư đã chọn */}
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16, minHeight: 200 }}>
          {!selMat ? (
            <div style={{ color: 'var(--text3)', fontSize: 13 }}>← Chọn 1 vật tư để xem & gắn nhà cung cấp</div>
          ) : (
            <>
              <div style={{ fontWeight: 700, marginBottom: 12 }}>{selMatObj?.name} <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 400 }}>({selMatObj?.unit})</span></div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ textAlign: 'left', color: 'var(--text3)' }}>
                  <th style={th}>Nhà cung cấp</th><th style={th}>Giá (đ)</th><th style={th}>Giao (ngày)</th><th style={th}>Báo giá</th><th style={th}></th>
                </tr></thead>
                <tbody>
                  {safeArr(links).map(l => <LinkRow key={l.id} link={l} onSave={saveLink} onDel={delLink} />)}
                  {safeArr(links).length === 0 && <tr><td colSpan={5} style={{ ...td, color: 'var(--text3)', padding: 14 }}>Chưa gắn NCC nào</td></tr>}
                </tbody>
              </table>

              {/* Gắn NCC mới */}
              <div style={{ marginTop: 14, padding: 12, background: 'var(--surface2)', borderRadius: 'var(--radius)' }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>+ Gắn nhà cung cấp</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <select value={linkSup} onChange={e => setLinkSup(e.target.value ? Number(e.target.value) : '')} style={{ ...inp, flex: '2 1 160px' }}>
                    <option value="">— chọn NCC —</option>
                    {availSuppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <input value={linkPrice} onChange={e => setLinkPrice(e.target.value)} type="number" placeholder="Giá (đ)" style={{ ...inp, flex: '1 1 100px' }} />
                  <input value={linkLead} onChange={e => setLinkLead(e.target.value)} type="number" placeholder="Giao (ngày)" style={{ ...inp, flex: '0 1 100px' }} />
                  <button onClick={addLink} style={btnPrimary}><Plus size={14} /> Gắn</button>
                </div>
                {availSuppliers.length === 0 && safeArr(suppliers).length > 0 && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>Đã gắn hết NCC hiện có. Thêm NCC mới ở "Quản lý nhà cung cấp".</div>}
                {safeArr(suppliers).length === 0 && <div style={{ fontSize: 12, color: '#e65100', marginTop: 6 }}>Chưa có NCC nào — bấm "Quản lý nhà cung cấp" để thêm.</div>}
                {err && <div style={{ color: '#c62828', fontSize: 12, marginTop: 6 }}>{err}</div>}
              </div>
            </>
          )}
        </div>
      </div>

      {showSupplierMgr && <SupplierManager suppliers={safeArr(suppliers)} onClose={() => setShowSupplierMgr(false)} onChange={refetchSup} />}
    </div>
  )
}

// ── Dòng NCC (sửa giá/lead inline) ───────────────────────────────────────
function LinkRow({ link, onSave, onDel }: { link: Link; onSave: (id: number, price: string, lead: string) => void; onDel: (id: number) => void }) {
  const [price, setPrice] = useState(link.price?.toString() ?? '')
  const [lead, setLead] = useState(link.leadTimeDays?.toString() ?? '')
  const dirty = price !== (link.price?.toString() ?? '') || lead !== (link.leadTimeDays?.toString() ?? '')
  return (
    <tr style={{ borderTop: '1px solid var(--border)' }}>
      <td style={td}>{link.supplier?.name}{link.supplier?.phone ? <span style={{ fontSize: 11, color: 'var(--text3)' }}> · {link.supplier.phone}</span> : ''}</td>
      <td style={td}><input value={price} onChange={e => setPrice(e.target.value)} type="number" style={{ ...inp, width: 90, padding: '4px 6px' }} /></td>
      <td style={td}><input value={lead} onChange={e => setLead(e.target.value)} type="number" style={{ ...inp, width: 60, padding: '4px 6px' }} /></td>
      <td style={{ ...td, color: 'var(--text3)', fontSize: 12 }}>{link.quotedAt ? new Date(link.quotedAt).toLocaleDateString('vi-VN') : '—'}</td>
      <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
        {dirty && <button title="Lưu" onClick={() => onSave(link.id, price, lead)} style={iconBtn}><Check size={15} color="#2e7d32" /></button>}
        <button title="Bỏ gắn" onClick={() => onDel(link.id)} style={iconBtn}><Trash2 size={14} color="#c62828" /></button>
      </td>
    </tr>
  )
}

// ── Modal quản lý nhà cung cấp ───────────────────────────────────────────
function SupplierManager({ suppliers, onClose, onChange }: { suppliers: Supplier[]; onClose: () => void; onChange: () => void }) {
  const [name, setName] = useState(''); const [phone, setPhone] = useState(''); const [address, setAddress] = useState('')
  const [err, setErr] = useState('')
  const add = async () => {
    setErr(''); if (!name.trim()) { setErr('Nhập tên NCC'); return }
    try { await api.createSupplier({ name: name.trim(), phone: phone.trim() || undefined, address: address.trim() || undefined }); setName(''); setPhone(''); setAddress(''); onChange() }
    catch (e) { setErr(errMsg(e) ?? 'Lỗi thêm NCC') }
  }
  const del = async (id: number) => { if (confirm('Ẩn NCC này?')) { await api.deleteSupplier(id); onChange() } }
  return (
    <div onClick={onClose} style={overlay}>
      <div onClick={e => e.stopPropagation()} style={{ ...modalCard, width: 560 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Quản lý nhà cung cấp</h3>
          <button onClick={onClose} style={iconBtn}><X size={18} /></button>
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Tên NCC *" style={{ ...inp, flex: '2 1 140px' }} />
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="SĐT" style={{ ...inp, flex: '1 1 100px' }} />
          <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Địa chỉ" style={{ ...inp, flex: '2 1 140px' }} />
          <button onClick={add} style={btnPrimary}><Plus size={14} /> Thêm</button>
        </div>
        {err && <div style={{ color: '#c62828', fontSize: 13, marginBottom: 8 }}>{err}</div>}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ textAlign: 'left', color: 'var(--text3)' }}><th style={th}>Tên</th><th style={th}>SĐT</th><th style={th}>Địa chỉ</th><th style={th}>Vật tư</th><th style={th}></th></tr></thead>
          <tbody>
            {suppliers.map(s => (
              <tr key={s.id} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ ...td, fontWeight: 600 }}>{s.name}</td>
                <td style={td}>{s.phone || '—'}</td>
                <td style={{ ...td, color: 'var(--text3)' }}>{s.address || '—'}</td>
                <td style={td}>{s._count?.materials ?? 0}</td>
                <td style={{ ...td, textAlign: 'right' }}><button onClick={() => del(s.id)} style={iconBtn}><Trash2 size={14} color="#c62828" /></button></td>
              </tr>
            ))}
            {suppliers.length === 0 && <tr><td colSpan={5} style={{ ...td, color: 'var(--text3)', padding: 14, textAlign: 'center' }}>Chưa có NCC nào</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const inp: React.CSSProperties = { padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box', width: '100%' }
const th: React.CSSProperties = { padding: '7px 10px', fontWeight: 600, fontSize: 12, color: 'var(--text2)' }
const td: React.CSSProperties = { padding: '7px 10px', color: 'var(--text)' }
const iconBtn: React.CSSProperties = { padding: 5, background: 'transparent', border: 'none', cursor: 'pointer', display: 'inline-flex' }
const btnGhost: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text2)', fontSize: 13, cursor: 'pointer' }
const btnPrimary: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '8px 14px', border: 'none', borderRadius: 'var(--radius)', background: '#4527a0', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }
const modalCard: React.CSSProperties = { maxWidth: '92vw', background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 20, boxShadow: '0 8px 30px rgba(0,0,0,.2)', maxHeight: '85vh', overflow: 'auto' }
