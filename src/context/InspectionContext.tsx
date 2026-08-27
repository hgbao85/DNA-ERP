'use client'
import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import type { WarehouseScope } from './AuthContext'
import { useAuth } from './AuthContext'
import {
  getPurchaseProposals as fetchPurchaseProposals,
  acknowledgeProposal as acknowledgeProposalApi,
  saveProposalQuotes as saveProposalQuotesApi,
  submitProposalToDirector as submitProposalToDirectorApi,
  approveProposal as approveProposalApi,
  rejectProposal as rejectProposalApi,
  requoteProposal as requoteProposalApi,
  receiveProposalItem as receiveProposalItemApi,
} from '../services/purchasing-api'

// ── Types ──────────────────────────────────────────────────────────────────────

// Kho phụ trách của từng nhóm vật tư — dùng để gán nhãn hiển thị (khoLabel) cho từng dòng đề
// xuất mua, xem purchasing-api.ts#toItem(). KHÔNG dùng để route tới tài khoản Purchasing (đã
// chuyển sang gán theo từng vật tư - Material.buyerId, xem src/utils/purchasingRouting.ts).
export type KhoKey = 'phoiSonHan' | 'vatTuTP' | 'thanhPham'

// State machine dùng chung cho cả PurchaseProposal.status (nay CHỈ còn là giá trị ROLLUP suy ra
// từ items) và PurchaseProposalItem.status (nguồn sự thật thật sự từ 2026-08-25, "duyệt riêng
// từng người mua hàng" - xem plan abstract-soaring-rivest). Tách type riêng để 2 field dùng
// chung 1 định nghĩa thay vì PurchaseProposalItem phải tham chiếu ngược PurchaseProposal['status'].
export type ProposalStatus = 'new' | 'quoting' | 'submitted' | 'purchasing' | 'purchased' | 'rejected'

export interface PurchaseProposalItem {
  name: string
  unit: string
  // Đơn vị mua hàng từ NCC (vd "kg") khi khác `unit` + hệ số quy đổi (số unit / 1 purchaseUnit,
  // vd 250 = 250 cái/kg) - null nếu vật tư chỉ có 1 đơn vị. Xem Material.purchaseUnit (BE).
  purchaseUnit?: string | null
  khoUnitFactor?: number | null
  required: number
  actualStock: number
  buyQty: number
  /** Chiều dài cây phải đặt (mm) - CHỈ có ở vật tư sắt (2026-08-26, sau khi Sếp mở lại auto_scan:
   *  solver có thể đề xuất cây KHÁC 6000mm mặc định). undefined/null cho nhánh kiểm tra vật tư
   *  thường - không có khái niệm chiều dài cây. Xem BE PurchaseProposalItem.stockLengthMm. */
  stockLengthMm?: number | null
  khoKey: KhoKey
  khoLabel: string
  materialId?: number
  /** BE PurchaseProposalItem.id thật (A5, 2026-08-15) - đã có sẵn trong state từ lúc đọc danh
   *  sách/chi tiết, KHÔNG cần GET riêng để dịch materialId -> itemId nữa (xem purchasing-api.ts
   *  D.a5-n-plus-one). Optional để tương thích ngược, mọi item đọc từ BE thật đều có. */
  itemId?: string
  receivedQty?: number // luỹ kế thủ kho đã xác nhận nhận về, so với buyQty để biết đã đủ chưa
  receivedQtyPurchaseUnit?: number | null // luỹ kế theo purchaseUnit (vd kg) - chỉ để đối chiếu
  /** Trạng thái CỦA RIÊNG DÒNG NÀY (2026-08-25) - nguồn sự thật cho mọi gate nghiệp vụ (báo giá,
   *  gửi Sếp, duyệt, từ chối, nhận hàng). `PurchaseProposal.status` giờ chỉ còn là rollup hiển thị
   *  tổng quát - KHÔNG dùng để quyết định 1 dòng vật tư cụ thể làm được gì, vì 1 đề xuất gộp có
   *  thể có vật tư của nhiều người mua hàng ở nhiều trạng thái khác nhau cùng lúc (Nhàn đã
   *  SUBMITTED trong khi Trâm còn QUOTING). Mặc định 'new' cho item cũ/mock chưa có field này. */
  status: ProposalStatus
  submittedAt?: string
  approvedAt?: string
  rejectedAt?: string
  rejectionReason?: string
  purchasedAt?: string
}

export interface ProposalQuote {
  /** Id báo giá thật (PurchaseProposalQuote.id, BE) - CHỈ có khi quote này đã tồn tại ở BE (đọc
   *  về từ getPurchaseProposal); quote đang soạn ở LenhMuaNCCPage (chưa submit) thì chưa có id.
   *  Sếp chọn NCC PHẢI dùng field này (không dùng supplierName) - xem BossApp.tsx, tránh khớp
   *  nhầm khi 2 báo giá trùng tên NCC hoặc còn bản báo giá cũ chưa dọn (D.h3-quote-id-not-name). */
  id?: string
  supplierName: string
  /** Id NCC thật (khi chọn từ danh sách đã đăng ký, xem SupplierPicker) - optional để tương thích
   *  dữ liệu cũ trước khi có field này; luôn ưu tiên so khớp bằng id, chỉ dùng supplierName để
   *  hiển thị/tương thích ngược. */
  supplierId?: string
  unitPrice: number | null
  expectedDate?: string
  note?: string
  /** Báo giá này có phải cái Sếp đã duyệt không (BE PurchaseProposalQuote.isChosen). Chỉ có ý
   *  nghĩa với quote đọc về từ BE; dòng đang soạn ở LenhMuaNCCPage chưa có. Mọi màn cần "đơn giá
   *  đã duyệt" PHẢI lọc bằng field này - so khớp theo supplierName là sai (2 báo giá có thể trùng
   *  tên NCC, BE không cấm), xem TheoDoiMuaHangPage (D.a2-price-by-name). */
  isChosen?: boolean
}

export interface PurchaseProposal {
  id: string           // `prop-${requestId}-${khoKey}`
  requestId: string
  skuId: number
  /** Mã lệnh SX NỘI BỘ (BE ProductionOrder.poNumber) - chỉ hệ thống dùng để tra cứu, KHÔNG hiển
   *  thị cho người dùng nữa. Cột "PO" trên UI dùng `salesOrderCode` bên dưới thay thế. */
  poNumber: string
  /** Mã đơn hàng Sales gốc (SalesOrder.code, vd "PO-31") - đây mới là mã "PO" hiện trên UI. null
   *  khi SKU không gắn đơn Sales nào (tạo tay); có thể là danh sách nhiều mã nối bằng ", " ở
   *  nhánh PI gộp (nhiều đơn Sales trong cùng 1 đợt cắt chung). */
  salesOrderCode: string | null
  /** Mã ProductionInvoice ("PI-2026-001") lệnh SX/PI gộp phía trên thuộc về - KHÁC poNumber (2 bộ
   *  đếm độc lập, ProductionOrder vs ProductionInvoice) dù cùng hiển thị cạnh nhau trên UI. */
  piCode: string
  skuCode: string
  skuName?: string
  createdAt: string
  // 1 đề xuất chỉ thuộc đúng 1 kho — dùng để route tới Purchasing phụ trách kho đó
  // (so khớp với user.warehouseScope, xem src/utils/purchasingRouting.ts).
  warehouseScope: WarehouseScope
  items: PurchaseProposalItem[]
  status: ProposalStatus
  // Key = item.itemId (PurchaseProposalItem.id thật) — KHÔNG phải materialId lẫn item.name.
  // Lịch sử: từng key theo tên (trùng tên hiển thị đè mất nhau, sửa 2026-08-13), rồi theo
  // materialId, rồi materialId cũng KHÔNG còn duy nhất trong 1 đề xuất từ khi 1 vật tư đã
  // PURCHASED phát sinh thiếu thêm có thể tách thành DÒNG MỚI cùng materialId (sửa 2026-08-26,
  // L6) - xem purchasing-api.ts đầu file.
  quotes?: Record<string, ProposalQuote[]>  // keyed by item.itemId → multiple NCC offers
  chosenSuppliers?: Record<string, string>  // item.itemId → chosen supplierName (set by boss)
  deadline?: string
  submittedAt?: string
  approvedAt?: string
  rejectedAt?: string
  rejectionReason?: string
  purchasedAt?: string // lúc mọi item đã nhận đủ (receivedQty >= buyQty)
}

// Nhãn + màu hiển thị theo status — cấu hình dùng chung cho mọi màn đọc PurchaseProposal.status
// (ProposalSection, màn theo dõi của KHSX...), tránh mỗi nơi tự hardcode 1 bảng if-chain riêng.
export const PROPOSAL_STATUS_LABELS: Record<PurchaseProposal['status'], { label: string; color: string; bg: string; border: string }> = {
  new:        { label: 'Chờ báo giá',   color: '#92400e', bg: '#fef3c7', border: '#fde68a' },
  quoting:    { label: 'Đang báo giá',  color: '#1e40af', bg: '#dbeafe', border: '#93c5fd' },
  submitted:  { label: 'Chờ duyệt',     color: '#7c3aed', bg: '#ede9fe', border: '#c4b5fd' },
  purchasing: { label: 'Đang mua hàng', color: '#92400e', bg: '#fef3c7', border: '#fde68a' },
  purchased:  { label: 'Đã mua',        color: '#166534', bg: '#dcfce7', border: '#86efac' },
  rejected:   { label: 'Từ chối',       color: '#991b1b', bg: '#fee2e2', border: '#fca5a5' },
}

// Mọi mutation trả Promise và NÉM LẠI lỗi sau khi đã hiện banner (xem InspectionProvider).
// Trước 2026-08-15 chúng là `=> void` kết thúc bằng `.catch(console.error)`: thao tác thất bại
// trông y hệt thao tác thành công, kể cả trên chứng từ nhập kho (D.a1-silent-write-failure).
// Call site KHÔNG bắt buộc phải await - không await thì vẫn có banner như cũ; await chỉ cần ở
// chỗ có state phải rollback (vd NhapKhoPage xoá ô nhập sau khi xác nhận).
interface InspCtxType {
  proposals: PurchaseProposal[]
  /** Lỗi của thao tác ghi gần nhất - `ActionErrorBanner` đọc, `dismissActionError()` xoá. */
  actionError: string | null
  dismissActionError:      () => void
  acknowledgeProposal:     (proposalId: string) => Promise<void>
  /** Lưu báo giá KHÔNG gửi Sếp duyệt - trả về đề xuất đã cập nhật để call site tự re-seed lại
   *  form nhập liệu với `quote.id` thật (tránh gửi trùng dòng ở lượt lưu tiếp theo, xem
   *  purchasing-api.ts#postNewQuotes). */
  saveProposalQuotes:      (proposalId: string, quotes: Record<string, ProposalQuote[]>) => Promise<PurchaseProposal>
  submitProposalToDirector:(proposalId: string, quotes: Record<string, ProposalQuote[]>) => Promise<void>
  approveProposal:         (proposalId: string, chosenQuoteIdByItemKey: Record<string, string>) => Promise<void>
  /** `itemIds` (2026-08-25) - Sếp chỉ từ chối đúng batch item đang SUBMITTED mà mình đang xem
   *  (BossApp truyền id các dòng "submittedItems" của đúng đề xuất này) - không truyền thì BE áp
   *  dụng cho MỌI item đang SUBMITTED của đề xuất (tương thích ngược). */
  rejectProposal:          (proposalId: string, reason: string, itemIds?: string[]) => Promise<void>
  requoteProposal:         (proposalId: string) => Promise<void>
  receiveProposalItem:     (proposalId: string, itemKey: string, qty: number, receivedQtyPurchaseUnit?: number) => Promise<void>
}

// ── Context ────────────────────────────────────────────────────────────────────
// proposals (PurchaseProposal) đã cutover sang BE thật (Phase 8, xem services/purchasing-api.ts)
// - tự sinh từ CuttingProposal đã duyệt.

const InspCtx = createContext<InspCtxType | undefined>(undefined)

export function InspectionProvider({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuth()
  const [proposals, setProposals] = useState<PurchaseProposal[]>([])
  const [actionError, setActionError] = useState<string | null>(null)
  const dismissActionError = useCallback(() => setActionError(null), [])

  // InspectionProvider bọc TOÀN BỘ app ở layout.tsx (kể cả /login, trước khi có token) - chỉ gọi
  // API khi đã đăng nhập, tránh bắn request chắc chắn 401 (không có token) ngay trên màn hình
  // đăng nhập. `token` chỉ có sau khi AuthProvider khôi phục xong phiên (xem AuthContext.tsx).
  //
  // Bỏ qua khi user có mfgRole (Sản xuất tại xưởng: QLSX/Phôi/Hàn/Sơn/KCS/Spec, dùng MfgApp) -
  // phát hiện qua browser thật 2026-08-13: không role nào trong nhóm này có PURCHASE_PROPOSAL:VIEW
  // ở BE (đề xuất mua là việc của KHSX/Mua hàng/Sếp, xem role-permissions.constant.ts), nên lời
  // gọi này luôn 403 âm thầm cho toàn bộ nhóm role này - không chỉ PHOI/KCS vừa kiểm tra qua browser.
  useEffect(() => {
    if (!token || user?.mfgRole) return
    // Audit 2026-08-20 (Medium "FE hard-code limit=100"): 1 fetch top-100 theo createdAt duy nhất
    // trước đây khiến phiếu ĐANG XỬ LÝ cũ (new/quoting/submitted/purchasing/rejected) có thể bị
    // đẩy khỏi trang bởi phiếu 'purchased' tích luỹ vô hạn theo thời gian - toàn bộ màn Mua hàng
    // (Lệnh mua NCC/Theo dõi mua hàng/Nhập kho) đều đọc chung `proposals` này nên mất dấu phiếu là
    // mất luôn khả năng xử lý, không chỉ mất lịch sử. Giờ gọi song song: `active` (activeOnly=true,
    // BE lọc where PURCHASED - đảm bảo không phiếu đang xử lý nào bị cắt) + `history` (hành vi cũ,
    // top-100 chấp nhận cắt cụt vì chỉ phục vụ tra cứu "Lịch sử đã mua"), rồi merge theo id (ưu
    // tiên bản ghi từ `active` - luôn mới nhất vì không cạnh tranh chỗ).
    Promise.all([fetchPurchaseProposals({ activeOnly: true }), fetchPurchaseProposals()])
      .then(([active, history]) => {
        const byId = new Map(history.map(p => [p.id, p]))
        for (const p of active) byId.set(p.id, p)
        setProposals([...byId.values()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)))
      })
      .catch((err: unknown) => {
        // 403 = vai này không có PURCHASE_PROPOSAL:VIEW (Phôi/Hàn/Sơn/KCS/SPEC... - xem
        // role-permissions.constant.ts). Provider bọc TOÀN BỘ app nên request vẫn bắn cho mọi
        // vai vừa đăng nhập; đây là kết quả ĐÚNG với các vai đó, không phải lỗi -> để danh sách
        // rỗng, không log. Vẫn log mọi lỗi khác (mạng/500) để không giấu sự cố thật.
        if ((err as { statusCode?: number })?.statusCode === 403) return
        console.error('getPurchaseProposals failed', err)
      })
  }, [token, user?.mfgRole])

  // Bọc mọi thao tác GHI: hiện lỗi cho người dùng rồi NÉM LẠI. Ném lại là phần quan trọng -
  // nếu chỉ nuốt thì call site không phân biệt được thành công/thất bại để rollback state cục bộ
  // (xem NhapKhoPage.confirmItem xoá ô nhập). Xoá lỗi cũ trước mỗi lượt để banner luôn ứng với
  // thao tác vừa bấm, không phải lỗi tồn từ lần trước.
  const runAction = useCallback(async <T,>(label: string, fn: () => Promise<T>): Promise<T> => {
    setActionError(null)
    try {
      return await fn()
    } catch (err) {
      setActionError(`${label} thất bại: ${err instanceof Error ? err.message : String(err)}`)
      throw err
    }
  }, [])

  const acknowledgeProposal = useCallback((proposalId: string) =>
    runAction('Tiếp nhận đề xuất', async () => {
      const updated = await acknowledgeProposalApi(proposalId)
      setProposals(prev => prev.map(p => p.id === proposalId ? updated : p))
    }), [runAction])

  const saveProposalQuotes = useCallback((proposalId: string, quotes: Record<string, ProposalQuote[]>) =>
    runAction('Lưu báo giá', async () => {
      const current = proposals.find(p => p.id === proposalId)
      if (!current) throw new Error('Không tìm thấy đề xuất trong danh sách - hãy tải lại trang')
      const updated = await saveProposalQuotesApi(current, quotes)
      setProposals(prev => prev.map(p => p.id === proposalId ? updated : p))
      return updated
    }), [proposals, runAction])

  const submitProposalToDirector = useCallback((proposalId: string, quotes: Record<string, ProposalQuote[]>) =>
    runAction('Gửi Sếp duyệt', async () => {
      const current = proposals.find(p => p.id === proposalId)
      // Ném thay vì `return` im lặng: gửi báo giá mà đề xuất không còn trong state là bất thường
      // (đã bị người khác xử lý, hoặc list chưa load xong) - người dùng cần biết để tải lại.
      if (!current) throw new Error('Không tìm thấy đề xuất trong danh sách - hãy tải lại trang')
      const updated = await submitProposalToDirectorApi(current, quotes)
      setProposals(prev => prev.map(p => p.id === proposalId ? updated : p))
    }), [proposals, runAction])

  const approveProposal = useCallback((proposalId: string, chosenQuoteIdByItemKey: Record<string, string>) =>
    runAction('Duyệt đề xuất mua', async () => {
      const current = proposals.find(p => p.id === proposalId)
      if (!current) throw new Error('Không tìm thấy đề xuất trong danh sách - hãy tải lại trang')
      const updated = await approveProposalApi(current, chosenQuoteIdByItemKey)
      setProposals(prev => prev.map(p => p.id === proposalId ? updated : p))
    }), [proposals, runAction])

  const rejectProposal = useCallback((proposalId: string, reason: string, itemIds?: string[]) =>
    runAction('Từ chối đề xuất mua', async () => {
      const updated = await rejectProposalApi(proposalId, reason, itemIds)
      setProposals(prev => prev.map(p => p.id === proposalId ? updated : p))
    }), [runAction])

  // Mở lại luồng báo giá sau khi bị từ chối. LƯU Ý: BE XOÁ SẠCH báo giá cũ (requote() chạy
  // purchaseProposalQuote.deleteMany - "không giữ làm lịch sử nữa", đổi 2026-08-11); FE tự seed
  // lại giá trị cũ vào form TRƯỚC khi gọi (LenhMuaNCCPage.handleRequote) nên màn hình không mất
  // gì, nhưng bản ghi DB thì mất thật. BE tự ghi lại toàn bộ báo giá đã xoá vào audit_logs trước
  // khi xoá (PurchaseProposalsService.requote -> auditQuoteDecision) nên vẫn truy được ở màn
  // "Hoạt động" (PurchaseProposalAuditTrail), dù không còn trong bảng sống.
  const requoteProposal = useCallback((proposalId: string) =>
    runAction('Mở lại báo giá', async () => {
      const updated = await requoteProposalApi(proposalId)
      setProposals(prev => prev.map(p => p.id === proposalId ? updated : p))
    }), [runAction])

  // Thủ kho xác nhận đã nhận hàng — cộng dồn qua nhiều lần nhập (hàng có thể về nhiều đợt) ở
  // tầng BE (xem PurchaseProposalsService.receiveItem), tự chuyển 'purchasing' -> 'purchased'
  // khi mọi item đã nhận đủ buyQty.
  const receiveProposalItem = useCallback((proposalId: string, itemKey: string, qty: number, receivedQtyPurchaseUnit?: number) =>
    runAction('Xác nhận nhận hàng', async () => {
      const current = proposals.find(p => p.id === proposalId)
      if (!current) throw new Error('Không tìm thấy đề xuất trong danh sách - hãy tải lại trang')
      const updated = await receiveProposalItemApi(current, itemKey, qty, receivedQtyPurchaseUnit)
      setProposals(prev => prev.map(p => p.id === proposalId ? updated : p))
    }), [proposals, runAction])

  return (
    <InspCtx.Provider value={{ proposals, actionError, dismissActionError, acknowledgeProposal, saveProposalQuotes, submitProposalToDirector, approveProposal, rejectProposal, requoteProposal, receiveProposalItem }}>
      <ActionErrorBanner message={actionError} onDismiss={dismissActionError} />
      {children}
    </InspCtx.Provider>
  )
}

/**
 * Banner lỗi dùng chung cho mọi thao tác ghi của luồng Mua hàng/Nhập kho. Cố ý là một component
 * nhỏ tại chỗ thay vì kéo thêm thư viện toast: chỉ có đúng một luồng cần nó, và thất bại trên
 * chứng từ kho/tiền thì nên đứng yên cho người dùng đọc chứ không nên tự tắt sau vài giây.
 */
function ActionErrorBanner({ message, onDismiss }: { message: string | null; onDismiss: () => void }) {
  if (!message) return null
  return (
    <div
      role="alert"
      style={{
        position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 9999,
        display: 'flex', alignItems: 'flex-start', gap: 12, maxWidth: 560,
        padding: '12px 16px', borderRadius: 10,
        background: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b',
        boxShadow: '0 6px 20px rgba(0,0,0,.15)', fontSize: 13, lineHeight: 1.5,
      }}
    >
      <span style={{ fontWeight: 700 }}>⚠</span>
      <span style={{ flex: 1, fontWeight: 500 }}>{message}</span>
      <button
        onClick={onDismiss}
        aria-label="Đóng thông báo lỗi"
        style={{ border: 'none', background: 'transparent', color: '#991b1b', cursor: 'pointer', fontSize: 16, fontWeight: 700, lineHeight: 1, padding: 0 }}
      >×</button>
    </div>
  )
}

export function useInspection(): InspCtxType {
  const ctx = useContext(InspCtx)
  if (!ctx) throw new Error('useInspection must be used inside InspectionProvider')
  return ctx
}
