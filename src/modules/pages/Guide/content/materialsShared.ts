import type { GuideArticle } from '../types';

// 2 bài dùng CHUNG cho Admin (tab "Hướng dẫn quản trị" trong phân hệ Quản trị) và vai trò "Quản lý
// vật tư" (tab "Hướng dẫn" trong phân hệ Quản lý vật tư) - cả hai cùng thao tác trên đúng 1 màn danh
// mục Vật tư (MaterialsPage.tsx). Tách khỏi admin.ts (2026-10-12) để phân hệ Quản lý vật tư không
// phải import admin.ts (kéo theo toàn bộ nội dung quản trị). Không nơi nào ở /guide import file này.
// Nguồn: MaterialsManagerApp.tsx, Admin/masterData/MaterialsPage.tsx, MaterialsBulkWasteModal.tsx.

export const materialsRoleArticle: GuideArticle = {
  id: 'admin-quan-ly-vat-tu-role',
  title: 'Tài khoản "Quản lý vật tư" — chỉ quản lý danh mục Vật tư',
  roles: ['materials', 'admin'],
  screenshot: '/guide-screens/admin-quan-ly-vat-tu-role.png',
  purpose: 'Vai trò văn phòng riêng (Admin tạo ở Người dùng > Loại nhân viên Văn phòng > Chức năng "Quản lý vật tư"). Sau đăng nhập vào thẳng danh mục Vật tư — giống hệt tab "Vật tư" của Admin. Thanh tiêu đề chỉ có 2 tab: "Vật tư" (màn làm việc) và "Hướng dẫn" (chính tài liệu này).',
  steps: [
    'Thêm / sửa / xoá vật tư và dùng "Sửa hao hụt hàng loạt" đúng như hướng dẫn ở bài "Khai báo danh mục Vật tư & Nhóm vật tư".',
    'Lọc nhanh theo nhóm vật tư bằng các pill phía trên bảng, tìm theo mã hoặc tên.',
  ],
  result: 'Danh mục vật tư được duy trì mà không cần cấp quyền Admin toàn hệ thống.',
  warnings: [
    'Tài khoản này KHÔNG tạo được Nhóm vật tư, không sửa số tồn kho và không vào được các danh mục khác — những việc đó vẫn thuộc Admin.',
    'Màn này không có chuông thông báo. Hướng dẫn của vai trò này chỉ có ở tab "Hướng dẫn" trên thanh tiêu đề.',
  ],
  tags: ['quản lý vật tư', 'materials manager', 'danh mục vật tư'],
  sourceRefs: ['src/modules/pages/MaterialsManager/MaterialsManagerApp.tsx'],
};

export const materialsCatalogArticle: GuideArticle = {
  id: 'admin-vat-tu',
  title: 'Khai báo danh mục Vật tư & Nhóm vật tư',
  roles: ['admin', 'materials'],
  purpose: 'Khai báo toàn bộ vật tư mà KHSX và các chuyên viên định mức sẽ chọn khi nhập định mức sản phẩm — họ chỉ chọn được từ danh mục này, không tự tạo mới.',
  preconditions: ['Nên tạo Nhóm vật tư trước (Sắt, Dây, Đinh, Sơn, Phụ kiện, Bao bì...) vì mỗi Nhóm có tiền tố mã dùng để tự sinh mã vật tư.'],
  screenshot: '/guide-screens/admin-vat-tu.png',
  mock: {
    title: 'Thêm vật tư',
    formFields: ['Mã vật tư', 'Tên vật tư', 'Đơn vị tính', 'Quy cách', 'Nhóm vật tư', 'Phân loại / Nhóm con Sắt', 'Kho', 'Tồn kho ban đầu', 'Nhân viên mua hàng', 'Đơn vị mua (nếu khác Đơn vị tính)', 'Hệ số quy đổi', '% dự trù hao hụt khi mua', 'Làm tròn khi mua', 'Ảnh vật tư'],
    buttons: ['Sửa hao hụt hàng loạt', 'Thêm vật tư', 'Lưu'],
  },
  steps: [
    'Ở "Nhóm vật tư": bấm "Thêm nhóm vật tư", nhập Tên nhóm vật tư, xác nhận/sửa "Tiền tố mã vật tư" (2-8 ký tự in hoa/số, hệ thống tự gợi ý theo tên).',
    'Ở "Vật tư": bấm "Thêm vật tư" — để trống Mã vật tư để tự sinh theo nhóm, nhập Tên, Đơn vị tính, Quy cách, chọn Nhóm vật tư (form không bắt buộc, nhưng để trống thì vật tư "vô hình" ở mọi nơi chọn định mức), chọn Kho, nhập Tồn kho ban đầu (ô này chỉ hiện lúc tạo mới và sau khi đã chọn Kho), chọn Nhân viên mua hàng phụ trách.',
    { text: 'Nếu Nhóm = "Vật tư khác", bắt buộc chọn thêm Phân loại (Sơn/Phụ kiện/Bao bì) để định mức chi tiết nhận diện đúng.', critical: true },
    { text: 'Nếu Nhóm = "Sắt", bắt buộc chọn "Nhóm con Sắt": Phần mềm (cắt qua phần mềm) / Tự tính (tỷ lệ cắt cố định, ví dụ tấm sắt la → pat) / Vật tư thành phẩm (gia công từ nguyên liệu mua, ví dụ chân nhôm).', critical: true },
    'Vật tư mua theo đơn vị khác đơn vị kho: nhập "Đơn vị mua" (VD kg) và "Hệ số quy đổi" (số Đơn vị tính / 1 Đơn vị mua, VD 250 = 250 cái/kg) — Thủ kho nhập kho theo đơn vị mua, hệ thống tự quy đổi.',
    'Nhập "% dự trù hao hụt khi mua" nếu muốn hệ thống tự cộng thêm khi lập đề xuất mua; "Làm tròn khi mua" để ép làm tròn LÊN số nguyên (đinh, vít, nút) hoặc ép GIỮ số thập phân (tấm sắt la) — để trống = theo mặc định của hệ thống.',
    'Đổi % hao hụt cho nhiều vật tư một lúc: bấm "Sửa hao hụt hàng loạt", chọn "Theo từng vật tư" (tick các vật tư) hoặc "Theo cả nhóm vật tư", nhập "% hao hụt mới" (để trống = xoá % hiện có), bấm "Áp dụng".',
  ],
  result: 'Vật tư sẵn sàng để chọn khi nhập định mức mảnh/chi tiết ở Kế hoạch SX và Manufacturing.',
  warnings: [
    'Sửa nhanh số tồn kho hiện tại KHÔNG làm ở trang Vật tư nữa — đã chuyển hẳn sang Admin > Quản lý kho (cột Tồn kho ở trang Vật tư chỉ đọc).',
    'Sắt nhóm con "Phần mềm" KHÔNG có ô % hao hụt nào ở đây: ngưỡng hao hụt khi cắt là mức chung của công ty, đợt nào cần cao hơn thì KHSX xin ở màn "Tối ưu cắt sắt". Mọi vật tư khác (kể cả Sắt "Tự tính" / "Vật tư thành phẩm") dùng "% dự trù hao hụt khi mua".',
    '% dự trù hao hụt khi mua được CỘNG THẲNG vào số "Cần mua" của các đề xuất mua sinh ra sau đó (Mua hàng thấy ở cột "Hao hụt") — nhập sai là mua thừa/thiếu thật.',
    'Form này gần như không kiểm tra bắt buộc (kể cả Tên/Đơn vị tính) — hãy tự điền đủ để vật tư dùng được ở các bước sau.',
  ],
  commonErrors: [
    { issue: 'Không thấy ô "Tồn kho ban đầu"', cause: 'Chưa chọn Kho, hoặc đang SỬA vật tư có sẵn (ô này chỉ có lúc tạo mới).', fix: 'Chọn Kho trước; với vật tư đã có thì sửa tồn ở Admin > Quản lý kho.' },
    { issue: '"Chưa tải được danh sách Nhóm vật tư - thử lại"', cause: 'Bấm Lưu khi danh sách nhóm chưa tải xong (hệ thống chặn để không xoá nhầm dữ liệu phụ thuộc nhóm).', fix: 'Chờ vài giây hoặc tải lại trang rồi lưu lại.' },
    { issue: '"Vật tư thuộc nhóm \'Vật tư khác\' phải chọn Phân loại..."', cause: 'Thiếu Phân loại Sơn/Phụ kiện/Bao bì cho nhóm "Vật tư khác".', fix: 'Chọn đúng Phân loại.' },
    { issue: '"Material ... already exists"', cause: 'Mã vật tư trùng.', fix: 'Đổi mã khác hoặc để trống cho hệ thống tự sinh.' },
  ],
  tags: ['vật tư', 'nhóm vật tư', 'danh mục', 'material', 'nhóm con sắt', 'hao hụt', 'sửa hao hụt hàng loạt', 'đơn vị mua', 'hệ số quy đổi'],
  sourceRefs: ['src/modules/pages/Admin/MasterDataPage.tsx'],
};
