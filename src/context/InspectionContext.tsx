'use client'
import { createContext, useContext, useState, useCallback } from 'react'
import type { PlanForm } from '../types/plan-form'

// ── Types ──────────────────────────────────────────────────────────────────────

export type KhoKey = 'phoiSonHan' | 'vatTuTP' | 'thanhPham'

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
  phoiSonHan: KhoState
  vatTuTP: KhoState
  thanhPham: KhoState
  proposalCreated: boolean
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
  khoLabel: string
  materialId?: number
}

export interface ProposalQuote {
  supplierName: string
  unitPrice: number | null
  expectedDate?: string
  note?: string
}

export interface PurchaseProposal {
  id: string           // `prop-${requestId}`
  requestId: string
  planFormId: number
  poNumber: string
  skuCode: string
  skuName?: string
  createdAt: string
  items: PurchaseProposalItem[]
  status: 'new' | 'quoting' | 'submitted' | 'purchasing' | 'rejected'
  quotes?: Record<string, ProposalQuote[]>  // keyed by item.name → multiple NCC offers
  chosenSuppliers?: Record<string, string>  // item.name → chosen supplierName (set by boss)
  deadline?: string
  submittedAt?: string
  approvedAt?: string
  rejectedAt?: string
  rejectionReason?: string
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
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const isSon = (name: string) => /sơn|son|primer|lót|phủ|hardener|thinner/i.test(name)

// Phân bổ theo đúng CATEGORY_WAREHOUSE_CODE (purchase-order.ts): sat/son -> phôi sơn hàn,
// day/vatTuPhuKien -> vật tư thành phẩm, baoBiDongGoi -> kho thành phẩm (nơi đóng gói).
function buildKhoItems(pf: PlanForm): { phoiSonHan: InspItem[]; vatTuTP: InspItem[]; thanhPham: InspItem[] } {
  const mt = pf.quotaManagement?.materialType
  const toItem = (name: string, unit: string, required: number): InspItem => ({
    name, unit, required: Math.max(0, required), actualStock: null,
  })
  return {
    phoiSonHan: [
      ...(mt?.sat    ?? []).map(x => toItem(x.name, x.unit ?? 'kg', x.quantity ?? 0)),
      ...(mt?.daySon ?? []).filter(x => isSon(x.name)).map(x => toItem(x.name, x.unit ?? 'kg', x.kg ?? 0)),
    ],
    vatTuTP: [
      ...(mt?.daySon       ?? []).filter(x => !isSon(x.name)).map(x => toItem(x.name, x.unit ?? 'm',   x.kg       ?? 0)),
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
// trong "Lệnh kiểm tra vật tư" của QLSX (danh sách luôn lọc theo id PlanForm thật). Tên vật tư trong
// từng items[] cũng phải khớp CHÍNH XÁC với seedPlanForms[].quotaManagement.materialType — màn hình
// QLSX tra tồn thực bằng cách so tên (findInspItem), tên lệch thì mọi dòng hiện "—" dù badge kho báo
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

const SEED_PROPOSALS: PurchaseProposal[] = [
  {
    id: 'prop-insp-1', requestId: 'insp-1', planFormId: 1,
    poNumber: 'PO-MY-001', skuCode: 'JSE-55', skuName: 'Ghế J55',
    createdAt: '2026-07-04T08:10:00.000Z',
    deadline: '2026-07-25T00:00:00.000Z',
    status: 'new',
    items: [
      { name: 'Sắt hộp 25×25', unit: 'cây', required: 20, actualStock: 12, buyQty: 8, khoLabel: 'Kho Phôi Sơn Hàn', materialId: 1 },
      { name: 'Sắt tấm 3mm',   unit: 'tấm', required: 2,  actualStock: 1,  buyQty: 1, khoLabel: 'Kho Phôi Sơn Hàn', materialId: 3 },
      { name: 'Ốc vít M6×20',  unit: 'cái', required: 48, actualStock: 30, buyQty: 18, khoLabel: 'Kho Vật tư thành phẩm', materialId: 1 },
      { name: 'Xốp PE bảo vệ', unit: 'm²',  required: 2,  actualStock: 1,  buyQty: 1, khoLabel: 'Kho Thành phẩm', materialId: 2 },
    ],
  },
  {
    id: 'prop-insp-2', requestId: 'insp-2', planFormId: 2,
    poNumber: 'PO-GP-002', skuCode: 'IEA-3', skuName: 'Ghế đan IEA-3',
    createdAt: '2026-07-03T09:20:00.000Z',
    deadline: '2026-07-20T00:00:00.000Z',
    submittedAt: '2026-07-03T09:45:00.000Z',
    status: 'submitted',
    items: [
      { name: 'Sắt dẹt 20×3',      unit: 'cây',  required: 4,   actualStock: 3,   buyQty: 1,   khoLabel: 'Kho Phôi Sơn Hàn', materialId: 5 },
      { name: 'Dây nhựa xanh lá',  unit: 'cuộn', required: 2.0, actualStock: 1.2, buyQty: 0.8, khoLabel: 'Kho Vật tư thành phẩm', materialId: 3 },
      { name: 'Xốp chèn góc',      unit: 'bộ',   required: 4,   actualStock: 2,   buyQty: 2,   khoLabel: 'Kho Thành phẩm', materialId: 5 },
    ],
    quotes: {
      'Sắt dẹt 20×3':     [{ supplierName: 'Minh Thành', unitPrice: 45000 }, { supplierName: 'An Phát',    unitPrice: 43500 }, { supplierName: 'Long Sơn',   unitPrice: 46000 }],
      'Dây nhựa xanh lá': [{ supplierName: 'Tiến Thịnh', unitPrice: 11500 }, { supplierName: 'An Phát',    unitPrice: 11800 }],
      'Xốp chèn góc':     [{ supplierName: 'Bao bì Việt', unitPrice: 18000 }, { supplierName: 'Tiến Long', unitPrice: 17500 }],
    },
  },
]

// ── Context ────────────────────────────────────────────────────────────────────

const InspCtx = createContext<InspCtxType | undefined>(undefined)

export function InspectionProvider({ children }: { children: React.ReactNode }) {
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
    setProposals(prev => {
      if (prev.some(p => p.requestId === requestId)) return prev
      const proposal: PurchaseProposal = {
        id:         `prop-${requestId}`,
        requestId,
        planFormId: meta.planFormId,
        poNumber:   meta.poNumber,
        skuCode:    meta.skuCode,
        skuName:    meta.skuName,
        deadline:   meta.deadline,
        createdAt:  new Date().toISOString(),
        items,
        status:     'new',
      }
      return [...prev, proposal]
    })
  }, [])

  const acknowledgeProposal = useCallback((proposalId: string) => {
    setProposals(prev => prev.map(p => p.id === proposalId ? { ...p, status: 'quoting' } : p))
  }, [])

  const submitProposalToDirector = useCallback((proposalId: string, quotes: Record<string, ProposalQuote[]>) => {
    setProposals(prev => prev.map(p =>
      p.id === proposalId ? { ...p, status: 'submitted', quotes, submittedAt: new Date().toISOString() } : p
    ))
  }, [])

  const approveProposal = useCallback((proposalId: string, chosenSuppliers: Record<string, string>) => {
    setProposals(prev => prev.map(p =>
      p.id === proposalId ? { ...p, status: 'purchasing', chosenSuppliers, approvedAt: new Date().toISOString() } : p
    ))
  }, [])

  const rejectProposal = useCallback((proposalId: string, reason: string) => {
    setProposals(prev => prev.map(p =>
      p.id === proposalId ? { ...p, status: 'rejected', rejectedAt: new Date().toISOString(), rejectionReason: reason } : p
    ))
  }, [])

  return (
    <InspCtx.Provider value={{ requests, proposals, sendRequest, submitKho, markProposalCreated, acknowledgeProposal, submitProposalToDirector, approveProposal, rejectProposal }}>
      {children}
    </InspCtx.Provider>
  )
}

export function useInspection(): InspCtxType {
  const ctx = useContext(InspCtx)
  if (!ctx) throw new Error('useInspection must be used inside InspectionProvider')
  return ctx
}
