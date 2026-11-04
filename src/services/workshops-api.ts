/** Phần A – Đợt 2 (YC12): danh mục xưởng cơ khí (BE module `workshops`, quyền PRODUCTION_INVOICE:VIEW). */
import { http } from './core/http'
import type { Workshop } from '../types/workshop'

/** Xưởng đang dùng, đã xếp theo thứ tự hiển thị (Phú An, Phước An). */
export async function getWorkshops(): Promise<Workshop[]> {
  const res = await http.get<Workshop[] | { data: Workshop[] }>('/workshops')
  return Array.isArray(res) ? res : res.data
}
