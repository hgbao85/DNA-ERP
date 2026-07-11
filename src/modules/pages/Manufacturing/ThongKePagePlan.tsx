import { useState } from 'react'
import { format } from 'date-fns'
import { ArrowLeft, CheckCircle2, Clock, Factory, PackageCheck, Search, ShoppingCart, TrendingUp, Wrench } from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { useInspection, type PurchaseProposal } from '../../../context/InspectionContext'
import type { PlanForm } from '../../../types/plan-form'

// ─── Types ───────────────────────────────────────────────────────────────────

type OrderStatus = 'PRODUCING' | 'DONE'
type MfgStage = 'PURCHASING' | 'FRAME' | 'WEAVING' | 'PACKAGING'
type SubStatus = 'done' | 'in-progress' | 'pending'

interface MaterialItem {
  name: string
  ncc: string
  unitPrice: number
  qty: number      // Tổng SL
  unit: string
  boughtQty: number // Đã mua
}

interface StageDetails {
  purchasing: { materials: MaterialItem[] }
  frame: { phoi: SubStatus; han: SubStatus; son: SubStatus }
  weaving: { nhapDan: SubStatus; xuatDan: SubStatus }
  packaging: { dongGoi: SubStatus }
}

interface MfgOrder {
  id: number
  code: string        // Mã PO — lấy từ exportOrder.poNumber (dữ liệu thật)
  sku: string
  productName: string
  customer: string
  deadline?: string
  approvedAt: string
  status: OrderStatus
  mfgStage?: MfgStage
}

// ─── Stage config ─────────────────────────────────────────────────────────────

const MFG_STAGES: { key: MfgStage; label: string; icon: React.ReactNode }[] = [
  { key: 'PURCHASING', label: 'Mua hàng',     icon: <ShoppingCart size={16} /> },
  { key: 'FRAME',      label: 'Khung cơ khí', icon: <Wrench size={16} /> },
  { key: 'WEAVING',    label: 'Đan',          icon: <Factory size={16} /> },
  { key: 'PACKAGING',  label: 'Đóng gói',     icon: <PackageCheck size={16} /> },
]

// ─── Dữ liệu thật: PlanForm + PurchaseProposal ───────────────────────────────
// "Danh sách" và "Nội dung mua hàng" đọc trực tiếp từ PlanForm/PurchaseProposal thật
// (giống TheoDoiMuaHangPage.tsx). Khung cơ khí/Đan/Đóng gói chưa có nguồn dữ liệu tổng
// hợp thật trong hệ thống (nằm rải ở nhiều module Phôi/Hàn/Sơn/Đan/Đóng gói khác nhau)
// nên vẫn tạo mock ổn định theo từng PlanForm (deterministic theo id, không đổi giữa các lần render).

function strHash(s: string): number {
  return s.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
}

function getPurchasingRows(pf: PlanForm, proposals: PurchaseProposal[]): MaterialItem[] {
  return proposals
    .filter(p => p.planFormId === pf.id)
    .flatMap(p => p.items.map(item => {
      const ncc = p.chosenSuppliers?.[item.name] ?? ''
      const offers = p.quotes?.[item.name] ?? []
      const chosenQuote = offers.find(q => q.supplierName === ncc) ?? offers[0]
      return {
        name: item.name,
        ncc: ncc || (chosenQuote?.supplierName ?? '—'),
        unitPrice: chosenQuote?.unitPrice ?? 0,
        qty: item.buyQty,
        unit: item.unit,
        boughtQty: item.receivedQty ?? 0,
      }
    }))
}

function getPurchasingPercent(materials: MaterialItem[]): number {
  if (materials.length === 0) return 100 // không có gì cần mua → coi như xong bước mua hàng
  const w = (m: MaterialItem) => m.qty <= 0 ? 0 : Math.min(1, m.boughtQty / m.qty)
  return Math.round(materials.reduce((s, m) => s + w(m), 0) / materials.length * 100)
}

// Khung/Đan/Đóng gói phải tuần tự (đan chỉ bắt đầu khi khung xong, đóng gói khi đan xong) —
// tạo pseudo-random ổn định theo PO để demo có nhịp độ hợp lý, không đổi giữa các lần render.
function genExecutionStages(pf: PlanForm, purchasingDone: boolean): Pick<StageDetails, 'frame' | 'weaving' | 'packaging'> {
  if (!purchasingDone) {
    return {
      frame: { phoi: 'pending', han: 'pending', son: 'pending' },
      weaving: { nhapDan: 'pending', xuatDan: 'pending' },
      packaging: { dongGoi: 'pending' },
    }
  }
  const h = strHash(pf.exportOrder?.poNumber ?? String(pf.id)) + pf.id
  const pick = (offset: number, thresholds: [number, SubStatus][]): SubStatus => {
    const v = (h + offset * 7) % 10
    for (const [t, s] of thresholds) if (v < t) return s
    return thresholds[thresholds.length - 1][1]
  }
  const frame: StageDetails['frame'] = {
    phoi: pick(1, [[8, 'done'], [9, 'in-progress'], [10, 'pending']]),
    han:  pick(2, [[6, 'done'], [8, 'in-progress'], [10, 'pending']]),
    son:  pick(3, [[5, 'done'], [7, 'in-progress'], [10, 'pending']]),
  }
  const frameDone = frame.phoi === 'done' && frame.han === 'done' && frame.son === 'done'
  const weaving: StageDetails['weaving'] = frameDone ? {
    nhapDan: pick(4, [[6, 'done'], [8, 'in-progress'], [10, 'pending']]),
    xuatDan: pick(5, [[4, 'done'], [7, 'in-progress'], [10, 'pending']]),
  } : { nhapDan: 'pending', xuatDan: 'pending' }
  const weavingDone = weaving.nhapDan === 'done' && weaving.xuatDan === 'done'
  const packaging: StageDetails['packaging'] = weavingDone ? {
    dongGoi: pick(6, [[5, 'done'], [8, 'in-progress'], [10, 'pending']]),
  } : { dongGoi: 'pending' }
  return { frame, weaving, packaging }
}

function buildOrderRow(pf: PlanForm, proposals: PurchaseProposal[]): { order: MfgOrder; details: StageDetails } {
  const materials = getPurchasingRows(pf, proposals)
  const purchPct = getPurchasingPercent(materials)
  const { frame, weaving, packaging } = genExecutionStages(pf, purchPct >= 100)
  const details: StageDetails = { purchasing: { materials }, frame, weaving, packaging }
  const done = isAllDone(details)
  const order: MfgOrder = {
    id: pf.id,
    code: pf.exportOrder?.poNumber ?? `#${pf.exportOrderId}`,
    sku: pf.mfgProduct?.factoryCode ?? '—',
    productName: pf.mfgProduct?.name ?? '',
    customer: pf.customerName ?? '—',
    deadline: pf.exportOrder?.deliveryDate,
    approvedAt: pf.createdAt,
    status: done ? 'DONE' : 'PRODUCING',
    mfgStage: done ? undefined : (purchPct < 100 ? 'PURCHASING' : 'FRAME'),
  }
  return { order, details }
}

// ─── Status meta ──────────────────────────────────────────────────────────────

const STATUS_META: Record<OrderStatus, { label: string; bg: string; color: string; border: string }> = {
  PRODUCING: { label: 'Đang sản xuất', bg: '#f0fdf4', color: '#15803d', border: '#86efac' },
  DONE:      { label: 'Hoàn thành',    bg: '#ecfdf5', color: '#065f46', border: '#6ee7b7' },
}

const th: React.CSSProperties = { padding: '10px 14px', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', background: 'var(--surface2)', textAlign: 'left', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '11px 14px', fontSize: 13, borderTop: '1px solid var(--border)', verticalAlign: 'middle' }

type FilterStatus = 'all' | OrderStatus

// ─── Sub-stage badge ──────────────────────────────────────────────────────────

function SubStatusBadge({ status }: { status: SubStatus }) {
  const conf: Record<SubStatus, { bg: string; color: string; border: string; label: string; icon: React.ReactNode }> = {
    done:          { bg: '#dcfce7', color: '#166534', border: '#86efac', label: 'Hoàn thành',     icon: <CheckCircle2 size={11} /> },
    'in-progress': { bg: '#fef3c7', color: '#92400e', border: '#fcd34d', label: 'Đang thực hiện', icon: <Clock size={11} /> },
    pending:       { bg: 'var(--surface2)', color: 'var(--text3)', border: 'var(--border)', label: 'Chờ', icon: <span style={{ display: 'inline-block', width: 10, height: 10, border: '1.5px solid currentColor', borderRadius: '50%' }} /> },
  }
  const c = conf[status]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: c.bg, color: c.color, border: `1px solid ${c.border}`, whiteSpace: 'nowrap' }}>
      {c.icon} {c.label}
    </span>
  )
}

// ─── Stage detail sub-components ──────────────────────────────────────────────

// Bố cục cột giống trang "Theo dõi mua hàng" (account mua hàng) — xem TheoDoiMuaHangPage.tsx.
// Hạn giao lấy chung từ deadline của lệnh SX (sync từ KHSX), không lưu riêng theo từng vật tư.
function PurchasingContent({ materials, deadline }: { materials: MaterialItem[]; deadline?: string }) {
  const thS: React.CSSProperties = { padding: '6px 10px', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--border)', textAlign: 'left', whiteSpace: 'nowrap' }
  const tdS: React.CSSProperties = { padding: '7px 10px', fontSize: 12, borderBottom: '1px solid var(--border)' }
  if (materials.length === 0) {
    return <div style={{ padding: '10px 4px', fontSize: 12, color: 'var(--text3)' }}>Chưa có đề xuất mua vật tư nào cho lệnh này</div>
  }
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={thS}>Tên vật tư</th>
          <th style={thS}>NCC</th>
          <th style={{ ...thS, textAlign: 'right' }}>Đơn giá</th>
          <th style={{ ...thS, textAlign: 'right' }}>Tổng SL</th>
          <th style={thS}>ĐVT</th>
          <th style={{ ...thS, textAlign: 'right' }}>Đã mua</th>
          <th style={{ ...thS, textAlign: 'right' }}>Còn lại</th>
          <th style={thS}>Hạn giao</th>
        </tr>
      </thead>
      <tbody>
        {materials.map((m, i) => {
          const remaining = Math.max(0, m.qty - m.boughtQty)
          return (
            <tr key={i}>
              <td style={{ ...tdS, fontWeight: 600 }}>{m.name}</td>
              <td style={tdS}>{m.ncc}</td>
              <td style={{ ...tdS, textAlign: 'right' }}>{m.unitPrice ? m.unitPrice.toLocaleString('vi-VN') + 'đ' : '—'}</td>
              <td style={{ ...tdS, textAlign: 'right' }}>{m.qty.toLocaleString('vi-VN')}</td>
              <td style={{ ...tdS, color: 'var(--text3)' }}>{m.unit}</td>
              <td style={{ ...tdS, textAlign: 'right', fontWeight: 700, color: m.boughtQty > 0 ? '#16a34a' : 'var(--text3)' }}>{m.boughtQty.toLocaleString('vi-VN')}</td>
              <td style={{ ...tdS, textAlign: 'right', fontWeight: 700, color: remaining > 0 ? '#d97706' : '#16a34a' }}>{remaining.toLocaleString('vi-VN')}</td>
              <td style={{ ...tdS, whiteSpace: 'nowrap' }}>{deadline ? format(new Date(deadline), 'dd/MM/yyyy') : '—'}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function SubStepList({ steps }: { steps: { label: string; status: SubStatus }[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {steps.map((s, i) => (
        <div key={s.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 4px', borderBottom: i < steps.length - 1 ? '1px solid var(--border)' : undefined }}>
          <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{s.label}</span>
          <SubStatusBadge status={s.status} />
        </div>
      ))}
    </div>
  )
}

// ─── Parallel stage helpers ───────────────────────────────────────────────────

const PARALLEL_STAGE_KEYS = new Set<MfgStage>(['FRAME', 'WEAVING', 'PACKAGING'])

function getStagePercent(key: MfgStage, details: StageDetails): number {
  const w = (s: SubStatus) => s === 'done' ? 1 : s === 'in-progress' ? 0.5 : 0
  if (key === 'FRAME')     return Math.round((w(details.frame.phoi) + w(details.frame.han) + w(details.frame.son)) / 3 * 100)
  if (key === 'WEAVING')   return Math.round((w(details.weaving.nhapDan) + w(details.weaving.xuatDan)) / 2 * 100)
  if (key === 'PACKAGING') return Math.round(w(details.packaging.dongGoi) * 100)
  return 0
}

function getOverallPercent(details: StageDetails): number {
  const purchPct = getPurchasingPercent(details.purchasing.materials)
  const framePct    = getStagePercent('FRAME',     details)
  const weavingPct  = getStagePercent('WEAVING',   details)
  const packagingPct = getStagePercent('PACKAGING', details)
  return Math.round((purchPct + framePct + weavingPct + packagingPct) / 4)
}

function isAllDone(details: StageDetails): boolean {
  return (
    details.frame.phoi === 'done' && details.frame.han === 'done' && details.frame.son === 'done' &&
    details.weaving.nhapDan === 'done' && details.weaving.xuatDan === 'done' &&
    details.packaging.dongGoi === 'done'
  )
}

// ─── Stage detail card ────────────────────────────────────────────────────────

function StageDetailCard({
  stage,
  isActive,
  details,
  orderDeadline,
}: {
  stage: typeof MFG_STAGES[number]
  isActive: boolean
  details: StageDetails
  orderDeadline?: string
}) {
  const headerBg     = isActive ? '#fef9ec' : '#f0fdf4'
  const headerBorder = isActive ? '#fcd34d' : '#86efac'
  const headerColor  = isActive ? '#92400e' : '#166534'

  return (
    <div style={{ border: `1px solid ${headerBorder}`, borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 16px', background: headerBg }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: headerColor }}>
          {stage.icon}
          <span style={{ fontSize: 13, fontWeight: 700 }}>{stage.label}</span>
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: headerColor }}>
          {isActive
            ? PARALLEL_STAGE_KEYS.has(stage.key)
              ? <><TrendingUp size={11} /> {getStagePercent(stage.key, details)}%</>
              : <><Clock size={11} /> Đang thực hiện</>
            : <><CheckCircle2 size={11} /> Hoàn thành</>}
        </span>
      </div>

      <div style={{ padding: '12px 16px', background: 'var(--surface)' }}>
        {stage.key === 'PURCHASING' && (
          <PurchasingContent materials={details.purchasing.materials} deadline={orderDeadline} />
        )}
        {stage.key === 'FRAME' && (
          <SubStepList steps={[
            { label: 'Phôi (cắt, dập, tạo hình)', status: details.frame.phoi },
            { label: 'Hàn khung',                  status: details.frame.han  },
            { label: 'Sơn phủ',                    status: details.frame.son  },
          ]} />
        )}
        {stage.key === 'WEAVING' && (
          <SubStepList steps={[
            { label: 'Nhập đan (nguyên liệu đan vào)', status: details.weaving.nhapDan },
            { label: 'Xuất đan (thành phẩm đan ra)',   status: details.weaving.xuatDan },
          ]} />
        )}
        {stage.key === 'PACKAGING' && (
          <SubStepList steps={[
            { label: 'Đóng gói', status: details.packaging.dongGoi },
          ]} />
        )}
      </div>
    </div>
  )
}

// ─── Progress tracker ─────────────────────────────────────────────────────────

function MfgStageTracker({
  currentStage,
  allDone = false,
  stagePercents,
}: {
  currentStage?: MfgStage
  allDone?: boolean
  stagePercents?: Partial<Record<MfgStage, number>>
}) {
  const currentIdx = allDone
    ? MFG_STAGES.length
    : currentStage
      ? MFG_STAGES.findIndex(s => s.key === currentStage)
      : -1

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Tiến độ sản xuất
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
        {MFG_STAGES.map((stage, idx) => {
          const pct     = stagePercents?.[stage.key]
          const done    = allDone || (pct !== undefined ? pct >= 100 : idx < currentIdx)
          const active  = !done && (pct !== undefined ? pct > 0 : idx === currentIdx)
          const pending = !done && !active
          return (
            <div key={stage.key} style={{ display: 'flex', alignItems: 'center', flex: idx < MFG_STAGES.length - 1 ? '1 1 0' : undefined }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 72 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: done ? '#dcfce7' : active ? '#15803d' : 'var(--surface2)',
                  border: `2px solid ${done ? '#86efac' : active ? '#15803d' : 'var(--border)'}`,
                  color: done ? '#15803d' : active ? '#fff' : 'var(--text3)',
                  transition: 'all 0.2s',
                }}>
                  {done ? <CheckCircle2 size={18} /> : stage.icon}
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 11, fontWeight: active ? 700 : 600, color: active ? '#15803d' : done ? '#374151' : 'var(--text3)', whiteSpace: 'nowrap' }}>
                    {stage.label}
                  </div>
                  {active  && (
                    <div style={{ fontSize: 10, color: '#15803d', fontWeight: 600, marginTop: 2 }}>
                      {pct !== undefined && PARALLEL_STAGE_KEYS.has(stage.key) ? `${pct}%` : 'Đang thực hiện'}
                    </div>
                  )}
                  {done    && <div style={{ fontSize: 10, color: '#22c55e', fontWeight: 600, marginTop: 2 }}>Hoàn thành</div>}
                  {pending && <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>Chờ</div>}
                </div>
              </div>
              {idx < MFG_STAGES.length - 1 && (
                <div style={{ flex: 1, height: 2, marginBottom: 28, background: done ? '#86efac' : 'var(--border)' }} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Detail page ──────────────────────────────────────────────────────────────

function ThongKeDetailPage({ order, details, onBack }: { order: MfgOrder; details: StageDetails; onBack: () => void }) {
  const allDone   = isAllDone(details)
  const isDone    = order.status === 'DONE' || allDone
  const isOverdue = !!order.deadline && new Date(order.deadline) < new Date() && !isDone
  const meta      = STATUS_META[isDone ? 'DONE' : 'PRODUCING']

  // Stage cards to show
  const reachedCards: { stage: typeof MFG_STAGES[number]; isActive: boolean }[] = []

  if (isDone) {
    MFG_STAGES.forEach(stage => reachedCards.push({ stage, isActive: false }))
  } else if (order.status === 'PRODUCING' && order.mfgStage) {
    if (PARALLEL_STAGE_KEYS.has(order.mfgStage)) {
      reachedCards.push({ stage: MFG_STAGES.find(s => s.key === 'PURCHASING')!, isActive: false })
      for (const stage of MFG_STAGES) {
        if (!PARALLEL_STAGE_KEYS.has(stage.key)) continue
        const pct = getStagePercent(stage.key, details)
        if (pct > 0) reachedCards.push({ stage, isActive: pct < 100 })
      }
    } else {
      const currentIdx = MFG_STAGES.findIndex(s => s.key === order.mfgStage)
      MFG_STAGES.forEach((stage, idx) => {
        if (idx <= currentIdx) reachedCards.push({ stage, isActive: idx === currentIdx })
      })
    }
  }

  const stagePercents: Partial<Record<MfgStage, number>> | undefined =
    order.mfgStage && PARALLEL_STAGE_KEYS.has(order.mfgStage)
      ? {
          FRAME:     getStagePercent('FRAME',     details),
          WEAVING:   getStagePercent('WEAVING',   details),
          PACKAGING: getStagePercent('PACKAGING', details),
        }
      : undefined

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <button
          onClick={onBack}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}
        >
          <ArrowLeft size={15} />
          Quay lại danh sách
        </button>
        <span style={{ color: 'var(--text3)', fontSize: 13 }}>/</span>
        <span style={{ fontSize: 13, color: 'var(--text3)' }}>Chi tiết lệnh</span>
      </div>

      {/* Header card */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 20, color: '#1d4ed8', letterSpacing: '0.02em' }}>{order.code}</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginTop: 6 }}>{order.productName}</div>
            <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>Mã xưởng: <span style={{ fontWeight: 600, color: 'var(--text2)' }}>{order.sku}</span></div>
          </div>
          <span style={{ display: 'inline-block', padding: '5px 16px', borderRadius: 20, fontSize: 13, fontWeight: 700, background: meta.bg, color: meta.color, border: `1px solid ${meta.border}`, whiteSpace: 'nowrap' }}>
            {meta.label}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginTop: 20 }}>
          {[
            { label: 'Khách hàng',    value: order.customer },
            { label: 'Ngày tạo lệnh', value: format(new Date(order.approvedAt), 'dd/MM/yyyy') },
            { label: 'Hạn giao hàng', value: order.deadline ? format(new Date(order.deadline), 'dd/MM/yyyy') : '—', warn: isOverdue },
          ].map(row => (
            <div key={row.label} style={{ background: 'var(--surface2)', borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{row.label}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: row.warn ? '#dc2626' : 'var(--text)' }}>
                {row.value}
                {row.warn && <span style={{ fontSize: 11, marginLeft: 6, fontWeight: 600, color: '#dc2626' }}>Quá hạn</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Production status */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px', marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Trạng thái sản xuất</div>

        {isDone ? (
          <div style={{ background: '#ecfdf5', border: '1px solid #6ee7b7', borderRadius: 10, padding: '16px 20px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <CheckCircle2 size={20} color="#065f46" />
              <div style={{ fontSize: 14, fontWeight: 700, color: '#065f46' }}>Đã hoàn thành toàn bộ quy trình</div>
            </div>
            <MfgStageTracker allDone />
          </div>
        ) : (
          <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: '16px 20px 20px' }}>
            <MfgStageTracker currentStage={order.mfgStage} stagePercents={stagePercents} />
          </div>
        )}

        {reachedCards.length > 0 && (
          <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Chi tiết từng công đoạn
            </div>
            {reachedCards.map(({ stage, isActive }) => (
              <StageDetailCard key={stage.key} stage={stage} isActive={isActive} details={details} orderDeadline={order.deadline} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── List page ────────────────────────────────────────────────────────────────

export default function ThongKePagePlan() {
  const { data: planFormsData, isLoading } = useFetch<PlanForm[]>(() => api.getPlanForms(), [])
  const { proposals } = useInspection()
  const planForms = (planFormsData ?? []).filter(pf => pf.status !== 'DRAFT')

  const orderRows = planForms.map(pf => buildOrderRow(pf, proposals))

  const [filter, setFilter]         = useState<FilterStatus>('all')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [search, setSearch]         = useState('')

  const q = search.trim().toLowerCase()
  const filtered = orderRows
    .filter(({ order }) => filter === 'all' || order.status === filter)
    .filter(({ order }) => !q || [order.code, order.sku, order.productName, order.customer].some(v => v.toLowerCase().includes(q)))

  const counts = {
    all:       orderRows.length,
    PRODUCING: orderRows.filter(({ order }) => order.status === 'PRODUCING').length,
    DONE:      orderRows.filter(({ order }) => order.status === 'DONE').length,
  }

  const selectedRow = selectedId != null ? orderRows.find(({ order }) => order.id === selectedId) ?? null : null
  if (selectedRow) {
    return <ThongKeDetailPage order={selectedRow.order} details={selectedRow.details} onBack={() => setSelectedId(null)} />
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Bảng thống kê</h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text3)' }}>
          Danh sách lệnh sản xuất — nhấn vào dòng để xem chi tiết tiến độ
        </p>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { label: 'Tổng lệnh SX',  value: counts.all,       icon: <Factory size={20} color="#6b7280" />,       bg: '#f9fafb', color: '#374151', border: '#e5e7eb' },
          { label: 'Đang sản xuất', value: counts.PRODUCING, icon: <TrendingUp size={20} color="#15803d" />,    bg: '#f0fdf4', color: '#15803d', border: '#86efac' },
          { label: 'Hoàn thành',    value: counts.DONE,      icon: <CheckCircle2 size={20} color="#065f46" />,  bg: '#ecfdf5', color: '#065f46', border: '#6ee7b7' },
        ].map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', background: s.bg, border: `1px solid ${s.border}`, borderRadius: 12, minWidth: 160, flex: '1 1 0' }}>
            {s.icon}
            <div>
              <div style={{ fontSize: 26, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: s.color, opacity: 0.8, marginTop: 3, fontWeight: 600 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter + Search */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {([['all', 'Tất cả'], ['PRODUCING', 'Đang sản xuất'], ['DONE', 'Hoàn thành']] as [FilterStatus, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setFilter(key)}
              style={{ padding: '5px 14px', fontSize: 12, fontWeight: 600, borderRadius: 20, border: 'none', cursor: 'pointer',
                background: filter === key ? '#1d4ed8' : 'var(--surface2)',
                color: filter === key ? '#fff' : 'var(--text)',
              }}>
              {label} <span style={{ opacity: 0.75 }}>({key === 'all' ? counts.all : counts[key as OrderStatus]})</span>
            </button>
          ))}
        </div>
        <div style={{ position: 'relative', width: 280 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tìm mã PO, SKU, sản phẩm, khách hàng..."
            style={{ width: '100%', paddingLeft: 32, paddingRight: 10, paddingTop: 6, paddingBottom: 6, fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box', outline: 'none' }}
          />
        </div>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ ...th, width: 42 }}>#</th>
              <th style={th}>Mã PO</th>
              <th style={th}>SKU</th>
              <th style={th}>Khách hàng</th>
              <th style={th}>Hạn giao</th>
              <th style={th}>Ngày tạo</th>
              <th style={th}>Trạng thái</th>
              <th style={{ ...th, width: 130 }}>Tiến độ</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Đang tải...</td></tr>
            ) : filtered.map(({ order: o, details }) => {
              const isDone    = o.status === 'DONE'
              const m         = STATUS_META[isDone ? 'DONE' : 'PRODUCING']
              const isOverdue = !!o.deadline && new Date(o.deadline) < new Date() && !isDone
              const pct       = isDone ? 100 : getOverallPercent(details)
              return (
                <tr
                  key={o.id}
                  onClick={() => setSelectedId(o.id)}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '' }}
                >
                  <td style={{ ...td, color: 'var(--text3)', fontWeight: 600, textAlign: 'center' }}>{o.id}</td>
                  <td style={{ ...td, fontFamily: 'monospace', fontWeight: 700 }}>{o.code}</td>
                  <td style={td}>
                    <div style={{ fontWeight: 600 }}>{o.productName}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{o.sku}</div>
                  </td>
                  <td style={{ ...td, color: 'var(--text2)' }}>{o.customer}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap', color: isOverdue ? '#dc2626' : undefined, fontWeight: isOverdue ? 700 : undefined }}>
                    {o.deadline ? format(new Date(o.deadline), 'dd/MM/yyyy') : '—'}
                    {isOverdue && <div style={{ fontSize: 11, color: '#dc2626' }}>Quá hạn</div>}
                  </td>
                  <td style={{ ...td, whiteSpace: 'nowrap', color: 'var(--text3)', fontSize: 12 }}>
                    {format(new Date(o.approvedAt), 'dd/MM/yyyy')}
                  </td>
                  <td style={td}>
                    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: m.bg, color: m.color, border: `1px solid ${m.border}` }}>
                      {m.label}
                    </span>
                  </td>
                  <td style={{ ...td, width: 130 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 6, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: isDone ? '#22c55e' : '#f59e0b', borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: isDone ? '#15803d' : 'var(--text2)', minWidth: 30, textAlign: 'right' }}>{pct}%</span>
                    </div>
                  </td>
                </tr>
              )
            })}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>
                  Không có lệnh nào
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
