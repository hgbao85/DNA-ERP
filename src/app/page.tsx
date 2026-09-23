'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen } from 'lucide-react';
import ModuleSelector from '../components/ModuleSelector';
import SalesApp from '../modules/pages/Sales/SalesApp';
import MfgApp from '../modules/pages/Manufacturing/MfgApp';
import PurchasingApp from '../modules/pages/Purchasing/PurchasingApp';
import InboundWarehouseApp from '../modules/pages/InboundWarehouse/InboundWarehouseApp';
import ProductionPlanApp from '../modules/pages/ProductionPlan/ProductionPlanApp';
import BossApp from '../modules/pages/Boss/BossApp';
import AdminApp from '../modules/pages/Admin/AdminApp';
import { resolveDefaultModule, isDirector as checkIsDirector } from '../utils/resolveDefaultModule';
import { useAuth } from '../context/AuthContext';

function LoadingScreen() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
      height: '100vh', width: '100vw',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      color: '#f8fafc', fontFamily: "'Outfit', 'Inter', sans-serif",
    }}>
      <div style={{
        width: 48, height: 48,
        border: '4px solid rgba(2, 132, 199, 0.2)',
        borderTop: '4px solid #0284c7',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        marginBottom: 16,
      }} />
      <div style={{ fontSize: 14, fontWeight: 500, color: '#94a3b8', letterSpacing: '0.05em' }}>
        ĐANG XÁC THỰC HỆ THỐNG...
      </div>
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/** Nút nổi mở trang Hướng dẫn sử dụng ở tab mới — hiện trên mọi phân hệ, mọi role. */
function GuideFab() {
  return (
    <a
      href="/guide"
      target="_blank"
      rel="noopener noreferrer"
      title="Hướng dẫn sử dụng"
      aria-label="Mở hướng dẫn sử dụng ở tab mới"
      style={{
        position: 'fixed', right: 20, bottom: 20, zIndex: 1000,
        width: 44, height: 44, borderRadius: '50%',
        background: 'var(--blue)', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 4px 14px rgba(0,0,0,0.25)', textDecoration: 'none',
      }}
    >
      <BookOpen size={19} />
    </a>
  );
}

function MainERP() {
  const { user, logout } = useAuth();
  const isDirector = checkIsDirector(user);
  const [activeModule, setActiveModule] = useState<string | null>(() => resolveDefaultModule(user));

  useEffect(() => {
    if (!user || isDirector) return;
    setActiveModule(resolveDefaultModule(user));
  }, [user?.id, user?.isProductPlanner, user?.isPurchaser, user?.isSale, user?.mfgRole, user?.role, isDirector]);

  let content: React.ReactNode;

  if (!activeModule) {
    content = (
      <ModuleSelector
        user={user}
        onLogout={logout}
        onSelectModule={(mod: string) => setActiveModule(mod)}
      />
    );
  } else if (activeModule === 'boss') {
    content = <BossApp />;
  } else if (activeModule === 'admin') {
    content = <AdminApp />;
  } else if (activeModule === 'sales') {
    content = <SalesApp onBack={isDirector ? () => setActiveModule(null) : undefined} />;
  } else if (activeModule === 'production') {
    content = <MfgApp onBack={isDirector ? () => setActiveModule(null) : undefined} />;
  } else if (activeModule === 'purchasing') {
    content = <PurchasingApp onBack={isDirector ? () => setActiveModule(null) : undefined} />;
  } else if (activeModule === 'inbound_warehouse') {
    content = <InboundWarehouseApp onBack={isDirector ? () => setActiveModule(null) : undefined} />;
  } else if (activeModule === 'production_plan') {
    content = <ProductionPlanApp onBack={isDirector ? () => setActiveModule(null) : undefined} />;
  } else {
    content = (
      <ModuleSelector
        user={user}
        onLogout={logout}
        onSelectModule={(mod: string) => setActiveModule(mod)}
      />
    );
  }

  return (
    <>
      {content}
      <GuideFab />
    </>
  );
}

export default function Page() {
  const { token, user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!token || !user)) {
      router.replace('/login');
    }
  }, [loading, token, user, router]);

  if (loading) return <LoadingScreen />;
  if (!token || !user) return null;

  return <MainERP />;
}
