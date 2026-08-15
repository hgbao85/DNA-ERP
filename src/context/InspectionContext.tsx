'use client'
import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import type { WarehouseScope } from './AuthContext'
import { useAuth } from './AuthContext'
import { useAuditLog } from './AuditLogContext'
import {
  getPurchaseProposals as fetchPurchaseProposals,
  acknowledgeProposal as acknowledgeProposalApi,
  submitProposalToDirector as submitProposalToDirectorApi,
  approveProposal as approveProposalApi,
  rejectProposal as rejectProposalApi,
  requoteProposal as requoteProposalApi,
  receiveProposalItem as receiveProposalItemApi,
} from '../services/purchasing-api'

export const PROPOSAL_ENTITY = 'PurchaseProposal'

// ── Types ──────────────────────────────────────────────────────────────────────

// Kho phụ trách của từng nhóm vật tư — dùng để gán nhãn hiển thị (khoLabel) cho từng dòng đề
// xuất mua, xem purchasing-api.ts#toItem(). KHÔNG dùng để route tới tài khoản Purchasing (đã
// chuyển sang gán theo từng vật tư - Material.buyerId, xem src/utils/purchasingRouting.ts).
export type KhoKey = 'phoiSonHan' | 'vatTuTP' | 'thanhPham'

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
  khoKey: KhoKey
  khoLabel: string
  materialId?: number
  receivedQty?: number // luỹ kế thủ kho đã xác nhận nhận về, so với buyQty để biết đã đủ chưa
  receivedQtyPurchaseUnit?: number | null // luỹ kế theo purchaseUnit (vd kg) - chỉ để đối chiếu
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
}

export interface PurchaseProposal {
  id: string           // `prop-${requestId}-${khoKey}`
  requestId: string
  skuId: number
  poNumber: string
  skuCode: string
  skuName?: string
  createdAt: string
  // 1 đề xuất chỉ thuộc đúng 1 kho — dùng để route tới Purchasing phụ trách kho đó
  // (so khớp với user.warehouseScope, xem src/utils/purchasingRouting.ts).
  warehouseScope: WarehouseScope
  items: PurchaseProposalItem[]
  status: 'new' | 'quoting' | 'submitted' | 'purchasing' | 'purchased' | 'rejected'
  // Key = String(item.materialId), KHÔNG phải item.name — vật tư khác nhau có thể trùng tên hiển
  // thị (vd nhiều loại "Sắt phi" khác đường kính), materialId mới là định danh duy nhất trong 1
  // đề xuất (đã gặp bug thật do dùng tên làm key, sửa 2026-08-13, xem purchasing-api.ts).
  quotes?: Record<string, ProposalQuote[]>  // keyed by String(item.materialId) → multiple NCC offers
  chosenSuppliers?: Record<string, string>  // String(item.materialId) → chosen supplierName (set by boss)
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

interface InspCtxType {
  proposals: PurchaseProposal[]
  acknowledgeProposal:     (proposalId: string) => void
  submitProposalToDirector:(proposalId: string, quotes: Record<string, ProposalQuote[]>) => void
  approveProposal:         (proposalId: string, chosenQuoteIdByItemKey: Record<string, string>) => void
  rejectProposal:          (proposalId: string, reason: string) => void
  requoteProposal:         (proposalId: string) => void
  receiveProposalItem:     (proposalId: string, itemKey: string, qty: number, receivedQtyPurchaseUnit?: number) => void
}

// ── Context ────────────────────────────────────────────────────────────────────
// proposals (PurchaseProposal) đã cutover sang BE thật (Phase 8, xem services/purchasing-api.ts)
// - tự sinh từ CuttingProposal đã duyệt.

const InspCtx = createContext<InspCtxType | undefined>(undefined)

export function InspectionProvider({ children }: { children: React.ReactNode }) {
  const { logAction } = useAuditLog()
  const { token, user } = useAuth()
  const [proposals, setProposals] = useState<PurchaseProposal[]>([])

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
    fetchPurchaseProposals()
      .then(setProposals)
      .catch((err: unknown) => {
        // 403 = vai này không có PURCHASE_PROPOSAL:VIEW (Phôi/Hàn/Sơn/KCS/SPEC... - xem
        // role-permissions.constant.ts). Provider bọc TOÀN BỘ app nên request vẫn bắn cho mọi
        // vai vừa đăng nhập; đây là kết quả ĐÚNG với các vai đó, không phải lỗi -> để danh sách
        // rỗng, không log. Vẫn log mọi lỗi khác (mạng/500) để không giấu sự cố thật.
        if ((err as { statusCode?: number })?.statusCode === 403) return
        console.error('getPurchaseProposals failed', err)
      })
  }, [token, user?.mfgRole])

  const acknowledgeProposal = useCallback((proposalId: string) => {
    void acknowledgeProposalApi(proposalId)
      .then(updated => {
        setProposals(prev => prev.map(p => p.id === proposalId ? updated : p))
        logAction(PROPOSAL_ENTITY, proposalId, 'proposal.acknowledged')
      })
      .catch(err => console.error('acknowledgeProposal failed', err))
  }, [logAction])

  const submitProposalToDirector = useCallback((proposalId: string, quotes: Record<string, ProposalQuote[]>) => {
    const current = proposals.find(p => p.id === proposalId)
    if (!current) return
    void submitProposalToDirectorApi(current, quotes)
      .then(updated => {
        setProposals(prev => prev.map(p => p.id === proposalId ? updated : p))
        logAction(PROPOSAL_ENTITY, proposalId, 'proposal.quote_submitted')
      })
      .catch(err => console.error('submitProposalToDirector failed', err))
  }, [proposals, logAction])

  const approveProposal = useCallback((proposalId: string, chosenQuoteIdByItemKey: Record<string, string>) => {
    const current = proposals.find(p => p.id === proposalId)
    if (!current) return
    void approveProposalApi(current, chosenQuoteIdByItemKey)
      .then(updated => {
        setProposals(prev => prev.map(p => p.id === proposalId ? updated : p))
        logAction(PROPOSAL_ENTITY, proposalId, 'proposal.approved')
      })
      .catch(err => console.error('approveProposal failed', err))
  }, [proposals, logAction])

  const rejectProposal = useCallback((proposalId: string, reason: string) => {
    void rejectProposalApi(proposalId, reason)
      .then(updated => {
        setProposals(prev => prev.map(p => p.id === proposalId ? updated : p))
        logAction(PROPOSAL_ENTITY, proposalId, 'proposal.rejected', reason)
      })
      .catch(err => console.error('rejectProposal failed', err))
  }, [logAction])

  // Mở lại luồng báo giá sau khi bị từ chối — giữ nguyên quotes/rejectionReason cũ làm lịch sử,
  // chỉ đổi status để Purchasing sửa tiếp và gửi lại.
  const requoteProposal = useCallback((proposalId: string) => {
    void requoteProposalApi(proposalId)
      .then(updated => {
        setProposals(prev => prev.map(p => p.id === proposalId ? updated : p))
        logAction(PROPOSAL_ENTITY, proposalId, 'proposal.requoted')
      })
      .catch(err => console.error('requoteProposal failed', err))
  }, [logAction])

  // Thủ kho xác nhận đã nhận hàng — cộng dồn qua nhiều lần nhập (hàng có thể về nhiều đợt) ở
  // tầng BE (xem PurchaseProposalsService.receiveItem), tự chuyển 'purchasing' -> 'purchased'
  // khi mọi item đã nhận đủ buyQty.
  const receiveProposalItem = useCallback((proposalId: string, itemKey: string, qty: number, receivedQtyPurchaseUnit?: number) => {
    const current = proposals.find(p => p.id === proposalId)
    if (!current) return
    const wasPurchased = current.status === 'purchased'
    void receiveProposalItemApi(current, itemKey, qty, receivedQtyPurchaseUnit)
      .then(updated => {
        setProposals(prev => prev.map(p => p.id === proposalId ? updated : p))
        if (!wasPurchased && updated.status === 'purchased') {
          logAction(PROPOSAL_ENTITY, proposalId, 'proposal.purchased')
        }
      })
      .catch(err => console.error('receiveProposalItem failed', err))
  }, [proposals, logAction])

  return (
    <InspCtx.Provider value={{ proposals, acknowledgeProposal, submitProposalToDirector, approveProposal, rejectProposal, requoteProposal, receiveProposalItem }}>
      {children}
    </InspCtx.Provider>
  )
}

export function useInspection(): InspCtxType {
  const ctx = useContext(InspCtx)
  if (!ctx) throw new Error('useInspection must be used inside InspectionProvider')
  return ctx
}
