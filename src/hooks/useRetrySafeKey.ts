import { useState } from 'react'
import { ApiError } from '../services/core/apiError'
import { newUuid } from '../services/core/uuid'

/**
 * Idempotency-Key cho các nút "Lưu" báo sản lượng xưởng (2026-10-12, phần nền trước QR - xem
 * changelog-2026-10-08-ke-hoach-tem-qr-bo-sat-phoi.md mục 21 bên BE).
 *
 * GIỮ NGUYÊN khoá khi lần bấm trước KHÔNG có phản hồi từ máy chủ (mất mạng, quá thời gian chờ -
 * ApiError.statusCode 0): request có thể đã tới BE và được cộng, bấm lại với CÙNG khoá thì BE trả kết
 * quả cũ thay vì cộng lần 2. Cũng giữ khi BE báo "lần gửi trước đang xử lý" (409 IdempotencyKeyInUseException).
 * Đổi khoá mới khi: lần trước thành công, BE đã trả lỗi khác (có phản hồi = chắc chắn chưa ghi, kể cả 422 khoá đã dùng
 * cho việc khác), hoặc nội dung gửi đã khác (sửa số rồi bấm lại là một lần báo mới).
 */
export function useRetrySafeKey() {
  const [core] = useState(createRetrySafeKey)
  return core
}

/**
 * 20/11/2026 (IDEM-0 / T4-4): có giữ khoá để bấm lại không. Chỉ giữ khi (a) không có phản hồi (statusCode 0), hoặc
 * (b) BE báo lần gửi trước còn đang xử lý: 409 với error === 'IdempotencyKeyInUseException'. Mọi 409 khác
 * ('ConflictException'), 422 (khoá đã dùng cho việc khác), 400 ... đều đổi khoá mới.
 */
export function keepsRetryKey(err: unknown): boolean {
  if (!(err instanceof ApiError)) return false
  return err.statusCode === 0 || (err.statusCode === 409 && err.error === 'IdempotencyKeyInUseException')
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
