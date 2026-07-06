import { useState } from 'react'
import { LogOut, Grid, Boxes, Warehouse, ArrowDownToLine, ArrowUpFromLine, FileText, ClipboardCheck, Box, ShoppingCart, ScanSearch, BarChart3, MapPin } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
// Tái dùng nguyên các màn kho đã có (trước đây nằm trong MES) — KHÔNG viết lại logic.
import MfgWarehousesPage from '../Manufacturing/MfgWarehousesPage'
import MfgAllMaterialsPage from '../Manufacturing/MfgAllMaterialsPage'
import NhapKhoPage from '../Manufacturing/NhapKhoPage'
import XuatKhoPage from '../Manufacturing/XuatKhoPage'
import DeXuatMuaVatTuPage from '../Manufacturing/DeXuatMuaVatTuPage'
import KhoChuyenKiemPage from './KhoChuyenKiemPage'
import KhoDongGoiPage from './KhoDongGoiPage'
import LenhMuaKhoPage from './LenhMuaKhoPage'
import KiemTraVatTuPage from './KiemTraVatTuPage'
import WarehouseNhapPage from './WarehouseNhapPage'
import WarehouseXuatPage from './WarehouseXuatPage'
import KhoXuatDanPage from './KhoXuatDanPage'
import KhoNhapDanPage from './KhoNhapDanPage'
import QuanLyDiemDanPage from '../Manufacturing/QuanLyDiemDanPage'

interface InboundWarehouseAppProps {
  onBack?: () => void // chỉ truyền nếu user có nhiều phân hệ; thủ kho thuần → khóa trong card này
}

// Phân hệ "Kho đầu vào" — gom toàn bộ thao tác kho của Thủ kho (WAREHOUSE_STAFF không mfgRole).
// Theme tím #4527A0 khớp màu card trong ModuleSelector.
const ACCENT = '#4527A0'
const ACCENT_BG = '#EDE7F6'

export default function InboundWarehouseApp({ onBack }: InboundWarehouseAppProps) {
  const { user, logout } = useAuth()

  // Tài khoản kho bị giới hạn vào 1 nhóm kho (warehouseScope). null = tổng kho / Giám đốc → thấy hết.
  const scope = user?.warehouseScope ?? null

  // Chuyền kiểm + Đóng gói: kho thành phẩm + kho bao bì đóng gói + tổng kho (scope null). GĐ cũng thấy.
  const canSeePacking = scope === null || scope === 'thanh-pham' || scope === 'bao-bi' || scope === 'vat-tu-tp' || scope === 'phoi-son-han'

  type TabId = 'materials' | 'warehouses' | 'kiem-tra' | 'nhap-kho' | 'xuat-kho' | 'de-xuat' | 'lenh-mua' | 'chuyen-kiem' | 'dong-goi' | 'xuat-dan' | 'nhap-dan' | 'diem-dan'
  const ALL_TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'materials',  label: 'Tổng hợp vật tư',    icon: <Boxes size={16} /> },
    { id: 'warehouses', label: 'Tổng hợp kho',        icon: <Warehouse size={16} /> },
    { id: 'kiem-tra',   label: 'Kiểm tra vật tư',     icon: <ScanSearch size={16} /> },
    { id: 'nhap-kho',   label: 'Nhập kho',            icon: <ArrowDownToLine size={16} /> },
    { id: 'xuat-kho',   label: 'Xuất kho',            icon: <ArrowUpFromLine size={16} /> },
    { id: 'de-xuat',    label: 'Đề xuất mua vật tư',  icon: <FileText size={16} /> },
    { id: 'lenh-mua',   label: 'Lệnh mua KHSX',       icon: <ShoppingCart size={16} /> },
    ...(canSeePacking ? [
      { id: 'chuyen-kiem' as TabId, label: 'Chuyền kiểm', icon: <ClipboardCheck size={16} /> },
      { id: 'dong-goi'    as TabId, label: 'Đóng gói',    icon: <Box size={16} /> },
    ] : []),
    { id: 'xuat-dan' as TabId, label: 'Theo dõi xuất đan',  icon: <BarChart3 size={16} /> },
    { id: 'nhap-dan' as TabId, label: 'Theo dõi nhập đan',  icon: <ArrowDownToLine size={16} /> },
    { id: 'diem-dan' as TabId, label: 'Quản lý điểm đan',   icon: <MapPin size={16} /> },
  ]

  // bao-bi-tp: 6 tab cố định (tổng hợp vật tư, kiểm tra, nhập/xuất, chuyền kiểm, đóng gói)
  // Scoped khác: ẩn materials + kiem-tra. Tổng kho (null): ẩn kiem-tra.
  const TABS = (() => {
    if (scope === 'vat-tu-tp')    return ALL_TABS.filter(t => ['materials','kiem-tra','nhap-kho','xuat-kho','xuat-dan','diem-dan'].includes(t.id))
    if (scope === 'phoi-son-han') return ALL_TABS.filter(t => ['materials','kiem-tra','nhap-kho','xuat-kho'].includes(t.id))
    if (scope === 'thanh-pham')   return ALL_TABS.filter(t => ['materials','nhap-kho','xuat-kho','chuyen-kiem','dong-goi','nhap-dan'].includes(t.id))
    if (scope) return ALL_TABS.filter(t => t.id !== 'materials' && t.id !== 'kiem-tra')
    return ALL_TABS.filter(t => t.id !== 'kiem-tra')
  })()

  const [tab, setTab] = useState<TabId>(scope === 'vat-tu-tp' || scope === 'phoi-son-han' || scope === 'thanh-pham' ? 'materials' : scope ? 'warehouses' : 'materials')
  const navBtn = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 9, width: '100%',
    padding: '8px 10px', marginBottom: 2, border: 'none', borderRadius: 'var(--radius)',
    background: active ? ACCENT_BG : 'transparent',
    color: active ? ACCENT : 'var(--text2)',
    fontWeight: active ? 600 : 400,
    fontSize: 13, textAlign: 'left', cursor: 'pointer', transition: 'background .1s',
  })
  // Nhãn chức vụ dưới chân sidebar
  const roleLabel = user?.role === 'MANAGER'
    ? 'Giám đốc'
    : scope === 'vat-tu-tp'    ? 'Thủ kho · Vật tư / TP'
    : scope === 'phoi-son-han' ? 'Thủ kho · Phôi Sơn Hàn'
    : scope === 'thanh-pham'   ? 'Thủ kho · Thành Phẩm'
    : scope ? `Thủ kho · ${scope}` : 'Thủ kho (tổng)'

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
            <div style={{ fontWeight: 700, fontSize: 14 }}>Kho đầu vào</div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>Đông Nam Á Corp</div>
        </div>

        <nav style={{ flex: 1, padding: '4px 8px' }}>
          {TABS.map(t => {
            const active = tab === t.id
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
              background: ACCENT_BG, color: ACCENT,
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
        {tab === 'materials'  && (scope === 'vat-tu-tp' || scope === 'phoi-son-han' || scope === 'thanh-pham' || !scope) && <MfgAllMaterialsPage limitCats={scope === 'vat-tu-tp' ? ['baoBiDongGoi', 'thanhPham', 'vatTuThanhPham', 'manh'] : scope === 'phoi-son-han' ? ['sat'] : undefined} combinedCats={scope === 'vat-tu-tp' ? [{ id: 'baoBiVTTP', label: 'Bao bì & VTTP', cats: ['baoBiDongGoi', 'vatTuThanhPham'] }] : undefined} />}
        {tab === 'warehouses' && <MfgWarehousesPage groupKey={scope} />}
        {tab === 'kiem-tra'   && <KiemTraVatTuPage
          limitCats={scope === 'phoi-son-han' ? ['sat', 'son'] : scope === 'vat-tu-tp' ? ['day', 'vatTuPhuKien', 'baoBiDongGoi'] : undefined}
          inspKhoKey={scope === 'phoi-son-han' ? 'phoiSonHan' : scope === 'vat-tu-tp' ? 'vatTuTP' : undefined}
        />}
        {tab === 'nhap-kho'   && (scope ? <WarehouseNhapPage scope={scope} /> : <NhapKhoPage lockedGroup={scope} />)}
        {tab === 'xuat-kho'   && (scope ? <WarehouseXuatPage scope={scope} /> : <XuatKhoPage lockedGroup={scope} />)}
        {tab === 'de-xuat'    && <DeXuatMuaVatTuPage />}
        {tab === 'lenh-mua'   && <LenhMuaKhoPage />}
        {tab === 'chuyen-kiem' && canSeePacking && <KhoChuyenKiemPage />}
        {tab === 'dong-goi'    && canSeePacking && <KhoDongGoiPage />}
        {tab === 'xuat-dan'   && scope === 'vat-tu-tp'   && <KhoXuatDanPage />}
        {tab === 'nhap-dan'   && scope === 'thanh-pham'  && <KhoNhapDanPage />}
        {tab === 'diem-dan'   && scope === 'vat-tu-tp'   && <QuanLyDiemDanPage />}
      </div>
    </div>
  )
}
