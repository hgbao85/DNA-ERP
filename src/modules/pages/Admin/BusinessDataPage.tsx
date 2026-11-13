'use client'
import { useUrlState } from '../../../hooks/useUrlState'
import { Briefcase, ClipboardList, FileText, Layers3, Factory, Truck, Scissors } from 'lucide-react'
import AdminTabs from './shared/AdminTabs'
import SalesPOsPage from './businessData/SalesPOsPage'
import PurchaseProposalsPage from './businessData/PurchaseProposalsPage'
import SkuPage from './businessData/SkuPage'
import ProductionInvoicesPage from './businessData/ProductionInvoicesPage'
import WarehouseTransfersPage from './businessData/WarehouseTransfersPage'
import CuttingProposalsPage from './businessData/CuttingProposalsPage'
import { pageTitle, pageSubtitle } from '../../../styles/typography'

const ACCENT = 'var(--fg-3949ab)'

type Tab = 'sales-po' | 'purchase-proposals' | 'sku' | 'production-invoices' | 'warehouse-transfers' | 'cutting-proposals'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'sales-po',             label: 'Đơn hàng bán',        icon: <ClipboardList size={14} /> },
  { id: 'purchase-proposals',   label: 'Đề xuất mua hàng',    icon: <FileText size={14} /> },
  { id: 'sku',                  label: 'SKU / Định mức',      icon: <Layers3 size={14} /> },
  { id: 'production-invoices',  label: 'Lệnh sản xuất',       icon: <Factory size={14} /> },
  { id: 'warehouse-transfers',  label: 'Chuyển kho',          icon: <Truck size={14} /> },
  { id: 'cutting-proposals',    label: 'Cắt sắt',             icon: <Scissors size={14} /> },
]

const isTab = (v: string | null): v is Tab => !!v && TABS.some(t => t.id === v)

export default function BusinessDataPage() {
  // Tab theo URL (?tab=...) - thông báo "thiếu dòng mua ngoài sắt" (13/11/2026) mở thẳng tab Lệnh sản xuất.
  const [urlTab, setUrlTab] = useUrlState('tab')
  const tab: Tab = isTab(urlTab) ? urlTab : 'sales-po'
  const setTab = (t: Tab) => setUrlTab(t)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Briefcase size={18} color={ACCENT} />
        <h2 style={{ ...pageTitle, margin: 0 }}>Module nghiệp vụ</h2>
      </div>
      <div style={{ ...pageSubtitle, marginBottom: 'var(--space-5)' }}>
        Tra cứu tổng hợp dữ liệu các phân hệ nghiệp vụ — chỉ xem, không duyệt/thao tác tại đây. Việc duyệt/xử lý thuộc đúng phân hệ nghiệp vụ tương ứng.
      </div>

      <AdminTabs tabs={TABS} active={tab} onChange={setTab} accent={ACCENT} />

      {tab === 'sales-po' && <SalesPOsPage />}
      {tab === 'purchase-proposals' && <PurchaseProposalsPage />}
      {tab === 'sku' && <SkuPage />}
      {tab === 'production-invoices' && <ProductionInvoicesPage />}
      {tab === 'warehouse-transfers' && <WarehouseTransfersPage />}
      {tab === 'cutting-proposals' && <CuttingProposalsPage />}
    </div>
  )
}
