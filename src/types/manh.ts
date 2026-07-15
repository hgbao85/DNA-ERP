// Mảnh (piece) theo PO — PO là cấp lớn nhất, 1 PO có thể có NHIỀU SKU, mỗi SKU ứng với 1 mã PI
// riêng (không dùng chung PI giữa các SKU trong cùng 1 PO). Mỗi SKU có nhiều dòng mảnh cần gia
// công tại kho phôi sơn hàn rồi luân chuyển qua "xuất đan" (vật tư thành phẩm → điểm đan) và
// "nhập đan" (điểm đan → kho thành phẩm).
//
// 1 mảnh có thể được xuất cho NHIỀU điểm đan khác nhau (ví dụ 20 cái cho điểm đan A, 10 cái cho
// điểm đan B) — nên xuất/nhập không phải 1 cặp số luỹ kế duy nhất trên ManhLine, mà là 1 danh sách
// ManhAllocation, mỗi phần tử ứng với 1 điểm đan. xuatQty/nhapQty tổng của cả dòng mảnh = tổng
// theo tất cả các điểm đan cộng lại (tính ở nơi hiển thị, không lưu trực tiếp).

export interface ManhAllocation {
  id: number
  weavingPointId: number
  xuatQty: number   // luỹ kế đã xuất cho điểm đan này
  nhapQty: number   // luỹ kế đã nhập về từ điểm đan này, <= xuatQty
}

export interface ManhLine {
  id: number
  name: string
  unit: string
  totalQty: number       // tổng cần cho cả SKU
  tonThuc: number        // tồn thực tại kho vật tư thành phẩm, CHƯA xuất đan — giảm dần mỗi lần xuất
  allocations: ManhAllocation[]
}

// 1 SKU trong 1 PO, ứng với đúng 1 mã PI riêng của nó.
export interface ManhSkuGroup {
  id: number
  piCode: string
  skuCode: string
  skuName: string
  quantity: number // số lượng SKU (thành phẩm) đặt hàng, vd 50 cái ghế — khác totalQty của từng ManhLine (số mảnh)
  lines: ManhLine[]
}

export interface ManhOrder {
  id: number
  poCode: string
  skus: ManhSkuGroup[]
}
