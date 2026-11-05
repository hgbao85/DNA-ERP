'use client'
import { useEffect, useState } from 'react'
import { ArrowDownToLine, ArrowLeftRight } from 'lucide-react'
import { canReceiveAt } from '../../../types/warehouse-transfer'
import { useUrlState } from '../../../hooks/useUrlState'
import { NhapNoiBoSection } from '../InboundWarehouse/InternalTransferSections'
import { pageTitle } from '../../../styles/typography'
import NhapKhoNhanHang from './NhapKhoNhanHang'

// ── Main page ────────────────────────────────────────────────
export default function NhapKhoPage({ lockedGroup }: { lockedGroup?: string | null } = {}) {
  // `sub` trong query string - cho `WAREHOUSE_TRANSFER_CREATED` mở đúng sub-tab "Nhập nội bộ" thay
  // vì rơi vào "Nhập kho" (mua hàng) mặc định - 2 sub-tab hoàn toàn khác chức năng, không có route
  // riêng trước đây (xem changelog notification 2026-09-25 mục 23.2). Cùng cơ chế `p` ở cấp app
  // shell, chỉ khác đây là sub-tab lồng bên trong 1 page đã có `p='nhap-kho'`.
  const [urlSub, setUrlSub] = useUrlState('sub')
  const [nhapTab, setNhapTabState] = useState<'nhap' | 'noi-bo'>(() => (urlSub === 'noi-bo' ? 'noi-bo' : 'nhap'))
  const setNhapTab = (id: 'nhap' | 'noi-bo') => { setNhapTabState(id); setUrlSub(id === 'noi-bo' ? 'noi-bo' : null) }
  useEffect(() => {
    if (urlSub === 'noi-bo' && nhapTab !== 'noi-bo') setNhapTabState('noi-bo')
  }, [urlSub])

  const showNoiBo = canReceiveAt(lockedGroup ?? '')

  const tabs = [
    ['nhap',    'Nhập kho',           ArrowDownToLine],
    ...(showNoiBo ? [['noi-bo', 'Nhập nội bộ', ArrowLeftRight] as const] : []),
  ] as const

  return (
    <div>
      <h2 style={{ ...pageTitle, marginBottom: 'var(--space-5)' }}>Nhập kho</h2>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        {tabs.map(([id, label, Icon]) => (
          <button key={id} onClick={() => setNhapTab(id)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 18px', fontSize: 13, fontWeight: nhapTab === id ? 700 : 500,
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: nhapTab === id ? 'var(--fg-2e7d32)' : 'var(--text2)',
            borderBottom: nhapTab === id ? '2px solid var(--fg-2e7d32)' : '2px solid transparent',
            marginBottom: -1,
          }}>
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {nhapTab === 'nhap'    && <NhapKhoNhanHang lockedGroup={lockedGroup} />}
      {nhapTab === 'noi-bo'  && showNoiBo && <NhapNoiBoSection warehouseCode={lockedGroup ?? ''} />}
    </div>
  )
}
