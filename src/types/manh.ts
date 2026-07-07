// Mảnh (piece) theo PO — 1 PI (Lệnh sản xuất) có thể có nhiều PO, mỗi PO có nhiều mảnh cần
// gia công tại kho phôi sơn hàn rồi luân chuyển qua "xuất đan" (vật tư thành phẩm → điểm đan)
// và "nhập đan" (điểm đan → kho thành phẩm).
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
  totalQty: number       // tổng cần cho cả PO
  tonThuc: number        // tồn thực tại kho vật tư thành phẩm, CHƯA xuất đan — giảm dần mỗi lần xuất
  allocations: ManhAllocation[]
}

export interface ManhOrder {
  id: number
  poCode: string
  piCode: string
  skuCode: string
  skuName: string
  lines: ManhLine[]
}
