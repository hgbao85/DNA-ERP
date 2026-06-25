import { useState, useRef } from 'react'
import { ChevronRight, ChevronLeft, Plus, X } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────
type SteelItem = { name: string; specs: string; doDay?: string }
type ManChild = { id: number; loaiSatName: string; soLuong: string }
type Manh = { id: number; maNhaMay: string; tenManh: string; children: ManChild[] }
type BomItem = { id: number; maNhaMay: string; ten: string; thoiGian: string }
type DraftLine = { uid: number; name: string; unit: string; specs: string; doDay: string }
type PendingReq = { uid: number; lines: DraftLine[]; submittedAt: string }
type RejectedLine = DraftLine & { submittedAt: string }

// ─── Mock data ────────────────────────────────────────────────────────
const MOCK_BOMS: BomItem[] = [
  { id: 1, maNhaMay: 'JSE-55', ten: 'Ghế J55', thoiGian: '23/06/2026' },
  { id: 2, maNhaMay: 'IEA-3', ten: 'Ghế IEA-3', thoiGian: '22/06/2026' },
  { id: 3, maNhaMay: 'BAN-002', ten: 'Bàn mặt kính', thoiGian: '21/06/2026' },
]

const STEEL_CATALOG: SteelItem[] = [
  { name: 'Sắt Vuông', specs: '18×18mm × 620cm', doDay: '—' },
  { name: 'Sắt Hộp', specs: '25×50mm × 600cm', doDay: '0.8mm' },
  { name: 'Sắt Phi', specs: 'Ø25mm × 600cm', doDay: '—' },
  { name: 'Sắt Hộp', specs: '20×40mm × 600cm', doDay: '1.2mm' },
]

const MOCK_PENDING: PendingReq[] = [
  {
    uid: 1, submittedAt: '24/06/2026 09:15:22', lines: [
      { uid: 1, name: 'Thép Phi', unit: 'cm', specs: 'Ø8mm × 600cm', doDay: '—' },
    ]
  },
]

const MOCK_REJECTED: RejectedLine[] = [
  { uid: 2, name: 'PAT Kính', unit: 'cái', specs: '70×50mm', doDay: '—', submittedAt: '20/06/2026 14:22:10' },
]

const MOCK_DRAFT: DraftLine[] = [
  { uid: 3, name: 'Tán Rút', unit: 'con', specs: 'M4×10mm', doDay: '—' },
]

const UNIT_OPTIONS = ['cm', 'cái', 'con', 'cây', 'kg', 'm', 'cuộn']

const VAT_TU_PRESETS: { name: string; unit: string }[] = [
  { name: 'Sắt Vuông', unit: 'cm' },
  { name: 'Sắt Hộp', unit: 'cm' },
  { name: 'Sắt Phi', unit: 'cm' },
  { name: 'Thép Phi', unit: 'cm' },
  { name: 'PAT', unit: 'cái' },
  { name: 'Bánh đá cắt', unit: 'cái' },
  { name: 'Tán Rút', unit: 'con' },
  { name: 'Lỗ Dù', unit: 'cái' },
  { name: 'PAT Kính', unit: 'cái' },
  { name: 'PAT kính lỗ nhỏ', unit: 'cái' },
]

// ─── Mock mảnh data theo từng BOM ─────────────────────────────────────
const MOCK_MANHS: Record<number, Manh[]> = {
  1: [ // JSE-55 — Ghế J55
    {
      id: 1, maNhaMay: 'JSE-55', tenManh: 'Mảnh tựa', children: [
        { id: 11, loaiSatName: 'Sắt Hộp', soLuong: '2' },
        { id: 12, loaiSatName: 'Sắt Phi', soLuong: '4' },
      ],
    },
    {
      id: 2, maNhaMay: 'JSE-55', tenManh: 'Mảnh ngồi', children: [
        { id: 21, loaiSatName: 'Sắt Hộp', soLuong: '2' },
        { id: 22, loaiSatName: 'Sắt Vuông', soLuong: '2' },
      ],
    },
    {
      id: 3, maNhaMay: 'JSE-55', tenManh: 'Mảnh tay', children: [
        { id: 31, loaiSatName: 'Sắt Phi', soLuong: '2' },
        { id: 32, loaiSatName: 'Sắt Hộp', soLuong: '2' },
      ],
    },
    {
      id: 4, maNhaMay: 'JSE-55', tenManh: 'Chân ghế', children: [
        { id: 41, loaiSatName: 'Sắt Vuông', soLuong: '4' },
        { id: 42, loaiSatName: 'Sắt Phi', soLuong: '2' },
      ],
    },
  ],
}

// ─── SteelSearch ──────────────────────────────────────────────────────
function SteelSearch({ selectedName, onChange, catalog }: {
  selectedName: string
  onChange: (item: SteelItem) => void
  catalog: SteelItem[]
}) {
  const [search, setSearch] = useState('')
  const [focused, setFocused] = useState(false)

  const selected = catalog.find(s => s.name === selectedName) ?? null
  const filtered = catalog.filter(s => s.name.toLowerCase().includes(search.toLowerCase()))
  const displayValue = selected ? selected.name : search

  return (
    <div style={{ position: 'relative', flex: 1 }}>
      <input
        value={displayValue}
        placeholder="Tìm tên sắt…"
        onFocus={() => { setFocused(true); setSearch('') }}
        onBlur={() => setFocused(false)}
        onChange={e => { setSearch(e.target.value); onChange({ name: '', specs: '' }) }}
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
          {filtered.length === 0 && (
            <div style={{ padding: '10px 14px', color: 'var(--text3)', fontSize: 13 }}>Không tìm thấy.</div>
          )}
          {filtered.map((s, i) => {
            const isSel = s.name === selectedName
            return (
              <div key={`${s.name}-${i}`}
                onMouseDown={e => e.preventDefault()}
                onClick={() => { onChange(s); setSearch(''); setFocused(false) }}
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
function VatTuSearch({ value, onSelect }: {
  value: string
  onSelect: (preset: { name: string; unit: string } | null) => void
}) {
  const [search, setSearch] = useState('')
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = search.trim() === ''
    ? VAT_TU_PRESETS
    : VAT_TU_PRESETS.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{ position: 'relative', flex: 2, minWidth: 200 }}>
      <input
        ref={inputRef}
        value={focused ? search : value}
        placeholder="Chọn tên vật tư…"
        onFocus={() => { setFocused(true); setSearch('') }}
        onBlur={() => setTimeout(() => { setFocused(false); setSearch('') }, 150)}
        onChange={e => setSearch(e.target.value)}
        style={{ ...inputStyle, paddingRight: value && !focused ? 28 : 10 }}
      />
      {value && !focused && (
        <button
          onMouseDown={e => e.preventDefault()}
          onClick={() => {
            onSelect(null)
            setSearch('')
            setFocused(true)
            inputRef.current?.focus()
          }}
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
          {filtered.length === 0 && (
            <div style={{ padding: '10px 14px', color: 'var(--text3)', fontSize: 13 }}>Không tìm thấy.</div>
          )}
          {filtered.map(p => (
            <div key={p.name}
              onMouseDown={e => e.preventDefault()}
              onClick={() => { onSelect(p); setFocused(false); setSearch('') }}
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
export default function SpecSteelPage() {
  const [subTab, setSubTab] = useState<'dinh-muc' | 'vat-tu' | 'catalog'>('dinh-muc')
  const [catalog, setCatalog] = useState<SteelItem[]>(STEEL_CATALOG)

  // ── Định mức ──────────────────────────────────────────────────────────
  const [selectedBom, setSelectedBom] = useState<BomItem | null>(null)
  const [manhs, setManhs] = useState<Manh[]>([])
  const [nextId, setNextId] = useState(1)
  const [submittedBomIds, setSubmittedBomIds] = useState<number[]>([])
  const [showManhForm, setShowManhForm] = useState(false)
  const [formTenManh, setFormTenManh] = useState('')
  const [addingTo, setAddingTo] = useState<number | null>(null)
  const [childSatName, setChildSatName] = useState('')
  const [childSoLuong, setChildSoLuong] = useState('')

  // ── Vật tư ────────────────────────────────────────────────────────────
  const [vtCode, setVtCode] = useState('')
  const [vtName, setVtName] = useState('')
  const [vtUnit, setVtUnit] = useState('cây')
  const [vtSpecs, setVtSpecs] = useState('')
  const [vtDoDay, setVtDoDay] = useState('')
  const [vtErr, setVtErr] = useState('')
  const [draftLines, setDraftLines] = useState<DraftLine[]>(MOCK_DRAFT)
  const [draftUid, setDraftUid] = useState(4)
  const [pendingReqs, setPendingReqs] = useState<PendingReq[]>(MOCK_PENDING)
  const [reqUid, setReqUid] = useState(2)
  const [rejectedLines, setRejectedLines] = useState<RejectedLine[]>(MOCK_REJECTED)
  const [sentMsg, setSentMsg] = useState(false)

  // ── BOM helpers ───────────────────────────────────────────────────────
  const openBom = (item: BomItem) => {
    const preset = MOCK_MANHS[item.id] ?? []
    const maxId = preset.flatMap(m => [m.id, ...m.children.map(c => c.id)]).reduce((a, b) => Math.max(a, b), 0)
    setSelectedBom(item); setManhs(preset); setNextId(maxId + 1)
    setShowManhForm(false); setFormTenManh('')
    setAddingTo(null); setChildSatName(''); setChildSoLuong('')
  }

  const addManh = () => {
    if (!formTenManh.trim() || !selectedBom) return
    setManhs(m => [...m, { id: nextId, maNhaMay: selectedBom.maNhaMay, tenManh: formTenManh.trim(), children: [] }])
    setNextId(n => n + 1)
    setShowManhForm(false); setFormTenManh('')
  }

  const addChild = (manhId: number) => {
    if (!childSatName) return
    setManhs(ms => ms.map(m =>
      m.id === manhId
        ? { ...m, children: [...m.children, { id: nextId, loaiSatName: childSatName, soLuong: childSoLuong }] }
        : m
    ))
    setNextId(n => n + 1)
    setChildSatName(''); setChildSoLuong('')
  }

  const deleteChild = (manhId: number, childId: number) =>
    setManhs(ms => ms.map(m => m.id === manhId ? { ...m, children: m.children.filter(c => c.id !== childId) } : m))

  const deleteManh = (manhId: number) => {
    setManhs(ms => ms.filter(m => m.id !== manhId))
    if (addingTo === manhId) setAddingTo(null)
  }

  // ── Vật tư helpers ────────────────────────────────────────────────────
  const addToDraft = () => {
    setVtErr('')
    if (!vtName.trim()) { setVtErr('Vui lòng nhập Tên vật tư.'); return }
    setDraftLines(p => [...p, { uid: draftUid, name: vtName.trim(), unit: vtUnit, specs: vtSpecs.trim(), doDay: vtDoDay.trim() }])
    setDraftUid(n => n + 1)
    setVtName(''); setVtSpecs(''); setVtDoDay('')
  }

  const submitAll = () => {
    if (!draftLines.length) return
    setPendingReqs(p => [...p, { uid: reqUid, lines: [...draftLines], submittedAt: new Date().toLocaleString('vi-VN') }])
    setReqUid(n => n + 1); setDraftLines([])
    setSentMsg(true); setTimeout(() => setSentMsg(false), 3000)
  }

  const totalChildren = manhs.reduce((s, m) => s + m.children.length, 0)
  const isSubmitted = !!selectedBom && submittedBomIds.includes(selectedBom.id)

  // ─── Render ────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Quản lý định mức — Sắt</h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text3)' }}>Nhập định mức mảnh sắt theo SKU và đề xuất vật tư mới</p>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
        {([
          { id: 'dinh-muc', label: 'Định mức mảnh' },
          { id: 'vat-tu', label: 'Định mức chi tiết' },
          { id: 'catalog', label: 'Catalog vật tư' },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)} style={{
            padding: '8px 18px', border: 'none', cursor: 'pointer', background: 'transparent',
            fontWeight: subTab === t.id ? 700 : 400,
            color: subTab === t.id ? '#1565c0' : 'var(--text2)',
            borderBottom: subTab === t.id ? '2px solid #1565c0' : '2px solid transparent',
            marginBottom: -1, fontSize: 14,
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══ ĐỊNH MỨC: LIST ══ */}
      {subTab === 'dinh-muc' && !selectedBom && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontSize: 13, color: 'var(--text3)' }}>{MOCK_BOMS.length} SKU</span>
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
                {MOCK_BOMS.map(item => (
                  <tr key={item.id}
                    onClick={() => openBom(item)}
                    style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background .1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: 'var(--text)', marginRight: 10 }}>{item.maNhaMay}</span>
                      <span style={{ color: 'var(--text2)', fontSize: 13 }}>{item.ten}</span>
                    </td>
                    <td style={{ padding: '12px 14px', color: 'var(--text2)' }}>{item.thoiGian}</td>
                    <td style={{ padding: '12px 14px' }}>
                      {submittedBomIds.includes(item.id)
                        ? <span style={{ background: '#fff3e0', color: '#e65100', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>⏳ Chờ duyệt</span>
                        : MOCK_MANHS[item.id]
                          ? <span style={{ background: '#e8f5e9', color: '#2e7d32', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>Đang nhập</span>
                          : <span style={{ background: '#ede7f6', color: '#4527a0', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>Chờ nhập</span>
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
              <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginRight: 6 }}>SKU</span>
              <span style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 15 }}>{selectedBom.maNhaMay}</span>
              <span style={{ margin: '0 8px', color: 'var(--text3)' }}>—</span>
              <span style={{ fontWeight: 600, fontSize: 15 }}>{selectedBom.ten}</span>
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
                  <div style={{ padding: '7px 12px', background: '#d6e8fb', border: '1px solid #90caf9', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 700, color: '#1565c0', fontFamily: 'monospace' }}>
                    {selectedBom.maNhaMay}
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <FL>Tên mảnh <span style={{ color: '#e53935' }}>*</span></FL>
                  <input autoFocus placeholder="Mảnh tựa, Mảnh tay…" value={formTenManh}
                    onChange={e => setFormTenManh(e.target.value)}
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
                  <button onClick={() => { setShowManhForm(false); setFormTenManh('') }} style={{
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
                  <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: '#1565c0', background: '#e3f2fd', borderRadius: 4, padding: '2px 7px' }}>
                    {m.maNhaMay}
                  </span>
                  <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{m.tenManh}</span>
                  <span style={{ fontSize: 12, color: 'var(--text3)' }}>{m.children.length} loại sắt</span>
                  {!isSubmitted && (
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => addingTo === m.id ? setAddingTo(null) : (setAddingTo(m.id), setChildSatName(''), setChildSoLuong(''))}
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
                        <th style={{ width: 120, padding: '7px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--text2)', fontSize: 11 }}>Số lượng</th>
                        {!isSubmitted && <th style={{ width: 44 }}></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {m.children.map((c, i) => {
                        const cat = catalog.find(s => s.name === c.loaiSatName)
                        return (
                          <tr key={c.id} style={{ borderTop: '1px solid var(--border)' }}>
                            <td style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 12, padding: '9px 7px' }}>{i + 1}</td>
                            <td style={{ padding: '9px 14px', color: 'var(--text)', fontWeight: 500 }}>{c.loaiSatName}</td>
                            <td style={{ padding: '9px 14px', color: 'var(--text3)', fontSize: 12 }}>{cat?.specs || '—'}</td>
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
                    display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap',
                    padding: '12px 16px',
                    borderTop: m.children.length > 0 ? '1px dashed var(--border)' : 'none',
                  }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <FL>Loại sắt</FL>
                      <SteelSearch selectedName={childSatName} catalog={catalog}
                        onChange={item => setChildSatName(item.name)} />
                    </div>
                    <div style={{ minWidth: 120 }}>
                      <FL>Số lượng</FL>
                      <input placeholder="1332" value={childSoLuong}
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
              border: `1px solid ${isSubmitted ? '#ffe082' : 'var(--border)'}`,
              borderRadius: 'var(--radius-lg)',
            }}>
              {isSubmitted ? (
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
                      setSelectedBom(null)
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

      {/* ══ VẬT TƯ ══ */}
      {subTab === 'vat-tu' && (
        <div>
          {/* Input form */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '18px 20px', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14, color: 'var(--text)' }}>Thêm vật tư vào danh sách</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: 2, minWidth: 200 }}>
                <FL>Tên <span style={{ color: '#e53935' }}>*</span></FL>
                <VatTuSearch
                  value={vtName}
                  onSelect={p => {
                    if (p) { setVtName(p.name); setVtUnit(p.unit) }
                    else { setVtName(''); setVtUnit('cây') }
                    setVtErr('')
                  }}
                />
              </div>
              <div style={{ minWidth: 100 }}>
                <FL>Đơn vị</FL>
                <select value={vtUnit} onChange={e => setVtUnit(e.target.value)}
                  style={{ ...inputStyle, background: 'var(--surface)' }}>
                  {UNIT_OPTIONS.map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <FL>Quy cách</FL>
                <input value={vtSpecs} onChange={e => setVtSpecs(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addToDraft()}
                  placeholder="50×50×660" style={inputStyle} />
              </div>
              <div style={{ minWidth: 110 }}>
                <FL>Độ dày</FL>
                <input value={vtDoDay} onChange={e => setVtDoDay(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addToDraft()}
                  placeholder="0.8mm" style={inputStyle} />
              </div>
              <button onClick={addToDraft} style={{
                padding: '7px 16px', border: 'none', borderRadius: 'var(--radius)',
                background: '#1565c0', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
              }}>+ Thêm vào danh sách</button>
            </div>
            {vtErr && (
              <div style={{ marginTop: 10, padding: '8px 12px', background: '#ffebee', color: '#c62828', borderRadius: 'var(--radius)', fontSize: 13 }}>{vtErr}</div>
            )}
          </div>

          {/* Draft list */}
          {draftLines.length > 0 && (
            <div style={{ background: 'var(--surface)', border: '1px solid #c5cae9', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#e8eaf6', borderBottom: '1px solid #c5cae9' }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#1a237e' }}>
                  Danh sách chờ gửi
                  <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 600, background: '#c5cae9', color: '#1a237e', borderRadius: 20, padding: '2px 8px' }}>
                    {draftLines.length} vật tư
                  </span>
                </div>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                    {['#', 'Tên vật tư', 'ĐV', 'Quy cách', 'Độ dày', ''].map((h, i) => (
                      <th key={i} style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text2)', fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {draftLines.map((d, i) => (
                    <tr key={d.uid} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 14px', color: 'var(--text3)', fontSize: 12 }}>{i + 1}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 500, color: 'var(--text)' }}>{d.name}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--text2)' }}>{d.unit}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--text3)' }}>{d.specs || '—'}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--text3)' }}>{d.doDay || '—'}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        <button onClick={() => setDraftLines(p => p.filter(x => x.uid !== d.uid))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 2 }}>
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
                >Gửi đề xuất ({draftLines.length} vật tư) →</button>
              </div>
            </div>
          )}

          {sentMsg && (
            <div style={{ padding: '10px 16px', background: '#e8f5e9', color: '#2e7d32', borderRadius: 'var(--radius)', fontWeight: 600, fontSize: 13, marginBottom: 16 }}>
              ✓ Đã gửi đề xuất thành công — đang chờ duyệt.
            </div>
          )}

          {/* Pending list */}
          {pendingReqs.length > 0 && (
            <div style={{ background: 'var(--surface)', border: '1px solid #ffe082', borderLeft: '4px solid #f57c00', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', background: '#fff8e1', borderBottom: '1px solid #ffe082', fontWeight: 700, fontSize: 14, color: '#e65100' }}>
                Đang chờ duyệt
                <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 600, background: '#ffe082', color: '#e65100', borderRadius: 20, padding: '2px 8px' }}>
                  {pendingReqs.reduce((s, r) => s + r.lines.length, 0)} vật tư
                </span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                    {['Tên vật tư', 'ĐV', 'Quy cách', 'Độ dày', 'Gửi lúc', 'Trạng thái'].map((h, i) => (
                      <th key={i} style={{ padding: '8px 14px', textAlign: i === 5 ? 'right' : 'left', fontWeight: 600, color: 'var(--text2)', fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pendingReqs.flatMap(req => req.lines.map(l => (
                    <tr key={`${req.uid}-${l.uid}`} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 500, color: 'var(--text)' }}>{l.name}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--text2)' }}>{l.unit}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--text3)' }}>{l.specs || '—'}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--text3)' }}>{l.doDay || '—'}</td>
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

          {pendingReqs.length === 0 && draftLines.length === 0 && (
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
                      {['Tên vật tư', 'ĐV', 'Quy cách', 'Độ dày', 'Gửi lúc', 'Trạng thái'].map((h, i) => (
                        <th key={i} style={{ padding: '8px 14px', textAlign: i === 5 ? 'right' : 'left', fontWeight: 600, color: '#b71c1c', fontSize: 11 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rejectedLines.map(l => (
                      <tr key={l.uid} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 500, color: 'var(--text2)' }}>{l.name}</td>
                        <td style={{ padding: '10px 14px', color: 'var(--text2)' }}>{l.unit}</td>
                        <td style={{ padding: '10px 14px', color: 'var(--text3)' }}>{l.specs || '—'}</td>
                        <td style={{ padding: '10px 14px', color: 'var(--text3)' }}>{l.doDay || '—'}</td>
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

          {/* ── Đã duyệt / Catalog ── */}
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#2e7d32', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ background: '#e8f5e9', color: '#2e7d32', borderRadius: 20, padding: '2px 10px', fontSize: 12 }}>✓ Đã duyệt</span>
              <span style={{ color: 'var(--text3)', fontWeight: 400, fontSize: 12 }}>{catalog.length} loại</span>
            </div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                    {['Tên vật tư', 'Quy cách', 'Độ dày', 'Trạng thái'].map((h, i) => (
                      <th key={i} style={{ padding: '8px 14px', textAlign: i === 3 ? 'right' : 'left', fontWeight: 600, color: 'var(--text2)', fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {catalog.map((s, i) => (
                    <tr key={i} style={{ borderBottom: i < catalog.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 500 }}>{s.name}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--text3)' }}>{s.specs}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--text3)' }}>{s.doDay || '—'}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        <span style={{ background: '#e8f5e9', color: '#2e7d32', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>✓ Đã duyệt</span>
                      </td>
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
