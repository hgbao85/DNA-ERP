import { useState } from 'react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { useAuth } from '../../../context/AuthContext'
import { Plus, Trash2, Pencil, X } from 'lucide-react'

// ── Công đoạn phôi ───────────────────────────────────────────────────
const OPERATIONS = [
  { v: 'CAT', label: 'Cắt' },
  { v: 'TOP_DAU', label: 'Tốp đầu' },
  { v: 'UON', label: 'Uốn' },
  { v: 'DAP', label: 'Dập' },
  { v: 'DUC_LO', label: 'Đục lỗ' },
  { v: 'BAN_TAN', label: 'Bắn tán' },
] as const
const OP_LABEL: Record<string, string> = Object.fromEntries(OPERATIONS.map(o => [o.v, o.label]))

// Vật tư của mảnh (phạm vi bộ phận SX): toàn bộ sắt/thép (phôi cắt) + chi tiết khung hàn vào
// (Chốt, Pát kính/Pát V/Pát 1-4, Ô tròn lỗ dù). Loại trừ phụ kiện lắp ráp do MUA HÀNG lo:
// bu lông, đinh, lon, lục giác, vis, nút, tán, ốc, ống, pass, nắp dù, chân cao su...
const FRAME_ACCESSORY = /^(chốt|pát|ô tròn lỗ dù)/i
const isFrameMat = (name?: string | null, groupName?: string | null) => {
  if (/sắt/i.test(groupName ?? '')) return true // nhóm Sắt ống = vật liệu phôi
  return FRAME_ACCESSORY.test((name ?? '').trim())
}

// ── Types ────────────────────────────────────────────────────────────
interface MfgProduct { id: number; factoryCode: string; name: string }
interface Material { id: number; code: string; name: string; unit: string; materialGroupId?: number | null; materialGroup?: { name: string } | null }
interface FPMaterial {
  id: number
  materialId: number
  material: Material
  quantity: number
  spec?: string | null
  cutLengthMm?: number | null
  piecesPerFrame?: number | null
  operations?: string[]
  needsHan?: boolean
  needsSon?: boolean
}
interface FramePiece {
  id: number
  code: string
  groupNumber: number
  pieceNumber?: number
  name: string
  quantityPerSet?: number
  isWoven?: boolean
  weavingPrice?: number
  materials: FPMaterial[]
}

// Dòng vật tư trong form (dùng string cho input số, parse khi submit)
interface MatRow { materialId: number | ''; spec: string; cutLengthMm: string; piecesPerFrame: string; operations: string[]; needsHan: boolean; needsSon: boolean }
interface PieceForm {
  id?: number
  groupNumber: string
  pieceNumber: string
  name: string
  quantityPerSet: string
  isWoven: boolean
  weavingPrice: string
  materials: MatRow[]
}

const emptyRow = (): MatRow => ({ materialId: '', spec: '', cutLengthMm: '', piecesPerFrame: '', operations: [], needsHan: false, needsSon: false })
const emptyForm = (): PieceForm => ({
  groupNumber: '1', pieceNumber: '1', name: '', quantityPerSet: '1', isWoven: false, weavingPrice: '0',
  materials: [emptyRow()],
})

// Lượng vật tư / 1 mảnh (ngầm tính, không hiển thị): sắt (unit chứa 'cm') = dài(cm) × số đoạn; còn lại = số cái
function computeQty(unit: string, cutLengthMm: number, pieces: number): number {
  if (unit && unit.toLowerCase().includes('cm')) {
    return Math.round((cutLengthMm / 10) * pieces * 100) / 100
  }
  return pieces
}

const inputStyle: React.CSSProperties = {
  padding: '6px 9px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, width: '100%', boxSizing: 'border-box',
}

export default function MfgFramePiecePage() {
  const { user } = useAuth()
  // Giám đốc (BOSS không mfgRole) và Quản lý SX (PRODUCTION_MANAGER) chỉ XEM, BOM_MANAGER được phép CRUD.
  const canEdit = user?.mfgRole === 'BOM_MANAGER'

  const [productId, setProductId] = useState<number | ''>('')
  const [form, setForm] = useState<PieceForm | null>(null)
  // Vật tư KHÔNG phải khung (dây đan...) của mảnh đang sửa — giữ nguyên, ghép lại khi lưu để không mất
  const [preservedMats, setPreservedMats] = useState<FPMaterial[]>([])
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const { data: products } = useFetch<MfgProduct[]>(() => api.getFrameProducts(), [])
  const { data: materials } = useFetch<Material[]>(() => api.getMaterials(), [])
  const { data: materialGroupData } = useFetch<{ id: number; name: string }[]>(() => api.getMaterialGroups(), [])
  const { data: pieces, isLoading, error, refetch } = useFetch<FramePiece[]>(
    () => (productId ? api.getFramePieces(productId as number) : Promise.resolve([])),
    [productId],
  )

  const safeProducts = Array.isArray(products) ? products : []
  const safeMaterialGroups = Array.isArray(materialGroupData) ? materialGroupData : []
  const safeMaterials = Array.isArray(materials) ? materials : []
  const rawPieces = Array.isArray(pieces) ? pieces : []
  const selectedProduct = safeProducts.find(p => p.id === productId)

  const groupById = safeMaterialGroups.reduce((acc, g) => {
    acc[g.id] = g.name
    return acc
  }, {} as Record<number, string>)
  const safeMaterialsWithGroup = safeMaterials.map(m => ({
    ...m,
    materialGroup: m.materialGroupId != null ? { name: groupById[m.materialGroupId] ?? 'Khác' } : null,
  }))
  const materialMap = safeMaterialsWithGroup.reduce((acc, m) => {
    acc[m.id] = m
    return acc
  }, {} as Record<number, Material>)
  const safePieces = rawPieces.map(p => ({
    ...p,
    materials: Array.isArray(p.materials)
      ? p.materials.map(m => ({
          ...m,
          material: m.material ?? materialMap[m.materialId] ?? { id: m.materialId, code: '', name: '', unit: '', materialGroup: null },
        }))
      : [],
  }))

  const totalPieces = safePieces.length
  const piecesWithoutMaterials = safePieces.filter(p => {
    const frameMats = (Array.isArray(p.materials) ? p.materials : []).filter(m => isFrameMat(m.material?.name, m.material?.materialGroup?.name))
    return frameMats.length === 0
  }).length
  const piecesWithIncompleteMaterials = safePieces.filter(p => {
    const frameMats = (Array.isArray(p.materials) ? p.materials : []).filter(m => isFrameMat(m.material?.name, m.material?.materialGroup?.name))
    return frameMats.length > 0 && frameMats.some(m => !m.spec || !m.piecesPerFrame || Number(m.piecesPerFrame) <= 0)
  }).length

  // Dropdown vật tư: chỉ nhóm Sắt / Phụ kiện, gom theo nhóm cho gọn
  const dropdownMats = safeMaterialsWithGroup.filter(m => isFrameMat(m.name, m.materialGroup?.name))
  const materialGroups = Object.values(
    dropdownMats.reduce((acc, m) => {
      const g = m.materialGroup?.name ?? 'Khác'
      if (!acc[g]) acc[g] = { name: g, items: [] }
      acc[g].items.push(m)
      return acc
    }, {} as Record<string, { name: string; items: Material[] }>),
  )
    .map(g => ({ name: g.name, items: g.items.sort((a, b) => a.name.localeCompare(b.name, 'vi')) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'))

  // ── Form helpers ──────────────────────────────────────────────────
  const startAdd = () => {
    setErr('')
    setPreservedMats([])
    // tự tăng "Thứ tự" để code (factoryCode.nhóm.thứ-tự) không trùng mảnh đã có
    const maxPiece = safePieces.reduce((mx, p) => Math.max(mx, p.pieceNumber || 0), 0)
    setForm({ ...emptyForm(), pieceNumber: String(maxPiece + 1) })
  }
  const startEdit = (p: FramePiece) => {
    setErr('')
    const frameMats = p.materials.filter(m => isFrameMat(m.material?.name, m.material?.materialGroup?.name))
    const otherMats = p.materials.filter(m => !isFrameMat(m.material?.name, m.material?.materialGroup?.name))
    setPreservedMats(otherMats)
    setForm({
      id: p.id,
      groupNumber: String(p.groupNumber),
      pieceNumber: String(p.pieceNumber),
      name: p.name,
      quantityPerSet: String(p.quantityPerSet),
      isWoven: !!p.isWoven,
      weavingPrice: String(p.weavingPrice),
      materials: frameMats.length > 0
        ? frameMats.map(m => ({
            materialId: m.materialId,
            spec: m.spec ?? '',
            cutLengthMm: m.cutLengthMm != null ? String(m.cutLengthMm) : '',
            piecesPerFrame: m.piecesPerFrame != null ? String(m.piecesPerFrame) : '',
            operations: Array.isArray(m.operations) ? m.operations : [],
            needsHan: !!m.needsHan,
            needsSon: !!m.needsSon,
          }))
        : [emptyRow()],
    })
  }
  const cancelForm = () => { setForm(null); setPreservedMats([]); setErr('') }

  const setField = (k: keyof PieceForm, v: string) => setForm(f => f ? { ...f, [k]: v } : f)
  const setRow = (i: number, k: keyof MatRow, v: string | number | string[] | boolean) =>
    setForm(f => f ? { ...f, materials: f.materials.map((r, idx) => idx === i ? { ...r, [k]: v } : r) } : f)
  const toggleRowOp = (i: number, op: string) =>
    setForm(f => f ? {
      ...f,
      materials: f.materials.map((r, idx) => idx === i
        ? { ...r, operations: r.operations.includes(op) ? r.operations.filter(o => o !== op) : [...r.operations, op] }
        : r),
    } : f)
  const addRow = () => setForm(f => f ? { ...f, materials: [...f.materials, emptyRow()] } : f)
  const removeRow = (i: number) => setForm(f => f ? { ...f, materials: f.materials.filter((_, idx) => idx !== i) } : f)

  const handleSave = async () => {
    if (!form || !productId || !selectedProduct) return
    if (!form.name.trim()) { setErr('Nhập tên mảnh'); return }
    const validRows = form.materials.filter(r => r.materialId !== '' && Number(r.piecesPerFrame) > 0)
    if (validRows.length === 0) { setErr('Thêm ít nhất 1 vật tư (có số lượng/mảnh > 0)'); return }

    const matPayload = validRows.map(r => {
      const mat = safeMaterials.find(m => m.id === r.materialId)
      const pieces = Number(r.piecesPerFrame) || 0
      const cut = Number(r.cutLengthMm) || 0
      return {
        materialId: r.materialId as number,
        quantity: computeQty(mat?.unit ?? '', cut, pieces),
        spec: r.spec.trim() || undefined,
        cutLengthMm: cut || undefined,
        piecesPerFrame: pieces || undefined,
        operations: r.operations,
        needsHan: r.needsHan,
        needsSon: r.needsSon,
      }
    })

    // Giữ lại vật tư đan (không phải khung) để không bị xóa khi thay danh sách
    const preservedPayload = preservedMats.map(m => ({
      materialId: m.materialId,
      quantity: m.quantity,
      spec: m.spec ?? undefined,
      cutLengthMm: m.cutLengthMm ?? undefined,
      piecesPerFrame: m.piecesPerFrame ?? undefined,
      operations: Array.isArray(m.operations) ? m.operations : [],
      needsHan: !!m.needsHan,
      needsSon: !!m.needsSon,
    }))

    const finalMaterials = [...matPayload, ...preservedPayload]

    try {
      setSaving(true); setErr('')
      if (form.id) {
        await api.updateFramePiece(form.id, {
          groupNumber: Number(form.groupNumber) || 1,
          pieceNumber: Number(form.pieceNumber) || 1,
          name: form.name.trim(),
          quantityPerSet: Number(form.quantityPerSet) || 1,
          isWoven: form.isWoven,
          weavingPrice: Number(form.weavingPrice) || 0,
          materials: finalMaterials,
        })
      } else {
        await api.createFramePiece({
          code: `${selectedProduct.factoryCode}.${Number(form.groupNumber) || 1}.${Number(form.pieceNumber) || 1}`,
          mfgProductId: productId,
          groupNumber: Number(form.groupNumber) || 1,
          pieceNumber: Number(form.pieceNumber) || 1,
          name: form.name.trim(),
          quantityPerSet: Number(form.quantityPerSet) || 1,
          isWoven: form.isWoven,
          weavingPrice: Number(form.weavingPrice) || 0,
          materials: finalMaterials,
        })
      }
      setForm(null); setPreservedMats([]); refetch()
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      setErr(msg ?? 'Lỗi khi lưu')
    } finally { setSaving(false) }
  }

  const handleDelete = async (p: FramePiece) => {
    if (!confirm(`Xóa mảnh "${p.name}"?`)) return
    try { await api.deleteFramePiece(p.id); refetch() }
    catch { setErr('Không xóa được') }
  }

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div>
      {/* Chọn sản phẩm */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>Sản phẩm:</label>
        <select value={productId} onChange={e => { setProductId(e.target.value ? Number(e.target.value) : ''); setForm(null); setPreservedMats([]) }}
          style={{ ...inputStyle, width: 'auto', minWidth: 280 }}>
          <option value="">— Chọn sản phẩm —</option>
          {safeProducts.map(p => (
            <option key={p.id} value={p.id}>{p.factoryCode} — {p.name}</option>
          ))}
        </select>
        {productId !== '' && canEdit && !form && (
          <button onClick={startAdd}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '7px 14px', background: '#e65100', border: 'none', borderRadius: 'var(--radius)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            <Plus size={13} /> Thêm mảnh
          </button>
        )}
      </div>

      {err && <div style={{ background: '#ffebee', color: '#c62828', padding: '8px 12px', borderRadius: 'var(--radius)', marginBottom: 12, fontSize: 13 }}>{err}</div>}

      {/* Form thêm/sửa */}
      {form && (
        <div style={{ background: 'var(--surface2)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{form.id ? 'Sửa mảnh' : 'Thêm mảnh mới'}</h3>
            <button onClick={cancelForm} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}><X size={18} /></button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
            <div><div style={lbl}>Tên mảnh</div><input value={form.name} onChange={e => setField('name', e.target.value)} placeholder="Tựa lưng, Mê ngồi..." style={inputStyle} /></div>
            <div><div style={lbl}>Nhóm</div><input type="number" value={form.groupNumber} onChange={e => setField('groupNumber', e.target.value)} style={inputStyle} /></div>
            <div><div style={lbl}>Thứ tự</div><input type="number" value={form.pieceNumber} onChange={e => setField('pieceNumber', e.target.value)} style={inputStyle} /></div>
            <div><div style={lbl}>Số mảnh/bộ</div><input type="number" value={form.quantityPerSet} onChange={e => setField('quantityPerSet', e.target.value)} style={inputStyle} /></div>
          </div>

          {/* Đánh dấu mảnh đan (qua điểm đan + chuyền kiểm). Đơn giá đan nhập sau. */}
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 12, cursor: 'pointer', fontSize: 13, color: 'var(--text2)', fontWeight: 600 }}>
            <input type="checkbox" checked={form.isWoven} onChange={e => setForm(f => f ? { ...f, isWoven: e.target.checked } : f)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
            Mảnh đan <span style={{ fontWeight: 400, color: 'var(--text3)' }}>(qua điểm đan + chuyền kiểm trước khi đóng gói)</span>
          </label>

          {/* Vật tư khung của mảnh */}
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', margin: '4px 0 6px' }}>Vật tư của mảnh (khung)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '2.2fr 1.6fr 1fr 1fr 32px', gap: 6, fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginBottom: 4 }}>
            <div>Tên nguyên liệu</div><div>Quy cách</div><div>Chiều dài cắt (mm)</div><div>Số lượng/mảnh</div><div></div>
          </div>
          {form.materials.map((r, i) => (
            <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 8, marginBottom: 8, background: 'var(--surface)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2.2fr 1.6fr 1fr 1fr 32px', gap: 6, alignItems: 'center' }}>
                <select value={r.materialId} onChange={e => setRow(i, 'materialId', e.target.value ? Number(e.target.value) : '')} style={inputStyle}>
                  <option value="">— Chọn —</option>
                  {materialGroups.map(g => (
                    <optgroup key={g.name} label={g.name}>
                      {g.items.map(m => <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>)}
                    </optgroup>
                  ))}
                </select>
                <input value={r.spec} onChange={e => setRow(i, 'spec', e.target.value)} placeholder="25×50×0,7" style={inputStyle} />
                <input type="number" value={r.cutLengthMm} onChange={e => setRow(i, 'cutLengthMm', e.target.value)} placeholder="680" style={inputStyle} />
                <input type="number" value={r.piecesPerFrame} onChange={e => setRow(i, 'piecesPerFrame', e.target.value)} placeholder="1" style={inputStyle} />
                <button onClick={() => removeRow(i)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#c62828' }}><Trash2 size={15} /></button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>Công đoạn:</span>
                {OPERATIONS.map(op => {
                  const on = r.operations.includes(op.v)
                  return (
                    <button
                      key={op.v}
                      type="button"
                      onClick={() => toggleRowOp(i, op.v)}
                      style={{
                        padding: '3px 10px', borderRadius: 14, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        border: on ? '1px solid #e65100' : '1px solid var(--border)',
                        background: on ? '#e65100' : 'transparent',
                        color: on ? '#fff' : 'var(--text2)',
                      }}
                    >
                      {op.label}
                    </button>
                  )
                })}
                <span style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 2px' }} />
                <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>Sau phôi:</span>
                {([['needsHan', 'Hàn', '#e65100'], ['needsSon', 'Sơn', '#6a1b9a']] as const).map(([key, label, color]) => {
                  const on = r[key]
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setRow(i, key, !r[key])}
                      style={{
                        padding: '3px 10px', borderRadius: 14, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        border: on ? `1px solid ${color}` : '1px solid var(--border)',
                        background: on ? color : 'transparent',
                        color: on ? '#fff' : 'var(--text2)',
                      }}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
          <button onClick={addRow} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: 'transparent', border: '1px dashed var(--border)', borderRadius: 'var(--radius)', color: 'var(--text2)', fontSize: 12, cursor: 'pointer', marginTop: 4 }}>
            <Plus size={12} /> Thêm vật tư
          </button>
          {preservedMats.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text3)' }}>
              + Giữ nguyên {preservedMats.length} vật tư khác (dây đan / phụ kiện — bộ phận mua hàng)
            </div>
          )}

          <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
            <button onClick={handleSave} disabled={saving}
              style={{ padding: '8px 18px', background: '#e65100', border: 'none', borderRadius: 'var(--radius)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {saving ? 'Đang lưu...' : 'Lưu mảnh'}
            </button>
            <button onClick={cancelForm} style={{ padding: '8px 18px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text2)', fontSize: 13, cursor: 'pointer' }}>Hủy</button>
          </div>
        </div>
      )}

      {/* Danh sách mảnh */}
      {productId === '' && <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Chọn 1 sản phẩm để xem/nhập định mức mảnh</div>}
      {productId !== '' && isLoading && <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Đang tải...</div>}
      {productId !== '' && error && <div style={{ padding: 40, textAlign: 'center', color: '#c62828' }}>{error}</div>}
      {productId !== '' && !isLoading && !error && safePieces.length === 0 && !form && (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Sản phẩm này chưa có định mức mảnh</div>
      )}
      {productId !== '' && !isLoading && !error && safePieces.length > 0 && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          <div style={{ background: '#e3f2fd', color: '#0d47a1', padding: '10px 14px', borderRadius: 'var(--radius)', fontSize: 12, fontWeight: 600 }}>
            Tổng số mảnh: {totalPieces}
          </div>
          <div style={{ background: '#fff3e0', color: '#e65100', padding: '10px 14px', borderRadius: 'var(--radius)', fontSize: 12, fontWeight: 600 }}>
            Mảnh chưa có vật tư khung: {piecesWithoutMaterials}
          </div>
          <div style={{ background: '#f3e5f5', color: '#6a1b9a', padding: '10px 14px', borderRadius: 'var(--radius)', fontSize: 12, fontWeight: 600 }}>
            Mảnh vật tư khung thiếu/không đủ: {piecesWithIncompleteMaterials}
          </div>
        </div>
      )}

      {safePieces.map(p => {
        const frameMats = (Array.isArray(p.materials) ? p.materials : []).filter(m => isFrameMat(m.material?.name, m.material?.materialGroup?.name))
        return (
          <div key={p.id} style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', marginBottom: 12, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text3)' }}>{p.groupNumber}.{p.pieceNumber}</span>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{p.name}</span>
                <span style={{ fontSize: 12, color: 'var(--text2)' }}>· {p.quantityPerSet} mảnh/bộ</span>
                {p.isWoven && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: '#e8f5e9', color: '#2e7d32' }}>Đan</span>}
              </div>
              {canEdit && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => startEdit(p)} style={editBtn}><Pencil size={13} /> Sửa công đoạn</button>
                  <button onClick={() => handleDelete(p)} style={delBtn}><Trash2 size={13} /> Xóa</button>
                </div>
              )}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Tên nguyên liệu', 'Quy cách', 'Số lượng/mảnh', 'Công đoạn sản xuất'].map(h => (
                    <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text3)', fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {frameMats.map(m => (
                  <tr key={m.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 14px' }}>{m.material?.name ?? '—'}</td>
                    <td style={{ padding: '8px 14px', color: 'var(--text2)' }}>
                      {m.spec ?? '—'}{m.cutLengthMm ? ` — ${m.cutLengthMm}mm` : ''}
                    </td>
                    <td style={{ padding: '8px 14px' }}>{m.piecesPerFrame ?? '—'}</td>
                    <td style={{ padding: '8px 14px' }}>
                      {(Array.isArray(m.operations) && m.operations.length > 0) || m.needsHan || m.needsSon ? (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {(m.operations ?? []).map(op => (
                            <span key={op} style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 12, background: '#fff3e0', color: '#e65100' }}>
                              {OP_LABEL[op] ?? op}
                            </span>
                          ))}
                          {m.needsHan && (
                            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 12, background: '#fff3e0', color: '#e65100', border: '1px solid #ffcc80' }}>Hàn</span>
                          )}
                          {m.needsSon && (
                            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 12, background: '#f3e5f5', color: '#6a1b9a', border: '1px solid #ce93d8' }}>Sơn</span>
                          )}
                        </div>
                      ) : <span style={{ color: 'var(--text3)' }}>— (chưa gán, bấm Sửa để chọn)</span>}
                    </td>
                  </tr>
                ))}
                {frameMats.length === 0 && (
                  <tr><td colSpan={4} style={{ padding: 16, textAlign: 'center', color: 'var(--text3)' }}>Chưa có vật tư khung</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}

const lbl: React.CSSProperties = { fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginBottom: 3 }
const editBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px',
  background: '#fff3e0', border: '1px solid #ffcc80', borderRadius: 'var(--radius)',
  cursor: 'pointer', color: '#e65100', fontSize: 12, fontWeight: 600,
}
const delBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px',
  background: '#ffebee', border: '1px solid #ef9a9a', borderRadius: 'var(--radius)',
  cursor: 'pointer', color: '#c62828', fontSize: 12, fontWeight: 600,
}
