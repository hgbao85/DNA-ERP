import { LayoutDashboard, Users, Package, ShoppingCart, Truck, Factory, DollarSign, Wallet, CheckSquare, LogOut } from 'lucide-react'

const ALL_MODULES = [
  { id: 'sales', name: 'Bán hàng', desc: 'Quản lý đơn hàng, quản lý khách hàng', icon: <Users size={32} />, color: '#E8F5E9', textColor: '#2E7D32' },
  { id: 'production_plan', name: 'Kế hoạch SX', desc: 'Tổng nhu cầu NVL, lệnh sản xuất', icon: <LayoutDashboard size={32} />, color: '#E8F5E9', textColor: '#2E7D32' },
  { id: 'purchasing', name: 'Mua hàng', desc: 'RFQ, so sánh giá, PO, gửi NCC', icon: <ShoppingCart size={32} />, color: '#EDE7F6', textColor: '#4527A0' },
  { id: 'inbound_warehouse', name: 'Kho đầu vào', desc: 'Theo dõi vật tư về, nhập kho NVL', icon: <Package size={32} />, color: '#EDE7F6', textColor: '#4527A0' },
  { id: 'qc', name: 'Chất lượng QC', desc: 'Chuyên kiểm, đạt/không đạt', icon: <CheckSquare size={32} />, color: '#FFF3E0', textColor: '#E65100' },
  { id: 'production', name: 'Sản xuất', desc: 'Cắt -> Hàn -> Sơn, gia công ngoài', icon: <Factory size={32} />, color: '#FFF3E0', textColor: '#E65100' },
  { id: 'shipping', name: 'Vận chuyển', desc: 'Xuất khẩu, vận chuyển', icon: <Truck size={32} />, color: '#E3F2FD', textColor: '#1565C0' },
  { id: 'ap_accounting', name: 'KT mua', desc: 'Công nợ phải trả, theo dõi thanh toán', icon: <Wallet size={32} />, color: '#E8EAF6', textColor: '#283593' },
  { id: 'ar_accounting', name: 'KT bán', desc: 'Công nợ phải thu, theo dõi thu tiền', icon: <DollarSign size={32} />, color: '#E8EAF6', textColor: '#283593' },
];

interface ModuleSelectorProps {
  user: any;
  onLogout: () => void;
  onSelectModule: (mod: string) => void;
}

export default function ModuleSelector({ user, onLogout, onSelectModule }: ModuleSelectorProps) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface2)', padding: '40px 40px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        
        {/* TOP BAR / HEADER FOR MODULE SELECTOR */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40, borderBottom: '1px solid var(--border)', paddingBottom: 20 }}>
          <div>
            <h1 style={{ margin: 0, color: 'var(--text)', fontSize: 28, fontWeight: 700 }}>Hệ thống Quản trị Doanh nghiệp</h1>
            <p style={{ color: 'var(--text2)', margin: '4px 0 0 0', fontSize: 15 }}>Chọn phân hệ bạn muốn làm việc</p>
          </div>
          
          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface)', padding: '8px 16px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
              <span style={{ fontSize: 13, color: 'var(--text2)' }}>
                Xin chào, <strong style={{ color: 'var(--text)' }}>{user.name}</strong>
              </span>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                background: user.role === 'BOSS' ? '#eff6ff' : '#fef3c7',
                color: user.role === 'BOSS' ? '#1d4ed8' : '#b45309',
                border: user.role === 'BOSS' ? '1px solid #bfdbfe' : '1px solid #fde68a'
              }}>
                {user.role === 'BOSS' ? 'Giám đốc' : 'Thủ kho'}
              </span>
              <button 
                onClick={onLogout} 
                style={{ 
                  padding: '6px 12px', background: 'var(--surface2)', border: 'none', borderRadius: 'var(--radius)', 
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text)' 
                }} 
                title="Đăng xuất"
              >
                <LogOut size={13} color="var(--text3)" />
                Đăng xuất
              </button>
            </div>
          )}
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 20 }}>
          {ALL_MODULES.map(mod => {
            const isImplemented = mod.id === 'sales' || mod.id === 'production' || mod.id === 'purchasing' || mod.id === 'inbound_warehouse' || mod.id === 'production_plan';

            // Quyền truy cập theo role
            const isAccessible = (() => {
              if (!isImplemented) return false;
              if (mod.id === 'sales')      return (user?.role === 'BOSS' && !user?.mfgRole) || !!user?.isSale;
              if (mod.id === 'production') return user?.role === 'BOSS' || !!user?.mfgRole;
              if (mod.id === 'purchasing') return (user?.role === 'BOSS' && !user?.mfgRole) || !!user?.isPurchaser;
              if (mod.id === 'inbound_warehouse') {
                if (user?.mfgRole || user?.isProductPlanner || user?.isPurchaser || user?.isSale) return false;
                return user?.role === 'WAREHOUSE_STAFF' || user?.role === 'BOSS';
              }
              if (mod.id === 'production_plan') return (user?.role === 'BOSS' && !user?.mfgRole) || !!user?.isProductPlanner;
              return false;
            })();

            const clickable = isAccessible;
            const badge = !isImplemented ? 'SẮP RA MẮT' : (!isAccessible ? 'KHÔNG CÓ QUYỀN' : null);

            return (
              <div
                key={mod.id}
                onClick={() => clickable && onSelectModule(mod.id)}
                style={{
                  background: mod.color,
                  borderRadius: 'var(--radius-lg)',
                  padding: '24px 20px',
                  cursor: clickable ? 'pointer' : 'not-allowed',
                  opacity: clickable ? 1 : 0.45,
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                  position: 'relative'
                }}
                onMouseEnter={e => {
                  if (clickable) {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.1)';
                  }
                }}
                onMouseLeave={e => {
                  if (clickable) {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
                  }
                }}
              >
                {badge && (
                  <div style={{
                    position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.1)',
                    color: 'rgba(0,0,0,0.6)', padding: '4px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600
                  }}>{badge}</div>
                )}
                <div style={{ color: mod.textColor, marginBottom: 16 }}>
                  {mod.icon}
                </div>
                <div style={{ fontWeight: 700, fontSize: 18, color: mod.textColor, marginBottom: 8 }}>
                  {mod.name}
                </div>
                <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.6)', lineHeight: 1.4 }}>
                  {mod.desc}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
