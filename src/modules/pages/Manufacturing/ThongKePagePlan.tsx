import { useState } from 'react'
import { format } from 'date-fns'
import { ArrowLeft, CheckCircle2, Clock, Factory, PackageCheck, Search, ShoppingCart, TrendingUp, Wrench } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

type OrderStatus = 'PRODUCING' | 'DONE'
type MfgStage = 'PURCHASING' | 'FRAME' | 'WEAVING' | 'PACKAGING'
type SubStatus = 'done' | 'in-progress' | 'pending'

interface MaterialItem {
  name: string
  qty: number
  unit: string
  status: 'Đã nhận' | 'Đang đặt' | 'Chờ xác nhận'
}

interface StageDetails {
  purchasing: { materials: MaterialItem[] }
  frame: { phoi: SubStatus; han: SubStatus; son: SubStatus }
  weaving: { nhapDan: SubStatus; xuatDan: SubStatus }
  packaging: { dongGoi: SubStatus }
}

interface MfgOrder {
  id: number
  code: string
  sku: string
  productName: string
  factoryCode: string
  customer: string
  qty: number
  unit: string
  deadline: string
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

// ─── Mock orders ──────────────────────────────────────────────────────────────

const MOCK_ORDERS: MfgOrder[] = [
  { id: 1,  code: 'PI-2026-001', sku: 'SKU-GDE-001', productName: 'Giá để đồ treo tường GDE-200',    factoryCode: 'GDE-200', customer: 'Cty TNHH Minh Phát',         qty: 200, unit: 'bộ',  deadline: '2026-07-15', approvedAt: '2026-06-18', status: 'PRODUCING', mfgStage: 'PURCHASING' },
  { id: 2,  code: 'PI-2026-002', sku: 'SKU-KH-400',  productName: 'Khung nhà thép tiền chế KH-400', factoryCode: 'KH-400',  customer: 'BQL KCN Long Hậu',           qty:   5, unit: 'bộ',  deadline: '2026-09-15', approvedAt: '2026-06-21', status: 'PRODUCING', mfgStage: 'FRAME'     },
  { id: 3,  code: 'PI-2026-003', sku: 'SKU-CS-150',  productName: 'Cổng sắt nghệ thuật CS-150',     factoryCode: 'CS-150',  customer: 'Khu đô thị Vinhomes',        qty:  40, unit: 'bộ',  deadline: '2026-07-30', approvedAt: '2026-06-23', status: 'PRODUCING', mfgStage: 'WEAVING'   },
  { id: 4,  code: 'PI-2026-004', sku: 'SKU-THS-500', productName: 'Tủ hồ sơ văn phòng THS-500',    factoryCode: 'THS-500', customer: 'Cty CP Thanh Hưng',          qty:  50, unit: 'cái', deadline: '2026-08-10', approvedAt: '2026-06-25', status: 'PRODUCING', mfgStage: 'FRAME'     },
  { id: 5,  code: 'PI-2026-005', sku: 'SKU-GVP-100', productName: 'Ghế văn phòng khung sắt GVP-100', factoryCode: 'GVP-100', customer: 'Văn phòng UBND Quận 7',    qty: 150, unit: 'cái', deadline: '2026-08-20', approvedAt: '2026-06-26', status: 'PRODUCING', mfgStage: 'WEAVING'   },
  { id: 6,  code: 'PI-2026-006', sku: 'SKU-TB-100',  productName: 'Tủ bếp inox TB-100',             factoryCode: 'TB-100',  customer: 'Nội thất Hòa Phát',          qty:  80, unit: 'cái', deadline: '2026-07-10', approvedAt: '2026-06-15', status: 'DONE'                              },
  { id: 7,  code: 'PI-2026-007', sku: 'SKU-GK-050',  productName: 'Giường khung sắt GK-050',        factoryCode: 'GK-050',  customer: 'Khách sạn Nam Anh',          qty: 120, unit: 'cái', deadline: '2026-07-05', approvedAt: '2026-06-10', status: 'DONE'                              },
  { id: 8,  code: 'PI-2026-008', sku: 'SKU-HC-020',  productName: 'Hàng rào composite HC-020',      factoryCode: 'HC-020',  customer: 'Cty XD Phú Mỹ Hưng',        qty: 250, unit: 'tấm', deadline: '2026-06-30', approvedAt: '2026-06-12', status: 'DONE'                              },
  { id: 9,  code: 'PI-2026-009', sku: 'SKU-KL-300',  productName: 'Kệ lưu trữ công nghiệp KL-300', factoryCode: 'KL-300',  customer: 'Kho lạnh Bình Dương',        qty:  30, unit: 'bộ',  deadline: '2026-07-25', approvedAt: '2026-05-20', status: 'DONE'                              },
  { id: 10, code: 'PI-2026-010', sku: 'SKU-BD-080',  productName: 'Bàn inox bếp công nghiệp BD-080', factoryCode: 'BD-080', customer: 'Nhà hàng Bếp Vàng',         qty:  60, unit: 'cái', deadline: '2026-07-18', approvedAt: '2026-06-01', status: 'DONE'                              },
]

// ─── Mock stage details ───────────────────────────────────────────────────────

const DONE_FRAME: StageDetails['frame']     = { phoi: 'done', han: 'done', son: 'done' }
const DONE_WEAVING: StageDetails['weaving'] = { nhapDan: 'done', xuatDan: 'done' }

const STAGE_DETAILS: Record<number, StageDetails> = {
  // PI-2026-001 — PRODUCING @ PURCHASING
  1: {
    purchasing: {
      materials: [
        { name: 'Thép hộp vuông 20×20×1.5mm L=6m', qty: 800,  unit: 'm',   status: 'Đã nhận'      },
        { name: 'Thép tấm 2mm (1000×2000mm)',        qty: 40,   unit: 'tấm', status: 'Đang đặt'     },
        { name: 'Ốc vít lục giác M8×30mm',           qty: 2000, unit: 'cái', status: 'Đã nhận'      },
        { name: 'Sơn tĩnh điện bột màu đen',         qty: 25,   unit: 'kg',  status: 'Chờ xác nhận' },
        { name: 'Giá đỡ nhựa PVC Ø25mm',             qty: 400,  unit: 'cái', status: 'Đang đặt'     },
      ],
    },
    frame:     { phoi: 'pending', han: 'pending', son: 'pending' },
    weaving:   { nhapDan: 'pending', xuatDan: 'pending' },
    packaging: { dongGoi: 'pending' },
  },

  // PI-2026-002 — PRODUCING @ FRAME (50%) + WEAVING song song (25%)
  2: {
    purchasing: {
      materials: [
        { name: 'Thép hình H 200×200×8mm',      qty: 250,  unit: 'm',  status: 'Đã nhận' },
        { name: 'Bu lông cường độ cao M16×60mm', qty: 600,  unit: 'bộ', status: 'Đã nhận' },
        { name: 'Tôn sóng 0.42mm × 1150mm',     qty: 1500, unit: 'm²', status: 'Đã nhận' },
        { name: 'Sơn Jotun Primer chống gỉ',     qty: 100,  unit: 'kg', status: 'Đã nhận' },
        { name: 'Bộ kết nối thép mạ kẽm',        qty: 80,   unit: 'bộ', status: 'Đã nhận' },
      ],
    },
    frame:     { phoi: 'done', han: 'in-progress', son: 'pending' },  // 50%
    weaving:   { nhapDan: 'in-progress', xuatDan: 'pending' },         // 25%
    packaging: { dongGoi: 'pending' },                                  // 0%
  },

  // PI-2026-003 — PRODUCING @ WEAVING (75%) + PACKAGING song song (50%)
  3: {
    purchasing: {
      materials: [
        { name: 'Thép đặc tròn Ø16mm L=6m',         qty: 500, unit: 'm',    status: 'Đã nhận' },
        { name: 'Mây nhựa PE đen tổng hợp',          qty: 80,  unit: 'cuộn', status: 'Đã nhận' },
        { name: 'Bản lề cổng công nghiệp 100×100mm', qty: 80,  unit: 'cái',  status: 'Đã nhận' },
        { name: 'Khóa điện tử chống trộm',            qty: 40,  unit: 'bộ',   status: 'Đã nhận' },
        { name: 'Sơn ngoại thất Kova N-A',            qty: 45,  unit: 'kg',   status: 'Đã nhận' },
      ],
    },
    frame:     DONE_FRAME,                                              // 100% → Hoàn thành
    weaving:   { nhapDan: 'done', xuatDan: 'in-progress' },            // 75%
    packaging: { dongGoi: 'in-progress' },                             // 50%
  },

  // PI-2026-004 — PRODUCING @ FRAME (83%) + WEAVING song song (25%)
  4: {
    purchasing: {
      materials: [
        { name: 'Thép hộp chữ nhật 40×20×1.2mm L=6m', qty: 200,  unit: 'm',   status: 'Đã nhận' },
        { name: 'Tấm thép lạnh 1mm (1000×2000mm)',      qty: 25,   unit: 'tấm', status: 'Đã nhận' },
        { name: 'Ốc vít M6×20mm mạ kẽm',               qty: 1500, unit: 'cái', status: 'Đã nhận' },
        { name: 'Sơn tĩnh điện bột xám nhạt',           qty: 15,   unit: 'kg',  status: 'Đã nhận' },
        { name: 'Tay nắm tủ inox 128mm',                qty: 200,  unit: 'cái', status: 'Đã nhận' },
      ],
    },
    frame:     { phoi: 'done', han: 'done', son: 'in-progress' },  // 83%
    weaving:   { nhapDan: 'in-progress', xuatDan: 'pending' },      // 25%
    packaging: { dongGoi: 'pending' },                               // 0%
  },

  // PI-2026-005 — PRODUCING @ WEAVING (25%), FRAME done
  5: {
    purchasing: {
      materials: [
        { name: 'Thép ống tròn Ø32×1.5mm L=6m',  qty: 450, unit: 'm',   status: 'Đã nhận' },
        { name: 'Vải bọc ghế polyester 160cm',     qty: 150, unit: 'm',   status: 'Đã nhận' },
        { name: 'Đệm mút xốp 5cm (1×2m)',          qty: 150, unit: 'tấm', status: 'Đã nhận' },
        { name: 'Sơn tĩnh điện bột đen mờ',        qty: 20,  unit: 'kg',  status: 'Đã nhận' },
        { name: 'Bu lông lắp ráp M8×40mm',         qty: 600, unit: 'cái', status: 'Đã nhận' },
      ],
    },
    frame:     DONE_FRAME,                                              // 100%
    weaving:   { nhapDan: 'in-progress', xuatDan: 'pending' },         // 25%
    packaging: { dongGoi: 'pending' },                                  // 0%
  },

  // PI-2026-006 — DONE
  6: {
    purchasing: {
      materials: [
        { name: 'Tấm inox 201 #4 dày 1.5mm (1000×2000mm)', qty: 160, unit: 'tấm', status: 'Đã nhận' },
        { name: 'Bản lề giảm chấn Blum 35mm',               qty: 480, unit: 'cái', status: 'Đã nhận' },
        { name: 'Ray hộc tủ Hafele 400mm đầy tải',          qty: 320, unit: 'bộ',  status: 'Đã nhận' },
        { name: 'Tay nắm inox mờ 128mm',                    qty: 240, unit: 'cái', status: 'Đã nhận' },
        { name: 'Keo silicon trắng Dowsil 791',              qty: 30,  unit: 'hộp', status: 'Đã nhận' },
      ],
    },
    frame:     DONE_FRAME,
    weaving:   DONE_WEAVING,
    packaging: { dongGoi: 'done' },
  },

  // PI-2026-007 — DONE
  7: {
    purchasing: {
      materials: [
        { name: 'Thép ống tròn Ø25×1.2mm L=6m',  qty: 360, unit: 'm',   status: 'Đã nhận' },
        { name: 'Đầu chân giường nhựa ABS Ø25mm', qty: 480, unit: 'cái', status: 'Đã nhận' },
        { name: 'Bu lông M10×50mm đầu chìm',       qty: 960, unit: 'cái', status: 'Đã nhận' },
        { name: 'Sơn epoxy 2 thành phần xanh đen', qty: 40,  unit: 'kg',  status: 'Đã nhận' },
        { name: 'Tấm đỡ lanh tô sắt dẹp 50×3mm',  qty: 200, unit: 'm',   status: 'Đã nhận' },
      ],
    },
    frame:     DONE_FRAME,
    weaving:   DONE_WEAVING,
    packaging: { dongGoi: 'done' },
  },

  // PI-2026-008 — DONE
  8: {
    purchasing: {
      materials: [
        { name: 'Thanh nhôm định hình 6063-T5 40×40mm', qty: 500,  unit: 'm',   status: 'Đã nhận' },
        { name: 'Tấm GRC composite 2400×600×8mm',        qty: 250,  unit: 'tấm', status: 'Đã nhận' },
        { name: 'Bu lông neo chân đế M12×100mm',         qty: 1000, unit: 'cái', status: 'Đã nhận' },
        { name: 'Keo trám sealant Sikaflex-11FC',         qty: 50,   unit: 'hộp', status: 'Đã nhận' },
        { name: 'Lưới đan inox 304 mắt 5×5mm',           qty: 150,  unit: 'm²',  status: 'Đã nhận' },
      ],
    },
    frame:     DONE_FRAME,
    weaving:   DONE_WEAVING,
    packaging: { dongGoi: 'done' },
  },

  // PI-2026-009 — DONE
  9: {
    purchasing: {
      materials: [
        { name: 'Thép hộp vuông 40×40×2mm L=6m',    qty: 180, unit: 'm',   status: 'Đã nhận' },
        { name: 'Tấm ván MDF 18mm (1200×2400mm)',    qty: 60,  unit: 'tấm', status: 'Đã nhận' },
        { name: 'Vít tự khoan 4.2×38mm mạ kẽm',     qty: 800, unit: 'cái', status: 'Đã nhận' },
        { name: 'Sơn tĩnh điện xanh công nghiệp',   qty: 12,  unit: 'kg',  status: 'Đã nhận' },
      ],
    },
    frame:     DONE_FRAME,
    weaving:   DONE_WEAVING,
    packaging: { dongGoi: 'done' },
  },

  // PI-2026-010 — DONE
  10: {
    purchasing: {
      materials: [
        { name: 'Tấm inox 304 2B dày 2mm (1000×2000mm)', qty: 120, unit: 'tấm', status: 'Đã nhận' },
        { name: 'Chân bàn inox tròn Ø50mm cao 850mm',     qty: 240, unit: 'cái', status: 'Đã nhận' },
        { name: 'Bu lông M12×50mm đầu chìm inox',         qty: 480, unit: 'cái', status: 'Đã nhận' },
        { name: 'Đệm cao su chân bàn Ø50mm',              qty: 240, unit: 'cái', status: 'Đã nhận' },
      ],
    },
    frame:     DONE_FRAME,
    weaving:   DONE_WEAVING,
    packaging: { dongGoi: 'done' },
  },
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

function MaterialStatusBadge({ status }: { status: MaterialItem['status'] }) {
  const conf: Record<MaterialItem['status'], { bg: string; color: string; border: string }> = {
    'Đã nhận':      { bg: '#dcfce7', color: '#166534', border: '#86efac' },
    'Đang đặt':     { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
    'Chờ xác nhận': { bg: '#eff6ff', color: '#1e40af', border: '#bfdbfe' },
  }
  const c = conf[status]
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
      {status}
    </span>
  )
}

// ─── Stage detail sub-components ──────────────────────────────────────────────

function PurchasingContent({ materials }: { materials: MaterialItem[] }) {
  const thS: React.CSSProperties = { padding: '6px 10px', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--border)', textAlign: 'left', whiteSpace: 'nowrap' }
  const tdS: React.CSSProperties = { padding: '7px 10px', fontSize: 12, borderBottom: '1px solid var(--border)' }
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={thS}>Tên vật tư</th>
          <th style={{ ...thS, textAlign: 'right' }}>Số lượng</th>
          <th style={thS}>ĐVT</th>
          <th style={{ ...thS, textAlign: 'center' }}>Trạng thái</th>
        </tr>
      </thead>
      <tbody>
        {materials.map((m, i) => (
          <tr key={i} style={{ background: i % 2 === 1 ? 'var(--surface2)' : undefined }}>
            <td style={tdS}>{m.name}</td>
            <td style={{ ...tdS, textAlign: 'right', fontWeight: 600 }}>{m.qty.toLocaleString('vi-VN')}</td>
            <td style={{ ...tdS, color: 'var(--text3)' }}>{m.unit}</td>
            <td style={{ ...tdS, textAlign: 'center' }}><MaterialStatusBadge status={m.status} /></td>
          </tr>
        ))}
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
  const matW = (s: MaterialItem['status']) => s === 'Đã nhận' ? 1 : s === 'Đang đặt' ? 0.5 : 0
  const mats = details.purchasing.materials
  const purchPct = mats.length === 0 ? 0
    : Math.round(mats.reduce((s, m) => s + matW(m.status), 0) / mats.length * 100)
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
}: {
  stage: typeof MFG_STAGES[number]
  isActive: boolean
  details: StageDetails
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
          <PurchasingContent materials={details.purchasing.materials} />
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

function ThongKeDetailPage({ order, onBack }: { order: MfgOrder; onBack: () => void }) {
  const details   = STAGE_DETAILS[order.id]
  const allDone   = !!details && isAllDone(details)
  const isDone    = order.status === 'DONE' || allDone
  const isOverdue = new Date(order.deadline) < new Date() && !isDone
  const meta      = STATUS_META[isDone ? 'DONE' : 'PRODUCING']

  // Stage cards to show
  const reachedCards: { stage: typeof MFG_STAGES[number]; isActive: boolean }[] = []

  if (isDone && details) {
    MFG_STAGES.forEach(stage => reachedCards.push({ stage, isActive: false }))
  } else if (order.status === 'PRODUCING' && order.mfgStage && details) {
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
    details && order.mfgStage && PARALLEL_STAGE_KEYS.has(order.mfgStage)
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
            <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>{order.sku} &nbsp;·&nbsp; Mã xưởng: <span style={{ fontWeight: 600, color: 'var(--text2)' }}>{order.factoryCode}</span></div>
          </div>
          <span style={{ display: 'inline-block', padding: '5px 16px', borderRadius: 20, fontSize: 13, fontWeight: 700, background: meta.bg, color: meta.color, border: `1px solid ${meta.border}`, whiteSpace: 'nowrap' }}>
            {meta.label}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginTop: 20 }}>
          {[
            { label: 'Khách hàng',    value: order.customer },
            { label: 'Số lượng',      value: `${order.qty.toLocaleString('vi-VN')} ${order.unit}` },
            { label: 'Ngày duyệt',    value: format(new Date(order.approvedAt), 'dd/MM/yyyy') },
            { label: 'Hạn giao hàng', value: format(new Date(order.deadline), 'dd/MM/yyyy'), warn: isOverdue },
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

        {reachedCards.length > 0 && details && (
          <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Chi tiết từng công đoạn
            </div>
            {reachedCards.map(({ stage, isActive }) => (
              <StageDetailCard key={stage.key} stage={stage} isActive={isActive} details={details} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── List page ────────────────────────────────────────────────────────────────

export default function ThongKePagePlan() {
  const [filter, setFilter]     = useState<FilterStatus>('all')
  const [selected, setSelected] = useState<MfgOrder | null>(null)
  const [search, setSearch]     = useState('')

  const q = search.trim().toLowerCase()
  const filtered = MOCK_ORDERS
    .filter(o => filter === 'all' || o.status === filter)
    .filter(o => !q || [o.code, o.sku, o.productName, o.factoryCode, o.customer].some(v => v.toLowerCase().includes(q)))

  const counts = {
    all:       MOCK_ORDERS.length,
    PRODUCING: MOCK_ORDERS.filter(o => o.status === 'PRODUCING').length,
    DONE:      MOCK_ORDERS.filter(o => o.status === 'DONE').length,
  }

  if (selected) {
    return <ThongKeDetailPage order={selected} onBack={() => setSelected(null)} />
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
            placeholder="Tìm mã PI, SKU, sản phẩm, khách hàng..."
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
              <th style={th}>Mã PI</th>
              <th style={th}>SKU</th>
              <th style={th}>Khách hàng</th>
              <th style={{ ...th, textAlign: 'right' }}>SL</th>
              <th style={th}>Hạn giao</th>
              <th style={th}>Ngày duyệt</th>
              <th style={th}>Trạng thái</th>
              <th style={{ ...th, width: 130 }}>Tiến độ</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((o, i) => {
              const details   = STAGE_DETAILS[o.id]
              const isDone    = o.status === 'DONE' || (!!details && isAllDone(details))
              const m         = STATUS_META[isDone ? 'DONE' : 'PRODUCING']
              const isOverdue = new Date(o.deadline) < new Date() && !isDone
              const pct       = isDone ? 100 : details ? getOverallPercent(details) : 0
              return (
                <tr
                  key={o.id}
                  onClick={() => setSelected(o)}
                  style={{ background: i % 2 === 1 ? 'var(--surface2)' : undefined, cursor: 'pointer' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = i % 2 === 1 ? 'var(--surface2)' : '' }}
                >
                  <td style={{ ...td, color: 'var(--text3)', fontWeight: 600, textAlign: 'center' }}>{o.id}</td>
                  <td style={{ ...td, fontFamily: 'monospace', fontWeight: 700 }}>{o.code}</td>
                  <td style={td}>
                    <div style={{ fontWeight: 600 }}>{o.productName}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{o.sku} · {o.factoryCode}</div>
                  </td>
                  <td style={{ ...td, color: 'var(--text2)' }}>{o.customer}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{o.qty.toLocaleString('vi-VN')} <span style={{ fontWeight: 400, color: 'var(--text3)' }}>{o.unit}</span></td>
                  <td style={{ ...td, whiteSpace: 'nowrap', color: isOverdue ? '#dc2626' : undefined, fontWeight: isOverdue ? 700 : undefined }}>
                    {format(new Date(o.deadline), 'dd/MM/yyyy')}
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
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>
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
