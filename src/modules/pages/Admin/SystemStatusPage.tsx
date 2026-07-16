'use client'
import { Activity, Database, HardDrive, RefreshCcw } from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import { useConfirm } from '../../../hooks/useConfirm'
import { useAuditLog } from '../../../context/AuditLogContext'
import { getSystemStats, resetSystemData } from '../../../services/api'
import type { SystemStats } from '../../../lib/mock/services/system.service'
import LoadingState from '../../../components/LoadingState'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export default function SystemStatusPage() {
  const { data, isLoading, refetch } = useFetch<SystemStats>(getSystemStats)
  const { logAction } = useAuditLog()
  const { ask, confirmModal } = useConfirm()

  const handleReset = () => {
    ask(
      {
        title: 'Reset dữ liệu demo',
        message: 'Toàn bộ dữ liệu hiện tại (đơn hàng, người dùng đã tạo thêm, danh mục đã sửa...) sẽ bị xóa và khôi phục về dữ liệu demo ban đầu. Hành động này không thể hoàn tác.',
        danger: true,
        confirmLabel: 'Reset dữ liệu',
      },
      async () => {
        logAction('system', 'system', 'system.data_reset')
        await resetSystemData()
        window.location.reload()
      }
    )
  }

  if (isLoading || !data) return <LoadingState />

  const totalRecords = data.collectionCounts.reduce((sum, c) => sum + c.count, 0)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Activity size={18} color="#3949ab" />
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Tình trạng hệ thống</h2>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 18 }}>
        Toàn bộ dữ liệu là mock lưu trong trình duyệt (localStorage) — không có backend thật nên không có nhật ký lỗi server.
      </div>

      <div style={{ display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 160, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
          <div style={{ color: '#3949ab', marginBottom: 10 }}><Database size={18} /></div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{totalRecords.toLocaleString('vi-VN')}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Tổng bản ghi ({data.collectionCounts.length} collection)</div>
        </div>
        <div style={{ flex: 1, minWidth: 160, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
          <div style={{ color: '#3949ab', marginBottom: 10 }}><HardDrive size={18} /></div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{formatBytes(data.storageBytes)}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Dung lượng localStorage</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: 2, minWidth: 320 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)', marginBottom: 10 }}>Số bản ghi theo collection</div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', maxHeight: 420, overflowY: 'auto' }}>
            {data.collectionCounts.map((c, i) => (
              <div
                key={c.key}
                style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', fontSize: 13, borderTop: i === 0 ? undefined : '1px solid var(--border)' }}
              >
                <span style={{ color: 'var(--text2)' }}>{c.key}</span>
                <span style={{ fontWeight: 600 }}>{c.count}</span>
              </div>
            ))}
          </div>
          <button onClick={() => refetch()} style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text2)', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>
            <RefreshCcw size={12} /> Làm mới
          </button>
        </div>

        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#c62828', marginBottom: 10 }}>Vùng nguy hiểm</div>
          <div style={{ border: '1px solid #f5c6cb', borderRadius: 10, background: 'var(--red-bg)', padding: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>
              Xóa toàn bộ dữ liệu demo hiện có trong trình duyệt này và khôi phục lại dữ liệu gốc ban đầu.
            </div>
            <button
              onClick={handleReset}
              style={{ padding: '8px 16px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', background: '#c62828', cursor: 'pointer' }}
            >
              Reset dữ liệu demo
            </button>
          </div>
        </div>
      </div>

      {confirmModal}
    </div>
  )
}
