import { useState } from 'react'
import { ClipboardList, Settings, LogOut, Grid, Package, LayoutGrid, Boxes, Warehouse, FileText, MapPin, ArrowDownToLine, ClipboardCheck, Box, History, FilePlus, Users, CalendarClock, ChevronDown } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import PIListPage from '../ProductionPlan/PIListPage'
import MfgSetupPage from './MfgSetupPage'
import SpecSteelPage from './SpecSteelPage'
import SpecWirePaintPage from './SpecWirePaintPage'
import SpecAccessoryPage from './SpecAccessoryPage'
import SpecPackagingPage from './SpecPackagingPage'
import TongDonHangPage from './TongDonHangPage'
import TaoDonHangMoiPage from './TaoDonHangMoiPage'
import DanhSachKhachHangPage from './DanhSachKhachHangPage'
import MfgWorkshopBoardPage from './MfgWorkshopBoardPage'
import MfgWarehousesPage from './MfgWarehousesPage'
import MfgAllMaterialsPage from './MfgAllMaterialsPage'
import DeXuatMuaVatTuPage from './DeXuatMuaVatTuPage'
import DieuPhoiDanPage from './DieuPhoiDanPage'
import XuatDanPage from './XuatDanPage'
import LichSuXuatDanPage from './LichSuXuatDanPage'
import ChuyenKiemPage from './ChuyenKiemPage'
import DongGoiPage from './DongGoiPage'
import WeavingPointsPage from './WeavingPointsPage'
import LichSuNhapDanPage from './LichSuNhapDanPage'
import QuanLyDiemDanPage from './QuanLyDiemDanPage'
import ThongKePagePlan from './ThongKePagePlan'
import LenhSanXuatPhoi from './Phoi/LenhSanXuatPhoi'
import LenhSanXuatHan from './Han/LenhSanXuatHan'
import LenhSanXuatSon from './Son/LenhSanXuatSon'
import PhoiDinhMucManhPage from './PhoiDinhMucManhPage'
import SKUListPage from '../ProductionPlan/SKUListPage'

// ── Module-level constants (không tạo lại mỗi render) ───────────────────────

type TabId =
  | 'workshop' | 'tong-don-hang' | 'tao-don-hang' | 'danh-sach-khach-hang'
  | 'pi-list' | 'ke-hoach' | 'phoi-lenh-sx' | 'phoi-dinh-muc-manh'
  | 'xuat-dan' | 'lich-su-xuat-dan' | 'dieu-phoi-dan' | 'lich-su-nhap-dan' | 'quan-ly-diem-dan'
  | 'chuyen-kiem' | 'dong-goi' | 'weaving-points' | 'sku-list'
  | 'materials' | 'warehouses' | 'de-xuat' | 'setup'

type SetupSubTab = 'vat-tu' | 'dinh-muc' | 'catalog'

const WORKER_ROLES = ['PHOI', 'HAN', 'SON', 'QC', 'WEAVING_MANAGER', 'WEAVING_EXPORT'] as const

const SPEC_ROLES = ['SPEC_STEEL', 'SPEC_WIRE_PAINT', 'SPEC_ACCESSORY', 'SPEC_PACKAGING'] as const

const MFG_ROLE_LABELS: Record<string, string> = {
  PRODUCTION_MANAGER: 'Quản lý SX',
  FACTORY_SALES:      'Sales nhà máy',
  PHOI:               'Thống kê Cơ khí',
  HAN:                'Bộ phận Hàn',
  SON:                'Bộ phận Sơn',
  QC:                 'Kiểm tra QC',
  WEAVING_MANAGER:    'Quản lý nhập đan',
  WEAVING_EXPORT:     'Quản lý xuất đan',
  BOM_MANAGER:        'NV Định mức',
  SPEC_STEEL:         'NV Định mức - Sắt',
  SPEC_WIRE_PAINT:    'NV Định mức - Dây/Sơn',
  SPEC_ACCESSORY:     'NV Định mức - Phụ kiện',
  SPEC_PACKAGING:     'NV Định mức - Bao bì',
}

const WORKSHOP_STAGES = [
  { value: 'PHOI',        label: 'Phôi' },
  { value: 'HAN',         label: 'Hàn' },
  { value: 'SON',         label: 'Sơn' },
  { value: 'WEAVING',     label: 'Đan' },
  { value: 'CHUYEN_KIEM', label: 'Chuyền kiểm' },
  { value: 'DONG_GOI',    label: 'Đóng gói' },
]

const SPEC_SETUP_ITEMS: Record<string, { id: SetupSubTab; label: string; icon: 'clipboard' | 'grid' | 'box' }[]> = {
  SPEC_STEEL: [
    { id: 'vat-tu',   label: 'Định mức mới',     icon: 'clipboard' },
    { id: 'dinh-muc', label: 'Định mức mảnh',    icon: 'grid'      },
    { id: 'catalog',  label: 'Danh sách vật tư',  icon: 'box'       },
  ],
  SPEC_WIRE_PAINT: [
    { id: 'dinh-muc', label: 'Định mức mới',     icon: 'clipboard' },
    { id: 'catalog',  label: 'Danh sách vật tư',  icon: 'box'       },
  ],
  SPEC_ACCESSORY: [
    { id: 'dinh-muc', label: 'Định mức mới',     icon: 'clipboard' },
    { id: 'catalog',  label: 'Danh sách vật tư',  icon: 'box'       },
  ],
  SPEC_PACKAGING: [
    { id: 'dinh-muc', label: 'Định mức mới',     icon: 'clipboard' },
    { id: 'catalog',  label: 'Danh sách vật tư',  icon: 'box'       },
  ],
}

const SPEC_ICON = {
  clipboard: <ClipboardCheck size={16} />,
  grid:      <Grid size={16} />,
  box:       <Box size={16} />,
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

  const isFactorySales  = user?.mfgRole === 'FACTORY_SALES'
  const canManageBom    = user?.mfgRole === 'PRODUCTION_MANAGER' || user?.role === 'MANAGER'
  // Tổng giám đốc = MANAGER không gắn mfgRole. Thủ kho = WAREHOUSE_STAFF không mfgRole.
  const isDirector      = user?.role === 'MANAGER' && !user?.mfgRole
  const isWarehouse     = user?.role === 'WAREHOUSE_STAFF' && !user?.mfgRole
  const isProdMgr       = user?.mfgRole === 'PRODUCTION_MANAGER'
  const isPhoi          = user?.mfgRole === 'PHOI'
  const isHan           = user?.mfgRole === 'HAN'
  const isSon           = user?.mfgRole === 'SON'
  const isWeavingMgr    = user?.mfgRole === 'WEAVING_MANAGER'
  const isWeavingExport = user?.mfgRole === 'WEAVING_EXPORT'
  const isBomManager    = user?.mfgRole === 'BOM_MANAGER'
  const isSpecRole      = !!user?.mfgRole && SPEC_ROLES.includes(user.mfgRole as typeof SPEC_ROLES[number])
  const canSeeBom       = isDirector || isBomManager || isSpecRole
  const canSeeWarehouses = isDirector || isWarehouse || isProdMgr
  const canSeeDieuPhoi  = isWeavingMgr
  const canSeeDiemDan   = isWeavingMgr || isWeavingExport
  const canSeePackingFlow = canManageBom
  const canManageWorkshop = canManageBom

  // Readable if-else chain thay cho ternary lồng 6 cấp
  let initialTab: TabId = 'pi-list'
  if (canManageWorkshop)        initialTab = 'workshop'
  else if (isFactorySales)      initialTab = 'tong-don-hang'
  else if (isWeavingMgr)        initialTab = 'dieu-phoi-dan'
  else if (isWeavingExport)     initialTab = 'xuat-dan'
  else if (isPhoi || isHan || isSon) initialTab = 'phoi-lenh-sx'
  else if (isBomManager || isSpecRole) initialTab = 'setup'

  const [tab, setTab] = useState<TabId>(initialTab)
  const [workshopStage, setWorkshopStage] = useState('ALL')
  const [workshopExpanded, setWorkshopExpanded] = useState(true)
  // Một state duy nhất cho tất cả SPEC role sub-tabs — mặc định = mục đầu tiên của role
  const [setupSubTab, setSetupSubTab] = useState<SetupSubTab>(
    () => (user?.mfgRole && SPEC_SETUP_ITEMS[user.mfgRole]?.[0]?.id) || 'dinh-muc'
  )

  const roleLabel = user?.mfgRole
    ? (MFG_ROLE_LABELS[user.mfgRole] ?? user.mfgRole)
    : user?.role === 'MANAGER' ? 'Giám đốc (xem)' : isWarehouse ? 'Thủ kho' : ''

  const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
    ...(canManageWorkshop ? [{ id: 'workshop' as TabId, label: 'Tổng hợp lệnh SX', icon: <LayoutGrid size={16}/> }] : []),
    ...(isFactorySales ? [{ id: 'tong-don-hang' as TabId, label: 'Tổng đơn hàng', icon: <Package size={16}/> }] : []),
    ...(isFactorySales ? [{ id: 'tao-don-hang' as TabId, label: 'Tạo đơn hàng mới', icon: <FilePlus size={16}/> }] : []),
    ...(isFactorySales ? [{ id: 'danh-sach-khach-hang' as TabId, label: 'Danh sách khách hàng', icon: <Users size={16}/> }] : []),
    ...(isDirector ? [{ id: 'pi-list' as TabId, label: 'Lệnh sản xuất mới', icon: <ClipboardList size={16}/> }] : []),
    ...(isDirector ? [{ id: 'ke-hoach' as TabId, label: 'Kế hoạch SX', icon: <CalendarClock size={16}/> }] : []),
    ...((isPhoi || isHan || isSon) ? [{ id: 'phoi-lenh-sx' as TabId, label: 'Lệnh sản xuất', icon: <ClipboardCheck size={16}/> }] : []),
    ...((isPhoi || isHan || isSon) ? [{ id: 'phoi-dinh-muc-manh' as TabId, label: 'Danh sách định mức mảnh', icon: <Box size={16}/> }] : []),
    ...(isWeavingExport ? [{ id: 'xuat-dan' as TabId, label: 'Xuất đan', icon: <ArrowDownToLine size={16}/> }] : []),
    ...(isWeavingExport ? [{ id: 'lich-su-xuat-dan' as TabId, label: 'Lịch sử xuất đan', icon: <History size={16}/> }] : []),
    ...(canSeeDieuPhoi ? [{ id: 'dieu-phoi-dan' as TabId, label: 'Điều phối đan', icon: <ArrowDownToLine size={16}/> }] : []),
    ...(isWeavingMgr ? [{ id: 'lich-su-nhap-dan' as TabId, label: 'Lịch sử nhập đan', icon: <History size={16}/> }] : []),
    ...(canSeeDiemDan ? [{ id: 'quan-ly-diem-dan' as TabId, label: 'Quản lý điểm đan', icon: <MapPin size={16}/> }] : []),
    ...(isProdMgr ? [{ id: 'sku-list' as TabId, label: 'Danh sách SKU', icon: <Package size={16}/> }] : []),
    ...(canSeeWarehouses ? [{ id: 'materials' as TabId, label: 'Tổng hợp vật tư', icon: <Boxes size={16}/> }] : []),
    ...(canSeeWarehouses ? [{ id: 'warehouses' as TabId, label: 'Tổng hợp kho', icon: <Warehouse size={16}/> }] : []),
    ...(isDirector ? [{ id: 'de-xuat' as TabId, label: 'Duyệt đề xuất', icon: <FileText size={16}/> }] : []),
    ...(canSeeBom ? [{ id: 'setup' as TabId, label: 'Quản lý định mức', icon: <Settings size={16}/> }] : []),
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
              {user?.mfgRole === 'SPEC_STEEL' || user?.mfgRole === 'SPEC_WIRE_PAINT' ? 'Quản lý định mức' : 'Sản xuất MES'}
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>
            {user?.mfgRole === 'SPEC_STEEL' ? 'Định mức sắt'
              : user?.mfgRole === 'SPEC_WIRE_PAINT' ? 'Định mức dây & sơn'
              : 'Đông Nam Á Corp'}
          </div>
        </div>

        <nav style={{ flex: 1, padding: '4px 8px' }}>
          {TABS.map(t => {
            const active = tab === t.id

            // Tab "Tổng hợp lệnh SX" → sub-items lọc theo công đoạn khi active
            if (t.id === 'workshop') {
              return (
                <div key={t.id} style={{ marginBottom: 2 }}>
                  <div
                    style={{ display: 'flex', alignItems: 'center', borderRadius: 'var(--radius)', background: active ? '#fff3e0' : 'transparent', transition: 'background .1s' }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--surface2)' }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
                  >
                    <button
                      onClick={() => { setTab('workshop'); setWorkshopStage('ALL'); setWorkshopExpanded(v => !v) }}
                      style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 9, padding: '8px 4px 8px 10px', border: 'none', background: 'transparent', cursor: 'pointer', color: active ? '#e65100' : 'var(--text2)', fontWeight: active ? 600 : 400, fontSize: 13, textAlign: 'left' }}
                    >{t.icon}{t.label}</button>
                    <button
                      onClick={e => { e.stopPropagation(); setWorkshopExpanded(v => !v) }}
                      title={workshopExpanded ? 'Thu gọn' : 'Mở rộng'}
                      style={{ flexShrink: 0, padding: '8px 8px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', color: active ? '#e65100' : 'var(--text3)' }}
                    >
                      <ChevronDown size={13} style={{ opacity: .65, transform: workshopExpanded ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform .2s' }} />
                    </button>
                  </div>

                  {workshopExpanded && (
                    <div style={{ margin: '3px 0 4px 18px', paddingLeft: 10, borderLeft: '2px solid #f5c89a' }}>
                      {WORKSHOP_STAGES.map(s => {
                        const subActive = tab === 'workshop' && workshopStage === s.value
                        return (
                          <button key={s.value}
                            onClick={() => { setTab('workshop'); setWorkshopStage(s.value) }}
                            style={{ display: 'flex', alignItems: 'center', gap: 7, width: '100%', padding: '5px 8px', marginBottom: 1, border: 'none', borderRadius: 'var(--radius)', background: subActive ? '#fff3e0' : 'transparent', color: subActive ? '#e65100' : 'var(--text2)', fontWeight: subActive ? 600 : 400, fontSize: 12, textAlign: 'left', cursor: 'pointer' }}
                            onMouseEnter={e => { if (!subActive) e.currentTarget.style.background = 'var(--surface2)' }}
                            onMouseLeave={e => { if (!subActive) e.currentTarget.style.background = 'transparent' }}
                          >
                            <span style={{ width: 5, height: 5, borderRadius: '50%', flexShrink: 0, background: subActive ? '#e65100' : '#d1d5db', transition: 'background .15s' }} />
                            {s.label}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            }

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
        {tab === 'workshop'              && canManageWorkshop  && <MfgWorkshopBoardPage stageFilter={workshopStage} />}
        {tab === 'tong-don-hang'         && isFactorySales     && <TongDonHangPage onCreateNew={() => setTab('tao-don-hang')} />}
        {tab === 'tao-don-hang'          && isFactorySales     && <TaoDonHangMoiPage onCreated={() => setTab('tong-don-hang')} />}
        {tab === 'danh-sach-khach-hang'  && isFactorySales     && <DanhSachKhachHangPage />}
        {tab === 'pi-list'               && isDirector         && <PIListPage />}
        {tab === 'ke-hoach'              && (isProdMgr || isDirector) && <ThongKePagePlan />}
        {tab === 'phoi-lenh-sx'          && (isPhoi || isHan || isSon || isDirector) && (isHan ? <LenhSanXuatHan readOnly={isDirector} /> : isSon ? <LenhSanXuatSon readOnly={isDirector} /> : <LenhSanXuatPhoi readOnly={isDirector} />)}
        {tab === 'phoi-dinh-muc-manh'    && (isPhoi || isHan || isSon || isDirector) && <PhoiDinhMucManhPage stage={isSon ? 'SON' : isHan ? 'HAN' : 'PHOI'} />}
        {tab === 'xuat-dan'              && (isWeavingExport || isDirector) && <XuatDanPage readOnly={isDirector} />}
        {tab === 'lich-su-xuat-dan'      && (isWeavingExport || isDirector) && <LichSuXuatDanPage />}
        {tab === 'dieu-phoi-dan'         && canSeeDieuPhoi     && <DieuPhoiDanPage readOnly={isDirector} />}
        {tab === 'lich-su-nhap-dan'      && canSeeDieuPhoi     && <LichSuNhapDanPage />}
        {tab === 'quan-ly-diem-dan'      && canSeeDiemDan      && <QuanLyDiemDanPage readOnly={!isWeavingExport} />}
        {tab === 'chuyen-kiem'           && canSeePackingFlow  && <ChuyenKiemPage readOnly={isDirector} />}
        {tab === 'dong-goi'              && canSeePackingFlow  && <DongGoiPage readOnly={isDirector} />}
        {tab === 'weaving-points'        && canManageBom       && <WeavingPointsPage readOnly />}
        {tab === 'sku-list'              && isProdMgr          && <SKUListPage readOnly />}
        {tab === 'materials'             && canSeeWarehouses   && <MfgAllMaterialsPage />}
        {tab === 'warehouses'            && canSeeWarehouses   && <MfgWarehousesPage />}
        {tab === 'de-xuat'               && isDirector         && <DeXuatMuaVatTuPage />}
        {tab === 'setup' && (isDirector || isBomManager)            && <MfgSetupPage />}
        {tab === 'setup' && user?.mfgRole === 'SPEC_STEEL'          && <SpecSteelPage subTab={setupSubTab} onSubTabChange={setSetupSubTab} />}
        {tab === 'setup' && user?.mfgRole === 'SPEC_WIRE_PAINT'     && <SpecWirePaintPage subTab={setupSubTab as 'dinh-muc' | 'catalog'} onSubTabChange={setSetupSubTab} />}
        {tab === 'setup' && user?.mfgRole === 'SPEC_ACCESSORY'      && <SpecAccessoryPage subTab={setupSubTab as 'dinh-muc' | 'catalog'} onSubTabChange={setSetupSubTab} />}
        {tab === 'setup' && user?.mfgRole === 'SPEC_PACKAGING'      && <SpecPackagingPage subTab={setupSubTab as 'dinh-muc' | 'catalog'} onSubTabChange={setSetupSubTab} />}
      </div>
    </div>
  )
}
