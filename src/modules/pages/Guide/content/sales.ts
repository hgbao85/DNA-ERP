import type { GuideGroup } from '../types';

// Nguồn: SalesApp.tsx, OrderManagementPage.tsx, CustomerManagementPage.tsx, PurchaseHistoryPage.tsx,
// BE sales-orders.service.ts, customers.service.ts — đọc trực tiếp mã nguồn 22/09/2026, đối chiếu lại 12/10/2026.

export const salesGroup: GuideGroup = {
  id: 'sales',
  title: 'Bán hàng',
  icon: 'Users',
  color: 'var(--fg-047857)',
  bg: 'var(--bg-d1fae5)',
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
        formFields: ['Mã đơn hàng *', 'Khách hàng *', 'Ngày đặt', 'File đính kèm (PO, hợp đồng...)', 'Ghi chú'],
        columns: ['SKU', 'Hạn giao *', 'Tổng số *'],
        rows: [['GHE-001', '30/09/2026', '200'], ['BAN-014', '05/10/2026', '50']],
        buttons: ['Thêm SKU', 'Hủy', 'Lưu'],
      },
      steps: [
        'Bấm "Tạo PO" ở tab Quản lí đơn hàng.',
        'Nhập Mã đơn hàng (bắt buộc, không được trùng với đơn khác).',
        'Chọn Khách hàng (bắt buộc). Nếu khách đã có sẵn SKU đã duyệt gắn riêng và chưa gắn PO nào, hệ thống tự điền vào bảng SKU bên dưới.',
        'Với mỗi dòng: chọn SKU (chỉ chọn được SKU đã duyệt; danh sách hiện kèm tên khách hàng vì hai khách có thể trùng mã SKU — chọn đúng dòng của khách mình), nhập Hạn giao và Tổng số — cả hai đều BẮT BUỘC cho từng dòng. Bấm "Thêm SKU" nếu đơn có nhiều sản phẩm.',
        'Nếu SKU có nhiều màu dây hoặc màu nệm (do chuyên viên định mức đã tick), ngay dưới dòng SKU hiện thêm hai ô bắt buộc "Màu dây" và "Màu nệm": chọn đúng màu khách đặt (danh sách có ảnh mẫu; bấm vào ảnh nhỏ bên cạnh để xem lớn). SKU chỉ có một màu thì hệ thống chọn sẵn; SKU không có màu nào để chọn thì hai ô này không hiện. Muốn hai màu khác nhau của cùng một SKU thì bấm "Thêm SKU" thêm một dòng.',
        'Tải lên File đính kèm (PO/hợp đồng...) và nhập Ghi chú nếu có.',
        { text: 'Bấm "Lưu" để tạo đơn hàng.', critical: true },
      ],
      result:
        'Đơn hàng được tạo; hệ thống tự sinh hồ sơ lệnh sản xuất tương ứng phía sau cho từng dòng SKU (chưa gộp lệnh sản xuất) — Kế hoạch sản xuất sẽ xử lý tiếp từ đây.',
      warnings: [
        'Nút "Lưu" chỉ bật khi đã nhập Mã đơn hàng, chọn Khách hàng, có ít nhất một dòng SKU, và MỌI dòng SKU đều có Hạn giao + Tổng số lớn hơn 0 — thiếu thì ngay dưới bảng SKU có dòng nhắc "Nhập Hạn giao ... cho mọi dòng SKU thì mới lưu được". Dòng SKU có hiện ô "Màu dây"/"Màu nệm" thì phải chọn đủ các ô đó nữa, nếu không dưới bảng có dòng nhắc "chọn đủ Màu dây và Màu nệm cho từng dòng".',
        'Màu dây và màu nệm chọn xong đi theo xuống lệnh sản xuất và được CHỐT khi Giám đốc duyệt lệnh — mua hàng và xuất đan chỉ tính đúng màu này. Giao diện hiện chưa có chỗ sửa màu của một đơn đã tạo: chọn nhầm thì xoá đơn (nếu còn xoá được, xem bài "Xoá đơn hàng") rồi tạo lại.',
        'Hạn giao nhập theo TỪNG dòng SKU của TỪNG đơn và được chép xuống lệnh sản xuất của đúng đơn đó (hai đơn cùng đặt một mẫu vẫn có hạn riêng). Cột "Hạn giao" của cả đơn = hạn xa nhất trong các dòng.',
        'File đính kèm chỉ thực sự tải lên khi bấm "Lưu" thành công — không tạo rác nếu đóng form giữa chừng.',
      ],
      commonErrors: [
        { issue: 'Không tìm thấy sản phẩm cần bán trong danh sách chọn SKU', cause: 'Sản phẩm chưa có định mức được Giám đốc duyệt.', fix: 'Liên hệ KHSX để hoàn tất quy trình duyệt định mức trước.' },
        { issue: '"Hạn giao của từng dòng SKU là bắt buộc"', cause: 'Có dòng SKU chưa nhập Hạn giao.', fix: 'Nhập Hạn giao cho mọi dòng SKU rồi lưu lại.' },
        { issue: 'Nút "Lưu" mờ, dưới bảng SKU có dòng "SKU có nhiều màu dây/nệm - chọn đủ Màu dây và Màu nệm cho từng dòng thì mới lưu được"', cause: 'Có dòng SKU chưa chọn Màu dây hoặc Màu nệm.', fix: 'Chọn đủ hai ô cho mọi dòng SKU đang hiện chúng. Xem thêm bài "Màu dây & màu nệm theo từng dòng đơn".' },
        { issue: '"Mã đơn hàng ... đã được dùng cho đơn khác"', cause: 'Mã đơn hàng bị trùng với một PO đã tồn tại.', fix: 'Đổi sang mã khác chưa dùng.' },
      ],
      tags: ['tạo đơn hàng', 'po', 'sales order', 'đơn đặt hàng', 'hạn giao', 'deadline', 'màu dây', 'màu nệm', 'loại dây', 'loại nệm', 'sht', 'chọn màu'],
      sourceRefs: ['src/modules/pages/Sales/OrderManagementPage.tsx'],
    },
    {
      id: 'sales-theo-doi-po',
      title: 'Theo dõi tiến độ & xác nhận cọc',
      roles: ['sales'],
      purpose: 'Theo dõi tiến độ sản xuất/giao hàng của từng đơn, đánh dấu đã nhận cọc.',
      screenshot: '/guide-screens/sales-theo-doi-po.png',
      mock: {
        title: 'Quản lí đơn hàng',
        columns: ['PO', 'Khách hàng', 'SKU', 'Số lượng', 'Hạn giao', 'Trạng thái', 'Xác nhận cọc'],
        rows: [['PO-2026-014', 'Công ty ABC', '2 SKU', '250', '30/09/2026', '1 xong · 1 chưa xong', 'Đã xác nhận cọc']],
        buttons: ['Tạo PO'],
      },
      steps: [
        'Ở danh sách đơn hàng, bấm nút pill "Đã xác nhận cọc"/"Chưa xác nhận" trên mỗi dòng để đánh dấu đã nhận cọc. Cột "Trạng thái" cho biết bao nhiêu SKU của đơn đã xong / chưa xong.',
        'Mở chi tiết một PO để xem 2 tab: "Chi tiết sản xuất" (dải bước tiến độ: Lên kế hoạch → Mua hàng → Khung cơ khí → Đan → Chuyền kiểm → Đóng gói → Hoàn thành) và "Chi tiết xuất hàng" (Tổng số lượng/Đã xuất/Còn lại từng dòng).',
      ],
      result: 'Nắm được đơn nào đã nhận cọc, đơn nào đang ở giai đoạn nào của sản xuất.',
      warnings: [
        'Dải tiến độ sản xuất là màn CHỈ XEM và được hệ thống TỰ SUY từ dữ liệu sản xuất thật: chưa duyệt lệnh sản xuất = "Lên kế hoạch"; đã duyệt nhưng xưởng chưa làm = "Mua hàng"; QLSX đã Bắt đầu hoặc đã có đợt cắt/hàn/sơn = "Khung cơ khí"; đã xuất/nhập đan = "Đan"; đã có kết quả chuyền kiểm = "Chuyền kiểm"; đã đóng thùng hoặc xuất vật tư đóng gói = "Đóng gói". Không ai sửa tay được.',
        '"Hoàn thành" chỉ hiện khi đã đóng gói ĐỦ số lượng VÀ QLSX đã bấm "Kết thúc" lệnh — đóng gói đủ mà QLSX chưa bấm Kết thúc thì vẫn hiện "Đóng gói".',
        'Đơn tạo trước 12/10/2026 có thể chưa có hạn giao — cột "Hạn giao" của các đơn đó hiện "—" (hệ thống không còn lấy ngày đặt hàng thay thế).',
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
        'Xem danh sách: Mã khách hàng, SĐT, Email, Địa chỉ, Tổng PO đã mua.',
        'Bấm "Thêm khách hàng", nhập Mã khách hàng và Số điện thoại (bắt buộc), Email/Địa chỉ/Ghi chú (tuỳ chọn), bấm "Lưu".',
        'Bấm icon bút chì trên một dòng để sửa thông tin.',
        { text: 'Bấm icon thùng rác để xoá khách hàng — xác nhận trong hộp thoại "Xoá khách hàng ...? Hành động này không thể hoàn tác."', critical: true },
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
        rows: [['PO-2026-014', '15/08/2026', 'GHE-001', '200', '120', '80', 'Khung cơ khí']],
      },
      steps: [
        'Gõ tìm hoặc chọn một khách hàng ở ô "Tìm hoặc chọn khách hàng".',
        'Xem thông tin khách và bảng chi tiết từng dòng SKU của mọi đơn hàng: PO, ngày đặt, SKU, tổng số, đã xuất, còn lại, trạng thái.',
      ],
      result: 'Có cái nhìn tổng hợp lịch sử mua hàng của một khách hàng để tư vấn/chăm sóc.',
      tags: ['lịch sử mua hàng', 'tra cứu khách hàng'],
      sourceRefs: ['src/modules/pages/Sales/PurchaseHistoryPage.tsx'],
    },
  ],
};
