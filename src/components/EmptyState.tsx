import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon: ReactNode
  message: string
}

/**
 * Khối thông báo "chưa có dữ liệu" dạng card, dùng cho các trang danh sách dạng card/accordion.
 * `icon` truyền vào đã được style sẵn (size, opacity, marginBottom) bởi nơi gọi.
 */
export default function EmptyState({ icon, message }: EmptyStateProps) {
  return (
    <div style={{ padding: '40px 24px', textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text3)' }}>
      {icon}
      <div>{message}</div>
    </div>
  )
}
