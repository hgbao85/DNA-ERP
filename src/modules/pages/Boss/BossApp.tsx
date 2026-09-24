'use client'
import { useState } from 'react'
import { LayoutDashboard, Package, LogOut, CalendarClock, Warehouse, ClipboardCheck, Menu, X } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { useIsCompact, useIsMobile } from '../../../hooks/useMediaQuery'
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
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
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
  // Màn hình hẹp (< 900px): sidebar ẩn thành drawer mở qua nút ☰ - cùng idiom SalesApp/PurchasingApp/ProductionPlanApp.
  const isCompact = useIsCompact()
  const isMobile  = useIsMobile()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const selectPage = (id: Page) => { setPage(id); setDrawerOpen(false) }

  const sidebar = (
      <div style={{ width: 210, flexShrink: 0, height: '100%', background: 'var(--surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 16px 12px', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Giám đốc</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Đông Nam Á Corp</div>
          </div>
          {isCompact && (
            <button onClick={() => setDrawerOpen(false)} aria-label="Đóng menu" style={{ padding: 4, background: 'transparent', border: 'none', display: 'flex' }}>
              <X size={18} />
            </button>
          )}
        </div>

        <nav style={{ flex: 1, padding: '4px 8px', overflowY: 'auto' }}>
          {NAV_ITEMS.map(item => {
            const active = page === item.id
            return (
              <button
                key={item.id}
                onClick={() => selectPage(item.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9, width: '100%',
                  padding: isCompact ? '11px 10px' : '8px 10px', marginBottom: 2, border: 'none',
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
            <div style={{ width: 28, height: 28, flexShrink: 0, borderRadius: '50%', background: ACCENT_BG, color: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
              {user?.name.split(' ').pop()?.substring(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</div>
              <div style={{ fontSize: 10, color: 'var(--text3)' }}>Giám đốc</div>
            </div>
            <button onClick={logout} style={{ padding: 4, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex' }} title="Đăng xuất">
              <LogOut size={16} color="var(--text3)" />
            </button>
          </div>
        </div>
      </div>

  )

  const content = (
    <>
      {page === 'cho-duyet' && <ChoDuyetSection />}
      {page === 'thong-ke'  && <ThongKePagePlan />}
      {page === 'sku-list'  && <SKUListPage readOnly />}
      {page === 'vat-tu'    && <VatTuDashboardPage />}
      {page === 'kho'       && <MfgWarehousesPage />}
    </>
  )

  if (!isCompact) {
    return (
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        {sidebar}
        <div style={{ flex: 1, minWidth: 0, overflow: 'auto', padding: '20px 24px' }}>{content}</div>
      </div>
    )
  }

  const activeItem = NAV_ITEMS.find(n => n.id === page)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <button onClick={() => setDrawerOpen(true)} aria-label="Mở menu" style={{ padding: 6, background: 'transparent', border: 'none', display: 'flex' }}>
          <Menu size={20} />
        </button>
        <div style={{ fontWeight: 700, fontSize: 14, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          Giám đốc <span style={{ color: 'var(--text3)', fontWeight: 400 }}>· {activeItem?.label}</span>
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0, overflow: 'auto', padding: isMobile ? '14px 12px 80px' : '18px 20px 80px' }}>{content}</div>

      {drawerOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex' }}>
          <div onClick={() => setDrawerOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.4)' }} />
          <div style={{ position: 'relative', height: '100%', boxShadow: '4px 0 20px rgba(0,0,0,.15)' }}>{sidebar}</div>
        </div>
      )}
    </div>
  )
}

