'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ModuleSelector from '../components/ModuleSelector';
import SalesApp from '../modules/pages/Sales/SalesApp';
import MfgApp from '../modules/pages/Manufacturing/MfgApp';
import PurchasingApp from '../modules/pages/Purchasing/PurchasingApp';
import InboundWarehouseApp from '../modules/pages/InboundWarehouse/InboundWarehouseApp';
import ProductionPlanApp from '../modules/pages/ProductionPlan/ProductionPlanApp';
import BossApp from '../modules/pages/Boss/BossApp';
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

function MainERP() {
  const { user, logout } = useAuth();
  const isDirector = checkIsDirector(user);
  const [activeModule, setActiveModule] = useState<string | null>(() => resolveDefaultModule(user));

  useEffect(() => {
    if (!user || isDirector) return;
    setActiveModule(resolveDefaultModule(user));
  }, [user?.id, user?.isProductPlanner, user?.isPurchaser, user?.isSale, user?.mfgRole, user?.role, isDirector]);

  if (!activeModule) {
    return (
      <ModuleSelector
        user={user}
        onLogout={logout}
        onSelectModule={(mod: string) => setActiveModule(mod)}
      />
    );
  }

  if (activeModule === 'boss') {
    return <BossApp />;
  }

  if (activeModule === 'sales') {
    return <SalesApp onBack={isDirector ? () => setActiveModule(null) : undefined} />;
  }

  if (activeModule === 'production') {
    return <MfgApp onBack={isDirector ? () => setActiveModule(null) : undefined} />;
  }

  if (activeModule === 'purchasing') {
    return <PurchasingApp onBack={isDirector ? () => setActiveModule(null) : undefined} />;
  }

  if (activeModule === 'inbound_warehouse') {
    return <InboundWarehouseApp onBack={isDirector ? () => setActiveModule(null) : undefined} />;
  }

  if (activeModule === 'production_plan') {
    return <ProductionPlanApp onBack={isDirector ? () => setActiveModule(null) : undefined} />;
  }

  return (
    <ModuleSelector
      user={user}
      onLogout={logout}
      onSelectModule={(mod: string) => setActiveModule(mod)}
    />
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
