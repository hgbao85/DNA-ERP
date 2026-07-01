import { Loader2 } from 'lucide-react'

interface LoadingStateProps {
  label?: string
  /** inline = icon + chữ (mặc định mọi trang danh sách); block = chỉ chữ, padding lớn hơn */
  variant?: 'inline' | 'block'
}

export default function LoadingState({ label = 'Đang tải...', variant = 'inline' }: LoadingStateProps) {
  if (variant === 'block') {
    return <div style={{ padding: 32, color: 'var(--text3)' }}>{label}</div>
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text2)', padding: 24 }}>
      <Loader2 size={16} /> {label}
    </div>
  )
}
