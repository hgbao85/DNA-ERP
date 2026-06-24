import { useState } from 'react'
import { LogOut, Grid, Boxes, Warehouse, ArrowDownToLine, ArrowUpFromLine, FileText, ChevronDown, ClipboardCheck, Box } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
// Tái dùng nguyên các màn kho đã có (trước đây nằm trong MES) — KHÔNG viết lại logic.
import MfgWarehousesPage, { WAREHOUSE_GROUPS } from '../Manufacturing/MfgWarehousesPage'
import MfgAllMaterialsPage from '../Manufacturing/MfgAllMaterialsPage'
import NhapKhoPage from '../Manufacturing/NhapKhoPage'
import XuatKhoPage from '../Manufacturing/XuatKhoPage'
import DeXuatMuaVatTuPage from '../Manufacturing/DeXuatMuaVatTuPage'
import ChuyenKiemPage from '../Manufacturing/ChuyenKiemPage'
import DongGoiPage from '../Manufacturing/DongGoiPage'

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
  const scopeGroup = scope ? WAREHOUSE_GROUPS.find(g => g.key === scope) ?? null : null

  // Chuyền kiểm + Đóng gói: kho thành phẩm + kho bao bì đóng gói + tổng kho (scope null). GĐ cũng thấy.
  const canSeePacking = scope === null || scope === 'thanh-pham' || scope === 'bao-bi'

  type TabId = 'materials' | 'warehouses' | 'nhap-kho' | 'xuat-kho' | 'de-xuat' | 'chuyen-kiem' | 'dong-goi'
  const ALL_TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'materials',  label: 'Tổng hợp vật tư',    icon: <Boxes size={16} /> },
    { id: 'warehouses', label: scopeGroup ? scopeGroup.label : 'Tổng hợp kho', icon: <Warehouse size={16} /> },
    { id: 'nhap-kho',   label: 'Nhập kho',           icon: <ArrowDownToLine size={16} /> },
    { id: 'xuat-kho',   label: 'Xuất kho',           icon: <ArrowUpFromLine size={16} /> },
    { id: 'de-xuat',    label: 'Đề xuất mua vật tư', icon: <FileText size={16} /> },
    ...(canSeePacking ? [
      { id: 'chuyen-kiem' as TabId, label: 'Chuyền kiểm', icon: <ClipboardCheck size={16} /> },
      { id: 'dong-goi'    as TabId, label: 'Đóng gói',    icon: <Box size={16} /> },
    ] : []),
  ]
  // Tài khoản bị giới hạn KHÔNG được xem "Tổng hợp vật tư" (gộp toàn bộ kho) — chỉ kho của mình.
  const TABS = scope ? ALL_TABS.filter(t => t.id !== 'materials') : ALL_TABS

  const [tab, setTab] = useState<TabId>(scope ? 'warehouses' : 'materials')
  const [whGroup, setWhGroup] = useState<string | null>(null)
  const [whExpanded, setWhExpanded] = useState(false)

  const navBtn = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 9, width: '100%',
    padding: '8px 10px', marginBottom: 2, border: 'none', borderRadius: 'var(--radius)',
    background: active ? ACCENT_BG : 'transparent',
    color: active ? ACCENT : 'var(--text2)',
    fontWeight: active ? 600 : 400,
    fontSize: 13, textAlign: 'left', cursor: 'pointer', transition: 'background .1s',
  })
  const subNavBtn = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', width: '100%',
    padding: '6px 10px 6px 35px', marginBottom: 2, border: 'none', borderRadius: 'var(--radius)',
    background: active ? ACCENT_BG : 'transparent',
    color: active ? ACCENT : 'var(--text3)',
    fontWeight: active ? 600 : 400,
    fontSize: 12, textAlign: 'left', cursor: 'pointer', transition: 'background .1s',
  })

  // Nhãn chức vụ dưới chân sidebar
  const roleLabel = user?.role === 'MANAGER'
    ? 'Giám đốc'
    : scopeGroup ? `Thủ kho · ${scopeGroup.label}` : 'Thủ kho (tổng)'

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
            // "Tổng hợp kho" → xổ menu con theo nhóm kho (CHỈ khi tài khoản không bị giới hạn).
            if (t.id === 'warehouses' && !scope) {
              const parentActive = tab === 'warehouses'
              return (
                <div key={t.id}>
                  <button
                    onClick={() => { setTab('warehouses'); setWhGroup(null); setWhExpanded(e => !e) }}
                    style={navBtn(parentActive)}
                    onMouseEnter={e => { if (!parentActive) e.currentTarget.style.background = 'var(--surface2)' }}
                    onMouseLeave={e => { if (!parentActive) e.currentTarget.style.background = 'transparent' }}
                  >
                    {t.icon}
                    <span style={{ flex: 1 }}>{t.label}</span>
                    <ChevronDown size={14} style={{ transform: whExpanded ? 'none' : 'rotate(-90deg)', transition: 'transform .15s' }} />
                  </button>
                  {whExpanded && WAREHOUSE_GROUPS.map(g => {
                    const subActive = tab === 'warehouses' && whGroup === g.key
                    return (
                      <button
                        key={g.key}
                        onClick={() => { setTab('warehouses'); setWhGroup(g.key) }}
                        style={subNavBtn(subActive)}
                        onMouseEnter={e => { if (!subActive) e.currentTarget.style.background = 'var(--surface2)' }}
                        onMouseLeave={e => { if (!subActive) e.currentTarget.style.background = 'transparent' }}
                      >
                        {g.label}
                      </button>
                    )
                  })}
                </div>
              )
            }
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
        {tab === 'materials'  && !scope && <MfgAllMaterialsPage />}
        {tab === 'warehouses' && <MfgWarehousesPage groupKey={scope ?? whGroup} />}
        {tab === 'nhap-kho'   && <NhapKhoPage lockedGroup={scope} />}
        {tab === 'xuat-kho'   && <XuatKhoPage lockedGroup={scope} />}
        {tab === 'de-xuat'    && <DeXuatMuaVatTuPage />}
        {tab === 'chuyen-kiem' && canSeePacking && <ChuyenKiemPage />}
        {tab === 'dong-goi'    && canSeePacking && <DongGoiPage />}
      </div>
    </div>
  )
}
