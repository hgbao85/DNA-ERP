import { useState } from 'react'
import { format } from 'date-fns'
import { ChevronRight, ChevronLeft, X } from 'lucide-react'
import NotifBell from '../../../components/NotifBell'
import MaterialPicker, { type PickedMaterial } from '../../../components/MaterialPicker'
import { useFetch } from '../../../hooks/useFetch'
import { useMaterialGroupIds } from '../../../hooks/useMaterialGroupIds'
import * as api from '../../../services/api'
import { useAuth } from '../../../context/AuthContext'
import { useAuditLog } from '../../../context/AuditLogContext'
import { SKU_ENTITY } from '../../../constants/skuStatus'
import SpecAccessoryCatalogPage from './SpecAccessoryCatalogPage'
import type { Sku } from '../../../types/sku'

// ─── Types ────────────────────────────────────────────────────────────
// "Định mức chi tiết" (Sơn/Phụ kiện/Bao bì) — 1 account nhập cả 3 nhóm trong 1 trang, gửi
// duyệt 1 lần (giống hệt cơ chế "định mức mảnh" ở SpecSteelPage.tsx, chỉ khác không có khái
// niệm mảnh — đây là danh sách phẳng thẳng theo SKU). Mỗi dòng gắn 1 Material thật qua
// materialId (chọn từ MaterialPicker theo nhóm đang chọn), số lượng quy đổi sang/từ
// DaySonItem (field `kg`) hoặc VatTuPhuKienItem/BaoBiDongGoiItem (field `quantity`) khi đọc/ghi.
type DetailLineGroup = 'daySon' | 'vatTuPhuKien' | 'baoBiDongGoi'
type DetailLine = { id: number; group: DetailLineGroup; materialId: number; name: string; specs: string; unit: string; soLuong: string }
type BomItem = { id: string; ten: string; thoiGian: string }

const GROUPS: DetailLineGroup[] = ['daySon', 'vatTuPhuKien', 'baoBiDongGoi']
const GROUP_LABELS: Record<DetailLineGroup, string> = { daySon: 'Sơn', vatTuPhuKien: 'Phụ kiện', baoBiDongGoi: 'Bao bì' }
const GROUP_CODE_LABELS: Record<DetailLineGroup, string> = { daySon: 'Mã sơn', vatTuPhuKien: 'Mã phụ kiện', baoBiDongGoi: 'Mã bao bì' }
const GROUP_QTY_LABELS: Record<DetailLineGroup, string> = { daySon: 'Khối lượng (kg)', vatTuPhuKien: 'Số lượng', baoBiDongGoi: 'Số lượng' }
// Cả 3 tab đều chọn vật tư từ chung 1 nhóm hệ thống "Vật tư khác" — lọc riêng từng tab qua
// Material.detailKind (gán ở Admin > Vật tư), không còn qua nhóm vật tư nữa (xem MaterialPicker.tsx).
const GROUP_DETAIL_KIND: Record<DetailLineGroup, 'PAINT' | 'ACCESSORY' | 'PACKAGING'> = {
  daySon: 'PAINT', vatTuPhuKien: 'ACCESSORY', baoBiDongGoi: 'PACKAGING',
}
const GROUP_BADGE_COLORS: Record<DetailLineGroup, { bg: string; fg: string }> = {
  daySon: { bg: '#eff6ff', fg: '#1d4ed8' },
  vatTuPhuKien: { bg: '#ede9fe', fg: '#6d28d9' },
  baoBiDongGoi: { bg: '#d1fae5', fg: '#065f46' },
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

// ─── Main ─────────────────────────────────────────────────────────────
export default function SpecDetailQuotaPage({ subTab, onSubTabChange }: {
  subTab: 'dinh-muc' | 'catalog'
  onSubTabChange: (t: 'dinh-muc' | 'catalog') => void
}) {
  const { user } = useAuth()
  const { logAction } = useAuditLog()
  const { data: skusData, refetch: refetchSkus } = useFetch<Sku[]>(() => api.getSkus(), [])
  // Mảnh và chi tiết là 2 nhánh độc lập (tiến song song, không bắt buộc theo thứ tự) - chuyên viên
  // chi tiết thấy SKU ngay khi KHSX tạo, không cần chờ mảnh xong. Cùng điều kiện với SpecSteelPage.tsx.
  const skus = (skusData ?? []).filter(pf => pf.status !== 'DRAFT')
  // Sơn/Phụ kiện/Bao bì đều chọn vật tư từ chung 1 nhóm hệ thống "Vật tư khác" (OTHER) - BE
  // phân biệt 3 tab qua ConsumableBom.stage / BomAccessoryItem.kind, không phải qua nhóm vật tư.
  const { other: otherGroupId } = useMaterialGroupIds()

  const findPf = (id: string) => skus.find(pf => pf.id === id)

  const boms: BomItem[] = skus.map(pf => ({
    id: pf.id,
    ten: `${pf.mfgProduct?.factoryCode ?? ''} — ${pf.mfgProduct?.name ?? ''}`.replace(/^— | —$/g, ''),
    thoiGian: format(new Date(pf.createdAt), 'dd/MM/yyyy'),
  }))
  // Định mức chi tiết giờ chỉ còn 1 quyết định duyệt duy nhất cho cả 3 nhóm (không còn tách
  // riêng Sơn/Phụ kiện/Bao bì như trước).
  const totalItemsOf = (pf?: Sku) => {
    const mt = pf?.quotaManagement?.materialType
    return (mt?.daySon.length ?? 0) + (mt?.vatTuPhuKien.length ?? 0) + (mt?.baoBiDongGoi.length ?? 0)
  }
  const bomStatus = (bomId: string): 'approved' | 'pending' | 'rejected' | 'canInput' => {
    const pf = findPf(bomId)
    const review = pf?.quotaManagement?.reviewStatus
    if (review?.status === 'APPROVED') return 'approved'
    if (review?.status === 'REJECTED') return 'rejected'
    return totalItemsOf(pf) > 0 ? 'pending' : 'canInput'
  }

  const [selectedBom, setSelectedBom] = useState<BomItem | null>(null)
  const [lines, setLines] = useState<DetailLine[]>([])
  const [nextId, setNextId] = useState(1)
  const [savingDetail, setSavingDetail] = useState(false)
  const [group, setGroup] = useState<DetailLineGroup>('daySon')
  const [material, setMaterial] = useState<PickedMaterial | null>(null)
  const [spec, setSpec] = useState('')
  const [unit, setUnit] = useState('')
  const [soLuong, setSoLuong] = useState('')
  const [bomSearch, setBomSearch] = useState('')

  const resetForm = () => {
    setGroup('daySon'); setMaterial(null); setSpec(''); setUnit(''); setSoLuong('')
  }

  const openBom = (item: BomItem) => {
    const pf = findPf(item.id)
    const mt = pf?.quotaManagement?.materialType
    let id = 1
    const existing: DetailLine[] = [
      ...(mt?.daySon ?? []).map((it): DetailLine => ({ id: id++, group: 'daySon', materialId: Number(it.materialId) || 0, name: it.name, specs: it.specifications ?? '', unit: it.unit ?? '', soLuong: it.kg != null ? String(it.kg) : '' })),
      ...(mt?.vatTuPhuKien ?? []).map((it): DetailLine => ({ id: id++, group: 'vatTuPhuKien', materialId: Number(it.materialId) || 0, name: it.name, specs: it.specifications ?? '', unit: it.unit ?? '', soLuong: it.quantity != null ? String(it.quantity) : '' })),
      ...(mt?.baoBiDongGoi ?? []).map((it): DetailLine => ({ id: id++, group: 'baoBiDongGoi', materialId: Number(it.materialId) || 0, name: it.name, specs: it.specifications ?? '', unit: it.unit ?? '', soLuong: it.quantity != null ? String(it.quantity) : '' })),
    ]
    setSelectedBom(item); setLines(existing); setNextId(id)
    resetForm()
  }

  const addLine = () => {
    if (!material) return
    setLines(ls => [...ls, {
      id: nextId, group, materialId: material.id, name: `${material.code} — ${material.name}`, specs: spec, unit, soLuong,
    }])
    setNextId(n => n + 1)
    resetForm()
  }

  const deleteLine = (id: number) => {
    setLines(ls => ls.filter(l => l.id !== id))
  }

  const submitAll = async () => {
    if (!selectedBom || lines.length === 0) return
    setSavingDetail(true)
    try {
      const toLine = (l: DetailLine) => ({ materialId: String(l.materialId), name: l.name, unit: l.unit || undefined })
      await api.updateSkuDetailQuota(selectedBom.id, {
        daySon: lines.filter(l => l.group === 'daySon').map(l => ({ ...toLine(l), kg: l.soLuong.trim() !== '' ? Number(l.soLuong) : undefined })),
        vatTuPhuKien: lines.filter(l => l.group === 'vatTuPhuKien').map(l => ({ ...toLine(l), quantity: l.soLuong.trim() !== '' ? Number(l.soLuong) : undefined })),
        baoBiDongGoi: lines.filter(l => l.group === 'baoBiDongGoi').map(l => ({ ...toLine(l), quantity: l.soLuong.trim() !== '' ? Number(l.soLuong) : undefined })),
      }, user?.name ?? 'Không rõ')
      logAction(SKU_ENTITY, String(selectedBom.id), 'sku.detail_submitted', `${lines.length} vật tư (Sơn/Phụ kiện/Bao bì)`)
      await refetchSkus()
    } finally {
      setSavingDetail(false)
    }
  }

  const bomSt = selectedBom ? bomStatus(selectedBom.id) : 'canInput'
  const isSubmitted = bomSt === 'pending' || bomSt === 'approved'

  // ─── Render ────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Quản lý định mức chi tiết</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text3)' }}>Nhập định mức chi tiết theo SKU — Sơn, Phụ kiện, Bao bì</p>
        </div>
        <NotifBell
          items={boms.filter(b => bomStatus(b.id) === 'approved').map(n => ({ id: n.id, title: n.ten, subtitle: `Đã duyệt định mức chi tiết · ${n.thoiGian}` }))}
          emptyText="Chưa có định mức nào được duyệt."
        />
      </div>

      {/* ══ ĐỊNH MỨC: LIST ══ */}
      {subTab === 'dinh-muc' && !selectedBom && (
        <div>
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
                  {['SKU', 'Thời gian', 'Trạng thái', ''].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text2)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {boms.filter(b => b.ten.toLowerCase().includes(bomSearch.toLowerCase()) && bomStatus(b.id) !== 'approved').map(item => {
                  const st = bomStatus(item.id)
                  const rejectReason = st === 'rejected' ? findPf(item.id)?.quotaManagement?.reviewStatus?.reason : undefined
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

          {findPf(selectedBom.id)?.quotaManagement?.entryMeta && (
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>
              Đã nhập bởi <strong>{findPf(selectedBom.id)!.quotaManagement!.entryMeta!.enteredBy}</strong> lúc {new Date(findPf(selectedBom.id)!.quotaManagement!.entryMeta!.enteredAt).toLocaleString('vi-VN')}
            </div>
          )}

          {bomSt === 'rejected' && (
            <div style={{ padding: '10px 16px', background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 'var(--radius-lg)', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#dc2626' }}>⚠ KHSX đã từ chối — vui lòng chỉnh sửa và gửi lại</div>
              {findPf(selectedBom.id)?.quotaManagement?.reviewStatus?.reason && (
                <div style={{ fontSize: 12, color: '#dc2626', fontStyle: 'italic', marginTop: 2 }}>{findPf(selectedBom.id)!.quotaManagement!.reviewStatus!.reason}</div>
              )}
            </div>
          )}

          {/* Add line */}
          {!isSubmitted && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '14px 16px', marginBottom: 14 }}>
              {/* Chọn nhóm vật tư — quyết định materialGroupId lọc MaterialPicker + nhãn form. */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                {GROUPS.map(g => (
                  <button key={g}
                    onClick={() => { setGroup(g); setMaterial(null) }}
                    style={{
                      padding: '5px 12px', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                      border: `1px solid ${group === g ? GROUP_BADGE_COLORS[g].fg : 'var(--border)'}`,
                      background: group === g ? GROUP_BADGE_COLORS[g].bg : 'var(--surface)',
                      color: group === g ? GROUP_BADGE_COLORS[g].fg : 'var(--text2)',
                    }}
                  >{GROUP_LABELS[g]}</button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 25, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <FL>{GROUP_CODE_LABELS[group]}</FL>
                  <MaterialPicker
                    value={material}
                    onSelect={m => { setMaterial(m); setSpec(m?.spec ?? ''); setUnit(m?.unit ?? '') }}
                    materialGroupId={otherGroupId}
                    detailKind={GROUP_DETAIL_KIND[group]}
                    placeholder={`Chọn ${GROUP_CODE_LABELS[group].toLowerCase()}…`}
                  />
                </div>
                <div style={{ width: 150 }}>
                  <FL>Quy cách</FL>
                  <input placeholder="VD: 20kg/thùng" value={spec}
                    onChange={e => setSpec(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addLine()}
                    style={inputStyle} />
                </div>
                <div style={{ width: 110 }}>
                  <FL>Đơn vị tính</FL>
                  <input placeholder="VD: kg" value={unit}
                    onChange={e => setUnit(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addLine()}
                    style={inputStyle} />
                </div>
                <div style={{ width: 140 }}>
                  <FL>{GROUP_QTY_LABELS[group]}</FL>
                  <input type="number" min={0} placeholder="0" value={soLuong}
                    onChange={e => setSoLuong(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addLine()}
                    style={inputStyle} />
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={addLine} disabled={!material} style={{
                    padding: '7px 16px', border: 'none', borderRadius: 'var(--radius)',
                    background: material ? '#1565c0' : '#ccc',
                    color: '#fff', fontWeight: 700, fontSize: 13,
                    cursor: material ? 'pointer' : 'not-allowed',
                  }}>+ Thêm</button>
                </div>
              </div>
            </div>
          )}

          {/* Empty state */}
          {lines.length === 0 && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '40px', textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>
              Chưa có vật tư nào.
            </div>
          )}

          {/* Combined lines table */}
          {lines.length > 0 && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--surface2)' }}>
                    <th style={{ width: 36, padding: '7px', textAlign: 'center', fontWeight: 600, color: 'var(--text2)', fontSize: 11 }}>#</th>
                    <th style={{ width: 90, padding: '7px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text2)', fontSize: 11 }}>Nhóm</th>
                    <th style={{ padding: '7px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text2)', fontSize: 11 }}>Vật tư</th>
                    <th style={{ padding: '7px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text2)', fontSize: 11 }}>Quy cách</th>
                    <th style={{ width: 120, padding: '7px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--text2)', fontSize: 11 }}>Số lượng</th>
                    <th style={{ width: 70, padding: '7px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text2)', fontSize: 11 }}>ĐVT</th>
                    {!isSubmitted && <th style={{ width: 64 }}></th>}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => {
                    const badge = GROUP_BADGE_COLORS[l.group]
                    return (
                      <tr key={l.id} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 12, padding: '9px 7px' }}>{i + 1}</td>
                        <td style={{ padding: '9px 14px' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: badge.fg, background: badge.bg, borderRadius: 4, padding: '2px 7px', whiteSpace: 'nowrap' }}>
                            {GROUP_LABELS[l.group]}
                          </span>
                        </td>
                        <td style={{ padding: '9px 14px', color: 'var(--text)', fontWeight: 500 }}>{l.name}</td>
                        <td style={{ padding: '9px 14px', color: 'var(--text3)' }}>{l.specs || '—'}</td>
                        <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text)' }}>{l.soLuong || '—'}</td>
                        <td style={{ padding: '9px 14px', color: 'var(--text3)' }}>{l.unit || '—'}</td>
                        {!isSubmitted && (
                          <td style={{ textAlign: 'center', padding: '4px', whiteSpace: 'nowrap' }}>
                            <button onClick={() => deleteLine(l.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 4 }}>
                              <X size={14} />
                            </button>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Submit bar */}
          {lines.length > 0 && (
            <div style={{
              marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 16px', background: 'var(--surface)',
              border: `1px solid ${
                bomSt === 'approved' ? '#a5d6a7'
                : bomSt === 'pending' ? '#ffe082'
                : 'var(--border)'
              }`,
              borderRadius: 'var(--radius-lg)',
            }}>
              {bomSt === 'approved' ? (
                <>
                  <span style={{ fontSize: 13, color: '#2e7d32', fontWeight: 600 }}>✓ Đã được duyệt</span>
                  <button onClick={() => setSelectedBom(null)} style={{
                    padding: '7px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                    background: 'var(--surface)', cursor: 'pointer', fontSize: 13, color: 'var(--text2)',
                  }}>Quay lại danh sách</button>
                </>
              ) : bomSt === 'pending' ? (
                <>
                  <span style={{ fontSize: 13, color: '#e65100', fontWeight: 600 }}>⏳ Đã gửi phê duyệt — đang chờ quản lý xác nhận</span>
                  <button onClick={() => setSelectedBom(null)} style={{
                    padding: '7px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                    background: 'var(--surface)', cursor: 'pointer', fontSize: 13, color: 'var(--text2)',
                  }}>Quay lại danh sách</button>
                </>
              ) : (
                <>
                  <span style={{ fontSize: 13, color: 'var(--text2)' }}>{lines.length} vật tư</span>
                  <button
                    onClick={submitAll}
                    disabled={savingDetail}
                    style={{
                      padding: '7px 20px', border: 'none', borderRadius: 'var(--radius)',
                      background: '#1565c0', color: '#fff', fontWeight: 700, fontSize: 13,
                      cursor: savingDetail ? 'not-allowed' : 'pointer', opacity: savingDetail ? 0.7 : 1,
                    }}
                  >{savingDetail ? 'Đang gửi...' : 'Gửi phê duyệt →'}</button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══ DANH SÁCH VẬT TƯ (gộp Sơn + Phụ kiện + Bao bì) ══ */}
      {subTab === 'catalog' && <SpecAccessoryCatalogPage />}
    </div>
  )
}
