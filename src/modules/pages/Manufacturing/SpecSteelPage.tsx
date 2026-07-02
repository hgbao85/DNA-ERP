import { useState, useRef } from 'react'
import { ChevronRight, ChevronLeft, Plus, X } from 'lucide-react'
import NotifBell from '../../../components/NotifBell'
import QuotaSkuEntryPanel from './QuotaSkuEntryPanel'
import QuotaManhEntryPanel from './QuotaManhEntryPanel'

// ─── Types ────────────────────────────────────────────────────────────
type SteelItem = { name: string; specs: string; unit: string; chieuDai: string }
type ManChild = { id: number; loaiSatName: string; specs: string; chieuDai: string; soLuong: string }
type Manh = { id: number; tenManh: string; soLuong: string; children: ManChild[] }
type BomItem = { id: number; ten: string; thoiGian: string }
type DraftLine = { uid: number; name: string; specs: string; chieuDai: string; soLuong: string; unit: string }
type PendingReq = { uid: number; bomId: number; lines: DraftLine[]; submittedAt: string }
type RejectedLine = DraftLine & { submittedAt: string }

// ─── Mock data ────────────────────────────────────────────────────────
// Đơn từ kế hoạch sản xuất → hiển thị ở Định mức chi tiết
const MOCK_BOMS: BomItem[] = [
  { id: 1, ten: 'Ghế J55',      thoiGian: '23/06/2026' },
  { id: 2, ten: 'Ghế IEA-3',    thoiGian: '22/06/2026' },
  { id: 3, ten: 'Bàn mặt kính', thoiGian: '21/06/2026' },
  { id: 4, ten: 'Ghế GoPlus',   thoiGian: '20/06/2026' },
  { id: 5, ten: 'Ghế Cafe',     thoiGian: '19/06/2026' },
]

// bomId bị từ chối định mức mới
const REJECTED_VT_BOM_IDS: number[] = [5]

// SKU đã được duyệt định mức chi tiết → hiển thị ở Định mức mảnh
const MOCK_MANH_BOMS: BomItem[] = [
  { id: 1, ten: 'Ghế J55',    thoiGian: '23/06/2026' },
  { id: 4, ten: 'Ghế GoPlus', thoiGian: '20/06/2026' },
]

const STEEL_CATALOG: SteelItem[] = [
  { name: 'Sắt Vuông 6 zem',  specs: '18x18',  unit: 'cm', chieuDai: '620' },
  { name: 'Sắt Hộp 6 zem',    specs: '25x50',  unit: 'cm', chieuDai: '580' },
  { name: 'Sắt Hộp 8 zem',    specs: '20x40',  unit: 'cm', chieuDai: '450' },
]

// bomId:2 = IEA-3 đang chờ duyệt, bomId:1 = JSE-55 đã duyệt xong
const MOCK_PENDING: PendingReq[] = [
  {
    uid: 1, bomId: 2, submittedAt: '24/06/2026 09:15:22', lines: [
      { uid: 1, name: 'Thép Phi 6', specs: 'Ø6', chieuDai: '600', soLuong: '200', unit: 'cm' },
      { uid: 2, name: 'PAT',        specs: '',   chieuDai: '',    soLuong: '20',  unit: 'cái' },
    ]
  },
]

const MOCK_REJECTED: RejectedLine[] = [
  { uid: 3, name: 'PAT Kính', specs: '70x50', chieuDai: '', soLuong: '10', unit: 'cái', submittedAt: '20/06/2026 14:22:10' },
]

// bomId:3 = BAN-002 đang soạn nháp
const MOCK_DRAFT: Record<number, DraftLine[]> = {
  3: [{ uid: 4, name: 'Tán Rút', specs: 'M4x10', chieuDai: '', soLuong: '50', unit: 'con' }],
}

// bomId đã được duyệt định mức chi tiết
const APPROVED_VT_BOM_IDS: number[] = [1, 4]

const UNIT_OPTIONS = ['cm', 'cái', 'con', 'cây', 'kg', 'm', 'cuộn']

const VAT_TU_PRESETS: { name: string; unit: string }[] = [
  { name: 'Sắt Vuông 6 zem',  unit: 'cm'  },
  { name: 'Sắt Vuông 8 zem',  unit: 'cm'  },
  { name: 'Sắt Hộp 6 zem',    unit: 'cm'  },
  { name: 'Sắt Hộp 8 zem',    unit: 'cm'  },
  { name: 'Sắt Phi 6 zem',    unit: 'cm'  },
  { name: 'Thép Phi 6',        unit: 'cm'  },
  { name: 'Thép Phi 4',        unit: 'cm'  },
  { name: 'PAT',               unit: 'cái' },
  { name: 'Bánh đá cắt',      unit: 'cái' },
  { name: 'Tán Rút',           unit: 'con' },
  { name: 'Lỗ Dù',             unit: 'cái' },
  { name: 'PAT Kính',          unit: 'cái' },
  { name: 'PAT kính lỗ nhỏ',  unit: 'cái' },
]

// ─── Mock mảnh data theo từng BOM ─────────────────────────────────────
const MOCK_MANHS: Record<number, Manh[]> = {
  1: [ // Ghế J55
    {
      id: 1, tenManh: 'Mảnh tựa', soLuong: '1', children: [
        { id: 11, loaiSatName: 'Sắt Hộp 6 zem',   specs: '25x50', chieuDai: '580', soLuong: '2' },
        { id: 12, loaiSatName: 'Sắt Vuông 6 zem', specs: '18x18', chieuDai: '620', soLuong: '4' },
      ],
    },
    {
      id: 2, tenManh: 'Mảnh ngồi', soLuong: '1', children: [
        { id: 21, loaiSatName: 'Sắt Hộp 6 zem',   specs: '25x50', chieuDai: '480', soLuong: '2' },
        { id: 22, loaiSatName: 'Sắt Vuông 6 zem', specs: '18x18', chieuDai: '520', soLuong: '2' },
      ],
    },
    {
      id: 3, tenManh: 'Mảnh tay', soLuong: '2', children: [
        { id: 31, loaiSatName: 'Sắt Hộp 6 zem',   specs: '25x50', chieuDai: '350', soLuong: '2' },
        { id: 32, loaiSatName: 'Sắt Hộp 8 zem',   specs: '20x40', chieuDai: '300', soLuong: '2' },
      ],
    },
    {
      id: 4, tenManh: 'Chân ghế', soLuong: '1', children: [
        { id: 41, loaiSatName: 'Sắt Vuông 6 zem', specs: '18x18', chieuDai: '700', soLuong: '4' },
        { id: 42, loaiSatName: 'Sắt Hộp 8 zem',   specs: '20x40', chieuDai: '450', soLuong: '2' },
      ],
    },
  ],
}

// ─── SteelSearch ──────────────────────────────────────────────────────
// Nhập tự do được — dropdown chỉ là gợi ý từ catalog, không bắt buộc chọn
function SteelSearch({ selectedName, onChange, onSelectFromCatalog, catalog }: {
  selectedName: string
  onChange: (name: string) => void
  onSelectFromCatalog: (item: SteelItem) => void
  catalog: SteelItem[]
}) {
  const [focused, setFocused] = useState(false)

  const filtered = selectedName.trim() === ''
    ? catalog
    : catalog.filter(s => s.name.toLowerCase().includes(selectedName.toLowerCase()))

  const isNew = selectedName.trim() !== '' && !catalog.some(s => s.name.toLowerCase() === selectedName.trim().toLowerCase())

  return (
    <div style={{ position: 'relative', flex: 1 }}>
      <input
        value={selectedName}
        placeholder="Nhập hoặc chọn tên sắt…"
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%', padding: '7px 10px', fontSize: 13,
          border: '1px solid var(--border)', borderRadius: 'var(--radius)',
          background: 'var(--surface)', color: 'var(--text)',
          outline: 'none', boxSizing: 'border-box',
        }}
      />
      {focused && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 300,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', boxShadow: '0 4px 20px rgba(0,0,0,.12)',
          maxHeight: 220, overflowY: 'auto', marginTop: 4,
        }}>
          {isNew && (
            <div style={{ padding: '8px 14px', fontSize: 12, color: '#1565c0', background: '#e3f2fd', borderBottom: '1px solid var(--border)' }}>
              + Loại mới — sẽ thêm vào danh sách khi được duyệt
            </div>
          )}
          {filtered.length === 0 && !isNew && (
            <div style={{ padding: '10px 14px', color: 'var(--text3)', fontSize: 13 }}>Không tìm thấy gợi ý nào.</div>
          )}
          {filtered.map((s, i) => {
            const isSel = s.name === selectedName
            return (
              <div key={`${s.name}-${i}`}
                onMouseDown={e => e.preventDefault()}
                onClick={() => { onSelectFromCatalog(s); setFocused(false) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', cursor: 'pointer',
                  background: isSel ? 'var(--surface2)' : 'transparent',
                  borderBottom: '1px solid var(--border)',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                onMouseLeave={e => (e.currentTarget.style.background = isSel ? 'var(--surface2)' : 'transparent')}
              >
                <span style={{ fontSize: 13, fontWeight: isSel ? 700 : 400, color: 'var(--text)' }}>{s.name}</span>
                <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 'auto' }}>{s.specs}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── VatTuSearch ──────────────────────────────────────────────────────
// Nhập tự do được — dropdown chỉ là gợi ý từ preset, không bắt buộc chọn
function VatTuSearch({ value, onChange, onSelectFromPreset }: {
  value: string
  onChange: (name: string) => void
  onSelectFromPreset: (preset: { name: string; unit: string }) => void
}) {
  const [focused, setFocused] = useState(false)

  const filtered = value.trim() === ''
    ? VAT_TU_PRESETS
    : VAT_TU_PRESETS.filter(p => p.name.toLowerCase().includes(value.toLowerCase()))

  const isNew = value.trim() !== '' && !VAT_TU_PRESETS.some(p => p.name.toLowerCase() === value.trim().toLowerCase())

  return (
    <div style={{ position: 'relative', flex: 2, minWidth: 200 }}>
      <input
        value={value}
        placeholder="Nhập hoặc chọn tên vật tư…"
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        onChange={e => onChange(e.target.value)}
        style={{ ...inputStyle, paddingRight: value ? 28 : 10 }}
      />
      {value && (
        <button
          onMouseDown={e => e.preventDefault()}
          onClick={() => onChange('')}
          style={{
            position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)',
            display: 'flex', alignItems: 'center', padding: 2,
          }}>
          <X size={13} />
        </button>
      )}
      {focused && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 300,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', boxShadow: '0 4px 20px rgba(0,0,0,.12)',
          maxHeight: 240, overflowY: 'auto', marginTop: 4,
        }}>
          {isNew && (
            <div style={{ padding: '8px 14px', fontSize: 12, color: '#1565c0', background: '#e3f2fd', borderBottom: '1px solid var(--border)' }}>
              + Vật tư mới — sẽ thêm vào danh sách khi được duyệt
            </div>
          )}
          {filtered.length === 0 && !isNew && (
            <div style={{ padding: '10px 14px', color: 'var(--text3)', fontSize: 13 }}>Không tìm thấy gợi ý nào.</div>
          )}
          {filtered.map(p => (
            <div key={p.name}
              onMouseDown={e => e.preventDefault()}
              onClick={() => { onSelectFromPreset(p); setFocused(false) }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '9px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)',
                background: p.name === value ? 'var(--surface2)' : 'transparent',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
              onMouseLeave={e => (e.currentTarget.style.background = p.name === value ? 'var(--surface2)' : 'transparent')}
            >
              <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: p.name === value ? 700 : 400 }}>{p.name}</span>
              <span style={{ fontSize: 11, color: 'var(--text3)', background: 'var(--surface2)', borderRadius: 4, padding: '2px 7px', fontFamily: 'monospace' }}>ĐVT: {p.unit}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── SpecsInput ───────────────────────────────────────────────────────
function SpecsInput({ value, onChange, materialName, catalog, field = 'specs' }: {
  value: string
  onChange: (v: string) => void
  materialName: string
  catalog: SteelItem[]
  field?: 'specs' | 'chieuDai'
}) {
  const [focused, setFocused] = useState(false)

  const suggestions = catalog.filter(s => s.name === materialName && s[field]).map(s => s[field])
  const filtered = value.trim()
    ? suggestions.filter(s => s.toLowerCase().includes(value.toLowerCase()))
    : suggestions
  const showDropdown = focused && suggestions.length > 0

  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 130 }}>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder=""
        style={inputStyle}
      />
      {showDropdown && filtered.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 300,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', boxShadow: '0 4px 20px rgba(0,0,0,.12)',
          marginTop: 4, overflow: 'hidden',
        }}>
          {filtered.map(s => (
            <div key={s}
              onMouseDown={e => e.preventDefault()}
              onClick={() => { onChange(s); setFocused(false) }}
              style={{
                padding: '8px 14px', cursor: 'pointer', fontSize: 13,
                fontFamily: 'monospace', color: 'var(--text)',
                borderBottom: '1px solid var(--border)',
                background: s === value ? 'var(--surface2)' : 'transparent',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
              onMouseLeave={e => (e.currentTarget.style.background = s === value ? 'var(--surface2)' : 'transparent')}
            >
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

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
  subTab: 'dinh-muc' | 'vat-tu' | 'catalog'
  onSubTabChange: (t: 'dinh-muc' | 'vat-tu' | 'catalog') => void
}) {
  const [catalog, setCatalog] = useState<SteelItem[]>(STEEL_CATALOG)

  // ── Định mức ──────────────────────────────────────────────────────────
  const [selectedBom, setSelectedBom] = useState<BomItem | null>(null)
  const [manhs, setManhs] = useState<Manh[]>([])
  const [nextId, setNextId] = useState(1)
  const [submittedBomIds, setSubmittedBomIds] = useState<number[]>([])
  const [approvedManhBomIds] = useState<number[]>([1]) // Ghế J55 đã duyệt
  const [showManhForm, setShowManhForm] = useState(false)
  const [formTenManh, setFormTenManh] = useState('')
  const [formSoLuong, setFormSoLuong] = useState('1')
  const [addingTo, setAddingTo] = useState<number | null>(null)
  const [childSatName, setChildSatName] = useState('')
  const [childSpecs, setChildSpecs] = useState('')
  const [childChieuDai, setChildChieuDai] = useState('')
  const [childSoLuong, setChildSoLuong] = useState('')

  // ── Vật tư ────────────────────────────────────────────────────────────
  const [selectedVtBom, setSelectedVtBom] = useState<BomItem | null>(null)
  const [vtName, setVtName] = useState('')
  const [vtUnit, setVtUnit] = useState('cây')
  const [vtSpecs, setVtSpecs] = useState('')
  const [vtChieuDai, setVtChieuDai] = useState('')
  const [vtSoLuong, setVtSoLuong] = useState('')
  const [vtErr, setVtErr] = useState('')
  const [draftsByBom, setDraftsByBom] = useState<Record<number, DraftLine[]>>(MOCK_DRAFT)
  const [draftUid, setDraftUid] = useState(5)
  const [pendingReqs, setPendingReqs] = useState<PendingReq[]>(MOCK_PENDING)
  const [reqUid, setReqUid] = useState(2)
  const [rejectedLines, setRejectedLines] = useState<RejectedLine[]>(MOCK_REJECTED)
  const [approvedVtBomIds, setApprovedVtBomIds] = useState<number[]>(APPROVED_VT_BOM_IDS)
  const [rejectedVtBomIds] = useState<number[]>(REJECTED_VT_BOM_IDS)
  const [sentMsg, setSentMsg] = useState(false)
  const [manhBomSearch, setManhBomSearch] = useState('')
  const [vtBomSearch, setVtBomSearch] = useState('')
  const [catalogSearch, setCatalogSearch] = useState('')

  // ── BOM helpers ───────────────────────────────────────────────────────
  const openBom = (item: BomItem) => {
    const preset = MOCK_MANHS[item.id] ?? []
    const maxId = preset.flatMap(m => [m.id, ...m.children.map(c => c.id)]).reduce((a, b) => Math.max(a, b), 0)
    setSelectedBom(item); setManhs(preset); setNextId(maxId + 1)
    setShowManhForm(false); setFormTenManh('')
    setAddingTo(null); setChildSatName(''); setChildSpecs(''); setChildChieuDai(''); setChildSoLuong('')
  }

  const addManh = () => {
    if (!formTenManh.trim() || !selectedBom) return
    const sl = String(Math.max(1, Math.floor(Number(formSoLuong)) || 1))
    setManhs(m => [...m, { id: nextId, tenManh: formTenManh.trim(), soLuong: sl, children: [] }])
    setNextId(n => n + 1)
    setShowManhForm(false); setFormTenManh(''); setFormSoLuong('1')
  }

  const addChild = (manhId: number) => {
    if (!childSatName) return
    setManhs(ms => ms.map(m =>
      m.id === manhId
        ? { ...m, children: [...m.children, { id: nextId, loaiSatName: childSatName, specs: childSpecs, chieuDai: childChieuDai, soLuong: childSoLuong }] }
        : m
    ))
    setNextId(n => n + 1)
    setChildSatName(''); setChildSpecs(''); setChildChieuDai(''); setChildSoLuong('')
  }

  const deleteChild = (manhId: number, childId: number) =>
    setManhs(ms => ms.map(m => m.id === manhId ? { ...m, children: m.children.filter(c => c.id !== childId) } : m))

  const deleteManh = (manhId: number) => {
    setManhs(ms => ms.filter(m => m.id !== manhId))
    if (addingTo === manhId) setAddingTo(null)
  }

  // ── Vật tư helpers ────────────────────────────────────────────────────
  const currentDrafts = selectedVtBom ? (draftsByBom[selectedVtBom.id] ?? []) : []
  const currentPending = selectedVtBom ? pendingReqs.filter(r => r.bomId === selectedVtBom.id) : []

  const addToDraft = () => {
    setVtErr('')
    if (!vtName.trim() || !selectedVtBom) { setVtErr('Vui lòng chọn Tên vật tư.'); return }
    const line: DraftLine = { uid: draftUid, name: vtName.trim(), specs: vtSpecs.trim(), chieuDai: vtChieuDai.trim(), soLuong: vtSoLuong.trim(), unit: vtUnit }
    setDraftsByBom(d => ({ ...d, [selectedVtBom.id]: [...(d[selectedVtBom.id] ?? []), line] }))
    setDraftUid(n => n + 1)
    setVtName(''); setVtSpecs(''); setVtChieuDai(''); setVtSoLuong('')
  }

  const removeDraft = (uid: number) => {
    if (!selectedVtBom) return
    setDraftsByBom(d => ({ ...d, [selectedVtBom.id]: (d[selectedVtBom.id] ?? []).filter(x => x.uid !== uid) }))
  }

  const submitAll = () => {
    if (!currentDrafts.length || !selectedVtBom) return
    setPendingReqs(p => [...p, { uid: reqUid, bomId: selectedVtBom.id, lines: [...currentDrafts], submittedAt: new Date().toLocaleString('vi-VN') }])
    setReqUid(n => n + 1)
    setDraftsByBom(d => ({ ...d, [selectedVtBom.id]: [] }))
    setSentMsg(true); setTimeout(() => setSentMsg(false), 3000)
  }

  const vtBomStatus = (bomId: number): 'approved' | 'pending' | 'rejected' | 'canInput' =>
    approvedVtBomIds.includes(bomId) ? 'approved'
    : pendingReqs.some(r => r.bomId === bomId) ? 'pending'
    : rejectedVtBomIds.includes(bomId) ? 'rejected'
    : 'canInput'

  const totalChildren = manhs.reduce((s, m) => s + m.children.length, 0)
  const isSubmitted = !!selectedBom && submittedBomIds.includes(selectedBom.id)

  // ─── Render ────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Quản lý định mức — Sắt</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text3)' }}>Nhập định mức mảnh sắt theo SKU và đề xuất vật tư mới</p>
        </div>
        <NotifBell
          items={MOCK_MANH_BOMS.filter(b => approvedManhBomIds.includes(b.id)).map(n => ({ id: n.id, title: n.ten, subtitle: `Đã duyệt định mức mảnh · ${n.thoiGian}` }))}
          emptyText="Chưa có định mức nào được duyệt."
        />
      </div>

      {subTab === 'dinh-muc' && <QuotaManhEntryPanel />}

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
                {MOCK_MANH_BOMS.filter(b => b.ten.toLowerCase().includes(manhBomSearch.toLowerCase()) && !approvedManhBomIds.includes(b.id)).map(item => (
                  <tr key={item.id}
                    onClick={() => openBom(item)}
                    style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background .1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text)' }}>{item.ten}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--text2)' }}>{item.thoiGian}</td>
                    <td style={{ padding: '12px 14px' }}>
                      {approvedManhBomIds.includes(item.id)
                        ? <span style={{ background: '#e8f5e9', color: '#2e7d32', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>✓ Đã duyệt</span>
                        : submittedBomIds.includes(item.id)
                        ? <span style={{ background: '#fff3e0', color: '#e65100', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>⏳ Chờ duyệt</span>
                        : <span style={{ background: '#fce4ec', color: '#c62828', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>Cần nhập</span>
                      }
                    </td>
                    <td style={{ padding: '12px 14px' }}><ChevronRight size={16} color="var(--text3)" /></td>
                  </tr>
                ))}
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
                  <span style={{ fontSize: 12, color: 'var(--text3)' }}>{m.children.length} loại sắt</span>
                  {!isSubmitted && (
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => addingTo === m.id ? setAddingTo(null) : (setAddingTo(m.id), setChildSatName(''), setChildSpecs(''), setChildChieuDai(''), setChildSoLuong(''))}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px',
                          border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                          background: addingTo === m.id ? '#e3f2fd' : 'var(--surface)',
                          color: addingTo === m.id ? '#1565c0' : 'var(--text2)',
                          cursor: 'pointer', fontSize: 12, fontWeight: 600,
                        }}>
                        <Plus size={13} /> Thêm loại sắt
                      </button>
                      <button onClick={() => deleteManh(m.id)} style={{
                        padding: '5px 10px', border: '1px solid #ffcdd2', borderRadius: 'var(--radius)',
                        background: '#fff8f8', color: '#c62828', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                      }}>Xóa mảnh</button>
                    </div>
                  )}
                </div>

                {/* Children table */}
                {m.children.length > 0 && (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'var(--surface2)' }}>
                        <th style={{ width: 36, padding: '7px', textAlign: 'center', fontWeight: 600, color: 'var(--text2)', fontSize: 11 }}>#</th>
                        <th style={{ padding: '7px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text2)', fontSize: 11 }}>Loại sắt</th>
                        <th style={{ padding: '7px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text2)', fontSize: 11 }}>Quy cách</th>
                        <th style={{ width: 100, padding: '7px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--text2)', fontSize: 11 }}>Chiều dài</th>
                        <th style={{ width: 100, padding: '7px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--text2)', fontSize: 11 }}>Số lượng</th>
                        {!isSubmitted && <th style={{ width: 44 }}></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {m.children.map((c, i) => {
                        return (
                          <tr key={c.id} style={{ borderTop: '1px solid var(--border)' }}>
                            <td style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 12, padding: '9px 7px' }}>{i + 1}</td>
                            <td style={{ padding: '9px 14px', color: 'var(--text)', fontWeight: 500 }}>{c.loaiSatName}</td>
                            <td style={{ padding: '9px 14px', color: 'var(--text3)', fontSize: 12 }}>{c.specs || '—'}</td>
                            <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text3)' }}>{c.chieuDai || '—'}</td>
                            <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text)' }}>{c.soLuong || '—'}</td>
                            {!isSubmitted && (
                              <td style={{ textAlign: 'center', padding: '4px' }}>
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
                  <div style={{
                    display: 'flex', gap: 25, alignItems: 'flex-end', flexWrap: 'wrap',
                    padding: '12px 16px',
                    borderTop: m.children.length > 0 ? '1px dashed var(--border)' : 'none',
                  }}>
                    <div style={{ width: 200 }}>
                      <FL>Loại sắt</FL>
                      <SteelSearch selectedName={childSatName} catalog={catalog}
                        onChange={name => { setChildSatName(name); setChildSpecs('') }}
                        onSelectFromCatalog={item => { setChildSatName(item.name); setChildSpecs('') }} />
                    </div>
                    <div style={{ width: 120 }}>
                      <FL>Quy cách</FL>
                      <SpecsInput value={childSpecs} onChange={setChildSpecs} materialName={childSatName} catalog={catalog} />
                    </div>
                    <div style={{ width: 100 }}>
                      <FL>Chiều dài</FL>
                      <SpecsInput value={childChieuDai} onChange={setChildChieuDai} materialName={childSatName} catalog={catalog} field="chieuDai" />
                    </div>
                    <div style={{ width: 100 }}>
                      <FL>Số lượng</FL>
                      <input placeholder="0" value={childSoLuong}
                        onChange={e => setChildSoLuong(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addChild(m.id)}
                        style={inputStyle} />
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => addChild(m.id)} disabled={!childSatName} style={{
                        padding: '7px 14px', border: 'none', borderRadius: 'var(--radius)',
                        background: childSatName ? '#1565c0' : '#ccc',
                        color: '#fff', fontWeight: 600, fontSize: 13,
                        cursor: childSatName ? 'pointer' : 'not-allowed',
                      }}>+ Thêm</button>
                      <button onClick={() => setAddingTo(null)} style={{
                        padding: '7px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                        background: 'var(--surface)', cursor: 'pointer', fontSize: 13, color: 'var(--text2)',
                      }}>Đóng</button>
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
                selectedBom && approvedManhBomIds.includes(selectedBom.id) ? '#a5d6a7'
                : isSubmitted ? '#ffe082'
                : 'var(--border)'
              }`,
              borderRadius: 'var(--radius-lg)',
            }}>
              {selectedBom && approvedManhBomIds.includes(selectedBom.id) ? (
                <>
                  <span style={{ fontSize: 13, color: '#2e7d32', fontWeight: 600 }}>
                    ✓ Đã được duyệt
                  </span>
                  <button onClick={() => setSelectedBom(null)} style={{
                    padding: '7px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                    background: 'var(--surface)', cursor: 'pointer', fontSize: 13, color: 'var(--text2)',
                  }}>Quay lại danh sách</button>
                </>
              ) : isSubmitted ? (
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
                    {manhs.length} mảnh · {totalChildren} loại sắt
                  </span>
                  <button
                    onClick={() => {
                      if (!selectedBom) return
                      setSubmittedBomIds(ids => [...ids, selectedBom.id])
                    }}
                    disabled={totalChildren === 0}
                    style={{
                      padding: '7px 20px', border: 'none', borderRadius: 'var(--radius)',
                      background: totalChildren > 0 ? '#1565c0' : '#ccc',
                      color: '#fff', fontWeight: 700, fontSize: 13,
                      cursor: totalChildren > 0 ? 'pointer' : 'not-allowed',
                    }}
                  >Gửi phê duyệt →</button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {subTab === 'vat-tu' && (
        <QuotaSkuEntryPanel
          group="sat"
          groupLabel="Sắt"
          fields={[
            { key: 'specifications', label: 'Quy cách', type: 'text' },
            { key: 'thickness', label: 'Độ dày', type: 'number' },
            { key: 'unit', label: 'ĐVT', type: 'text' },
            { key: 'quantity', label: 'SL', type: 'number' },
          ]}
        />
      )}

      {/* ══ ĐỊNH MỨC CHI TIẾT: LIST SKU ══ */}
      {subTab === 'vat-tu' && !selectedVtBom && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <input
              value={vtBomSearch}
              onChange={e => setVtBomSearch(e.target.value)}
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
                {MOCK_BOMS.filter(b => b.ten.toLowerCase().includes(vtBomSearch.toLowerCase()) && vtBomStatus(b.id) !== 'approved').map(item => {
                  const st = vtBomStatus(item.id)
                  return (
                    <tr key={item.id}
                      onClick={() => { setSelectedVtBom(item); setVtName(''); setVtSpecs(''); setVtErr(''); setSentMsg(false) }}
                      style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text)' }}>{item.ten}</td>
                      <td style={{ padding: '12px 14px', color: 'var(--text2)' }}>{item.thoiGian}</td>
                      <td style={{ padding: '12px 14px' }}>
                        {st === 'pending'
                          ? <span style={{ background: '#fff3e0', color: '#e65100', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>⏳ Đợi duyệt</span>
                          : st === 'rejected'
                          ? <span style={{ background: '#fce4ec', color: '#c62828', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>✕ Bị từ chối</span>
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

      {/* ══ ĐỊNH MỨC CHI TIẾT: DETAIL ══ */}
      {subTab === 'vat-tu' && selectedVtBom && (
        <div>
          {/* Back */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <button onClick={() => setSelectedVtBom(null)} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: 13, color: 'var(--text2)',
            }}><ChevronLeft size={14} /> Quay lại</button>
            <div>
              <span style={{ fontWeight: 700, fontSize: 15 }}>{selectedVtBom.ten}</span>
            </div>
          </div>

          {/* Banner đã duyệt — ẩn form nhập */}
          {vtBomStatus(selectedVtBom.id) === 'approved' && (
            <div style={{ padding: '10px 16px', background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 'var(--radius-lg)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 16 }}>✓</span>
              <span style={{ fontWeight: 600, color: '#2e7d32', fontSize: 13 }}>Đã duyệt lần trước</span>
              <span style={{ fontSize: 12, color: '#388e3c' }}>— có thể gửi thêm đề xuất bổ sung nếu còn thiếu vật tư</span>
            </div>
          )}

          {vtBomStatus(selectedVtBom.id) === 'pending' && (
            <div style={{ padding: '10px 16px', background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 'var(--radius-lg)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 16 }}>⏳</span>
              <span style={{ fontWeight: 600, color: '#f57c00', fontSize: 13 }}>Đang chờ duyệt</span>
              <span style={{ fontSize: 12, color: '#ef6c00' }}>— không thể nhập thêm vật tư cho SKU này cho đến khi được duyệt</span>
            </div>
          )}

          {/* Input form — khoá khi đang chờ duyệt */}
          {vtBomStatus(selectedVtBom.id) !== 'pending' && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '18px 20px', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14, color: 'var(--text)' }}>
              {vtBomStatus(selectedVtBom.id) === 'approved' ? 'Gửi đề xuất bổ sung' : 'Thêm vật tư vào danh sách'}
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              {/* SKU — read only */}
              <div style={{ minWidth: 120 }}>
                <FL>SKU</FL>
                <div style={{ padding: '7px 12px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                  {selectedVtBom.ten}
                </div>
              </div>
              {/* Tên — chọn từ preset */}
              <div style={{ flex: 2, minWidth: 180 }}>
                <FL>Tên <span style={{ color: '#e53935' }}>*</span></FL>
                <VatTuSearch
                  value={vtName}
                  onChange={name => { setVtName(name); setVtErr('') }}
                  onSelectFromPreset={p => { setVtName(p.name); setVtUnit(p.unit); setVtErr('') }}
                />
              </div>
              {/* Quy cách */}
              <div style={{ flex: 1, minWidth: 130 }}>
                <FL>Quy cách</FL>
                <SpecsInput
                  value={vtSpecs}
                  onChange={setVtSpecs}
                  materialName={vtName}
                  catalog={catalog}
                />
              </div>
              {/* Chiều dài */}
              <div style={{ minWidth: 90 }}>
                <FL>Chiều dài</FL>
                <SpecsInput value={vtChieuDai} onChange={setVtChieuDai} materialName={vtName} catalog={catalog} field="chieuDai" />
              </div>
              {/* SL */}
              <div style={{ minWidth: 90 }}>
                <FL>SL</FL>
                <input value={vtSoLuong} onChange={e => setVtSoLuong(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addToDraft()}
                  placeholder="100" style={inputStyle} />
              </div>
              {/* ĐVT */}
              <div style={{ width: 68 }}>
                <FL>ĐVT</FL>
                <select value={vtUnit} onChange={e => setVtUnit(e.target.value)}
                  style={{ ...inputStyle, background: 'var(--surface)' }}>
                  {UNIT_OPTIONS.map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
              <button onClick={addToDraft} style={{
                padding: '7px 16px', border: 'none', borderRadius: 'var(--radius)',
                background: '#1565c0', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
              }}>+ Thêm</button>
            </div>
            {vtErr && (
              <div style={{ marginTop: 10, padding: '8px 12px', background: '#ffebee', color: '#c62828', borderRadius: 'var(--radius)', fontSize: 13 }}>{vtErr}</div>
            )}
          </div>
          )}

          {/* Draft list */}
          {currentDrafts.length > 0 && (
            <div style={{ background: 'var(--surface)', border: '1px solid #c5cae9', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: 16 }}>
              <div style={{ padding: '12px 16px', background: '#e8eaf6', borderBottom: '1px solid #c5cae9', fontWeight: 700, fontSize: 14, color: '#1a237e' }}>
                Danh sách chờ gửi
                <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 600, background: '#c5cae9', color: '#1a237e', borderRadius: 20, padding: '2px 8px' }}>
                  {currentDrafts.length} vật tư
                </span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                    {['SKU', 'Tên', 'Quy cách', 'Chiều dài', 'SL', 'ĐVT', ''].map((h, i) => (
                      <th key={i} style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text2)', fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {currentDrafts.map(d => (
                    <tr key={d.uid} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 600, fontSize: 13, color: 'var(--text2)' }}>{selectedVtBom?.ten}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 500, color: 'var(--text)' }}>{d.name}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--text3)' }}>{d.specs || '—'}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--text3)', fontFamily: 'monospace' }}>{d.chieuDai || '—'}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--text)', fontFamily: 'monospace' }}>{d.soLuong || '—'}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--text2)' }}>{d.unit}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        <button onClick={() => removeDraft(d.uid)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 2 }}>
                          <X size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border)' }}>
                <button onClick={submitAll} style={{
                  padding: '8px 24px', border: 'none', borderRadius: 'var(--radius)',
                  background: '#1565c0', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#0d47a1')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#1565c0')}
                >Gửi đề xuất ({currentDrafts.length} vật tư) →</button>
              </div>
            </div>
          )}

          {sentMsg && (
            <div style={{ padding: '10px 16px', background: '#e8f5e9', color: '#2e7d32', borderRadius: 'var(--radius)', fontWeight: 600, fontSize: 13, marginBottom: 16 }}>
              ✓ Đã gửi đề xuất thành công — đang chờ duyệt.
            </div>
          )}

          {/* Pending list */}
          {currentPending.length > 0 && (
            <div style={{ background: 'var(--surface)', border: '1px solid #ffe082', borderLeft: '4px solid #f57c00', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', background: '#fff8e1', borderBottom: '1px solid #ffe082', fontWeight: 700, fontSize: 14, color: '#e65100' }}>
                Đang chờ duyệt
                <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 600, background: '#ffe082', color: '#e65100', borderRadius: 20, padding: '2px 8px' }}>
                  {currentPending.reduce((s, r) => s + r.lines.length, 0)} vật tư
                </span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                    {['SKU', 'Tên', 'Quy cách', 'Chiều dài', 'SL', 'ĐVT', 'Gửi lúc', 'Trạng thái'].map((h, i) => (
                      <th key={i} style={{ padding: '8px 14px', textAlign: i === 7 ? 'right' : 'left', fontWeight: 600, color: 'var(--text2)', fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {currentPending.flatMap(req => req.lines.map(l => (
                    <tr key={`${req.uid}-${l.uid}`} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 600, fontSize: 13, color: 'var(--text2)' }}>{selectedVtBom?.ten}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 500, color: 'var(--text)' }}>{l.name}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--text3)' }}>{l.specs || '—'}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--text3)', fontFamily: 'monospace' }}>{l.chieuDai || '—'}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--text)', fontFamily: 'monospace' }}>{l.soLuong || '—'}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--text2)' }}>{l.unit}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--text3)', fontSize: 12 }}>{req.submittedAt}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        <span style={{ background: '#fff8e1', color: '#f57c00', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>⏳ Chờ duyệt</span>
                      </td>
                    </tr>
                  )))}
                </tbody>
              </table>
            </div>
          )}

          {currentDrafts.length === 0 && currentPending.length === 0 && !sentMsg && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '40px', textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>
              Chưa có đề xuất nào. Điền form phía trên để bắt đầu.
            </div>
          )}
        </div>
      )}

      {/* ══ CATALOG VẬT TƯ ══ */}
      {subTab === 'catalog' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── Từ chối ── */}
          {rejectedLines.length > 0 && (
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#c62828', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ background: '#ffebee', color: '#c62828', borderRadius: 20, padding: '2px 10px', fontSize: 12 }}>✕ Từ chối</span>
                <span style={{ color: 'var(--text3)', fontWeight: 400, fontSize: 12 }}>{rejectedLines.length} vật tư</span>
              </div>
              <div style={{ background: 'var(--surface)', border: '1px solid #ffcdd2', borderLeft: '4px solid #c62828', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#ffebee', borderBottom: '1px solid #ffcdd2' }}>
                      {['Tên vật tư', 'Quy cách', 'Chiều dài', 'SL', 'ĐVT', 'Gửi lúc', 'Trạng thái'].map((h, i) => (
                        <th key={i} style={{ padding: '8px 14px', textAlign: i === 6 ? 'right' : 'left', fontWeight: 600, color: '#b71c1c', fontSize: 11 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rejectedLines.map(l => (
                      <tr key={l.uid} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 500, color: 'var(--text2)' }}>{l.name}</td>
                        <td style={{ padding: '10px 14px', color: 'var(--text3)' }}>{l.specs || '—'}</td>
                        <td style={{ padding: '10px 14px', color: 'var(--text3)', fontFamily: 'monospace' }}>{l.chieuDai || '—'}</td>
                        <td style={{ padding: '10px 14px', color: 'var(--text)', fontFamily: 'monospace' }}>{l.soLuong || '—'}</td>
                        <td style={{ padding: '10px 14px', color: 'var(--text2)' }}>{l.unit}</td>
                        <td style={{ padding: '10px 14px', color: 'var(--text3)', fontSize: 12 }}>{l.submittedAt}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                          <span style={{ background: '#ffebee', color: '#c62828', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>✕ Từ chối</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Catalog ── */}
          <div>
            <div style={{ marginBottom: 16 }}>
              <input
                value={catalogSearch}
                onChange={e => setCatalogSearch(e.target.value)}
                placeholder="Tìm theo tên vật tư hoặc quy cách…"
                style={{ maxWidth: 320, padding: '7px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text)', outline: 'none' }}
              />
            </div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                    {['Tên vật tư', 'Quy cách', 'Chiều dài', 'ĐVT'].map((h, i) => (
                      <th key={i} style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text2)', fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {catalog.filter(s => {
                    const q = catalogSearch.toLowerCase()
                    return s.name.toLowerCase().includes(q) || s.specs.toLowerCase().includes(q)
                  }).map((s, i, arr) => (
                    <tr key={i} style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 500 }}>{s.name}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--text3)' }}>{s.specs || '—'}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--text3)', fontFamily: 'monospace' }}>{s.chieuDai || '—'}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--text2)' }}>{s.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}
    </div>
  )
}
