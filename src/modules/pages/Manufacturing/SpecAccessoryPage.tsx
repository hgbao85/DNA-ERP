import { useState } from 'react'
import { format } from 'date-fns'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import NotifBell from '../../../components/NotifBell'
import MaterialPicker, { type PickedMaterial } from '../../../components/MaterialPicker'
import { useFetch } from '../../../hooks/useFetch'
import { useMaterialGroupIds } from '../../../hooks/useMaterialGroupIds'
import * as api from '../../../services/api'
import { useAuth } from '../../../context/AuthContext'
import { useAuditLog } from '../../../context/AuditLogContext'
import { SKU_ENTITY, isPartsApproved } from '../../../constants/skuStatus'
import type { Sku, VatTuPhuKienItem } from '../../../types/sku'

// ─── Types ────────────────────────────────────────────────────────────
// Alias tên trường theo domain (maPK/soLuong) cho dễ đọc trong JSX — quy đổi sang/từ
// VatTuPhuKienItem thật khi đọc/ghi Sku.quotaManagement (xem toAccessoryLine/toItem).
// Việc 2: mỗi dòng gắn với 1 Material thật (nhóm vật tư Phụ kiện) qua materialId, chọn từ
// MaterialPicker — không còn gõ mã/mô tả tự do.
type BomItem = { id: number; ten: string; thoiGian: string }
type AccessoryLine = { uid: number; materialId: number; maPK: string; unit: string; soLuong?: string }

const GROUP = 'vatTuPhuKien' as const

const toAccessoryLine = (it: VatTuPhuKienItem, uid: number): AccessoryLine => ({
  uid, materialId: Number(it.materialId) || 0, maPK: it.name, unit: it.unit ?? '', soLuong: it.quantity != null ? String(it.quantity) : '',
})
const toItem = (l: Omit<AccessoryLine, 'uid'>): VatTuPhuKienItem => ({
  name: l.maPK, materialId: String(l.materialId), unit: l.unit || undefined,
  quantity: (l.soLuong ?? '').trim() !== '' ? Number(l.soLuong) : undefined,
})

// ─── Main ─────────────────────────────────────────────────────────────
// Chỉ còn luồng "Định mức mới" — tab "Danh sách vật tư" đã gộp sang SpecAccessoryCatalogPage.
export default function SpecAccessoryPage() {
  const { user } = useAuth()
  const { logAction } = useAuditLog()
  const { data: skusData, refetch: refetchSkus } = useFetch<Sku[]>(() => api.getSkus(), [])
  const skus = (skusData ?? []).filter(pf => pf.status !== 'DRAFT')
  const { accessory: accessoryGroupId } = useMaterialGroupIds()

  // Chỉ hiện SKU đã qua giai đoạn định mức mảnh (KHSX đã duyệt & gửi bộ phận chi tiết) — đúng
  // thứ tự flow hiện tại (mảnh trước, chi tiết sau).
  const boms: BomItem[] = skus
    .filter(pf => isPartsApproved(pf.status))
    .map(pf => ({
      id: pf.id,
      ten: `${pf.mfgProduct?.factoryCode ?? ''} — ${pf.mfgProduct?.name ?? ''}`.replace(/^— | —$/g, ''),
      thoiGian: format(new Date(pf.createdAt), 'dd/MM/yyyy'),
    }))
  const findPf = (id: number) => skus.find(pf => pf.id === id)
  const itemsOf = (pf?: Sku) => pf?.quotaManagement?.materialType?.[GROUP] ?? []
  const reviewOf = (pf?: Sku) => pf?.quotaManagement?.reviewStatus?.[GROUP]
  const entryMetaOf = (pf?: Sku) => pf?.quotaManagement?.entryMeta?.[GROUP]

  const bomStatus = (bomId: number): 'approved' | 'pending' | 'rejected' | 'canInput' => {
    const pf = findPf(bomId)
    const review = reviewOf(pf)
    if (review?.status === 'APPROVED') return 'approved'
    if (review?.status === 'REJECTED') return 'rejected'
    return itemsOf(pf).length > 0 ? 'pending' : 'canInput'
  }

  const [selectedBom, setSelectedBom] = useState<BomItem | null>(null)
  const [rows, setRows] = useState<AccessoryLine[]>([])
  const [nextUid, setNextUid] = useState(1)
  const [fMaterial, setFMaterial] = useState<PickedMaterial | null>(null)
  const [fSoLuong, setFSoLuong] = useState('')
  const [fErr, setFErr] = useState('')
  const [sentMsg, setSentMsg] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [bomSearch, setBomSearch] = useState('')

  const openBom = (bom: BomItem) => {
    setSelectedBom(bom)
    const existing = itemsOf(findPf(bom.id))
    setRows(existing.map((it, i) => toAccessoryLine(it, i + 1)))
    setNextUid(existing.length + 1)
    setFMaterial(null); setFSoLuong('')
    setFErr(''); setSentMsg(false)
  }

  const addToDraft = () => {
    setFErr('')
    if (!fMaterial) { setFErr('Vui lòng chọn Mã phụ kiện.'); return }
    setRows(r => [...r, { uid: nextUid, materialId: fMaterial.id, maPK: `${fMaterial.code} — ${fMaterial.name}`, unit: fMaterial.unit, soLuong: fSoLuong.trim() }])
    setNextUid(n => n + 1)
    setFMaterial(null); setFSoLuong('')
  }

  const removeDraft = (uid: number) => setRows(r => r.filter(x => x.uid !== uid))

  const submitAll = async () => {
    if (!rows.length || !selectedBom) return
    setSubmitting(true)
    try {
      const items = rows.map(r => toItem(r))
      await api.updateSkuDetailQuota(selectedBom.id, GROUP, items, user?.name ?? 'Không rõ')
      logAction(SKU_ENTITY, String(selectedBom.id), 'sku.detail_submitted', `Vật tư phụ kiện (${items.length} vật tư)`)
      await refetchSkus()
      setSentMsg(true); setTimeout(() => setSentMsg(false), 3000)
    } finally {
      setSubmitting(false)
    }
  }

  /* ══ ĐỊNH MỨC CHI TIẾT: DETAIL ══ */
  if (selectedBom) {
    const pf = findPf(selectedBom.id)
    const st = bomStatus(selectedBom.id)
    const review = reviewOf(pf)
    const meta = entryMetaOf(pf)
    return (
      <div>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Quản lý định mức — Phụ kiện</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text3)' }}>Nhập thông tin phụ kiện theo SKU</p>
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
            <div style={{ flex: 1, minWidth: 220 }}>
              <FL>Mã phụ kiện <span style={{ color: '#e53935' }}>*</span></FL>
              <MaterialPicker value={fMaterial} onSelect={m => { setFMaterial(m); setFErr('') }} materialGroupId={accessoryGroupId} placeholder="Chọn phụ kiện…" />
            </div>
            <div style={{ width: 90 }}>
              <FL>Số lượng</FL>
              <input type="number" min={0} value={fSoLuong} onChange={e => setFSoLuong(e.target.value)}
                placeholder="VD: 500" style={inputStyle} />
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
                  {['SKU', 'Mã phụ kiện', 'Số lượng', ...(st === 'pending' ? [] : [''])].map((h, i) => (
                    <th key={i} style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text2)', fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(d => (
                  <tr key={d.uid} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 600, fontSize: 13, color: 'var(--text2)' }}>{selectedBom?.ten}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 500, color: 'var(--text)' }}>{d.maPK}</td>
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

  /* ══ ĐỊNH MỨC CHI TIẾT: LIST ══ */
  return (
    <div>
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Quản lý định mức — Phụ kiện</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text3)' }}>Nhập thông tin phụ kiện theo SKU</p>
        </div>
        <NotifBell
          items={boms.filter(b => bomStatus(b.id) === 'approved').map(n => ({ id: n.id, title: n.ten, subtitle: `Đã duyệt định mức phụ kiện · ${n.thoiGian}` }))}
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
