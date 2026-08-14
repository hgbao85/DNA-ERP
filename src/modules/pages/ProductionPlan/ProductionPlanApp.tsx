import { useState } from 'react'
import { LayoutDashboard, Package, LogOut, Grid, CalendarClock, ClipboardList, Boxes, Warehouse, Settings, FilePlus, ScanSearch, Layers } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { useFetch } from '../../../hooks/useFetch'
import { getCuttingBatchSuggestions } from '../../../services/cutting-batch-api'
import VatTuDashboardPage from './VatTuDashboardPage'
import MfgWarehousesPage from '../Manufacturing/MfgWarehousesPage'
import SKUReviewPage from './SKUReviewPage'
import SKUListPage from './SKUListPage'
import ThongKePagePlan from '../Manufacturing/ThongKePagePlan'
import LenhSXPage from './LenhSXPage'
import KiemTraVatTuPage from './KiemTraVatTuPage'
import GomDotCatPage from './GomDotCatPage'

type Page = 'planforms' | 'duyet-sku' | 'vattu' | 'kiem-tra-vt' | 'thongke' | 'lenh-sx' | 'gom-cat' | 'materials' | 'warehouses' | 'setup'

interface Props { onBack?: () => void }

export default function ProductionPlanApp({ onBack }: Props) {
  const { user, logout, isBoss } = useAuth()
  const [activePage, setActivePage] = useState<Page>('thongke')

  // Badge dùng endpoint gợi ý (nhẹ, đúng mục đích đếm); màn GomDotCatPage tự nạp bảng ứng viên
  // riêng vì cần shape khác hẳn. Chấp nhận 2 request: gộp chung sẽ phải kéo cả bảng vào app shell
  // chỉ để lấy 1 con số.
  const { data: batchSuggestions } = useFetch(getCuttingBatchSuggestions)
  // Chỉ đếm nhóm GỘP ĐƯỢC: nhóm "gộp không cứu được" là việc của thiết kế/ngưỡng, KHSX không thao
  // tác gì được - đưa vào badge chỉ tạo con số đỏ không bao giờ về 0.
  const batchCount = (batchSuggestions ?? []).filter((s) => s.outcome === 'FIXED_BY_MERGE').length

  const navBtn = (page: Page, icon: React.ReactNode, label: string, badge?: number) => {
    const active = activePage === page
    return (
      <button
        onClick={() => setActivePage(page)}
        style={{
          display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '8px 10px', marginBottom: 2,
          border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer', textAlign: 'left', fontSize: 13,
          background: active ? '#e8f5e9' : 'transparent',
          color: active ? '#2e7d32' : 'var(--text)',
          fontWeight: active ? 600 : 400,
        }}
      >
        {icon}
        <span style={{ flex: 1 }}>{label}</span>
        {badge !== undefined && badge > 0 && (
          <span style={{ minWidth: 18, height: 18, padding: '0 5px', borderRadius: 20, background: '#c62828', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {badge}
          </span>
        )}
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <div style={{ width: 210, flexShrink: 0, background: 'var(--surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 16px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            {onBack && (
              <button onClick={onBack} style={{ padding: 6, background: 'var(--surface2)', border: 'none', borderRadius: 'var(--radius)', display: 'flex', cursor: 'pointer' }} title="Trở về trang chủ">
                <Grid size={16} color="var(--text)" />
              </button>
            )}
            <div style={{ fontWeight: 700, fontSize: 14 }}>Kế hoạch sản xuất</div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>Đông Nam Á Corp</div>
        </div>

        <nav style={{ flex: 1, padding: '4px 8px' }}>
          {navBtn('thongke',    <CalendarClock size={16} />,   'Bảng thống kê')}
          {navBtn('planforms',  <LayoutDashboard size={16} />, 'Danh sách SKU')}
          {navBtn('duyet-sku',    <FilePlus size={16} />,        'Duyệt SKU')}
            {navBtn('lenh-sx',    <ClipboardList size={16} />,  isBoss ? 'Duyệt lệnh SX' : 'Lệnh sản xuất mới')}
          {navBtn('gom-cat',    <Layers size={16} />,         'Tối ưu cắt sắt', batchCount)}
          {navBtn('kiem-tra-vt', <ScanSearch size={16} />,     'Kiểm tra vật tư')}
                    {navBtn('vattu',      <Package size={16} />,         'Danh sách vật tư')}
          {navBtn('warehouses', <Warehouse size={16} />,      'Tổng hợp kho')}
        </nav>

        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#e8f5e9', color: '#2e7d32', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
              {user?.name.split(' ').pop()?.substring(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{user?.name}</div>
              <div style={{ fontSize: 10, color: 'var(--text3)' }}>Kế hoạch SX</div>
            </div>
            <button onClick={logout} style={{ padding: 4, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex' }} title="Đăng xuất">
              <LogOut size={16} color="var(--text3)" />
            </button>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
        {activePage === 'thongke'    && <ThongKePagePlan />}
        {activePage === 'planforms'  && <SKUListPage />}
        {activePage === 'duyet-sku'    && <SKUReviewPage />}
        {activePage === 'vattu'      && <VatTuDashboardPage />}
        {activePage === 'kiem-tra-vt' && <KiemTraVatTuPage />}
        {activePage === 'lenh-sx'    && <LenhSXPage />}
        {activePage === 'gom-cat'    && <GomDotCatPage onDone={() => setActivePage('lenh-sx')} />}
        {activePage === 'warehouses' && <MfgWarehousesPage />}
      </div>
    </div>
  )
}
