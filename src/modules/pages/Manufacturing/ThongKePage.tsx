import { useState } from 'react'
import { format } from 'date-fns'
import { ArrowLeft, CheckCircle2, Clock, Factory, PackageCheck, Search, ShoppingCart, TrendingUp, Wrench } from 'lucide-react'

type OrderStatus = 'APPROVED' | 'PRODUCING' | 'DONE'
type MfgStage = 'PURCHASING' | 'FRAME' | 'WEAVING' | 'PACKAGING'

interface ApprovedOrder {
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

const MFG_STAGES: { key: MfgStage; label: string; icon: React.ReactNode }[] = [
  { key: 'PURCHASING', label: 'Mua hàng',      icon: <ShoppingCart size={16} /> },
  { key: 'FRAME',      label: 'Khung cơ khí',  icon: <Wrench size={16} /> },
  { key: 'WEAVING',    label: 'Đan',           icon: <Factory size={16} /> },
  { key: 'PACKAGING',  label: 'Đóng gói',      icon: <PackageCheck size={16} /> },
]

const MOCK_ORDERS: ApprovedOrder[] = [
  { id: 1,  code: 'PI-2026-001', sku: 'SKU-GDE-001', productName: 'Giá để đồ treo tường GDE-200',    factoryCode: 'GDE-200', customer: 'Cty TNHH Minh Phát',   qty: 200,  unit: 'bộ',   deadline: '2026-07-15', approvedAt: '2026-06-18', status: 'PRODUCING', mfgStage: 'PURCHASING' },
  { id: 2,  code: 'PI-2026-002', sku: 'SKU-KS-300',  productName: 'Kệ sắt KS-300 4 tầng',           factoryCode: 'KS-300',  customer: 'Cty CP Đại Thành',     qty: 150,  unit: 'bộ',   deadline: '2026-07-20', approvedAt: '2026-06-19', status: 'APPROVED'  },
  { id: 3,  code: 'PI-2026-003', sku: 'SKU-TB-100',  productName: 'Tủ bếp inox TB-100',             factoryCode: 'TB-100',  customer: 'Nội thất Hòa Phát',    qty:  80,  unit: 'cái',  deadline: '2026-07-10', approvedAt: '2026-06-15', status: 'DONE'      },
  { id: 4,  code: 'PI-2026-004', sku: 'SKU-GK-050',  productName: 'Giường khung sắt GK-050',        factoryCode: 'GK-050',  customer: 'Khách sạn Nam Anh',    qty: 120,  unit: 'cái',  deadline: '2026-07-05', approvedAt: '2026-06-10', status: 'DONE'      },
  { id: 5,  code: 'PI-2026-005', sku: 'SKU-BT-200',  productName: 'Bàn làm việc BT-200',            factoryCode: 'BT-200',  customer: 'Cty TNHH Sao Việt',    qty: 300,  unit: 'cái',  deadline: '2026-08-01', approvedAt: '2026-06-20', status: 'APPROVED'  },
  { id: 6,  code: 'PI-2026-006', sku: 'SKU-KH-400',  productName: 'Khung nhà thép tiền chế KH-400', factoryCode: 'KH-400',  customer: 'BQL KCN Long Hậu',     qty:   5,  unit: 'bộ',   deadline: '2026-09-15', approvedAt: '2026-06-21', status: 'PRODUCING', mfgStage: 'FRAME'     },
  { id: 7,  code: 'PI-2026-007', sku: 'SKU-LX-010',  productName: 'Lồng xe đạp LX-010',             factoryCode: 'LX-010',  customer: 'Tổng kho Phương Nam',  qty: 500,  unit: 'cái',  deadline: '2026-07-28', approvedAt: '2026-06-22', status: 'APPROVED'  },
  { id: 8,  code: 'PI-2026-008', sku: 'SKU-CS-150',  productName: 'Cổng sắt nghệ thuật CS-150',     factoryCode: 'CS-150',  customer: 'Khu đô thị Vinhomes',  qty:  40,  unit: 'bộ',   deadline: '2026-07-30', approvedAt: '2026-06-23', status: 'PRODUCING', mfgStage: 'WEAVING'   },
  { id: 9,  code: 'PI-2026-009', sku: 'SKU-HC-020',  productName: 'Hàng rào composite HC-020',      factoryCode: 'HC-020',  customer: 'Cty XD Phú Mỹ Hưng',  qty: 250,  unit: 'tấm',  deadline: '2026-06-30', approvedAt: '2026-06-12', status: 'DONE'      },
  { id: 10, code: 'PI-2026-010', sku: 'SKU-DB-080',  productName: 'Đèn báo LED tích hợp DB-080',   factoryCode: 'DB-080',  customer: 'Cty Điện lực miền Nam', qty: 1000, unit: 'cái',  deadline: '2026-08-10', approvedAt: '2026-06-24', status: 'APPROVED'  },
]

const STATUS_META: Record<OrderStatus, { label: string; bg: string; color: string; border: string }> = {
  APPROVED:  { label: 'Đã duyệt',      bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  PRODUCING: { label: 'Đang sản xuất', bg: '#f0fdf4', color: '#15803d', border: '#86efac' },
  DONE:      { label: 'Hoàn thành',    bg: '#ecfdf5', color: '#065f46', border: '#6ee7b7' },
}

const th: React.CSSProperties = { padding: '10px 14px', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', background: 'var(--surface2)', textAlign: 'left', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '11px 14px', fontSize: 13, borderTop: '1px solid var(--border)', verticalAlign: 'middle' }

type FilterStatus = 'all' | OrderStatus

function MfgStageTracker({ currentStage }: { currentStage: MfgStage }) {
  const currentIdx = MFG_STAGES.findIndex(s => s.key === currentStage)
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Tiến độ sản xuất
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
        {MFG_STAGES.map((stage, idx) => {
          const done    = idx < currentIdx
          const active  = idx === currentIdx
          const pending = idx > currentIdx
          return (
            <div key={stage.key} style={{ display: 'flex', alignItems: 'center', flex: idx < MFG_STAGES.length - 1 ? '1 1 0' : undefined }}>
              {/* Node */}
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
                  {active && (
                    <div style={{ fontSize: 10, color: '#15803d', fontWeight: 600, marginTop: 2 }}>Đang thực hiện</div>
                  )}
                  {done && (
                    <div style={{ fontSize: 10, color: '#86efac', fontWeight: 600, marginTop: 2 }}>Hoàn thành</div>
                  )}
                  {pending && (
                    <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>Chờ</div>
                  )}
                </div>
              </div>
              {/* Connector */}
              {idx < MFG_STAGES.length - 1 && (
                <div style={{
                  flex: 1, height: 2, marginBottom: 28,
                  background: done ? '#86efac' : 'var(--border)',
                }} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ThongKeDetailPage({ order, onBack }: { order: ApprovedOrder; onBack: () => void }) {
  const meta = STATUS_META[order.status]
  const isOverdue = new Date(order.deadline) < new Date() && order.status !== 'DONE'

  return (
    <div>
      {/* Back button + breadcrumb */}
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

        {/* Info grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginTop: 20 }}>
          {[
            { label: 'Khách hàng',   value: order.customer },
            { label: 'Số lượng',     value: `${order.qty.toLocaleString('vi-VN')} ${order.unit}` },
            { label: 'Ngày duyệt',   value: format(new Date(order.approvedAt), 'dd/MM/yyyy') },
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

      {/* Production stage section */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px', marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Trạng thái sản xuất</div>

        {order.status === 'PRODUCING' && order.mfgStage && (
          <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: '16px 20px 20px' }}>
            <MfgStageTracker currentStage={order.mfgStage} />
          </div>
        )}

        {order.status === 'APPROVED' && (
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '16px 18px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1d4ed8' }}>Chờ bắt đầu sản xuất</div>
            <div style={{ fontSize: 13, color: '#3b82f6', marginTop: 6 }}>Lệnh đã được duyệt, chưa đưa vào sản xuất.</div>
          </div>
        )}

        {order.status === 'DONE' && (
          <div style={{ background: '#ecfdf5', border: '1px solid #6ee7b7', borderRadius: 10, padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <CheckCircle2 size={20} color="#065f46" />
              <div style={{ fontSize: 14, fontWeight: 700, color: '#065f46' }}>Đã hoàn thành toàn bộ quy trình</div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {MFG_STAGES.map(s => (
                <span key={s.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 20, background: '#dcfce7', color: '#166534' }}>
                  <CheckCircle2 size={12} /> {s.label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ThongKePage() {
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [selected, setSelected] = useState<ApprovedOrder | null>(null)
  const [search, setSearch] = useState('')

  const q = search.trim().toLowerCase()
  const filtered = MOCK_ORDERS
    .filter(o => filter === 'all' || o.status === filter)
    .filter(o => !q || [o.code, o.sku, o.productName, o.factoryCode, o.customer].some(v => v.toLowerCase().includes(q)))

  const counts = {
    all:       MOCK_ORDERS.length,
    APPROVED:  MOCK_ORDERS.filter(o => o.status === 'APPROVED').length,
    PRODUCING: MOCK_ORDERS.filter(o => o.status === 'PRODUCING').length,
    DONE:      MOCK_ORDERS.filter(o => o.status === 'DONE').length,
  }

  if (selected) {
    return <ThongKeDetailPage order={selected} onBack={() => setSelected(null)} />
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Bảng thống kê</h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text3)' }}>
          Danh sách lệnh sản xuất đã được duyệt — nhấn vào dòng để xem chi tiết
        </p>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { label: 'Đã duyệt', value: counts.all,       icon: <Factory size={20} color="#6b7280" />,   bg: '#f9fafb', color: '#374151', border: '#e5e7eb' },
          { label: 'Đang sản xuất',   value: counts.PRODUCING, icon: <TrendingUp size={20} color="#15803d" />,  bg: '#f0fdf4', color: '#15803d', border: '#86efac' },
          { label: 'Hoàn thành',      value: counts.DONE,      icon: <Clock size={20} color="#065f46" />,       bg: '#ecfdf5', color: '#065f46', border: '#6ee7b7' },
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

      {/* Search + Filter row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {([['all', 'Tất cả'], ['PRODUCING', 'Đang sản xuất'], ['DONE', 'Hoàn thành']] as [FilterStatus, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setFilter(key)}
              style={{ padding: '5px 14px', fontSize: 12, fontWeight: 600, borderRadius: 20, border: 'none', cursor: 'pointer',
                background: filter === key ? '#1d4ed8' : 'var(--surface2)',
                color: filter === key ? '#fff' : 'var(--text)',
              }}>
              {label} {key !== 'all' && <span style={{ opacity: 0.75 }}>({counts[key as OrderStatus]})</span>}
              {key === 'all' && <span style={{ opacity: 0.75 }}>({counts.all})</span>}
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
            </tr>
          </thead>
          <tbody>
            {filtered.map((o, i) => {
              const meta = STATUS_META[o.status]
              const isOverdue = new Date(o.deadline) < new Date() && o.status !== 'DONE'
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
                    {o.status === 'PRODUCING' && o.mfgStage ? (
                      <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}>
                        {MFG_STAGES.find(s => s.key === o.mfgStage)?.label}
                      </span>
                    ) : (
                      <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}>
                        {meta.label}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
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
