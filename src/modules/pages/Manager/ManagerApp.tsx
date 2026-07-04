'use client'
import { useState } from 'react'
import { LayoutDashboard, Package, LogOut, CalendarClock, Warehouse, ClipboardCheck, Check, X } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import SKUReviewPage from '../ProductionPlan/SKUReviewPage'
import SKUListPage from '../ProductionPlan/SKUListPage'
import VatTuDashboardPage from '../ProductionPlan/VatTuDashboardPage'
import ThongKePagePlan from '../Manufacturing/ThongKePagePlan'
import MfgWarehousesPage from '../Manufacturing/MfgWarehousesPage'
import PIListPage from '../ProductionPlan/PIListPage'

const ACCENT    = '#2e7d32'
const ACCENT_BG = '#e8f5e9'

type Page           = 'cho-duyet' | 'thong-ke' | 'sku-list' | 'vat-tu' | 'kho'
type ChoDuyetFilter = 'dinh-muc' | 'so-sanh-gia' | 'lenh-sx'

// ── Mock price comparison data ────────────────────────────────────────────────

interface Offer    { supplier: string; price: number; leadDays: number }
interface PriceComp { id: number; material: string; qty: number; unit: string; offers: Offer[]; bestIdx: number }

type CompStatus = 'cho-duyet' | 'da-duyet' | 'tu-choi'

const COMP_STATUS: Record<CompStatus, { label: string; color: string; bg: string }> = {
  'cho-duyet': { label: 'Chờ duyệt', color: '#92400e', bg: '#fef3c7' },
  'da-duyet':  { label: 'Đã duyệt',  color: '#166534', bg: '#dcfce7' },
  'tu-choi':   { label: 'Từ chối',   color: '#991b1b', bg: '#fee2e2' },
}

const PRICE_COMPS: PriceComp[] = [
  {
    id: 1, material: 'Thép ống D25×1.5', qty: 500, unit: 'kg',
    offers: [
      { supplier: 'Minh Thành',  price: 45_000, leadDays: 7  },
      { supplier: 'An Phát',     price: 43_500, leadDays: 10 },
      { supplier: 'Long Sơn',    price: 46_000, leadDays: 5  },
    ],
    bestIdx: 1,
  },
  {
    id: 2, material: 'Sơn tĩnh điện đen', qty: 200, unit: 'kg',
    offers: [
      { supplier: 'Đại Hưng',    price: 85_000, leadDays: 14 },
      { supplier: 'Việt Thắng',  price: 82_000, leadDays: 7  },
    ],
    bestIdx: 1,
  },
  {
    id: 3, material: 'Dây đan PE 2mm', qty: 1_000, unit: 'm',
    offers: [
      { supplier: 'Nhựa Đông Nam', price: 12_000, leadDays: 3 },
      { supplier: 'Tiến Thịnh',    price: 11_500, leadDays: 5 },
      { supplier: 'An Phát',       price: 11_800, leadDays: 4 },
    ],
    bestIdx: 1,
  },
  {
    id: 4, material: 'Bao bì carton 5 lớp', qty: 300, unit: 'cái',
    offers: [
      { supplier: 'Bao bì Việt', price: 18_000, leadDays: 5 },
      { supplier: 'Tiến Long',   price: 17_500, leadDays: 7 },
    ],
    bestIdx: 1,
  },
]

// ── So sánh giá section (mock) ────────────────────────────────────────────────

function SoSanhGiaSection() {
  const [statusMap, setStatusMap] = useState<Record<number, CompStatus>>({})
  const approve = (id: number) => setStatusMap(p => ({ ...p, [id]: 'da-duyet' }))
  const reject  = (id: number) => setStatusMap(p => ({ ...p, [id]: 'tu-choi'  }))
  const fmt     = (n: number)  => n.toLocaleString('vi-VN')

  const pendingCount = PRICE_COMPS.filter(c => (statusMap[c.id] ?? 'cho-duyet') === 'cho-duyet').length

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700 }}>So sánh giá</h2>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text3)' }}>
          {pendingCount > 0 ? `${pendingCount} vật tư chờ phê duyệt` : 'Tất cả đã được xử lý'}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {PRICE_COMPS.map(comp => {
          const status = statusMap[comp.id] ?? 'cho-duyet'
          const cfg    = COMP_STATUS[status]
          const isDone = status !== 'cho-duyet'

          return (
            <div key={comp.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', opacity: isDone ? 0.72 : 1 }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 18px', borderBottom: '1px solid var(--border)', background: isDone ? 'var(--surface2)' : 'var(--surface)' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{comp.material}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Số lượng: {fmt(comp.qty)} {comp.unit}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, color: cfg.color, background: cfg.bg }}>
                    {cfg.label}
                  </span>
                  {!isDone && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => approve(comp.id)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 14px', fontSize: 12, fontWeight: 700, border: 'none', borderRadius: 7, background: '#16a34a', color: '#fff', cursor: 'pointer' }}
                      >
                        <Check size={13} /> Duyệt
                      </button>
                      <button
                        onClick={() => reject(comp.id)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 14px', fontSize: 12, fontWeight: 700, border: '1px solid #fca5a5', borderRadius: 7, background: '#fff5f5', color: '#dc2626', cursor: 'pointer' }}
                      >
                        <X size={13} /> Từ chối
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Supplier grid */}
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${comp.offers.length}, 1fr)` }}>
                {comp.offers.map((offer, idx) => {
                  const isBest = idx === comp.bestIdx
                  return (
                    <div
                      key={idx}
                      style={{
                        padding: '14px 16px', position: 'relative',
                        borderRight: idx < comp.offers.length - 1 ? '1px solid var(--border)' : 'none',
                        background: isBest ? '#f0fdf4' : 'transparent',
                      }}
                    >
                      {isBest && (
                        <div style={{ position: 'absolute', top: 8, right: 8, fontSize: 10, fontWeight: 700, color: '#16a34a', background: '#dcfce7', padding: '1px 7px', borderRadius: 10 }}>
                          Đề xuất
                        </div>
                      )}
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>{offer.supplier}</div>
                      <div style={{ fontSize: 19, fontWeight: 800, color: isBest ? '#16a34a' : 'var(--text)' }}>
                        {fmt(offer.price)}
                        <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text3)', marginLeft: 3 }}>đ/{comp.unit}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>Lead: {offer.leadDays} ngày</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Tổng hợp chờ duyệt section ────────────────────────────────────────────────

const CHO_DUYET_FILTERS: { key: ChoDuyetFilter; label: string }[] = [
  { key: 'dinh-muc',    label: 'Định mức'       },
  { key: 'so-sanh-gia', label: 'So sánh giá'    },
  { key: 'lenh-sx',     label: 'Lệnh sản xuất'  },
]

function ChoDuyetSection() {
  const [filter, setFilter] = useState<ChoDuyetFilter>('dinh-muc')

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {CHO_DUYET_FILTERS.map(f => {
          const active = filter === f.key
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                padding: '6px 16px', fontSize: 13, fontWeight: active ? 600 : 400,
                border: `1px solid ${active ? ACCENT : 'var(--border)'}`,
                borderRadius: 20, cursor: 'pointer',
                background: active ? ACCENT_BG : 'var(--surface)',
                color: active ? ACCENT : 'var(--text2)',
                transition: 'all .15s',
              }}
            >
              {f.label}
            </button>
          )
        })}
      </div>

      {/* {filter === 'dinh-muc'    && <SKUReviewPage />}
      {filter === 'so-sanh-gia' && <SoSanhGiaSection />}
      {filter === 'lenh-sx'     && <PIListPage />} */}
    </div>
  )
}

// ── Main app ──────────────────────────────────────────────────────────────────

const NAV_ITEMS: { id: Page; label: string; icon: React.ReactNode }[] = [
  { id: 'cho-duyet', label: 'Tổng hợp chờ duyệt', icon: <ClipboardCheck  size={16} /> },
  { id: 'thong-ke',  label: 'Tổng hợp lệnh SX',   icon: <CalendarClock   size={16} /> },
  { id: 'sku-list',  label: 'Danh sách SKU',       icon: <LayoutDashboard size={16} /> },
  { id: 'vat-tu',    label: 'Tổng hợp vật tư',     icon: <Package         size={16} /> },
  { id: 'kho',       label: 'Tổng hợp kho',        icon: <Warehouse       size={16} /> },
]

export default function ManagerApp() {
  const { user, logout } = useAuth()
  const [page, setPage]  = useState<Page>('cho-duyet')

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <div style={{ width: 210, flexShrink: 0, background: 'var(--surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 16px 12px' }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Giám đốc</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Đông Nam Á Corp</div>
        </div>

        <nav style={{ flex: 1, padding: '4px 8px' }}>
          {NAV_ITEMS.map(item => {
            const active = page === item.id
            return (
              <button
                key={item.id}
                onClick={() => setPage(item.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9, width: '100%',
                  padding: '8px 10px', marginBottom: 2, border: 'none',
                  borderRadius: 'var(--radius)', cursor: 'pointer', textAlign: 'left', fontSize: 13,
                  background: active ? ACCENT_BG : 'transparent',
                  color: active ? ACCENT : 'var(--text)',
                  fontWeight: active ? 600 : 400,
                  transition: 'background .1s',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--surface2)' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
              >
                {item.icon}
                {item.label}
              </button>
            )
          })}
        </nav>

        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: ACCENT_BG, color: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
              {user?.name.split(' ').pop()?.substring(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{user?.name}</div>
              <div style={{ fontSize: 10, color: 'var(--text3)' }}>Giám đốc</div>
            </div>
            <button onClick={logout} style={{ padding: 4, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex' }} title="Đăng xuất">
              <LogOut size={16} color="var(--text3)" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
        {page === 'cho-duyet' && <ChoDuyetSection />}
        {page === 'thong-ke'  && <ThongKePagePlan />}
        {page === 'sku-list'  && <SKUListPage readOnly />}
        {page === 'vat-tu'    && <VatTuDashboardPage />}
        {page === 'kho'       && <MfgWarehousesPage />}
      </div>
    </div>
  )
}
