'use client'
import { useState } from 'react'
import { Briefcase, ClipboardList, FileText, Layers3, Factory, Truck, Scissors } from 'lucide-react'
import { tabBtn } from '../../../styles/buttons'
import SalesPOsPage from './businessData/SalesPOsPage'
import PurchaseProposalsPage from './businessData/PurchaseProposalsPage'
import SkuPage from './businessData/SkuPage'
import ProductionInvoicesPage from './businessData/ProductionInvoicesPage'
import WarehouseTransfersPage from './businessData/WarehouseTransfersPage'
import CuttingProposalsPage from './businessData/CuttingProposalsPage'

const ACCENT = '#3949ab'

type Tab = 'sales-po' | 'purchase-proposals' | 'sku' | 'production-invoices' | 'warehouse-transfers' | 'cutting-proposals'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'sales-po',             label: 'Đơn hàng bán',        icon: <ClipboardList size={14} /> },
  { id: 'purchase-proposals',   label: 'Đề xuất mua hàng',    icon: <FileText size={14} /> },
  { id: 'sku',                  label: 'SKU / Định mức',      icon: <Layers3 size={14} /> },
  { id: 'production-invoices',  label: 'Lệnh sản xuất',       icon: <Factory size={14} /> },
  { id: 'warehouse-transfers',  label: 'Chuyển kho',          icon: <Truck size={14} /> },
  { id: 'cutting-proposals',    label: 'Cắt sắt',             icon: <Scissors size={14} /> },
]

export default function BusinessDataPage() {
  const [tab, setTab] = useState<Tab>('sales-po')

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Briefcase size={18} color={ACCENT} />
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Module nghiệp vụ</h2>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>
        Tra cứu tổng hợp dữ liệu các phân hệ nghiệp vụ — chỉ xem, không duyệt/thao tác tại đây. Việc duyệt/xử lý thuộc đúng phân hệ nghiệp vụ tương ứng.
      </div>

      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--border)', marginBottom: 18, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{ ...tabBtn(tab === t.id, ACCENT), display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'sales-po' && <SalesPOsPage />}
      {tab === 'purchase-proposals' && <PurchaseProposalsPage />}
      {tab === 'sku' && <SkuPage />}
      {tab === 'production-invoices' && <ProductionInvoicesPage />}
      {tab === 'warehouse-transfers' && <WarehouseTransfersPage />}
      {tab === 'cutting-proposals' && <CuttingProposalsPage />}
    </div>
  )
}
