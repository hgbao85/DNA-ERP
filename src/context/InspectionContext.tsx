'use client'
import { createContext, useContext, useState, useCallback } from 'react'
import type { PlanForm, ManhRow } from '../types/plan-form'
import type { WarehouseScope } from './AuthContext'
import { useAuditLog } from './AuditLogContext'
import { syncDinhMucSatVaoKeHoach, syncDinhMucSatVaoLenhPhoi, type DinhMucSatSyncItem } from '../services/api'
import { flattenManhSteel, combinedDaySon, dinhItems } from '../utils/manhMaterials'

export const PROPOSAL_ENTITY = 'PurchaseProposal'

// ── Types ──────────────────────────────────────────────────────────────────────

export type KhoKey = 'phoiSonHan' | 'vatTuTP' | 'thanhPham'

// Kho phụ trách của từng nhóm vật tư — dùng để tách đề xuất mua theo kho và route
// tới đúng tài khoản Purchasing (user.warehouseScope) phụ trách kho đó. Thêm kho mới
// chỉ cần thêm 1 dòng ở đây, không phải sửa logic tách/route ở nơi khác.
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
  id: string                   // `insp-${planFormId}`
  planFormId: number
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
  planFormId: number
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

interface ProposalMeta { planFormId: number; poNumber: string; skuCode: string; skuName?: string; deadline?: string }

interface InspCtxType {
  requests: InspRequest[]
  proposals: PurchaseProposal[]
  sendRequest:             (pf: PlanForm) => void
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
function buildKhoItems(pf: PlanForm): { phoiSonHan: InspItem[]; vatTuTP: InspItem[]; thanhPham: InspItem[] } {
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
      ...(mt?.vatTuPhuKien ?? []).map(x => toItem(x.name, x.unit ?? 'cái', x.quantity ?? 0)),
    ],
    thanhPham: [
      ...(mt?.baoBiDongGoi ?? []).map(x => toItem(x.name, x.unit ?? 'cái', x.quantity ?? 0)),
    ],
  }
}

// ── Mock seed data ─────────────────────────────────────────────────────────────

// planFormId khớp đúng seedPlanForms (id 1 = JSE-55/PO-MY-001, id 2 = IEA-3/PO-GP-002) — trước đây
// seed dùng planFormId 101/102 không khớp PlanForm thật nào nên 2 yêu cầu này không bao giờ hiện
// trong "Lệnh kiểm tra vật tư" của KHSX (danh sách luôn lọc theo id PlanForm thật). Tên vật tư trong
// từng items[] cũng phải khớp CHÍNH XÁC với seedPlanForms[].quotaManagement.materialType — màn hình
// KHSX tra tồn thực bằng cách so tên (findInspItem), tên lệch thì mọi dòng hiện "—" dù badge kho báo
// đã kiểm. Đồng thời tách bao bì đóng gói ra kho thành phẩm (thanhPham) thay vì gộp chung vatTuTP,
// khớp CATEGORY_WAREHOUSE_CODE.
const SEED_REQUESTS: InspRequest[] = [
  {
    id: 'insp-1', planFormId: 1,
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
    id: 'insp-2', planFormId: 2,
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

// Mỗi PlanForm thiếu hàng ở nhiều kho trước đây gộp chung 1 proposal — nay tách thành
// 1 proposal/kho (id `prop-${requestId}-${khoKey}`) để route đúng Purchasing phụ trách kho đó.
const SEED_PROPOSALS: PurchaseProposal[] = [
  {
    id: 'prop-insp-1-phoiSonHan', requestId: 'insp-1', planFormId: 1,
    poNumber: 'PO-MY-001', skuCode: 'JSE-55', skuName: 'Ghế J55',
    createdAt: '2026-07-04T08:10:00.000Z',
    deadline: '2026-07-25T00:00:00.000Z',
    status: 'new',
    warehouseScope: 'phoi-son-han',
    items: [
      { name: 'Sắt hộp 25×25', unit: 'cây', required: 20, actualStock: 12, buyQty: 8, khoKey: 'phoiSonHan', khoLabel: 'Kho Phôi Sơn Hàn', materialId: 1 },
      { name: 'Sắt tấm 3mm',   unit: 'tấm', required: 2,  actualStock: 1,  buyQty: 1, khoKey: 'phoiSonHan', khoLabel: 'Kho Phôi Sơn Hàn', materialId: 3 },
    ],
  },
  {
    id: 'prop-insp-1-vatTuTP', requestId: 'insp-1', planFormId: 1,
    poNumber: 'PO-MY-001', skuCode: 'JSE-55', skuName: 'Ghế J55',
    createdAt: '2026-07-04T08:10:00.000Z',
    deadline: '2026-07-25T00:00:00.000Z',
    status: 'new',
    warehouseScope: 'vat-tu-tp',
    items: [
      { name: 'Ốc vít M6×20',  unit: 'cái', required: 48, actualStock: 30, buyQty: 18, khoKey: 'vatTuTP', khoLabel: 'Kho Vật tư thành phẩm', materialId: 1 },
    ],
  },
  {
    id: 'prop-insp-1-thanhPham', requestId: 'insp-1', planFormId: 1,
    poNumber: 'PO-MY-001', skuCode: 'JSE-55', skuName: 'Ghế J55',
    createdAt: '2026-07-04T08:10:00.000Z',
    deadline: '2026-07-25T00:00:00.000Z',
    status: 'new',
    warehouseScope: 'thanh-pham',
    items: [
      { name: 'Xốp PE bảo vệ', unit: 'm²',  required: 2,  actualStock: 1,  buyQty: 1, khoKey: 'thanhPham', khoLabel: 'Kho Thành phẩm', materialId: 2 },
    ],
  },
  {
    id: 'prop-insp-2-phoiSonHan', requestId: 'insp-2', planFormId: 2,
    poNumber: 'PO-GP-002', skuCode: 'IEA-3', skuName: 'Ghế đan IEA-3',
    createdAt: '2026-07-03T09:20:00.000Z',
    deadline: '2026-07-20T00:00:00.000Z',
    submittedAt: '2026-07-03T09:45:00.000Z',
    status: 'submitted',
    warehouseScope: 'phoi-son-han',
    items: [
      { name: 'Sắt dẹt 20×3', unit: 'cây', required: 4, actualStock: 3, buyQty: 1, khoKey: 'phoiSonHan', khoLabel: 'Kho Phôi Sơn Hàn', materialId: 5 },
    ],
    quotes: {
      'Sắt dẹt 20×3': [{ supplierName: 'Minh Thành', unitPrice: 45000 }, { supplierName: 'An Phát', unitPrice: 43500 }, { supplierName: 'Long Sơn', unitPrice: 46000 }],
    },
  },
  {
    id: 'prop-insp-2-vatTuTP', requestId: 'insp-2', planFormId: 2,
    poNumber: 'PO-GP-002', skuCode: 'IEA-3', skuName: 'Ghế đan IEA-3',
    createdAt: '2026-07-03T09:20:00.000Z',
    deadline: '2026-07-20T00:00:00.000Z',
    submittedAt: '2026-07-03T09:45:00.000Z',
    status: 'submitted',
    warehouseScope: 'vat-tu-tp',
    items: [
      { name: 'Dây nhựa xanh lá', unit: 'cuộn', required: 2.0, actualStock: 1.2, buyQty: 0.8, khoKey: 'vatTuTP', khoLabel: 'Kho Vật tư thành phẩm', materialId: 3 },
    ],
    quotes: {
      'Dây nhựa xanh lá': [{ supplierName: 'Tiến Thịnh', unitPrice: 11500 }, { supplierName: 'An Phát', unitPrice: 11800 }],
    },
  },
  {
    id: 'prop-insp-2-thanhPham', requestId: 'insp-2', planFormId: 2,
    poNumber: 'PO-GP-002', skuCode: 'IEA-3', skuName: 'Ghế đan IEA-3',
    createdAt: '2026-07-03T09:20:00.000Z',
    deadline: '2026-07-20T00:00:00.000Z',
    submittedAt: '2026-07-03T09:45:00.000Z',
    status: 'submitted',
    warehouseScope: 'thanh-pham',
    items: [
      { name: 'Xốp chèn góc', unit: 'bộ', required: 4, actualStock: 2, buyQty: 2, khoKey: 'thanhPham', khoLabel: 'Kho Thành phẩm', materialId: 5 },
    ],
    quotes: {
      'Xốp chèn góc': [{ supplierName: 'Bao bì Việt', unitPrice: 18000 }, { supplierName: 'Tiến Long', unitPrice: 17500 }],
    },
  },
]

// ── Context ────────────────────────────────────────────────────────────────────

const InspCtx = createContext<InspCtxType | undefined>(undefined)

export function InspectionProvider({ children }: { children: React.ReactNode }) {
  const { logAction } = useAuditLog()
  const [requests,  setRequests]  = useState<InspRequest[]>(SEED_REQUESTS)
  const [proposals, setProposals] = useState<PurchaseProposal[]>(SEED_PROPOSALS)

  const sendRequest = useCallback((pf: PlanForm) => {
    setRequests(prev => {
      if (prev.some(r => r.planFormId === pf.id)) return prev
      const { phoiSonHan, vatTuTP, thanhPham } = buildKhoItems(pf)
      const newReq: InspRequest = {
        id:               `insp-${pf.id}`,
        planFormId:       pf.id,
        poNumber:         pf.exportOrder?.poNumber ?? `#${pf.exportOrderId}`,
        skuCode:          pf.mfgProduct?.factoryCode ?? `#${pf.mfgProductId}`,
        skuName:          pf.mfgProduct?.name,
        sentAt:           new Date().toISOString(),
        deadline:         pf.exportOrder?.deliveryDate,
        manhItems:        pf.manhData?.sat,
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
          planFormId: meta.planFormId,
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
    setProposals(prev => prev.map(p => p.id === proposalId ? { ...p, status: 'quoting' } : p))
    logAction(PROPOSAL_ENTITY, proposalId, 'proposal.acknowledged')
  }, [logAction])

  const submitProposalToDirector = useCallback((proposalId: string, quotes: Record<string, ProposalQuote[]>) => {
    setProposals(prev => prev.map(p =>
      p.id === proposalId ? { ...p, status: 'submitted', quotes, submittedAt: new Date().toISOString() } : p
    ))
    logAction(PROPOSAL_ENTITY, proposalId, 'proposal.quote_submitted')
  }, [logAction])

  const approveProposal = useCallback((proposalId: string, chosenSuppliers: Record<string, string>) => {
    setProposals(prev => prev.map(p =>
      p.id === proposalId ? { ...p, status: 'purchasing', chosenSuppliers, approvedAt: new Date().toISOString() } : p
    ))
    logAction(PROPOSAL_ENTITY, proposalId, 'proposal.approved')
  }, [logAction])

  const rejectProposal = useCallback((proposalId: string, reason: string) => {
    setProposals(prev => prev.map(p =>
      p.id === proposalId ? { ...p, status: 'rejected', rejectedAt: new Date().toISOString(), rejectionReason: reason } : p
    ))
    logAction(PROPOSAL_ENTITY, proposalId, 'proposal.rejected', reason)
  }, [logAction])

  // Mở lại luồng báo giá sau khi bị từ chối — giữ nguyên quotes/rejectionReason cũ làm lịch sử,
  // chỉ đổi status để Purchasing sửa tiếp và gửi lại.
  const requoteProposal = useCallback((proposalId: string) => {
    setProposals(prev => prev.map(p =>
      p.id === proposalId && p.status === 'rejected' ? { ...p, status: 'quoting' } : p
    ))
    logAction(PROPOSAL_ENTITY, proposalId, 'proposal.requoted')
  }, [logAction])

  // Thủ kho xác nhận đã nhận hàng — cộng dồn qua nhiều lần nhập (hàng có thể về nhiều đợt).
  // Khi mọi item của proposal đã nhận đủ buyQty thì tự chuyển 'purchasing' -> 'purchased'.
  const receiveProposalItem = useCallback((proposalId: string, itemName: string, qty: number) => {
    let justCompleted = false
    const now = new Date().toISOString()
    setProposals(prev => prev.map(p => {
      if (p.id !== proposalId) return p
      const items = p.items.map(it => it.name === itemName
        ? { ...it, receivedQty: Math.min(it.buyQty, (it.receivedQty ?? 0) + Math.max(0, qty)) }
        : it)
      const allReceived = items.every(it => (it.receivedQty ?? 0) >= it.buyQty)
      if (allReceived && p.status !== 'purchased') justCompleted = true
      return allReceived
        ? { ...p, items, status: 'purchased', purchasedAt: now }
        : { ...p, items }
    }))
    if (justCompleted) logAction(PROPOSAL_ENTITY, proposalId, 'proposal.purchased')
  }, [logAction])

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
              lineId: 9000 + req.planFormId * 20 + idx,
              name: child.name, unit: 'cây', required, manhTen: manh.name,
            })
            idx++
          }
        }
      } else {
        syncItems = req.phoiSonHan.items
          .filter(i => !isSon(i.name) && i.required > 0)
          .map((it, idx) => ({
            lineId: 9000 + req.planFormId * 20 + idx,
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
