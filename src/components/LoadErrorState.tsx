import { AlertTriangle } from 'lucide-react'

/** Lỗi tải dữ liệu KHÔNG được nuốt thành "chưa có gì" (2026-09-11, QA audit B2) - trước đây nhiều
 *  màn chỉ gate `isLoading || !data`, nên khi fetch lỗi (mất mạng/403...) `isLoading` về `false`
 *  nhưng `data` vẫn `null` → màn hình kẹt ở LoadingState vĩnh viễn, không có gì báo lỗi. Dùng chung
 *  cho mọi màn cần phân biệt rõ "lỗi tải" với "đang tải"/"tải xong nhưng rỗng thật". */
export default function LoadErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      background: 'rgba(198, 40, 40, 0.08)', border: '1px solid rgba(198, 40, 40, 0.3)',
      borderRadius: 8, padding: '10px 14px', color: '#c62828', fontSize: 13, fontWeight: 500,
    }}>
      <AlertTriangle size={16} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1 }}>Không tải được dữ liệu: {error}</span>
      <button
        onClick={onRetry}
        style={{ padding: '4px 12px', fontSize: 12, fontWeight: 600, color: '#c62828', background: 'transparent', border: '1px solid rgba(198, 40, 40, 0.4)', borderRadius: 6, cursor: 'pointer', flexShrink: 0 }}
      >
        Thử lại
      </button>
    </div>
  )
}
