'use client'
import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { useRealtimeRefetch } from '../realtime/hooks'
import type { WarehouseScope } from './AuthContext'
import { useAuth } from './AuthContext'
import {
  getPurchaseProposals as fetchPurchaseProposals,
  getPurchaseProposal,
  updateProposalItemApprovalFile as updateProposalItemApprovalFileApi,
  updateProposalItemOrderQty as updateProposalItemOrderQtyApi,
} from '../services/purchasing-api'
import {
  createPurchaseReceipt as createPurchaseReceiptApi,
  rejectPurchaseReceipt as rejectPurchaseReceiptApi,
  type CreatePurchaseReceiptInput,
  type PurchaseReceiptResult,
  type RejectPurchaseReceiptInput,
} from '../services/purchase-receipts-api'
import {
  approveSupplierOrder as approveSupplierOrderApi,
  cancelSupplierOrder as cancelSupplierOrderApi,
  createSupplierOrder as createSupplierOrderApi,
  removeSupplierOrderItem as removeSupplierOrderItemApi,
  reviseSupplierOrder as reviseSupplierOrderApi,
  closeSupplierOrderShortage as closeSupplierOrderShortageApi,
} from '../services/supplier-orders-api'

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

/** 1 lần nhận hàng thực tế (2026-10-16) - thay cho hệ số quy đổi cố định Material.purchaseUnit/
 *  khoUnitFactor đã xoá: Ô1 (unitRateQty) × Ô2 (supplierUnitQty) nhập tay mỗi lô, backend tự
 *  nhân ra receivedQty. Xem NhapKhoPage.tsx. */
export interface PurchaseReceiptLog {
  id: string
  unitRateQty: number
  supplierUnitQty: number
  receivedQty: number
  receiptFileUrl?: string | null
  receivedByName?: string | null
  receivedAt: string
  /** Phiếu nhận chứa lần nhận này (Đợt 5d) - null với lịch sử nhận trước Đợt 5d. */
  receiptId?: string | null
  /** Tổng của cả phiếu - đơn gộp thì lần nhận của dòng này chỉ là 1 phần chia. */
  receiptTotalQty?: number | null
  /** Số phiếu nhập NK của phiếu chứa lần nhận này (11/11/2026). */
  receiptCode?: string | null
  allocationAdjusted?: boolean
  /** 4 ô chứng từ (YC4): phiếu giao NCC, phiếu đề xuất Giám đốc ký, phiếu nhập kho, phiếu cân xe. */
  supplierSlipUrls?: string[]
  approvalFileUrls?: string[]
  receiptSlipUrls?: string[]
  weighSlipUrls?: string[]
  /** Nhận vượt của cả phiếu (Đợt 5e, 4.12). */
  overQty?: number
  overReason?: string | null
  overFileUrls?: string[]
}

export interface PurchaseProposalItem {
  name: string
  /** Mã vật tư (in phiếu nhập kho, Đợt 6). */
  materialCode?: string
  /** Quy cách vật tư (Material.spec, vd "10x29x0.8") - đối chiếu hàng về đúng quy cách đã đặt,
   *  nhất là vật tư trùng tên khác kích cỡ (2026-09-15). */
  spec?: string | null
  unit: string
  /** % dự trù hao hụt khi mua (Material.purchaseWastePercentage) - LIVE theo Material hiện tại,
   *  không snapshot (2026-10-08). Đã được BE cộng vào `buyQty` rồi - field này chỉ để hiển thị
   *  giải thích vì sao buyQty cao hơn nhu cầu gốc. null = chưa cấu hình % (hoặc Sắt phần mềm). */
  purchaseWastePercentage?: number | null
  /** Vật tư nhóm Sắt - nhận hàng bắt buộc thêm ảnh phiếu cân xe (Đợt 5d, bản v8 4.6). */
  isSteel?: boolean
  /** File phiếu đề xuất Giám đốc ký của đơn đặt hàng chứa dòng này - Nhập kho tự dùng làm chứng từ (Đợt 5d). */
  supplierOrderApprovalFileUrl?: string | null
  required: number
  actualStock: number
  buyQty: number
  /** "Số mua" người mua đã chốt (2026-11-04, YC7 mục 7.2) - chỉ được tăng so với `buyQty` (cần mua)
   *  cho tròn số tối thiểu NCC bán; null = mua đúng số cần mua. Khoá sau khi "Sếp đã duyệt". */
  orderQty?: number | null
  /** Số thực mua = max(buyQty, orderQty) - dòng đóng hồ sơ khi nhận đủ số này. Mua dư = purchaseQty − buyQty. */
  purchaseQty: number
  /** Đơn đặt hàng NCC chứa dòng này (2026-11-04, bản v8 mục 4.10) - null = chưa vào đơn nào.
   *  "Sếp đã duyệt" làm theo đơn, nên dòng phải vào đơn (chọn NCC) trước. */
  supplierOrderId?: string | null
  /** "Số đơn đặt hàng" dạng "52/2026", đánh theo từng NCC + năm. */
  supplierOrderCode?: string | null
  supplierOrderStatus?: string | null
  supplierName?: string | null
  /** Chiều dài cây phải đặt (mm) - CHỈ có ở vật tư sắt (2026-08-26, sau khi Sếp mở lại auto_scan:
   *  solver có thể đề xuất cây KHÁC 6000mm mặc định). undefined/null cho nhánh kiểm tra vật tư
   *  thường - không có khái niệm chiều dài cây. Xem BE PurchaseProposalItem.stockLengthMm. */
  stockLengthMm?: number | null
  /** Hạn hàng phải về của RIÊNG dòng này theo nhóm vật tư (VT khung & đan / VT còn lại) - cùng hạn với Bảng mốc / tin sáng
   *  (2026-10-29, BE changelog 2026-09-25 mục 32.27). Thiếu thì dùng hạn cấp đề xuất. */
  deadline?: string
  khoKey: KhoKey
  khoLabel: string
  /** Mã kho THẬT nhận hàng của riêng dòng này (BE PurchaseProposalItemResponseDto.warehouseCode,
   *  '—' nếu BE trả null) - nguồn xác thực cho NhapKhoPage#itemInScope() lọc đúng thủ kho được
   *  nhận, khác `khoKey` (chỉ 3 giá trị họ kho, không phân biệt được kho phụ dạng
   *  '{họ}-{n}' như "Kho thành phẩm 2" với kho gốc cùng họ, xem warehouseFamily.ts). */
  warehouseCode: string
  materialId?: number
  /** BE PurchaseProposalItem.id thật (A5, 2026-08-15) - đã có sẵn trong state từ lúc đọc danh
   *  sách/chi tiết, KHÔNG cần GET riêng để dịch materialId -> itemId nữa (xem purchasing-api.ts
   *  D.a5-n-plus-one). Optional để tương thích ngược, mọi item đọc từ BE thật đều có. */
  itemId?: string
  receivedQty?: number // luỹ kế thủ kho đã xác nhận nhận về, so với buyQty để biết đã đủ chưa
  /** Luỹ kế "Ô2" (supplierUnitQty) qua các lần nhận - chỉ để đối chiếu/audit tổng số lượng theo
   *  đơn vị bên bán. Xem receiptLogs bên dưới để biết chi tiết từng lô. */
  receivedQtyPurchaseUnit?: number | null
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
  /** Lịch sử từng lần nhận hàng (2026-10-16), mới nhất trước - xem PurchaseReceiptLog. */
  receiptLogs?: PurchaseReceiptLog[]
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
  /** Mã lệnh hiển thị (2026-11-05): số LSX nhà máy (lệnh gộp nối " + "), lệnh cũ chưa có LSX thì bằng piCode.
   *  CHỈ để hiển thị - so khớp với lệnh vẫn dùng piCode. */
  lenhCode: string
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
// 'quoting' là rollup BE đang sinh thật (recomputeProposalStatus: có dòng đã rời NEW nhưng chưa xong
// hết) - nghĩa là "đang báo giá/đang xử lý", KHÔNG phải "chờ Sếp duyệt" (2026-10-05, sửa nhãn sai).
// 'submitted'/'rejected' chỉ còn xuất hiện ở DỮ LIỆU CŨ (luồng báo giá gỡ 2026-08-27).
export const PROPOSAL_STATUS_LABELS: Record<PurchaseProposal['status'], { label: string; color: string; bg: string; border: string }> = {
  new:        { label: 'Chờ Sếp duyệt', color: 'var(--fg-92400e)', bg: 'var(--bg-fef3c7)', border: 'var(--fg-fde68a)' },
  quoting:    { label: 'Đang báo giá', color: 'var(--fg-92400e)', bg: 'var(--bg-fef3c7)', border: 'var(--fg-fde68a)' },
  submitted:  { label: 'Chờ Sếp duyệt', color: 'var(--fg-92400e)', bg: 'var(--bg-fef3c7)', border: 'var(--fg-fde68a)' },
  purchasing: { label: 'Đang mua hàng', color: 'var(--fg-92400e)', bg: 'var(--bg-fef3c7)', border: 'var(--fg-fde68a)' },
  purchased:  { label: 'Đã mua',        color: 'var(--fg-166534)', bg: 'var(--bg-dcfce7)', border: 'var(--fg-86efac)' },
  rejected:   { label: 'Chờ Sếp duyệt', color: 'var(--fg-92400e)', bg: 'var(--bg-fef3c7)', border: 'var(--fg-fca5a5)' },
}

// BE đóng hồ sơ 1 dòng thẳng sang status='purchased' ngay lúc TẠO đề xuất khi buyQty tính ra = 0
// (tồn kho đã đủ, không có gì để mua - xem cutting-proposals.service.ts/consumable-material-
// purchase.service.ts/piece-material-yield-purchase.service.ts, nhánh "buyQty === 0 ? PURCHASED :
// undefined"), KHÔNG đợi Sếp duyệt hay Kho nhận hàng gì cả. Cùng 1 status/badge "Đã mua" nhưng 2
// nghĩa khác hẳn nhau (thật sự đã mua+nhận hàng, và chưa từng cần mua) khiến người xem hiểu lầm
// (2026-09-23). Phân biệt lại ở FE bằng buyQty thay vì đổi schema BE (receivedQty/purchasedAt của
// nhánh buyQty=0 đều rỗng/= lúc tạo, không có gì để đối chiếu thêm).
export function wasActuallyPurchased(item: PurchaseProposalItem): boolean {
  return item.status === 'purchased' && item.buyQty > 0
}

const STOCK_SUFFICIENT_COLOR = { color: 'var(--fg-475569)', bg: 'var(--bg-f1f5f9)', border: 'var(--fg-cbd5e1)' }

// Badge đúng nghĩa cho 1 DÒNG vật tư cụ thể (khác PROPOSAL_STATUS_LABELS dùng chung cho cả
// PurchaseProposal.status rollup) - tách case buyQty=0 khỏi "Đã mua" thật, xem wasActuallyPurchased.
// Kèm theo số lượng lấy từ tồn kho có sẵn (actualStock = required khi buyQty=0, xem
// purchasing-api.ts#toItem) để người xem biết ĐANG NÓI VỀ số lượng nào, không phải chỉ 1 nhãn suông.
export function itemStatusLabel(item: PurchaseProposalItem): { label: string; color: string; bg: string; border: string } {
  if (item.status === 'purchased' && !wasActuallyPurchased(item)) {
    return { label: `Đủ tồn kho (${item.actualStock} ${item.unit})`, ...STOCK_SUFFICIENT_COLOR }
  }
  return PROPOSAL_STATUS_LABELS[item.status]
}

// Mọi mutation trả Promise và NÉM LẠI lỗi sau khi đã hiện banner (xem InspectionProvider).
// Trước 2026-08-15 chúng là `=> void` kết thúc bằng `.catch(console.error)`: thao tác thất bại
// trông y hệt thao tác thành công, kể cả trên chứng từ nhập kho (D.a1-silent-write-failure).
// Call site KHÔNG bắt buộc phải await - không await thì vẫn có banner như cũ; await chỉ cần ở
// chỗ có state phải rollback (vd NhapKhoPage xoá ô nhập sau khi xác nhận).
interface InspCtxType {
  proposals: PurchaseProposal[]
  /** false = đang tải lần đầu: `proposals` rỗng lúc này CHƯA có nghĩa là "không có đề xuất" (vd bước Mua hàng không được hiện "xong"). */
  proposalsReady: boolean
  /** Báo Provider có màn cần đề xuất mua - useInspection() tự gọi, màn không cần gọi tay. */
  requestProposals: () => void
  /** Lỗi của thao tác ghi gần nhất - `ActionErrorBanner` đọc, `dismissActionError()` xoá. */
  actionError: string | null
  dismissActionError:      () => void
  /** Đơn đặt hàng NCC (2026-11-04, bản v8 mục 4.10): gom dòng chờ duyệt vào 1 đơn (chọn NCC, hệ
   *  thống cấp số đơn); "Sếp đã duyệt" theo đơn kèm file phiếu đã ký; huỷ / gỡ dòng khi đơn chưa
   *  duyệt. `proposalIds` = các đề xuất có dòng trong đơn, để tải lại đúng các đề xuất đó. */
  createSupplierOrder:     (supplierId: string, itemIds: string[], proposalIds: string[]) => Promise<void>
  approveSupplierOrder:    (orderId: string, approvalFileUrl: string, proposalIds: string[]) => Promise<void>
  cancelSupplierOrder:     (orderId: string, reason: string, proposalIds: string[]) => Promise<void>
  removeSupplierOrderItem: (orderId: string, itemId: string, proposalIds: string[]) => Promise<void>
  /** THAY PHIẾU (bản v8 mục 7.11) - đơn đã ký về chờ duyệt, dòng chưa nhận quay về chờ duyệt. */
  reviseSupplierOrder:     (orderId: string, reason: string, proposalIds: string[]) => Promise<void>
  /** "Đóng phần thiếu" (Đợt 5e, 7.13) - NCC không giao nốt; phần CẦN mua còn thiếu thành dòng mới chờ vào đơn. */
  closeSupplierOrderShortage: (orderId: string, itemIds: string[], reason: string, proposalIds: string[]) => Promise<void>
  /** Ô1 (unitRateQty) × Ô2 (supplierUnitQty, mặc định 1) = số lượng thật cộng vào tồn kho - backend
   *  tự nhân (2026-10-16, thay cho hệ số quy đổi cố định Material.khoUnitFactor đã xoá). Xem
   *  NhapKhoPage.tsx. */
  /** Đợt 5d: nhận 1 lần hàng về (đơn gộp tự chia cho các lệnh) - `idempotencyKey` giữ nguyên khi bấm lại cùng 1 lần nhận. */
  receivePurchase: (input: CreatePurchaseReceiptInput, idempotencyKey: string, proposalIds: string[]) => Promise<PurchaseReceiptResult>
  rejectPurchase:  (input: RejectPurchaseReceiptInput, idempotencyKey: string, proposalIds: string[]) => Promise<void>
  /** Admin "Quản lý tệp đính kèm" (2026-09-11) - thay/xóa file duyệt của 1 item (`approvalFileUrl:
   *  null` = xóa hẳn, xem services/purchasing-api.ts#updateProposalItemApprovalFile). */
  updateApprovalFile:      (proposalId: string, itemId: string, approvalFileUrl: string | null) => Promise<void>
  /** Người mua chốt "số mua" (2026-11-04, YC7 mục 7.2) - null = mua đúng số cần mua. */
  updateOrderQty:          (proposalId: string, itemId: string, orderQty: number | null) => Promise<void>
}

// ── Context ────────────────────────────────────────────────────────────────────
// proposals (PurchaseProposal) đã cutover sang BE thật (Phase 8, xem services/purchasing-api.ts)
// - tự sinh từ CuttingProposal đã duyệt.

const InspCtx = createContext<InspCtxType | undefined>(undefined)

export function InspectionProvider({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuth()
  const [proposals, setProposals] = useState<PurchaseProposal[]>([])
  // Chỉ tải đề xuất mua KHI CÓ MÀN CẦN (2026-11-12). Trước đây Provider bọc cả app nên mọi màn của KHSX/Sếp/Mua hàng đều tải
  // 2 lượt (~85 KB mỗi lượt) ngay khi mở app, kể cả màn không dùng (vd Tối ưu cắt sắt). Đo trên production: 2 lượt này chậm
  // nhất lúc mở màn (3–4 s) và kéo chậm các API khác vì máy chủ xử lý dồn. Giờ tải khi có màn gọi useInspection() lần đầu
  // (màn nào dùng hook này cũng đọc proposals), rồi giữ và làm mới theo realtime như cũ.
  const [wanted, setWanted] = useState(false)
  const requestProposals = useCallback(() => setWanted(true), [])
  // Token của lần tải đã xong gần nhất (kể cả lỗi) - để màn phân biệt "chưa tải xong" với "không có đề xuất nào".
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
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
  const mfgRole = user?.mfgRole
  const skipProposals = !token || (!!mfgRole && mfgRole !== 'PRODUCTION_MANAGER')
  const proposalsReady = skipProposals || loadedFor === token
  const loadProposals = useCallback(() => {
    // Ngoại lệ QLSX (PRODUCTION_MANAGER): vai này ĐÃ có PURCHASE_PROPOSAL:VIEW (role-permissions.constant.ts) và màn
    // "Tổng hợp lệnh SX" của QLSX cần đề xuất mua để tính bước "Mua hàng". Bỏ qua cả vai này (như trước 2026-10-01) làm
    // danh sách đề xuất rỗng -> bước Mua hàng luôn hiện "xong" dù chưa mua gì (PI-2026-021: KHSX thấy 0%, QLSX thấy xong).
    if (!token || (mfgRole && mfgRole !== 'PRODUCTION_MANAGER')) return
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
        setLoadedFor(token)
      })
      .catch((err: unknown) => {
        setLoadedFor(token)
        // 403 = vai này không có PURCHASE_PROPOSAL:VIEW (Phôi/Hàn/Sơn/KCS/SPEC... - xem
        // role-permissions.constant.ts). Provider bọc TOÀN BỘ app nên request vẫn bắn cho mọi
        // vai vừa đăng nhập; đây là kết quả ĐÚNG với các vai đó, không phải lỗi -> để danh sách
        // rỗng, không log. Vẫn log mọi lỗi khác (mạng/500) để không giấu sự cố thật.
        if ((err as { statusCode?: number })?.statusCode === 403) return
        console.error('getPurchaseProposals failed', err)
      })
  }, [token, mfgRole])
  useEffect(() => { if (wanted) loadProposals() }, [wanted, loadProposals])
  // Realtime: BE phát khi đề xuất đổi (duyệt/nhận hàng) - làm mới đúng danh sách này, không cần F5. Chưa màn nào cần thì
  // bỏ qua: lần tải đầu (khi có màn cần) sẽ lấy bản mới nhất.
  const refetchIfWanted = useCallback(() => { if (wanted) loadProposals() }, [wanted, loadProposals])
  useRealtimeRefetch(['purchase-proposals'], refetchIfWanted)

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

  // Đơn đặt hàng NCC (2026-11-04) - gọi API rồi tải lại ĐÚNG các đề xuất có dòng trong đơn (1 đơn
  // có thể gom dòng của nhiều đề xuất), cùng idiom cập nhật state cục bộ như các thao tác khác.
  const refreshProposals = useCallback(async (proposalIds: string[]) => {
    const fresh = await Promise.all([...new Set(proposalIds)].map(id => getPurchaseProposal(id)))
    const byId = new Map(fresh.map(p => [p.id, p]))
    setProposals(prev => prev.map(p => byId.get(p.id) ?? p))
  }, [])

  const createSupplierOrder = useCallback((supplierId: string, itemIds: string[], proposalIds: string[]) =>
    runAction('Tạo đơn đặt hàng', async () => {
      await createSupplierOrderApi(supplierId, itemIds)
      await refreshProposals(proposalIds)
    }), [runAction, refreshProposals])

  // "Sếp đã duyệt" theo đơn: BE đẩy đúng các dòng của đơn sang 'purchasing' (PurchaseProposalsService.
  // bossApprove() lọc theo dòng của đơn) - Kho mới nhận hàng được.
  const approveSupplierOrder = useCallback((orderId: string, approvalFileUrl: string, proposalIds: string[]) =>
    runAction('Xác nhận Sếp đã duyệt', async () => {
      await approveSupplierOrderApi(orderId, approvalFileUrl)
      await refreshProposals(proposalIds)
    }), [runAction, refreshProposals])

  const cancelSupplierOrder = useCallback((orderId: string, reason: string, proposalIds: string[]) =>
    runAction('Huỷ đơn đặt hàng', async () => {
      await cancelSupplierOrderApi(orderId, reason)
      await refreshProposals(proposalIds)
    }), [runAction, refreshProposals])

  const removeSupplierOrderItem = useCallback((orderId: string, itemId: string, proposalIds: string[]) =>
    runAction('Gỡ dòng khỏi đơn', async () => {
      await removeSupplierOrderItemApi(orderId, itemId)
      await refreshProposals(proposalIds)
    }), [runAction, refreshProposals])

  const reviseSupplierOrder = useCallback((orderId: string, reason: string, proposalIds: string[]) =>
    runAction('Thay phiếu', async () => {
      await reviseSupplierOrderApi(orderId, reason)
      await refreshProposals(proposalIds)
    }), [runAction, refreshProposals])

  const closeSupplierOrderShortage = useCallback((orderId: string, itemIds: string[], reason: string, proposalIds: string[]) =>
    runAction('Đóng phần thiếu', async () => {
      await closeSupplierOrderShortageApi(orderId, itemIds, reason)
      await refreshProposals(proposalIds)
    }), [runAction, refreshProposals])

  // Thủ kho nhận hàng theo phiếu (Đợt 5d) - BE ghi cả phiếu trong 1 transaction rồi tải lại các đề xuất liên quan.
  const receivePurchase = useCallback((input: CreatePurchaseReceiptInput, idempotencyKey: string, proposalIds: string[]) =>
    runAction('Nhập kho', async () => {
      const result = await createPurchaseReceiptApi(input, idempotencyKey)
      await refreshProposals(proposalIds)
      return result
    }), [runAction, refreshProposals])

  const rejectPurchase = useCallback((input: RejectPurchaseReceiptInput, idempotencyKey: string, proposalIds: string[]) =>
    runAction('Từ chối nhận', async () => {
      await rejectPurchaseReceiptApi(input, idempotencyKey)
      await refreshProposals(proposalIds)
    }), [runAction, refreshProposals])

  // Admin "Quản lý tệp đính kèm" (2026-09-11) - cùng idiom approveSupplierOrder/receiveProposalItem
  // ở trên: gọi API rồi cập nhật lại state cục bộ, KHÔNG được gọi thẳng
  // services/purchasing-api.ts#updateProposalItemApprovalFile() từ ngoài context (làm vậy BE ghi
  // đúng nhưng `proposals` ở đây không đổi, UI vẫn hiện dữ liệu cũ tới khi tải lại trang - bug thật
  // đã gặp lúc live-test).
  const updateApprovalFile = useCallback((proposalId: string, itemId: string, approvalFileUrl: string | null) =>
    runAction('Sửa file duyệt', async () => {
      const updated = await updateProposalItemApprovalFileApi(proposalId, itemId, approvalFileUrl)
      setProposals(prev => prev.map(p => p.id === proposalId ? updated : p))
    }), [runAction])

  // Người mua chốt "số mua" (2026-11-04, YC7 mục 7.2) - cùng idiom updateApprovalFile ở trên.
  const updateOrderQty = useCallback((proposalId: string, itemId: string, orderQty: number | null) =>
    runAction('Sửa số mua', async () => {
      const updated = await updateProposalItemOrderQtyApi(proposalId, itemId, orderQty)
      setProposals(prev => prev.map(p => p.id === proposalId ? updated : p))
    }), [runAction])

  return (
    <InspCtx.Provider value={{ proposals, proposalsReady, requestProposals, actionError, dismissActionError, createSupplierOrder, approveSupplierOrder, cancelSupplierOrder, removeSupplierOrderItem, reviseSupplierOrder, closeSupplierOrderShortage, receivePurchase, rejectPurchase, updateApprovalFile, updateOrderQty }}>
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
        background: 'var(--bg-fee2e2)', border: '1px solid var(--fg-fca5a5)', color: 'var(--fg-991b1b)',
        boxShadow: '0 6px 20px rgba(0,0,0,.15)', fontSize: 13, lineHeight: 1.5,
      }}
    >
      <span style={{ fontWeight: 700 }}>⚠</span>
      <span style={{ flex: 1, fontWeight: 500 }}>{message}</span>
      <button
        onClick={onDismiss}
        aria-label="Đóng thông báo lỗi"
        style={{ border: 'none', background: 'transparent', color: 'var(--fg-991b1b)', cursor: 'pointer', fontSize: 16, fontWeight: 700, lineHeight: 1, padding: 0 }}
      >×</button>
    </div>
  )
}

export function useInspection(): InspCtxType {
  const ctx = useContext(InspCtx)
  // Màn nào dùng hook này cũng đọc proposals -> báo Provider tải (chỉ lần đầu có tác dụng), xem `wanted` ở InspectionProvider.
  const request = ctx?.requestProposals
  useEffect(() => { request?.() }, [request])
  if (!ctx) throw new Error('useInspection must be used inside InspectionProvider')
  return ctx
}
