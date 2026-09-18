/**
 * Type dùng chung cho "cần kiểm"/"chờ thực thi" theo mảnh ở dashboard tổng hợp KHSX
 * (ThongKePagePlan.tsx). Dữ liệu thật dựng qua buildChuyenKiem(transferCheckPieces) từ
 * BeTransferCheckPiece (transfer-check-api.ts) — các hàm sinh dữ liệu giả (mockPieces/
 * mockTotalQty) từng ở đây đã bị xoá 2026-09-18 vì không còn nơi nào gọi.
 */

export interface MockPiece {
  id: string
  name: string
  totalQty: number
  choThucThi: number
}
