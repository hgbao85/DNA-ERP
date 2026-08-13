'use client'
import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import type { Sku } from '../types/sku'
import type { WarehouseScope } from './AuthContext'
import { useAuth } from './AuthContext'
import { useAuditLog } from './AuditLogContext'
import { syncDinhMucSatVaoKeHoach, syncDinhMucSatVaoLenhPhoi, type DinhMucSatSyncItem } from '../services/api'
import {
  getPurchaseProposals as fetchPurchaseProposals,
  acknowledgeProposal as acknowledgeProposalApi,
  submitProposalToDirector as submitProposalToDirectorApi,
  approveProposal as approveProposalApi,
  rejectProposal as rejectProposalApi,
  requoteProposal as requoteProposalApi,
  receiveProposalItem as receiveProposalItemApi,
  createProposalFromInspection as createProposalFromInspectionApi,
} from '../services/purchasing-api'
import {
  getInspectionRequests,
  createInspectionRequest,
  submitInspectionKho as submitInspectionKhoApi,
  startInspectionProduction as startInspectionProductionApi,
  toInspRequest,
} from '../services/material-inspection-api'

export const PROPOSAL_ENTITY = 'PurchaseProposal'

// ── Types ──────────────────────────────────────────────────────────────────────

export type KhoKey = 'phoiSonHan' | 'vatTuTP' | 'thanhPham'

// Kho phụ trách của từng nhóm vật tư — dùng để tách đề xuất mua theo kho (mỗi kho tự
// kiểm tồn riêng). KHÔNG còn dùng để route tới tài khoản Purchasing (đã chuyển sang gán
// theo từng vật tư - Material.buyerId, xem src/utils/purchasingRouting.ts). Thêm kho mới
// chỉ cần thêm 1 dòng ở đây, không phải sửa logic tách ở nơi khác.
export const KHO_KEY_TO_WAREHOUSE_SCOPE: Record<KhoKey, WarehouseScope> = {
  phoiSonHan: 'phoi-son-han',
  vatTuTP: 'vat-tu-tp',
  thanhPham: 'thanh-pham',
}

export interface InspItem {
  /** InspectionKhoResultItem.id (BE) - cần để gửi overrides lúc submitKho và làm itemId lúc tạo
   *  đề xuất mua thủ công (markProposalCreated). */
  id?: string
  /** null/undefined = dòng KHÔNG map được vật tư thật (hiếm) - actualStock của dòng này phải nhập
   *  tay qua overrides; có giá trị = BE tự đọc StockQuant lúc submitKho, không nhận override. */
  materialId?: string | null
  name: string
  unit: string
  required: number
  actualStock: number | null   // null = kho chưa điền
}

export interface KhoState {
  status: 'pending' | 'done'
  items: InspItem[]
  submittedAt?: string
  /** InspectionKhoResult.id (BE) - cần để tạo đề xuất mua thủ công (markProposalCreated) và làm
   *  tham số POST .../kho/:warehouseCode/submit. */
  khoResultId: string
  /** PurchaseProposal.id nếu kho này đã có đề xuất mua - undefined nếu chưa. */
  purchaseProposalId?: string
}

export interface InspRequest {
  id: string                   // MaterialInspectionRequest.id (BE)
  skuId: number
  poNumber: string
  skuCode: string
  skuName?: string
  sentAt: string
  deadline?: string
  phoiSonHan: KhoState
  vatTuTP: KhoState
  thanhPham: KhoState
  proposalCreated: boolean
  productionStarted?: boolean
  productionStartedAt?: string
}

export function khoState(req: InspRequest, kho: KhoKey): KhoState {
  return kho === 'phoiSonHan' ? req.phoiSonHan : kho === 'vatTuTP' ? req.vatTuTP : req.thanhPham
}

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
  quotes?: Record<string, ProposalQuote[]>  // keyed by item.name → multiple NCC offers
  chosenSuppliers?: Record<string, string>  // item.name → chosen supplierName (set by boss)
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
  requests: InspRequest[]
  proposals: PurchaseProposal[]
  sendRequest:             (pf: Sku) => void
  submitKho:               (requestId: string, kho: KhoKey, overrides?: { itemId: string; actualStock: number }[]) => void
  markProposalCreated:     (requestId: string, items: { itemId: string; khoKey: KhoKey; buyQty: number }[]) => void
  acknowledgeProposal:     (proposalId: string) => void
  submitProposalToDirector:(proposalId: string, quotes: Record<string, ProposalQuote[]>) => void
  approveProposal:         (proposalId: string, chosenQuoteIdByItemName: Record<string, string>) => void
  rejectProposal:          (proposalId: string, reason: string) => void
  requoteProposal:         (proposalId: string) => void
  receiveProposalItem:     (proposalId: string, itemName: string, qty: number, receivedQtyPurchaseUnit?: number) => void
  startProduction:         (requestId: string, pf?: Sku) => void
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const isSon = (name: string) => /sơn|son|primer|lót|phủ|hardener|thinner/i.test(name)

// ── Context ────────────────────────────────────────────────────────────────────
// proposals (PurchaseProposal) đã cutover sang BE thật (Phase 8, xem services/purchasing-api.ts)
// - tự sinh từ CuttingProposal đã duyệt, hoặc tạo thủ công từ InspectionKhoResult (Phase 10, xem
// markProposalCreated). requests (InspRequest) cũng đã cutover (Phase 10, 2026-08-12, xem
// services/material-inspection-api.ts) - không còn SEED_REQUESTS mock.

const InspCtx = createContext<InspCtxType | undefined>(undefined)

export function InspectionProvider({ children }: { children: React.ReactNode }) {
  const { logAction } = useAuditLog()
  const { token, user } = useAuth()
  const [requests,  setRequests]  = useState<InspRequest[]>([])
  const [proposals, setProposals] = useState<PurchaseProposal[]>([])

  // InspectionProvider bọc TOÀN BỘ app ở layout.tsx (kể cả /login, trước khi có token) - chỉ gọi
  // API khi đã đăng nhập, tránh bắn request chắc chắn 401 (không có token) ngay trên màn hình
  // đăng nhập. `token` chỉ có sau khi AuthProvider khôi phục xong phiên (xem AuthContext.tsx).
  //
  // Bỏ qua khi user có mfgRole (Sản xuất tại xưởng: QLSX/Phôi/Hàn/Sơn/KCS/Spec, dùng MfgApp) -
  // phát hiện qua browser thật 2026-08-13: không role nào trong nhóm này có PURCHASE_PROPOSAL:VIEW
  // hay MATERIAL_INSPECTION:VIEW ở BE (đề xuất mua/kiểm tra vật tư là việc của KHSX/Mua hàng/Sếp,
  // xem role-permissions.constant.ts), nên 2 lời gọi này luôn 403 âm thầm cho toàn bộ nhóm role
  // này - không chỉ PHOI/KCS vừa kiểm tra qua browser.
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
    getInspectionRequests()
      .then(list => setRequests(list.map(toInspRequest)))
      .catch(err => console.error('getInspectionRequests failed', err))
  }, [token, user?.mfgRole])

  // Find-or-create idempotent ở BE (theo planFormId) - gọi lại an toàn, không tạo trùng. Chỉ hiện
  // nút "Gửi đề xuất kiểm tra vật tư" khi FE chưa có request cục bộ nên trong luồng bình thường
  // hàm này chỉ chạy đúng 1 lần/SKU.
  const sendRequest = useCallback((pf: Sku) => {
    void createInspectionRequest(pf)
      .then(created => {
        const mapped = toInspRequest(created)
        setRequests(prev => prev.some(r => r.id === mapped.id)
          ? prev.map(r => r.id === mapped.id ? mapped : r)
          : [...prev, mapped])
      })
      .catch(err => console.error('sendRequest failed', err))
  }, [])

  // overrides chỉ cần cho dòng KHÔNG có materialId (hiếm, không map được vật tư thật) - dòng có
  // materialId luôn được BE tự đọc StockQuant, gửi override cho dòng đó sẽ bị BE từ chối.
  const submitKho = useCallback((requestId: string, kho: KhoKey, overrides?: { itemId: string; actualStock: number }[]) => {
    void submitInspectionKhoApi(requestId, KHO_KEY_TO_WAREHOUSE_SCOPE[kho], overrides)
      .then(updated => setRequests(prev => prev.map(r => r.id === requestId ? toInspRequest(updated) : r)))
      .catch(err => console.error('submitKho failed', err))
  }, [])

  // 1 lần "Tạo đề xuất mua hàng" của KHSX có thể gồm vật tư của nhiều kho — tách thành 1
  // PurchaseProposal riêng cho mỗi kho (khớp @@unique(inspectionKhoResultId) ở BE) để route đúng
  // Purchasing phụ trách. allSettled thay vì all: 1 kho lỗi (vd đã có đề xuất từ trước) không
  // được chặn các kho còn lại tạo thành công.
  const markProposalCreated = useCallback((
    requestId: string,
    items: { itemId: string; khoKey: KhoKey; buyQty: number }[],
  ) => {
    const request = requests.find(r => r.id === requestId)
    if (!request) return

    const itemsByKho = new Map<KhoKey, { itemId: string; buyQty: number }[]>()
    items.forEach(item => {
      if (!itemsByKho.has(item.khoKey)) itemsByKho.set(item.khoKey, [])
      itemsByKho.get(item.khoKey)!.push({ itemId: item.itemId, buyQty: item.buyQty })
    })

    const calls = Array.from(itemsByKho.entries()).map(([khoKey, khoItems]) =>
      createProposalFromInspectionApi(khoState(request, khoKey).khoResultId, khoItems),
    )

    Promise.allSettled(calls)
      .then(results => {
        const created: PurchaseProposal[] = []
        results.forEach(r => {
          if (r.status === 'fulfilled') created.push(r.value)
          else console.error('createProposalFromInspection failed', r.reason)
        })
        if (created.length > 0) {
          setProposals(prev => [...prev, ...created])
          created.forEach(p => logAction(PROPOSAL_ENTITY, p.id, 'proposal.created'))
        }
        return getInspectionRequests()
      })
      .then(list => setRequests(list.map(toInspRequest)))
      .catch(err => console.error('markProposalCreated refresh failed', err))
  }, [requests, logAction])

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

  const approveProposal = useCallback((proposalId: string, chosenQuoteIdByItemName: Record<string, string>) => {
    const current = proposals.find(p => p.id === proposalId)
    if (!current) return
    void approveProposalApi(current, chosenQuoteIdByItemName)
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
  const receiveProposalItem = useCallback((proposalId: string, itemName: string, qty: number, receivedQtyPurchaseUnit?: number) => {
    const current = proposals.find(p => p.id === proposalId)
    if (!current) return
    const wasPurchased = current.status === 'purchased'
    void receiveProposalItemApi(current, itemName, qty, receivedQtyPurchaseUnit)
      .then(updated => {
        setProposals(prev => prev.map(p => p.id === proposalId ? updated : p))
        if (!wasPurchased && updated.status === 'purchased') {
          logAction(PROPOSAL_ENTITY, proposalId, 'proposal.purchased')
        }
      })
      .catch(err => console.error('receiveProposalItem failed', err))
  }, [proposals, logAction])

  // KHSX chốt bắt đầu sản xuất — đồng thời đẩy vật tư sắt trong định mức (kho PSH) sang
  // "Xuất sắt cho Phôi" + "Lệnh sản xuất Phôi" để kho bắt đầu xuất sắt cho Phôi cắt.
  // Dùng cùng 1 lineId cho cả 2 bên (xem 2 hàm sync) để sau này Phôi xác nhận cắt xong
  // cộng đúng dòng vật tư. BE chặn (409) nếu chưa đủ 3 kho SUBMITTED - lỗi đó chỉ log console,
  // không có UI riêng (cùng quy ước với các action khác trong context này); nút "Bắt đầu sản
  // xuất" ở trang gọi hàm này chỉ hiện khi FE đã tự thấy đủ 3 kho done nên hiếm khi chạm nhánh đó.
  const startProduction = useCallback((requestId: string, pf?: Sku) => {
    const req = requests.find(r => r.id === requestId)
    if (req) {
      // Có định mức mảnh thật (account Sắt đã nhập, xem "Định mức mảnh" ở Duyệt SKU) → đồng bộ
      // theo đúng từng mảnh (Mảnh Tựa, Mảnh Mê...) để "Xuất sắt cho Phôi"/"Lệnh sản xuất Phôi"
      // nhóm giống các PO đã có sẵn (vd PO-2026-002 nhóm theo "Mảnh Tựa"/"Mảnh Chân"). Chưa có
      // (đa số SKU cũ) thì rơi về cách cũ: gộp chung 1 mảnh mặc định "Vật tư sắt định mức".
      // Chỉ lấy children nhóm Sắt - manhData.pieces gồm cả 5 nhóm (Sắt/Dây/Đinh/Tán rút/Nút
      // nhựa), nhưng "Xuất sắt cho Phôi" chỉ đúng nghĩa với đoạn sắt.
      const manhItems = pf?.manhData?.pieces?.map(p => ({ ...p, children: p.children.filter(c => c.group === 'sat') }))
      let syncItems: DinhMucSatSyncItem[] = []
      if (manhItems && manhItems.length > 0) {
        let idx = 0
        for (const manh of manhItems) {
          for (const child of manh.children) {
            const required = Number(child.qty) || 0
            if (required <= 0) continue
            syncItems.push({
              lineId: 9000 + req.skuId * 20 + idx,
              name: child.name, unit: 'cây', required, manhTen: manh.name,
            })
            idx++
          }
        }
      } else {
        syncItems = req.phoiSonHan.items
          .filter(i => !isSon(i.name) && i.required > 0)
          .map((it, idx) => ({
            lineId: 9000 + req.skuId * 20 + idx,
            name: it.name, unit: it.unit, required: it.required,
          }))
      }
      if (syncItems.length > 0) {
        syncDinhMucSatVaoKeHoach(req.poNumber, req.skuCode, req.sentAt.slice(0, 10), syncItems)
        syncDinhMucSatVaoLenhPhoi({
          poNumber: req.poNumber, sku: req.skuCode,
          productName: req.skuName ?? req.skuCode, deadline: req.deadline,
          items: syncItems,
        })
      }
    }
    void startInspectionProductionApi(requestId)
      .then(updated => {
        setRequests(prev => prev.map(r => r.id === requestId ? toInspRequest(updated) : r))
        logAction('InspRequest', requestId, 'request.production_started')
      })
      .catch(err => console.error('startProduction failed', err))
  }, [requests, logAction])

  return (
    <InspCtx.Provider value={{ requests, proposals, sendRequest, submitKho, markProposalCreated, acknowledgeProposal, submitProposalToDirector, approveProposal, rejectProposal, requoteProposal, receiveProposalItem, startProduction }}>
      {children}
    </InspCtx.Provider>
  )
}

export function useInspection(): InspCtxType {
  const ctx = useContext(InspCtx)
  if (!ctx) throw new Error('useInspection must be used inside InspectionProvider')
  return ctx
}
