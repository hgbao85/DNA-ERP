'use client'
import { createContext, useContext, useState, useCallback } from 'react'
import type { PlanForm } from '../types/plan-form'

// ── Types ──────────────────────────────────────────────────────────────────────

export type KhoKey = 'phoiSonHan' | 'vatTuTP'

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
  proposalCreated: boolean
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
  status: 'new' | 'quoting' | 'submitted' | 'approved' | 'rejected'
  quotes?: Record<string, ProposalQuote[]>  // keyed by item.name → multiple NCC offers
  chosenSuppliers?: Record<string, string>  // item.name → chosen supplierName (set by manager)
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

function buildKhoItems(pf: PlanForm): { phoiSonHan: InspItem[]; vatTuTP: InspItem[] } {
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
      ...(mt?.baoBiDongGoi ?? []).map(x => toItem(x.name, x.unit ?? 'cái', x.quantity ?? 0)),
    ],
  }
}

// ── Mock seed data ─────────────────────────────────────────────────────────────

const SEED_REQUESTS: InspRequest[] = [
  {
    id: 'insp-102', planFormId: 102,
    poNumber: 'PO-2602', skuCode: 'SF-011', skuName: 'Ghế sofa văn phòng',
    sentAt: '2026-07-04T07:30:00.000Z',
    phoiSonHan: {
      status: 'done', submittedAt: '2026-07-04T08:00:00.000Z',
      items: [
        { name: 'Thép tấm 2mm',  unit: 'kg',  required: 300, actualStock: 150 },
        { name: 'Sơn lót epoxy', unit: 'kg',  required: 80,  actualStock: 20  },
      ],
    },
    vatTuTP: {
      status: 'done', submittedAt: '2026-07-04T08:05:00.000Z',
      items: [
        { name: 'Vít tự khoan M5', unit: 'cái', required: 500, actualStock: 200 },
        { name: 'Túi PE đóng gói', unit: 'cái', required: 200, actualStock: 50  },
      ],
    },
    proposalCreated: true,
  },
  {
    id: 'insp-101', planFormId: 101,
    poNumber: 'PO-2601', skuCode: 'GX-009', skuName: 'Ghế xoay cao cấp',
    sentAt: '2026-07-03T08:15:00.000Z',
    phoiSonHan: {
      status: 'done', submittedAt: '2026-07-03T09:00:00.000Z',
      items: [
        { name: 'Thép ống D25×1.5',  unit: 'kg', required: 500, actualStock: 320 },
        { name: 'Sơn tĩnh điện đen', unit: 'kg', required: 200, actualStock: 80  },
      ],
    },
    vatTuTP: {
      status: 'done', submittedAt: '2026-07-03T09:10:00.000Z',
      items: [
        { name: 'Dây đan PE 2mm',      unit: 'm',   required: 1000, actualStock: 600 },
        { name: 'Ốc vít M6×20',         unit: 'cái', required: 800,  actualStock: 800 },
        { name: 'Bao bì carton 5 lớp',  unit: 'cái', required: 300,  actualStock: 120 },
      ],
    },
    proposalCreated: true,
  },
]

const SEED_PROPOSALS: PurchaseProposal[] = [
  {
    id: 'prop-insp-102', requestId: 'insp-102', planFormId: 102,
    poNumber: 'PO-2602', skuCode: 'SF-011', skuName: 'Ghế sofa văn phòng',
    createdAt: '2026-07-04T08:10:00.000Z',
    deadline: '2026-07-25T00:00:00.000Z',
    status: 'new',
    items: [
      { name: 'Thép tấm 2mm',    unit: 'kg',  required: 300, actualStock: 150, buyQty: 150, khoLabel: 'Kho Phôi Sơn Hàn', materialId: 22 },
      { name: 'Sơn lót epoxy',   unit: 'kg',  required: 80,  actualStock: 20,  buyQty: 60,  khoLabel: 'Kho Phôi Sơn Hàn', materialId: 23 },
      { name: 'Vít tự khoan M5', unit: 'cái', required: 500, actualStock: 200, buyQty: 300, khoLabel: 'Kho Vật tư / TP',   materialId: 24 },
      { name: 'Túi PE đóng gói', unit: 'cái', required: 200, actualStock: 50,  buyQty: 150, khoLabel: 'Kho Vật tư / TP',   materialId: 25 },
    ],
  },
  {
    id: 'prop-insp-101', requestId: 'insp-101', planFormId: 101,
    poNumber: 'PO-2601', skuCode: 'GX-009', skuName: 'Ghế xoay cao cấp',
    createdAt: '2026-07-03T09:20:00.000Z',
    deadline: '2026-07-20T00:00:00.000Z',
    submittedAt: '2026-07-03T09:45:00.000Z',
    status: 'submitted',
    items: [
      { name: 'Thép ống D25×1.5',   unit: 'kg',  required: 500,  actualStock: 320, buyQty: 180, khoLabel: 'Kho Phôi Sơn Hàn', materialId: 18 },
      { name: 'Sơn tĩnh điện đen',  unit: 'kg',  required: 200,  actualStock: 80,  buyQty: 120, khoLabel: 'Kho Phôi Sơn Hàn', materialId: 19 },
      { name: 'Dây đan PE 2mm',      unit: 'm',   required: 1000, actualStock: 600, buyQty: 400, khoLabel: 'Kho Vật tư / TP',   materialId: 20 },
      { name: 'Bao bì carton 5 lớp', unit: 'cái', required: 300,  actualStock: 120, buyQty: 180, khoLabel: 'Kho Vật tư / TP',   materialId: 21 },
    ],
    quotes: {
      'Thép ống D25×1.5':   [{ supplierName: 'Minh Thành', unitPrice: 45000 }, { supplierName: 'An Phát',    unitPrice: 43500 }, { supplierName: 'Long Sơn',   unitPrice: 46000 }],
      'Sơn tĩnh điện đen':  [{ supplierName: 'Việt Thắng', unitPrice: 82000 }, { supplierName: 'Đại Hưng',  unitPrice: 85000 }],
      'Dây đan PE 2mm':     [{ supplierName: 'Tiến Thịnh', unitPrice: 11500 }, { supplierName: 'An Phát',   unitPrice: 11800 }],
      'Bao bì carton 5 lớp':[{ supplierName: 'Bao bì Việt',unitPrice: 18000 }, { supplierName: 'Tiến Long', unitPrice: 17500 }],
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
      const { phoiSonHan, vatTuTP } = buildKhoItems(pf)
      const newReq: InspRequest = {
        id:               `insp-${pf.id}`,
        planFormId:       pf.id,
        poNumber:         pf.exportOrder?.poNumber ?? `#${pf.exportOrderId}`,
        skuCode:          pf.mfgProduct?.factoryCode ?? `#${pf.mfgProductId}`,
        skuName:          pf.mfgProduct?.name,
        sentAt:           new Date().toISOString(),
        phoiSonHan:       { status: 'pending', items: phoiSonHan },
        vatTuTP:          { status: 'pending', items: vatTuTP },
        proposalCreated:  false,
      }
      return [...prev, newReq]
    })
  }, [])

  const submitKho = useCallback((requestId: string, kho: KhoKey, items: InspItem[]) => {
    setRequests(prev => prev.map(r => {
      if (r.id !== requestId) return r
      const updated: KhoState = { status: 'done', items, submittedAt: new Date().toISOString() }
      return kho === 'phoiSonHan' ? { ...r, phoiSonHan: updated } : { ...r, vatTuTP: updated }
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
      p.id === proposalId ? { ...p, status: 'approved', chosenSuppliers, approvedAt: new Date().toISOString() } : p
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
