import { useState } from 'react'
import { format } from 'date-fns'
import { ChevronLeft, ChevronRight, X, Eye } from 'lucide-react'
import NotifBell from '../../../components/NotifBell'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { useAuth } from '../../../context/AuthContext'
import { useAuditLog } from '../../../context/AuditLogContext'
import { PLANFORM_ENTITY } from '../../../constants/planFormStatus'
import type { PlanForm, DaySonItem } from '../../../types/plan-form'

// ─── Types ────────────────────────────────────────────────────────────
// Alias tên trường theo domain (maDay/kg) cho dễ đọc trong JSX — quy đổi
// sang/từ DaySonItem thật khi đọc/ghi PlanForm.quotaManagement (xem toWireLine/toItem).
type BomItem = { id: number; ten: string; thoiGian: string }
type WireLine = { uid: number; maDay: string; unit: string; soLuong?: string; specifications: string; imageUrl: string }

const GROUP = 'daySon' as const

const toWireLine = (it: DaySonItem, uid: number): WireLine => ({
  uid, maDay: it.name, unit: it.unit ?? '', soLuong: it.kg != null ? String(it.kg) : '', specifications: it.specifications ?? '', imageUrl: it.imageUrl ?? '',
})
const toItem = (l: Omit<WireLine, 'uid'>): DaySonItem => ({
  name: l.maDay, unit: l.unit || undefined, specifications: l.specifications || undefined,
  kg: (l.soLuong ?? '').trim() !== '' ? Number(l.soLuong) : undefined, imageUrl: l.imageUrl || undefined,
})

// ─── Main ─────────────────────────────────────────────────────────────
export default function SpecWirePaintPage({ subTab, onSubTabChange }: {
  subTab: 'dinh-muc' | 'catalog'
  onSubTabChange: (t: 'dinh-muc' | 'catalog') => void
}) {
  const { user } = useAuth()
  const { logAction } = useAuditLog()
  const { data: planFormsData, refetch: refetchPlanForms } = useFetch<PlanForm[]>(() => api.getPlanForms(), [])
  const planForms = (planFormsData ?? []).filter(pf => pf.status !== 'DRAFT')

  const boms: BomItem[] = planForms.map(pf => ({
    id: pf.id,
    ten: `${pf.mfgProduct?.factoryCode ?? ''} — ${pf.mfgProduct?.name ?? ''}`.replace(/^— | —$/g, ''),
    thoiGian: format(new Date(pf.createdAt), 'dd/MM/yyyy'),
  }))
  const findPf = (id: number) => planForms.find(pf => pf.id === id)
  const itemsOf = (pf?: PlanForm) => pf?.quotaManagement?.materialType?.[GROUP] ?? []
  const reviewOf = (pf?: PlanForm) => pf?.quotaManagement?.reviewStatus?.[GROUP]
  const entryMetaOf = (pf?: PlanForm) => pf?.quotaManagement?.entryMeta?.[GROUP]

  const bomStatus = (bomId: number): 'approved' | 'pending' | 'rejected' | 'canInput' => {
    const pf = findPf(bomId)
    const review = reviewOf(pf)
    if (review?.status === 'APPROVED') return 'approved'
    if (review?.status === 'REJECTED') return 'rejected'
    return itemsOf(pf).length > 0 ? 'pending' : 'canInput'
  }

  // Danh mục mã dây/sơn đã từng nhập trên mọi SKU thật — dùng gợi ý autocomplete + tab "Danh sách vật tư".
  const APPROVED_CATALOG: WireLine[] = (() => {
    const seen = new Map<string, WireLine>()
    let uid = 1
    for (const pf of planForms) {
      for (const it of itemsOf(pf)) {
        const key = it.name.trim().toLowerCase()
        if (!key || seen.has(key)) continue
        seen.set(key, toWireLine(it, uid++))
      }
    }
    return Array.from(seen.values())
  })()

  const [selectedBom, setSelectedBom] = useState<BomItem | null>(null)
  const [rows, setRows] = useState<WireLine[]>([])
  const [nextUid, setNextUid] = useState(1)
  const [fMaDay, setFMaDay] = useState('')
  const [fUnit, setFUnit] = useState('')
  const [fSoLuong, setFSoLuong] = useState('')
  const [fSpecifications, setFSpecifications] = useState('')
  const [fImageUrl, setFImageUrl] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [catalogPreviewUrl, setCatalogPreviewUrl] = useState<string | null>(null)
  const [fErr, setFErr] = useState('')
  const [sentMsg, setSentMsg] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [bomSearch, setBomSearch] = useState('')
  const [catalogSearch, setCatalogSearch] = useState('')

  const openBom = (bom: BomItem) => {
    setSelectedBom(bom)
    const existing = itemsOf(findPf(bom.id))
    setRows(existing.map((it, i) => toWireLine(it, i + 1)))
    setNextUid(existing.length + 1)
    setFMaDay(''); setFUnit(''); setFSoLuong(''); setFSpecifications(''); setFImageUrl('')
    setShowPreview(false); setFErr(''); setSentMsg(false)
  }

  const addToDraft = () => {
    setFErr('')
    if (!fMaDay.trim()) { setFErr('Vui lòng nhập Mã dây.'); return }
    setRows(r => [...r, { uid: nextUid, maDay: fMaDay.trim(), unit: fUnit.trim(), soLuong: fSoLuong.trim(), specifications: fSpecifications.trim(), imageUrl: fImageUrl.trim() }])
    setNextUid(n => n + 1)
    setFMaDay(''); setFUnit(''); setFSoLuong(''); setFSpecifications(''); setFImageUrl('')
  }

  const removeDraft = (uid: number) => setRows(r => r.filter(x => x.uid !== uid))

  const submitAll = async () => {
    if (!rows.length || !selectedBom) return
    setSubmitting(true)
    try {
      const items = rows.map(r => toItem(r))
      await api.updatePlanFormDetailQuota(selectedBom.id, GROUP, items, user?.name ?? 'Không rõ')
      logAction(PLANFORM_ENTITY, String(selectedBom.id), 'planform.detail_submitted', `Dây / Sơn (${items.length} vật tư)`)
      await refetchPlanForms()
      setSentMsg(true); setTimeout(() => setSentMsg(false), 3000)
    } finally {
      setSubmitting(false)
    }
  }

  /* ══ ĐỊNH MỨC CHI TIẾT: DETAIL ══ */
  if (subTab === 'dinh-muc' && selectedBom) {
    const pf = findPf(selectedBom.id)
    const st = bomStatus(selectedBom.id)
    const review = reviewOf(pf)
    const meta = entryMetaOf(pf)
    return (
      <div>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Quản lý định mức — Dây & Sơn</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text3)' }}>Nhập thông tin dây và sơn theo SKU</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button onClick={() => setSelectedBom(null)} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: 13, color: 'var(--text2)',
          }}>
            <ChevronLeft size={14} /> Quay lại
          </button>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{selectedBom.ten}</span>
        </div>

        {meta && (
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>
            Đã nhập bởi <strong>{meta.enteredBy}</strong> lúc {new Date(meta.enteredAt).toLocaleString('vi-VN')}
          </div>
        )}

        {st === 'approved' && (
          <div style={{ padding: '10px 16px', background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 'var(--radius-lg)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 16 }}>✓</span>
            <span style={{ fontWeight: 600, color: '#2e7d32', fontSize: 13 }}>Đã duyệt lần trước</span>
            <span style={{ fontSize: 12, color: '#388e3c' }}>— có thể gửi thêm đề xuất bổ sung nếu còn thiếu</span>
          </div>
        )}

        {st === 'pending' && (
          <div style={{ padding: '10px 16px', background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 'var(--radius-lg)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 16 }}>⏳</span>
            <span style={{ fontWeight: 600, color: '#f57c00', fontSize: 13 }}>Đang chờ duyệt</span>
            <span style={{ fontSize: 12, color: '#ef6c00' }}>— không thể nhập thêm vật tư cho SKU này cho đến khi được duyệt</span>
          </div>
        )}

        {st === 'rejected' && (
          <div style={{ padding: '10px 16px', background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 'var(--radius-lg)', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#dc2626' }}>⚠ KHSX đã từ chối — vui lòng chỉnh sửa và gửi lại</div>
            {review?.reason && <div style={{ fontSize: 12, color: '#dc2626', fontStyle: 'italic', marginTop: 2 }}>{review.reason}</div>}
          </div>
        )}

        {/* Form thêm — khoá khi đang chờ duyệt */}
        {st !== 'pending' && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '18px 20px', marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14, color: 'var(--text)' }}>
            {st === 'approved' || st === 'rejected' ? 'Gửi đề xuất bổ sung' : 'Thêm vật tư vào danh sách'}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ minWidth: 120 }}>
              <FL>SKU</FL>
              <div style={{ padding: '7px 12px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                {selectedBom.ten}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 130 }}>
              <FL>Mã dây <span style={{ color: '#e53935' }}>*</span></FL>
              <MaDaySearch
                value={fMaDay}
                catalog={APPROVED_CATALOG}
                onSelect={item => {
                  if (item) {
                    setFMaDay(item.maDay)
                    setFUnit(item.unit)
                    setFSpecifications(item.specifications)
                  } else {
                    setFMaDay(''); setFUnit(''); setFSpecifications('')
                    setFSoLuong('')
                  }
                  setFErr('')
                }}
              />
            </div>
            <div style={{ width: 68 }}>
              <FL>ĐVT</FL>
              <input value={fUnit} onChange={e => setFUnit(e.target.value)}
                placeholder="kg" style={inputStyle} />
            </div>
            <div style={{ width: 100 }}>
              <FL>Khối lượng (kg)</FL>
              <input type="number" min={0} value={fSoLuong} onChange={e => setFSoLuong(e.target.value)}
                placeholder="VD: 120" style={inputStyle} />
            </div>
            <div style={{ flex: 2, minWidth: 180 }}>
              <FL>Mô tả</FL>
              <input value={fSpecifications} onChange={e => setFSpecifications(e.target.value)}
                placeholder="VD: Dây PE xám + sơn tĩnh điện" style={inputStyle} />
            </div>
            <div style={{ flex: 1, minWidth: 160 }}>
              <FL>Image URL</FL>
              <div style={{ display: 'flex', gap: 6, position: 'relative' }}>
                <input value={fImageUrl} onChange={e => { setFImageUrl(e.target.value); setShowPreview(false) }}
                  placeholder="https://..." style={{ ...inputStyle, flex: 1 }} />
                {fImageUrl.trim() && (
                  <button onClick={() => setShowPreview(v => !v)} title="Xem ảnh" style={{
                    padding: '0 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                    background: showPreview ? 'var(--surface2)' : 'var(--surface)',
                    cursor: 'pointer', color: showPreview ? '#1565c0' : 'var(--text3)',
                    display: 'flex', alignItems: 'center', flexShrink: 0,
                  }}>
                    <Eye size={15} />
                  </button>
                )}
                {showPreview && fImageUrl.trim() && (
                  <ImageModal url={fImageUrl.trim()} onClose={() => setShowPreview(false)} />
                )}
              </div>
            </div>
            <button onClick={addToDraft} style={{
              padding: '7px 16px', border: 'none', borderRadius: 'var(--radius)',
              background: '#1565c0', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
            }}>+ Thêm</button>
          </div>
          {fErr && (
            <div style={{ marginTop: 10, padding: '8px 12px', background: '#ffebee', color: '#c62828', borderRadius: 'var(--radius)', fontSize: 13 }}>{fErr}</div>
          )}
        </div>
        )}

        {/* Draft/current list */}
        {rows.length > 0 && (
          <div style={{ background: 'var(--surface)', border: st === 'pending' ? '1px solid #ffe082' : '1px solid #c5cae9', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ padding: '12px 16px', background: st === 'pending' ? '#fff8e1' : '#e8eaf6', borderBottom: st === 'pending' ? '1px solid #ffe082' : '1px solid #c5cae9', fontWeight: 700, fontSize: 14, color: st === 'pending' ? '#e65100' : '#1a237e' }}>
              {st === 'pending' ? 'Đang chờ duyệt' : 'Danh sách chờ gửi'}
              <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 600, background: st === 'pending' ? '#ffe082' : '#c5cae9', color: st === 'pending' ? '#e65100' : '#1a237e', borderRadius: 20, padding: '2px 8px' }}>
                {rows.length} vật tư
              </span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                  {['SKU', 'Mã dây', 'ĐVT', 'Khối lượng (kg)', 'Mô tả', ...(st === 'pending' ? [] : [''])].map((h, i) => (
                    <th key={i} style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text2)', fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(d => (
                  <tr key={d.uid} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 600, fontSize: 13, color: 'var(--text2)' }}>{selectedBom?.ten}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 500, color: 'var(--text)' }}>{d.maDay}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--text2)' }}>{d.unit || '—'}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--text)' }}>{d.soLuong || '—'}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--text3)' }}>{d.specifications || '—'}</td>
                    {st !== 'pending' && (
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        <button onClick={() => removeDraft(d.uid)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 2 }}>
                          <X size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {st !== 'pending' && (
              <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border)' }}>
                <button onClick={submitAll} disabled={submitting} style={{
                  padding: '8px 24px', border: 'none', borderRadius: 'var(--radius)',
                  background: '#1565c0', color: '#fff', fontWeight: 700, fontSize: 14, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1,
                }}>{submitting ? 'Đang gửi...' : `Gửi đề xuất (${rows.length} vật tư) →`}</button>
              </div>
            )}
          </div>
        )}

        {sentMsg && (
          <div style={{ padding: '10px 16px', background: '#e8f5e9', color: '#2e7d32', borderRadius: 'var(--radius)', fontWeight: 600, fontSize: 13, marginBottom: 16 }}>
            ✓ Đã gửi đề xuất thành công — đang chờ duyệt.
          </div>
        )}

        {rows.length === 0 && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '40px', textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>
            Chưa có đề xuất nào. Điền form phía trên để bắt đầu.
          </div>
        )}
      </div>
    )
  }

  /* ══ ĐỊNH MỨC CHI TIẾT: LIST ══ */
  if (subTab === 'dinh-muc') {
    return (
      <div>
        <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Quản lý định mức — Dây & Sơn</h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text3)' }}>Nhập thông tin dây và sơn theo SKU</p>
          </div>
          <NotifBell
            items={boms.filter(b => bomStatus(b.id) === 'approved').map(n => ({ id: n.id, title: n.ten, subtitle: `Đã duyệt định mức dây & sơn · ${n.thoiGian}` }))}
            emptyText="Chưa có định mức nào được duyệt."
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <input
            value={bomSearch}
            onChange={e => setBomSearch(e.target.value)}
            placeholder="Tìm theo tên SKU…"
            style={{ maxWidth: 280, padding: '7px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text)', outline: 'none' }}
          />
        </div>
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                {['SKU', 'Thời gian', 'Trạng thái', ''].map((h, i) => (
                  <th key={i} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text2)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {boms.filter(b => b.ten.toLowerCase().includes(bomSearch.toLowerCase()) && bomStatus(b.id) !== 'approved').map(item => {
                const st = bomStatus(item.id)
                return (
                  <tr key={item.id}
                    onClick={() => openBom(item)}
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
    )
  }

  /* ══ DANH SÁCH VẬT TƯ ══ */
  const rejectedGroups = planForms
    .filter(pf => reviewOf(pf)?.status === 'REJECTED')
    .map(pf => ({
      ten: `${pf.mfgProduct?.factoryCode ?? ''} — ${pf.mfgProduct?.name ?? ''}`.replace(/^— | —$/g, ''),
      items: itemsOf(pf),
      reason: reviewOf(pf)?.reason,
    }))

  return (
    <>
      <div>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Danh sách vật tư — Dây & Sơn</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text3)' }}>Các mã dây & sơn đã từng nhập, dùng làm gợi ý khi thêm mới</p>
        </div>

        {rejectedGroups.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#c62828', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ background: '#ffebee', color: '#c62828', borderRadius: 20, padding: '2px 10px', fontSize: 12 }}>✕ Từ chối</span>
              <span style={{ color: 'var(--text3)', fontWeight: 400, fontSize: 12 }}>{rejectedGroups.length} SKU</span>
            </div>
            <div style={{ background: 'var(--surface)', border: '1px solid #ffcdd2', borderLeft: '4px solid #c62828', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#ffebee', borderBottom: '1px solid #ffcdd2' }}>
                    {['SKU', 'Mã dây', 'Khối lượng (kg)', 'Mô tả', 'Lý do từ chối'].map((h, i) => (
                      <th key={i} style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 600, color: '#b71c1c', fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rejectedGroups.flatMap((g, gi) => g.items.map((it, i) => (
                    <tr key={`${gi}-${i}`} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text2)' }}>{g.ten}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 500, color: 'var(--text)' }}>{it.name}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--text)' }}>{it.kg ?? '—'}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--text3)' }}>{it.specifications || '—'}</td>
                      <td style={{ padding: '10px 14px', color: '#c62828', fontSize: 13 }}>{g.reason || '—'}</td>
                    </tr>
                  )))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <input
            value={catalogSearch}
            onChange={e => setCatalogSearch(e.target.value)}
            placeholder="Tìm theo mã dây hoặc mô tả…"
            style={{ maxWidth: 320, padding: '7px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text)', outline: 'none' }}
          />
        </div>
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                {['Mã dây', 'Mô tả', 'ĐVT', 'Image URL'].map((h, i) => (
                  <th key={i} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text2)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {APPROVED_CATALOG.filter(c => {
                const q = catalogSearch.toLowerCase()
                return c.maDay.toLowerCase().includes(q) || c.specifications.toLowerCase().includes(q)
              }).map((item, i, arr) => (
                <tr key={item.uid} style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text)' }}>{item.maDay}</td>
                  <td style={{ padding: '12px 14px', color: 'var(--text3)' }}>{item.specifications || '—'}</td>
                  <td style={{ padding: '12px 14px', color: 'var(--text2)' }}>{item.unit || '—'}</td>
                  <td style={{ padding: '12px 14px' }}>
                    {item.imageUrl ? (
                      <button onClick={() => setCatalogPreviewUrl(item.imageUrl)} title="Xem ảnh" style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text3)', display: 'flex', alignItems: 'center', padding: 2,
                      }}>
                        <Eye size={15} />
                      </button>
                    ) : <span style={{ color: 'var(--text3)' }}>—</span>}
                  </td>
                </tr>
              ))}
              {APPROVED_CATALOG.filter(c => {
                const q = catalogSearch.toLowerCase()
                return c.maDay.toLowerCase().includes(q) || c.specifications.toLowerCase().includes(q)
              }).length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>
                    {catalogSearch ? 'Không tìm thấy kết quả.' : 'Chưa có vật tư nào được nhập.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {catalogPreviewUrl && (
        <ImageModal url={catalogPreviewUrl} onClose={() => setCatalogPreviewUrl(null)} />
      )}
    </>
  )
}

function MaDaySearch({ value, onSelect, catalog }: {
  value: string
  onSelect: (item: WireLine | null) => void
  catalog: WireLine[]
}) {
  const [search, setSearch] = useState('')
  const [focused, setFocused] = useState(false)

  const filtered = search.trim() === ''
    ? catalog
    : catalog.filter(c =>
        c.maDay.toLowerCase().includes(search.toLowerCase()) ||
        c.specifications.toLowerCase().includes(search.toLowerCase())
      )

  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 130 }}>
      <input
        value={focused ? search : value}
        placeholder="Chọn hoặc nhập mã dây…"
        onFocus={() => { setFocused(true); setSearch('') }}
        onBlur={() => setTimeout(() => { setFocused(false); setSearch('') }, 150)}
        onChange={e => { setSearch(e.target.value); onSelect(null) }}
        style={{ ...inputStyle, paddingRight: value && !focused ? 28 : 10 }}
      />
      {value && !focused && (
        <button
          onMouseDown={e => e.preventDefault()}
          onClick={() => onSelect(null)}
          style={{
            position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text3)', display: 'flex', alignItems: 'center', padding: 2,
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
          {filtered.length === 0 ? (
            <div style={{ padding: '10px 14px', color: 'var(--text3)', fontSize: 13 }}>
              Không tìm thấy — mã dây phải được cấu hình sẵn trong danh sách
            </div>
          ) : filtered.map(c => (
            <div key={c.uid}
              onMouseDown={e => e.preventDefault()}
              onClick={() => { onSelect(c); setFocused(false); setSearch('') }}
              style={{
                padding: '9px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)',
                background: c.maDay === value ? 'var(--surface2)' : 'transparent',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
              onMouseLeave={e => (e.currentTarget.style.background = c.maDay === value ? 'var(--surface2)' : 'transparent')}
            >
              <div style={{ fontSize: 13, fontWeight: c.maDay === value ? 700 : 500, color: 'var(--text)' }}>{c.maDay}</div>
              {c.specifications && (
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{c.specifications}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ImageModal({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'zoom-out',
      }}
    >
      <img
        src={url}
        alt="preview"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '60vw', maxHeight: '70vh',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
          objectFit: 'contain',
          cursor: 'default',
        }}
      />
    </div>
  )
}

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
