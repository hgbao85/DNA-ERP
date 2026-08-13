'use client'
import { Users, ShieldCheck, Factory, ShoppingCart, ClipboardList, ArrowRight } from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import { getUsers, getAllAuditLogs, getSalesOrders, getProductionInvoices, getSuppliers } from '../../../services/api'
import LoadingState from '../../../components/LoadingState'
import AuditLogTimeline from '../../../components/AuditLogTimeline'
import type { AuditLogEntry } from '../../../context/AuditLogContext'
import type { SystemUser } from '../../../types/admin'

interface DashboardPageProps {
  onViewAuditLog: () => void
}

function StatTile({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number | string; accent: string }) {
  return (
    <div style={{ flex: 1, minWidth: 160, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, color: accent }}>{icon}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{label}</div>
    </div>
  )
}

export default function DashboardPage({ onViewAuditLog }: DashboardPageProps) {
  const { data: users, isLoading: loadingUsers } = useFetch<SystemUser[]>(getUsers)
  const { data: logs, isLoading: loadingLogs } = useFetch<AuditLogEntry[]>(() => getAllAuditLogs() as Promise<AuditLogEntry[]>)
  const { data: salesPOs } = useFetch(getSalesOrders)
  const { data: pis } = useFetch(getProductionInvoices)
  const { data: suppliers } = useFetch(getSuppliers)

  const userList = users ?? []
  const activeCount = userList.filter(u => u.isActive).length
  const bossCount = userList.filter(u => u.role === 'BOSS').length
  const mfgCount = userList.filter(u => !!u.mfgRole).length
  const purchaserCount = userList.filter(u => u.isPurchaser).length
  const plannerCount = userList.filter(u => u.isProductPlanner).length
  const saleCount = userList.filter(u => u.isSale).length

  const recentLogs = [...(logs ?? [])].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5)

  if (loadingUsers || loadingLogs) return <LoadingState />

  return (
    <div>
      <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700 }}>Tổng quan</h2>
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 18 }}>Số liệu quản trị hệ thống</div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
        <StatTile icon={<Users size={18} />} label={`Tổng người dùng (${activeCount} hoạt động)`} value={userList.length} accent="#3949ab" />
        <StatTile icon={<ShieldCheck size={18} />} label="Giám đốc" value={bossCount} accent="#2e7d32" />
        <StatTile icon={<Factory size={18} />} label="Nhân sự sản xuất" value={mfgCount} accent="#e65100" />
        <StatTile icon={<ShoppingCart size={18} />} label="Mua hàng / KH SX / Sales" value={`${purchaserCount} / ${plannerCount} / ${saleCount}`} accent="#4527a0" />
      </div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: 2, minWidth: 320 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)' }}>Hoạt động gần đây</div>
            <button
              onClick={onViewAuditLog}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#3949ab', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600 }}
            >
              Xem tất cả <ArrowRight size={12} />
            </button>
          </div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', padding: 14 }}>
            <AuditLogTimeline entries={recentLogs} bare />
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)', marginBottom: 10 }}>Tổng quan hệ thống</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', padding: '10px 14px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text2)' }}><ClipboardList size={14} /> Đơn hàng bán</span>
              <span style={{ fontWeight: 700 }}>{(salesPOs ?? []).length}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', padding: '10px 14px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text2)' }}><Factory size={14} /> Lệnh sản xuất (PI)</span>
              <span style={{ fontWeight: 700 }}>{(pis ?? []).length}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', padding: '10px 14px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text2)' }}><ShoppingCart size={14} /> Nhà cung cấp</span>
              <span style={{ fontWeight: 700 }}>{(suppliers ?? []).length}</span>
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>
            Số liệu chỉ để tham khảo, xem/quản lý chi tiết trong từng phân hệ nghiệp vụ.
          </div>
        </div>
      </div>
    </div>
  )
}
