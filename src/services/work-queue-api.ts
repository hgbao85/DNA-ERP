/**
 * Adapter WORK QUEUE: FE ⇄ BE thật (module `work-queue`, endpoint `GET /me/work-queue`).
 * Badge "việc chờ tôi" trên menu (changelog notification 2026-09-25 mục 6.3, Phase 4 - mục 27).
 * `counts` là map PHẲNG, chỉ chứa khoá khớp đúng role của người gọi (BE tự lọc, xem doc comment
 * WorkQueueService.getWorkQueue() bên BE) - đọc field không tồn tại thì coi như 0/ẩn badge, không
 * phải lỗi.
 */
import { http } from './core/http';

export interface WorkQueueResponse {
  counts: Record<string, number>;
}

export async function getWorkQueue(): Promise<WorkQueueResponse> {
  return http.get('/me/work-queue');
}
