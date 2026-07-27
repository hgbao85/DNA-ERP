import { useState } from 'react'
import { format } from 'date-fns'
import { ChevronLeft, ChevronRight, X, Eye } from 'lucide-react'
import NotifBell from '../../../components/NotifBell'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { useAuth } from '../../../context/AuthContext'
import { useAuditLog, type AuditAction } from '../../../context/AuditLogContext'
import { PLANFORM_ENTITY, isPartsApproved } from '../../../constants/planFormStatus'
import type { PlanForm, DaySonItem, QuotaEntryMeta, QuotaReviewStatus } from '../../../types/plan-form'

// ─── Types ────────────────────────────────────────────────────────────
// MaterialLine = alias tên trường trung lập (code/soLuong) cho dễ đọc trong JSX — quy đổi sang/từ
// DaySonItem thật khi đọc/ghi PlanForm (xem toMaterialLine/toItem). Dùng chung cho cả 3 nhóm:
// "Định mức mảnh — Dây" (manhData.day), "Định mức mảnh — Đinh" (manhData.dinh) và "Định mức chi
// tiết — Sơn" (quotaManagement.materialType.daySon), vì cả 3 cùng shape dữ liệu (DaySonItem), chỉ
// khác nơi lưu/API ghi + đơn vị số lượng (kg cho Dây/Sơn, cây cho Đinh).
type BomItem = { id: number; ten: string; thoiGian: string }
type MaterialLine = { uid: number; code: string; unit: string; soLuong?: string; specifications: string; imageUrl: string }
type BomStatus = 'approved' | 'pending' | 'rejected' | 'canInput'

const toMaterialLine = (it: DaySonItem, uid: number): MaterialLine => ({
  uid, code: it.name, unit: it.unit ?? '', soLuong: it.kg != null ? String(it.kg) : '', specifications: it.specifications ?? '', imageUrl: it.imageUrl ?? '',
})
const toItem = (l: Omit<MaterialLine, 'uid'>): DaySonItem => ({
  name: l.code, unit: l.unit || undefined, specifications: l.specifications || undefined,
  kg: (l.soLuong ?? '').trim() !== '' ? Number(l.soLuong) : undefined, imageUrl: l.imageUrl || undefined,
})

// ─── Main ─────────────────────────────────────────────────────────────
export default function SpecWirePaintPage({ subTab, onSubTabChange }: {
  subTab: 'dinh-muc-day' | 'dinh-muc-dinh' | 'vat-tu' | 'catalog'
  onSubTabChange: (t: 'dinh-muc-day' | 'dinh-muc-dinh' | 'vat-tu' | 'catalog') => void
}) {
  const { data: planFormsData, refetch: refetchPlanForms } = useFetch<PlanForm[]>(() => api.getPlanForms(), [])
  const planForms = (planFormsData ?? []).filter(pf => pf.status !== 'DRAFT')
  const findPf = (id: number) => planForms.find(pf => pf.id === id)

  const toBom = (pf: PlanForm): BomItem => ({
    id: pf.id,
    ten: `${pf.mfgProduct?.factoryCode ?? ''} — ${pf.mfgProduct?.name ?? ''}`.replace(/^— | —$/g, ''),
    thoiGian: format(new Date(pf.createdAt), 'dd/MM/yyyy'),
  })
  // Mảnh (Dây, Đinh) là bước nhập đầu tiên nên hiện cho mọi SKU chưa DRAFT; chi tiết (Sơn) chỉ hiện
  // SKU đã qua giai đoạn mảnh (KHSX đã duyệt & gửi bộ phận chi tiết) — đúng thứ tự flow hiện tại.
  const manhBoms: BomItem[] = planForms.map(toBom)
  const detailBoms: BomItem[] = planForms.filter(pf => isPartsApproved(pf.status)).map(toBom)

  // Danh mục mã đã từng nhập, tách riêng theo từng nhóm (Dây/Đinh/Sơn) để gợi ý autocomplete không
  // lẫn mã của nhóm khác (vd gõ mã đinh không bị gợi ý nhầm mã dây). Catalog gộp cả 3 chỉ dùng cho
  // tab "Danh sách vật tư" (xem toàn bộ để tra cứu, không dùng để chọn khi nhập).
  const buildCatalog = (getItems: (pf: PlanForm) => DaySonItem[]): MaterialLine[] => {
    const seen = new Map<string, MaterialLine>()
    let uid = 1
    for (const pf of planForms) {
      for (const it of getItems(pf)) {
        const key = it.name.trim().toLowerCase()
        if (!key || seen.has(key)) continue
        seen.set(key, toMaterialLine(it, uid++))
      }
    }
    return Array.from(seen.values())
  }
  const dayCatalog = buildCatalog(pf => pf.manhData?.day ?? [])
  const dinhCatalog = buildCatalog(pf => pf.manhData?.dinh ?? [])
  const sonCatalog = buildCatalog(pf => pf.quotaManagement?.materialType?.daySon ?? [])
  const allCatalog = buildCatalog(pf => [...(pf.manhData?.day ?? []), ...(pf.manhData?.dinh ?? []), ...(pf.quotaManagement?.materialType?.daySon ?? [])])

  // ── Định mức mảnh — Dây/Đinh (manhData.day|dinh, manhEntryMeta, manhReviewStatus) ────────────
  // Trạng thái phải suy theo riêng từng nhóm (manhReviewStatus.<key> / manhData.<key>), KHÔNG được
  // suy từ pf.status chung — pf.status chỉ đổi 1 lần khi 1 trong các nhóm mảnh (Sắt/Dây/Đinh) nộp
  // trước, nên nếu dùng chung sẽ khóa luôn nhóm còn lại (vd Sắt nộp trước thì Dây/Đinh bị coi như
  // "đang chờ duyệt" dù chưa nhập gì).
  const dayItemsOf = (pf?: PlanForm) => pf?.manhData?.day ?? []
  const dayEntryMetaOf = (pf?: PlanForm) => pf?.manhEntryMeta?.day
  const dayReviewOf = (pf?: PlanForm) => pf?.manhReviewStatus?.day

  const dinhItemsOf = (pf?: PlanForm) => pf?.manhData?.dinh ?? []
  const dinhEntryMetaOf = (pf?: PlanForm) => pf?.manhEntryMeta?.dinh
  const dinhReviewOf = (pf?: PlanForm) => pf?.manhReviewStatus?.dinh

  // SKU cũ đã qua hẳn giai đoạn mảnh nhưng chưa có quyết định riêng cho nhóm này — coi như đã duyệt.
  const makeManhBomStatus = (itemsOf: (pf?: PlanForm) => DaySonItem[], reviewOf: (pf?: PlanForm) => QuotaReviewStatus | undefined) =>
    (bomId: number): BomStatus => {
      const pf = findPf(bomId)
      const review = reviewOf(pf)
      if (review?.status === 'APPROVED') return 'approved'
      if (review?.status === 'REJECTED') return 'rejected'
      if (pf && isPartsApproved(pf.status)) return 'approved'
      return itemsOf(pf).length > 0 ? 'pending' : 'canInput'
    }
  const dayBomStatus = makeManhBomStatus(dayItemsOf, dayReviewOf)
  const dinhBomStatus = makeManhBomStatus(dinhItemsOf, dinhReviewOf)

  // ── Định mức chi tiết — Sơn (quotaManagement.materialType.daySon) ─────────────────────────
  const detailItemsOf = (pf?: PlanForm) => pf?.quotaManagement?.materialType?.daySon ?? []
  const detailReviewOf = (pf?: PlanForm) => pf?.quotaManagement?.reviewStatus?.daySon
  const detailEntryMetaOf = (pf?: PlanForm) => pf?.quotaManagement?.entryMeta?.daySon
  const detailBomStatus = (bomId: number): BomStatus => {
    const pf = findPf(bomId)
    const review = detailReviewOf(pf)
    if (review?.status === 'APPROVED') return 'approved'
    if (review?.status === 'REJECTED') return 'rejected'
    return detailItemsOf(pf).length > 0 ? 'pending' : 'canInput'
  }

  if (subTab === 'dinh-muc-day') {
    return (
      <WireGroupPanel
        key="day"
        pageTitle="Quản lý định mức — Mảnh dây"
        pageDesc="Nhập định mức mảnh dây theo SKU (bước nhập đầu tiên, trước định mức chi tiết)"
        notifSubtitle="Đã duyệt định mức mảnh dây"
        codeLabel="Mã dây"
        qtyLabel="Khối lượng (kg)"
        boms={manhBoms}
        itemsOf={id => dayItemsOf(findPf(id))}
        entryMetaOf={id => dayEntryMetaOf(findPf(id))}
        reviewOf={id => dayReviewOf(findPf(id))}
        bomStatus={dayBomStatus}
        catalog={dayCatalog}
        onSubmit={(bomId, items, enteredBy) => api.updatePlanFormManhQuota(bomId, 'day', items, enteredBy)}
        submitLogAction="planform.manh_submitted"
        submitLogLabel="Mảnh dây"
        refetchPlanForms={refetchPlanForms}
      />
    )
  }

  if (subTab === 'dinh-muc-dinh') {
    return (
      <WireGroupPanel
        key="dinh"
        pageTitle="Quản lý định mức — Mảnh đinh"
        pageDesc="Nhập định mức mảnh đinh theo SKU (bước nhập đầu tiên, trước định mức chi tiết)"
        notifSubtitle="Đã duyệt định mức mảnh đinh"
        codeLabel="Mã đinh"
        qtyLabel="Số lượng (cây)"
        boms={manhBoms}
        itemsOf={id => dinhItemsOf(findPf(id))}
        entryMetaOf={id => dinhEntryMetaOf(findPf(id))}
        reviewOf={id => dinhReviewOf(findPf(id))}
        bomStatus={dinhBomStatus}
        catalog={dinhCatalog}
        onSubmit={(bomId, items, enteredBy) => api.updatePlanFormManhQuota(bomId, 'dinh', items, enteredBy)}
        submitLogAction="planform.manh_submitted"
        submitLogLabel="Mảnh đinh"
        refetchPlanForms={refetchPlanForms}
      />
    )
  }

  if (subTab === 'vat-tu') {
    return (
      <WireGroupPanel
        key="detail"
        pageTitle="Quản lý định mức — Sơn"
        pageDesc="Nhập thông tin sơn theo SKU"
        notifSubtitle="Đã duyệt định mức Sơn"
        codeLabel="Mã sơn"
        qtyLabel="Khối lượng (kg)"
        boms={detailBoms}
        itemsOf={id => detailItemsOf(findPf(id))}
        entryMetaOf={id => detailEntryMetaOf(findPf(id))}
        reviewOf={id => detailReviewOf(findPf(id))}
        bomStatus={detailBomStatus}
        catalog={sonCatalog}
        onSubmit={(bomId, items, enteredBy) => api.updatePlanFormDetailQuota(bomId, 'daySon', items, enteredBy)}
        submitLogAction="planform.detail_submitted"
        submitLogLabel="Sơn"
        refetchPlanForms={refetchPlanForms}
      />
    )
  }

  /* ══ DANH SÁCH VẬT TƯ ══ */
  return <WireCatalogTab planForms={planForms} catalog={allCatalog} />
}

// ─── WireGroupPanel ───────────────────────────────────────────────────
// Dùng chung cho cả 3 nhóm ("Định mức mảnh — Dây", "Định mức mảnh — Đinh", "Định mức chi tiết —
// Sơn"): cùng 1 form nhập (mã, số lượng, mô tả, ảnh) + danh sách BOM theo trạng thái — chỉ khác nơi
// đọc/ghi dữ liệu và nhãn mã/đơn vị (truyền qua props codeLabel/qtyLabel). Tự quản lý state riêng,
// mount/unmount theo subTab nên không lẫn dữ liệu giữa các nhóm.

function WireGroupPanel({
  pageTitle, pageDesc, notifSubtitle, codeLabel, qtyLabel, boms, itemsOf, entryMetaOf, reviewOf, bomStatus, catalog,
  onSubmit, submitLogAction, submitLogLabel, refetchPlanForms,
}: {
  pageTitle: string
  pageDesc: string
  notifSubtitle: string
  codeLabel: string
  qtyLabel: string
  boms: BomItem[]
  itemsOf: (bomId: number) => DaySonItem[]
  entryMetaOf: (bomId: number) => QuotaEntryMeta | undefined
  reviewOf?: (bomId: number) => QuotaReviewStatus | undefined
  bomStatus: (bomId: number) => BomStatus
  catalog: MaterialLine[]
  onSubmit: (bomId: number, items: DaySonItem[], enteredBy: string) => Promise<PlanForm>
  submitLogAction: AuditAction
  submitLogLabel: string
  refetchPlanForms: () => Promise<unknown> | void
}) {
  const { user } = useAuth()
  const { logAction } = useAuditLog()

  const [selectedBom, setSelectedBom] = useState<BomItem | null>(null)
  const [rows, setRows] = useState<MaterialLine[]>([])
  const [nextUid, setNextUid] = useState(1)
  const [fCode, setFCode] = useState('')
  const [fUnit, setFUnit] = useState('')
  const [fSoLuong, setFSoLuong] = useState('')
  const [fSpecifications, setFSpecifications] = useState('')
  const [fImageUrl, setFImageUrl] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [fErr, setFErr] = useState('')
  const [sentMsg, setSentMsg] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [bomSearch, setBomSearch] = useState('')

  const openBom = (bom: BomItem) => {
    setSelectedBom(bom)
    const existing = itemsOf(bom.id)
    setRows(existing.map((it, i) => toMaterialLine(it, i + 1)))
    setNextUid(existing.length + 1)
    setFCode(''); setFUnit(''); setFSoLuong(''); setFSpecifications(''); setFImageUrl('')
    setShowPreview(false); setFErr(''); setSentMsg(false)
  }

  const addToDraft = () => {
    setFErr('')
    if (!fCode.trim()) { setFErr(`Vui lòng nhập ${codeLabel}.`); return }
    setRows(r => [...r, { uid: nextUid, code: fCode.trim(), unit: fUnit.trim(), soLuong: fSoLuong.trim(), specifications: fSpecifications.trim(), imageUrl: fImageUrl.trim() }])
    setNextUid(n => n + 1)
    setFCode(''); setFUnit(''); setFSoLuong(''); setFSpecifications(''); setFImageUrl('')
  }

  const removeDraft = (uid: number) => setRows(r => r.filter(x => x.uid !== uid))

  const submitAll = async () => {
    if (!rows.length || !selectedBom) return
    setSubmitting(true)
    try {
      const items = rows.map(r => toItem(r))
      await onSubmit(selectedBom.id, items, user?.name ?? 'Không rõ')
      logAction(PLANFORM_ENTITY, String(selectedBom.id), submitLogAction, `${submitLogLabel} (${items.length} vật tư)`)
      await refetchPlanForms()
      setSentMsg(true); setTimeout(() => setSentMsg(false), 3000)
    } finally {
      setSubmitting(false)
    }
  }

  /* ══ DETAIL ══ */
  if (selectedBom) {
    const st = bomStatus(selectedBom.id)
    const review = reviewOf?.(selectedBom.id)
    const meta = entryMetaOf(selectedBom.id)
    return (
      <div>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{pageTitle}</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text3)' }}>{pageDesc}</p>
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
              <FL>{codeLabel} <span style={{ color: '#e53935' }}>*</span></FL>
              <MaterialCodeSearch
                value={fCode}
                codeLabel={codeLabel}
                catalog={catalog}
                onSelect={item => {
                  if (item) {
                    setFCode(item.code)
                    setFUnit(item.unit)
                    setFSpecifications(item.specifications)
                  } else {
                    setFCode(''); setFUnit(''); setFSpecifications('')
                    setFSoLuong('')
                  }
                  setFErr('')
                }}
              />
            </div>
            <div style={{ width: 120 }}>
              <FL>{qtyLabel}</FL>
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
                  {['SKU', codeLabel, qtyLabel, 'Mô tả', ...(st === 'pending' ? [] : [''])].map((h, i) => (
                    <th key={i} style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text2)', fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(d => (
                  <tr key={d.uid} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 600, fontSize: 13, color: 'var(--text2)' }}>{selectedBom?.ten}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 500, color: 'var(--text)' }}>{d.code}</td>
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

  /* ══ LIST ══ */
  return (
    <div>
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{pageTitle}</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text3)' }}>{pageDesc}</p>
        </div>
        <NotifBell
          items={boms.filter(b => bomStatus(b.id) === 'approved').map(n => ({ id: n.id, title: n.ten, subtitle: `${notifSubtitle} · ${n.thoiGian}` }))}
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

// ─── WireCatalogTab ───────────────────────────────────────────────────

function WireCatalogTab({ planForms, catalog }: { planForms: PlanForm[]; catalog: MaterialLine[] }) {
  const [catalogPreviewUrl, setCatalogPreviewUrl] = useState<string | null>(null)
  const [catalogSearch, setCatalogSearch] = useState('')

  // Từ chối ở cả 3 nguồn (mảnh dây, mảnh đinh, chi tiết Sơn) — cùng shape DaySonItem nên gộp chung 1 bảng.
  const rejectedGroups = planForms.flatMap(pf => {
    const groups: { ten: string; items: DaySonItem[]; reason?: string }[] = []
    const ten = `${pf.mfgProduct?.factoryCode ?? ''} — ${pf.mfgProduct?.name ?? ''}`.replace(/^— | —$/g, '')
    if (pf.manhReviewStatus?.day?.status === 'REJECTED') {
      groups.push({ ten, items: pf.manhData?.day ?? [], reason: pf.manhReviewStatus.day.reason })
    }
    if (pf.manhReviewStatus?.dinh?.status === 'REJECTED') {
      groups.push({ ten, items: pf.manhData?.dinh ?? [], reason: pf.manhReviewStatus.dinh.reason })
    }
    if (pf.quotaManagement?.reviewStatus?.daySon?.status === 'REJECTED') {
      groups.push({ ten, items: pf.quotaManagement.materialType?.daySon ?? [], reason: pf.quotaManagement.reviewStatus.daySon.reason })
    }
    return groups
  })

  return (
    <>
      <div>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Danh sách vật tư — Dây, Đinh & Sơn</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text3)' }}>Các mã dây, đinh & sơn đã từng nhập (mảnh dây/đinh + Sơn chi tiết), dùng để tra cứu</p>
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
                    {['SKU', 'Mã', 'Số lượng', 'Mô tả', 'Lý do từ chối'].map((h, i) => (
                      <th key={i} style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 600, color: '#b71c1c', fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rejectedGroups.flatMap((g, gi) => g.items.map((it, i) => (
                    <tr key={`${gi}-${i}`} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text2)' }}>{g.ten}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 500, color: 'var(--text)' }}>{it.name}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--text)' }}>{it.kg != null ? `${it.kg}${it.unit ? ` ${it.unit}` : ''}` : '—'}</td>
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
            placeholder="Tìm theo mã hoặc mô tả…"
            style={{ maxWidth: 320, padding: '7px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text)', outline: 'none' }}
          />
        </div>
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                {['Mã', 'Mô tả', 'ĐVT', 'Image URL'].map((h, i) => (
                  <th key={i} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text2)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {catalog.filter(c => {
                const q = catalogSearch.toLowerCase()
                return c.code.toLowerCase().includes(q) || c.specifications.toLowerCase().includes(q)
              }).map((item, i, arr) => (
                <tr key={item.uid} style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text)' }}>{item.code}</td>
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
              {catalog.filter(c => {
                const q = catalogSearch.toLowerCase()
                return c.code.toLowerCase().includes(q) || c.specifications.toLowerCase().includes(q)
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

function MaterialCodeSearch({ value, onSelect, catalog, codeLabel }: {
  value: string
  onSelect: (item: MaterialLine | null) => void
  catalog: MaterialLine[]
  codeLabel: string
}) {
  const [search, setSearch] = useState('')
  const [focused, setFocused] = useState(false)

  const filtered = search.trim() === ''
    ? catalog
    : catalog.filter(c =>
        c.code.toLowerCase().includes(search.toLowerCase()) ||
        c.specifications.toLowerCase().includes(search.toLowerCase())
      )

  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 130 }}>
      <input
        value={focused ? search : value}
        placeholder={`Chọn hoặc nhập ${codeLabel.toLowerCase()}…`}
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
              Không tìm thấy — {codeLabel.toLowerCase()} phải được cấu hình sẵn trong danh sách
            </div>
          ) : filtered.map(c => (
            <div key={c.uid}
              onMouseDown={e => e.preventDefault()}
              onClick={() => { onSelect(c); setFocused(false); setSearch('') }}
              style={{
                padding: '9px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)',
                background: c.code === value ? 'var(--surface2)' : 'transparent',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
              onMouseLeave={e => (e.currentTarget.style.background = c.code === value ? 'var(--surface2)' : 'transparent')}
            >
              <div style={{ fontSize: 13, fontWeight: c.code === value ? 700 : 500, color: 'var(--text)' }}>{c.code}</div>
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
