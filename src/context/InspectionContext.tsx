'use client'
import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import type { WarehouseScope } from './AuthContext'
import { useAuth } from './AuthContext'
import {
  getPurchaseProposals as fetchPurchaseProposals,
  bossApproveProposal as bossApproveProposalApi,
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
  /** File phiếu Sếp đã KÝ TAY duyệt lô mua này (2026-08-27) - ảnh chụp/PDF scan/Excel, xem
   *  services/uploads-api.ts#uploadDocument. Từ đợt này việc so sánh giá + phê duyệt diễn ra NGOÀI
   *  phần mềm nên đây là bằng chứng duy nhất trong hệ thống cho "đã được duyệt mua"; giá và NCC
   *  nằm trong chính file, cố ý không tách ra field riêng (Sếp chốt). undefined = dòng duyệt theo
   *  luồng cũ (qua màn So sánh giá của Sếp, đã gỡ). */
  approvalFileUrl?: string
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
  deadline?: string
  submittedAt?: string
  approvedAt?: string
  rejectedAt?: string
  rejectionReason?: string
  purchasedAt?: string // lúc mọi item đã nhận đủ (receivedQty >= buyQty)
}

// Nhãn + màu hiển thị theo status — cấu hình dùng chung cho mọi màn đọc PurchaseProposal.status
// (ProposalSection, màn theo dõi của KHSX...), tránh mỗi nơi tự hardcode 1 bảng if-chain riêng.
// 'quoting'/'submitted'/'rejected' chỉ còn xuất hiện ở DỮ LIỆU CŨ (luồng báo giá gỡ 2026-08-27) -
// giữ nhãn để màn hình không hiện trạng thái trống cho các dòng đó, nhưng không đường nào sinh mới.
export const PROPOSAL_STATUS_LABELS: Record<PurchaseProposal['status'], { label: string; color: string; bg: string; border: string }> = {
  new:        { label: 'Chờ Sếp duyệt', color: '#92400e', bg: '#fef3c7', border: '#fde68a' },
  quoting:    { label: 'Chờ Sếp duyệt', color: '#92400e', bg: '#fef3c7', border: '#fde68a' },
  submitted:  { label: 'Chờ Sếp duyệt', color: '#92400e', bg: '#fef3c7', border: '#fde68a' },
  purchasing: { label: 'Đang mua hàng', color: '#92400e', bg: '#fef3c7', border: '#fde68a' },
  purchased:  { label: 'Đã mua',        color: '#166534', bg: '#dcfce7', border: '#86efac' },
  rejected:   { label: 'Chờ Sếp duyệt', color: '#92400e', bg: '#fef3c7', border: '#fca5a5' },
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
  /** Mua hàng xác nhận "Sếp đã duyệt" kèm file phiếu đã ký (2026-08-27) - thay cho cả chuỗi
   *  acknowledge/báo giá/gửi Sếp/Sếp duyệt đã gỡ. BE tự lọc đúng phần vật tư của actor. */
  bossApproveProposal:     (proposalId: string, approvalFileUrl: string) => Promise<void>
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

  // Mua hàng bấm "Sếp đã duyệt" sau khi upload phiếu Sếp ký tay (2026-08-27). BE đẩy đúng phần vật
  // tư của actor sang 'purchasing' - kể cả dòng còn kẹt ở trạng thái của luồng báo giá cũ, xem
  // PurchaseProposalsService.bossApprove().
  const bossApproveProposal = useCallback((proposalId: string, approvalFileUrl: string) =>
    runAction('Xác nhận Sếp đã duyệt', async () => {
      const updated = await bossApproveProposalApi(proposalId, approvalFileUrl)
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
    <InspCtx.Provider value={{ proposals, actionError, dismissActionError, bossApproveProposal, receiveProposalItem }}>
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
