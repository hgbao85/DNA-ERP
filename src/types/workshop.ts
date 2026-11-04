/**
 * Phần A – Đợt 2 (YC12): xưởng cơ khí. HỢP ĐỒNG với BE `GET /workshops` (module `workshops`) và khối `workshop` trong dòng
 * lệnh SX (`/production-invoices`). Đổi 2 bên cùng lúc.
 */
export type WorkshopCapacityMode = 'CONT_PER_DAY' | 'DAYS_PER_CONT'

/** Khối gọn gắn trên dòng SKU của lệnh SX (null = chưa chọn xưởng). */
export interface WorkshopRef {
  id: string
  code: string
  name: string
}

/** 1 dòng của `GET /workshops` (chỉ xưởng đang dùng, theo sortOrder). */
export interface Workshop extends WorkshopRef {
  capacityMode: WorkshopCapacityMode
  /** Xưởng làm công đoạn Sơn cho xưởng này (Phước An -> Phú An); null = tự sơn. */
  paintWorkshopId: string | null
  sortOrder: number
}
