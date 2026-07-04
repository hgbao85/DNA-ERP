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

interface InspCtxType {
  requests: InspRequest[]
  sendRequest:         (pf: PlanForm) => void
  submitKho:           (requestId: string, kho: KhoKey, items: InspItem[]) => void
  markProposalCreated: (requestId: string) => void
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

// ── Context ────────────────────────────────────────────────────────────────────

const InspCtx = createContext<InspCtxType | undefined>(undefined)

export function InspectionProvider({ children }: { children: React.ReactNode }) {
  const [requests, setRequests] = useState<InspRequest[]>([])

  const sendRequest = useCallback((pf: PlanForm) => {
    setRequests(prev => {
      if (prev.some(r => r.planFormId === pf.id)) return prev   // already sent
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

  const markProposalCreated = useCallback((requestId: string) => {
    setRequests(prev => prev.map(r => r.id === requestId ? { ...r, proposalCreated: true } : r))
  }, [])

  return (
    <InspCtx.Provider value={{ requests, sendRequest, submitKho, markProposalCreated }}>
      {children}
    </InspCtx.Provider>
  )
}

export function useInspection(): InspCtxType {
  const ctx = useContext(InspCtx)
  if (!ctx) throw new Error('useInspection must be used inside InspectionProvider')
  return ctx
}
