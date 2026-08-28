'use client'
import { useState } from 'react'
import { LayoutDashboard, Package, LogOut, CalendarClock, Warehouse, ClipboardCheck } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import SKUReviewPage from '../ProductionPlan/SKUReviewPage'
import SKUListPage from '../ProductionPlan/SKUListPage'
import VatTuDashboardPage from '../ProductionPlan/VatTuDashboardPage'
import ThongKePagePlan from '../Manufacturing/ThongKePagePlan'
import MfgWarehousesPage from '../Manufacturing/MfgWarehousesPage'
import LenhSXPage from '../ProductionPlan/LenhSXPage'


const ACCENT    = '#2e7d32'
const ACCENT_BG = '#e8f5e9'

type Page           = 'cho-duyet' | 'thong-ke' | 'sku-list' | 'vat-tu' | 'kho'
type ChoDuyetFilter = 'sku-moi' | 'lenh-sx'


// ── Tổng hợp chờ duyệt section ────────────────────────────────────────────────

// Mục "So sánh giá" đã gỡ 2026-08-27: Sếp chốt việc so sánh giá + duyệt mua diễn ra NGOÀI phần
// mềm (phiếu Excel in ra, ký tay). Mua hàng tự tải file đã ký lên ở màn "Lệnh mua vật tư" - không
// còn bước nào của Sếp trong hệ thống cho đề xuất mua. 2 mục còn lại không liên quan, giữ nguyên.
const CHO_DUYET_FILTERS: { key: ChoDuyetFilter; label: string }[] = [
  { key: 'sku-moi',    label: 'SKU mới'       },
  { key: 'lenh-sx',     label: 'Lệnh sản xuất'  },
]

function ChoDuyetSection() {
  const [filter, setFilter] = useState<ChoDuyetFilter>('sku-moi')

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
                display: 'inline-flex', alignItems: 'center', gap: 6,
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

      {filter === 'sku-moi'    && <SKUReviewPage />}
      {filter === 'lenh-sx'     && <LenhSXPage />}
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

export default function BossApp() {
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
