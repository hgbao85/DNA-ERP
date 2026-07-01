import { useState } from 'react'
import { ChevronLeft, Plus, X } from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { useAuth } from '../../../context/AuthContext'
import type { ManhChildRow, ManhRow, PlanForm } from '../../../types/plan-form'
import { StatusBadge } from '../ProductionPlan/SKUDetail'
import SearchInput from '../../../components/SearchInput'
import LoadingState from '../../../components/LoadingState'

const inputStyle: React.CSSProperties = { width: '100%', padding: '7px 9px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontSize: 13, boxSizing: 'border-box', background: 'var(--surface)', color: 'var(--text)' }
const cardStyle: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '18px 20px', marginBottom: 24 }
const FL = ({ children }: { children: React.ReactNode }) => (
  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 4 }}>{children}</label>
)

/**
 * Khu vực "Nhập định mức mảnh theo SKU thật" — dành riêng cho account Sắt (SPEC_STEEL).
 * Theo đúng luồng 2 bước như form mock đã có sẵn trong trang này: Tạo mảnh -> Nhập sắt (nhiều loại sắt/mảnh).
 * Lưu xong gọi updatePlanFormManhQuota — tự chuyển status WAITING_PARTS -> APPROVED_PARTS.
 */
export default function QuotaManhEntryPanel() {
  const { user } = useAuth()
  const { data: planForms, isLoading, refetch } = useFetch<PlanForm[]>(() => api.getPlanForms(), [])
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const list = (planForms ?? []).filter(pf => pf.status !== 'DRAFT' && pf.status !== 'WAITING_DETAIL')
  const q = search.trim().toLowerCase()
  const displayed = q
    ? list.filter(pf => [pf.mfgProduct?.factoryCode, pf.mfgProduct?.name, pf.customerName].some(v => v?.toLowerCase().includes(q)))
    : list
  const selected = list.find(pf => pf.id === selectedId) ?? null

  const [manhs, setManhs] = useState<ManhRow[]>([])
  const [nextId, setNextId] = useState(1)
  const [showManhForm, setShowManhForm] = useState(false)
  const [formName, setFormName] = useState('')
  const [addingTo, setAddingTo] = useState<number | null>(null)
  const [childName, setChildName] = useState('')
  const [childSpecs, setChildSpecs] = useState('')
  const [childLength, setChildLength] = useState('')
  const [childQty, setChildQty] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const openSku = (pf: PlanForm) => {
    const existing = pf.manhItems ?? []
    const maxId = existing.flatMap(m => [m.id, ...m.children.map(c => c.id)]).reduce((a, b) => Math.max(a, b), 0)
    setSelectedId(pf.id)
    setManhs(existing.map(m => ({ ...m, children: m.children.map(c => ({ ...c })) })))
    setNextId(maxId + 1)
    setShowManhForm(false); setFormName('')
    setAddingTo(null); setChildName(''); setChildSpecs(''); setChildLength(''); setChildQty('')
    setSaved(false)
  }

  const addManh = () => {
    if (!formName.trim()) return
    setManhs(m => [...m, { id: nextId, name: formName.trim(), children: [] }])
    setNextId(n => n + 1)
    setShowManhForm(false); setFormName('')
  }

  const addChild = (manhId: number) => {
    if (!childName.trim()) return
    const child: ManhChildRow = { id: nextId, name: childName.trim(), specs: childSpecs.trim(), length: childLength.trim(), qty: childQty.trim() }
    setManhs(ms => ms.map(m => (m.id === manhId ? { ...m, children: [...m.children, child] } : m)))
    setNextId(n => n + 1)
    setChildName(''); setChildSpecs(''); setChildLength(''); setChildQty('')
  }

  const deleteChild = (manhId: number, childId: number) =>
    setManhs(ms => ms.map(m => (m.id === manhId ? { ...m, children: m.children.filter(c => c.id !== childId) } : m)))

  const deleteManh = (manhId: number) => {
    setManhs(ms => ms.filter(m => m.id !== manhId))
    if (addingTo === manhId) setAddingTo(null)
  }

  const totalChildren = manhs.reduce((s, m) => s + m.children.length, 0)

  const handleSave = async () => {
    if (!selected) return
    setSaving(true)
    try {
      await (api as any).updatePlanFormManhQuota(selected.id, manhs, user?.name ?? 'Không rõ')
      setSaved(true)
      refetch()
    } catch {
      alert('Không thể lưu định mức mảnh')
    } finally {
      setSaving(false)
    }
  }

  if (selected) {
    const meta = selected.manhEntryMeta
    return (
      <div style={cardStyle}>
        <button
          onClick={() => setSelectedId(null)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: 13, color: 'var(--text2)', marginBottom: 14 }}
        >
          <ChevronLeft size={14} /> Quay lại danh sách SKU
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
            Nhập định mức mảnh — {selected.mfgProduct?.factoryCode} {selected.mfgProduct?.name}
          </h3>
          <StatusBadge status={selected.status} />
        </div>
        {meta && (
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>
            Đã nhập bởi <strong>{meta.enteredBy}</strong> lúc {new Date(meta.enteredAt).toLocaleString('vi-VN')}
          </div>
        )}

        {/* Form tạo mảnh */}
        {showManhForm && (
          <div style={{ background: '#e3f2fd', border: '1px solid #90caf9', borderRadius: 'var(--radius-lg)', padding: '14px 16px', marginBottom: 14 }}>
            <div style={{ fontWeight: 700, color: '#1565c0', marginBottom: 10, fontSize: 14 }}>Tạo mảnh mới</div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <FL>Tên mảnh <span style={{ color: '#e53935' }}>*</span></FL>
                <input
                  autoFocus placeholder="Mảnh tựa, Mảnh tay…" value={formName}
                  onChange={e => setFormName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addManh()}
                  style={inputStyle}
                />
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={addManh} disabled={!formName.trim()}
                  style={{ padding: '7px 16px', border: 'none', borderRadius: 'var(--radius)', background: formName.trim() ? '#1565c0' : '#ccc', color: '#fff', fontWeight: 700, fontSize: 13, cursor: formName.trim() ? 'pointer' : 'not-allowed' }}
                >Tạo mảnh</button>
                <button
                  onClick={() => { setShowManhForm(false); setFormName('') }}
                  style={{ padding: '7px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', cursor: 'pointer', fontSize: 13, color: 'var(--text2)' }}
                >Hủy</button>
              </div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {manhs.length === 0 && !showManhForm && (
          <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 14, marginBottom: 14 }}>
            Chưa có mảnh nào —{' '}
            <button onClick={() => setShowManhForm(true)} style={{ background: 'none', border: 'none', color: '#1565c0', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
              + Nhập mảnh đầu tiên
            </button>
          </div>
        )}

        {/* Danh sách mảnh */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
          {manhs.map(m => (
            <div key={m.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: 'var(--surface2)',
                borderBottom: m.children.length > 0 || addingTo === m.id ? '1px solid var(--border)' : 'none',
              }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{m.name}</span>
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>{m.children.length} loại sắt</span>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => (addingTo === m.id ? setAddingTo(null) : (setAddingTo(m.id), setChildName(''), setChildSpecs(''), setChildLength(''), setChildQty('')))}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                      background: addingTo === m.id ? '#e3f2fd' : 'var(--surface)', color: addingTo === m.id ? '#1565c0' : 'var(--text2)', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    }}
                  ><Plus size={13} /> Thêm loại sắt</button>
                  <button
                    onClick={() => deleteManh(m.id)}
                    style={{ padding: '5px 10px', border: '1px solid #ffcdd2', borderRadius: 'var(--radius)', background: '#fff8f8', color: '#c62828', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                  >Xóa mảnh</button>
                </div>
              </div>

              {m.children.length > 0 && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--surface2)' }}>
                      <th style={{ width: 36, padding: '7px', textAlign: 'center', fontWeight: 600, color: 'var(--text2)', fontSize: 11 }}>#</th>
                      <th style={{ padding: '7px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text2)', fontSize: 11 }}>Loại sắt</th>
                      <th style={{ padding: '7px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text2)', fontSize: 11 }}>Quy cách</th>
                      <th style={{ width: 100, padding: '7px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--text2)', fontSize: 11 }}>Chiều dài</th>
                      <th style={{ width: 100, padding: '7px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--text2)', fontSize: 11 }}>Số lượng</th>
                      <th style={{ width: 40 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {m.children.map((c, i) => (
                      <tr key={c.id} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 12, padding: '9px 7px' }}>{i + 1}</td>
                        <td style={{ padding: '9px 14px', color: 'var(--text)', fontWeight: 500 }}>{c.name}</td>
                        <td style={{ padding: '9px 14px', color: 'var(--text3)', fontSize: 12 }}>{c.specs || '—'}</td>
                        <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text3)' }}>{c.length || '—'}</td>
                        <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text)' }}>{c.qty || '—'}</td>
                        <td style={{ textAlign: 'center', padding: 4 }}>
                          <button onClick={() => deleteChild(m.id, c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 4 }}>
                            <X size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {addingTo === m.id && (
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap', padding: '12px 16px', borderTop: m.children.length > 0 ? '1px dashed var(--border)' : 'none' }}>
                  <div style={{ width: 180 }}>
                    <FL>Loại sắt</FL>
                    <input placeholder="Sắt Hộp 6 zem..." value={childName} onChange={e => setChildName(e.target.value)} style={inputStyle} />
                  </div>
                  <div style={{ width: 130 }}>
                    <FL>Quy cách</FL>
                    <input placeholder="25x50" value={childSpecs} onChange={e => setChildSpecs(e.target.value)} style={inputStyle} />
                  </div>
                  <div style={{ width: 100 }}>
                    <FL>Chiều dài</FL>
                    <input placeholder="580" value={childLength} onChange={e => setChildLength(e.target.value)} style={inputStyle} />
                  </div>
                  <div style={{ width: 90 }}>
                    <FL>Số lượng</FL>
                    <input
                      placeholder="0" value={childQty}
                      onChange={e => setChildQty(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addChild(m.id)}
                      style={inputStyle}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => addChild(m.id)} disabled={!childName.trim()}
                      style={{ padding: '7px 14px', border: 'none', borderRadius: 'var(--radius)', background: childName.trim() ? '#1565c0' : '#ccc', color: '#fff', fontWeight: 600, fontSize: 13, cursor: childName.trim() ? 'pointer' : 'not-allowed' }}
                    >+ Thêm</button>
                    <button onClick={() => setAddingTo(null)} style={{ padding: '7px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', cursor: 'pointer', fontSize: 13, color: 'var(--text2)' }}>Đóng</button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {!showManhForm && manhs.length > 0 && (
            <button
              onClick={() => setShowManhForm(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 16px', background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-lg)', cursor: 'pointer', color: 'var(--text2)', fontWeight: 600, fontSize: 13 }}
            >
              <Plus size={15} /> Thêm mảnh mới
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ fontSize: 13, color: 'var(--text2)' }}>{manhs.length} mảnh · {totalChildren} loại sắt</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {saved && <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>✓ Đã lưu</span>}
            <button
              onClick={handleSave}
              disabled={saving || totalChildren === 0}
              style={{ padding: '8px 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', cursor: saving || totalChildren === 0 ? 'not-allowed' : 'pointer', background: totalChildren > 0 ? '#2e7d32' : '#e5e7eb', color: totalChildren > 0 ? '#fff' : '#9ca3af', opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'Đang lưu...' : 'Lưu định mức mảnh'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>Nhập định mức mảnh theo SKU thật</div>
        <SearchInput value={search} onChange={setSearch} placeholder="Tìm SKU, sản phẩm, khách hàng..." />
      </div>
      {isLoading ? (
        <LoadingState />
      ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                <th style={{ padding: '8px 12px', fontWeight: 600, fontSize: 12, color: 'var(--text3)' }}>SKU</th>
                <th style={{ padding: '8px 12px', fontWeight: 600, fontSize: 12, color: 'var(--text3)' }}>Khách hàng</th>
                <th style={{ padding: '8px 12px', fontWeight: 600, fontSize: 12, color: 'var(--text3)' }}>Trạng thái</th>
                <th style={{ padding: '8px 12px', fontWeight: 600, fontSize: 12, color: 'var(--text3)' }}>Mảnh đã nhập</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map(pf => {
                const count = pf.manhItems?.length ?? 0
                return (
                  <tr
                    key={pf.id}
                    onClick={() => openSku(pf)}
                    style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f0fdf4')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                  >
                    <td style={{ padding: '9px 12px' }}>
                      <span style={{ fontWeight: 600 }}>{pf.mfgProduct?.factoryCode}</span>
                      <span style={{ color: 'var(--text3)', margin: '0 4px' }}>—</span>
                      {pf.mfgProduct?.name}
                    </td>
                    <td style={{ padding: '9px 12px', color: 'var(--text2)' }}>{pf.customerName ?? '—'}</td>
                    <td style={{ padding: '9px 12px' }}><StatusBadge status={pf.status} /></td>
                    <td style={{ padding: '9px 12px', color: count > 0 ? '#16a34a' : 'var(--text3)', fontWeight: count > 0 ? 600 : 400 }}>
                      {count > 0 ? `${count} mảnh` : 'Chưa nhập'}
                    </td>
                  </tr>
                )
              })}
              {displayed.length === 0 && (
                <tr><td colSpan={4} style={{ padding: 24, textAlign: 'center', color: 'var(--text3)' }}>Không có SKU nào đang chờ nhập định mức mảnh</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
