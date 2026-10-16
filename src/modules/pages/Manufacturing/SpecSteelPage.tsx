import { useEffect, useState } from 'react'
import { focusAttr } from '../../../utils/notificationLink'
import { format } from 'date-fns'
import { ChevronRight, ChevronLeft, Plus, X, Pencil, Upload } from 'lucide-react'
import SkuImageThumb from '../../../components/SkuImageThumb'
import MaterialPicker, { type PickedMaterial } from '../../../components/MaterialPicker'
import { useFetch } from '../../../hooks/useFetch'
import { useMaterialGroupIds } from '../../../hooks/useMaterialGroupIds'
import * as api from '../../../services/api'
import { useAuth } from '../../../context/AuthContext'
import { useAuditLog } from '../../../context/AuditLogContext'
import { SKU_ENTITY } from '../../../constants/skuStatus'
import type { Sku, ManhRow, ManhChildRow, ManhChildGroup, ProcessStep } from '../../../types/sku'
import { PROCESS_STEPS, PROCESS_STEP_LABELS } from '../../../constants/processSteps'
import { useIsMobile } from '../../../hooks/useMediaQuery'
import LoadingState from '../../../components/LoadingState'
import LoadErrorState from '../../../components/LoadErrorState'
import { pageTitle, pageSubtitle } from '../../../styles/typography'
import { useRealtimeChangeNotice } from '../../../realtime/hooks'
import RealtimeUpdateNotice from '../../../realtime/RealtimeUpdateNotice'

// ─── Types ────────────────────────────────────────────────────────────
// "Định mức mảnh" (Manh/children) đọc/ghi thẳng Sku thật (manhData.pieces) — quy đổi sang/từ
// shape domain dễ đọc trong JSX khi đọc/ghi (xem toManh/toManhRow). Mỗi mảnh giờ chứa vật tư
// từ 5 nhóm (Sắt/Dây/Đinh/Tán rút/Nút nhựa) — chỉ Sắt có khái niệm "đoạn cắt" (cutLengthMm),
// 4 nhóm còn lại chỉ có materialId + số lượng. needsHan/needsSon áp dụng cho CẢ mảnh (Manh),
// không phải từng đoạn cắt riêng lẻ.
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
  processSteps: ProcessStep[]
  /** Chỉ dùng khi group='vatTuTP' - số vật tư thành phẩm cắt được từ 1 đơn vị material. */
  piecesPerBar: string
  /** Ảnh đính kèm - UI chỉ mở ô upload cho group='day', nhưng field dùng chung được cho mọi nhóm.
   *  URL THẬT (đã upload Cloudinary) - chỉ có khi: (a) dòng đã có sẵn từ BE, hoặc (b) vừa
   *  upload xong lúc bấm "Gửi phê duyệt" (xem submitManh). */
  photoUrl: string
  /** File ảnh vừa chọn nhưng CHƯA upload - toàn bộ mảnh/vật tư chỉ thật sự ghi lên server lúc
   *  "Gửi phê duyệt" (giống mọi field khác ở trang này), nên ảnh cũng phải hoãn upload tới lúc đó,
   *  tránh rác trên Cloudinary nếu người dùng chọn ảnh rồi hủy/thoát giữa chừng. */
  photoFile: File | null
  /** Preview tại chỗ (blob URL) cho photoFile - tạo 1 lần lúc chọn, không tạo lại mỗi lần render. */
  photoPreview: string
  /** Chỉ dùng khi group='nutNhua' (2026-09-11) - dòng nút nhựa này có "đi kèm mảnh khi xuất đan"
   *  không (checkbox riêng từng dòng). Dây/Đinh luôn tự động đi kèm (xem
   *  WeavingIssuesService.getWovenMaterialLinesByPiece ở BE) nên không cần checkbox cho 2 nhóm đó. */
  includeInWeaving: boolean
}
type Manh = { id: number; tenManh: string; soLuong: string; needsHan: boolean; needsSon: boolean; children: ManChild[] }
type BomItem = { id: string; ten: string; maKhachHang: string; thoiGian: string }

const CHILD_GROUPS: ManhChildGroup[] = ['sat', 'day', 'dinh', 'tanRut', 'nutNhua', 'vatTuTP', 'vatTuThanhPham']
const GROUP_LABELS: Record<ManhChildGroup, string> = {
  sat: 'Sắt', day: 'Dây', dinh: 'Đinh', tanRut: 'Tán rút', nutNhua: 'Nút nhựa',
  // 2026-10-01: Sắt chia 3 nhóm con - 'sat' = Phần mềm (đi solver), 'vatTuTP' đổi nhãn thành "Tự
  // tính" (tỷ lệ cắt cố định, vd tấm sắt lá -> Pat), 'vatTuThanhPham' là nhóm con MỚI (vd chân
  // nhôm) - cả 3 đều thuộc CÙNG 1 MaterialGroup "Sắt", phân biệt qua Material.steelSubGroup.
  vatTuTP: 'Tự tính', vatTuThanhPham: 'Vật tư thành phẩm',
}
// Nhóm con Sắt tương ứng từng tab - dùng để lọc MaterialPicker (steelSubGroup prop) và catalog.
const STEEL_SUB_GROUP_OF: Partial<Record<ManhChildGroup, 'SOFTWARE' | 'SELF_CALC' | 'FINISHED_COMPONENT'>> = {
  sat: 'SOFTWARE', vatTuTP: 'SELF_CALC', vatTuThanhPham: 'FINISHED_COMPONENT',
}

// "Mảnh có đan" = phải có cả nhóm Dây VÀ nhóm Đinh (Nút nhựa/Tán rút không bắt buộc, khôi phục lại
// điều kiện Đinh ở 2026-09-11 sau khi từng nới lỏng chỉ cần Dây ở 2026-09-04/09-05, DEC-11) - đúng
// quy tắc BE dùng để set Piece.isWoven (xem SkusService.isPieceWoven). Tính lại ở FE thay vì đọc
// field isWoven từ BE vì trang này còn cho sửa nháp (chưa gửi phê duyệt) - phải phản ánh đúng NGAY
// theo dòng vật tư đang có trên form, không đợi round-trip lưu/tải lại.
const WOVEN_GROUPS: ManhChildGroup[] = ['day', 'dinh']
const wovenStatus = (m: Manh): { isWoven: boolean; missing: ManhChildGroup[] } => {
  const present = new Set(m.children.map(c => c.group))
  const missing = WOVEN_GROUPS.filter(g => !present.has(g))
  return { isWoven: missing.length === 0, missing }
}
const GROUP_BADGE_COLORS: Record<ManhChildGroup, { bg: string; fg: string }> = {
  sat: { bg: 'var(--bg-e3f2fd)', fg: 'var(--fg-1565c0)' },
  day: { bg: 'var(--bg-fff3e0)', fg: 'var(--fg-e65100)' },
  dinh: { bg: 'var(--bg-f3e5f5)', fg: 'var(--fg-7b1fa2)' },
  tanRut: { bg: 'var(--bg-e8f5e9)', fg: 'var(--fg-2e7d32)' },
  nutNhua: { bg: 'var(--bg-fce4ec)', fg: 'var(--fg-ad1457)' },
  vatTuTP: { bg: 'var(--bg-ede7f6)', fg: 'var(--fg-4527a0)' },
  vatTuThanhPham: { bg: 'var(--bg-e0f2f1)', fg: 'var(--fg-00695c)' },
}

const toManh = (r: ManhRow): Manh => ({
  id: r.id, tenManh: r.name, soLuong: r.qtyPerSku ?? '1',
  needsHan: r.needsHan ?? true, needsSon: r.needsSon ?? true,
  children: r.children.map(c => ({
    // KHÔNG Number(c.materialId): id BE là bigint-as-string, khai `number` chỉ để khớp interface
    // cũ (xem comment đầu materials-api.ts) - ép qua Number() biến "5" thành 5 thật, làm
    // startEditChild() không bao giờ khớp lại được với materials[].id (vẫn là chuỗi "5"), ô chọn
    // vật tư trống trơn và nút Lưu khoá cứng mỗi khi sửa dòng đã lưu. Giữ nguyên giá trị gốc.
    id: c.id, group: c.group, materialId: (c.materialId ?? '') as unknown as number, loaiSatName: c.name,
    specs: c.specs ?? '', cutLengthMm: c.length ?? '', soLuong: c.qty ?? '', note: c.note ?? '', unit: c.unit ?? '',
    processSteps: c.processSteps ?? [], piecesPerBar: c.piecesPerBar ?? '', photoUrl: c.photoUrl ?? '',
    photoFile: null, photoPreview: '', includeInWeaving: c.includeInWeaving ?? false,
  })),
})
const toManhRow = (m: Manh): ManhRow => ({
  id: m.id, name: m.tenManh, qtyPerSku: m.soLuong,
  needsHan: m.needsHan, needsSon: m.needsSon,
  children: m.children.map((c): ManhChildRow => ({
    id: c.id, group: c.group, materialId: String(c.materialId), name: c.loaiSatName,
    specs: c.specs || undefined, length: c.cutLengthMm || undefined, qty: c.soLuong || undefined,
    note: c.note || undefined, unit: c.unit || undefined, photoUrl: c.photoUrl || undefined,
    processSteps: (c.group === 'sat' || c.group === 'vatTuTP') && c.processSteps.length > 0 ? c.processSteps : undefined,
    piecesPerBar: c.group === 'vatTuTP' ? c.piecesPerBar || undefined : undefined,
    includeInWeaving: (c.group === 'nutNhua' || c.group === 'vatTuThanhPham') ? c.includeInWeaving : undefined,
  })),
})

// ─── Tạm lưu (nháp) ───────────────────────────────────────────────────
// Trang này chỉ ghi thật lên server lúc "Gửi phê duyệt" (xem submitManh) - nếu đổi máy/trình
// duyệt, mất mạng hay sập nguồn giữa chừng thì toàn bộ mảnh đang nhập (chưa gửi) sẽ mất, vì chỉ
// tồn tại trong React state. Lưu định kỳ lên server (PlanForm.manhDraft, qua
// api.saveSkuManhDraft) để khôi phục lại được DÙ ĐỔI MÁY - vừa tự động (debounce mỗi lần đổi)
// vừa có nút "Tạm lưu" thủ công (yêu cầu thực tế từ account Sắt, 2026-10-16). Dùng lại đúng
// shape ManhRow[] (qua toManh/toManhRow) đã có sẵn cho manhData thật - server không parse, chỉ
// lưu/trả nguyên văn.
//
// Ảnh Dây chọn tại chỗ (blob, chưa upload Cloudinary) được upload thật NGAY lúc tạm lưu (khác
// submitManh - vốn hoãn upload tới lúc gửi phê duyệt) để bản nháp đồng bộ được qua máy khác;
// đánh đổi là ảnh có thể "mồ côi" trên Cloudinary nếu sau đó người dùng đổi/xoá ảnh trước khi
// gửi phê duyệt thật (chấp nhận được, dọn sau nếu cần).
async function resolvePendingPhotos(manhs: Manh[]): Promise<Manh[]> {
  return Promise.all(manhs.map(async (m) => ({
    ...m,
    children: await Promise.all(m.children.map(async (c) => {
      if (!c.photoFile) return c
      const photoUrl = await api.uploadImage(c.photoFile)
      return { ...c, photoUrl, photoFile: null }
    })),
  })))
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

// Quy cách chỉ đọc — luôn lấy từ Material.spec (catalog Admin > Vật tư) qua MaterialPicker,
// không cho gõ tay để tránh lệch với vật tư đang chọn.
const specInputStyle: React.CSSProperties = {
  ...inputStyle, background: 'var(--surface2)', color: 'var(--text3)', cursor: 'not-allowed',
}

// ─── Main ─────────────────────────────────────────────────────────────
export default function SpecSteelPage({ subTab, onSubTabChange }: {
  subTab: 'dinh-muc' | 'catalog'
  onSubTabChange: (t: 'dinh-muc' | 'catalog') => void
}) {
  const { user } = useAuth()
  // Admin được sửa định mức ngay cả khi KHSX/Sếp đã duyệt (ghi đè trực tiếp, không cần duyệt
  // lại - BE chặn mọi role khác bằng BomRevisionsService/SkusService.resolveNonDraftOrAdminOverride,
  // xem backend 2026-10-15). Dưới đây chỉ là mở lại UI cho đúng role này, BE vẫn tự kiểm độc lập.
  const isAdmin = user?.role === 'ADMIN'
  const { logAction } = useAuditLog()
  // Điện thoại: bảng vật tư con 10 cột -> thẻ; ô nhập form thêm vật tư co giãn thay vì rộng cố định.
  const isMobile = useIsMobile()
  const fieldW = (w: number): React.CSSProperties => isMobile ? { flex: '1 1 130px', minWidth: 0 } : { width: w }
  const { data: skusData, isLoading: skusLoading, error: skusError, refetch: refetchSkus, mutate: mutateSkus } = useFetch<Sku[]>(() => api.getSkus(), [])
  // Vá lại đúng 1 dòng SKU trong cache bằng response vừa nhận - KHÔNG gọi refetchSkus() (tải lại
  // cả danh sách) cho thao tác tạm lưu vì nó chạy mỗi giây lúc đang gõ, sẽ rất tốn mạng. Thiếu
  // bước này là nguyên nhân bug thật (2026-10-16): tạm lưu xong, quay lại danh sách rồi mở lại
  // CÙNG PHIÊN (chưa reload trang) sẽ đọc phải `skus` cũ tải lúc mở trang - không thấy nháp vừa lưu.
  const patchSku = (updated: Sku) => mutateSkus(prev => prev ? prev.map(s => s.id === updated.id ? updated : s) : prev)
  // SKU mới/đổi từ phòng khác: chỉ báo, KHÔNG tự tải lại để không mất dữ liệu đang nhập định mức.
  const skuChange = useRealtimeChangeNotice(['skus'])
  const skus = (skusData ?? []).filter(pf => pf.status !== 'DRAFT')
  const { data: materialsData } = useFetch(() => api.getMaterials(), [])
  const materials = materialsData ?? []
  const {
    steel: steelGroupId, wire: wireGroupId, nail: nailGroupId,
    rivet: rivetGroupId, plasticButton: plasticButtonGroupId,
  } = useMaterialGroupIds()
  // 2026-10-01: sat/vatTuTP/vatTuThanhPham đều thuộc CÙNG 1 MaterialGroup "Sắt" (3 nhóm con,
  // không phải 3 nhóm ngang hàng) - phân biệt thêm qua steelSubGroupOf() truyền cho MaterialPicker.
  const groupIdOf = (g: ManhChildGroup): number | undefined => {
    if (g === 'sat' || g === 'vatTuTP' || g === 'vatTuThanhPham') return steelGroupId
    if (g === 'day') return wireGroupId
    if (g === 'dinh') return nailGroupId
    if (g === 'tanRut') return rivetGroupId
    return plasticButtonGroupId
  }
  const steelSubGroupOf = (g: ManhChildGroup) => STEEL_SUB_GROUP_OF[g]

  const findPf = (id: string) => skus.find(pf => pf.id === id)

  // ── Định mức (mảnh) — Sku thật (manhData.pieces / manhEntryMeta / manhReviewStatus) ────────
  // Mảnh là bước nhập đầu tiên trong flow hiện tại nên hiện luôn cho mọi SKU chưa DRAFT.
  const manhBoms: BomItem[] = skus.map(pf => ({
    id: pf.id,
    // Form tạo SKU (SKUReviewPage) gán cùng 1 giá trị cho factoryCode lẫn name - trùng thì chỉ hiện 1 lần.
    ten: [...new Set([pf.mfgProduct?.factoryCode, pf.mfgProduct?.name].filter(Boolean))].join(' — '),
    maKhachHang: pf.customerName ?? '',
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
  const [submitManhError, setSubmitManhError] = useState<string | null>(null)
  const [showManhForm, setShowManhForm] = useState(false)
  const [formTenManh, setFormTenManh] = useState('')
  const [formSoLuong, setFormSoLuong] = useState('1')
  const [formNeedsHan, setFormNeedsHan] = useState(true)
  const [formNeedsSon, setFormNeedsSon] = useState(true)
  const [addingTo, setAddingTo] = useState<number | null>(null)
  const [childGroup, setChildGroup] = useState<ManhChildGroup>('sat')
  const [childMaterial, setChildMaterial] = useState<PickedMaterial | null>(null)
  const [childSpec, setChildSpec] = useState('')
  const [childCutLengthMm, setChildCutLengthMm] = useState('')
  const [childSoLuong, setChildSoLuong] = useState('')
  const [childNote, setChildNote] = useState('')
  const [childProcessSteps, setChildProcessSteps] = useState<ProcessStep[]>([])
  const [childPiecesPerBar, setChildPiecesPerBar] = useState('')
  const [childPhotoUrl, setChildPhotoUrl] = useState('')
  const [childPhotoFile, setChildPhotoFile] = useState<File | null>(null)
  const [childPhotoPreview, setChildPhotoPreview] = useState('')
  const [childIncludeInWeaving, setChildIncludeInWeaving] = useState(false)
  const [editingChild, setEditingChild] = useState<{ manhId: number; childId: number } | null>(null)
  const [manhBomSearch, setManhBomSearch] = useState('')
  const [catalogSearch, setCatalogSearch] = useState('')
  const [catalogGroup, setCatalogGroup] = useState<ManhChildGroup>('sat')
  // Tạm lưu (nháp trên server) - xem saveDraftNow/resolvePendingPhotos phía trên.
  const [draftRestoredAt, setDraftRestoredAt] = useState<string | null>(null)
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [savingDraft, setSavingDraft] = useState(false)

  // ── BOM helpers (mảnh) ─────────────────────────────────────────────────
  const openBom = (item: BomItem) => {
    const existing = (findPf(item.id)?.manhData?.pieces ?? []).map(toManh)
    const maxId = existing.flatMap(m => [m.id, ...m.children.map(c => c.id)]).reduce((a, b) => Math.max(a, b), 0)
    setSelectedBom(item)
    setShowManhForm(false); setFormTenManh('')
    setAddingTo(null); resetChildForm()
    setSubmitManhError(null)
    setLastSavedAt(null)
    setDraftRestoredAt(null)

    // Bản nháp tạm lưu (trên server) chỉ còn giá trị nếu mới hơn lần "Gửi phê duyệt" gần nhất
    // (nếu chưa từng gửi thì mọi bản nháp đều mới hơn) - tránh ghi đè dữ liệu đã nộp thật bằng
    // nháp cũ còn sót (vd nộp thật từ máy khác sau khi tạm lưu trên máy này).
    const pf = findPf(item.id)
    const entryAt = pf?.manhEntryMeta?.enteredAt
    const draftSavedAt = pf?.manhDraftSavedAt
    if (draftSavedAt && (!entryAt || new Date(draftSavedAt) > new Date(entryAt))) {
      const draftManhs = (pf?.manhDraft?.pieces ?? []).map(toManh)
      const draftMaxId = draftManhs.flatMap(m => [m.id, ...m.children.map(c => c.id)]).reduce((a, b) => Math.max(a, b), 0)
      setManhs(draftManhs)
      setNextId(Math.max(maxId, draftMaxId) + 1)
      setDraftRestoredAt(draftSavedAt)
    } else {
      setManhs(existing)
      setNextId(maxId + 1)
    }
  }

  // Bỏ bản nháp, quay về đúng dữ liệu đã nộp thật gần nhất (manhData, không đổi khi xoá nháp) -
  // vá cache bằng patchSku() thay vì chờ refetchSkus() round-trip mạng.
  const discardDraft = () => {
    if (!selectedBom) return
    void api.clearSkuManhDraft(selectedBom.id).then(patchSku).catch(() => {})
    const existing = (findPf(selectedBom.id)?.manhData?.pieces ?? []).map(toManh)
    const maxId = existing.flatMap(m => [m.id, ...m.children.map(c => c.id)]).reduce((a, b) => Math.max(a, b), 0)
    setManhs(existing)
    setNextId(maxId + 1)
    setDraftRestoredAt(null)
    // Bản nháp bị thay hẳn - đóng mọi form đang mở dở (Thêm mảnh/Thêm vật tư) vì có thể đang trỏ
    // tới 1 mảnh chỉ có trong nháp, không còn trong `existing` vừa load lại.
    setShowManhForm(false); setFormTenManh(''); setFormSoLuong('1'); setFormNeedsHan(true); setFormNeedsSon(true)
    setAddingTo(null); resetChildForm()
  }

  const saveDraftNow = async (current: Manh[]) => {
    if (!selectedBom) return
    // Chỉ upload lại khi thật sự có ảnh mới chọn (photoFile) - resolvePendingPhotos() luôn tạo
    // object mới dù không đổi gì, setManhs vô điều kiện sẽ làm effect tự lưu bên dưới chạy lại
    // vô hạn (mảng manhs đổi identity -> effect chạy -> saveDraftNow -> setManhs -> effect...).
    const hasPendingPhoto = current.some(m => m.children.some(c => c.photoFile))
    const resolved = hasPendingPhoto ? await resolvePendingPhotos(current) : current
    if (hasPendingPhoto) setManhs(resolved)
    const updated = await api.saveSkuManhDraft(selectedBom.id, resolved.map(toManhRow), user?.name ?? 'Không rõ')
    setLastSavedAt(updated.manhDraftSavedAt ?? new Date().toISOString())
    patchSku(updated)
  }

  const manualSaveDraft = async () => {
    if (!selectedBom) return
    setSavingDraft(true)
    try {
      await saveDraftNow(manhs)
    } catch {
      // Tạm lưu lỗi mạng - best-effort, không chặn luồng nhập liệu chính (vẫn còn trong RAM).
    } finally {
      setSavingDraft(false)
    }
  }

  // Tự động tạm lưu mỗi khi dữ liệu đổi (debounce 1s) - bảo vệ cả khi người dùng quên bấm nút.
  // Tính "đã nộp" trực tiếp ở đây (không dùng isSubmitted khai báo phía dưới) vì effect này đứng
  // trước trong thứ tự khai báo của component.
  useEffect(() => {
    if (!selectedBom) return
    const st = manhBomStatus(selectedBom.id)
    if ((st === 'pending' || st === 'approved') && !isAdmin) return
    if (manhs.length === 0) {
      // Xoá hết mảnh (dọn sạch form) - xoá luôn nháp trên server, không thì lần mở sau sẽ bị
      // "sống lại" đúng những mảnh vừa xoá (đè lên form rỗng người dùng cố ý để lại).
      void api.clearSkuManhDraft(selectedBom.id).then(patchSku).catch(() => {})
      return
    }
    const t = setTimeout(() => { void saveDraftNow(manhs).catch(() => {}) }, 1000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manhs, selectedBom?.id])

  const submitManh = async () => {
    if (!selectedBom || totalChildren === 0) return
    setSavingManh(true)
    setSubmitManhError(null)
    try {
      // Ảnh Dây chỉ được chọn tại chỗ (blob preview), CHƯA lên Cloudinary - upload thật ngay
      // trước khi gửi, để khớp đúng nguyên tắc "mọi thứ ở trang này chỉ ghi lên server lúc Gửi
      // phê duyệt". Giữ lại state đã upload (setManhs) để gửi lại lần 2 (vd sau khi KHSX từ chối)
      // không upload trùng file cũ.
      const resolvedManhs = await resolvePendingPhotos(manhs)
      setManhs(resolvedManhs)
      await api.updateSkuManhQuota(selectedBom.id, resolvedManhs.map(toManhRow), user?.name ?? 'Không rõ')
      logAction(SKU_ENTITY, String(selectedBom.id), 'sku.manh_submitted', `${manhs.length} mảnh · ${totalChildren} dòng vật tư`)
      // Nộp thật thành công - BE đã tự xoá manhDraft (xem SkusService.updateManhQuota).
      setDraftRestoredAt(null)
      setLastSavedAt(null)
      await refetchSkus()
    } catch (e: unknown) {
      setSubmitManhError(e instanceof Error ? e.message : 'Không thể gửi phê duyệt')
    } finally {
      setSavingManh(false)
    }
  }

  const addManh = () => {
    if (!formTenManh.trim() || !selectedBom) return
    const sl = String(Math.max(1, Math.floor(Number(formSoLuong)) || 1))
    setManhs(m => [...m, {
      id: nextId, tenManh: formTenManh.trim(), soLuong: sl,
      needsHan: formNeedsHan, needsSon: formNeedsSon, children: [],
    }])
    setNextId(n => n + 1)
    setShowManhForm(false); setFormTenManh(''); setFormSoLuong('1'); setFormNeedsHan(true); setFormNeedsSon(true)
  }

  const toggleManhFlag = (manhId: number, flag: 'needsHan' | 'needsSon') => {
    setManhs(ms => ms.map(m => m.id === manhId ? { ...m, [flag]: !m[flag] } : m))
  }

  const resetChildForm = () => {
    setChildGroup('sat')
    setChildMaterial(null); setChildSpec(''); setChildCutLengthMm(''); setChildSoLuong(''); setChildNote('')
    // Tick sẵn "Cắt" (2026-10-01, theo yêu cầu người dùng) - mọi vật tư nhóm Sắt/Tự tính đều phải
    // qua Phôi cắt trước, đỡ phải tự bấm mỗi lần thêm mới.
    setChildProcessSteps(['CAT']); setChildPiecesPerBar(''); setChildPhotoUrl(''); setChildPhotoFile(null)
    setChildPhotoPreview(''); setChildIncludeInWeaving(false); setEditingChild(null)
  }

  const toggleChildProcessStep = (step: ProcessStep) => {
    setChildProcessSteps(steps => steps.includes(step) ? steps.filter(s => s !== step) : [...steps, step])
  }

  // Chỉ xem trước tại chỗ (blob URL) - CHƯA upload lên Cloudinary. Toàn bộ mảnh/vật tư ở trang
  // này chỉ thật sự ghi lên server lúc "Gửi phê duyệt" (xem submitManh), nên ảnh cũng phải hoãn
  // upload tới lúc đó - chọn ảnh rồi hủy/thoát giữa chừng sẽ không để lại rác trên Cloudinary.
  const onPickChildPhoto = (file?: File) => {
    if (!file) return
    setChildPhotoUrl('') // bỏ URL thật cũ (nếu đang sửa dòng đã có ảnh) - ảnh mới sẽ thay thế hẳn
    setChildPhotoFile(file)
    setChildPhotoPreview(URL.createObjectURL(file))
  }

  // Vừa dùng để thêm dòng vật tư mới, vừa dùng để lưu lại dòng đang sửa (editingChild) —
  // tránh bắt người dùng xóa rồi nhập lại từ đầu chỉ để chỉnh 1 trường. Chiều dài cắt chỉ bắt
  // buộc khi nhóm = Sắt (đoạn cắt); số chân/cây chỉ bắt buộc khi nhóm = Vật tư thành phẩm;
  // 3 nhóm còn lại chỉ cần vật tư + số lượng.
  const saveChild = (manhId: number) => {
    if (!childMaterial) return
    if (childGroup === 'sat' && !childCutLengthMm.trim()) return
    if (childGroup === 'vatTuTP' && !childPiecesPerBar.trim()) return
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
        processSteps: (childGroup === 'sat' || childGroup === 'vatTuTP') ? childProcessSteps : [],
        piecesPerBar: childGroup === 'vatTuTP' ? childPiecesPerBar : '',
        photoUrl: childGroup === 'day' ? childPhotoUrl : '',
        photoFile: childGroup === 'day' ? childPhotoFile : null,
        photoPreview: childGroup === 'day' ? childPhotoPreview : '',
        includeInWeaving: (childGroup === 'nutNhua' || childGroup === 'vatTuThanhPham') ? childIncludeInWeaving : false,
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
    setChildProcessSteps(child.processSteps ?? [])
    setChildPiecesPerBar(child.piecesPerBar ?? '')
    setChildPhotoUrl(child.photoUrl ?? '')
    setChildPhotoFile(child.photoFile ?? null)
    setChildPhotoPreview(child.photoPreview ?? '')
    setChildIncludeInWeaving(child.includeInWeaving ?? false)
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
  // Admin không bị khoá ở đây (xem isAdmin) - vẫn sửa/nộp lại được dù KHSX/Sếp đã duyệt xong.
  const isSubmitted = (manhSt === 'pending' || manhSt === 'approved') && !isAdmin

  const catalogGroupId = groupIdOf(catalogGroup)
  const catalogSteelSubGroup = steelSubGroupOf(catalogGroup)
  const catalogMaterials = materials.filter(m =>
    catalogGroupId != null && m.materialGroupId === catalogGroupId
    && (catalogSteelSubGroup == null || m.steelSubGroup === catalogSteelSubGroup
        || (catalogSteelSubGroup === 'SOFTWARE' && m.steelSubGroup == null))
  )

  // ─── Render ────────────────────────────────────────────────────────────
  // Gate CHỈ áp cho subTab 'dinh-muc' (cần skus) - 'catalog' không đụng skus, không được chặn
  // theo trạng thái tải của nhánh khác.
  if (subTab === 'dinh-muc' && skusLoading) return <LoadingState />
  if (subTab === 'dinh-muc' && (skusError || !skusData)) return <LoadErrorState error={skusError ?? 'Không rõ nguyên nhân'} onRetry={refetchSkus} />

  return (
    <div>
      <RealtimeUpdateNotice visible={skuChange.changed} onReload={() => { skuChange.clear(); void refetchSkus() }} />
      {/* Page header - chuông "đã duyệt định mức" cục bộ (NotifBell, không nối BE, F5 mất trạng
          thái đã xem) đã gỡ 2026-09-25: thông báo thật cho luồng duyệt SKU/định mức thuộc Phase 3
          (nối sự kiện theo luồng) của changelog notification 2026-09-25, chưa có ở BE - xem
          NotificationCenter ở app shell (MfgApp) cho thông báo chung hiện có. */}
      <div style={{ marginBottom: isMobile ? 14 : 'var(--space-5)' }}>
        <h2 style={{ ...pageTitle, margin: 0 }}>Quản lý định mức — Mảnh</h2>
        <p style={{ ...pageSubtitle, margin: '2px 0 0' }}>Nhập định mức mảnh theo SKU — Sắt, Dây, Đinh, Tán rút, Nút nhựa</p>
      </div>

      {/* ══ ĐỊNH MỨC: LIST ══ */}
      {subTab === 'dinh-muc' && !selectedBom && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <input
              value={manhBomSearch}
              onChange={e => setManhBomSearch(e.target.value)}
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
                {manhBoms.filter(b => `${b.ten} ${b.maKhachHang}`.toLowerCase().includes(manhBomSearch.toLowerCase()) && (manhBomStatus(b.id) !== 'approved' || isAdmin)).map(item => {
                  const st = manhBomStatus(item.id)
                  const rejectReason = st === 'rejected' ? findPf(item.id)?.manhReviewStatus?.reason : undefined
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
          </div>

          {findPf(selectedBom.id)?.manhEntryMeta && (
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>
              Đã nhập bởi <strong>{findPf(selectedBom.id)!.manhEntryMeta!.enteredBy}</strong> lúc {new Date(findPf(selectedBom.id)!.manhEntryMeta!.enteredAt).toLocaleString('vi-VN')}
            </div>
          )}

          {manhSt === 'rejected' && (
            <div style={{ padding: '10px 16px', background: 'var(--bg-fff5f5)', border: '1px solid var(--fg-fca5a5)', borderRadius: 'var(--radius-lg)', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-dc2626)' }}>⚠ KHSX đã từ chối — vui lòng chỉnh sửa và gửi lại</div>
              {findPf(selectedBom.id)?.manhReviewStatus?.reason && (
                <div style={{ fontSize: 12, color: 'var(--fg-dc2626)', fontStyle: 'italic', marginTop: 2 }}>{findPf(selectedBom.id)!.manhReviewStatus!.reason}</div>
              )}
            </div>
          )}

          {draftRestoredAt && (
            <div style={{ padding: '10px 16px', background: 'var(--bg-fff8e1)', border: '1px solid var(--fg-ffca28)', borderRadius: 'var(--radius-lg)', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: 'var(--fg-8d6e00)' }}>
                📝 Đã khôi phục bản nháp tạm lưu lúc {new Date(draftRestoredAt).toLocaleString('vi-VN')} (chưa gửi phê duyệt).
              </span>
              <button onClick={discardDraft} style={{
                padding: '5px 10px', border: '1px solid var(--fg-ffca28)', borderRadius: 'var(--radius)',
                background: 'var(--surface)', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--fg-8d6e00)',
              }}>Bỏ bản nháp</button>
            </div>
          )}

          {/* Form tạo mảnh */}
          {showManhForm && (
            <div style={{ background: 'var(--bg-e3f2fd)', border: '1px solid var(--fg-90caf9)', borderRadius: 'var(--radius-lg)', padding: '14px 16px', marginBottom: 14 }}>
              <div style={{ fontWeight: 700, color: 'var(--fg-1565c0)', marginBottom: 10, fontSize: 14 }}>Tạo mảnh mới</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div>
                  <FL>SKU</FL>
                  <div style={{ padding: '7px 12px', background: 'var(--bg-d6e8fb)', border: '1px solid var(--fg-90caf9)', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 700, color: 'var(--fg-1565c0)' }}>
                    {selectedBom.ten}
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: isMobile ? '100%' : 200 }}>
                  <FL>Tên mảnh <span style={{ color: 'var(--fg-e53935)' }}>*</span></FL>
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
                <div>
                  <FL>Routing</FL>
                  <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--text2)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={formNeedsHan} onChange={e => setFormNeedsHan(e.target.checked)} />
                      Cần Hàn
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--text2)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={formNeedsSon} onChange={e => setFormNeedsSon(e.target.checked)} />
                      Cần Sơn
                    </label>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={addManh} disabled={!formTenManh.trim()} style={{
                    padding: '7px 16px', border: 'none', borderRadius: 'var(--radius)',
                    background: formTenManh.trim() ? 'var(--bg-1565c0)' : 'var(--bg-cccccc)',
                    color: '#fff', fontWeight: 700, fontSize: 13,
                    cursor: formTenManh.trim() ? 'pointer' : 'not-allowed',
                  }}>Tạo mảnh</button>
                  <button onClick={() => { setShowManhForm(false); setFormTenManh(''); setFormSoLuong('1'); setFormNeedsHan(true); setFormNeedsSon(true) }} style={{
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
              <button onClick={() => setShowManhForm(true)} style={{ background: 'none', border: 'none', color: 'var(--fg-1565c0)', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
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
                  display: 'flex', alignItems: 'center', gap: '8px 12px', padding: isMobile ? '10px 12px' : '10px 16px', flexWrap: 'wrap',
                  background: 'var(--surface2)',
                  borderBottom: m.children.length > 0 || addingTo === m.id ? '1px solid var(--border)' : 'none',
                }}>
                  {/* Tên SKU lặp lại ở mọi mảnh - trên điện thoại đã có ở đầu trang, bỏ cho đỡ chật. */}
                  {!isMobile && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-1565c0)', background: 'var(--bg-e3f2fd)', borderRadius: 4, padding: '2px 7px' }}>
                    {selectedBom?.ten}
                  </span>
                  )}
                  <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{m.tenManh}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-e65100)', background: 'var(--bg-fff3e0)', borderRadius: 4, padding: '2px 7px' }}>×{m.soLuong} / SKU</span>
                  <span style={{ fontSize: 12, color: 'var(--text3)' }}>{m.children.length} dòng vật tư</span>
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px 12px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {(() => {
                      const { isWoven, missing } = wovenStatus(m)
                      return isWoven ? (
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-2e7d32)' }}>✓ Có đan</span>
                      ) : (
                        <span
                          title={missing.length < WOVEN_GROUPS.length ? `Thiếu ${missing.map(g => GROUP_LABELS[g]).join(', ')}` : undefined}
                          style={{ fontSize: 12, color: 'var(--text3)' }}
                        >
                          Không đan
                        </span>
                      )
                    })()}
                    {isSubmitted ? (
                      <div style={{ display: 'flex', gap: 8 }}>
                        {m.needsHan && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-ef6c00)', background: 'var(--bg-fff3e0)', borderRadius: 4, padding: '2px 7px' }}>Hàn</span>}
                        {m.needsSon && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-00695c)', background: 'var(--bg-e0f2f1)', borderRadius: 4, padding: '2px 7px' }}>Sơn</span>}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 10 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text2)', cursor: 'pointer' }}>
                          <input type="checkbox" checked={m.needsHan} onChange={() => toggleManhFlag(m.id, 'needsHan')} />
                          Hàn
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text2)', cursor: 'pointer' }}>
                          <input type="checkbox" checked={m.needsSon} onChange={() => toggleManhFlag(m.id, 'needsSon')} />
                          Sơn
                        </label>
                      </div>
                    )}
                    {!isSubmitted && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => addingTo === m.id ? (setAddingTo(null), resetChildForm()) : (setAddingTo(m.id), resetChildForm())}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px',
                            border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                            background: addingTo === m.id ? 'var(--bg-e3f2fd)' : 'var(--surface)',
                            color: addingTo === m.id ? 'var(--fg-1565c0)' : 'var(--text2)',
                            cursor: 'pointer', fontSize: 12, fontWeight: 600,
                          }}>
                          <Plus size={13} /> Thêm vật tư
                        </button>
                        <button onClick={() => deleteManh(m.id)} style={{
                          padding: '5px 10px', border: '1px solid var(--fg-ffcdd2)', borderRadius: 'var(--radius)',
                          background: 'var(--bg-fff8f8)', color: 'var(--fg-c62828)', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                        }}>Xóa mảnh</button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Children: thẻ trên điện thoại (10 cột không vừa), bảng trên màn rộng */}
                {m.children.length > 0 && isMobile && (
                  <div>
                    {m.children.map((c, i) => {
                      const isEditingThis = editingChild?.manhId === m.id && editingChild.childId === c.id
                      const badge = GROUP_BADGE_COLORS[c.group]
                      const lenOrPerBar = c.group === 'sat' ? c.cutLengthMm : c.group === 'vatTuTP' ? c.piecesPerBar : ''
                      return (
                        <div key={c.id} style={{ borderTop: i > 0 ? '1px solid var(--border)' : undefined, padding: '10px 12px', background: isEditingThis ? 'var(--bg-e3f2fd)' : undefined, fontSize: 13 }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: badge.fg, background: badge.bg, borderRadius: 4, padding: '2px 7px', whiteSpace: 'nowrap', flexShrink: 0 }}>{GROUP_LABELS[c.group]}</span>
                            <div style={{ flex: 1, minWidth: 0, fontWeight: 500, wordBreak: 'break-word' }}>
                              {c.loaiSatName}
                              {c.note && <span style={{ color: 'var(--text3)', fontWeight: 400 }}> ({c.note})</span>}
                            </div>
                            {!isSubmitted && (
                              <div style={{ display: 'flex', flexShrink: 0 }}>
                                <button onClick={() => startEditChild(m.id, c)} aria-label="Sửa" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 6 }}><Pencil size={15} /></button>
                                <button onClick={() => deleteChild(m.id, c.id)} aria-label="Xóa" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 6 }}><X size={16} /></button>
                              </div>
                            )}
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginTop: 6, fontSize: 12, color: 'var(--text3)' }}>
                            {c.specs && <span>Quy cách: <b style={{ color: 'var(--text2)', fontWeight: 600 }}>{c.specs}</b></span>}
                            {lenOrPerBar && <span>{c.group === 'sat' ? 'Dài' : 'SL/đơn vị'}: <b style={{ color: 'var(--text2)', fontWeight: 600 }}>{lenOrPerBar}{c.group === 'sat' ? ' mm' : ''}</b></span>}
                            <span>SL: <b style={{ color: 'var(--text)', fontWeight: 700 }}>{c.soLuong || '—'}</b> {c.unit}</span>
                          </div>
                          {((c.group === 'sat' || c.group === 'vatTuTP') && c.processSteps.length > 0 || ((c.group === 'nutNhua' || c.group === 'vatTuThanhPham') && c.includeInWeaving) || c.photoUrl || c.photoPreview) && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4, marginTop: 6 }}>
                              {(c.group === 'sat' || c.group === 'vatTuTP') && c.processSteps.map(step => (
                                <span key={step} style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-5e35b1)', background: 'var(--bg-ede7f6)', borderRadius: 4, padding: '2px 6px' }}>{PROCESS_STEP_LABELS[step]}</span>
                              ))}
                              {(c.group === 'nutNhua' || c.group === 'vatTuThanhPham') && c.includeInWeaving && (
                                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--fg-2e7d32)', background: 'var(--bg-e8f5e9)', borderRadius: 4, padding: '1px 6px' }}>✓ Đi kèm xuất đan</span>
                              )}
                              {(c.photoUrl || c.photoPreview) && (
                                <img src={c.photoUrl || c.photoPreview} alt={c.loaiSatName} style={{ height: 32, borderRadius: 4, border: '1px solid var(--border)' }} />
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
                {m.children.length > 0 && !isMobile && (
                  <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', minWidth: 820, borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'var(--surface2)' }}>
                        <th style={{ width: 36, padding: '7px', textAlign: 'center', fontWeight: 600, color: 'var(--text2)', fontSize: 11 }}>#</th>
                        <th style={{ width: 80, padding: '7px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text2)', fontSize: 11 }}>Nhóm</th>
                        <th style={{ padding: '7px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text2)', fontSize: 11 }}>Vật tư</th>
                        <th style={{ padding: '7px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text2)', fontSize: 11 }}>Quy cách</th>
                        <th style={{ width: 110, padding: '7px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--text2)', fontSize: 11 }}>Chiều dài (mm) / Số lượng/ĐVT</th>
                        <th style={{ width: 150, padding: '7px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text2)', fontSize: 11 }}>Công đoạn phôi</th>
                        <th style={{ width: 100, padding: '7px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--text2)', fontSize: 11 }}>Số lượng</th>
                        <th style={{ width: 70, padding: '7px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text2)', fontSize: 11 }}>ĐVT</th>
                        <th style={{ width: 60, padding: '7px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text2)', fontSize: 11 }}>Ảnh</th>
                        {!isSubmitted && <th style={{ width: 64 }}></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {m.children.map((c, i) => {
                        const isEditingThis = editingChild?.manhId === m.id && editingChild.childId === c.id
                        const badge = GROUP_BADGE_COLORS[c.group]
                        return (
                          <tr key={c.id} style={{ borderTop: '1px solid var(--border)', background: isEditingThis ? 'var(--bg-e3f2fd)' : undefined }}>
                            <td style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 12, padding: '9px 7px' }}>{i + 1}</td>
                            <td style={{ padding: '9px 14px' }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: badge.fg, background: badge.bg, borderRadius: 4, padding: '2px 7px', whiteSpace: 'nowrap' }}>
                                {GROUP_LABELS[c.group]}
                              </span>
                            </td>
                            <td style={{ padding: '9px 14px', color: 'var(--text)', fontWeight: 500 }}>
                              {c.loaiSatName}
                              {c.note && <span style={{ color: 'var(--text3)', fontWeight: 400 }}> ({c.note})</span>}
                              {(c.group === 'nutNhua' || c.group === 'vatTuThanhPham') && c.includeInWeaving && (
                                <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: 'var(--fg-2e7d32)', background: 'var(--bg-e8f5e9)', borderRadius: 4, padding: '1px 6px', whiteSpace: 'nowrap' }}>
                                  ✓ Đi kèm xuất đan
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '9px 14px', color: 'var(--text3)' }}>{c.specs || '—'}</td>
                            <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text3)' }}>
                              {c.group === 'sat' ? (c.cutLengthMm || '—') : c.group === 'vatTuTP' ? (c.piecesPerBar || '—') : '—'}
                            </td>
                            <td style={{ padding: '9px 14px' }}>
                              {(c.group === 'sat' || c.group === 'vatTuTP') && c.processSteps.length > 0 ? (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                  {c.processSteps.map(step => (
                                    <span key={step} style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-5e35b1)', background: 'var(--bg-ede7f6)', borderRadius: 4, padding: '2px 6px', whiteSpace: 'nowrap' }}>
                                      {PROCESS_STEP_LABELS[step]}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span style={{ color: 'var(--text3)' }}>—</span>
                              )}
                            </td>
                            <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text)' }}>{c.soLuong || '—'}</td>
                            <td style={{ padding: '9px 14px', color: 'var(--text3)' }}>{c.unit || '—'}</td>
                            <td style={{ padding: '9px 14px' }}>
                              {(c.photoUrl || c.photoPreview) ? (
                                <img src={c.photoUrl || c.photoPreview} alt={c.loaiSatName} style={{ height: 28, borderRadius: 4, border: '1px solid var(--border)' }} />
                              ) : (
                                <span style={{ color: 'var(--text3)' }}>—</span>
                              )}
                            </td>
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
                  </div>
                )}

                {/* Add child inline */}
                {addingTo === m.id && (
                  <div style={{ padding: isMobile ? '12px' : '12px 16px', borderTop: m.children.length > 0 ? '1px dashed var(--border)' : 'none' }}>
                    {/* Chọn nhóm vật tư — quyết định materialGroupId lọc MaterialPicker và có hiện
                        Chiều dài cắt hay không (chỉ nhóm Sắt có khái niệm đoạn cắt). */}
                    <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                      {CHILD_GROUPS.map(g => (
                        <button key={g}
                          onClick={() => { setChildGroup(g); setChildMaterial(null); setChildSpec(''); setChildCutLengthMm(''); setChildProcessSteps((g === 'sat' || g === 'vatTuTP') ? ['CAT'] : []); setChildPiecesPerBar(''); setChildSoLuong(''); setChildPhotoUrl(''); setChildPhotoFile(null); setChildPhotoPreview(''); setChildIncludeInWeaving(false) }}
                          style={{
                            padding: '5px 12px', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                            border: `1px solid ${childGroup === g ? GROUP_BADGE_COLORS[g].fg : 'var(--border)'}`,
                            background: childGroup === g ? GROUP_BADGE_COLORS[g].bg : 'var(--surface)',
                            color: childGroup === g ? GROUP_BADGE_COLORS[g].fg : 'var(--text2)',
                          }}
                        >{GROUP_LABELS[g]}</button>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: isMobile ? 12 : 25, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                      <div style={isMobile ? { width: '100%' } : { width: 240 }}>
                        <FL>Vật tư (nhóm {GROUP_LABELS[childGroup]})</FL>
                        <MaterialPicker
                          value={childMaterial}
                          onSelect={m => { setChildMaterial(m); setChildSpec(m?.spec ?? '') }}
                          materialGroupId={groupIdOf(childGroup)}
                          steelSubGroup={steelSubGroupOf(childGroup)}
                          placeholder={`Chọn ${GROUP_LABELS[childGroup].toLowerCase()}…`}
                        />
                      </div>
                      <div style={fieldW(150)}>
                        <FL>Quy cách</FL>
                        <input placeholder="Theo vật tư đã chọn" value={childSpec}
                          disabled
                          style={specInputStyle} />
                      </div>
                      {childGroup === 'sat' && (
                        <div style={fieldW(120)}>
                          <FL>Chiều dài cắt (mm)</FL>
                          <input type="number" min={1} step={0.1} placeholder="930" value={childCutLengthMm}
                            onChange={e => setChildCutLengthMm(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && saveChild(m.id)}
                            style={inputStyle} />
                        </div>
                      )}
                      {childGroup === 'vatTuTP' && (
                        <div style={fieldW(120)}>
                          <FL>Số lượng/{childMaterial?.unit || 'đơn vị'}</FL>
                          <input type="number" min={1} step={1} placeholder="12" value={childPiecesPerBar}
                            onChange={e => setChildPiecesPerBar(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && saveChild(m.id)}
                            style={inputStyle} />
                        </div>
                      )}
                      {(childGroup === 'sat' || childGroup === 'vatTuTP') && (
                        <div style={{ flex: '1 1 auto', minWidth: isMobile ? '100%' : 260 }}>
                          <FL>Công đoạn phôi</FL>
                          <div style={{ display: 'flex', gap: 10, rowGap: 6, paddingTop: 4, flexWrap: 'wrap' }}>
                            {PROCESS_STEPS.map(step => (
                              <label key={step} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--text2)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                <input type="checkbox" checked={childProcessSteps.includes(step)}
                                  onChange={() => toggleChildProcessStep(step)} />
                                {PROCESS_STEP_LABELS[step]}
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                      <div style={fieldW(100)}>
                        <FL>{childGroup === 'vatTuTP' ? 'Số lượng/mảnh' : childGroup === 'day' ? 'Số lượng (KG)' : 'Số lượng'}</FL>
                        <input placeholder="0" value={childSoLuong}
                          onChange={e => setChildSoLuong(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && saveChild(m.id)}
                          style={inputStyle} />
                      </div>
                      <div style={fieldW(160)}>
                        <FL>Ghi chú</FL>
                        <input placeholder="VD: uốn, tán,..." value={childNote}
                          onChange={e => setChildNote(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && saveChild(m.id)}
                          style={inputStyle} />
                      </div>
                      {(childGroup === 'nutNhua' || childGroup === 'vatTuThanhPham') && (
                        <div>
                          <FL>Xuất đan</FL>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--text2)', cursor: 'pointer', paddingTop: 4, whiteSpace: 'nowrap' }}>
                            <input type="checkbox" checked={childIncludeInWeaving} onChange={e => setChildIncludeInWeaving(e.target.checked)} />
                            Đan
                          </label>
                        </div>
                      )}
                      {childGroup === 'day' && (
                        <div>
                          <FL>Hình ảnh</FL>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <label style={{
                              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px',
                              border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                              background: 'var(--surface)', color: 'var(--text2)', cursor: 'pointer',
                              fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
                            }}>
                              <Upload size={13} /> Chọn ảnh
                              <input type="file" accept="image/*" hidden onChange={e => onPickChildPhoto(e.target.files?.[0])} />
                            </label>
                            {(childPhotoUrl || childPhotoPreview) && (
                              <img src={childPhotoUrl || childPhotoPreview} alt="Dây" style={{ height: 32, borderRadius: 4, border: '1px solid var(--border)' }} />
                            )}
                            {childPhotoPreview && !childPhotoUrl && (
                              <span style={{ fontSize: 11, color: 'var(--text3)', fontStyle: 'italic' }}>Chưa tải lên - tải khi &quotGửi phê duyệt&quot</span>
                            )}
                          </div>
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 6 }}>
                        {(() => {
                          const childValid = !!childMaterial
                            && (childGroup !== 'sat' || childCutLengthMm.trim() !== '')
                            && (childGroup !== 'vatTuTP' || childPiecesPerBar.trim() !== '')
                          return (
                            <button onClick={() => saveChild(m.id)} disabled={!childValid} style={{
                              padding: '7px 14px', border: 'none', borderRadius: 'var(--radius)',
                              background: childValid ? 'var(--bg-1565c0)' : 'var(--bg-cccccc)',
                              color: '#fff', fontWeight: 600, fontSize: 13,
                              cursor: childValid ? 'pointer' : 'not-allowed',
                            }}>{editingChild?.manhId === m.id ? 'Lưu' : '+ Thêm'}</button>
                          )
                        })()}
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
              marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10,
              padding: '12px 16px', background: 'var(--surface)',
              border: `1px solid ${
                manhSt === 'approved' && !isAdmin ? 'var(--fg-a5d6a7)'
                : manhSt === 'pending' && !isAdmin ? 'var(--fg-ffe082)'
                : 'var(--border)'
              }`,
              borderRadius: 'var(--radius-lg)',
            }}>
              {manhSt === 'approved' && !isAdmin ? (
                <>
                  <span style={{ fontSize: 13, color: 'var(--fg-2e7d32)', fontWeight: 600 }}>
                    ✓ Đã được duyệt
                  </span>
                  <button onClick={() => setSelectedBom(null)} style={{
                    padding: '7px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                    background: 'var(--surface)', cursor: 'pointer', fontSize: 13, color: 'var(--text2)',
                  }}>Quay lại danh sách</button>
                </>
              ) : manhSt === 'pending' && !isAdmin ? (
                <>
                  <span style={{ fontSize: 13, color: 'var(--fg-e65100)', fontWeight: 600 }}>
                    ⏳ Đã gửi phê duyệt — đang chờ quản lý xác nhận
                  </span>
                  <button onClick={() => setSelectedBom(null)} style={{
                    padding: '7px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                    background: 'var(--surface)', cursor: 'pointer', fontSize: 13, color: 'var(--text2)',
                  }}>Quay lại danh sách</button>
                </>
              ) : (
                <>
                  {submitManhError && (
                    <span style={{ fontSize: 12, color: 'var(--fg-c62828)', flex: '1 1 100%' }}>{submitManhError}</span>
                  )}
                  {isAdmin && (manhSt === 'approved' || manhSt === 'pending') && (
                    <span style={{ fontSize: 12, color: 'var(--fg-e65100)', flex: '1 1 100%' }}>
                      ⚠ SKU này đã {manhSt === 'approved' ? 'được duyệt' : 'nộp, đang chờ duyệt'} — sửa và gửi sẽ ghi đè trực tiếp, không cần duyệt lại.
                    </span>
                  )}
                  <span style={{ fontSize: 13, color: 'var(--text2)' }}>
                    {manhs.length} mảnh · {totalChildren} dòng vật tư
                  </span>
                  {/* Giờ tạm lưu + 2 nút gom sát nhau 1 cụm (thay vì rải đều theo space-between
                      của cha) - theo yêu cầu người dùng, dễ liên hệ "tạm lưu" với "gửi phê duyệt". */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    {lastSavedAt && (
                      <span style={{ fontSize: 11, color: 'var(--text3)' }}>Đã tạm lưu lúc {new Date(lastSavedAt).toLocaleTimeString('vi-VN')}</span>
                    )}
                    <button
                      onClick={manualSaveDraft}
                      disabled={savingDraft}
                      title="Lưu tạm trên máy này - chưa gửi phê duyệt, mở lại trang là thấy lại ngay"
                      style={{
                        padding: '7px 16px', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                        background: 'var(--surface)', color: 'var(--text2)', fontWeight: 600, fontSize: 13,
                        cursor: savingDraft ? 'not-allowed' : 'pointer', opacity: savingDraft ? 0.7 : 1,
                      }}
                    >{savingDraft ? 'Đang lưu...' : 'Tạm lưu'}</button>
                    <button
                      onClick={submitManh}
                      disabled={totalChildren === 0 || savingManh}
                      style={{
                        padding: '7px 20px', border: 'none', borderRadius: 'var(--radius)',
                        background: totalChildren > 0 ? 'var(--bg-1565c0)' : 'var(--bg-cccccc)',
                        color: '#fff', fontWeight: 700, fontSize: 13,
                        cursor: totalChildren > 0 && !savingManh ? 'pointer' : 'not-allowed',
                        opacity: savingManh ? 0.7 : 1,
                      }}
                    >{savingManh ? 'Đang gửi...' : (manhSt === 'approved' && isAdmin) ? 'Ghi đè định mức →' : 'Gửi phê duyệt →'}</button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══ CATALOG VẬT TƯ (Material thật, 5 nhóm — quản lý ở Admin > Vật tư) ══ */}
      {subTab === 'catalog' && (
        <div>
          {/* 6 tab nhóm: cuộn ngang trên điện thoại thay vì tràn trang */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
            {CHILD_GROUPS.map(g => (
              <button
                key={g}
                onClick={() => { setCatalogGroup(g); setCatalogSearch('') }}
                style={{
                  padding: isMobile ? '9px 12px' : '9px 18px', border: 'none', background: 'none', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                  fontSize: 13, fontWeight: 600, color: catalogGroup === g ? 'var(--fg-1565c0)' : 'var(--text3)',
                  borderBottom: catalogGroup === g ? '2px solid var(--fg-1565c0)' : '2px solid transparent',
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
              style={{ width: '100%', maxWidth: 320, padding: '7px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text)', outline: 'none' }}
            />
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflowX: 'auto' }}>
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
