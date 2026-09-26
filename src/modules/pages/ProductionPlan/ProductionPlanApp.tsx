import { useEffect, useState } from 'react'
import { LayoutDashboard, Package, LogOut, Grid, CalendarClock, ClipboardList, Warehouse, FilePlus, Layers, Menu, X } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { useFetch } from '../../../hooks/useFetch'
import { useIsCompact, useIsMobile } from '../../../hooks/useMediaQuery'
import { useUrlState } from '../../../hooks/useUrlState'
import { getCuttingBatchSuggestions } from '../../../services/cutting-batch-api'
import NotificationCenter from '../../../components/NotificationCenter'
import VatTuDashboardPage from './VatTuDashboardPage'
import MfgWarehousesPage from '../Manufacturing/MfgWarehousesPage'
import SKUReviewPage from './SKUReviewPage'
import SKUListPage from './SKUListPage'
import ThongKePagePlan from '../Manufacturing/ThongKePagePlan'
import LenhSXPage from './LenhSXPage'
import GomDotCatPage from './GomDotCatPage'
import ThemeToggle from '../../../components/ThemeToggle'

type Page = 'planforms' | 'duyet-sku' | 'vattu' | 'thongke' | 'lenh-sx' | 'gom-cat' | 'warehouses'

const PAGE_VALUES: Page[] = ['planforms', 'duyet-sku', 'vattu', 'thongke', 'lenh-sx', 'gom-cat', 'warehouses']
const isPage = (v: string | null): v is Page => !!v && (PAGE_VALUES as string[]).includes(v)

interface Props { onBack?: () => void }

export default function ProductionPlanApp({ onBack }: Props) {
  const { user, logout, isBoss } = useAuth()
  // `p` trong query string - cho phép NotificationCenter mở đúng tab (vd thông báo cắt sắt trỏ
  // tới 'lenh-sx') qua router.push('/?m=production_plan&p=lenh-sx'), xem changelog notification
  // 2026-09-25 mục 6.2 + NotificationCenter.tsx. Đọc 1 lần lúc khởi tạo state cho giá trị đầu, rồi
  // đồng bộ 2 chiều qua setActivePage/effect bên dưới - y hệt cách app/page.tsx làm với `m`.
  const [urlPage, setUrlPage] = useUrlState('p')
  const [activePage, setActivePageState] = useState<Page>(() => (isPage(urlPage) ? urlPage : 'thongke'))
  const setActivePage = (page: Page) => { setActivePageState(page); setUrlPage(page) }
  useEffect(() => {
    if (isPage(urlPage) && urlPage !== activePage) setActivePageState(urlPage)
  }, [urlPage])
  // Màn hình hẹp (< 900px): sidebar ẩn thành drawer mở qua nút ☰ - cùng idiom SalesApp/PurchasingApp.
  const isCompact = useIsCompact()
  const isMobile = useIsMobile()
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Badge dùng endpoint gợi ý (nhẹ, đúng mục đích đếm); màn GomDotCatPage tự nạp bảng ứng viên
  // riêng vì cần shape khác hẳn. Chấp nhận 2 request: gộp chung sẽ phải kéo cả bảng vào app shell
  // chỉ để lấy 1 con số.
  const { data: batchSuggestions } = useFetch(getCuttingBatchSuggestions)
  // Chỉ đếm nhóm GỘP ĐƯỢC: nhóm "gộp không cứu được" là việc của thiết kế/ngưỡng, KHSX không thao
  // tác gì được - đưa vào badge chỉ tạo con số đỏ không bao giờ về 0.
  const batchCount = (batchSuggestions ?? []).filter((s) => s.outcome === 'FIXED_BY_MERGE').length

  const NAV: { page: Page; icon: React.ReactNode; label: string; badge?: number }[] = [
    { page: 'thongke',    icon: <CalendarClock size={16} />,   label: 'Tổng hợp lệnh SX' },
    { page: 'planforms',  icon: <LayoutDashboard size={16} />, label: 'Danh sách SKU' },
    { page: 'duyet-sku',  icon: <FilePlus size={16} />,        label: 'Duyệt SKU' },
    { page: 'lenh-sx',    icon: <ClipboardList size={16} />,   label: isBoss ? 'Duyệt lệnh SX' : 'Lệnh sản xuất mới' },
    { page: 'gom-cat',    icon: <Layers size={16} />,          label: 'Tối ưu cắt sắt', badge: batchCount },
    { page: 'vattu',      icon: <Package size={16} />,         label: 'Tổng hợp vật tư' },
    { page: 'warehouses', icon: <Warehouse size={16} />,       label: 'Tổng hợp kho' },
  ]

  const selectPage = (page: Page) => { setActivePage(page); setDrawerOpen(false) }

  const navBtn = ({ page, icon, label, badge }: typeof NAV[number]) => {
    const active = activePage === page
    return (
      <button
        key={page}
        onClick={() => selectPage(page)}
        style={{
          display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: isCompact ? '11px 10px' : '8px 10px', marginBottom: 2,
          border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer', textAlign: 'left', fontSize: 13,
          background: active ? 'var(--bg-e8f5e9)' : 'transparent',
          color: active ? 'var(--fg-2e7d32)' : 'var(--text)',
          fontWeight: active ? 600 : 400,
        }}
      >
        {icon}
        <span style={{ flex: 1 }}>{label}</span>
        {badge !== undefined && badge > 0 && (
          <span style={{ minWidth: 18, height: 18, padding: '0 5px', borderRadius: 20, background: 'var(--bg-c62828)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {badge}
          </span>
        )}
      </button>
    )
  }

  const sidebar = (
    <div style={{ width: 210, flexShrink: 0, height: '100%', background: 'var(--surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px 16px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          {onBack && (
            <button onClick={onBack} style={{ padding: 6, background: 'var(--surface2)', border: 'none', borderRadius: 'var(--radius)', display: 'flex', cursor: 'pointer' }} title="Trở về trang chủ">
              <Grid size={16} color="var(--text)" />
            </button>
          )}
          <div style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>Kế hoạch sản xuất</div>
          {isCompact && (
            <button onClick={() => setDrawerOpen(false)} aria-label="Đóng menu" style={{ padding: 4, background: 'transparent', border: 'none', display: 'flex' }}>
              <X size={18} />
            </button>
          )}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)' }}>Đông Nam Á Corp</div>
      </div>

      <nav style={{ flex: 1, padding: '4px 8px', overflowY: 'auto' }}>
        {NAV.map(navBtn)}
      </nav>

      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, flexShrink: 0, borderRadius: '50%', background: 'var(--bg-e8f5e9)', color: 'var(--fg-2e7d32)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
            {user?.name.split(' ').pop()?.substring(0, 2).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</div>
            <div style={{ fontSize: 10, color: 'var(--text3)' }}>Kế hoạch SX</div>
          </div>
          <ThemeToggle />
          <NotificationCenter color="var(--text3)" />
          <button onClick={logout} style={{ padding: 4, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex' }} title="Đăng xuất">
            <LogOut size={16} color="var(--text3)" />
          </button>
        </div>
      </div>
    </div>
  )

  const content = (
    <>
      {activePage === 'thongke'    && <ThongKePagePlan />}
      {activePage === 'planforms'  && <SKUListPage />}
      {activePage === 'duyet-sku'  && <SKUReviewPage />}
      {activePage === 'vattu'      && <VatTuDashboardPage />}
      {activePage === 'lenh-sx'    && <LenhSXPage />}
      {activePage === 'gom-cat'    && <GomDotCatPage onDone={() => setActivePage('lenh-sx')} />}
      {activePage === 'warehouses' && <MfgWarehousesPage />}
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

  const active = NAV.find(n => n.page === activePage)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <button onClick={() => setDrawerOpen(true)} aria-label="Mở menu" style={{ position: 'relative', padding: 6, background: 'transparent', border: 'none', display: 'flex' }}>
          <Menu size={20} />
          {batchCount > 0 && <span style={{ position: 'absolute', top: 3, right: 3, width: 8, height: 8, borderRadius: '50%', background: 'var(--bg-c62828)' }} />}
        </button>
        <div style={{ fontWeight: 700, fontSize: 14, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          Kế hoạch SX <span style={{ color: 'var(--text3)', fontWeight: 400 }}>· {active?.label}</span>
        </div>
        <NotificationCenter size={20} />
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
