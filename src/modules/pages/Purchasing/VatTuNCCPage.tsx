import { useState } from 'react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { errMsg } from '../../../utils/errors'
import { Search, Plus, Trash2, Pencil, X, Building2 } from 'lucide-react'

interface Material { id: number; code: string; name: string; unit: string }
interface Supplier { id: number; name: string; phone?: string | null; address?: string | null; isActive: boolean; _count?: { materials: number } }
// BE (/materials/:materialId/suppliers) trả supplierId + supplierName phẳng (không có object
// supplier lồng như mock cũ) — ghép thêm phone/address bằng cách tra trong danh sách `suppliers`
// đã có sẵn theo supplierId, thay vì sửa giao diện bảng.
interface Link { id: number; price: number; supplierId: number; supplierName: string }

const safeArr = <T,>(d: T[] | null | undefined): T[] => (Array.isArray(d) ? d : [])

export default function VatTuNCCPage() {
  const { data: materials } = useFetch<Material[]>(() => api.getMaterials())
  const { data: suppliers, refetch: refetchSup } = useFetch<Supplier[]>(() => api.getSuppliers())
  const [search, setSearch] = useState('')
  const [selMat, setSelMat] = useState<number | null>(null)
  const { data: links, refetch: refetchLinks } = useFetch<Link[]>(() => (selMat ? api.getMaterialSuppliers(selMat) : Promise.resolve([])), [selMat])

  const [showSupplierMgr, setShowSupplierMgr] = useState(false)
  const [linkSup, setLinkSup] = useState<number | ''>('')
  const [linkPrice, setLinkPrice] = useState('')
  const [err, setErr] = useState('')

  const matList = safeArr(materials).filter(m => {
    const q = search.trim().toLowerCase()
    return !q || m.name.toLowerCase().includes(q) || m.code.toLowerCase().includes(q)
  })
  // "Ẩn NCC" = update isActive:false (không xoá thật - xem SupplierManager.del), nên NCC đã ẩn
  // vẫn còn trong danh sách BE trả về. Loại khỏi mọi nơi CHỌN (gắn NCC mới, quản lý) - nhưng
  // KHÔNG loại khỏi tra cứu hiển thị cho NCC đã gắn từ trước (LinkRow vẫn dùng suppliers đầy đủ,
  // để hiện đúng SĐT/địa chỉ dù NCC đó vừa bị ẩn sau khi đã gắn).
  const activeSuppliers = safeArr(suppliers).filter(s => s.isActive)
  const linkedSupIds = new Set(safeArr(links).map(l => l.supplierId))
  const availSuppliers = activeSuppliers.filter(s => !linkedSupIds.has(s.id))
  const selMatObj = safeArr(materials).find(m => m.id === selMat)

  const addLink = async () => {
    setErr('')
    if (!linkSup) { setErr('Chọn nhà cung cấp'); return }
    if (!linkPrice.trim() || Number(linkPrice) < 0) { setErr('Nhập đơn giá hợp lệ'); return }
    try {
      await api.createMaterialSupplier({ materialId: selMat, supplierId: linkSup, price: Number(linkPrice) })
      setLinkSup(''); setLinkPrice(''); refetchLinks()
    } catch (e) { setErr(errMsg(e, 'Lỗi gắn NCC')) }
  }
  const delLink = async (id: number) => { if (selMat && confirm('Bỏ gắn NCC này?')) { await api.deleteMaterialSupplier(selMat, id); refetchLinks() } }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Vật tư – Nhà cung cấp</h2>
        <button onClick={() => setShowSupplierMgr(true)} style={btnGhost}><Building2 size={15} /> Quản lý nhà cung cấp ({activeSuppliers.length})</button>
      </div>
      <div style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 16 }}>Mỗi vật tư mua từ NCC nào — kèm địa chỉ & số điện thoại liên hệ</div>
      <div style={{ color: 'var(--text3)', fontSize: 12, marginBottom: 16 }}>
        {safeArr(materials).length} vật tư · {activeSuppliers.length} NCC hiện có
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
                  <th style={th}>Nhà cung cấp</th><th style={th}>Địa chỉ</th><th style={th}>SĐT</th><th style={th}>Đơn giá</th><th style={th}></th>
                </tr></thead>
                <tbody>
                  {safeArr(links).map(l => <LinkRow key={l.id} link={l} suppliers={safeArr(suppliers)} onDel={delLink} />)}
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
                  <input
                    type="number" min={0} value={linkPrice} onChange={e => setLinkPrice(e.target.value)}
                    placeholder="Đơn giá" style={{ ...inp, flex: '1 1 100px' }}
                  />
                  <button onClick={addLink} style={btnPrimary}><Plus size={14} /> Gắn</button>
                </div>
                {availSuppliers.length === 0 && activeSuppliers.length > 0 && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>Đã gắn hết NCC hiện có. Thêm NCC mới ở &quot;Quản lý nhà cung cấp&quot;.</div>}
                {activeSuppliers.length === 0 && <div style={{ fontSize: 12, color: '#e65100', marginTop: 6 }}>Chưa có NCC nào — bấm &quot;Quản lý nhà cung cấp&quot; để thêm.</div>}
                {err && <div style={{ color: '#c62828', fontSize: 12, marginTop: 6 }}>{err}</div>}
              </div>
            </>
          )}
        </div>
      </div>

      {showSupplierMgr && <SupplierManager suppliers={activeSuppliers} onClose={() => setShowSupplierMgr(false)} onChange={refetchSup} />}
    </div>
  )
}

// ── Dòng NCC ───────────────────────────────────────────────────────────
function LinkRow({ link, suppliers, onDel }: { link: Link; suppliers: Supplier[]; onDel: (id: number) => void }) {
  const supplier = suppliers.find(s => s.id === link.supplierId)
  return (
    <tr style={{ borderTop: '1px solid var(--border)' }}>
      <td style={td}>{link.supplierName}</td>
      <td style={{ ...td, color: 'var(--text3)' }}>{supplier?.address || '—'}</td>
      <td style={td}>{supplier?.phone || '—'}</td>
      <td style={td}>{link.price.toLocaleString('vi-VN')}</td>
      <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
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
    catch (e) { setErr(errMsg(e, 'Lỗi thêm NCC')) }
  }
  // Ẩn (isActive:false), KHÔNG xoá thật - đổi từ deleteSupplier() (hard delete) 2026-08-11: xoá
  // thật 1 NCC đang có báo giá/liên kết vật tư sẽ vỡ FK (500 thô), và hộp thoại này vốn đã hỏi
  // đúng "Ẩn" chứ không phải "Xoá vĩnh viễn" nên hành vi giờ mới khớp lời hỏi (D.p5-hide-supplier).
  const del = async (id: number) => { if (confirm('Ẩn NCC này?')) { await api.updateSupplier(id, { isActive: false }); onChange() } }
  return (
    <div onClick={onClose} style={overlay}>
      <div onClick={e => e.stopPropagation()} style={{ ...modalCard, width: 560 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Quản lý nhà cung cấp</h3>
          <button onClick={onClose} style={iconBtn}><X size={18} /></button>
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Tên NCC *" style={{ ...inp, flex: '2 1 140px' }} />
          <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Địa chỉ" style={{ ...inp, flex: '2 1 140px' }} />
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="SĐT" style={{ ...inp, flex: '1 1 100px' }} />
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
