'use client';

import { useState } from 'react';
import LoginPage, { type DemoRole, type DemoUser } from './LoginPage';
import ScreenSat      from './screens/ScreenSat';
import ScreenDay      from './screens/ScreenDay';
import ScreenPhuKien  from './screens/ScreenPhuKien';
import ScreenKeHoach  from './screens/ScreenKeHoach';
import MaterialsTab   from './MaterialsTab';
import StockTab       from './StockTab';

const ROLE_META: Record<DemoRole, { label: string; color: string }> = {
  'dinh-muc': { label: 'Quản lý định mức', color: '#1565c0' },
  'ke-hoach':  { label: 'Kế hoạch SX',     color: '#6a1b9a' },
  'kho':       { label: 'Thủ kho',          color: '#2e7d32' },
};

const CAT_LABEL: Record<string, string> = {
  SAT: 'Sắt', DAY: 'Dây / Sơn', PHU_KIEN: 'Phụ kiện', BAO_BI: 'Bao bì',
};

// Tabs available per role
type TabDef = { id: string; label: string };

const TABS_KE_HOACH: TabDef[]  = [{ id: 'bom', label: '② Định mức' }];
const TABS_DINH_MUC: TabDef[]  = [{ id: 'bom', label: '② Định mức' }, { id: 'mat', label: '① Vật tư' }];
const TABS_KHO: TabDef[]       = [{ id: 'stock', label: '④ Kho' }];

export default function DemoApp() {
  const [user, setUser]   = useState<DemoUser | null>(null);
  const [tab,  setTab]    = useState('bom');
  const [reload, setReload] = useState(0);
  const bump = () => setReload((r) => r + 1);

  const handleLogin = (u: DemoUser) => {
    setUser(u);
    setTab(u.role === 'kho' ? 'stock' : 'bom');
  };

  if (!user) return <LoginPage onLogin={handleLogin} />;

  const roleMeta = ROLE_META[user.role];
  const tabs = user.role === 'ke-hoach' ? TABS_KE_HOACH
             : user.role === 'kho'      ? TABS_KHO
             : TABS_DINH_MUC;

  const renderScreen = () => {
    if (tab === 'mat')   return <MaterialsTab reloadKey={reload} onChanged={bump} categoryCode={user.categoryCode} />;
    if (tab === 'stock') return <StockTab reloadKey={reload} onChanged={bump} />;
    // tab === 'bom'
    if (user.role === 'ke-hoach')                   return <ScreenKeHoach />;
    if (user.role === 'dinh-muc' && user.categoryCode === 'SAT')      return <ScreenSat />;
    if (user.role === 'dinh-muc' && user.categoryCode === 'DAY')      return <ScreenDay />;
    if (user.role === 'dinh-muc' && user.categoryCode === 'PHU_KIEN') return <ScreenPhuKien />;
    return <div className="card"><div className="empty">Không xác định được màn hình.</div></div>;
  };

  return (
    <div className="wrap">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div className="title" style={{ marginBottom: 4 }}>Demo · Định mức → Vật tư → Kho</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, color: roleMeta.color }}>{roleMeta.label}</span>
            <span style={{ color: 'var(--muted)' }}>·</span>
            <span style={{ fontWeight: 600 }}>{user.name}</span>
            {user.categoryCode && (
              <>
                <span style={{ color: 'var(--muted)' }}>·</span>
                <span style={{
                  fontSize: 11, fontWeight: 700, color: '#fff',
                  background: roleMeta.color, borderRadius: 4, padding: '2px 8px',
                }}>
                  {CAT_LABEL[user.categoryCode] ?? user.categoryCode}
                </span>
              </>
            )}
          </div>
        </div>
        <button onClick={() => setUser(null)} style={{
          background: 'transparent', border: '1.5px solid var(--border)',
          borderRadius: 8, padding: '6px 14px', fontSize: 13, cursor: 'pointer',
          color: 'var(--muted)', whiteSpace: 'nowrap',
        }}>← Đổi vai trò</button>
      </div>

      {tabs.length > 1 && (
        <div className="tabs">
          {tabs.map((t) => (
            <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {renderScreen()}
    </div>
  );
}
