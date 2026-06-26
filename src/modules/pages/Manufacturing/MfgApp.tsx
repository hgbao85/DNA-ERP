import { useState } from 'react'
import { ClipboardList, Settings, LogOut, Grid, Package, LayoutGrid, Boxes, Warehouse, FileText, PackageCheck, MapPin, ArrowDownToLine, ClipboardCheck, Box, PackagePlus, History, FilePlus, Users, CalendarClock } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import PIListPage from './PIListPage'
import MfgStageBoardPage from './MfgStageBoardPage'
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
import ChuyenKiemPage from './ChuyenKiemPage'
import DongGoiPage from './DongGoiPage'
import WeavingPointsPage from './WeavingPointsPage'
import LichSuNhapDanPage from './LichSuNhapDanPage'
import QuanLyDiemDanPage from './QuanLyDiemDanPage'
import ThongKePage from '../Manufacturing/ThongKePage'

interface MfgAppProps {
  onBack?: () => void // chỉ truyền cho giám đốc (có nhiều phân hệ); prodmgr/thợ bị khóa trong MES
}

export default function MfgApp({ onBack }: MfgAppProps) {
  const { user, logout } = useAuth()

  const workerRoles     = ['PHOI', 'HAN', 'SON', 'QC', 'WEAVING_MANAGER']
  const isOtherWorker   = !!user?.mfgRole && workerRoles.includes(user.mfgRole)
  const isFactorySales  = user?.mfgRole === 'FACTORY_SALES'
  const canManageBom    = user?.mfgRole === 'PRODUCTION_MANAGER' || user?.role === 'MANAGER'
  // Tổng giám đốc = MANAGER không gắn mfgRole. Thủ kho = WAREHOUSE_STAFF không mfgRole.
  // Màn "Tổng hợp vật tư/kho" cho TGĐ, Thủ kho và Quản lý SX (PRODUCTION_MANAGER).
  const isDirector      = user?.role === 'MANAGER' && !user?.mfgRole
  const isWarehouse     = user?.role === 'WAREHOUSE_STAFF' && !user?.mfgRole
  const isProdMgr       = user?.mfgRole === 'PRODUCTION_MANAGER'
  const isPhoi          = user?.mfgRole === 'PHOI'
  const isWeavingMgr    = user?.mfgRole === 'WEAVING_MANAGER' // bạn điều phối đan (thu về + chia kho)
  const isBomManager    = user?.mfgRole === 'BOM_MANAGER'     // NV Định mức: CRUD định mức (PM chỉ xem)
  const isSpecSteel     = user?.mfgRole === 'SPEC_STEEL'
  const canEditBom      = isBomManager
  const SPEC_ROLES = ['SPEC_STEEL', 'SPEC_WIRE_PAINT', 'SPEC_ACCESSORY', 'SPEC_PACKAGING']
  const canSeeBom       = canManageBom || isBomManager || (user?.mfgRole ? SPEC_ROLES.includes(user.mfgRole) : false)        // PM/Giám đốc XEM, BOM_MANAGER SỬA, SPEC_* thao tác
  const canSeeWarehouses = isDirector || isWarehouse || isProdMgr
  // Thành phẩm khung sơn = XUẤT/cấp đan đi: Thống kê Phôi + Quản lý SX (KHÔNG hiện với Giám đốc).
  const canSeeKhungSon  = isPhoi
  // Điều phối đan = THU mảnh về + chia kho: Đan Trưởng + Quản lý SX (KHÔNG hiện với Giám đốc).
  // Giám đốc vẫn xem tiến độ đan qua tab "Điều hành xưởng" (cột Đan).
  const canSeeDieuPhoi  = isWeavingMgr || isProdMgr
  // Chuyền kiểm + Đóng gói trong MES = Giám đốc + Quản lý SX (kho thành phẩm/bao bì xem ở "Kho đầu vào").
  const canSeePackingFlow = canManageBom

  // ── Tabs theo role ───────────────────────────────────────────────────
  type TabId = 'workshop' | 'tong-don-hang' | 'tao-don-hang' | 'danh-sach-khach-hang' | 'pi-list' | 'ke-hoach' | 'khung-son' | 'quan-ly-nhap-manh' | 'dieu-phoi-dan' | 'lich-su-nhap-dan' | 'quan-ly-diem-dan' | 'chuyen-kiem' | 'dong-goi' | 'weaving-points' | 'materials' | 'warehouses' | 'de-xuat' | 'setup'

  const canManageWorkshop = canManageBom // PRODUCTION_MANAGER hoặc MANAGER (giám đốc xem)

  const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
    ...(canManageWorkshop ? [{ id: 'workshop' as TabId, label: 'Tổng hợp lệnh sản xuất', icon: <LayoutGrid size={16}/> }] : []),
    // Sales: chỉ thấy Tổng đơn hàng + Tạo đơn hàng mới (KHÔNG còn Lệnh SX). QLSX/Giám đốc/thợ giữ Lệnh SX.
    ...(isFactorySales ? [{ id: 'tong-don-hang' as TabId, label: 'Tổng đơn hàng', icon: <Package size={16}/> }] : []),
    ...(isFactorySales ? [{ id: 'tao-don-hang' as TabId, label: 'Tạo đơn hàng mới', icon: <FilePlus size={16}/> }] : []),
    ...(isFactorySales ? [{ id: 'danh-sach-khach-hang' as TabId, label: 'Danh sách khách hàng', icon: <Users size={16}/> }] : []),
    ...(isProdMgr || isDirector ? [{ id: 'pi-list' as TabId, label: 'Lệnh sản xuất mới', icon: <ClipboardList size={16}/> }] : []),
    ...(isDirector ? [{ id: 'ke-hoach' as TabId, label: 'Kế hoạch SX', icon: <CalendarClock size={16}/> }] : []),
    // Thành phẩm khung sơn (xuất/cấp đan đi — Phôi) + Điều phối đan (thu về/chia kho — Đan Trưởng)
    ...(canSeeKhungSon ? [{ id: 'khung-son' as TabId, label: 'Thành phẩm khung sơn', icon: <PackageCheck size={16}/> }] : []),
    // Khu Đan (Đan Trưởng + Quản lý SX; Giám đốc xem): Quản lý nhập mảnh · Điều phối đan · Lịch sử nhập đan · Quản lý điểm đan
    ...(isWeavingMgr ? [{ id: 'quan-ly-nhap-manh' as TabId, label: 'Quản lý nhập mảnh', icon: <PackagePlus size={16}/> }] : []),
    ...(canSeeDieuPhoi ? [{ id: 'dieu-phoi-dan' as TabId, label: 'Điều phối đan', icon: <ArrowDownToLine size={16}/> }] : []),
    ...(isWeavingMgr ? [{ id: 'lich-su-nhap-dan' as TabId, label: 'Lịch sử nhập đan', icon: <History size={16}/> }] : []),
    // "Quản lý điểm đan" chỉ Đan Trưởng (PM xem điểm đan trong "Điều hành xưởng", không thao tác).
    ...(isWeavingMgr ? [{ id: 'quan-ly-diem-dan' as TabId, label: 'Quản lý điểm đan', icon: <MapPin size={16}/> }] : []),
    // Chuyền kiểm / Đóng gói / Điểm đan: ĐÃ chuyển vào trong "Điều hành xưởng" (sub-tab) — không còn tab phẳng.
    ...(canSeeWarehouses ? [{ id: 'materials' as TabId, label: 'Tổng hợp vật tư/SKU', icon: <Boxes size={16}/> }] : []),
    ...(canSeeWarehouses ? [{ id: 'warehouses' as TabId, label: 'Tổng hợp kho', icon: <Warehouse size={16}/> }] : []),
    // Giám đốc: duyệt đề xuất mua vật tư của thủ kho (cùng màn DeXuatMuaVatTuPage, role-aware)
    // Lưu ý: Nhập/Xuất kho + tạo đề xuất của Thủ kho ĐÃ chuyển sang phân hệ "Kho đầu vào".
    ...(isDirector ? [{ id: 'de-xuat' as TabId, label: 'Duyệt đề xuất', icon: <FileText size={16}/> }] : []),
    // Quản lý định mức: PM/Giám đốc XEM; NV Định mức (BOM_MANAGER) SỬA.
    ...(canSeeBom ? [{ id: 'setup' as TabId, label: 'Quản lý định mức', icon: <Settings size={16}/> }] : []),
  ]

  const isSpecRole = user?.mfgRole ? ['SPEC_STEEL','SPEC_WIRE_PAINT','SPEC_ACCESSORY','SPEC_PACKAGING'].includes(user.mfgRole) : false
  const initialTab: TabId = canManageWorkshop ? 'workshop' : isFactorySales ? 'tong-don-hang' : isWeavingMgr ? 'dieu-phoi-dan' : isBomManager ? 'setup' : isSpecRole ? 'setup' : 'pi-list'
  const [tab, setTab] = useState<TabId>(initialTab)

  const [steelSubTab, setSteelSubTab] = useState<'vat-tu' | 'dinh-muc' | 'catalog'>('vat-tu')
  const [wirePaintSubTab, setWirePaintSubTab] = useState<'dinh-muc' | 'catalog'>('dinh-muc')
  const [accessorySubTab, setAccessorySubTab] = useState<'dinh-muc' | 'catalog'>('dinh-muc')
  const [packagingSubTab, setPackagingSubTab] = useState<'dinh-muc' | 'catalog'>('dinh-muc')

  // ── Role label ───────────────────────────────────────────────────────
  const mfgRoleLabel: Record<string, string> = {
    PRODUCTION_MANAGER: 'Quản lý SX',
    FACTORY_SALES:      'Sales nhà máy',
    PHOI:               'Thống kê Cơ khí',
    HAN:                'Bộ phận Hàn',
    SON:                'Bộ phận Sơn',
    QC:                 'Kiểm tra QC',
    WEAVING_MANAGER:    'Quản lý Đan',
    BOM_MANAGER:        'NV Định mức',
    SPEC_STEEL:         'NV Định mức - Sắt',
    SPEC_WIRE_PAINT:    'NV Định mức - Dây/Sơn',
    SPEC_ACCESSORY:     'NV Định mức - Phụ kiện',
    SPEC_PACKAGING:     'NV Định mức - Bao bì',
  }
  const roleLabel = user?.mfgRole
    ? (mfgRoleLabel[user.mfgRole] ?? user.mfgRole)
    : user?.role === 'MANAGER' ? 'Giám đốc (xem)' : isWarehouse ? 'Thủ kho' : ''

  // Style nút sidebar (mục chính / menu con)
  const navBtn = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 9, width: '100%',
    padding: '8px 10px', marginBottom: 2, border: 'none', borderRadius: 'var(--radius)',
    background: active ? '#fff3e0' : 'transparent',
    color: active ? '#e65100' : 'var(--text2)',
    fontWeight: active ? 600 : 400,
    fontSize: 13, textAlign: 'left', cursor: 'pointer', transition: 'background .1s',
  })

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
            // Quản lý định mức SPEC_STEEL → 3 sub-items trong sidebar
            if (t.id === 'setup' && user?.mfgRole === 'SPEC_STEEL') {
              const isSetup = tab === 'setup'
              const steelItems = [
                { id: 'vat-tu'   as const, label: 'Định mức chi tiết', icon: <ClipboardCheck size={16}/> },
                { id: 'dinh-muc' as const, label: 'Định mức mảnh',     icon: <Grid size={16}/>           },
                { id: 'catalog'  as const, label: 'Danh sách vật tư',  icon: <Box size={16}/>            },
              ]
              return (
                <div key={t.id}>
                  {steelItems.map(s => {
                    const subActive = isSetup && steelSubTab === s.id
                    return (
                      <button key={s.id}
                        onClick={() => { setTab('setup'); setSteelSubTab(s.id) }}
                        style={navBtn(subActive)}
                        onMouseEnter={e => { if (!subActive) e.currentTarget.style.background = 'var(--surface2)' }}
                        onMouseLeave={e => { if (!subActive) e.currentTarget.style.background = 'transparent' }}
                      >{s.icon}{s.label}</button>
                    )
                  })}
                </div>
              )
            }

            if (t.id === 'setup' && user?.mfgRole === 'SPEC_WIRE_PAINT') {
              const isSetup = tab === 'setup'
              const items = [
                { id: 'dinh-muc' as const, label: 'Định mức chi tiết', icon: <ClipboardCheck size={16}/> },
                { id: 'catalog'  as const, label: 'Danh sách vật tư',  icon: <Box size={16}/>            },
              ]
              return (
                <div key={t.id}>
                  {items.map(s => {
                    const subActive = isSetup && wirePaintSubTab === s.id
                    return (
                      <button key={s.id}
                        onClick={() => { setTab('setup'); setWirePaintSubTab(s.id) }}
                        style={navBtn(subActive)}
                        onMouseEnter={e => { if (!subActive) e.currentTarget.style.background = 'var(--surface2)' }}
                        onMouseLeave={e => { if (!subActive) e.currentTarget.style.background = 'transparent' }}
                      >{s.icon}{s.label}</button>
                    )
                  })}
                </div>
              )
            }

            if (t.id === 'setup' && user?.mfgRole === 'SPEC_ACCESSORY') {
              const isSetup = tab === 'setup'
              const items = [
                { id: 'dinh-muc' as const, label: 'Định mức chi tiết', icon: <ClipboardCheck size={16}/> },
                { id: 'catalog'  as const, label: 'Danh sách vật tư',  icon: <Box size={16}/>            },
              ]
              return (
                <div key={t.id}>
                  {items.map(s => {
                    const subActive = isSetup && accessorySubTab === s.id
                    return (
                      <button key={s.id}
                        onClick={() => { setTab('setup'); setAccessorySubTab(s.id) }}
                        style={navBtn(subActive)}
                        onMouseEnter={e => { if (!subActive) e.currentTarget.style.background = 'var(--surface2)' }}
                        onMouseLeave={e => { if (!subActive) e.currentTarget.style.background = 'transparent' }}
                      >{s.icon}{s.label}</button>
                    )
                  })}
                </div>
              )
            }

            if (t.id === 'setup' && user?.mfgRole === 'SPEC_PACKAGING') {
              const isSetup = tab === 'setup'
              const items = [
                { id: 'dinh-muc' as const, label: 'Định mức chi tiết', icon: <ClipboardCheck size={16}/> },
                { id: 'catalog'  as const, label: 'Danh sách vật tư',  icon: <Box size={16}/>            },
              ]
              return (
                <div key={t.id}>
                  {items.map(s => {
                    const subActive = isSetup && packagingSubTab === s.id
                    return (
                      <button key={s.id}
                        onClick={() => { setTab('setup'); setPackagingSubTab(s.id) }}
                        style={navBtn(subActive)}
                        onMouseEnter={e => { if (!subActive) e.currentTarget.style.background = 'var(--surface2)' }}
                        onMouseLeave={e => { if (!subActive) e.currentTarget.style.background = 'transparent' }}
                      >{s.icon}{s.label}</button>
                    )
                  })}
                </div>
              )
            }

            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={navBtn(active)}
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
        {tab === 'workshop' && canManageWorkshop && <MfgWorkshopBoardPage />}
        {tab === 'tong-don-hang' && isFactorySales && <TongDonHangPage onCreateNew={() => setTab('tao-don-hang')} />}
        {tab === 'tao-don-hang'  && isFactorySales && <TaoDonHangMoiPage onCreated={() => setTab('tong-don-hang')} />}
        {tab === 'danh-sach-khach-hang' && isFactorySales && <DanhSachKhachHangPage />}
        {tab === 'pi-list' && (isProdMgr || isDirector) && <PIListPage />}
        {tab === 'ke-hoach' && (isProdMgr || isDirector) && <ThongKePage />}
        {tab === 'dieu-phoi-dan' && canSeeDieuPhoi && <DieuPhoiDanPage readOnly={isDirector || isProdMgr} />}
        {tab === 'lich-su-nhap-dan' && canSeeDieuPhoi && <LichSuNhapDanPage />}
        {tab === 'quan-ly-diem-dan' && canSeeDieuPhoi && <QuanLyDiemDanPage readOnly={isDirector} />}
        {tab === 'chuyen-kiem' && canSeePackingFlow && <ChuyenKiemPage readOnly={isDirector} />}
        {tab === 'dong-goi' && canSeePackingFlow && <DongGoiPage readOnly={isDirector} />}
        {/* "Điểm đan" bên Quản lý SX: CHỈ XEM — thêm/sửa làm ở "Quản lý điểm đan" (khu Đan) */}
        {tab === 'weaving-points' && canManageBom && <WeavingPointsPage readOnly />}
        {tab === 'materials' && canSeeWarehouses && <MfgAllMaterialsPage />}
        {tab === 'warehouses' && canSeeWarehouses && <MfgWarehousesPage />}
        {tab === 'de-xuat' && isDirector && <DeXuatMuaVatTuPage />}
        {tab === 'setup'   && (canManageBom || isBomManager) && <MfgSetupPage />}
        {tab === 'setup'   && user?.mfgRole === 'SPEC_STEEL' && <SpecSteelPage subTab={steelSubTab} onSubTabChange={setSteelSubTab} />}
        {tab === 'setup'   && user?.mfgRole === 'SPEC_WIRE_PAINT' && <SpecWirePaintPage subTab={wirePaintSubTab} onSubTabChange={setWirePaintSubTab} />}
        {tab === 'setup'   && user?.mfgRole === 'SPEC_ACCESSORY' && <SpecAccessoryPage subTab={accessorySubTab} onSubTabChange={setAccessorySubTab} />}
        {tab === 'setup'   && user?.mfgRole === 'SPEC_PACKAGING' && <SpecPackagingPage subTab={packagingSubTab} onSubTabChange={setPackagingSubTab} />}
      </div>
    </div>
  )
}
