import { useState, Fragment } from 'react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { useAuth } from '../../../context/AuthContext'
import { Plus } from 'lucide-react'
import MfgFramePiecePage from './MfgFramePiecePage'

export default function MfgSetupPage() {
  const { user } = useAuth()
  // Giám đốc và Quản lý SX chỉ XEM — đồng bộ backend. Chỉ BOM_MANAGER được CRUD.
  const isManager = user?.mfgRole === 'BOM_MANAGER'
  const [activeTab, setActiveTab] = useState<'frame-pieces' | 'products'>('frame-pieces')
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [productForm, setProductForm] = useState({ factoryCode:'', name:'', description:'', boxesPerSet:1 })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  // Tạo variant (cùng mẫu, khác màu / màu dây đan) cho 1 sản phẩm
  const [addVariantFor, setAddVariantFor] = useState<number | null>(null)
  const [variantForm, setVariantForm] = useState({ description:'', colorCode:'' })
  const [savingVariant, setSavingVariant] = useState(false)

  const { data: products, refetch: refetchProducts } = useFetch(() => api.getMfgProducts(), [])
  const safeProducts = Array.isArray(products) ? products : []

  const handleAddProduct = async () => {
    if (!productForm.factoryCode || !productForm.name) { setErr('Điền mã và tên sản phẩm'); return }
    try {
      setSaving(true)
      await api.createMfgProduct(productForm)
      setProductForm({ factoryCode:'', name:'', description:'', boxesPerSet:1 }); setShowAddProduct(false); refetchProducts()
    } catch (e: any) { setErr(e?.response?.data?.error ?? 'Lỗi') }
    finally { setSaving(false) }
  }

  const openVariantForm = (productId: number) => {
    setAddVariantFor(prev => prev === productId ? null : productId)
    setVariantForm({ description:'', colorCode:'' })
    setErr('')
  }

  const handleAddVariant = async (productId: number) => {
    if (!variantForm.description.trim()) { setErr('Nhập mô tả variant (vd "Đen - dây đan nâu")'); return }
    try {
      setSavingVariant(true)
      await api.createProductVariant({
        mfgProductId: productId,
        description: variantForm.description.trim(),
        colorCode: variantForm.colorCode.trim() || undefined,
        isActive: true,
      })
      setAddVariantFor(null); setVariantForm({ description:'', colorCode:'' }); refetchProducts()
    } catch (e: any) { setErr(e?.response?.data?.error ?? 'Lỗi tạo variant') }
    finally { setSavingVariant(false) }
  }

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, marginBottom:16 }}>
        <h2 style={{ margin:0, fontSize:20, fontWeight:700 }}>Quản lý định mức</h2>
        {isManager && (
          <button onClick={() => { setActiveTab('products'); setShowAddProduct(true); setErr('') }}
            style={{ display:'flex', alignItems:'center', gap:4, padding:'8px 16px', background:'#e65100', border:'none', borderRadius:'var(--radius)', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>
            <Plus size={14}/> Thêm sản phẩm
          </button>
        )}
      </div>

      <div style={{ display:'flex', gap:4, marginBottom:16, borderBottom:'1px solid var(--border)' }}>
        {(['frame-pieces','products'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{
            padding:'8px 16px', border:'none', borderBottom: activeTab === t ? '2px solid #e65100' : '2px solid transparent',
            background:'transparent', color: activeTab === t ? '#e65100' : 'var(--text2)', fontWeight: activeTab === t ? 600 : 400, fontSize:13, cursor:'pointer'
          }}>
            {t === 'frame-pieces' ? 'Định mức mảnh' : 'Sản phẩm SX'}
          </button>
        ))}
      </div>

      {err && <div style={{ background:'#ffebee', color:'#c62828', padding:'8px 12px', borderRadius:'var(--radius)', marginBottom:12, fontSize:13 }}>{err}</div>}

      {activeTab === 'frame-pieces' && <MfgFramePiecePage />}

      {activeTab === 'products' && (
        <>
          {showAddProduct && (
            <div style={{ background:'var(--surface2)', borderRadius:'var(--radius)', padding:12, marginBottom:12 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 2fr 2fr auto', gap:8, marginBottom:8, alignItems:'center' }}>
                <input value={productForm.factoryCode} onChange={e => setProductForm(f => ({ ...f, factoryCode: e.target.value }))} placeholder="Mã nhà máy (JSE-55...)"
                  style={{ padding:'7px 10px', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:13 }} />
                <input value={productForm.name} onChange={e => setProductForm(f => ({ ...f, name: e.target.value }))} placeholder="Tên sản phẩm"
                  style={{ padding:'7px 10px', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:13 }} />
                <input value={productForm.description} onChange={e => setProductForm(f => ({ ...f, description: e.target.value }))} placeholder="Mô tả"
                  style={{ padding:'7px 10px', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:13 }} />
                <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'var(--text3)', whiteSpace:'nowrap' }}>
                  Số thùng/bộ
                  <input type="number" min={1} value={productForm.boxesPerSet} onChange={e => setProductForm(f => ({ ...f, boxesPerSet: Math.max(1, Number(e.target.value)) }))} title="1 bộ đóng mấy thùng (đóng gói)"
                    style={{ width:60, padding:'7px 8px', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:13, textAlign:'center' }} />
                </label>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={handleAddProduct} disabled={saving}
                  style={{ padding:'7px 16px', background:'#e65100', border:'none', borderRadius:'var(--radius)', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                  {saving ? 'Đang lưu…' : 'Lưu'}
                </button>
                <button onClick={() => { setShowAddProduct(false); setErr('') }}
                  style={{ padding:'7px 14px', background:'transparent', border:'1px solid var(--border)', borderRadius:'var(--radius)', color:'var(--text2)', fontSize:13, cursor:'pointer' }}>
                  Hủy
                </button>
              </div>
            </div>
          )}
          <div style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', border:'1px solid var(--border)', overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ background:'var(--surface2)', borderBottom:'1px solid var(--border)' }}>
                  {['Mã NM','Tên','Mô tả','Số thùng/bộ','Số variant'].map(h => (
                    <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontWeight:600, color:'var(--text2)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {safeProducts.map((p: any) => {
                  const variants = Array.isArray(p.variants) ? p.variants : []
                  return (
                  <Fragment key={p.id}>
                  <tr style={{ borderBottom: addVariantFor === p.id ? 'none' : '1px solid var(--border)' }}>
                    <td style={{ padding:'10px 14px', fontFamily:'monospace', fontWeight:600 }}>{p.factoryCode}</td>
                    <td style={{ padding:'10px 14px' }}>{p.name}</td>
                    <td style={{ padding:'10px 14px', color:'var(--text3)' }}>{p.description ?? '—'}</td>
                    <td style={{ padding:'10px 14px', textAlign:'center' }}>{p.boxesPerSet ?? 1}</td>
                    <td style={{ padding:'10px 14px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                        <span style={{ background:'#e3f2fd', color:'#1565c0', padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:600 }}>{variants.length}</span>
                        {variants.map((v: any) => (
                          <span key={v.id} style={{ fontSize:11, color:'var(--text3)', background:'var(--surface2)', padding:'2px 8px', borderRadius:20 }}>{v.colorCode ? `${v.colorCode} · ` : ''}{v.description}</span>
                        ))}
                        {isManager && (
                          <button onClick={() => openVariantForm(p.id)}
                            style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'2px 8px', background:'transparent', border:'1px dashed var(--border)', borderRadius:20, color:'#e65100', fontSize:11, fontWeight:600, cursor:'pointer' }}>
                            <Plus size={11}/> Variant
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {addVariantFor === p.id && (
                    <tr style={{ borderBottom:'1px solid var(--border)', background:'var(--surface2)' }}>
                      <td colSpan={5} style={{ padding:'10px 14px' }}>
                        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                          <span style={{ fontSize:12, color:'var(--text3)', fontWeight:600 }}>Thêm variant cho <strong>{p.name}</strong>:</span>
                          <input value={variantForm.colorCode} onChange={e => setVariantForm(f => ({ ...f, colorCode: e.target.value }))} placeholder="Màu/màu dây đan"
                            style={{ width:130, padding:'7px 8px', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:13 }} />
                          <input value={variantForm.description} onChange={e => setVariantForm(f => ({ ...f, description: e.target.value }))} placeholder="Mô tả * (vd Đen - dây đan nâu - MEYING)"
                            style={{ flex:1, minWidth:200, padding:'7px 8px', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:13 }} />
                          <button onClick={() => handleAddVariant(p.id)} disabled={savingVariant}
                            style={{ padding:'7px 14px', background:'#e65100', border:'none', borderRadius:'var(--radius)', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                            {savingVariant ? 'Đang lưu…' : 'Lưu variant'}
                          </button>
                          <button onClick={() => setAddVariantFor(null)}
                            style={{ padding:'7px 12px', background:'transparent', border:'1px solid var(--border)', borderRadius:'var(--radius)', color:'var(--text2)', fontSize:13, cursor:'pointer' }}>
                            Hủy
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                  )
                })}
                {safeProducts.length === 0 && (
                  <tr><td colSpan={5} style={{ padding:32, textAlign:'center', color:'var(--text3)' }}>Chưa có sản phẩm</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
