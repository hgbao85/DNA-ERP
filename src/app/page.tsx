'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useStore } from '../hooks/useStore';
import { useFetch } from '../hooks/useFetch';
import Dashboard from '../components/Dashboard';
import * as api from '../services/api';
import Settings from '../components/Settings';
import ProductCatalog from '../components/ProductCatalog';
import OrderTracking from '../components/OrderTracking';
import ModuleSelector from '../components/ModuleSelector';
import CustomerHub from '../modules/pages/Customers/CustomerHub';
import PromotionList from '../modules/pages/Promotions/PromotionList';
import CareReminderPanel from '../modules/pages/CareReminders/CareReminderPanel';
import SalesStaffList from '../modules/pages/Staff/SalesStaffList';
import QuotationList from '../modules/pages/Quotations/QuotationList';
import MfgApp from '../modules/pages/Manufacturing/MfgApp';
import PurchasingApp from '../modules/pages/Purchasing/PurchasingApp';
import InboundWarehouseApp from '../modules/pages/InboundWarehouse/InboundWarehouseApp';
import ProductionPlanApp from '../modules/pages/ProductionPlan/ProductionPlanApp';
import ManagerApp from '../modules/pages/Manager/ManagerApp';
import { resolveDefaultModule, isDirector as checkIsDirector } from '../utils/resolveDefaultModule';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Bell, Users, FileText,
  Package, ClipboardList, Grid, LogOut, Tag, UserCheck, Receipt,
} from 'lucide-react';

const TABS_CRM_MANAGER = [
  { id: 'dashboard',   label: 'Tổng quan',    icon: <LayoutDashboard size={16}/> },
  { id: 'quotations',  label: 'Báo giá',      icon: <Receipt size={16}/> },
  { id: 'orders',      label: 'Đơn hàng',     icon: <ClipboardList size={16}/> },
  { id: 'customers',   label: 'Khách hàng',   icon: <Users size={16}/> },
  { id: 'promotions',  label: 'Ưu đãi',       icon: <Tag size={16}/> },
  { id: 'alerts',      label: 'Nhắc nhở',     icon: <Bell size={16}/> },
  { id: 'products',    label: 'Sản phẩm',     icon: <Package size={16}/> },
  { id: 'staff',       label: 'Nhân viên',    icon: <UserCheck size={16}/> },
  { id: 'settings',    label: 'Tài liệu',     icon: <FileText size={16}/> },
];

const TABS_CRM_SALES = [
  { id: 'customers',   label: 'Khách của tôi', icon: <Users size={16}/> },
  { id: 'quotations',  label: 'Báo giá',       icon: <Receipt size={16}/> },
  { id: 'orders',      label: 'Đơn hàng',      icon: <ClipboardList size={16}/> },
  { id: 'alerts',      label: 'Nhắc nhở',      icon: <Bell size={16}/> },
];

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
  const store = useStore();
  const isDirector = checkIsDirector(user);
  const [activeModule, setActiveModule] = useState<string | null>(() => resolveDefaultModule(user));
  const [tab, setTab] = useState(() => {
    if (user?.role === 'SALES') return 'customers';
    return 'dashboard';
  });

  useEffect(() => {
    if (!user || isDirector) return;
    setActiveModule(resolveDefaultModule(user));
  }, [user?.id, user?.isProductPlanner, user?.isPurchaser, user?.mfgRole, user?.role, isDirector]);

  const { data: retailCustomers = [] } = useFetch(
    () => (isDirector || (user?.role === 'SALES' && user?.salesType === 'RETAIL'))
      ? api.getRetailCustomers()
      : Promise.resolve([]),
    [user?.id, user?.role, user?.salesType],
  );

  if (!activeModule) {
    return (
      <ModuleSelector
        user={user}
        onLogout={logout}
        onSelectModule={(mod: string) => {
          setActiveModule(mod);
          if (mod === 'crm') setTab('dashboard');
        }}
      />
    );
  }

  if (activeModule === 'manager') {
    return <ManagerApp />;
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

  const currentTabs = user?.role === 'MANAGER' ? TABS_CRM_MANAGER : TABS_CRM_SALES;
  const moduleName = 'Bán hàng / CRM';

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <div style={{
        width: 210, flexShrink: 0, background: 'var(--surface)', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '16px 16px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            {isDirector && (
              <button
                onClick={() => setActiveModule(null)}
                style={{ padding: 6, background: 'var(--surface2)', border: 'none', borderRadius: 'var(--radius)', display: 'flex', cursor: 'pointer' }}
                title="Trang chủ (Module)"
              >
                <Grid size={16} color="var(--text)" />
              </button>
            )}
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{moduleName}</div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>Đông Nam Á Corp</div>
        </div>

        <nav style={{ flex: 1, padding: '4px 8px' }}>
          {currentTabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 9, width: '100%',
                padding: '8px 10px', marginBottom: 2, border: 'none', borderRadius: 'var(--radius)',
                background: tab === t.id ? 'var(--blue-bg)' : 'transparent',
                color: tab === t.id ? 'var(--blue)' : 'var(--text2)',
                fontWeight: tab === t.id ? 600 : 400,
                fontSize: 13, textAlign: 'left', cursor: 'pointer',
                transition: 'background .1s',
              }}
              onMouseEnter={e => { if (tab !== t.id) e.currentTarget.style.background = 'var(--surface2)'; }}
              onMouseLeave={e => { if (tab !== t.id) e.currentTarget.style.background = 'transparent'; }}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </nav>

        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'var(--blue-bg)', color: 'var(--blue)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700,
            }}>
              {user ? user.name.split(' ').pop()?.substring(0, 2).toUpperCase() : 'US'}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{user?.name}</div>
              <div style={{ fontSize: 10, color: 'var(--text3)' }}>
                {user?.role === 'MANAGER' ? 'Giám đốc' : user?.role === 'SALES' ? (user?.salesType === 'WHOLESALE' ? 'Sales Khách Sỉ' : 'Sales Khách Lẻ') : 'Thủ kho'}
              </div>
            </div>
            <button
              onClick={logout}
              style={{ padding: 4, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              title="Đăng xuất"
            >
              <LogOut size={16} color="var(--text3)" />
            </button>
          </div>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Topbar */}
        <div style={{
          padding: '12px 20px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--surface)',
        }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>
            {currentTabs.find(t => t.id === tab)?.label}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>
              {format(new Date(), 'EEEE, dd/MM/yyyy', { locale: vi })}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderLeft: '1px solid var(--border)', paddingLeft: 12 }}>
              <span style={{ fontSize: 12, color: 'var(--text2)' }}>
                Xin chào, <strong style={{ color: 'var(--text)' }}>{user?.name}</strong>
              </span>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                background: user?.role === 'MANAGER' ? '#eff6ff' : user?.role === 'SALES' ? '#f0fdf4' : '#fef3c7',
                color: user?.role === 'MANAGER' ? '#1d4ed8' : user?.role === 'SALES' ? '#15803d' : '#b45309',
                border: user?.role === 'MANAGER' ? '1px solid #bfdbfe' : user?.role === 'SALES' ? '1px solid #bbf7d0' : '1px solid #fde68a',
              }}>
                {user?.role === 'MANAGER' ? 'Giám đốc' : user?.role === 'SALES' ? 'Sales' : 'Thủ kho'}
              </span>
              <button
                onClick={logout}
                style={{ padding: 4, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                title="Đăng xuất"
              >
                <LogOut size={14} color="var(--text3)" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
          {tab === 'quotations'  && <QuotationList />}
          {tab === 'products'    && <ProductCatalog />}
          {tab === 'orders'      && <OrderTracking />}
          {tab === 'dashboard'   && (
            <Dashboard
              customers={(retailCustomers ?? []) as any}
              settings={store.settings}
              onSelect={() => setTab('customers')}
              onSendNotif={() => {}}
            />
          )}
          {tab === 'alerts'      && <CareReminderPanel />}
          {tab === 'customers'   && <CustomerHub />}
          {tab === 'promotions'  && <PromotionList />}
          {tab === 'staff'       && <SalesStaffList />}
          {tab === 'settings'    && <Settings settings={store.settings} onSave={store.setSettings} />}
        </div>
      </div>
    </div>
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
