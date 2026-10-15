import { useRef } from 'react'
import { ApiError } from '../services/core/apiError'
import { newUuid } from '../services/core/uuid'

/**
 * Idempotency-Key cho các nút "Lưu" báo sản lượng xưởng (2026-10-12, phần nền trước QR - xem
 * changelog-2026-10-08-ke-hoach-tem-qr-bo-sat-phoi.md mục 21 bên BE).
 *
 * GIỮ NGUYÊN khoá khi lần bấm trước KHÔNG có phản hồi từ máy chủ (mất mạng, quá thời gian chờ -
 * ApiError.statusCode 0): request có thể đã tới BE và được cộng, bấm lại với CÙNG khoá thì BE trả kết
 * quả cũ thay vì cộng lần 2. Đổi khoá mới khi: lần trước thành công, BE đã trả lỗi (có phản hồi =
 * chắc chắn chưa ghi), hoặc nội dung gửi đã khác (sửa số rồi bấm lại là một lần báo mới).
 */
export function useRetrySafeKey() {
  const pending = useRef<{ key: string; payload: string } | null>(null)

  const take = (payload: unknown): string => {
    const p = JSON.stringify(payload)
    if (!pending.current || pending.current.payload !== p) {
      pending.current = { key: newUuid(), payload: p }
    }
    return pending.current.key
  }

  /** Gọi sau mỗi lần gửi: không truyền lỗi = thành công. */
  const settle = (err?: unknown) => {
    const noResponse = err instanceof ApiError && err.statusCode === 0
    if (!noResponse) pending.current = null
  }

  return { take, settle }
}
