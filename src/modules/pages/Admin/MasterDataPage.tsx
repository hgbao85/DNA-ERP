'use client'
import { useState } from 'react'
import { Layers, Truck, Users, Globe2, Package, Scissors, AlertTriangle, Workflow } from 'lucide-react'
import AdminTabs from './shared/AdminTabs'
import SuppliersPage from './masterData/SuppliersPage'
import SalesCustomersPage from './masterData/SalesCustomersPage'
import ExportCustomersPage from './masterData/ExportCustomersPage'
import MaterialGroupsPage from './masterData/MaterialGroupsPage'
import MaterialsPage from './masterData/MaterialsPage'
import MaterialYieldRecipesPage from './masterData/MaterialYieldRecipesPage'
import WeavingPointsPage from './masterData/WeavingPointsPage'
import DefectReasonsPage from './masterData/DefectReasonsPage'
import { pageTitle, pageSubtitle } from '../../../styles/typography'

const ACCENT = 'var(--fg-3949ab)'

type Tab = 'suppliers' | 'sales-customers' | 'export-customers' | 'material-groups' | 'materials' | 'material-yield-recipes' | 'weaving-points' | 'defect-reasons'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'suppliers',        label: 'Nhà cung cấp',        icon: <Truck size={14} /> },
  { id: 'sales-customers',  label: 'Khách hàng bán hàng', icon: <Users size={14} /> },
  { id: 'export-customers', label: 'Khách hàng xuất khẩu', icon: <Globe2 size={14} /> },
  { id: 'material-groups',  label: 'Nhóm vật tư',         icon: <Layers size={14} /> },
  { id: 'materials',        label: 'Vật tư',              icon: <Package size={14} /> },
  { id: 'material-yield-recipes', label: 'Định mức vật tư thành phẩm', icon: <Workflow size={14} /> },
  { id: 'weaving-points',   label: 'Điểm đan',            icon: <Scissors size={14} /> },
  { id: 'defect-reasons',   label: 'Lý do lỗi',           icon: <AlertTriangle size={14} /> },
]

export default function MasterDataPage() {
  const [tab, setTab] = useState<Tab>('suppliers')

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Layers size={18} color={ACCENT} />
        <h2 style={{ ...pageTitle, margin: 0 }}>Danh mục hệ thống</h2>
      </div>
      <div style={{ ...pageSubtitle, marginBottom: 'var(--space-5)' }}>
        Dữ liệu nền dùng chung cho các phân hệ nghiệp vụ — sửa/xóa tại đây sẽ ảnh hưởng tới toàn hệ thống
      </div>

      <AdminTabs tabs={TABS} active={tab} onChange={setTab} accent={ACCENT} />

      {tab === 'suppliers' && <SuppliersPage />}
      {tab === 'sales-customers' && <SalesCustomersPage />}
      {tab === 'export-customers' && <ExportCustomersPage />}
      {tab === 'material-groups' && <MaterialGroupsPage />}
      {tab === 'materials' && <MaterialsPage />}
      {tab === 'material-yield-recipes' && <MaterialYieldRecipesPage />}
      {tab === 'weaving-points' && <WeavingPointsPage />}
      {tab === 'defect-reasons' && <DefectReasonsPage />}
    </div>
  )
}
