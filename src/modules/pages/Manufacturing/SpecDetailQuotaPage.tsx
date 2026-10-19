import { useEffect, useState } from 'react'
import { focusAttr } from '../../../utils/notificationLink'
import { format } from 'date-fns'
import { ChevronRight, ChevronLeft, Copy, X } from 'lucide-react'
import SkuImageThumb from '../../../components/SkuImageThumb'
import MaterialPicker, { type PickedMaterial } from '../../../components/MaterialPicker'
import SearchableSelect from '../../../components/SearchableSelect'
import Modal from '../../../components/Modal'
import { useFetch } from '../../../hooks/useFetch'
import { useConfirm } from '../../../hooks/useConfirm'
import { useMaterialGroupIds } from '../../../hooks/useMaterialGroupIds'
import * as api from '../../../services/api'
import { useAuth } from '../../../context/AuthContext'
import { useAuditLog } from '../../../context/AuditLogContext'
import { SKU_ENTITY } from '../../../constants/skuStatus'
import SpecAccessoryCatalogPage from './SpecAccessoryCatalogPage'
import type { BaoBiDongGoiItem, DaySonItem, Sku, VatTuPhuKienItem } from '../../../types/sku'
import { useIsMobile } from '../../../hooks/useMediaQuery'
import LoadingState from '../../../components/LoadingState'
import LoadErrorState from '../../../components/LoadErrorState'
import { pageTitle, pageSubtitle } from '../../../styles/typography'
import { useRealtimeRefetch } from '../../../realtime/hooks'

// ─── Types ────────────────────────────────────────────────────────────
// "Định mức chi tiết" (Sơn/Phụ kiện/Bao bì) — 1 account nhập cả 3 nhóm trong 1 trang, gửi
// duyệt 1 lần (giống hệt cơ chế "định mức mảnh" ở SpecSteelPage.tsx, chỉ khác không có khái
// niệm mảnh — đây là danh sách phẳng thẳng theo SKU). Mỗi dòng gắn 1 Material thật qua
// materialId (chọn từ MaterialPicker theo nhóm đang chọn), số lượng quy đổi sang/từ
// DaySonItem (field `kg`) hoặc VatTuPhuKienItem/BaoBiDongGoiItem (field `quantity`) khi đọc/ghi.
type DetailLineGroup = 'daySon' | 'vatTuPhuKien' | 'baoBiDongGoi'
type DetailLine = { id: number; group: DetailLineGroup; materialId: number; name: string; specs: string; unit: string; soLuong: string }
type BomItem = { id: string; ten: string; maKhachHang: string; thoiGian: string }

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
  daySon: { bg: 'var(--bg-eff6ff)', fg: 'var(--fg-1d4ed8)' },
  vatTuPhuKien: { bg: 'var(--bg-ede9fe)', fg: 'var(--fg-6d28d9)' },
  baoBiDongGoi: { bg: 'var(--bg-d1fae5)', fg: 'var(--fg-065f46)' },
}

type DetailQuotaPayload = { daySon: DaySonItem[]; vatTuPhuKien: VatTuPhuKienItem[]; baoBiDongGoi: BaoBiDongGoiItem[] }

/** DetailLine[] (state form) -> shape BE nhận ở updateSkuDetailQuota/saveSkuDetailDraft - dùng
 *  chung cho cả nộp thật (submitAll) lẫn tạm lưu (xem "Tạm lưu" dưới) để khỏi lặp logic gom nhóm. */
function toDetailQuotaPayload(lines: DetailLine[]): DetailQuotaPayload {
  const toLine = (l: DetailLine) => ({ materialId: String(l.materialId), name: l.name, unit: l.unit || undefined })
  return {
    daySon: lines.filter(l => l.group === 'daySon').map(l => ({ ...toLine(l), kg: l.soLuong.trim() !== '' ? Number(l.soLuong) : undefined })),
    vatTuPhuKien: lines.filter(l => l.group === 'vatTuPhuKien').map(l => ({ ...toLine(l), quantity: l.soLuong.trim() !== '' ? Number(l.soLuong) : undefined })),
    baoBiDongGoi: lines.filter(l => l.group === 'baoBiDongGoi').map(l => ({ ...toLine(l), quantity: l.soLuong.trim() !== '' ? Number(l.soLuong) : undefined })),
  }
}

/** Chiều ngược lại - dùng cho cả openBom (từ quotaManagement.materialType đã duyệt/đang chờ)
 *  lẫn khôi phục nháp tạm lưu (từ detailDraft, cùng shape). */
function toDetailLines(mt: DetailQuotaPayload | undefined, startId: number): { lines: DetailLine[]; nextId: number } {
  let id = startId
  const lines: DetailLine[] = [
    ...(mt?.daySon ?? []).map((it): DetailLine => ({ id: id++, group: 'daySon', materialId: Number(it.materialId) || 0, name: it.name, specs: it.specifications ?? '', unit: it.unit ?? '', soLuong: it.kg != null ? String(it.kg) : '' })),
    ...(mt?.vatTuPhuKien ?? []).map((it): DetailLine => ({ id: id++, group: 'vatTuPhuKien', materialId: Number(it.materialId) || 0, name: it.name, specs: it.specifications ?? '', unit: it.unit ?? '', soLuong: it.quantity != null ? String(it.quantity) : '' })),
    ...(mt?.baoBiDongGoi ?? []).map((it): DetailLine => ({ id: id++, group: 'baoBiDongGoi', materialId: Number(it.materialId) || 0, name: it.name, specs: it.specifications ?? '', unit: it.unit ?? '', soLuong: it.quantity != null ? String(it.quantity) : '' })),
  ]
  return { lines, nextId: id }
}

/** "Sao chép từ SKU khác" phải lấy đúng bản MỚI NHẤT của SKU nguồn - nếu nguồn đang có nháp tạm
 *  lưu mới hơn lần gửi phê duyệt gần nhất (hoặc chưa từng gửi), ưu tiên nháp đó thay vì
 *  quotaManagement.materialType (dữ liệu đã nộp, có thể cũ hơn) - cùng logic resolve đã dùng ở
 *  openBom() cho CHÍNH SKU đang mở, áp dụng lại cho SKU KHÁC khi nó đóng vai trò nguồn copy
 *  (2026-10-19, theo yêu cầu người dùng - trước đó chỉ cho chọn SKU đã GỬI PHÊ DUYỆT làm nguồn). */
function resolveDetailSource(pf: Sku): { payload: DetailQuotaPayload | undefined; isDraft: boolean } {
  const entryAt = pf.quotaManagement?.entryMeta?.enteredAt
  const draftSavedAt = pf.detailDraftSavedAt
  if (draftSavedAt && (!entryAt || new Date(draftSavedAt) > new Date(entryAt))) {
    return { payload: pf.detailDraft, isDraft: true }
  }
  return { payload: pf.quotaManagement?.materialType, isDraft: false }
}

function totalDetailItems(payload: DetailQuotaPayload | undefined): number {
  return (payload?.daySon.length ?? 0) + (payload?.vatTuPhuKien.length ?? 0) + (payload?.baoBiDongGoi.length ?? 0)
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

// Quy cách chỉ đọc — luôn lấy từ Material.spec (catalog Admin > Vật tư) qua MaterialPicker,
// không cho gõ tay để tránh lệch với vật tư đang chọn.
const specInputStyle: React.CSSProperties = {
  ...inputStyle, background: 'var(--surface2)', color: 'var(--text3)', cursor: 'not-allowed',
}

// ─── Main ─────────────────────────────────────────────────────────────
export default function SpecDetailQuotaPage({ subTab, onSubTabChange }: {
  subTab: 'dinh-muc' | 'catalog'
  onSubTabChange: (t: 'dinh-muc' | 'catalog') => void
}) {
  const { user } = useAuth()
  const { ask, confirmModal } = useConfirm()
  // Admin được sửa định mức ngay cả khi KHSX/Sếp đã duyệt (ghi đè trực tiếp, không cần duyệt
  // lại - BE chặn mọi role khác, xem SkusService.resolveNonDraftOrAdminOverride, 2026-10-15).
  const isAdmin = user?.role === 'ADMIN'
  const { logAction } = useAuditLog()
  // Điện thoại: bảng dòng vật tư 7 cột -> thẻ; ô nhập form co giãn thay vì rộng cố định.
  const isMobile = useIsMobile()
  const fieldW = (w: number): React.CSSProperties => isMobile ? { flex: '1 1 130px', minWidth: 0 } : { width: w }
  const { data: skusData, isLoading: skusLoading, error: skusError, refetch: refetchSkus, mutate: mutateSkus } = useFetch<Sku[]>(() => api.getSkus(), [])
  // Vá lại đúng 1 dòng SKU trong cache bằng response vừa nhận - không gọi refetchSkus() (tải lại
  // cả danh sách) cho thao tác tạm lưu vì nó chạy mỗi giây lúc đang gõ (xem SpecSteelPage.tsx).
  const patchSku = (updated: Sku) => mutateSkus(prev => prev ? prev.map(s => s.id === updated.id ? updated : s) : prev)
  // Mảnh và chi tiết là 2 nhánh độc lập (tiến song song, không bắt buộc theo thứ tự) - chuyên viên
  // chi tiết thấy SKU ngay khi KHSX tạo, không cần chờ mảnh xong. Cùng điều kiện với SpecSteelPage.tsx.
  const skus = (skusData ?? []).filter(pf => pf.status !== 'DRAFT')
  // Sơn/Phụ kiện/Bao bì đều chọn vật tư từ chung 1 nhóm hệ thống "Vật tư khác" (OTHER) - BE
  // phân biệt 3 tab qua ConsumableBom.stage / BomAccessoryItem.kind, không phải qua nhóm vật tư.
  const { other: otherGroupId } = useMaterialGroupIds()

  const findPf = (id: string) => skus.find(pf => pf.id === id)

  const boms: BomItem[] = skus.map(pf => ({
    id: pf.id,
    // Form tạo SKU (SKUReviewPage) gán cùng 1 giá trị cho factoryCode lẫn name - trùng thì chỉ hiện 1 lần.
    ten: [...new Set([pf.mfgProduct?.factoryCode, pf.mfgProduct?.name].filter(Boolean))].join(' — '),
    maKhachHang: pf.customerName ?? '',
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
  // SKU mới/đổi từ phòng khác: tự tải lại NGẦM, không cần banner/bấm tay (2026-10-17, cùng đổi với
  // SpecSteelPage.tsx - xem comment đầy đủ ở đó). `lines` (state đang gõ) chỉ được set trong
  // openBom()/discardDraft() (hành động bấm tay), không có effect nào đồng bộ lại từ skusData, nên
  // refetch ngầm không xoá nội dung đang nhập. Khung sửa chỉ khoá (isSubmitted) khi CHÍNH người
  // đang xem tự bấm "Gửi phê duyệt" (submitAll() tự refetchSkus() ngay sau, không phải bị người
  // khác âm thầm đổi dưới tay) - đã xác nhận lại với user trước khi đổi.
  useRealtimeRefetch(['skus'], () => { void refetchSkus() }, {
    filter: payload => selectedBom == null || payload.entityId === selectedBom.id,
  })
  const [lines, setLines] = useState<DetailLine[]>([])
  const [nextId, setNextId] = useState(1)
  const [savingDetail, setSavingDetail] = useState(false)
  const [submitDetailError, setSubmitDetailError] = useState<string | null>(null)
  const [group, setGroup] = useState<DetailLineGroup>('daySon')
  const [material, setMaterial] = useState<PickedMaterial | null>(null)
  const [spec, setSpec] = useState('')
  const [unit, setUnit] = useState('')
  const [soLuong, setSoLuong] = useState('')
  const [bomSearch, setBomSearch] = useState('')
  // Tạm lưu (nháp trên server, CHƯA gửi phê duyệt) - cùng cơ chế với "định mức mảnh"
  // (SpecSteelPage.tsx): khôi phục được khi đổi máy/trình duyệt, mất mạng hay sập nguồn giữa
  // chừng. Không có khái niệm ảnh ở trang này nên không cần resolvePendingPhotos.
  const [draftRestoredAt, setDraftRestoredAt] = useState<string | null>(null)
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [savingDraft, setSavingDraft] = useState(false)
  // Sao chép định mức chi tiết từ 1 SKU KHÁC đã có sẵn dữ liệu - cùng cơ chế với "định mức mảnh"
  // (SpecSteelPage.tsx), dùng cho case nhiều SKU cùng mẫu sản phẩm, chỉ khác khách hàng/số lượng.
  const [showCopySkuModal, setShowCopySkuModal] = useState(false)
  const [copySkuSource, setCopySkuSource] = useState<{ id: string; ten: string } | null>(null)
  // Nguồn tính từ quotaManagement.materialType (đã gửi phê duyệt) HOẶC detailDraft (mới tạm lưu,
  // chưa gửi) - lấy đúng bản mới nhất qua resolveDetailSource(), KHÁC totalItemsOf() (chỉ đọc dữ
  // liệu đã nộp thật, dùng cho bomStatus() ở trên - không đổi, vẫn phải phản ánh đúng trạng thái
  // duyệt thật).
  const copySkuCandidates = skus
    .filter(pf => pf.id !== selectedBom?.id)
    .map(pf => ({ pf, source: resolveDetailSource(pf) }))
    .filter(({ source }) => totalDetailItems(source.payload) > 0)
    .map(({ pf, source }) => ({
      id: pf.id,
      ten: [...new Set([pf.mfgProduct?.factoryCode, pf.mfgProduct?.name].filter(Boolean))].join(' — '),
      maKhachHang: pf.customerName ?? '',
      itemCount: totalDetailItems(source.payload),
      isDraft: source.isDraft,
    }))

  const resetForm = () => {
    setGroup('daySon'); setMaterial(null); setSpec(''); setUnit(''); setSoLuong('')
  }

  const openBom = (item: BomItem) => {
    const pf = findPf(item.id)
    setSelectedBom(item)
    resetForm()
    setSubmitDetailError(null)
    setLastSavedAt(null)
    setDraftRestoredAt(null)

    // Bản nháp tạm lưu chỉ còn giá trị nếu mới hơn lần "Gửi phê duyệt" gần nhất - tránh ghi đè
    // dữ liệu đã nộp thật bằng nháp cũ còn sót (vd nộp thật từ máy khác sau khi tạm lưu ở đây).
    const entryAt = pf?.quotaManagement?.entryMeta?.enteredAt
    const draftSavedAt = pf?.detailDraftSavedAt
    if (draftSavedAt && (!entryAt || new Date(draftSavedAt) > new Date(entryAt))) {
      const { lines: draftLines, nextId: draftNextId } = toDetailLines(pf?.detailDraft, 1)
      setLines(draftLines); setNextId(draftNextId)
      setDraftRestoredAt(draftSavedAt)
    } else {
      const { lines: existing, nextId: id } = toDetailLines(pf?.quotaManagement?.materialType, 1)
      setLines(existing); setNextId(id)
    }
  }

  // Bỏ bản nháp, quay về đúng dữ liệu đã nộp thật gần nhất - vá cache bằng patchSku() thay vì
  // chờ refetchSkus() round-trip mạng (xem SpecSteelPage.discardDraft).
  const discardDraft = () => {
    if (!selectedBom) return
    void api.clearSkuDetailDraft(selectedBom.id).then(patchSku).catch(() => {})
    const { lines: existing, nextId: id } = toDetailLines(findPf(selectedBom.id)?.quotaManagement?.materialType, 1)
    setLines(existing); setNextId(id)
    setDraftRestoredAt(null)
    resetForm()
  }

  const saveDraftNow = async (currentLines: DetailLine[]) => {
    if (!selectedBom) return
    const updated = await api.saveSkuDetailDraft(selectedBom.id, toDetailQuotaPayload(currentLines), user?.name ?? 'Không rõ')
    setLastSavedAt(updated.detailDraftSavedAt ?? new Date().toISOString())
    patchSku(updated)
  }

  const manualSaveDraft = async () => {
    if (!selectedBom) return
    setSavingDraft(true)
    try {
      await saveDraftNow(lines)
    } catch {
      // Tạm lưu lỗi mạng - best-effort, không chặn luồng nhập liệu chính (vẫn còn trong RAM).
    } finally {
      setSavingDraft(false)
    }
  }

  // Chép toàn bộ dòng Sơn/Phụ kiện/Bao bì của 1 SKU khác vào form đang mở - cấp id mới cho mọi
  // dòng (không giữ id thật của SKU nguồn). Kết quả chỉ là NHÁP trong RAM, giống hệt vừa gõ tay.
  const applyCopySku = (sourceId: string) => {
    const pf = findPf(sourceId)
    const { lines: copied, nextId: id } = toDetailLines(pf ? resolveDetailSource(pf).payload : undefined, nextId)
    if (copied.length === 0) return
    setLines(copied)
    setNextId(id)
    resetForm()
    setDraftRestoredAt(null)
    setShowCopySkuModal(false)
    setCopySkuSource(null)
  }

  // Đã có dòng đang nhập dở thì hỏi lại trước khi ghi đè hẳn - tránh bấm nhầm mất dữ liệu đang có.
  const confirmCopySku = (sourceId: string) => {
    if (lines.length === 0) { applyCopySku(sourceId); return }
    ask({
      title: 'Ghi đè dữ liệu đang có?',
      message: 'SKU này đang có dữ liệu chi tiết (chưa gửi phê duyệt) - sao chép sẽ THAY THẾ TOÀN BỘ bằng dữ liệu của SKU được chọn, dữ liệu hiện tại sẽ mất. Bạn có chắc muốn tiếp tục?',
      confirmLabel: 'Ghi đè, sao chép',
      cancelLabel: 'Hủy',
      danger: true,
    }, () => applyCopySku(sourceId))
  }

  // Tự động tạm lưu mỗi khi dữ liệu đổi (debounce 1s) - bảo vệ cả khi người dùng quên bấm nút.
  useEffect(() => {
    if (!selectedBom) return
    const st = bomStatus(selectedBom.id)
    if ((st === 'pending' || st === 'approved') && !isAdmin) return
    if (lines.length === 0) {
      // Xoá hết dòng (dọn sạch form) - xoá luôn nháp trên server, không thì lần mở sau sẽ bị
      // "sống lại" đúng những dòng vừa xoá (đè lên form rỗng người dùng cố ý để lại).
      void api.clearSkuDetailDraft(selectedBom.id).then(patchSku).catch(() => {})
      return
    }
    const t = setTimeout(() => { void saveDraftNow(lines).catch(() => {}) }, 1000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, selectedBom?.id])

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
    setSubmitDetailError(null)
    try {
      await api.updateSkuDetailQuota(selectedBom.id, toDetailQuotaPayload(lines), user?.name ?? 'Không rõ')
      logAction(SKU_ENTITY, String(selectedBom.id), 'sku.detail_submitted', `${lines.length} vật tư (Sơn/Phụ kiện/Bao bì)`)
      // Nộp thật thành công - BE đã tự xoá detailDraft (xem SkusService.updateDetailQuota).
      setDraftRestoredAt(null)
      setLastSavedAt(null)
      await refetchSkus()
    } catch (e) {
      setSubmitDetailError(e instanceof Error ? e.message : 'Không thể gửi phê duyệt')
    } finally {
      setSavingDetail(false)
    }
  }

  const bomSt = selectedBom ? bomStatus(selectedBom.id) : 'canInput'
  // Admin không bị khoá ở đây - vẫn sửa/nộp lại được dù KHSX/Sếp đã duyệt xong (xem isAdmin).
  const isSubmitted = (bomSt === 'pending' || bomSt === 'approved') && !isAdmin

  // ─── Render ────────────────────────────────────────────────────────────
  // Gate CHỈ áp cho subTab 'dinh-muc' (cần skus) - 'catalog' (SpecAccessoryCatalogPage) không đụng
  // gì tới skus, không được chặn theo trạng thái tải của nhánh khác.
  if (subTab === 'dinh-muc' && skusLoading) return <LoadingState />
  if (subTab === 'dinh-muc' && (skusError || !skusData)) return <LoadErrorState error={skusError ?? 'Không rõ nguyên nhân'} onRetry={refetchSkus} />

  return (
    <div>
      {/* Page header - chuông "đã duyệt định mức" cục bộ (NotifBell, không nối BE, F5 mất trạng
          thái đã xem) đã gỡ 2026-09-25: thông báo thật cho luồng duyệt SKU/định mức thuộc Phase 3
          (nối sự kiện theo luồng) của changelog notification 2026-09-25, chưa có ở BE - xem
          NotificationCenter ở app shell (MfgApp) cho thông báo chung hiện có. */}
      <div style={{ marginBottom: isMobile ? 14 : 'var(--space-5)' }}>
        <h2 style={{ ...pageTitle, margin: 0 }}>Quản lý định mức chi tiết</h2>
        <p style={{ ...pageSubtitle, margin: '2px 0 0' }}>Nhập định mức chi tiết theo SKU — Sơn, Phụ kiện, Bao bì</p>
      </div>

      {/* ══ ĐỊNH MỨC: LIST ══ */}
      {subTab === 'dinh-muc' && !selectedBom && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <input
              value={bomSearch}
              onChange={e => setBomSearch(e.target.value)}
              placeholder="Tìm theo tên SKU, mã khách hàng…"
              style={{ width: '100%', maxWidth: 280, padding: '7px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text)', outline: 'none' }}
            />
          </div>
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                  {['SKU', 'Mã khách hàng', 'Thời gian', 'Trạng thái', ''].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text2)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {boms.filter(b => `${b.ten} ${b.maKhachHang}`.toLowerCase().includes(bomSearch.toLowerCase()) && (bomStatus(b.id) !== 'approved' || isAdmin)).map(item => {
                  const st = bomStatus(item.id)
                  const rejectReason = st === 'rejected' ? findPf(item.id)?.quotaManagement?.reviewStatus?.reason : undefined
                  return (
                  <tr key={item.id} {...focusAttr('SKU', item.id)}
                    onClick={() => openBom(item)}
                    style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background .1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text)' }}>
                      {item.ten}
                      {rejectReason && (
                        <div style={{ marginTop: 2, fontSize: 11, fontWeight: 400, color: 'var(--fg-c62828)', fontStyle: 'italic' }}>{rejectReason}</div>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px', color: 'var(--text2)' }}>{item.maKhachHang || '—'}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--text2)' }}>{item.thoiGian}</td>
                    <td style={{ padding: '12px 14px' }}>
                      {st === 'approved'
                        ? <span style={{ background: 'var(--bg-e8f5e9)', color: 'var(--fg-2e7d32)', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>✓ Đã duyệt (Admin ghi đè)</span>
                        : st === 'pending'
                        ? <span style={{ background: 'var(--bg-fff3e0)', color: 'var(--fg-e65100)', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>⏳ Chờ duyệt</span>
                        : st === 'rejected'
                        ? <span style={{ background: 'var(--bg-ffebee)', color: 'var(--fg-c62828)', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>✕ Bị từ chối</span>
                        : <span style={{ background: 'var(--bg-eef2ff)', color: 'var(--fg-3949ab)', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>Chờ nhập</span>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <button onClick={() => setSelectedBom(null)} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', flexShrink: 0, whiteSpace: 'nowrap',
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: 13, color: 'var(--text2)',
            }}><ChevronLeft size={14} /> Quay lại</button>
            <SkuImageThumb url={findPf(selectedBom.id)?.imageUrl} size={56} />
            <div>
              <span style={{ fontWeight: 700, fontSize: 15 }}>{selectedBom.ten}</span>
              {selectedBom.maKhachHang && (
                <span style={{ marginLeft: 10, fontSize: 12, fontWeight: 600, color: 'var(--text2)', background: 'var(--surface2)', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: 20 }}>Khách hàng: {selectedBom.maKhachHang}</span>
              )}
              <span style={{ marginLeft: 10, fontSize: 12, color: 'var(--text3)' }}>{selectedBom.thoiGian}</span>
            </div>
            {!isSubmitted && (
              <button onClick={() => setShowCopySkuModal(true)} style={{
                marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', flexShrink: 0, whiteSpace: 'nowrap',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: 13, color: 'var(--text2)', fontWeight: 600,
              }}><Copy size={14} /> Sao chép từ SKU khác</button>
            )}
          </div>

          <Modal open={showCopySkuModal} onClose={() => { setShowCopySkuModal(false); setCopySkuSource(null) }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Sao chép định mức chi tiết từ SKU khác</div>
            <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 14 }}>
              Chọn 1 SKU đã có sẵn định mức Sơn/Phụ kiện/Bao bì (đã gửi phê duyệt, hoặc đang có bản nháp tạm lưu — đánh dấu &quot;NHÁP, chưa gửi&quot;) — toàn bộ dòng của SKU đó sẽ được chép vào đây dưới dạng nháp, có thể sửa lại trước khi gửi phê duyệt.
            </div>
            <FL>SKU nguồn</FL>
            <SearchableSelect
              displayValue={copySkuSource?.ten ?? ''}
              options={copySkuCandidates}
              getKey={s => s.id}
              getSearchText={s => `${s.ten} ${s.maKhachHang}`}
              renderOption={s => (
                <span>
                  <strong>{s.ten}</strong> <span style={{ color: 'var(--text3)' }}>— {s.maKhachHang || '—'} · {s.itemCount} vật tư</span>
                  {s.isDraft && (
                    <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: 'var(--fg-8d6e00)', background: 'var(--bg-fff8e1)', borderRadius: 4, padding: '1px 6px' }}>NHÁP, chưa gửi</span>
                  )}
                </span>
              )}
              onSelect={s => setCopySkuSource({ id: s.id, ten: s.ten })}
              placeholder="Tìm theo tên SKU, mã khách hàng…"
              emptyText="Chưa có SKU nào khác từng nhập định mức chi tiết"
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 24 }}>
              <button onClick={() => { setShowCopySkuModal(false); setCopySkuSource(null) }} style={{
                padding: '7px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                background: 'var(--surface)', cursor: 'pointer', fontSize: 13, color: 'var(--text2)',
              }}>Hủy</button>
              <button
                onClick={() => {
                  if (!copySkuSource) return
                  const sourceId = copySkuSource.id
                  setShowCopySkuModal(false)
                  setCopySkuSource(null)
                  confirmCopySku(sourceId)
                }}
                disabled={!copySkuSource}
                style={{
                  padding: '7px 16px', border: 'none', borderRadius: 'var(--radius)',
                  background: copySkuSource ? 'var(--bg-1565c0)' : 'var(--bg-cccccc)',
                  color: '#fff', fontWeight: 700, fontSize: 13,
                  cursor: copySkuSource ? 'pointer' : 'not-allowed',
                }}
              >Sao chép</button>
            </div>
          </Modal>

          {findPf(selectedBom.id)?.quotaManagement?.entryMeta && (
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>
              Đã nhập bởi <strong>{findPf(selectedBom.id)!.quotaManagement!.entryMeta!.enteredBy}</strong> lúc {new Date(findPf(selectedBom.id)!.quotaManagement!.entryMeta!.enteredAt).toLocaleString('vi-VN')}
            </div>
          )}

          {bomSt === 'rejected' && (
            <div style={{ padding: '10px 16px', background: 'var(--bg-fff5f5)', border: '1px solid var(--fg-fca5a5)', borderRadius: 'var(--radius-lg)', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-dc2626)' }}>⚠ KHSX đã từ chối — vui lòng chỉnh sửa và gửi lại</div>
              {findPf(selectedBom.id)?.quotaManagement?.reviewStatus?.reason && (
                <div style={{ fontSize: 12, color: 'var(--fg-dc2626)', fontStyle: 'italic', marginTop: 2 }}>{findPf(selectedBom.id)!.quotaManagement!.reviewStatus!.reason}</div>
              )}
            </div>
          )}

          {draftRestoredAt && (
            <div style={{ padding: '10px 16px', background: 'var(--bg-fff8e1)', border: '1px solid var(--fg-ffca28)', borderRadius: 'var(--radius-lg)', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: 'var(--fg-8d6e00)' }}>
                Đã khôi phục bản nháp tạm lưu lúc {new Date(draftRestoredAt).toLocaleString('vi-VN')} (chưa gửi phê duyệt).
              </span>
              <button onClick={discardDraft} style={{
                padding: '5px 10px', border: '1px solid var(--fg-ffca28)', borderRadius: 'var(--radius)',
                background: 'var(--surface)', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--fg-8d6e00)',
              }}>Bỏ bản nháp</button>
            </div>
          )}

          {/* Add line */}
          {!isSubmitted && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: isMobile ? 12 : '14px 16px', marginBottom: 14 }}>
              {/* Chọn nhóm vật tư — quyết định materialGroupId lọc MaterialPicker + nhãn form. */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
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
              <div style={{ display: 'flex', gap: isMobile ? 12 : 25, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: isMobile ? '100%' : 220 }}>
                  <FL>{GROUP_CODE_LABELS[group]}</FL>
                  <MaterialPicker
                    value={material}
                    onSelect={m => { setMaterial(m); setSpec(m?.spec ?? ''); setUnit(m?.unit ?? '') }}
                    materialGroupId={otherGroupId}
                    detailKind={GROUP_DETAIL_KIND[group]}
                    placeholder={`Chọn ${GROUP_CODE_LABELS[group].toLowerCase()}…`}
                  />
                </div>
                <div style={fieldW(150)}>
                  <FL>Quy cách</FL>
                  <input placeholder="Theo vật tư đã chọn" value={spec}
                    disabled
                    style={specInputStyle} />
                </div>
                <div style={fieldW(110)}>
                  <FL>Đơn vị tính</FL>
                  <input placeholder="VD: kg" value={unit}
                    onChange={e => setUnit(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addLine()}
                    style={inputStyle} />
                </div>
                <div style={fieldW(140)}>
                  <FL>{GROUP_QTY_LABELS[group]}</FL>
                  <input type="number" min={0} placeholder="0" value={soLuong}
                    onChange={e => setSoLuong(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addLine()}
                    style={inputStyle} />
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={addLine} disabled={!material} style={{
                    padding: '7px 16px', border: 'none', borderRadius: 'var(--radius)',
                    background: material ? 'var(--bg-1565c0)' : 'var(--bg-cccccc)',
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

          {/* Combined lines: thẻ trên điện thoại, bảng trên màn rộng */}
          {lines.length > 0 && isMobile && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
              {lines.map((l, i) => {
                const badge = GROUP_BADGE_COLORS[l.group]
                return (
                  <div key={l.id} style={{ borderTop: i > 0 ? '1px solid var(--border)' : undefined, padding: '10px 12px', fontSize: 13 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: badge.fg, background: badge.bg, borderRadius: 4, padding: '2px 7px', whiteSpace: 'nowrap', flexShrink: 0 }}>{GROUP_LABELS[l.group]}</span>
                      <div style={{ flex: 1, minWidth: 0, fontWeight: 500, wordBreak: 'break-word' }}>{l.name}</div>
                      {!isSubmitted && (
                        <button onClick={() => deleteLine(l.id)} aria-label="Xóa" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 6, flexShrink: 0 }}><X size={16} /></button>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginTop: 6, fontSize: 12, color: 'var(--text3)' }}>
                      {l.specs && <span>Quy cách: <b style={{ color: 'var(--text2)', fontWeight: 600 }}>{l.specs}</b></span>}
                      <span>{GROUP_QTY_LABELS[l.group]}: <b style={{ color: 'var(--text)', fontWeight: 700 }}>{l.soLuong || '—'}</b> {l.unit}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {lines.length > 0 && !isMobile && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse', fontSize: 13 }}>
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
              marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10,
              padding: '12px 16px', background: 'var(--surface)',

              border: `1px solid ${
                bomSt === 'approved' && !isAdmin ? 'var(--fg-a5d6a7)'
                : bomSt === 'pending' && !isAdmin ? 'var(--fg-ffe082)'
                : 'var(--border)'
              }`,
              borderRadius: 'var(--radius-lg)',
            }}>
              {bomSt === 'approved' && !isAdmin ? (
                <>
                  <span style={{ fontSize: 13, color: 'var(--fg-2e7d32)', fontWeight: 600 }}>✓ Đã được duyệt</span>
                  <button onClick={() => setSelectedBom(null)} style={{
                    padding: '7px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                    background: 'var(--surface)', cursor: 'pointer', fontSize: 13, color: 'var(--text2)',
                  }}>Quay lại danh sách</button>
                </>
              ) : bomSt === 'pending' && !isAdmin ? (
                <>
                  <span style={{ fontSize: 13, color: 'var(--fg-e65100)', fontWeight: 600 }}>⏳ Đã gửi phê duyệt — đang chờ quản lý xác nhận</span>
                  <button onClick={() => setSelectedBom(null)} style={{
                    padding: '7px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                    background: 'var(--surface)', cursor: 'pointer', fontSize: 13, color: 'var(--text2)',
                  }}>Quay lại danh sách</button>
                </>
              ) : (
                <>
                  {submitDetailError && (
                    <span style={{ fontSize: 12, color: 'var(--fg-c62828)', flex: '1 1 100%' }}>{submitDetailError}</span>
                  )}
                  {isAdmin && (bomSt === 'approved' || bomSt === 'pending') && (
                    <span style={{ fontSize: 12, color: 'var(--fg-e65100)', flex: '1 1 100%' }}>
                      ⚠ SKU này đã {bomSt === 'approved' ? 'được duyệt' : 'nộp, đang chờ duyệt'} — sửa và gửi sẽ ghi đè trực tiếp, không cần duyệt lại.
                    </span>
                  )}
                  <span style={{ fontSize: 13, color: 'var(--text2)' }}>{lines.length} vật tư</span>
                  {/* Giờ tạm lưu + 2 nút gom sát nhau 1 cụm (thay vì rải đều theo space-between
                      của cha) - theo yêu cầu người dùng, dễ liên hệ "tạm lưu" với "gửi phê duyệt". */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    {lastSavedAt && (
                      <span style={{ fontSize: 11, color: 'var(--text3)' }}>Đã tạm lưu lúc {new Date(lastSavedAt).toLocaleTimeString('vi-VN')}</span>
                    )}
                    <button
                      onClick={manualSaveDraft}
                      disabled={savingDraft}
                      title="Lưu tạm trên máy chủ - chưa gửi phê duyệt, mở lại trang (kể cả máy khác) là thấy lại ngay"
                      style={{
                        padding: '7px 16px', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                        background: 'var(--surface)', color: 'var(--text2)', fontWeight: 600, fontSize: 13,
                        cursor: savingDraft ? 'not-allowed' : 'pointer', opacity: savingDraft ? 0.7 : 1,
                      }}
                    >{savingDraft ? 'Đang lưu...' : 'Tạm lưu'}</button>
                    <button
                      onClick={submitAll}
                      disabled={savingDetail}
                      style={{
                        padding: '7px 20px', border: 'none', borderRadius: 'var(--radius)',
                        background: 'var(--bg-1565c0)', color: '#fff', fontWeight: 700, fontSize: 13,
                        cursor: savingDetail ? 'not-allowed' : 'pointer', opacity: savingDetail ? 0.7 : 1,
                      }}
                    >{savingDetail ? 'Đang gửi...' : (bomSt === 'approved' && isAdmin) ? 'Ghi đè định mức →' : 'Gửi phê duyệt →'}</button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══ DANH SÁCH VẬT TƯ (gộp Sơn + Phụ kiện + Bao bì) ══ */}
      {subTab === 'catalog' && <SpecAccessoryCatalogPage />}
      {confirmModal}
    </div>
  )
}
