import { useState } from 'react'
import { format } from 'date-fns'
import { ChevronLeft, ChevronRight, X, Eye } from 'lucide-react'
import NotifBell from '../../../components/NotifBell'
import MaterialPicker, { type PickedMaterial } from '../../../components/MaterialPicker'
import { useFetch } from '../../../hooks/useFetch'
import { useMaterialGroupIds } from '../../../hooks/useMaterialGroupIds'
import * as api from '../../../services/api'
import { useAuth } from '../../../context/AuthContext'
import { useAuditLog, type AuditAction } from '../../../context/AuditLogContext'
import { SKU_ENTITY, isPartsApproved } from '../../../constants/skuStatus'
import type { Sku, DaySonItem, QuotaEntryMeta, QuotaReviewStatus } from '../../../types/sku'

// ─── Types ────────────────────────────────────────────────────────────
// MaterialLine = alias tên trường trung lập (uid/soLuong) cho dễ đọc trong JSX — quy đổi sang/từ
// DaySonItem thật khi đọc/ghi Sku (xem toMaterialLine/toItem). Dùng chung cho cả 3 nhóm:
// "Định mức mảnh — Dây" (manhData.day), "Định mức mảnh — Đinh" (manhData.dinh) và "Định mức chi
// tiết — Sơn" (quotaManagement.materialType.daySon). Việc 2: mỗi dòng gắn với 1 Material thật qua
// materialId (chọn từ MaterialPicker), không còn gõ mã tự do — tên hiển thị = tên Material.
type BomItem = { id: number; ten: string; thoiGian: string }
type MaterialLine = { uid: number; materialId: number; code: string; unit: string; soLuong?: string }
type BomStatus = 'approved' | 'pending' | 'rejected' | 'canInput'

const toMaterialLine = (it: DaySonItem, uid: number): MaterialLine => ({
  uid, materialId: Number(it.materialId) || 0, code: it.name, unit: it.unit ?? '', soLuong: it.kg != null ? String(it.kg) : '',
})
const toItem = (l: Omit<MaterialLine, 'uid'>): DaySonItem => ({
  name: l.code, materialId: String(l.materialId), unit: l.unit || undefined,
  kg: (l.soLuong ?? '').trim() !== '' ? Number(l.soLuong) : undefined,
})

// ─── Main ─────────────────────────────────────────────────────────────
export default function SpecWirePaintPage({ subTab, onSubTabChange }: {
  subTab: 'dinh-muc-day' | 'dinh-muc-dinh' | 'vat-tu' | 'catalog'
  onSubTabChange: (t: 'dinh-muc-day' | 'dinh-muc-dinh' | 'vat-tu' | 'catalog') => void
}) {
  const { data: skusData, refetch: refetchSkus } = useFetch<Sku[]>(() => api.getSkus(), [])
  const skus = (skusData ?? []).filter(pf => pf.status !== 'DRAFT')
  const findPf = (id: number) => skus.find(pf => pf.id === id)

  // Dây/Đinh/Sơn đều thuộc nhóm vật tư hệ thống riêng (resolve theo systemKey, không theo
  // tên hiển thị — xem useMaterialGroupIds.ts và skus.service.ts bên BE).
  const { wire: dayGroupId, nail: dinhGroupId, paint: paintGroupId } = useMaterialGroupIds()

  const toBom = (pf: Sku): BomItem => ({
    id: pf.id,
    ten: `${pf.mfgProduct?.factoryCode ?? ''} — ${pf.mfgProduct?.name ?? ''}`.replace(/^— | —$/g, ''),
    thoiGian: format(new Date(pf.createdAt), 'dd/MM/yyyy'),
  })
  // Mảnh (Dây, Đinh) là bước nhập đầu tiên nên hiện cho mọi SKU chưa DRAFT; chi tiết (Sơn) chỉ hiện
  // SKU đã qua giai đoạn mảnh (KHSX đã duyệt & gửi bộ phận chi tiết) — đúng thứ tự flow hiện tại.
  const manhBoms: BomItem[] = skus.map(toBom)
  const detailBoms: BomItem[] = skus.filter(pf => isPartsApproved(pf.status)).map(toBom)

  // ── Định mức mảnh — Dây/Đinh (manhData.day|dinh, manhEntryMeta, manhReviewStatus) ────────────
  // Trạng thái phải suy theo riêng từng nhóm (manhReviewStatus.<key> / manhData.<key>), KHÔNG được
  // suy từ pf.status chung — pf.status chỉ đổi 1 lần khi 1 trong các nhóm mảnh (Sắt/Dây/Đinh) nộp
  // trước, nên nếu dùng chung sẽ khóa luôn nhóm còn lại (vd Sắt nộp trước thì Dây/Đinh bị coi như
  // "đang chờ duyệt" dù chưa nhập gì).
  const dayItemsOf = (pf?: Sku) => pf?.manhData?.day ?? []
  const dayEntryMetaOf = (pf?: Sku) => pf?.manhEntryMeta?.day
  const dayReviewOf = (pf?: Sku) => pf?.manhReviewStatus?.day

  const dinhItemsOf = (pf?: Sku) => pf?.manhData?.dinh ?? []
  const dinhEntryMetaOf = (pf?: Sku) => pf?.manhEntryMeta?.dinh
  const dinhReviewOf = (pf?: Sku) => pf?.manhReviewStatus?.dinh

  // SKU cũ đã qua hẳn giai đoạn mảnh nhưng chưa có quyết định riêng cho nhóm này — coi như đã duyệt.
  const makeManhBomStatus = (itemsOf: (pf?: Sku) => DaySonItem[], reviewOf: (pf?: Sku) => QuotaReviewStatus | undefined) =>
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
  const detailItemsOf = (pf?: Sku) => pf?.quotaManagement?.materialType?.daySon ?? []
  const detailReviewOf = (pf?: Sku) => pf?.quotaManagement?.reviewStatus?.daySon
  const detailEntryMetaOf = (pf?: Sku) => pf?.quotaManagement?.entryMeta?.daySon
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
        pickerGroupId={dayGroupId}
        boms={manhBoms}
        itemsOf={id => dayItemsOf(findPf(id))}
        entryMetaOf={id => dayEntryMetaOf(findPf(id))}
        reviewOf={id => dayReviewOf(findPf(id))}
        bomStatus={dayBomStatus}
        onSubmit={(bomId, items, enteredBy) => api.updateSkuManhQuota(bomId, 'day', items, enteredBy)}
        submitLogAction="sku.manh_submitted"
        submitLogLabel="Mảnh dây"
        refetchSkus={refetchSkus}
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
        pickerGroupId={dinhGroupId}
        boms={manhBoms}
        itemsOf={id => dinhItemsOf(findPf(id))}
        entryMetaOf={id => dinhEntryMetaOf(findPf(id))}
        reviewOf={id => dinhReviewOf(findPf(id))}
        bomStatus={dinhBomStatus}
        onSubmit={(bomId, items, enteredBy) => api.updateSkuManhQuota(bomId, 'dinh', items, enteredBy)}
        submitLogAction="sku.manh_submitted"
        submitLogLabel="Mảnh đinh"
        refetchSkus={refetchSkus}
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
        pickerGroupId={paintGroupId}
        boms={detailBoms}
        itemsOf={id => detailItemsOf(findPf(id))}
        entryMetaOf={id => detailEntryMetaOf(findPf(id))}
        reviewOf={id => detailReviewOf(findPf(id))}
        bomStatus={detailBomStatus}
        onSubmit={(bomId, items, enteredBy) => api.updateSkuDetailQuota(bomId, 'daySon', items, enteredBy)}
        submitLogAction="sku.detail_submitted"
        submitLogLabel="Sơn"
        refetchSkus={refetchSkus}
      />
    )
  }

  /* ══ DANH SÁCH VẬT TƯ (Material thật, quản lý ở Admin > Vật tư) ══ */
  return (
    <WireCatalogTab
      skus={skus}
      dayGroupId={dayGroupId}
      dinhGroupId={dinhGroupId}
      paintGroupId={paintGroupId}
    />
  )
}

// ─── WireGroupPanel ───────────────────────────────────────────────────
// Dùng chung cho cả 3 nhóm ("Định mức mảnh — Dây", "Định mức mảnh — Đinh", "Định mức chi tiết —
// Sơn"): cùng 1 form nhập (vật tư, số lượng) + danh sách BOM theo trạng thái — chỉ khác nơi
// đọc/ghi dữ liệu + nhãn + loại/nhóm vật tư lọc trong picker (truyền qua props). Tự quản lý state
// riêng, mount/unmount theo subTab nên không lẫn dữ liệu giữa các nhóm.

function WireGroupPanel({
  pageTitle, pageDesc, notifSubtitle, codeLabel, qtyLabel, pickerGroupId, boms, itemsOf, entryMetaOf, reviewOf, bomStatus,
  onSubmit, submitLogAction, submitLogLabel, refetchSkus,
}: {
  pageTitle: string
  pageDesc: string
  notifSubtitle: string
  codeLabel: string
  qtyLabel: string
  pickerGroupId: number | undefined
  boms: BomItem[]
  itemsOf: (bomId: number) => DaySonItem[]
  entryMetaOf: (bomId: number) => QuotaEntryMeta | undefined
  reviewOf?: (bomId: number) => QuotaReviewStatus | undefined
  bomStatus: (bomId: number) => BomStatus
  onSubmit: (bomId: number, items: DaySonItem[], enteredBy: string) => Promise<Sku>
  submitLogAction: AuditAction
  submitLogLabel: string
  refetchSkus: () => Promise<unknown> | void
}) {
  const { user } = useAuth()
  const { logAction } = useAuditLog()

  const [selectedBom, setSelectedBom] = useState<BomItem | null>(null)
  const [rows, setRows] = useState<MaterialLine[]>([])
  const [nextUid, setNextUid] = useState(1)
  const [fMaterial, setFMaterial] = useState<PickedMaterial | null>(null)
  const [fSoLuong, setFSoLuong] = useState('')
  const [fErr, setFErr] = useState('')
  const [sentMsg, setSentMsg] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [bomSearch, setBomSearch] = useState('')

  const openBom = (bom: BomItem) => {
    setSelectedBom(bom)
    const existing = itemsOf(bom.id)
    setRows(existing.map((it, i) => toMaterialLine(it, i + 1)))
    setNextUid(existing.length + 1)
    setFMaterial(null); setFSoLuong('')
    setFErr(''); setSentMsg(false)
  }

  const addToDraft = () => {
    setFErr('')
    if (!fMaterial) { setFErr(`Vui lòng chọn ${codeLabel}.`); return }
    setRows(r => [...r, { uid: nextUid, materialId: fMaterial.id, code: `${fMaterial.code} — ${fMaterial.name}`, unit: fMaterial.unit, soLuong: fSoLuong.trim() }])
    setNextUid(n => n + 1)
    setFMaterial(null); setFSoLuong('')
  }

  const removeDraft = (uid: number) => setRows(r => r.filter(x => x.uid !== uid))

  const submitAll = async () => {
    if (!rows.length || !selectedBom) return
    setSubmitting(true)
    try {
      const items = rows.map(r => toItem(r))
      await onSubmit(selectedBom.id, items, user?.name ?? 'Không rõ')
      logAction(SKU_ENTITY, String(selectedBom.id), submitLogAction, `${submitLogLabel} (${items.length} vật tư)`)
      await refetchSkus()
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
            <div style={{ flex: 1, minWidth: 200 }}>
              <FL>{codeLabel} <span style={{ color: '#e53935' }}>*</span></FL>
              <MaterialPicker value={fMaterial} onSelect={m => { setFMaterial(m); setFErr('') }} materialGroupId={pickerGroupId} placeholder={`Chọn ${codeLabel.toLowerCase()}…`} />
            </div>
            <div style={{ width: 120 }}>
              <FL>{qtyLabel}</FL>
              <input type="number" min={0} value={fSoLuong} onChange={e => setFSoLuong(e.target.value)}
                placeholder="VD: 120" style={inputStyle} />
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
                  {['SKU', codeLabel, qtyLabel, ...(st === 'pending' ? [] : [''])].map((h, i) => (
                    <th key={i} style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text2)', fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(d => (
                  <tr key={d.uid} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 600, fontSize: 13, color: 'var(--text2)' }}>{selectedBom?.ten}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 500, color: 'var(--text)' }}>{d.code}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--text)' }}>{d.soLuong || '—'}{d.unit ? ` ${d.unit}` : ''}</td>
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

// ─── WireCatalogTab (Material thật, quản lý ở Admin > Vật tư) ────────

function WireCatalogTab({ skus, dayGroupId, dinhGroupId, paintGroupId }: {
  skus: Sku[]
  dayGroupId: number | undefined
  dinhGroupId: number | undefined
  paintGroupId: number | undefined
}) {
  const { data: materialsData } = useFetch(() => api.getMaterials(), [])
  const materials = materialsData ?? []
  const wireMaterials = materials.filter(m => dayGroupId != null && m.materialGroupId === dayGroupId)
  const nailMaterials = materials.filter(m => dinhGroupId != null && m.materialGroupId === dinhGroupId)
  const paintMaterials = materials.filter(m => paintGroupId != null && m.materialGroupId === paintGroupId)
  const [catalogSearch, setCatalogSearch] = useState('')

  // Từ chối ở cả 3 nguồn (mảnh dây, mảnh đinh, chi tiết Sơn) — cùng shape DaySonItem nên gộp chung 1 bảng.
  const rejectedGroups = skus.flatMap(pf => {
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

  const allCatalog = [...wireMaterials, ...nailMaterials, ...paintMaterials].filter(m => {
    const q = catalogSearch.toLowerCase()
    return m.code.toLowerCase().includes(q) || m.name.toLowerCase().includes(q)
  })

  return (
    <>
      <div>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Danh sách vật tư — Dây, Đinh & Sơn</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text3)' }}>Vật tư thật (Admin &gt; Vật tư) đã gán đúng loại/nhóm — dùng để chọn khi nhập định mức</p>
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
                    {['SKU', 'Vật tư', 'Số lượng', 'Lý do từ chối'].map((h, i) => (
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
            placeholder="Tìm theo mã hoặc tên vật tư…"
            style={{ maxWidth: 320, padding: '7px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text)', outline: 'none' }}
          />
        </div>
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                {['Mã', 'Tên vật tư', 'ĐVT'].map((h, i) => (
                  <th key={i} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text2)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allCatalog.map((item, i, arr) => (
                <tr key={item.id} style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text)' }}>{item.code}</td>
                  <td style={{ padding: '12px 14px', color: 'var(--text3)' }}>{item.name}</td>
                  <td style={{ padding: '12px 14px', color: 'var(--text2)' }}>{item.unit || '—'}</td>
                </tr>
              ))}
              {allCatalog.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>
                    {catalogSearch ? 'Không tìm thấy kết quả.' : 'Chưa có vật tư nào — thêm ở Admin > Vật tư.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
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
