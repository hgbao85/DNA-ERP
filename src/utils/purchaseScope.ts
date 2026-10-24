/**
 * "Bảng thống kê": đề xuất mua hàng gộp theo PI, nhưng dây/nệm là lựa chọn RIÊNG từng dòng đơn (2026-10-23).
 * Mỗi SKU chỉ thấy dây/nệm của loại mình chọn; mọi vật tư còn lại (sắt, đinh, ...) vẫn là số mua CHUNG cả PI
 * - đúng với những gì người mua hàng thật sự đặt - nên được đánh dấu `sharedPi` để giao diện ghi chú.
 */
export interface PurchaseScopeLine {
  /** Material.id - thiếu thì coi là vật tư dùng chung. */
  materialId?: string
  /** true = mua chung cho cả PI (nhiều SKU): số lượng là tổng của mọi SKU trong PI, không phải riêng SKU đang xem. */
  sharedPi?: boolean
}

/**
 * @param piRows     toàn bộ dòng đề xuất mua của PI
 * @param ownIds     id dây/nệm mà dòng/SKU này đã chọn
 * @param siblingIds id dây/nệm đã chọn của TỪNG dòng/SKU khác trong cùng PI (mảng rỗng = PI chỉ có 1 SKU)
 */
export function scopePurchasingRows<T extends PurchaseScopeLine>(
  piRows: T[],
  ownIds: string[],
  siblingIds: string[][],
): (T & { sharedPi?: boolean })[] {
  const own = new Set(ownIds)
  const siblings = new Set(siblingIds.flat())
  const multiSku = siblingIds.length > 0
  return piRows.flatMap(m => {
    const id = m.materialId
    if (id && own.has(id)) {
      // Loại này do dòng khác cũng chọn thì số lượng là cộng dồn của cả hai -> vẫn là mua chung.
      return [{ ...m, sharedPi: multiSku && siblings.has(id) }]
    }
    if (id && siblings.has(id)) return [] // chỉ dòng khác dùng loại này - ẩn khỏi SKU này
    return [{ ...m, sharedPi: multiSku }]
  })
}
