import { useState } from 'react'
import { format } from 'date-fns'
import { ArrowLeft, CheckCircle2, ChevronRight, Clock, ClipboardCheck, Factory, PackageCheck, Search, ShoppingCart, TrendingUp, Wrench } from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { useInspection, type PurchaseProposal } from '../../../context/InspectionContext'
import type { PlanForm } from '../../../types/plan-form'
import LenhSanXuatBoard, { type BoardColumn } from '../../../components/sanxuat/LenhSanXuatBoard'
import { VatTuDetailBoard, PHOI_CFG, HAN_CFG, SON_CFG, perSku, type ProcManh, type ProcLine } from '../../../components/sanxuat/core'
import ProgressBar from '../../../components/ProgressBar'

// ─── Types ───────────────────────────────────────────────────────────────────

type OrderStatus = 'PRODUCING' | 'DONE'
type MfgStage = 'PURCHASING' | 'FRAME' | 'WEAVING' | 'CHUYEN_KIEM' | 'PACKAGING'
type SubStatus = 'done' | 'in-progress' | 'pending'

interface MaterialItem {
  name: string
  ncc: string
  unitPrice: number
  qty: number      // Tổng SL
  unit: string
  boughtQty: number // Đã mua
}

// 1 mảnh có thể xuất cho nhiều điểm đan khác nhau — cùng hình dạng ManhLine/ManhAllocation dùng ở
// "Theo dõi xuất đan" (khovttp@demo.com) / "Theo dõi nhập đan" (khotp@demo.com), xem WeavingSubStages.
interface WeavingPointLite { id: number; name: string; fullName?: string }
interface WeavingAlloc { id: number; pointName: string; xuatQty: number; nhapQty: number }
interface WeavingLine { id: number; name: string; totalQty: number; allocations: WeavingAlloc[] }

interface StageDetails {
  purchasing: { materials: MaterialItem[] }
  frame: {
    phoi: SubStatus; han: SubStatus; son: SubStatus
    // Dữ liệu chi tiết từng công đoạn nhỏ — cùng cấu trúc ProcManh/ProcLine dùng ở màn
    // Lệnh sản xuất Phôi/Hàn/Sơn, để hiển thị lại y hệt cho KHSX xem (xem FrameSubStages).
    phoiManhs: ProcManh[]
    hanLines: ProcLine[]
    sonLines: ProcLine[]
  }
  weaving: { nhapDan: SubStatus; xuatDan: SubStatus; lines: WeavingLine[] }
  chuyenKiem: { daKiem: SubStatus }
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
  { key: 'PURCHASING',  label: 'Mua hàng',     icon: <ShoppingCart size={16} /> },
  { key: 'FRAME',       label: 'Khung cơ khí', icon: <Wrench size={16} /> },
  { key: 'WEAVING',     label: 'Đan',          icon: <Factory size={16} /> },
  { key: 'CHUYEN_KIEM', label: 'Chuyền kiểm',  icon: <ClipboardCheck size={16} /> },
  { key: 'PACKAGING',   label: 'Đóng gói',     icon: <PackageCheck size={16} /> },
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

// ─── Dữ liệu chi tiết Khung cơ khí (Phôi/Hàn/Sơn) ─────────────────────────────
// Ưu tiên dùng định mức mảnh/sắt/sơn THẬT do các account chuyên trách đã nhập trên PlanForm
// (manhItems, quotaManagement.materialType.daySon) — cùng cấu trúc ProcManh/ProcLine dùng ở màn
// Lệnh sản xuất Phôi/Hàn/Sơn. Nếu PlanForm chưa có (chưa tới bước nhập định mức) thì vẫn tạo mock
// ổn định theo PO để KHSX luôn xem được giao diện chi tiết. Số lượng "đã làm" mock theo đúng
// SubStatus đã chọn ở trên để nhất quán với thanh tiến độ.
const doneFracOf = (status: SubStatus, h: number, salt: number): number => {
  if (status === 'done') return 1
  if (status === 'pending') return 0
  return 0.25 + ((h + salt * 31) % 45) / 100
}

const FALLBACK_MANH = ['Mảnh Tựa', 'Mảnh Tay', 'Mảnh Chân']
const FALLBACK_SAT = ['Sắt Vuông 6 zem', 'Sắt Hộp 8 zem']

function buildPhoiManhs(pf: PlanForm, status: SubStatus, h: number): ProcManh[] {
  const doneFrac = doneFracOf(status, h, 1)
  const src = pf.manhItems && pf.manhItems.length > 0 ? pf.manhItems : null
  const manhList = src ?? FALLBACK_MANH.map((name, i) => ({ id: i + 1, name, qtyPerSku: '1', children: [] as { id: number; name: string; specs?: string | null; length?: string | null; qty?: string | null }[] }))
  return manhList.map((m, mi) => {
    const children = m.children.length > 0 ? m.children : [{ id: mi * 10 + 1, name: FALLBACK_SAT[mi % FALLBACK_SAT.length], specs: null, length: null, qty: null }]
    return {
      id: m.id,
      tenManh: m.name,
      perSku: m.qtyPerSku ? Number(m.qtyPerSku) || 1 : 1,
      lines: children.map((c, ci) => {
        const need = Math.max(1, Number(c.qty) || (80 + ((h + mi * 23 + ci * 11) % 150)))
        const frac = Math.min(1, doneFrac * (0.85 + ((h + mi * 7 + ci * 13) % 30) / 100))
        const done = Math.round(need * frac)
        return {
          id: mi * 1000 + c.id,
          itemName: c.name,
          spec: [c.specs, c.length ? `dài ${c.length}` : null].filter(Boolean).join(' · ') || '—',
          needQty: need,
          doneQty: done,
          perManh: 1,
          lastInputAt: done > 0 ? new Date(Date.now() - ((h + mi * 11 + ci * 17) % 180) * 60000).toISOString() : null,
        }
      }),
    }
  })
}

function buildHanLines(phoiManhs: ProcManh[], status: SubStatus, h: number): ProcLine[] {
  const doneFrac = doneFracOf(status, h, 2)
  return phoiManhs.map((m, i) => {
    const need = 60 + ((h + i * 23) % 200)
    const frac = Math.min(1, doneFrac * (0.8 + (i % 4) / 10))
    const done = Math.round(need * frac)
    return {
      id: 5000 + i,
      itemName: `Hàn ráp ${m.tenManh}`,
      spec: `×${perSku(m)} / SKU`,
      needQty: need,
      doneQty: done,
      thucCoQty: Math.min(need, done + ((h + i * 9) % 15)),
      lastInputAt: done > 0 ? new Date(Date.now() - ((h + i * 7) % 150) * 60000).toISOString() : null,
    }
  })
}

function buildSonLines(pf: PlanForm, status: SubStatus, h: number): ProcLine[] {
  const doneFrac = doneFracOf(status, h, 3)
  const items = pf.quotaManagement?.materialType.daySon ?? []
  const src = items.length > 0 ? items : [{ name: 'Sơn tĩnh điện', specifications: null as string | null, kg: null as number | null }]
  return src.map((it, i) => {
    const need = Math.max(1, Math.round(Number(it.kg) || (40 + ((h + i * 31) % 100))))
    const frac = Math.min(1, doneFrac * (0.85 + (i % 3) / 10))
    const done = Math.round(need * frac)
    return {
      id: 7000 + i,
      itemName: it.name,
      spec: it.specifications || '—',
      needQty: need,
      doneQty: done,
      thucCoQty: Math.min(need, done + ((h + i * 5) % 10)),
      lastInputAt: done > 0 ? new Date(Date.now() - ((h + i * 13) % 150) * 60000).toISOString() : null,
    }
  })
}

// Đan: "Xuất đan" (kho vật tư thành phẩm giao mảnh cho điểm đan gia công) luôn xảy ra trước
// "Nhập đan" (kho thành phẩm nhận lại mảnh đã đan) — mock vài mảnh giao cho 1-2 điểm đan (lấy tên
// điểm đan thật từ getWeavingPoints), theo đúng cấu trúc dòng/điểm đan dùng ở 2 màn thủ kho.
const DAN_LINE_NAMES = ['Mảnh tựa lưng', 'Mảnh ngồi chính', 'Mảnh tay vịn']

function buildWeavingLines(xuatStatus: SubStatus, nhapStatus: SubStatus, h: number, points: WeavingPointLite[]): WeavingLine[] {
  const xuatFrac = doneFracOf(xuatStatus, h, 4)
  const nhapFrac = doneFracOf(nhapStatus, h, 5)
  const pool = points.length > 0 ? points : [{ id: 1, name: 'Điểm đan A' }, { id: 2, name: 'Điểm đan B' }]
  const pointLabel = (p: WeavingPointLite) => p.fullName ? `${p.name} (${p.fullName})` : p.name

  return DAN_LINE_NAMES.map((name, i) => {
    const total = 20 + ((h + i * 17) % 60)
    const xuatTotal = Math.round(total * xuatFrac)
    const twoPoints = pool.length > 1 && xuatTotal > 0 && (h + i) % 2 === 0
    const splitA = twoPoints ? Math.ceil(xuatTotal * 0.6) : xuatTotal
    const splits = twoPoints ? [splitA, xuatTotal - splitA] : [splitA]
    const allocations: WeavingAlloc[] = splits
      .filter(q => q > 0)
      .map((q, ai) => {
        const point = pool[(i + ai) % pool.length]
        return { id: i * 10 + ai + 1, pointName: pointLabel(point), xuatQty: q, nhapQty: Math.min(q, Math.round(q * nhapFrac)) }
      })
    return { id: i + 1, name, totalQty: total, allocations }
  })
}

// Khung/Đan/Đóng gói phải tuần tự (đan chỉ bắt đầu khi khung xong, đóng gói khi đan xong) —
// tạo pseudo-random ổn định theo PO để demo có nhịp độ hợp lý, không đổi giữa các lần render.
function genExecutionStages(pf: PlanForm, purchasingDone: boolean, weavingPoints: WeavingPointLite[]): Pick<StageDetails, 'frame' | 'weaving' | 'chuyenKiem' | 'packaging'> {
  if (!purchasingDone) {
    return {
      frame: { phoi: 'pending', han: 'pending', son: 'pending', phoiManhs: [], hanLines: [], sonLines: [] },
      weaving: { nhapDan: 'pending', xuatDan: 'pending', lines: [] },
      chuyenKiem: { daKiem: 'pending' },
      packaging: { dongGoi: 'pending' },
    }
  }
  const h = strHash(pf.exportOrder?.poNumber ?? String(pf.id)) + pf.id
  const pick = (offset: number, thresholds: [number, SubStatus][]): SubStatus => {
    const v = (h + offset * 7) % 10
    for (const [t, s] of thresholds) if (v < t) return s
    return thresholds[thresholds.length - 1][1]
  }
  const phoiStatus = pick(1, [[8, 'done'], [9, 'in-progress'], [10, 'pending']])
  const hanStatus  = pick(2, [[6, 'done'], [8, 'in-progress'], [10, 'pending']])
  const sonStatus  = pick(3, [[5, 'done'], [7, 'in-progress'], [10, 'pending']])
  const phoiManhs = buildPhoiManhs(pf, phoiStatus, h)
  const frame: StageDetails['frame'] = {
    phoi: phoiStatus, han: hanStatus, son: sonStatus,
    phoiManhs,
    hanLines: buildHanLines(phoiManhs, hanStatus, h),
    sonLines: buildSonLines(pf, sonStatus, h),
  }
  const frameDone = frame.phoi === 'done' && frame.han === 'done' && frame.son === 'done'
  // xuatDan quyết định trước — nhapDan không thể vượt tiến độ xuatDan (chưa xuất thì chưa có gì để nhập về).
  const xuatDan = frameDone ? pick(4, [[6, 'done'], [8, 'in-progress'], [10, 'pending']]) : 'pending'
  const nhapDan = xuatDan === 'pending' ? 'pending' : pick(5, [[4, 'done'], [7, 'in-progress'], [10, 'pending']])
  const weaving: StageDetails['weaving'] = { xuatDan, nhapDan, lines: buildWeavingLines(xuatDan, nhapDan, h, weavingPoints) }
  const weavingDone = weaving.nhapDan === 'done' && weaving.xuatDan === 'done'
  const chuyenKiem: StageDetails['chuyenKiem'] = weavingDone ? {
    daKiem: pick(6, [[6, 'done'], [8, 'in-progress'], [10, 'pending']]),
  } : { daKiem: 'pending' }
  const chuyenKiemDone = chuyenKiem.daKiem === 'done'
  const packaging: StageDetails['packaging'] = chuyenKiemDone ? {
    dongGoi: pick(7, [[5, 'done'], [8, 'in-progress'], [10, 'pending']]),
  } : { dongGoi: 'pending' }
  return { frame, weaving, chuyenKiem, packaging }
}

function buildOrderRow(pf: PlanForm, proposals: PurchaseProposal[], weavingPoints: WeavingPointLite[]): { order: MfgOrder; details: StageDetails } {
  const materials = getPurchasingRows(pf, proposals)
  const purchPct = getPurchasingPercent(materials)
  const { frame, weaving, chuyenKiem, packaging } = genExecutionStages(pf, purchPct >= 100, weavingPoints)
  const details: StageDetails = { purchasing: { materials }, frame, weaving, chuyenKiem, packaging }
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

// ─── Khung cơ khí: 3 tab con Phôi/Hàn/Sơn ─────────────────────────────────────
// Nhúng lại đúng bảng chi tiết (VatTuDetailBoard) dùng ở màn Lệnh sản xuất của phoi@/han@/son@demo.com,
// ở chế độ chỉ xem (không có cột nhập/xác nhận) — để KHSX xem được thông tin chi tiết như 3 account đó.

type FrameSubTab = 'PHOI' | 'HAN' | 'SON'

const FRAME_SUB_TABS: { key: FrameSubTab; label: string; status: (f: StageDetails['frame']) => SubStatus }[] = [
  { key: 'PHOI', label: 'Phôi (cắt, dập, tạo hình)', status: f => f.phoi },
  { key: 'HAN',  label: 'Hàn khung',                  status: f => f.han  },
  { key: 'SON',  label: 'Sơn phủ',                     status: f => f.son  },
]

function PhoiManhMiniBoard({ manhs, onOpen }: { manhs: ProcManh[]; onOpen: (id: number) => void }) {
  const views = manhs.map(m => {
    const tong = m.lines.reduce((s, l) => s + l.needQty, 0)
    const done = m.lines.reduce((s, l) => s + l.doneQty, 0)
    return { m, tong, done, remain: Math.max(0, tong - done) }
  })
  const cols: BoardColumn<typeof views[number]>[] = [
    { key: 'manh', header: 'Mảnh', cell: v => <span style={{ fontWeight: 700 }}>{v.m.tenManh}</span> },
    { key: 'perSku', header: 'SL/SKU', align: 'right', cell: v => `×${perSku(v.m)}` },
    { key: 'tong', header: 'Định mức (cây)', align: 'right', cell: v => v.tong.toLocaleString('vi-VN') },
    { key: 'done', header: 'Đã cắt (cây)', align: 'right', cell: v => <span style={{ fontWeight: 700 }}>{v.done.toLocaleString('vi-VN')}</span> },
    { key: 'remain', header: 'Còn lại (cây)', align: 'right', cell: v => <span style={{ color: v.remain > 0 ? '#e65100' : '#16a34a', fontWeight: 600 }}>{v.remain.toLocaleString('vi-VN')}</span> },
    { key: 'chevron', header: '', width: 36, cell: () => <span style={{ color: 'var(--text3)' }}><ChevronRight size={16} /></span> },
  ]
  return (
    <LenhSanXuatBoard
      title="Danh sách mảnh" subtitle="Bấm vào một mảnh để xem chi tiết loại sắt"
      columns={cols} rows={views} rowKey={v => v.m.id}
      clickable={() => true} onRowClick={v => onOpen(v.m.id)}
      rowTitle={() => 'Xem chi tiết loại sắt của mảnh này'}
    />
  )
}

function FrameSubStages({ frame }: { frame: StageDetails['frame'] }) {
  const [tab, setTab] = useState<FrameSubTab>('PHOI')
  const [selManhId, setSelManhId] = useState<number | null>(null)

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {FRAME_SUB_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setSelManhId(null) }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 12px', fontSize: 12, fontWeight: 600,
              borderRadius: 20, border: 'none', cursor: 'pointer',
              background: tab === t.key ? '#1d4ed8' : 'var(--surface2)', color: tab === t.key ? '#fff' : 'var(--text)',
            }}
          >
            {t.label}
            <SubStatusBadge status={t.status(frame)} />
          </button>
        ))}
      </div>

      {tab === 'PHOI' && (
        selManhId == null ? (
          <PhoiManhMiniBoard manhs={frame.phoiManhs} onOpen={setSelManhId} />
        ) : (
          <VatTuDetailBoard
            lines={frame.phoiManhs.find(m => m.id === selManhId)?.lines ?? []}
            cfg={PHOI_CFG} readOnly showThucCo={false}
            title={frame.phoiManhs.find(m => m.id === selManhId)?.tenManh ?? ''}
            subtitle="Chi tiết từng loại sắt của mảnh — chỉ xem"
            bannerLabel="Đồng bộ sắt" dbUnit="mảnh"
            onBack={() => setSelManhId(null)} backLabel="Quay lại danh sách mảnh"
          />
        )
      )}
      {tab === 'HAN' && (
        <VatTuDetailBoard
          lines={frame.hanLines} cfg={HAN_CFG} readOnly
          title="Chi tiết hàn khung" subtitle="Tiến độ hàn ráp theo từng mảnh — chỉ xem"
          bannerLabel="Đồng bộ"
        />
      )}
      {tab === 'SON' && (
        <VatTuDetailBoard
          lines={frame.sonLines} cfg={SON_CFG} readOnly
          title="Chi tiết sơn phủ" subtitle="Tiến độ sơn theo loại sơn — chỉ xem"
          bannerLabel="Đồng bộ"
        />
      )}
    </div>
  )
}

// ─── Đan: chỉ hiện "Nhập đan" ──────────────────────────────────────────────────
// Nhúng lại đúng nội dung "Theo dõi nhập đan" (khotp@demo.com) ở chế độ chỉ xem (bỏ ô nhập số
// lượng/nút xác nhận), đã lược bỏ 2 cấp PO/SKU vì đã ở đúng 1 lệnh. Không hiện "Xuất đan" riêng —
// theo yêu cầu, chỉ "Nhập đan" là đủ để KHSX theo dõi công đoạn Đan.

const weavingThS: React.CSSProperties = { padding: '6px 10px', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--border)', textAlign: 'left', whiteSpace: 'nowrap' }
const weavingTdS: React.CSSProperties = { padding: '7px 10px', fontSize: 12, borderBottom: '1px solid var(--border)' }

function WeavingTile({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ padding: '10px 14px', background: 'var(--surface2)', borderRadius: 8, textAlign: 'center' }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: color ?? 'var(--text)' }}>{value.toLocaleString('vi-VN')}</div>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{label}</div>
    </div>
  )
}

function WeavingSubStages({ weaving }: { weaving: StageDetails['weaving'] }) {
  const lines = weaving.lines
  const total  = lines.reduce((s, l) => s + l.totalQty, 0)
  const daXuat = lines.reduce((s, l) => s + l.allocations.reduce((a, x) => a + x.xuatQty, 0), 0)
  const daNhap = lines.reduce((s, l) => s + l.allocations.reduce((a, x) => a + x.nhapQty, 0), 0)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        {/* <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Nhập đan (nhận mảnh đã đan về)</span> */}
        <SubStatusBadge status={weaving.nhapDan} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
        <WeavingTile label="Tổng" value={total} />
        <WeavingTile label="Đã xuất" value={daXuat} color="#d97706" />
        <WeavingTile label="Đã nhập" value={daNhap} color="#16a34a" />
      </div>
      {daXuat === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>Chưa có mảnh nào được xuất đan</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={weavingThS}>Tên mảnh</th>
              <th style={weavingThS}>Điểm đan</th>
              <th style={{ ...weavingThS, textAlign: 'right' }}>SL đã xuất</th>
              <th style={{ ...weavingThS, textAlign: 'right' }}>SL đã nhập</th>
              <th style={weavingThS}>Tiến độ nhận</th>
            </tr>
          </thead>
          <tbody>
            {lines.flatMap(l => l.allocations.filter(a => a.xuatQty > 0).map(a => (
              <tr key={`${l.id}-${a.id}`}>
                <td style={{ ...weavingTdS, fontWeight: 600 }}>{l.name}</td>
                <td style={weavingTdS}>{a.pointName}</td>
                <td style={{ ...weavingTdS, textAlign: 'right', fontWeight: 600, color: '#d97706' }}>{a.xuatQty.toLocaleString('vi-VN')}</td>
                <td style={{ ...weavingTdS, textAlign: 'right', fontWeight: 600, color: a.nhapQty > 0 ? '#16a34a' : 'var(--text3)' }}>{a.nhapQty.toLocaleString('vi-VN')}</td>
                <td style={weavingTdS}>
                  {a.nhapQty >= a.xuatQty
                    ? <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>Đã nhận đủ</span>
                    : <ProgressBar value={a.nhapQty} max={a.xuatQty} />}
                </td>
              </tr>
            )))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ─── Parallel stage helpers ───────────────────────────────────────────────────

const PARALLEL_STAGE_KEYS = new Set<MfgStage>(['FRAME', 'WEAVING', 'CHUYEN_KIEM', 'PACKAGING'])

function getStagePercent(key: MfgStage, details: StageDetails): number {
  const w = (s: SubStatus) => s === 'done' ? 1 : s === 'in-progress' ? 0.5 : 0
  if (key === 'FRAME')       return Math.round((w(details.frame.phoi) + w(details.frame.han) + w(details.frame.son)) / 3 * 100)
  if (key === 'WEAVING')     return Math.round((w(details.weaving.nhapDan) + w(details.weaving.xuatDan)) / 2 * 100)
  if (key === 'CHUYEN_KIEM') return Math.round(w(details.chuyenKiem.daKiem) * 100)
  if (key === 'PACKAGING')   return Math.round(w(details.packaging.dongGoi) * 100)
  return 0
}

function getOverallPercent(details: StageDetails): number {
  const purchPct = getPurchasingPercent(details.purchasing.materials)
  const framePct      = getStagePercent('FRAME',       details)
  const weavingPct     = getStagePercent('WEAVING',     details)
  const chuyenKiemPct  = getStagePercent('CHUYEN_KIEM', details)
  const packagingPct   = getStagePercent('PACKAGING',   details)
  return Math.round((purchPct + framePct + weavingPct + chuyenKiemPct + packagingPct) / 5)
}

function isAllDone(details: StageDetails): boolean {
  return (
    details.frame.phoi === 'done' && details.frame.han === 'done' && details.frame.son === 'done' &&
    details.weaving.nhapDan === 'done' && details.weaving.xuatDan === 'done' &&
    details.chuyenKiem.daKiem === 'done' &&
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
          <FrameSubStages frame={details.frame} />
        )}
        {stage.key === 'WEAVING' && (
          <WeavingSubStages weaving={details.weaving} />
        )}
        {stage.key === 'CHUYEN_KIEM' && (
          <SubStepList steps={[
            { label: 'Chuyền kiểm (kiểm tra chất lượng thành phẩm đan)', status: details.chuyenKiem.daKiem },
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
          FRAME:       getStagePercent('FRAME',       details),
          WEAVING:     getStagePercent('WEAVING',     details),
          CHUYEN_KIEM: getStagePercent('CHUYEN_KIEM', details),
          PACKAGING:   getStagePercent('PACKAGING',   details),
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
  const { data: weavingPointsData } = useFetch<WeavingPointLite[]>(() => (api as any).getWeavingPoints(), [])
  const { proposals } = useInspection()
  const planForms = (planFormsData ?? []).filter(pf => pf.status !== 'DRAFT')
  const weavingPoints = weavingPointsData ?? []

  const orderRows = planForms.map(pf => buildOrderRow(pf, proposals, weavingPoints))

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
