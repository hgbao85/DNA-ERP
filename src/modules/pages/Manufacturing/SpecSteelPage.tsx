import { useState } from 'react'
import { format } from 'date-fns'
import { ChevronRight, ChevronLeft, Plus, X, Pencil } from 'lucide-react'
import NotifBell from '../../../components/NotifBell'
import MaterialPicker, { type PickedMaterial } from '../../../components/MaterialPicker'
import { useFetch } from '../../../hooks/useFetch'
import { useMaterialGroupIds } from '../../../hooks/useMaterialGroupIds'
import * as api from '../../../services/api'
import { useAuth } from '../../../context/AuthContext'
import { useAuditLog } from '../../../context/AuditLogContext'
import { SKU_ENTITY } from '../../../constants/skuStatus'
import type { Sku, ManhRow, ManhChildRow, ManhChildGroup } from '../../../types/sku'

// ─── Types ────────────────────────────────────────────────────────────
// "Định mức mảnh" (Manh/children) đọc/ghi thẳng Sku thật (manhData.pieces) — quy đổi sang/từ
// shape domain dễ đọc trong JSX khi đọc/ghi (xem toManh/toManhRow). Mỗi mảnh giờ chứa vật tư
// từ 5 nhóm (Sắt/Dây/Đinh/Tán rút/Nút nhựa) — chỉ Sắt có khái niệm "đoạn cắt" (cutLengthMm),
// 4 nhóm còn lại chỉ có materialId + số lượng.
type ManChild = {
  id: number
  group: ManhChildGroup
  materialId: number
  loaiSatName: string
  specs: string
  cutLengthMm: string
  soLuong: string
  note: string
  unit: string
}
type Manh = { id: number; tenManh: string; soLuong: string; children: ManChild[] }
type BomItem = { id: string; ten: string; thoiGian: string }

const CHILD_GROUPS: ManhChildGroup[] = ['sat', 'day', 'dinh', 'tanRut', 'nutNhua']
const GROUP_LABELS: Record<ManhChildGroup, string> = {
  sat: 'Sắt', day: 'Dây', dinh: 'Đinh', tanRut: 'Tán rút', nutNhua: 'Nút nhựa',
}

// "Mảnh có đan" = có đủ cả 3 nhóm Dây + Đinh + Nút nhựa (Tán rút không tính) - đúng quy tắc
// BE dùng để set Piece.isWoven (xem SkusService.syncIsWoven). Tính lại ở FE thay vì đọc field
// isWoven từ BE vì trang này còn cho sửa nháp (chưa gửi phê duyệt) - phải phản ánh đúng NGAY
// theo dòng vật tư đang có trên form, không đợi round-trip lưu/tải lại.
const WOVEN_GROUPS: ManhChildGroup[] = ['day', 'dinh', 'nutNhua']
const wovenStatus = (m: Manh): { isWoven: boolean; missing: ManhChildGroup[] } => {
  const present = new Set(m.children.map(c => c.group))
  const missing = WOVEN_GROUPS.filter(g => !present.has(g))
  return { isWoven: missing.length === 0, missing }
}
const GROUP_BADGE_COLORS: Record<ManhChildGroup, { bg: string; fg: string }> = {
  sat: { bg: '#e3f2fd', fg: '#1565c0' },
  day: { bg: '#fff3e0', fg: '#e65100' },
  dinh: { bg: '#f3e5f5', fg: '#7b1fa2' },
  tanRut: { bg: '#e8f5e9', fg: '#2e7d32' },
  nutNhua: { bg: '#fce4ec', fg: '#ad1457' },
}

const toManh = (r: ManhRow): Manh => ({
  id: r.id, tenManh: r.name, soLuong: r.qtyPerSku ?? '1',
  children: r.children.map(c => ({
    id: c.id, group: c.group, materialId: Number(c.materialId) || 0, loaiSatName: c.name,
    specs: c.specs ?? '', cutLengthMm: c.length ?? '', soLuong: c.qty ?? '', note: c.note ?? '', unit: c.unit ?? '',
  })),
})
const toManhRow = (m: Manh): ManhRow => ({
  id: m.id, name: m.tenManh, qtyPerSku: m.soLuong,
  children: m.children.map((c): ManhChildRow => ({
    id: c.id, group: c.group, materialId: String(c.materialId), name: c.loaiSatName,
    specs: c.specs || undefined, length: c.cutLengthMm || undefined, qty: c.soLuong || undefined,
    note: c.note || undefined, unit: c.unit || undefined,
  })),
})

// ─── FieldLabel ───────────────────────────────────────────────────────
function FL({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 4, textTransform: 'uppercase' as const }}>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', fontSize: 13,
  border: '1px solid var(--border)', borderRadius: 'var(--radius)',
  background: 'var(--surface)', color: 'var(--text)',
  outline: 'none', boxSizing: 'border-box',
}

// ─── Main ─────────────────────────────────────────────────────────────
export default function SpecSteelPage({ subTab, onSubTabChange }: {
  subTab: 'dinh-muc' | 'catalog'
  onSubTabChange: (t: 'dinh-muc' | 'catalog') => void
}) {
  const { user } = useAuth()
  const { logAction } = useAuditLog()
  const { data: skusData, refetch: refetchSkus } = useFetch<Sku[]>(() => api.getSkus(), [])
  const skus = (skusData ?? []).filter(pf => pf.status !== 'DRAFT')
  const { data: materialsData } = useFetch(() => api.getMaterials(), [])
  const materials = materialsData ?? []
  const {
    steel: steelGroupId, wire: wireGroupId, nail: nailGroupId,
    rivet: rivetGroupId, plasticButton: plasticButtonGroupId,
  } = useMaterialGroupIds()
  const groupIdOf = (g: ManhChildGroup): number | undefined => {
    if (g === 'sat') return steelGroupId
    if (g === 'day') return wireGroupId
    if (g === 'dinh') return nailGroupId
    if (g === 'tanRut') return rivetGroupId
    return plasticButtonGroupId
  }

  const findPf = (id: string) => skus.find(pf => pf.id === id)

  // ── Định mức (mảnh) — Sku thật (manhData.pieces / manhEntryMeta / manhReviewStatus) ────────
  // Mảnh là bước nhập đầu tiên trong flow hiện tại nên hiện luôn cho mọi SKU chưa DRAFT.
  const manhBoms: BomItem[] = skus.map(pf => ({
    id: pf.id,
    ten: `${pf.mfgProduct?.factoryCode ?? ''} — ${pf.mfgProduct?.name ?? ''}`.replace(/^— | —$/g, ''),
    thoiGian: format(new Date(pf.createdAt), 'dd/MM/yyyy'),
  }))
  // Mảnh giờ chỉ còn 1 quyết định duyệt duy nhất cho cả 5 nhóm vật tư (không còn tách riêng
  // theo Sắt/Dây/Đinh như trước) — account Sắt nhập hết, KHSX duyệt 1 lần.
  const manhBomStatus = (bomId: string): 'approved' | 'pending' | 'rejected' | 'canInput' => {
    const pf = findPf(bomId)
    const review = pf?.manhReviewStatus
    if (review?.status === 'APPROVED') return 'approved'
    if (review?.status === 'REJECTED') return 'rejected'
    return (pf?.manhData?.pieces?.length ?? 0) > 0 ? 'pending' : 'canInput'
  }
  const [selectedBom, setSelectedBom] = useState<BomItem | null>(null)
  const [manhs, setManhs] = useState<Manh[]>([])
  const [nextId, setNextId] = useState(1)
  const [savingManh, setSavingManh] = useState(false)
  const [showManhForm, setShowManhForm] = useState(false)
  const [formTenManh, setFormTenManh] = useState('')
  const [formSoLuong, setFormSoLuong] = useState('1')
  const [addingTo, setAddingTo] = useState<number | null>(null)
  const [childGroup, setChildGroup] = useState<ManhChildGroup>('sat')
  const [childMaterial, setChildMaterial] = useState<PickedMaterial | null>(null)
  const [childSpec, setChildSpec] = useState('')
  const [childCutLengthMm, setChildCutLengthMm] = useState('')
  const [childSoLuong, setChildSoLuong] = useState('')
  const [childNote, setChildNote] = useState('')
  const [editingChild, setEditingChild] = useState<{ manhId: number; childId: number } | null>(null)
  const [manhBomSearch, setManhBomSearch] = useState('')
  const [catalogSearch, setCatalogSearch] = useState('')
  const [catalogGroup, setCatalogGroup] = useState<ManhChildGroup>('sat')

  // ── BOM helpers (mảnh) ─────────────────────────────────────────────────
  const openBom = (item: BomItem) => {
    const existing = (findPf(item.id)?.manhData?.pieces ?? []).map(toManh)
    const maxId = existing.flatMap(m => [m.id, ...m.children.map(c => c.id)]).reduce((a, b) => Math.max(a, b), 0)
    setSelectedBom(item); setManhs(existing); setNextId(maxId + 1)
    setShowManhForm(false); setFormTenManh('')
    setAddingTo(null); resetChildForm()
  }

  const submitManh = async () => {
    if (!selectedBom || totalChildren === 0) return
    setSavingManh(true)
    try {
      await api.updateSkuManhQuota(selectedBom.id, manhs.map(toManhRow), user?.name ?? 'Không rõ')
      logAction(SKU_ENTITY, String(selectedBom.id), 'sku.manh_submitted', `${manhs.length} mảnh · ${totalChildren} dòng vật tư`)
      await refetchSkus()
    } finally {
      setSavingManh(false)
    }
  }

  const addManh = () => {
    if (!formTenManh.trim() || !selectedBom) return
    const sl = String(Math.max(1, Math.floor(Number(formSoLuong)) || 1))
    setManhs(m => [...m, { id: nextId, tenManh: formTenManh.trim(), soLuong: sl, children: [] }])
    setNextId(n => n + 1)
    setShowManhForm(false); setFormTenManh(''); setFormSoLuong('1')
  }

  const resetChildForm = () => {
    setChildGroup('sat')
    setChildMaterial(null); setChildSpec(''); setChildCutLengthMm(''); setChildSoLuong(''); setChildNote(''); setEditingChild(null)
  }

  // Vừa dùng để thêm dòng vật tư mới, vừa dùng để lưu lại dòng đang sửa (editingChild) —
  // tránh bắt người dùng xóa rồi nhập lại từ đầu chỉ để chỉnh 1 trường. Chiều dài cắt chỉ bắt
  // buộc khi nhóm = Sắt (đoạn cắt); 4 nhóm còn lại chỉ cần vật tư + số lượng.
  const saveChild = (manhId: number) => {
    if (!childMaterial) return
    if (childGroup === 'sat' && !childCutLengthMm.trim()) return
    const editing = editingChild && editingChild.manhId === manhId ? editingChild : null
    setManhs(ms => ms.map(m => {
      if (m.id !== manhId) return m
      const built: ManChild = {
        id: editing ? editing.childId : nextId,
        group: childGroup,
        materialId: childMaterial.id,
        loaiSatName: `${childMaterial.code} — ${childMaterial.name}`,
        specs: childSpec,
        cutLengthMm: childGroup === 'sat' ? childCutLengthMm : '',
        soLuong: childSoLuong,
        note: childNote.trim(),
        unit: childMaterial.unit,
      }
      if (editing) {
        return { ...m, children: m.children.map(c => c.id === editing.childId ? built : c) }
      }
      return { ...m, children: [...m.children, built] }
    }))
    if (!editing) setNextId(n => n + 1)
    resetChildForm()
  }

  const startEditChild = (manhId: number, child: ManChild) => {
    const mat = materials.find(s => s.id === child.materialId)
    setAddingTo(manhId)
    setEditingChild({ manhId, childId: child.id })
    setChildGroup(child.group)
    setChildMaterial(mat ? { id: mat.id, code: mat.code, name: mat.name, unit: mat.unit, spec: mat.spec } : null)
    setChildSpec(child.specs)
    setChildCutLengthMm(child.cutLengthMm)
    setChildSoLuong(child.soLuong)
    setChildNote(child.note)
  }

  const deleteChild = (manhId: number, childId: number) => {
    setManhs(ms => ms.map(m => m.id === manhId ? { ...m, children: m.children.filter(c => c.id !== childId) } : m))
    if (editingChild && editingChild.manhId === manhId && editingChild.childId === childId) resetChildForm()
  }

  const deleteManh = (manhId: number) => {
    setManhs(ms => ms.filter(m => m.id !== manhId))
    if (addingTo === manhId) setAddingTo(null)
    if (editingChild && editingChild.manhId === manhId) resetChildForm()
  }

  const totalChildren = manhs.reduce((s, m) => s + m.children.length, 0)
  const manhSt = selectedBom ? manhBomStatus(selectedBom.id) : 'canInput'
  // Bị từ chối vẫn phải cho sửa/nộp lại — chỉ khoá khi đã nộp và đang chờ duyệt hoặc đã duyệt.
  const isSubmitted = manhSt === 'pending' || manhSt === 'approved'

  const catalogGroupId = groupIdOf(catalogGroup)
  const catalogMaterials = materials.filter(m => catalogGroupId != null && m.materialGroupId === catalogGroupId)

  // ─── Render ────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Quản lý định mức — Mảnh</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text3)' }}>Nhập định mức mảnh theo SKU — Sắt, Dây, Đinh, Tán rút, Nút nhựa</p>
        </div>
        <NotifBell
          items={manhBoms.filter(b => manhBomStatus(b.id) === 'approved').map(n => ({ id: n.id, title: n.ten, subtitle: `Đã duyệt định mức mảnh · ${n.thoiGian}` }))}
          emptyText="Chưa có định mức nào được duyệt."
        />
      </div>

      {/* ══ ĐỊNH MỨC: LIST ══ */}
      {subTab === 'dinh-muc' && !selectedBom && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <input
              value={manhBomSearch}
              onChange={e => setManhBomSearch(e.target.value)}
              placeholder="Tìm theo tên SKU…"
              style={{ maxWidth: 280, padding: '7px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text)', outline: 'none' }}
            />
          </div>
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                  {['SKU', 'Thời gian', 'Trạng thái', ''].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text2)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {manhBoms.filter(b => b.ten.toLowerCase().includes(manhBomSearch.toLowerCase()) && manhBomStatus(b.id) !== 'approved').map(item => {
                  const st = manhBomStatus(item.id)
                  const rejectReason = st === 'rejected' ? findPf(item.id)?.manhReviewStatus?.reason : undefined
                  return (
                  <tr key={item.id}
                    onClick={() => openBom(item)}
                    style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background .1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text)' }}>
                      {item.ten}
                      {rejectReason && (
                        <div style={{ marginTop: 2, fontSize: 11, fontWeight: 400, color: '#c62828', fontStyle: 'italic' }}>{rejectReason}</div>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px', color: 'var(--text2)' }}>{item.thoiGian}</td>
                    <td style={{ padding: '12px 14px' }}>
                      {st === 'pending'
                        ? <span style={{ background: '#fff3e0', color: '#e65100', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>⏳ Chờ duyệt</span>
                        : st === 'rejected'
                        ? <span style={{ background: '#ffebee', color: '#c62828', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>✕ Bị từ chối</span>
                        : <span style={{ background: '#eef2ff', color: '#3949ab', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>Chờ nhập</span>
                      }
                    </td>
                    <td style={{ padding: '12px 14px' }}><ChevronRight size={16} color="var(--text3)" /></td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══ ĐỊNH MỨC: DETAIL ══ */}
      {subTab === 'dinh-muc' && selectedBom && (
        <div>
          {/* Back */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <button onClick={() => setSelectedBom(null)} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: 13, color: 'var(--text2)',
            }}><ChevronLeft size={14} /> Quay lại</button>
            <div>
              <span style={{ fontWeight: 700, fontSize: 15 }}>{selectedBom.ten}</span>
              <span style={{ marginLeft: 10, fontSize: 12, color: 'var(--text3)' }}>{selectedBom.thoiGian}</span>
            </div>
          </div>

          {findPf(selectedBom.id)?.manhEntryMeta && (
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>
              Đã nhập bởi <strong>{findPf(selectedBom.id)!.manhEntryMeta!.enteredBy}</strong> lúc {new Date(findPf(selectedBom.id)!.manhEntryMeta!.enteredAt).toLocaleString('vi-VN')}
            </div>
          )}

          {manhSt === 'rejected' && (
            <div style={{ padding: '10px 16px', background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 'var(--radius-lg)', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#dc2626' }}>⚠ KHSX đã từ chối — vui lòng chỉnh sửa và gửi lại</div>
              {findPf(selectedBom.id)?.manhReviewStatus?.reason && (
                <div style={{ fontSize: 12, color: '#dc2626', fontStyle: 'italic', marginTop: 2 }}>{findPf(selectedBom.id)!.manhReviewStatus!.reason}</div>
              )}
            </div>
          )}

          {/* Form tạo mảnh */}
          {showManhForm && (
            <div style={{ background: '#e3f2fd', border: '1px solid #90caf9', borderRadius: 'var(--radius-lg)', padding: '14px 16px', marginBottom: 14 }}>
              <div style={{ fontWeight: 700, color: '#1565c0', marginBottom: 10, fontSize: 14 }}>Tạo mảnh mới</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div>
                  <FL>SKU</FL>
                  <div style={{ padding: '7px 12px', background: '#d6e8fb', border: '1px solid #90caf9', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 700, color: '#1565c0' }}>
                    {selectedBom.ten}
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <FL>Tên mảnh <span style={{ color: '#e53935' }}>*</span></FL>
                  <input autoFocus placeholder="Mảnh tựa, Mảnh tay…" value={formTenManh}
                    onChange={e => setFormTenManh(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addManh()}
                    style={inputStyle} />
                </div>
                <div style={{ width: 110 }}>
                  <FL>Số lượng / SKU</FL>
                  <input type="number" min={1} placeholder="1" value={formSoLuong}
                    onChange={e => setFormSoLuong(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addManh()}
                    style={inputStyle} />
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={addManh} disabled={!formTenManh.trim()} style={{
                    padding: '7px 16px', border: 'none', borderRadius: 'var(--radius)',
                    background: formTenManh.trim() ? '#1565c0' : '#ccc',
                    color: '#fff', fontWeight: 700, fontSize: 13,
                    cursor: formTenManh.trim() ? 'pointer' : 'not-allowed',
                  }}>Tạo mảnh</button>
                  <button onClick={() => { setShowManhForm(false); setFormTenManh(''); setFormSoLuong('1') }} style={{
                    padding: '7px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                    background: 'var(--surface)', cursor: 'pointer', fontSize: 13, color: 'var(--text2)',
                  }}>Hủy</button>
                </div>
              </div>
            </div>
          )}

          {/* Empty state */}
          {manhs.length === 0 && !showManhForm && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '40px', textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>
              Chưa có mảnh nào —{' '}
              <button onClick={() => setShowManhForm(true)} style={{ background: 'none', border: 'none', color: '#1565c0', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
                + Nhập mảnh đầu tiên
              </button>
            </div>
          )}

          {/* Mảnh list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {manhs.map(m => (
              <div key={m.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
                {/* Header */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
                  background: 'var(--surface2)',
                  borderBottom: m.children.length > 0 || addingTo === m.id ? '1px solid var(--border)' : 'none',
                }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#1565c0', background: '#e3f2fd', borderRadius: 4, padding: '2px 7px' }}>
                    {selectedBom?.ten}
                  </span>
                  <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{m.tenManh}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#e65100', background: '#fff3e0', borderRadius: 4, padding: '2px 7px' }}>×{m.soLuong} / SKU</span>
                  <span style={{ fontSize: 12, color: 'var(--text3)' }}>{m.children.length} dòng vật tư</span>
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
                    {(() => {
                      const { isWoven, missing } = wovenStatus(m)
                      return isWoven ? (
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#2e7d32' }}>✓ Có đan</span>
                      ) : (
                        <span
                          title={missing.length < WOVEN_GROUPS.length ? `Thiếu ${missing.map(g => GROUP_LABELS[g]).join(', ')}` : undefined}
                          style={{ fontSize: 12, color: 'var(--text3)' }}
                        >
                          Không đan
                        </span>
                      )
                    })()}
                    {!isSubmitted && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => addingTo === m.id ? (setAddingTo(null), resetChildForm()) : (setAddingTo(m.id), resetChildForm())}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px',
                            border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                            background: addingTo === m.id ? '#e3f2fd' : 'var(--surface)',
                            color: addingTo === m.id ? '#1565c0' : 'var(--text2)',
                            cursor: 'pointer', fontSize: 12, fontWeight: 600,
                          }}>
                          <Plus size={13} /> Thêm vật tư
                        </button>
                        <button onClick={() => deleteManh(m.id)} style={{
                          padding: '5px 10px', border: '1px solid #ffcdd2', borderRadius: 'var(--radius)',
                          background: '#fff8f8', color: '#c62828', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                        }}>Xóa mảnh</button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Children table */}
                {m.children.length > 0 && (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'var(--surface2)' }}>
                        <th style={{ width: 36, padding: '7px', textAlign: 'center', fontWeight: 600, color: 'var(--text2)', fontSize: 11 }}>#</th>
                        <th style={{ width: 80, padding: '7px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text2)', fontSize: 11 }}>Nhóm</th>
                        <th style={{ padding: '7px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text2)', fontSize: 11 }}>Vật tư</th>
                        <th style={{ padding: '7px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text2)', fontSize: 11 }}>Quy cách</th>
                        <th style={{ width: 110, padding: '7px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--text2)', fontSize: 11 }}>Chiều dài (mm)</th>
                        <th style={{ width: 100, padding: '7px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--text2)', fontSize: 11 }}>Số lượng</th>
                        <th style={{ width: 70, padding: '7px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text2)', fontSize: 11 }}>ĐVT</th>
                        {!isSubmitted && <th style={{ width: 64 }}></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {m.children.map((c, i) => {
                        const isEditingThis = editingChild?.manhId === m.id && editingChild.childId === c.id
                        const badge = GROUP_BADGE_COLORS[c.group]
                        return (
                          <tr key={c.id} style={{ borderTop: '1px solid var(--border)', background: isEditingThis ? '#e3f2fd' : undefined }}>
                            <td style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 12, padding: '9px 7px' }}>{i + 1}</td>
                            <td style={{ padding: '9px 14px' }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: badge.fg, background: badge.bg, borderRadius: 4, padding: '2px 7px', whiteSpace: 'nowrap' }}>
                                {GROUP_LABELS[c.group]}
                              </span>
                            </td>
                            <td style={{ padding: '9px 14px', color: 'var(--text)', fontWeight: 500 }}>
                              {c.loaiSatName}
                              {c.note && <span style={{ color: 'var(--text3)', fontWeight: 400 }}> ({c.note})</span>}
                            </td>
                            <td style={{ padding: '9px 14px', color: 'var(--text3)' }}>{c.specs || '—'}</td>
                            <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text3)' }}>{c.group === 'sat' ? (c.cutLengthMm || '—') : '—'}</td>
                            <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text)' }}>{c.soLuong || '—'}</td>
                            <td style={{ padding: '9px 14px', color: 'var(--text3)' }}>{c.unit || '—'}</td>
                            {!isSubmitted && (
                              <td style={{ textAlign: 'center', padding: '4px', whiteSpace: 'nowrap' }}>
                                <button onClick={() => startEditChild(m.id, c)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 4 }}>
                                  <Pencil size={13} />
                                </button>
                                <button onClick={() => deleteChild(m.id, c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 4 }}>
                                  <X size={14} />
                                </button>
                              </td>
                            )}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}

                {/* Add child inline */}
                {addingTo === m.id && (
                  <div style={{ padding: '12px 16px', borderTop: m.children.length > 0 ? '1px dashed var(--border)' : 'none' }}>
                    {/* Chọn nhóm vật tư — quyết định materialGroupId lọc MaterialPicker và có hiện
                        Chiều dài cắt hay không (chỉ nhóm Sắt có khái niệm đoạn cắt). */}
                    <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                      {CHILD_GROUPS.map(g => (
                        <button key={g}
                          onClick={() => { setChildGroup(g); setChildMaterial(null); setChildSpec(''); setChildCutLengthMm('') }}
                          style={{
                            padding: '5px 12px', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                            border: `1px solid ${childGroup === g ? GROUP_BADGE_COLORS[g].fg : 'var(--border)'}`,
                            background: childGroup === g ? GROUP_BADGE_COLORS[g].bg : 'var(--surface)',
                            color: childGroup === g ? GROUP_BADGE_COLORS[g].fg : 'var(--text2)',
                          }}
                        >{GROUP_LABELS[g]}</button>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 25, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                      <div style={{ width: 240 }}>
                        <FL>Vật tư (nhóm {GROUP_LABELS[childGroup]})</FL>
                        <MaterialPicker
                          value={childMaterial}
                          onSelect={m => { setChildMaterial(m); setChildSpec(m?.spec ?? '') }}
                          materialGroupId={groupIdOf(childGroup)}
                          placeholder={`Chọn ${GROUP_LABELS[childGroup].toLowerCase()}…`}
                        />
                      </div>
                      <div style={{ width: 150 }}>
                        <FL>Quy cách</FL>
                        <input placeholder="VD: 10x29x0.8" value={childSpec}
                          onChange={e => setChildSpec(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && saveChild(m.id)}
                          style={inputStyle} />
                      </div>
                      {childGroup === 'sat' && (
                        <div style={{ width: 120 }}>
                          <FL>Chiều dài cắt (mm)</FL>
                          <input type="number" min={1} placeholder="930" value={childCutLengthMm}
                            onChange={e => setChildCutLengthMm(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && saveChild(m.id)}
                            style={inputStyle} />
                        </div>
                      )}
                      <div style={{ width: 100 }}>
                        <FL>Số lượng</FL>
                        <input placeholder="0" value={childSoLuong}
                          onChange={e => setChildSoLuong(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && saveChild(m.id)}
                          style={inputStyle} />
                      </div>
                      <div style={{ width: 160 }}>
                        <FL>Ghi chú</FL>
                        <input placeholder="VD: uốn, tán,..." value={childNote}
                          onChange={e => setChildNote(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && saveChild(m.id)}
                          style={inputStyle} />
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => saveChild(m.id)} disabled={!childMaterial || (childGroup === 'sat' && !childCutLengthMm.trim())} style={{
                          padding: '7px 14px', border: 'none', borderRadius: 'var(--radius)',
                          background: childMaterial && (childGroup !== 'sat' || childCutLengthMm.trim()) ? '#1565c0' : '#ccc',
                          color: '#fff', fontWeight: 600, fontSize: 13,
                          cursor: childMaterial && (childGroup !== 'sat' || childCutLengthMm.trim()) ? 'pointer' : 'not-allowed',
                        }}>{editingChild?.manhId === m.id ? 'Lưu' : '+ Thêm'}</button>
                        <button onClick={() => { setAddingTo(null); resetChildForm() }} style={{
                          padding: '7px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                          background: 'var(--surface)', cursor: 'pointer', fontSize: 13, color: 'var(--text2)',
                        }}>{editingChild?.manhId === m.id ? 'Hủy' : 'Đóng'}</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Thêm mảnh mới */}
            {!isSubmitted && !showManhForm && manhs.length > 0 && (
              <button onClick={() => setShowManhForm(true)} style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 16px',
                background: 'var(--surface)', border: '1px dashed var(--border)',
                borderRadius: 'var(--radius-lg)', cursor: 'pointer', color: 'var(--text2)', fontWeight: 600, fontSize: 13,
              }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface)')}
              >
                <Plus size={15} /> Thêm mảnh mới
              </button>
            )}
          </div>

          {/* Submit bar */}
          {manhs.length > 0 && (
            <div style={{
              marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 16px', background: 'var(--surface)',
              border: `1px solid ${
                manhSt === 'approved' ? '#a5d6a7'
                : manhSt === 'pending' ? '#ffe082'
                : 'var(--border)'
              }`,
              borderRadius: 'var(--radius-lg)',
            }}>
              {manhSt === 'approved' ? (
                <>
                  <span style={{ fontSize: 13, color: '#2e7d32', fontWeight: 600 }}>
                    ✓ Đã được duyệt
                  </span>
                  <button onClick={() => setSelectedBom(null)} style={{
                    padding: '7px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                    background: 'var(--surface)', cursor: 'pointer', fontSize: 13, color: 'var(--text2)',
                  }}>Quay lại danh sách</button>
                </>
              ) : manhSt === 'pending' ? (
                <>
                  <span style={{ fontSize: 13, color: '#e65100', fontWeight: 600 }}>
                    ⏳ Đã gửi phê duyệt — đang chờ quản lý xác nhận
                  </span>
                  <button onClick={() => setSelectedBom(null)} style={{
                    padding: '7px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                    background: 'var(--surface)', cursor: 'pointer', fontSize: 13, color: 'var(--text2)',
                  }}>Quay lại danh sách</button>
                </>
              ) : (
                <>
                  <span style={{ fontSize: 13, color: 'var(--text2)' }}>
                    {manhs.length} mảnh · {totalChildren} dòng vật tư
                  </span>
                  <button
                    onClick={submitManh}
                    disabled={totalChildren === 0 || savingManh}
                    style={{
                      padding: '7px 20px', border: 'none', borderRadius: 'var(--radius)',
                      background: totalChildren > 0 ? '#1565c0' : '#ccc',
                      color: '#fff', fontWeight: 700, fontSize: 13,
                      cursor: totalChildren > 0 && !savingManh ? 'pointer' : 'not-allowed',
                      opacity: savingManh ? 0.7 : 1,
                    }}
                  >{savingManh ? 'Đang gửi...' : 'Gửi phê duyệt →'}</button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══ CATALOG VẬT TƯ (Material thật, 5 nhóm — quản lý ở Admin > Vật tư) ══ */}
      {subTab === 'catalog' && (
        <div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
            {CHILD_GROUPS.map(g => (
              <button
                key={g}
                onClick={() => { setCatalogGroup(g); setCatalogSearch('') }}
                style={{
                  padding: '9px 18px', border: 'none', background: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 600, color: catalogGroup === g ? '#1565c0' : 'var(--text3)',
                  borderBottom: catalogGroup === g ? '2px solid #1565c0' : '2px solid transparent',
                  marginBottom: -1,
                }}
              >{GROUP_LABELS[g]}</button>
            ))}
          </div>
          <div style={{ marginBottom: 16 }}>
            <input
              value={catalogSearch}
              onChange={e => setCatalogSearch(e.target.value)}
              placeholder="Tìm theo mã hoặc tên vật tư…"
              style={{ maxWidth: 320, padding: '7px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text)', outline: 'none' }}
            />
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                  {['Mã vật tư', 'Tên vật tư', 'Quy cách', 'ĐVT'].map((h, i) => (
                    <th key={i} style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text2)', fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {catalogMaterials.filter(s => {
                  const q = catalogSearch.toLowerCase()
                  return s.code.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
                }).map((s) => (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 600 }}>{s.code}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--text3)' }}>{s.name}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--text3)' }}>{s.spec || '—'}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--text2)' }}>{s.unit}</td>
                  </tr>
                ))}
                {catalogMaterials.filter(s => {
                  const q = catalogSearch.toLowerCase()
                  return s.code.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
                }).length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>
                      {catalogSearch ? 'Không tìm thấy kết quả.' : `Chưa có vật tư nhóm ${GROUP_LABELS[catalogGroup]} nào — thêm ở Admin > Vật tư.`}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
