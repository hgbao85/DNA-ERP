import { useState } from 'react'
import { ApiError } from '../services/core/apiError'
import { newUuid } from '../services/core/uuid'

/**
 * Idempotency-Key cho các nút "Lưu" báo sản lượng xưởng (2026-10-12, phần nền trước QR - xem
 * changelog-2026-10-08-ke-hoach-tem-qr-bo-sat-phoi.md mục 21 bên BE).
 *
 * GIỮ NGUYÊN khoá khi lần bấm trước KHÔNG có phản hồi từ máy chủ (mất mạng, quá thời gian chờ -
 * ApiError.statusCode 0): request có thể đã tới BE và được cộng, bấm lại với CÙNG khoá thì BE trả kết
 * quả cũ thay vì cộng lần 2. Cũng giữ khi BE báo "lần gửi trước đang xử lý" (409 IdempotencyKeyInUseException) và khi
 * gặp lỗi máy chủ 5xx (21/11, xem keepsRetryKey). Đổi khoá mới khi: lần trước thành công, BE trả lỗi nghiệp vụ 4xx
 * (chắc chắn chưa ghi, kể cả 422 khoá đã dùng cho việc khác), hoặc nội dung gửi đã khác (sửa số rồi bấm lại là một lần
 * báo mới).
 */
export function useRetrySafeKey() {
  const [core] = useState(createRetrySafeKey)
  return core
}

/**
 * 20/11/2026 (IDEM-0 / T4-4): có giữ khoá để bấm lại không. Giữ khi (a) không có phản hồi (statusCode 0), (b) BE báo
 * lần gửi trước còn đang xử lý: 409 với error === 'IdempotencyKeyInUseException', hoặc (c) lỗi máy chủ 5xx.
 * (c) thêm 21/11 (review bản chuyển kho, F-03): proxy Render trả 502 / 503 / 504 khi BE khởi động lại hoặc quá giờ chờ,
 * trong lúc BE có thể đã ghi xong - có phản hồi KHÔNG có nghĩa là chưa ghi. Giữ khoá là an toàn: BE ghi khoá cùng
 * transaction với thao tác, chưa ghi thì lần sau chạy như mới, đã ghi thì trả lại kết quả cũ. Mọi 4xx khác (409
 * 'ConflictException', 422 khoá đã dùng cho việc khác, 400 ...) vẫn đổi khoá mới.
 */
export function keepsRetryKey(err: unknown): boolean {
  if (!(err instanceof ApiError)) return false
  if (err.statusCode === 0 || err.statusCode >= 500) return true
  return err.statusCode === 409 && err.error === 'IdempotencyKeyInUseException'
}

export interface RetrySafeKey {
  take: (payload: unknown) => string
  settle: (err?: unknown) => void
}

/** Lõi không dùng React (để test được); hook ở trên chỉ bọc lõi này bằng useState. */
export function createRetrySafeKey(): RetrySafeKey {
  let pending: { key: string; payload: string } | null = null

  const take = (payload: unknown): string => {
    const p = JSON.stringify(payload)
    if (!pending || pending.payload !== p) {
      pending = { key: newUuid(), payload: p }
    }
    return pending.key
  }

  /** Gọi sau mỗi lần gửi: không truyền lỗi = thành công. */
  const settle = (err?: unknown) => {
    if (!keepsRetryKey(err)) pending = null
  }

  return { take, settle }
}
