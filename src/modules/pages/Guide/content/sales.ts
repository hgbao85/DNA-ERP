import type { GuideGroup } from '../types';

// Nguồn: SalesApp.tsx, OrderManagementPage.tsx, CustomerManagementPage.tsx, PurchaseHistoryPage.tsx,
// BE sales-orders.service.ts, customers.service.ts — đọc trực tiếp mã nguồn 22/09/2026.

export const salesGroup: GuideGroup = {
  id: 'sales',
  title: 'Bán hàng',
  icon: 'Users',
  color: '#047857',
  bg: '#D1FAE5',
  roles: ['sales'],
  description: 'Tạo và theo dõi đơn hàng (PO) của khách, quản lý danh mục khách hàng, tra cứu lịch sử mua hàng.',
  articles: [
    {
      id: 'sales-tao-po',
      title: 'Tạo đơn hàng (PO) mới',
      roles: ['sales'],
      purpose: 'Ghi nhận một đơn đặt hàng mới của khách vào hệ thống, làm điểm khởi đầu cho toàn bộ chuỗi sản xuất.',
      preconditions: [
        'Khách hàng đã có trong danh mục (mục "Quản lí khách hàng") — có thể tạo nhanh nếu chưa có.',
        'Sản phẩm (SKU — mã sản phẩm) muốn bán phải đã được Giám đốc duyệt định mức xong — chỉ những SKU này hiện trong danh sách chọn.',
      ],
      screenshot: '/guide-screens/sales-tao-po.png',
      mock: {
        title: 'Tạo PO mới',
        formFields: ['Mã đơn hàng *', 'Khách hàng *', 'Ngày đặt', 'File đính kèm (PO, hợp đồng...)'],
        columns: ['SKU', 'Hạn giao', 'Tổng số'],
        rows: [['GHE-001', '30/09/2026', '200'], ['BAN-014', '05/10/2026', '50']],
        buttons: ['Thêm SKU', 'Hủy', 'Lưu'],
      },
      steps: [
        'Bấm "Tạo PO" ở tab Quản lí đơn hàng.',
        'Nhập Mã đơn hàng (bắt buộc, không được trùng với đơn khác).',
        'Chọn Khách hàng (bắt buộc). Nếu khách đã có sẵn SKU đã duyệt gắn riêng và chưa gắn PO nào, hệ thống tự điền vào bảng SKU bên dưới.',
        'Với mỗi dòng: chọn SKU (chỉ chọn được SKU đã duyệt), nhập Hạn giao và Tổng số lượng. Bấm "Thêm SKU" nếu đơn có nhiều sản phẩm.',
        'Tải lên File đính kèm (PO/hợp đồng...) nếu có.',
        { text: 'Bấm "Lưu" để tạo đơn hàng.', critical: true },
      ],
      result:
        'Đơn hàng được tạo; hệ thống tự sinh hồ sơ lệnh sản xuất tương ứng phía sau cho từng dòng SKU (chưa gộp lệnh sản xuất) — Kế hoạch sản xuất sẽ xử lý tiếp từ đây.',
      warnings: [
        'Nút "Lưu" chỉ bật khi đã nhập Mã đơn hàng, chọn Khách hàng, và ít nhất một dòng SKU đã chọn sản phẩm.',
        'File đính kèm chỉ thực sự tải lên khi bấm "Lưu" thành công — không tạo rác nếu đóng form giữa chừng.',
      ],
      commonErrors: [
        { issue: 'Không tìm thấy sản phẩm cần bán trong danh sách chọn SKU', cause: 'Sản phẩm chưa có định mức được Giám đốc duyệt.', fix: 'Liên hệ KHSX để hoàn tất quy trình duyệt định mức trước.' },
        { issue: '"Mã đơn hàng ... đã được dùng cho đơn khác"', cause: 'Mã đơn hàng bị trùng với một PO đã tồn tại.', fix: 'Đổi sang mã khác chưa dùng.' },
      ],
      tags: ['tạo đơn hàng', 'po', 'sales order', 'đơn đặt hàng'],
      sourceRefs: ['src/modules/pages/Sales/OrderManagementPage.tsx'],
    },
    {
      id: 'sales-theo-doi-po',
      title: 'Theo dõi tiến độ & xác nhận cọc',
      roles: ['sales'],
      purpose: 'Theo dõi tiến độ sản xuất/giao hàng của từng đơn, đánh dấu đã nhận cọc.',
      screenshot: '/guide-screens/sales-theo-doi-po.png',
      mock: {
        title: 'Chi tiết PO — Chi tiết xuất hàng',
        columns: ['SKU', 'Tổng số lượng', 'Đã xuất hàng', 'Còn lại'],
        rows: [['GHE-001', '200', '120', '80']],
        buttons: ['Chi tiết sản xuất', 'Chi tiết xuất hàng'],
      },
      steps: [
        'Ở danh sách đơn hàng, bấm nút pill "Đã xác nhận cọc"/"Chưa xác nhận" trên mỗi dòng để đánh dấu đã nhận cọc.',
        'Mở chi tiết một PO để xem 2 tab: "Chi tiết sản xuất" (dải bước tiến độ: Lên kế hoạch → Mua hàng → Khung cơ khí → Đan → Chuyền kiểm → Đóng gói → Hoàn thành) và "Chi tiết xuất hàng" (Tổng số lượng/Đã xuất/Còn lại từng dòng).',
      ],
      result: 'Nắm được đơn nào đã nhận cọc, đơn nào đang ở giai đoạn nào của sản xuất.',
      warnings: [
        'Dải tiến độ sản xuất là màn CHỈ XEM — Kinh doanh không có nút tự đổi trạng thái này, trạng thái do các bộ phận sản xuất/mua hàng cập nhật và KHÔNG tự động đồng bộ theo thời gian thực, có thể có độ trễ so với thực tế xưởng.',
        'Mục "Đã thanh toán (trừ cọc)" và "Số tiền còn lại" hiện luôn hiển thị 0đ — đây là tính năng theo dõi công nợ CHƯA được hoàn thiện trong hệ thống, không phải lỗi hiển thị. Việc theo dõi tiền hiện chỉ dừng ở mức đã/chưa nhận cọc.',
      ],
      tags: ['tiến độ', 'cọc', 'xác nhận cọc', 'trạng thái đơn hàng'],
      sourceRefs: ['src/modules/pages/Sales/OrderManagementPage.tsx'],
    },
    {
      id: 'sales-xoa-po',
      title: 'Xoá đơn hàng',
      roles: ['sales'],
      purpose: 'Xoá một đơn hàng nhập sai hoặc không còn hiệu lực.',
      preconditions: [
        'Đơn hàng chưa được KHSX gộp vào một Phiếu sản xuất (PI).',
        'Đơn hàng chưa giao hàng dù chỉ một phần (số đã xuất phải bằng 0 ở mọi dòng).',
      ],
      screenshot: '/guide-screens/sales-xoa-po.png',
      mock: { title: 'Chi tiết PO', buttons: ['Xoá đơn hàng'] },
      steps: [
        'Mở chi tiết đơn hàng, bấm "Xoá đơn hàng".',
        { text: 'Xác nhận trong hộp thoại "Xoá đơn hàng ... — Hành động này không thể hoàn tác."', critical: true },
      ],
      result: 'Đơn hàng và toàn bộ hồ sơ sản xuất liên quan (chưa gộp lệnh sản xuất) bị xoá vĩnh viễn, không phục hồi được.',
      warnings: ['Đây là xoá cứng (hard delete), không phải chuyển vào thùng rác — không có chức năng khôi phục.'],
      commonErrors: [
        { issue: 'Nút "Xoá đơn hàng" bị mờ/khoá, có tooltip giải thích', cause: 'Đơn đã được KHSX gộp vào Phiếu sản xuất (nhà máy có thể đang sản xuất theo đơn này), hoặc đã giao hàng một phần cho một dòng SKU.', fix: 'Không xoá được nữa trong các trường hợp này — liên hệ KHSX/Admin nếu thực sự cần xử lý.' },
      ],
      tags: ['xoá đơn hàng', 'delete order'],
      sourceRefs: ['src/modules/pages/Sales/OrderManagementPage.tsx', 'DNA-ERP-BE/src/modules/sales-orders/sales-orders.service.ts'],
    },
    {
      id: 'sales-khach-hang',
      title: 'Quản lý danh mục khách hàng',
      roles: ['sales'],
      purpose: 'Thêm, sửa, xoá thông tin khách hàng dùng khi tạo đơn hàng.',
      screenshot: '/guide-screens/sales-khach-hang.png',
      mock: {
        title: 'Thêm khách hàng',
        formFields: ['Mã khách hàng *', 'Số điện thoại *', 'Email', 'Địa chỉ', 'Ghi chú'],
        buttons: ['Hủy', 'Lưu'],
      },
      steps: [
        'Bấm "Thêm khách hàng", nhập Mã khách hàng và Số điện thoại (bắt buộc), Email/Địa chỉ/Ghi chú (tuỳ chọn), bấm "Lưu".',
        'Bấm icon bút chì trên một dòng để sửa thông tin.',
        { text: 'Bấm icon thùng rác để xoá khách hàng — xác nhận qua hộp thoại "Xóa khách hàng này?".', critical: true },
      ],
      result: 'Danh mục khách hàng được cập nhật, dùng ngay khi tạo đơn hàng mới.',
      warnings: [
        'Xoá khách hàng KHÔNG bị chặn dù khách đó đang có đơn hàng liên kết — hệ thống không cảnh báo gì thêm ngoài hộp thoại xác nhận chung. Cân nhắc kỹ trước khi xoá một khách hàng đã từng có đơn hàng.',
      ],
      commonErrors: [
        { issue: 'Nút "Lưu" không bấm được khi thêm/sửa khách hàng', cause: 'Chưa nhập Mã khách hàng hoặc Số điện thoại — hai trường này bắt buộc.', fix: 'Điền đầy đủ 2 trường bắt buộc rồi thử lại.' },
      ],
      tags: ['khách hàng', 'customer'],
      sourceRefs: ['src/modules/pages/Sales/CustomerManagementPage.tsx'],
    },
    {
      id: 'sales-lich-su-mua',
      title: 'Tra cứu lịch sử mua hàng của khách',
      roles: ['sales'],
      purpose: 'Xem lại toàn bộ đơn hàng và tình trạng xuất hàng của một khách hàng cụ thể.',
      screenshot: '/guide-screens/sales-lich-su-mua.png',
      mock: {
        title: 'Lịch sử mua hàng',
        columns: ['PO', 'Ngày đặt', 'SKU', 'Tổng số', 'Đã xuất', 'Còn lại', 'Trạng thái'],
        rows: [['GHE-001', '15/08/2026', 'GHE-001', '200', '120', '80', 'Đang sản xuất']],
      },
      steps: [
        'Chọn một khách hàng từ danh sách thả xuống.',
        'Xem thông tin khách và bảng chi tiết từng dòng SKU của mọi đơn hàng: PO, ngày đặt, SKU, tổng số, đã xuất, còn lại, trạng thái.',
      ],
      result: 'Có cái nhìn tổng hợp lịch sử mua hàng của một khách hàng để tư vấn/chăm sóc.',
      tags: ['lịch sử mua hàng', 'tra cứu khách hàng'],
      sourceRefs: ['src/modules/pages/Sales/PurchaseHistoryPage.tsx'],
    },
  ],
};
