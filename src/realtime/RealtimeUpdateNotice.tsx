'use client'

/**
 * Thanh báo "dữ liệu vừa được cập nhật" cho màn đang có form/kế hoạch. Không tự tải lại: người dùng
 * bấm "Tải lại" khi sẵn sàng, để không mất dữ liệu đang nhập.
 */
export default function RealtimeUpdateNotice({ visible, onReload }: { visible: boolean; onReload: () => void }) {
  if (!visible) return null
  return (
    <div
      role="status"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        padding: '8px 12px', marginBottom: 10, borderRadius: 8,
        border: '1px solid #f59e0b', background: 'rgba(245, 158, 11, 0.12)', fontSize: 13,
      }}
    >
      <span>Dữ liệu vừa được cập nhật bởi người khác. Tải lại để thấy thay đổi (nội dung đang nhập sẽ không bị xoá).</span>
      <button type="button" onClick={onReload} style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
        Tải lại
      </button>
    </div>
  )
}
