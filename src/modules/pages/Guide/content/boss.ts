import type { GuideGroup } from '../types';

// Nguồn: BossApp.tsx, SKUDetail.tsx (chế độ isBoss), LenhSXPage.tsx (chế độ isBoss),
// ThongKePagePlan.tsx, SKUListPage.tsx (readOnly), VatTuDashboardPage.tsx,
// MfgWarehousesPage.tsx (chế độ isAdmin=false) — đọc trực tiếp mã nguồn 22/09/2026.

export const bossGroup: GuideGroup = {
  id: 'boss',
  title: 'Giám đốc',
  icon: 'Crown',
  color: '#1D4ED8',
  bg: '#DBEAFE',
  roles: ['boss'],
  description: 'Duyệt cuối định mức sản phẩm và lệnh sản xuất, theo dõi tiến độ và tồn kho toàn hệ thống.',
  articles: [
    {
      id: 'boss-overview',
      title: 'Tổng quan: Giám đốc chạm vào đâu trong hệ thống',
      roles: ['boss'],
      purpose:
        'Sau đăng nhập, tài khoản Giám đốc (role Giám đốc, không kiêm công đoạn sản xuất) vào thẳng màn hình riêng gồm 6 tab: Tổng hợp chờ duyệt, Tổng hợp lệnh SX, Danh sách SKU, Tổng hợp vật tư, Tổng hợp kho.',
      steps: [
        'Duyệt cuối cùng công thức sản phẩm (SKU/định mức) ở tab "Tổng hợp chờ duyệt".',
        'Duyệt cuối cùng lệnh sản xuất (bấm là xưởng chạy ngay) ở cùng tab "Tổng hợp chờ duyệt".',
        'Xem tiến độ, tồn kho, danh sách kho ở các tab còn lại — thuần tra cứu.',
      ],
      result: 'Nắm quyền kiểm soát 2 cổng duyệt quan trọng nhất hệ thống, đồng thời có cái nhìn tổng thể toàn bộ hoạt động.',
      warnings: [
        'Từ 27/08/2026, Giám đốc KHÔNG còn duyệt báo giá/chọn nhà cung cấp qua phần mềm — việc này thực hiện bằng ký tay trên phiếu giấy/Excel ngoài hệ thống. Phần mềm chỉ giữ lại ảnh/PDF phiếu đã ký làm bằng chứng (Mua hàng tải lên ở màn "Lệnh mua vật tư").',
        'Tài khoản Giám đốc cũng có thể vào các module nghiệp vụ khác (Bán hàng, Sản xuất, Mua hàng, Kho, Kế hoạch SX) với quyền cao nhất — xem các nhóm tương ứng trong sidebar để biết chi tiết thao tác ở đó.',
      ],
      tags: ['tổng quan giám đốc', 'boss app'],
      sourceRefs: ['src/modules/pages/Boss/BossApp.tsx'],
    },
    {
      id: 'boss-duyet-sku',
      title: 'Duyệt định mức sản phẩm (SKU)',
      roles: ['boss'],
      purpose: 'Cổng duyệt cuối cùng cho công thức một sản phẩm, sau khi KHSX đã duyệt xong cả hai nhánh Mảnh và Chi tiết.',
      preconditions: ['SKU đang ở trạng thái "Chờ sếp duyệt".'],
      mock: { title: 'Duyệt SKU (Giám đốc)', buttons: ['Từ chối', 'Duyệt'] },
      steps: [
        'Ở tab "Tổng hợp chờ duyệt" > "SKU mới", chọn 1 SKU — xem gộp cả hai nhánh (Định mức mảnh + Định mức chi tiết) trên cùng một màn.',
        { text: 'Bấm "Duyệt" — xác nhận "Xác nhận duyệt định mức chi tiết và định mức mảnh của SKU này? Sau khi duyệt, SKU sẽ được thêm vào danh sách."', critical: true },
        { text: 'Hoặc bấm "Từ chối" — nhập lý do (không bắt buộc) — xác nhận.', critical: true },
      ],
      result: 'Duyệt: SKU chuyển "Đã duyệt", đủ điều kiện đưa vào đơn hàng/lệnh sản xuất. Từ chối: SKU quay lại cho KHSX duyệt lại từ đầu cả hai nhánh, dữ liệu định mức đã nhập vẫn giữ nguyên.',
      warnings: [
        'Không có tuỳ chọn duyệt riêng từng nhánh ở bước này — chỉ duyệt hoặc từ chối toàn bộ hồ sơ.',
        'Lý do từ chối gần nhất được lưu lại và hiển thị cảnh báo cho cả KHSX lẫn Giám đốc cho tới khi SKU được duyệt xong ở lần kế tiếp.',
      ],
      commonErrors: [
        { issue: '"Không thể duyệt" / "Không thể từ chối"', cause: 'Dữ liệu đã bị người khác xử lý trong lúc bạn đang xem (ví dụ hồ sơ vừa được xử lý ở phiên khác).', fix: 'Bấm nút Làm mới cạnh trạng thái để đồng bộ lại dữ liệu mới nhất rồi thao tác lại.' },
      ],
      statuses: [
        { name: 'Đang làm định mức', meaning: 'SKU vừa tạo hoặc vừa bị Giám đốc từ chối.' },
        { name: 'Chờ sếp duyệt', meaning: 'Cả hai nhánh đã được KHSX xác nhận hoàn tất.' },
        { name: 'Đã duyệt', meaning: 'Định mức chính thức có hiệu lực.' },
      ],
      tags: ['duyệt sku', 'định mức', 'boss approve'],
      sourceRefs: ['src/modules/pages/ProductionPlan/SKUDetail.tsx'],
    },
    {
      id: 'boss-duyet-lenh-sx',
      title: 'Duyệt lệnh sản xuất',
      roles: ['boss'],
      purpose: 'Cổng duyệt quan trọng nhất hệ thống — bấm Duyệt là xưởng bắt đầu sản xuất ngay lập tức, không thể hoàn tác.',
      preconditions: ['QLSX đã chọn kho thành phẩm và trình lệnh sản xuất lên chờ Giám đốc duyệt.'],
      mock: {
        title: 'Duyệt lệnh sản xuất',
        columns: ['SKU', 'Sản phẩm', 'Số lượng', 'Hạn giao'],
        rows: [['GHE-001', 'Ghế ăn mây nhựa', '200', '30/09/2026']],
        buttons: ['Từ chối', 'Duyệt cả đợt (2 SKU)'],
      },
      steps: [
        'Ở tab "Tổng hợp chờ duyệt" > "Lệnh sản xuất", chọn một PI đang chờ duyệt.',
        'Nếu KHSX từng xin cắt đặc cách (chấp nhận hao hụt cao hơn bình thường), xem kỹ khối cảnh báo màu vàng nêu rõ % xin và lý do trước khi quyết định — không sửa được số này, chỉ Duyệt hoặc Từ chối.',
        { text: 'Bấm "Duyệt" / "Duyệt cả đợt (N SKU)" — xác nhận "sẽ tạo lệnh sản xuất ... và bắt đầu sản xuất ngay — không thể hoàn tác."', critical: true },
        { text: 'Hoặc bấm "Từ chối" / "Từ chối cả đợt" — bắt buộc nhập lý do — "sẽ xoá lệnh sản xuất ... và trả SKU về đơn hàng gốc".', critical: true },
      ],
      result: 'Duyệt: lệnh sản xuất chính thức mở tại xưởng, hệ thống tự động chạy tính phương án cắt sắt ngay (badge "Đang tính phương án cắt..." hiện tới khi xong, khoảng 5-15 phút).',
      warnings: [
        'Nếu PI là đợt gộp nhiều SKU, phải Duyệt hoặc Từ chối CẢ CỤM cùng lúc — không duyệt lẻ được từng SKU.',
        'Từ chối = xoá toàn bộ PI, SKU quay lại danh sách "Tối ưu cắt sắt" để KHSX gộp lại từ đầu.',
      ],
      commonErrors: [
        { issue: '"Lỗi duyệt sản xuất" / "Lỗi từ chối sản xuất"', cause: 'Lỗi từ máy chủ, thường do race condition (2 người cùng thao tác) hoặc PI đã bị xử lý.', fix: 'Tải lại trang, kiểm tra trạng thái mới nhất.' },
      ],
      statuses: [
        { name: 'Chờ QLSX xử lý → Chờ Giám đốc duyệt → Đã duyệt', meaning: 'Vòng đời duyệt bình thường của một PI.' },
      ],
      tags: ['duyệt lệnh sản xuất', 'boss approve production'],
      sourceRefs: ['src/modules/pages/ProductionPlan/LenhSXPage.tsx'],
    },
    {
      id: 'boss-tra-cuu',
      title: 'Tra cứu: Tổng hợp lệnh SX, Danh sách SKU, Tổng hợp vật tư, Tổng hợp kho',
      roles: ['boss'],
      purpose: 'Các màn CHỈ XEM giúp Giám đốc theo dõi toàn cảnh hoạt động mà không cần thao tác trực tiếp.',
      screenshot: '/guide-screens/boss-tra-cuu.png',
      steps: [
        '"Tổng hợp lệnh SX": bảng theo dõi tiến độ từng SKU trong từng PI qua mọi công đoạn (Mua hàng, Khung cơ khí, Đan, Chuyền kiểm, Đóng gói).',
        '"Danh sách SKU": tra cứu toàn bộ SKU mọi trạng thái, xem lại chi tiết định mức đã duyệt.',
        '"Tổng hợp vật tư": tra tồn kho thật của mọi vật tư trên toàn hệ thống (gộp mọi kho).',
        '"Tổng hợp kho": xem tổng số kho hiện có và tồn từng kho.',
      ],
      result: 'Có đầy đủ thông tin để giám sát mà không cần hỏi qua các bộ phận khác.',
      warnings: [
        'Đây đều là màn CHỈ XEM — không có nút Bắt đầu/Kết thúc lệnh (chỉ QLSX thấy các nút đó), không có nút Xoá SKU, không có nút Tạo/Xoá kho (chỉ Admin thấy các nút đó).',
      ],
      tags: ['tổng hợp lệnh sx', 'danh sách sku', 'tổng hợp vật tư', 'tổng hợp kho', 'tra cứu'],
      sourceRefs: ['src/modules/pages/Manufacturing/ThongKePagePlan.tsx', 'src/modules/pages/ProductionPlan/SKUListPage.tsx'],
    },
  ],
};
