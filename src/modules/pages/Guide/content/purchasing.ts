import type { GuideGroup } from '../types';

// Nguồn: LenhMuaNCCPage.tsx, TheoDoiMuaHangPage.tsx, LichSuMuaHangPage.tsx, PurchasingApp.tsx,
// BE purchase-proposals.service.ts — đọc trực tiếp mã nguồn 22/09/2026.
// Lưu ý: luồng "báo giá nhiều nhà cung cấp, Giám đốc so sánh chọn" đã bị GỠ BỎ từ 27/08/2026.
// Từ nay Giám đốc ký duyệt TAY trên giấy/Excel ngoài hệ thống; phần mềm chỉ lưu ảnh/PDF phiếu
// đã ký làm bằng chứng, không còn lưu giá hay nhà cung cấp nào trong hệ thống.

export const purchasingGroup: GuideGroup = {
  id: 'purchasing',
  title: 'Mua hàng',
  icon: 'ShoppingCart',
  color: '#6D28D9',
  bg: '#EDE9FE',
  roles: ['purchasing', 'boss'],
  description: 'Xử lý đề xuất mua vật tư tự động sinh ra khi thiếu vật tư cho sản xuất, xin Giám đốc ký duyệt tay, theo dõi hàng về.',
  articles: [
    {
      id: 'purchasing-overview',
      title: 'Tổng quan quy trình mua hàng (từ 27/08/2026)',
      roles: ['purchasing', 'boss'],
      purpose:
        'Khi hệ thống tính thiếu vật tư cho sản xuất, một đề xuất mua tự động sinh ra. Nhân viên Mua hàng dùng đề xuất này làm phiếu so sánh giá, đưa Giám đốc ký duyệt NGOÀI hệ thống (giấy/Excel), rồi tải ảnh/PDF phiếu đã ký lên phần mềm để Kho được phép nhận hàng.',
      steps: [
        'Đề xuất mua tự động xuất hiện ở tab "Lệnh mua vật tư" — chưa cần Mua hàng làm gì để tạo ra nó.',
        'Mua hàng liên hệ nhà cung cấp, chuẩn bị phiếu so sánh giá NGOÀI hệ thống, trình Giám đốc ký tay.',
        'Mua hàng bấm "Sếp đã duyệt", tải lên ảnh/PDF/Excel phiếu đã ký làm bằng chứng.',
        'Đề xuất chuyển sang tab "Theo dõi mua hàng" — chờ Kho xác nhận nhận hàng ở màn Nhập kho.',
        'Khi Kho đã nhận đủ toàn bộ số lượng, đề xuất tự chuyển sang tab "Lịch sử đã mua".',
      ],
      result: 'Vật tư còn thiếu được mua về đúng theo số lượng đề xuất, có bằng chứng chữ ký Giám đốc lưu lại trong hệ thống.',
      warnings: [
        'Phần mềm KHÔNG còn lưu giá cả hay nhà cung cấp nào — toàn bộ nằm trong file Excel/giấy Giám đốc ký tay bên ngoài. Nút "Sếp đã duyệt" chỉ ghi nhận việc đã xin chữ ký, không phải nút tự duyệt giá trong hệ thống.',
        'Một đề xuất mua có thể gộp nhiều dòng vật tư do nhiều nhân viên Mua hàng khác nhau phụ trách (theo người mua gán sẵn cho từng vật tư ở Admin > Vật tư) — mỗi người chỉ thấy và thao tác đúng phần vật tư mình phụ trách, phần của đồng nghiệp chỉ hiện để tham khảo.',
      ],
      statuses: [
        { name: 'Chờ Sếp duyệt', meaning: 'Mới sinh từ đề xuất cắt/thiếu vật tư, chưa xử lý — hiện ở tab "Lệnh mua vật tư".' },
        { name: 'Đang mua hàng', meaning: 'Đã bấm "Sếp đã duyệt" kèm file ký tay — chờ Kho xác nhận nhận hàng, hiện ở "Theo dõi mua hàng".' },
        { name: 'Đã mua', meaning: 'Kho đã xác nhận nhận đủ số lượng — hiện ở "Lịch sử đã mua".' },
      ],
      tags: ['mua hàng', 'purchase proposal', 'ncc', 'nhà cung cấp', 'báo giá'],
      sourceRefs: ['src/modules/pages/Purchasing/PurchasingApp.tsx', 'DNA-ERP-BE/src/modules/purchase-proposals/purchase-proposals.service.ts'],
    },
    {
      id: 'purchasing-lenh-mua-ncc',
      title: 'Tab "Lệnh mua vật tư" — xin Giám đốc duyệt',
      roles: ['purchasing'],
      purpose: 'Xử lý các đề xuất mua vật tư đang chờ, xin chữ ký Giám đốc và tải bằng chứng lên hệ thống.',
      preconditions: [
        'Vật tư cần mua đã được Admin gán sẵn "người mua phụ trách" — chỉ thấy đề xuất có dòng vật tư mình phụ trách.',
        'Đã chuẩn bị xong phiếu so sánh giá và có chữ ký Giám đốc (thực hiện ngoài phần mềm).',
      ],
      screenshot: '/guide-screens/purchasing-lenh-mua-ncc.png',
      mock: {
        title: 'Lệnh mua vật tư — chi tiết đề xuất',
        columns: ['Hàng về kho', 'Vật tư', 'Quy cách', 'Chiều dài', 'Tồn thực', 'Cần mua', 'ĐVT'],
        rows: [['Kho Phôi Sơn Hàn', 'Sắt hộp 20x20 · cây 6000mm', '120', '480', 'cây'], ['Kho Vật tư TP', 'Sơn xám RAL7035', '5', '40', 'lít']],
        buttons: ['Sếp đã duyệt'],
      },
      steps: [
        'Chọn 1 đề xuất trong danh sách (cột PO/PI/Mã nhà máy/Deadline/Trạng thái) để mở chi tiết.',
        'Xem bảng "Chờ Sếp duyệt": Hàng về kho, Vật tư, Quy cách, Chiều dài (chiều dài cây, chỉ vật tư sắt), Tồn thực, Cần mua, ĐVT.',
        { text: 'Bấm "Sếp đã duyệt" → chọn 1 file ảnh/PDF/Excel phiếu đã ký (tối đa 10MB) → bấm "Xác nhận".', critical: true },
      ],
      result: 'Các dòng vật tư của bạn trong đề xuất này chuyển sang "Đang mua hàng"; đề xuất chuyển sang tab "Theo dõi mua hàng".',
      warnings: [
        'File chỉ thực sự được tải lên khi bấm "Xác nhận" — đóng popup giữa chừng sẽ không tạo rác trên hệ thống lưu trữ, nhưng cũng không lưu lại gì.',
        'Nếu đề xuất có vật tư của đồng nghiệp khác phụ trách, phần đó chỉ hiển thị để xem, không thao tác được.',
      ],
      commonErrors: [
        { issue: 'File vượt quá 10MB, không chọn được', cause: 'Giới hạn dung lượng file đính kèm.', fix: 'Nén ảnh/PDF hoặc chụp lại ở độ phân giải thấp hơn trước khi tải lên.' },
        { issue: '"Không có vật tư nào của bạn đang chờ duyệt trong đề xuất này"', cause: 'Mọi dòng vật tư bạn phụ trách trong đề xuất đã được duyệt trước đó rồi (bấm trễ hoặc bấm 2 lần).', fix: 'Tải lại trang — đề xuất có thể đã chuyển sang tab "Theo dõi mua hàng".' },
        { issue: '"Một số vật tư vừa bị thay đổi trạng thái bởi thao tác khác - tải lại trang..."', cause: 'Một người khác (hoặc chính bạn ở tab khác) vừa duyệt cùng lúc.', fix: 'Tải lại trang để xem tình trạng mới nhất trước khi thao tác lại.' },
        { issue: '"Bạn không được phân công mua vật tư nào trong đề xuất này - liên hệ Admin nếu cần hỗ trợ"', cause: 'Bạn không phải người mua được gán cho bất kỳ dòng vật tư nào trong đề xuất.', fix: 'Liên hệ Admin để kiểm tra/gán lại người phụ trách vật tư đó.' },
      ],
      tags: ['sếp đã duyệt', 'ký duyệt', 'boss approve'],
      sourceRefs: ['src/modules/pages/Purchasing/LenhMuaNCCPage.tsx'],
    },
    {
      id: 'purchasing-theo-doi',
      title: 'Tab "Theo dõi mua hàng"',
      roles: ['purchasing'],
      purpose: 'Theo dõi các lệnh mua đã được Giám đốc duyệt, đang chờ hàng về. Việc nhận hàng thực hiện ở màn Nhập kho (module Kho), không phải ở đây.',
      screenshot: '/guide-screens/purchasing-theo-doi.png',
      mock: {
        title: 'Theo dõi mua hàng',
        columns: ['PO', 'Vật tư', 'Quy cách', 'Chiều dài', 'Tổng SL', 'Đã mua', 'Còn lại', 'Hạn giao'],
        rows: [['PO-2026-014', 'Sắt hộp 20x20', '480', '300', '180', '05/10/2026']],
      },
      steps: [
        'Chọn 1 đề xuất để xem chi tiết: PO, tên vật tư, tổng số lượng, Đã mua (luỹ kế Kho đã xác nhận), Còn lại, hạn giao, phiếu duyệt.',
        { text: 'Nếu cần sửa/xoá lại file phiếu đã ký: dùng ô "Phiếu duyệt" — "Tải file"/"Đổi file" hoặc "Xóa".', critical: false },
      ],
      result: 'Nắm được lệnh mua nào đang chờ hàng về và còn thiếu bao nhiêu.',
      warnings: [
        'Chỉ chính người đã bấm "Sếp đã duyệt" (hoặc Admin/Giám đốc) mới sửa/xoá được file phiếu duyệt của dòng đó.',
        'Xoá file phiếu duyệt CHỈ mất bằng chứng lịch sử — không đổi trạng thái, không chặn Kho nhận hàng.',
      ],
      commonErrors: [
        { issue: 'Không sửa/xoá được file phiếu duyệt của một dòng', cause: 'Bạn không phải người đã duyệt dòng đó và cũng không phải Admin/Giám đốc.', fix: 'Nhờ đúng người đã duyệt, hoặc Admin/Giám đốc, thực hiện thay.' },
        { issue: 'Xoá file phiếu duyệt xong vẫn không huỷ được lệnh mua', cause: 'Đây là hành vi đúng thiết kế — xoá file chỉ mất bằng chứng, không ảnh hưởng trạng thái mua hàng.', fix: 'Không cần xử lý gì thêm; nếu muốn huỷ hẳn lệnh mua, liên hệ Admin/KHSX.' },
      ],
      tags: ['theo dõi', 'đang mua', 'hàng về'],
      sourceRefs: ['src/modules/pages/Purchasing/TheoDoiMuaHangPage.tsx'],
    },
    {
      id: 'purchasing-lich-su',
      title: 'Tab "Lịch sử đã mua"',
      roles: ['purchasing'],
      purpose: 'Tra cứu các lệnh mua đã nhận đủ hàng, dùng làm lịch sử tham khảo.',
      screenshot: '/guide-screens/purchasing-lich-su.png',
      mock: {
        title: 'Lịch sử đã mua',
        columns: ['PO', 'Vật tư', 'Quy cách', 'Chiều dài', 'Đã mua', 'ĐVT', 'Hàng về kho'],
        rows: [['PO-2026-009', 'Sơn xám RAL7035', '40', 'lít', 'Kho Vật tư TP']],
      },
      steps: [
        'Chọn 1 dòng lịch sử để xem chi tiết: vật tư, số đã mua, ĐVT, hàng về kho nào, phiếu duyệt.',
      ],
      result: 'Xem lại được toàn bộ lệnh mua đã hoàn tất, kèm ngày giờ nhận đủ hàng.',
      tags: ['lịch sử', 'đã mua', 'hoàn tất'],
      sourceRefs: ['src/modules/pages/Purchasing/LichSuMuaHangPage.tsx'],
    },
  ],
};
