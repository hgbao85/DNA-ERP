import { useState } from 'react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { useAuth } from '../../../context/AuthContext'
import { format } from 'date-fns'
import { AlertCircle } from 'lucide-react'
import MfgPhoiPage from './MfgPhoiPage'
import MfgStagePage from './MfgStagePage'
import DanManhPanel from './DanManhPanel'

// QC không còn là công đoạn tiến độ — KCS nằm trong từng công đoạn (point 6)
const STAGE_ORDER = ['PHOI', 'HAN', 'SON', 'WEAVING'] as const
type StageKey = typeof STAGE_ORDER[number]

const STAGE_LABEL: Record<StageKey, string> = {
  PHOI: 'Phôi', HAN: 'Hàn', SON: 'Sơn', WEAVING: 'Đan',
}

const ROLE_ALLOWED: Record<string, StageKey[]> = {
  PHOI:              ['PHOI'],
  HAN:               ['HAN'],
  SON:               ['SON'],
  WEAVING_MANAGER:   ['WEAVING'],
  QC:                ['PHOI', 'HAN', 'SON'], // QC duyệt KCS cả Phôi/Hàn/Sơn
  PRODUCTION_MANAGER: [...STAGE_ORDER],
  FACTORY_SALES:     [...STAGE_ORDER],
}

interface BoardProps {
  initialPiId?: number       // drill-down từ màn Điều hành xưởng
  initialStage?: StageKey
  onBack?: () => void        // quay về bảng điều hành
}

export default function MfgStageBoardPage({ initialPiId, initialStage, onBack }: BoardProps = {}) {
  const { user } = useAuth()
  const allowedStages: StageKey[] = user?.mfgRole
    ? (ROLE_ALLOWED[user.mfgRole] ?? [])
    : [...STAGE_ORDER]

  const defaultStage: StageKey = initialStage ?? allowedStages[0] ?? 'PHOI'
  const [selectedPiId, setSelectedPiId] = useState<number | null>(initialPiId ?? null)
  const [activeStage, setActiveStage] = useState<StageKey>(defaultStage)

  const { data: pis, isLoading, error } = useFetch(() => api.getProductionInvoices(), [])
  const activePIs = Array.isArray(pis)
    ? pis.filter((p: any) => p.status !== 'DONE' && p.status !== 'CANCELLED')
    : []

  const activePi = activePIs.find((p: any) => p.id === selectedPiId) ?? activePIs[0] ?? null

  const { data: stagesRaw } = useFetch(
    () => activePi ? api.getStagesByPI(activePi.id) : Promise.resolve([]),
    [activePi?.id]
  )
  const rawStages = Array.isArray(stagesRaw) ? stagesRaw : []

  const { data: manhRaw, refetch: refetchManh } = useFetch(() => api.getWeavingManhSummary(), [])
  const manhList = Array.isArray(manhRaw) ? manhRaw : []

  // Sort stages in production order (PHOI→HAN→SON→WEAVING)
  const orderedStages = STAGE_ORDER
    .map(st => rawStages.find((s: any) => s.stageType === st))
    .filter(Boolean) as any[]

  const getStage = (type: StageKey) => orderedStages.find(s => s.stageType === type)

  if (isLoading) return <div style={{ padding: 40, color: 'var(--text3)' }}>Đang tải...</div>
  if (error) return <div style={{ color: '#c62828', display: 'flex', gap: 6 }}><AlertCircle size={16} />Lỗi tải dữ liệu</div>
  if (activePIs.length === 0) return <div style={{ color: 'var(--text3)', fontSize: 13 }}>Không có lệnh SX đang hoạt động</div>

  // Đan: % suy ra từ Σ đã thu / Σ cần (không còn nhập % tay). Chỉ Đan Trưởng/Quản lý SX nhập mảnh.
  const danSummary = manhList.find((m: any) => m.piId === activePi?.id) ?? null
  const danTotals = danSummary
    ? danSummary.pieces.reduce((a: { c: number; t: number }, p: { target: number; received: number }) => ({ c: a.c + p.target, t: a.t + p.received }), { c: 0, t: 0 })
    : { c: 0, t: 0 }
  const danPct = danTotals.c > 0 ? Math.round((danTotals.t / danTotals.c) * 100) : 0
  const canNhapManh = user?.mfgRole === 'WEAVING_MANAGER' || user?.mfgRole === 'PRODUCTION_MANAGER'

  return (
    <div>
      {onBack && (
        <button onClick={onBack}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 12, padding: '6px 12px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: 13, color: 'var(--text2)', fontWeight: 600 }}>
          ← Về bảng điều hành
        </button>
      )}
      <h2 style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 700 }}>Bảng tiến độ sản xuất</h2>

      {/* ── PI Selector ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {activePIs.map((pi: any) => {
          const isSelected = (selectedPiId ?? activePIs[0]?.id) === pi.id
          return (
            <button key={pi.id} onClick={() => setSelectedPiId(pi.id)} style={{
              padding: '6px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
              background: isSelected ? '#e65100' : 'var(--surface)',
              color: isSelected ? '#fff' : 'var(--text)',
              fontWeight: 600, fontSize: 12, cursor: 'pointer',
            }}>
              {pi.code}
            </button>
          )
        })}
      </div>

      {activePi && (
        <>
          {/* PI summary */}
          <div style={{ background: 'var(--surface2)', borderRadius: 'var(--radius)', padding: '10px 16px', marginBottom: 20, fontSize: 13, display: 'flex', gap: 24 }}>
            <span><strong>{activePi.code}</strong></span>
            <span>Deadline: <strong>{format(new Date(activePi.deadline), 'dd/MM/yyyy')}</strong></span>
            {(() => {
              const md = (activePi.items as any[])
                ?.map((it: any) => it.materialDeadline)
                .filter(Boolean)
                .sort()[0]
              return md
                ? <span style={{ color: 'var(--text3)' }}>Hạn vật tư: {format(new Date(md), 'dd/MM/yyyy')}</span>
                : null
            })()}
          </div>

          {/* ── Stage sub-tabs ────────────────────────────────────────── */}
          <div style={{ display: 'flex', gap: 2, borderBottom: '2px solid var(--border)', marginBottom: 20 }}>
            {STAGE_ORDER.filter(st => allowedStages.includes(st)).map(st => {
              const stage = getStage(st)
              const pct = st === 'WEAVING' ? danPct : (stage?.progressPercent ?? 0)
              const isActive = st === activeStage
              return (
                <button
                  key={st}
                  onClick={() => setActiveStage(st)}
                  style={{
                    padding: '10px 20px', border: 'none', fontSize: 13, cursor: 'pointer',
                    borderRadius: 'var(--radius) var(--radius) 0 0',
                    background: isActive ? 'var(--surface)' : 'transparent',
                    borderBottom: isActive ? '2px solid #e65100' : '2px solid transparent',
                    color: isActive ? '#e65100' : 'var(--text2)',
                    fontWeight: isActive ? 700 : 400,
                    marginBottom: -2,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  {STAGE_LABEL[st]}
                  <span style={{
                    fontSize: 10, padding: '1px 7px', borderRadius: 10, fontWeight: 700,
                    background: pct === 100 ? '#e8f5e9' : pct > 0 ? '#fff3e0' : 'var(--surface2)',
                    color: pct === 100 ? '#2e7d32' : pct > 0 ? '#e65100' : 'var(--text3)',
                  }}>
                    {pct}%
                  </span>
                </button>
              )
            })}
          </div>

          {/* ── Stage detail: Phôi · Hàn · Sơn · Đan đều là màn chi tiết theo mảnh (đồng bộ) ── */}
          {activeStage === 'PHOI' ? (
            <MfgPhoiPage piId={activePi.id} />
          ) : (activeStage === 'HAN' || activeStage === 'SON') ? (
            <MfgStagePage piId={activePi.id} stageType={activeStage} />
          ) : activeStage === 'WEAVING' ? (
            danSummary
              ? <DanManhPanel pi={danSummary} readOnly={!canNhapManh} onChanged={refetchManh} />
              : <div style={{ color: 'var(--text3)', fontSize: 13, padding: 16 }}>Lệnh SX này không có mảnh đan.</div>
          ) : null}
        </>
      )}
    </div>
  )
}
