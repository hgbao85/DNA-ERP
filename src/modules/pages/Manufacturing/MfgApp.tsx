import { useState } from 'react'
import { ClipboardList, Settings, LogOut, Grid, Package, Boxes, Warehouse, ClipboardCheck, Box, CalendarClock, Wrench, Flame, SprayCan, Check, Frame, Layers, Play, PackageCheck, Ruler } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import LenhSXPage from '../ProductionPlan/LenhSXPage'
import SpecSteelPage from './SpecSteelPage'
import SpecDetailQuotaPage from './SpecDetailQuotaPage'
import MfgWarehousesPage from './MfgWarehousesPage'
import MfgAllMaterialsPage from './MfgAllMaterialsPage'
import WeavingPointsPage from '../Admin/masterData/WeavingPointsPage'
import ThongKePagePlan from './ThongKePagePlan'
import LenhSanXuatPhoi from '../Phoi/LenhSanXuatPhoi'
import HuongDanCatPage from '../Phoi/HuongDanCatPage'
import KhoPhoiPage from '../Phoi/KhoPhoiPage'
import XacNhanNhanSatPage from '../Phoi/XacNhanNhanSatPage'
import LenhSanXuatHan from '../Han/LenhSanXuatHan'
import KhungHanPage from '../Han/KhungHanPage'
import LenhSanXuatSon from '../Son/LenhSanXuatSon'
import ManhChoDanPage from '../Son/ManhChoDanPage'
import PhoiDinhMucManhPage from './PhoiDinhMucManhPage'
import XacNhanVatTuPage from './XacNhanVatTuPage'
import SKUListPage from '../ProductionPlan/SKUListPage'
import KcsPhoiPage from '../Kcs/KcsPhoiPage'
import KcsHanPage from '../Kcs/KcsHanPage'
import KcsSonPage from '../Kcs/KcsSonPage'
import KcsVatTuThanhPhamPage from '../Kcs/KcsVatTuThanhPhamPage'

// ── Module-level constants (không tạo lại mỗi render) ───────────────────────

type TabId =
  | 'lenh-sx' | 'ke-hoach' | 'phoi-xac-nhan-nhan-sat' | 'phoi-lenh-sx' | 'phoi-huong-dan-cat' | 'phoi-dinh-muc-manh' | 'phoi-kho-phoi'
  | 'han-khung-han' | 'son-manh-cho-dan' | 'han-son-xac-nhan-vat-tu'
  | 'weaving-points' | 'sku-list'
  | 'materials' | 'warehouses' | 'setup'
  | 'kcs-phoi' | 'kcs-han' | 'kcs-son' | 'kcs-vat-tu-tp'

// 'catalog' của SPEC_ACCESSORY gộp chung Sơn + Phụ kiện + Bao bì (tab bên trong SpecAccessoryCatalogPage).
type SetupSubTab = 'vat-tu' | 'dinh-muc' | 'catalog'

const SPEC_ROLES = ['SPEC_STEEL', 'SPEC_ACCESSORY'] as const

const MFG_ROLE_LABELS: Record<string, string> = {
  PRODUCTION_MANAGER: 'Quản lý SX',
  PHOI: 'Thống kê Phôi',
  HAN: 'Bộ phận Hàn',
  SON: 'Bộ phận Sơn',
  KCS: 'KCS — Kiểm tra chất lượng',
  SPEC_STEEL: 'NV Định mức mảnh',
  SPEC_ACCESSORY: 'NV Định mức chi tiết',
}

const SPEC_SETUP_ITEMS: Record<string, { id: SetupSubTab; label: string; icon: 'clipboard' | 'grid' | 'box' }[]> = {
  // "Định mức mảnh" gồm cả 5 nhóm vật tư (Sắt/Dây/Đinh/Tán rút/Nút nhựa) — 1 account Sắt nhập
  // chung, gửi duyệt 1 lần (xem SpecSteelPage.tsx).
  SPEC_STEEL: [
    { id: 'dinh-muc', label: 'Định mức mảnh', icon: 'grid' },
    { id: 'catalog', label: 'Danh sách vật tư', icon: 'box' },
  ],
  // "Định mức chi tiết" gồm cả 3 nhóm vật tư (Sơn/Phụ kiện/Bao bì) — 1 account nhập chung,
  // gửi duyệt 1 lần (xem SpecDetailQuotaPage.tsx), y hệt cách "định mức mảnh" bên trên hoạt động.
  SPEC_ACCESSORY: [
    { id: 'dinh-muc', label: 'Định mức mới', icon: 'clipboard' },
    { id: 'catalog', label: 'Danh sách vật tư', icon: 'box' },
  ],
}

const SPEC_ICON = {
  clipboard: <ClipboardCheck size={16} />,
  grid: <Grid size={16} />,
  box: <Box size={16} />,
} as const

const navBtnStyle = (active: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 9, width: '100%',
  padding: '8px 10px', marginBottom: 2, border: 'none', borderRadius: 'var(--radius)',
  background: active ? '#fff3e0' : 'transparent',
  color: active ? '#e65100' : 'var(--text2)',
  fontWeight: active ? 600 : 400,
  fontSize: 13, textAlign: 'left', cursor: 'pointer', transition: 'background .1s',
})

// ── Component ────────────────────────────────────────────────────────────────

interface MfgAppProps {
  onBack?: () => void // chỉ truyền cho giám đốc (có nhiều phân hệ); prodmgr/thợ bị khóa trong MES
}

export default function MfgApp({ onBack }: MfgAppProps) {
  const { user, logout } = useAuth()

  const canManageBom = user?.mfgRole === 'PRODUCTION_MANAGER' || user?.role === 'BOSS'
  // Tổng giám đốc = BOSS không gắn mfgRole. Thủ kho = WAREHOUSE_STAFF không mfgRole.
  const isDirector = user?.role === 'BOSS' && !user?.mfgRole
  const isWarehouse = user?.role === 'WAREHOUSE_STAFF' && !user?.mfgRole
  const isProdMgr = user?.mfgRole === 'PRODUCTION_MANAGER'
  const isPhoi = user?.mfgRole === 'PHOI'
  const isHan = user?.mfgRole === 'HAN'
  const isSon = user?.mfgRole === 'SON'
  const isKcs = user?.mfgRole === 'KCS'
  const isSpecRole = !!user?.mfgRole && SPEC_ROLES.includes(user.mfgRole as typeof SPEC_ROLES[number])
  const canSeeWarehouses = isDirector || isWarehouse || isProdMgr

  // Readable if-else chain thay cho ternary lồng 6 cấp
  let initialTab: TabId = 'lenh-sx'
  if (isDirector) initialTab = 'ke-hoach'
  else if (isProdMgr) initialTab = 'ke-hoach'
  else if (isPhoi || isHan || isSon) initialTab = 'phoi-lenh-sx'
  else if (isKcs)                initialTab = 'kcs-phoi'
  else if (isSpecRole) initialTab = 'setup'

  const [tab, setTab] = useState<TabId>(initialTab)
  // Một state duy nhất cho tất cả SPEC role sub-tabs — mặc định = mục đầu tiên của role
  const [setupSubTab, setSetupSubTab] = useState<SetupSubTab>(
    () => (user?.mfgRole && SPEC_SETUP_ITEMS[user.mfgRole]?.[0]?.id) || 'dinh-muc'
  )
  // Nhảy từ "Lệnh sản xuất" (nút "Xem hướng dẫn cắt" trong CutBatchPanel) sang đúng PI đang mở ở
  // "Hướng dẫn cắt" - 2 tab độc lập nên phải nâng state PI lên đây thay vì giữ trong 1 trong 2 con.
  const [huongDanCatPiId, setHuongDanCatPiId] = useState<string | null>(null)
  const openHuongDanCat = (piId: string) => { setHuongDanCatPiId(piId); setTab('phoi-huong-dan-cat') }

  const roleLabel = user?.mfgRole
    ? (MFG_ROLE_LABELS[user.mfgRole] ?? user.mfgRole)
    : user?.role === 'BOSS' ? 'Giám đốc (xem)' : isWarehouse ? 'Thủ kho' : ''

  const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
    ...(isDirector ? [{ id: 'pi-list' as TabId, label: 'Lệnh sản xuất mới', icon: <ClipboardList size={16} /> }] : []),
    ...(isDirector ? [{ id: 'ke-hoach' as TabId, label: 'Kế hoạch SX', icon: <CalendarClock size={16} /> }] : []),
    ...(isProdMgr ? [{ id: 'ke-hoach' as TabId, label: 'Bảng thống kê', icon: <CalendarClock size={16} /> }] : []),
    ...(isProdMgr ? [{ id: 'lenh-sx' as TabId, label: 'Xử lý lệnh sản xuất', icon: <Play size={16} /> }] : []),
    ...((isPhoi || isHan || isSon || isDirector) ? [{ id: 'phoi-lenh-sx' as TabId, label: 'Lệnh sản xuất', icon: <ClipboardCheck size={16} /> }] : []),
    ...(isPhoi ? [{ id: 'phoi-huong-dan-cat' as TabId, label: 'Hướng dẫn cắt', icon: <Ruler size={16} /> }] : []),
    ...(isPhoi ? [{ id: 'phoi-xac-nhan-nhan-sat' as TabId, label: 'Xác nhận nhận sắt', icon: <Check size={16} /> }] : []),
    ...((isHan || isSon) ? [{ id: 'han-son-xac-nhan-vat-tu' as TabId, label: 'Xác nhận sản lượng', icon: <PackageCheck size={16} /> }] : []),
    ...((isPhoi || isHan || isSon) ? [{ id: 'phoi-dinh-muc-manh' as TabId, label: 'Danh sách định mức mảnh', icon: <Box size={16} /> }] : []),
    ...(isPhoi ? [{ id: 'phoi-kho-phoi' as TabId, label: 'Kho phôi', icon: <Warehouse size={16} /> }] : []),
    ...(isHan ? [{ id: 'han-khung-han' as TabId, label: 'Khung hàn', icon: <Frame size={16} /> }] : []),
    ...(isSon ? [{ id: 'son-manh-cho-dan' as TabId, label: 'Mảnh chờ đan', icon: <Layers size={16} /> }] : []),
    ...(isKcs ? [{ id: 'kcs-phoi' as TabId, label: 'Phôi', icon: <Wrench size={16} /> }] : []),
    ...(isKcs ? [{ id: 'kcs-han' as TabId, label: 'Hàn', icon: <Flame size={16} /> }] : []),
    ...(isKcs ? [{ id: 'kcs-son' as TabId, label: 'Sơn', icon: <SprayCan size={16} /> }] : []),
    ...(isKcs ? [{ id: 'kcs-vat-tu-tp' as TabId, label: 'Vật tư TP', icon: <Wrench size={16} /> }] : []),
    ...(isProdMgr ? [{ id: 'sku-list' as TabId, label: 'Danh sách SKU', icon: <Package size={16} /> }] : []),
    ...(canSeeWarehouses ? [{ id: 'materials' as TabId, label: 'Tổng hợp vật tư', icon: <Boxes size={16} /> }] : []),
    ...(canSeeWarehouses ? [{ id: 'warehouses' as TabId, label: 'Tổng hợp kho', icon: <Warehouse size={16} /> }] : []),
    ...(isSpecRole ? [{ id: 'setup' as TabId, label: 'Quản lý định mức', icon: <Settings size={16} /> }] : []),
  ]

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* ── Sidebar ────────────────────────────────────────────────────── */}
      <div style={{
        width: 210, flexShrink: 0, background: 'var(--surface)', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '16px 16px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            {onBack && (
              <button
                onClick={onBack}
                style={{ padding: 6, background: 'var(--surface2)', border: 'none', borderRadius: 'var(--radius)', display: 'flex', cursor: 'pointer' }}
                title="Trở về trang chủ"
              >
                <Grid size={16} color="var(--text)" />
              </button>
            )}
            <div style={{ fontWeight: 700, fontSize: 14 }}>
              {user?.mfgRole === 'SPEC_STEEL' || user?.mfgRole === 'SPEC_ACCESSORY' ? 'Quản lý định mức' : 'Sản xuất MES'}
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>
            {user?.mfgRole === 'SPEC_STEEL' ? 'Định mức mảnh'
              : user?.mfgRole === 'SPEC_ACCESSORY' ? 'Định mức chi tiết'
                : 'Đông Nam Á Corp'}
          </div>
        </div>

        <nav style={{ flex: 1, padding: '4px 8px' }}>
          {TABS.map(t => {
            const active = tab === t.id

            // Tab "Quản lý định mức" cho SPEC_* roles → sub-items từ config
            if (t.id === 'setup' && user?.mfgRole && SPEC_SETUP_ITEMS[user.mfgRole]) {
              const specItems = SPEC_SETUP_ITEMS[user.mfgRole]
              const isSetup = tab === 'setup'
              return (
                <div key={t.id}>
                  {specItems.map(s => {
                    const subActive = isSetup && setupSubTab === s.id
                    return (
                      <button key={s.id}
                        onClick={() => { setTab('setup'); setSetupSubTab(s.id) }}
                        style={navBtnStyle(subActive)}
                        onMouseEnter={e => { if (!subActive) e.currentTarget.style.background = 'var(--surface2)' }}
                        onMouseLeave={e => { if (!subActive) e.currentTarget.style.background = 'transparent' }}
                      >{SPEC_ICON[s.icon]}{s.label}</button>
                    )
                  })}
                </div>
              )
            }

            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={navBtnStyle(active)}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--surface2)' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
              >
                {t.icon}
                {t.label}
              </button>
            )
          })}
        </nav>

        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: '#fff3e0', color: '#e65100',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700,
            }}>
              {user?.name.split(' ').pop()?.substring(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{user?.name}</div>
              <div style={{ fontSize: 10, color: 'var(--text3)' }}>{roleLabel}</div>
            </div>
            <button onClick={logout} style={{ padding: 4, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex' }} title="Đăng xuất">
              <LogOut size={16} color="var(--text3)" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Main content ───────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
        {tab === 'lenh-sx' && (isDirector || isProdMgr) && <LenhSXPage />}
        {tab === 'ke-hoach' && (isProdMgr || isDirector) && <ThongKePagePlan />}
        {tab === 'phoi-xac-nhan-nhan-sat' && (isPhoi || isDirector) && <XacNhanNhanSatPage readOnly={isDirector} />}
        {tab === 'phoi-lenh-sx' && (isPhoi || isHan || isSon || isDirector) && (isHan ? <LenhSanXuatHan readOnly={isDirector} /> : isSon ? <LenhSanXuatSon readOnly={isDirector} /> : <LenhSanXuatPhoi readOnly={isDirector} onOpenCuttingGuide={openHuongDanCat} />)}
        {tab === 'phoi-huong-dan-cat' && (isPhoi || isDirector) && (
          <HuongDanCatPage initialPiId={huongDanCatPiId} onConsumeInitialPi={() => setHuongDanCatPiId(null)} />
        )}
        {tab === 'phoi-dinh-muc-manh' && (isPhoi || isHan || isSon || isDirector) && <PhoiDinhMucManhPage stage={isSon ? 'SON' : isHan ? 'HAN' : 'PHOI'} />}
        {tab === 'han-son-xac-nhan-vat-tu' && (isHan || isSon) && <XacNhanVatTuPage stage={isHan ? 'HAN' : 'SON'} />}
        {tab === 'phoi-kho-phoi' && (isPhoi || isDirector) && <KhoPhoiPage />}
        {tab === 'han-khung-han' && (isHan || isDirector) && <KhungHanPage />}
        {tab === 'son-manh-cho-dan' && (isSon || isDirector) && <ManhChoDanPage />}
        {tab === 'kcs-phoi' && isKcs && <KcsPhoiPage />}
        {tab === 'kcs-han' && isKcs && <KcsHanPage />}
        {tab === 'kcs-son' && isKcs && <KcsSonPage />}
        {tab === 'kcs-vat-tu-tp' && isKcs && <KcsVatTuThanhPhamPage />}
        {tab === 'weaving-points' && canManageBom && <WeavingPointsPage readOnly />}
        {tab === 'sku-list' && isProdMgr && <SKUListPage readOnly />}
        {tab === 'materials' && canSeeWarehouses && <MfgAllMaterialsPage />}
        {tab === 'warehouses' && canSeeWarehouses && <MfgWarehousesPage />}
        {tab === 'setup' && user?.mfgRole === 'SPEC_STEEL' && <SpecSteelPage subTab={setupSubTab as 'dinh-muc' | 'catalog'} onSubTabChange={setSetupSubTab} />}
        {tab === 'setup' && user?.mfgRole === 'SPEC_ACCESSORY' && <SpecDetailQuotaPage subTab={setupSubTab as 'dinh-muc' | 'catalog'} onSubTabChange={setSetupSubTab} />}
      </div>
    </div>
  )
}
