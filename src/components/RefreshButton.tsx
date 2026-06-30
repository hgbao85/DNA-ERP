import { Fragment } from 'react'
import { RefreshCw } from 'lucide-react'

interface RefreshButtonProps {
  onRefresh: () => void
  loading?: boolean
  label?: string
  loadingLabel?: string
  size?: 'sm' | 'md'
  style?: React.CSSProperties
}

const SIZES: Record<'sm' | 'md', { padding: string; fontSize: number; fontWeight: number; borderRadius: number | string; iconSize: number }> = {
  sm: { padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6, iconSize: 11 },
  md: { padding: '7px 14px', fontSize: 13, fontWeight: 500, borderRadius: 'var(--radius)', iconSize: 14 },
}

export default function RefreshButton({
  onRefresh,
  loading = false,
  label = 'Làm mới',
  loadingLabel = 'Đang tải...',
  size = 'md',
  style,
}: RefreshButtonProps) {
  const s = SIZES[size]
  return (
    <Fragment>
      <button
        onClick={onRefresh}
        disabled={loading}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: s.padding, fontSize: s.fontSize, fontWeight: s.fontWeight, borderRadius: s.borderRadius,
          border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text2)',
          cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1,
          ...style,
        }}
      >
        <RefreshCw size={s.iconSize} style={loading ? { animation: 'spin 0.8s linear infinite' } : undefined} />
        {loading ? loadingLabel : label}
      </button>
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    </Fragment>
  )
}
