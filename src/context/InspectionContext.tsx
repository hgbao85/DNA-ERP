'use client'
import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import type { Sku, ManhRow } from '../types/sku'
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
} from '../services/purchasing-api'
import { flattenManhSteel, combinedDaySon, dinhItems, rivetItems, plasticButtonItems } from '../utils/manhMaterials'

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
  name: string
  unit: string
  required: number
  actualStock: number | null   // null = kho chưa điền
}

export interface KhoState {
  status: 'pending' | 'done'
  items: InspItem[]
  submittedAt?: string
}

export interface InspRequest {
  id: string                   // `insp-${skuId}`
  skuId: number
  poNumber: string
  skuCode: string
  skuName?: string
  sentAt: string
  deadline?: string
  /** Snapshot định mức mảnh (nếu account Sắt đã nhập cho SKU này) — dùng để "Bắt đầu sản xuất"
   *  đồng bộ vật tư sắt sang Phôi theo đúng từng mảnh (xem startProduction) thay vì gộp chung. */
  manhItems?: ManhRow[]
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
  required: number
  actualStock: number
  buyQty: number
  khoKey: KhoKey
  khoLabel: string
  materialId?: number
  receivedQty?: number // luỹ kế thủ kho đã xác nhận nhận về, so với buyQty để biết đã đủ chưa
}

export interface ProposalQuote {
  supplierName: string
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

interface ProposalMeta { skuId: number; poNumber: string; skuCode: string; skuName?: string; deadline?: string }

interface InspCtxType {
  requests: InspRequest[]
  proposals: PurchaseProposal[]
  sendRequest:             (pf: Sku) => void
  submitKho:               (requestId: string, kho: KhoKey, items: InspItem[]) => void
  markProposalCreated:     (requestId: string, items: PurchaseProposalItem[], meta: ProposalMeta) => void
  acknowledgeProposal:     (proposalId: string) => void
  submitProposalToDirector:(proposalId: string, quotes: Record<string, ProposalQuote[]>) => void
  approveProposal:         (proposalId: string, chosenSuppliers: Record<string, string>) => void
  rejectProposal:          (proposalId: string, reason: string) => void
  requoteProposal:         (proposalId: string) => void
  receiveProposalItem:     (proposalId: string, itemName: string, qty: number) => void
  startProduction:         (requestId: string) => void
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const isSon = (name: string) => /sơn|son|primer|lót|phủ|hardener|thinner/i.test(name)

// Phân bổ theo đúng CATEGORY_WAREHOUSE_CODE (purchase-order.ts): sat/son -> phôi sơn hàn,
// day/dinh/vatTuPhuKien -> vật tư thành phẩm, baoBiDongGoi -> kho thành phẩm (nơi đóng gói).
function buildKhoItems(pf: Sku): { phoiSonHan: InspItem[]; vatTuTP: InspItem[]; thanhPham: InspItem[] } {
  const mt = pf.quotaManagement?.materialType
  const daySon = combinedDaySon(pf)
  const toItem = (name: string, unit: string, required: number): InspItem => ({
    name, unit, required: Math.max(0, required), actualStock: null,
  })
  return {
    phoiSonHan: [
      ...flattenManhSteel(pf).map(x => toItem(x.name, x.unit ?? 'kg', x.quantity ?? 0)),
      ...daySon.filter(x => isSon(x.name)).map(x => toItem(x.name, x.unit ?? 'kg', x.kg ?? 0)),
    ],
    vatTuTP: [
      ...daySon.filter(x => !isSon(x.name)).map(x => toItem(x.name, x.unit ?? 'm', x.kg ?? 0)),
      ...dinhItems(pf).map(x => toItem(x.name, x.unit ?? 'cây', x.kg ?? 0)),
      ...rivetItems(pf).map(x => toItem(x.name, x.unit ?? 'cái', x.kg ?? 0)),
      ...plasticButtonItems(pf).map(x => toItem(x.name, x.unit ?? 'cái', x.kg ?? 0)),
      ...(mt?.vatTuPhuKien ?? []).map(x => toItem(x.name, x.unit ?? 'cái', x.quantity ?? 0)),
    ],
    thanhPham: [
      ...(mt?.baoBiDongGoi ?? []).map(x => toItem(x.name, x.unit ?? 'cái', x.quantity ?? 0)),
    ],
  }
}

// ── Mock seed data ─────────────────────────────────────────────────────────────

// skuId phải khớp đúng 1 Sku thật (API /skus — không còn mock) — skuId lệch
// thì yêu cầu này không bao giờ hiện trong "Lệnh kiểm tra vật tư" của KHSX (danh sách luôn lọc
// theo id Sku thật). Tên vật tư trong từng items[] cũng phải khớp CHÍNH XÁC với
// quotaManagement.materialType của Sku thật đó — màn hình KHSX tra tồn thực bằng cách so tên
// (findInspItem), tên lệch thì mọi dòng hiện "—" dù badge kho báo đã kiểm. Đồng thời tách bao bì
// đóng gói ra kho thành phẩm (thanhPham) thay vì gộp chung vatTuTP, khớp CATEGORY_WAREHOUSE_CODE.
const SEED_REQUESTS: InspRequest[] = [
  {
    id: 'insp-1', skuId: 1,
    poNumber: 'PO-MY-001', skuCode: 'JSE-55', skuName: 'Ghế J55',
    sentAt: '2026-07-04T07:30:00.000Z',
    phoiSonHan: {
      status: 'done', submittedAt: '2026-07-04T08:00:00.000Z',
      items: [
        { name: 'Sắt hộp 25×25',      unit: 'cây', required: 20,  actualStock: 12  },
        { name: 'Sắt vuông 20×20',    unit: 'cây', required: 8,   actualStock: 8   },
        { name: 'Sắt tấm 3mm',        unit: 'tấm', required: 2,   actualStock: 1   },
        { name: 'Sơn tĩnh điện đen',  unit: 'kg',  required: 0.8, actualStock: 0.8 },
      ],
    },
    vatTuTP: {
      status: 'done', submittedAt: '2026-07-04T08:05:00.000Z',
      items: [
        { name: 'Dây PE đen',         unit: 'cuộn', required: 1.5, actualStock: 1.5 },
        { name: 'Ốc vít M6×20',       unit: 'cái',  required: 48,  actualStock: 30  },
        { name: 'Nắp nhựa đầu ống',   unit: 'cái',  required: 16,  actualStock: 16  },
        { name: 'Đệm cao su',         unit: 'cái',  required: 12,  actualStock: 12  },
      ],
    },
    thanhPham: {
      status: 'done', submittedAt: '2026-07-04T08:08:00.000Z',
      items: [
        { name: 'Thùng carton 5 lớp', unit: 'thùng', required: 1, actualStock: 1 },
        { name: 'Xốp PE bảo vệ',      unit: 'm²',    required: 2, actualStock: 1 },
        { name: 'Dây đai nhựa',       unit: 'm',     required: 3, actualStock: 3 },
      ],
    },
    proposalCreated: true,
  },
  {
    id: 'insp-2', skuId: 2,
    poNumber: 'PO-GP-002', skuCode: 'IEA-3', skuName: 'Ghế đan IEA-3',
    sentAt: '2026-07-03T08:15:00.000Z',
    phoiSonHan: {
      status: 'done', submittedAt: '2026-07-03T09:00:00.000Z',
      items: [
        { name: 'Ống sắt tròn Φ16', unit: 'cây', required: 12,  actualStock: 12  },
        { name: 'Sắt dẹt 20×3',     unit: 'cây', required: 4,   actualStock: 3   },
        { name: 'Sơn xám RAL7035',  unit: 'kg',  required: 0.6, actualStock: 0.6 },
      ],
    },
    vatTuTP: {
      status: 'done', submittedAt: '2026-07-03T09:10:00.000Z',
      items: [
        { name: 'Dây nhựa xanh lá',  unit: 'cuộn', required: 2.0, actualStock: 1.2 },
        { name: 'Dây màu đỏ',        unit: 'cuộn', required: 0.5, actualStock: 0.5 },
        { name: 'Ốc vít M5×15',      unit: 'cái',  required: 32,  actualStock: 32  },
        { name: 'Nắp đầu ống tròn',  unit: 'cái',  required: 8,   actualStock: 8   },
      ],
    },
    thanhPham: {
      status: 'done', submittedAt: '2026-07-03T09:15:00.000Z',
      items: [
        { name: 'Thùng carton 3 lớp', unit: 'thùng', required: 1, actualStock: 1 },
        { name: 'Xốp chèn góc',       unit: 'bộ',    required: 4, actualStock: 2 },
      ],
    },
    proposalCreated: true,
  },
]

// ── Context ────────────────────────────────────────────────────────────────────
// proposals (PurchaseProposal) đã cutover sang BE thật (Phase 8, xem services/purchasing-api.ts)
// - tự sinh từ CuttingProposal đã duyệt, không còn seed mock ở đây. requests (InspRequest) vẫn
// giữ mock (SEED_REQUESTS) vì bước Kiểm tra tồn kho chưa nối - xem quyết định 2026-08-07.

const InspCtx = createContext<InspCtxType | undefined>(undefined)

export function InspectionProvider({ children }: { children: React.ReactNode }) {
  const { logAction } = useAuditLog()
  const { token } = useAuth()
  const [requests,  setRequests]  = useState<InspRequest[]>(SEED_REQUESTS)
  const [proposals, setProposals] = useState<PurchaseProposal[]>([])

  // InspectionProvider bọc TOÀN BỘ app ở layout.tsx (kể cả /login, trước khi có token) - chỉ gọi
  // API khi đã đăng nhập, tránh bắn request chắc chắn 401 (không có token) ngay trên màn hình
  // đăng nhập. `token` chỉ có sau khi AuthProvider khôi phục xong phiên (xem AuthContext.tsx).
  useEffect(() => {
    if (!token) return
    fetchPurchaseProposals()
      .then(setProposals)
      .catch(err => console.error('getPurchaseProposals failed', err))
  }, [token])

  const sendRequest = useCallback((pf: Sku) => {
    setRequests(prev => {
      if (prev.some(r => r.skuId === pf.id)) return prev
      const { phoiSonHan, vatTuTP, thanhPham } = buildKhoItems(pf)
      const newReq: InspRequest = {
        id:               `insp-${pf.id}`,
        skuId:       pf.id,
        poNumber:         pf.exportOrder?.poNumber ?? 'Chưa gắn đơn hàng',
        skuCode:          pf.mfgProduct?.factoryCode ?? `#${pf.mfgProductId}`,
        skuName:          pf.mfgProduct?.name,
        sentAt:           new Date().toISOString(),
        deadline:         pf.exportOrder?.deliveryDate,
        // Chỉ lấy children nhóm Sắt — manhData.pieces giờ gồm cả 5 nhóm (Sắt/Dây/Đinh/Tán rút/
        // Nút nhựa), nhưng "Xuất sắt cho Phôi" bên dưới chỉ đúng nghĩa với đoạn sắt.
        manhItems:        pf.manhData?.pieces?.map(p => ({ ...p, children: p.children.filter(c => c.group === 'sat') })),
        phoiSonHan:       { status: 'pending', items: phoiSonHan },
        vatTuTP:          { status: 'pending', items: vatTuTP },
        thanhPham:        { status: 'pending', items: thanhPham },
        proposalCreated:  false,
      }
      return [...prev, newReq]
    })
  }, [])

  const submitKho = useCallback((requestId: string, kho: KhoKey, items: InspItem[]) => {
    setRequests(prev => prev.map(r => {
      if (r.id !== requestId) return r
      const updated: KhoState = { status: 'done', items, submittedAt: new Date().toISOString() }
      return kho === 'phoiSonHan' ? { ...r, phoiSonHan: updated }
        : kho === 'vatTuTP' ? { ...r, vatTuTP: updated }
        : { ...r, thanhPham: updated }
    }))
  }, [])

  const markProposalCreated = useCallback((
    requestId: string,
    items: PurchaseProposalItem[],
    meta: ProposalMeta,
  ) => {
    setRequests(prev => prev.map(r => r.id === requestId ? { ...r, proposalCreated: true } : r))
    // setProposals chỉ tính toán state mới (phải "pure") — created được lấy ra ngoài để
    // ghi audit log sau khi cập nhật xong, không gọi logAction (side effect) trong updater.
    let created: PurchaseProposal[] = []
    setProposals(prev => {
      const now = new Date().toISOString()
      // 1 lần "Tạo đề xuất mua hàng" của KHSX có thể gồm vật tư của nhiều kho — tách
      // thành 1 PurchaseProposal riêng cho mỗi kho để route đúng Purchasing phụ trách.
      const itemsByKho = new Map<KhoKey, PurchaseProposalItem[]>()
      items.forEach(item => {
        if (!itemsByKho.has(item.khoKey)) itemsByKho.set(item.khoKey, [])
        itemsByKho.get(item.khoKey)!.push(item)
      })

      const next: PurchaseProposal[] = []
      itemsByKho.forEach((khoItems, khoKey) => {
        const id = `prop-${requestId}-${khoKey}`
        // Guard chống tạo trùng theo từng kho (không phải theo cả requestId) — nếu không,
        // sau khi tạo xong kho đầu tiên thì các kho còn lại của cùng request sẽ bị chặn.
        if (prev.some(p => p.id === id) || next.some(p => p.id === id)) return
        next.push({
          id,
          requestId,
          skuId: meta.skuId,
          poNumber:   meta.poNumber,
          skuCode:    meta.skuCode,
          skuName:    meta.skuName,
          deadline:   meta.deadline,
          createdAt:  now,
          warehouseScope: KHO_KEY_TO_WAREHOUSE_SCOPE[khoKey],
          items: khoItems,
          status: 'new',
        })
      })
      created = next
      return next.length > 0 ? [...prev, ...next] : prev
    })
    created.forEach(p => logAction(PROPOSAL_ENTITY, p.id, 'proposal.created'))
  }, [logAction])

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

  const approveProposal = useCallback((proposalId: string, chosenSuppliers: Record<string, string>) => {
    const current = proposals.find(p => p.id === proposalId)
    if (!current) return
    void approveProposalApi(current, chosenSuppliers)
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
  const receiveProposalItem = useCallback((proposalId: string, itemName: string, qty: number) => {
    const current = proposals.find(p => p.id === proposalId)
    if (!current) return
    const wasPurchased = current.status === 'purchased'
    void receiveProposalItemApi(current, itemName, qty)
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
  // cộng đúng dòng vật tư.
  const startProduction = useCallback((requestId: string) => {
    const req = requests.find(r => r.id === requestId)
    if (req) {
      // Có định mức mảnh thật (account Sắt đã nhập, xem "Định mức mảnh" ở Duyệt SKU) → đồng bộ
      // theo đúng từng mảnh (Mảnh Tựa, Mảnh Mê...) để "Xuất sắt cho Phôi"/"Lệnh sản xuất Phôi"
      // nhóm giống các PO đã có sẵn (vd PO-2026-002 nhóm theo "Mảnh Tựa"/"Mảnh Chân"). Chưa có
      // (đa số SKU cũ) thì rơi về cách cũ: gộp chung 1 mảnh mặc định "Vật tư sắt định mức".
      let syncItems: DinhMucSatSyncItem[] = []
      if (req.manhItems && req.manhItems.length > 0) {
        let idx = 0
        for (const manh of req.manhItems) {
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
    setRequests(prev => prev.map(r =>
      r.id === requestId ? { ...r, productionStarted: true, productionStartedAt: new Date().toISOString() } : r
    ))
    logAction('InspRequest', requestId, 'request.production_started')
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
