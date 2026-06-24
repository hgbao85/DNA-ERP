import { useState } from 'react'
import { useAuth } from '../../../context/AuthContext'
import RetailCustomerList from '../RetailCustomers/RetailCustomerList'
import WholesaleCustomerList from '../WholesaleCustomers/WholesaleCustomerList'
import { Users, Building2 } from 'lucide-react'

export default function CustomerHub() {
  const { user } = useAuth()
  const isManager = user?.role === 'MANAGER'
  const [activeTab, setActiveTab] = useState<'retail' | 'wholesale'>('retail')

  if (!isManager) {
    if (user?.salesType === 'WHOLESALE') return <WholesaleCustomerList />
    return <RetailCustomerList />
  }

  return (
    <div>
      <div style={{ display: 'flex', borderBottom: '2px solid var(--border)', marginBottom: 20 }}>
        {([
          ['retail',     <Users size={14} />,    'Khách lẻ'],
          ['wholesale',  <Building2 size={14} />, 'Khách sỉ'],
        ] as const).map(([id, icon, label]) => (
          <button key={id} onClick={() => setActiveTab(id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 22px', border: 'none',
              borderBottom: activeTab === id ? '2px solid var(--blue)' : '2px solid transparent',
              marginBottom: -2,
              background: 'transparent',
              color: activeTab === id ? 'var(--blue)' : 'var(--text3)',
              fontWeight: activeTab === id ? 600 : 400,
              fontSize: 13, cursor: 'pointer',
            }}>
            {icon}{label}
          </button>
        ))}
      </div>

      {activeTab === 'retail'     && <RetailCustomerList />}
      {activeTab === 'wholesale'  && <WholesaleCustomerList />}
    </div>
  )
}
