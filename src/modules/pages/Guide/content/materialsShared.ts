import type { GuideArticle } from '../types';

// Các bài về màn danh mục Vật tư, dùng CHUNG cho Admin (tab "Hướng dẫn quản trị" trong phân hệ Quản
// trị) và vai trò "Quản lý vật tư" (tab "Hướng dẫn" trong phân hệ Quản lý vật tư) - cả hai cùng thao
// tác trên đúng 1 màn (MaterialsPage.tsx). Tách khỏi admin.ts (2026-10-12) để phân hệ Quản lý vật tư
// không phải import admin.ts (kéo theo toàn bộ nội dung quản trị). Không nơi nào ở /guide import file
// này.
//
// Viết lại chi tiết 2026-10-12 (theo yêu cầu "giải thích chi tiết hơn"): 1 bài gộp cũ tách thành 8 bài,
// mỗi bài 1 phần của màn hình. Nội dung dạng tra cứu (từng cột / từng ô / từng lựa chọn) đặt trong
// `tables`, công thức đặt trong `highlight`; `steps` chỉ còn giữ đúng các thao tác phải làm lần lượt. Mọi con số/quy tắc đối chiếu với:
//   FE  Admin/masterData/MaterialsPage.tsx, MaterialsBulkWasteModal.tsx, Admin/shared/AdminEntityPage.tsx
//   BE  modules/materials/materials.service.ts (create/update/remove/bulkUpdateWaste/generateMaterialCode),
//       production-invoices/*-purchase.service.ts (công thức cộng % hao hụt + làm tròn),
//       purchase-proposals.service.ts (ai thấy vật tư nào theo Material.buyerId)
//   Bảng % hao hụt: docs BE changelog-2026-10-10-hao-hut-mua-hang-that.html
// KHÔNG khai `screenshot` ở đây: mỗi nơi nhúng tự gắn ảnh chụp đúng giao diện của mình (xem
// materials.ts và admin.ts) - màn Admin có sidebar, màn Quản lý vật tư thì không.

export const materialsRoleArticle: GuideArticle = {
  id: 'admin-quan-ly-vat-tu-role',
  title: 'Tài khoản "Quản lý vật tư" làm được gì',
  roles: ['materials', 'admin'],
  purpose: 'Vai trò văn phòng riêng (Admin tạo ở Người dùng > Loại nhân viên Văn phòng > Chức năng "Quản lý vật tư"). Sau đăng nhập vào thẳng danh mục Vật tư — giống hệt tab "Vật tư" của Admin. Thanh tiêu đề chỉ có 2 tab: "Vật tư" (màn làm việc) và "Hướng dẫn" (chính tài liệu này).',
  tables: [
    {
      title: 'Phạm vi của tài khoản này',
      columns: ['Việc', 'Làm được không', 'Ghi chú'],
      rows: [
        ['Thêm, sửa, xoá vật tư', 'Có', 'Toàn bộ danh mục, không giới hạn theo kho hay nhóm.'],
        ['Sửa % hao hụt hàng loạt', 'Có', 'Trừ Sắt nhóm con "Phần mềm".'],
        ['Tạo hoặc sửa Nhóm vật tư', 'Không', 'Việc của Admin. Tài khoản này chỉ chọn nhóm có sẵn.'],
        ['Sửa số tồn kho', 'Không', 'Hai cột Tồn kho / Khả dụng chỉ để xem. Chỉnh tồn do Admin làm ở Quản lý kho.'],
        ['Vào các danh mục khác (người dùng, kho, sản phẩm...)', 'Không', 'Sau đăng nhập chỉ có màn Vật tư và tab Hướng dẫn.'],
      ],
    },
  ],
  stepsTitle: 'Công việc hằng ngày',
  stepsStyle: 'bullets',
  steps: [
    'Giữ cho danh mục vật tư đầy đủ và đúng — mọi bộ phận khác (định mức, mua hàng, kho, sản xuất) đều lấy vật tư từ danh mục này, không ai tự gõ tên vật tư ở nơi khác.',
    'Thêm vật tư mới khi xưởng bắt đầu dùng một thứ chưa có trong danh mục — xem bài "Thêm vật tư mới — giải thích từng ô".',
    'Sửa thông tin khi có thay đổi: đổi người mua phụ trách, đổi kho, chỉnh % dự trù hao hụt, thêm đơn vị mua — xem bài "Sửa và xoá vật tư".',
    'Chỉnh % hao hụt cho nhiều vật tư một lúc — xem bài "Sửa hao hụt hàng loạt".',
    'Mới dùng lần đầu thì nên đọc lần lượt theo mục lục: bảng → thêm mới → nhóm/phân loại → đơn vị → hao hụt → kho và người mua → sửa/xoá.',
  ],
  result: 'Danh mục vật tư được duy trì mà không cần cấp quyền Admin toàn hệ thống.',
  warnings: [
    'Thay đổi ở đây có tác dụng thật ngay: đổi % hao hụt là đổi số lượng các đề xuất mua sinh ra sau đó; bỏ trống Nhóm vật tư là vật tư biến mất khỏi mọi ô chọn định mức. Đọc kỹ từng bài trước khi sửa hàng loạt.',
    'Màn này không có chuông thông báo. Hướng dẫn của vai trò này chỉ có ở tab "Hướng dẫn" trên thanh tiêu đề.',
  ],
  tags: ['quản lý vật tư', 'materials manager', 'danh mục vật tư', 'tổng quan'],
  sourceRefs: ['src/modules/pages/MaterialsManager/MaterialsManagerApp.tsx'],
};

const bangVatTu: GuideArticle = {
  id: 'vt-bang-vat-tu',
  title: 'Đọc bảng Vật tư: từng cột nghĩa là gì',
  roles: ['materials', 'admin'],
  purpose: 'Bảng Vật tư có 15 cột. Bài này giải thích từng cột theo thứ tự từ trái sang phải, và cách lọc/tìm để ra đúng vật tư cần xem.',
  mock: {
    title: 'Vật tư',
    columns: ['Mã vật tư', 'Tên vật tư', 'Đơn vị', 'Nhóm vật tư', 'Phân loại', 'Kho', 'Tồn kho', 'Khả dụng', 'Nhân viên mua hàng', '% hao hụt'],
    rows: [['VTK-065', 'Vis 7 màu', 'Con', 'Vật tư khác', 'Phụ kiện', 'Kho Vật tư thành phẩm', '0', '0', 'Hiếu Hiếu', '1.5% · mua'], ['CHAN-NHOM-01', 'Chân nhôm', 'Chân', 'Sắt', '—', 'Kho Phôi Sơn Hàn', '3', '3', '—', '1% · mua']],
    buttons: ['Sửa hao hụt hàng loạt', 'Thêm vật tư'],
  },
  tables: [
    {
      title: 'Ý nghĩa từng cột',
      intro: 'Theo thứ tự từ trái sang phải trên màn hình.',
      columns: ['Cột', 'Cho biết gì', 'Cách đọc'],
      rows: [
        ['Mã vật tư', 'Mã duy nhất của vật tư, dạng TIỀN TỐ-SỐ.', 'VD SAT-003, DAY-001, VTK-065. Không hai vật tư nào trùng mã; mọi bộ phận khác nhận ra vật tư qua mã này.'],
        ['Tên vật tư', 'Tên gọi.', 'Hệ thống không chặn trùng tên — hai dòng cùng tên vẫn có thể là hai vật tư khác nhau.'],
        ['Quy cách', 'Kích thước hoặc chủng loại.', 'VD 4x20, 10x29x0.8, Ø25. Cùng tên khác quy cách là hai vật tư khác nhau.'],
        ['Đơn vị', 'Đơn vị KHO dùng để đếm tồn và xuất cho sản xuất.', 'Cái, con, kg, cuộn, tấm, cây...'],
        ['Đơn vị mua', 'Đơn vị khi MUA về, nếu khác đơn vị kho.', 'Dấu "—" = mua và đếm cùng một đơn vị.'],
        ['Nhóm vật tư', 'Vật tư hiện ở ô chọn nào khi nhập định mức.', 'Sắt, Dây, Đinh, Tán rút, Nút nhựa, Vật tư khác.'],
        ['Phân loại', 'Chỉ có với nhóm "Vật tư khác".', 'Sơn / Phụ kiện / Bao bì.'],
        ['Nhóm con Sắt', 'Chỉ có với nhóm "Sắt".', 'Phần mềm / Tự tính / Vật tư thành phẩm.'],
        ['Kho', 'Kho đang giữ vật tư này.', 'Dấu "—" = chưa gán kho.'],
        ['Tồn kho', 'Số đang có thật trong kho ở cột "Kho".', 'Số đỏ = bằng 0 hoặc âm.'],
        ['Khả dụng', 'Số còn dùng được.', 'Bằng Tồn kho trừ phần đã giữ chỗ cho một lệnh cắt sắt hoặc một phiếu chuyển kho đang chờ.'],
        ['Nhân viên mua hàng', 'Người chịu trách nhiệm mua vật tư này.', 'Dấu "—" = chưa giao cho ai.'],
        ['Hệ số quy đổi', '1 đơn vị mua bằng bao nhiêu đơn vị kho.', 'VD 250 = 1 kg được 250 cái. Chỉ có ý nghĩa khi có Đơn vị mua.'],
        ['% hao hụt', 'Phần cộng thêm khi hệ thống tính số cần mua.', '"1.5% · mua" = mua dư 1,5%. Thêm "· làm tròn" hoặc "· giữ lẻ" = vật tư đang bị ép cách làm tròn riêng. "—" = không cộng gì.'],
        ['Thao tác', 'Sửa và xoá.', 'Bút chì = sửa, thùng rác = xoá.'],
      ],
    },
  ],
  stepsTitle: 'Lọc và tìm vật tư',
  stepsStyle: 'bullets',
  steps: [
    'Lọc theo nhóm: bấm một trong các nút tròn phía trên bảng (Tất cả, Vật tư khác, Nút nhựa, Tán rút, Đinh, Dây, Sắt...). Con số cạnh tên là số vật tư trong nhóm đó.',
    'Tìm: gõ một phần MÃ hoặc TÊN vật tư vào ô "Tìm theo mã hoặc tên vật tư...".',
    'Bảng hiện 10 dòng mỗi trang, chuyển trang ở góc phải dưới.',
  ],
  result: 'Nhìn một dòng là biết vật tư thuộc nhóm nào, nằm ở kho nào, còn bao nhiêu, ai mua, và khi thiếu thì hệ thống sẽ đề xuất mua dư bao nhiêu.',
  warnings: [
    'Cột Tồn kho và Khả dụng chỉ tính tồn ở ĐÚNG kho ghi trong cột "Kho" của dòng đó. Vật tư chưa chọn Kho sẽ hiện "—" ở cả hai cột dù thực tế có thể đang nằm ở kho khác.',
    'Không sửa được số tồn ở màn này. Muốn chỉnh tồn phải nhờ Admin vào Quản lý kho.',
  ],
  tags: ['bảng vật tư', 'cột', 'tồn kho', 'khả dụng', 'lọc', 'tìm kiếm'],
  sourceRefs: ['src/modules/pages/Admin/masterData/MaterialsPage.tsx'],
};

const themVatTu: GuideArticle = {
  id: 'vt-them-vat-tu',
  title: 'Thêm vật tư mới — giải thích từng ô',
  roles: ['materials', 'admin'],
  purpose: 'Form "Thêm vật tư" có tới 14 ô, một số ô chỉ hiện tuỳ theo nhóm đã chọn. Bài này đi qua từng ô theo đúng thứ tự trên form: ô đó để làm gì, bỏ trống thì sao, ví dụ điền thế nào.',
  preconditions: [
    'Nhóm vật tư cần dùng đã có sẵn (Sắt, Dây, Đinh, Tán rút, Nút nhựa, Vật tư khác...). Thiếu nhóm thì nhờ Admin tạo trước.',
    'Kiểm tra vật tư chưa có trong danh mục: gõ tên hoặc mã vào ô tìm trước khi thêm, tránh tạo trùng.',
  ],
  mock: {
    title: 'Thêm vật tư',
    formFields: ['Mã vật tư', 'Tên vật tư', 'Đơn vị tính', 'Quy cách', 'Nhóm vật tư', 'Phân loại * / Nhóm con Sắt *', 'Kho', 'Tồn kho ban đầu', 'Nhân viên mua hàng', 'Đơn vị mua (nếu khác Đơn vị tính)', 'Hệ số quy đổi', '% dự trù hao hụt khi mua', 'Làm tròn khi mua', 'Ảnh vật tư'],
    buttons: ['Hủy', 'Lưu'],
  },
  tables: [
    {
      title: 'Từng ô trên form',
      intro: 'Theo đúng thứ tự từ trên xuống. Cột "Bắt buộc" ghi theo thực tế hệ thống kiểm tra, không chỉ theo dấu sao trên form.',
      columns: ['Ô', 'Bắt buộc', 'Điền gì', 'Ví dụ'],
      rows: [
        ['Mã vật tư', 'Không — nên để trống', 'Để trống thì hệ thống tự sinh mã theo nhóm, lấy số lớn nhất đã dùng cộng 1. Chỉ tự gõ khi công ty đã có sẵn mã riêng.', 'Nhóm Sắt đã có tới SAT-015 → mã mới là SAT-016'],
        ['Tên vật tư', 'Có', 'Tên gọi. Form không đánh dấu sao nhưng thiếu là không lưu được.', 'Vis 7 màu'],
        ['Đơn vị tính', 'Có', 'Đơn vị KHO đếm và xuất cho sản xuất. Chọn đơn vị nhỏ nhất mà xưởng thật sự đếm.', 'cái, con, kg, cuộn, tấm, cây'],
        ['Quy cách', 'Không', 'Kích thước hoặc chủng loại, gõ tự do. Nên điền để phân biệt các vật tư trùng tên.', '10x29x0.8 · 4x20 · Ø25'],
        ['Nhóm vật tư', 'Không, nhưng đừng bỏ trống', 'Vật tư không có nhóm sẽ không hiện ở bất kỳ ô chọn nào khi nhập định mức.', 'Sắt, Dây, Vật tư khác'],
        ['Phân loại', 'Có, khi nhóm là "Vật tư khác"', 'Ô chỉ hiện sau khi chọn nhóm "Vật tư khác".', 'Sơn / Phụ kiện / Bao bì'],
        ['Nhóm con Sắt', 'Có, khi nhóm là "Sắt"', 'Ô chỉ hiện sau khi chọn nhóm "Sắt".', 'Phần mềm / Tự tính / Vật tư thành phẩm'],
        ['Kho', 'Không, nhưng nên chọn', 'Kho sẽ giữ vật tư này. Chỉ liệt kê kho thật, không có kho ảo dùng cho sổ sách.', 'Kho Phôi Sơn Hàn'],
        ['Tồn kho ban đầu', 'Không', 'Chỉ hiện sau khi đã chọn Kho, và chỉ có lúc tạo mới. Điền số đang có sẵn ngoài thực tế; để trống nếu chưa có. Được ghi vào lịch sử kho như một lần nhập "tồn ban đầu".', '120'],
        ['Nhân viên mua hàng', 'Không', 'Người sẽ mua vật tư này. Danh sách chỉ gồm tài khoản có chức năng Mua hàng.', '—'],
        ['Đơn vị mua', 'Không', 'Chỉ điền khi mua theo đơn vị khác đơn vị kho.', 'kg'],
        ['Hệ số quy đổi', 'Đi cặp với Đơn vị mua', '1 đơn vị mua bằng bao nhiêu đơn vị kho.', '250'],
        ['% dự trù hao hụt khi mua', 'Không', 'Phần mua dư để bù rách, hỏng, thất thoát. Không hiện với Sắt nhóm con "Phần mềm".', '1.5'],
        ['Làm tròn khi mua', 'Không', 'Để trống = theo quy tắc sẵn có của loại vật tư. Không hiện với Sắt nhóm con "Phần mềm".', 'Ép làm tròn LÊN số nguyên'],
        ['Ảnh vật tư', 'Không', 'Ảnh minh hoạ. Chỉ thật sự tải lên khi bấm Lưu, nên bấm Hủy giữa chừng không để lại gì.', '—'],
      ],
      note: 'Tiền tố mã theo nhóm: Sắt = SAT · Dây = DAY · Đinh = DINH · Tán rút = TR · Nút nhựa = NN · Vật tư khác = VTK · chưa chọn nhóm = VT.',
    },
  ],
  steps: [
    'Gõ tên hoặc mã vào ô tìm của bảng để chắc vật tư chưa có trong danh mục.',
    'Bấm "Thêm vật tư" (góc phải trên).',
    { text: 'Điền "Tên vật tư" và "Đơn vị tính" — hai ô bắt buộc.', critical: true },
    { text: 'Chọn "Nhóm vật tư", rồi chọn ô phụ hiện ra theo nhóm (Phân loại hoặc Nhóm con Sắt). Cách chọn xem bài "Nhóm vật tư, Phân loại, Nhóm con Sắt".', critical: true },
    'Chọn "Kho" và "Nhân viên mua hàng"; nhập "Tồn kho ban đầu" nếu vật tư đã có sẵn trong kho.',
    'Điền "Đơn vị mua" + "Hệ số quy đổi" nếu mua khác đơn vị kho, và "% dự trù hao hụt khi mua" theo bảng % của công ty.',
    'Bấm "Lưu". Vật tư xuất hiện ngay trong bảng và ở các ô chọn của bộ phận định mức.',
  ],
  result: 'Vật tư mới có mã, sẵn sàng để chuyên viên định mức chọn khi khai định mức sản phẩm, và để hệ thống tính đề xuất mua khi thiếu.',
  warnings: [
    'Điền đủ ngay từ đầu 4 ô ảnh hưởng tới bộ phận khác: Nhóm vật tư (định mức có thấy không), Kho (hàng mua về nhập vào đâu, kho nào xuất được), Nhân viên mua hàng (ai xử lý đề xuất mua), % hao hụt (mua dư bao nhiêu).',
    'Tồn kho ban đầu chỉ nhập được MỘT lần lúc tạo. Nhập sai thì không sửa lại được ở màn này — phải nhờ Admin chỉnh ở Quản lý kho.',
    'Hệ thống không cảnh báo trùng TÊN (chỉ chặn trùng MÃ). Hai vật tư cùng tên vẫn tạo được — tự kiểm tra trước khi thêm.',
  ],
  commonErrors: [
    { issue: '"Thiếu Tên vật tư / Đơn vị tính - đây là 2 trường bắt buộc ở DB, không thể để trống"', cause: 'Bỏ trống Tên vật tư hoặc Đơn vị tính.', fix: 'Điền cả hai rồi bấm Lưu lại.' },
    { issue: '"Bắt buộc" hiện dưới ô Phân loại hoặc Nhóm con Sắt', cause: 'Đã chọn nhóm "Vật tư khác" hoặc "Sắt" nhưng chưa chọn ô phụ đi kèm.', fix: 'Chọn Phân loại (Sơn/Phụ kiện/Bao bì) hoặc Nhóm con Sắt (Phần mềm/Tự tính/Vật tư thành phẩm).' },
    { issue: '"Material ... already exists"', cause: 'Mã tự gõ trùng với một vật tư đã có.', fix: 'Xoá trắng ô Mã vật tư để hệ thống tự sinh, hoặc gõ mã khác.' },
    { issue: 'Không thấy ô "Tồn kho ban đầu"', cause: 'Chưa chọn Kho, hoặc đang SỬA vật tư có sẵn (ô này chỉ có lúc tạo mới).', fix: 'Chọn Kho trước. Với vật tư đã có, nhờ Admin sửa tồn ở Quản lý kho.' },
    { issue: '"Chưa tải được danh sách Nhóm vật tư - thử lại"', cause: 'Bấm Lưu khi danh sách nhóm chưa tải xong (hệ thống chặn để không xoá nhầm các ô phụ thuộc nhóm).', fix: 'Chờ vài giây hoặc tải lại trang rồi lưu lại.' },
    { issue: 'Không thấy ô "% dự trù hao hụt khi mua"', cause: 'Vật tư là Sắt nhóm con "Phần mềm" — loại này không có % hao hụt khi mua.', fix: 'Đúng thiết kế, không cần xử lý. Xem bài về % hao hụt.' },
  ],
  tags: ['thêm vật tư', 'tạo vật tư', 'mã vật tư', 'tồn kho ban đầu', 'form vật tư'],
  sourceRefs: ['src/modules/pages/Admin/masterData/MaterialsPage.tsx', 'DNA-ERP-BE/src/modules/materials/materials.service.ts'],
};

const nhomPhanLoai: GuideArticle = {
  id: 'vt-nhom-phan-loai',
  title: 'Nhóm vật tư, Phân loại, Nhóm con Sắt — chọn thế nào cho đúng',
  roles: ['materials', 'admin'],
  purpose: 'Ba ô này quyết định vật tư đi theo luồng nào trong hệ thống: hiện ở tab định mức nào, có qua phần mềm cắt sắt không, có được cộng % hao hụt khi mua không. Chọn sai nhóm là lỗi khó thấy nhất vì form vẫn lưu được bình thường.',
  mock: {
    title: 'Thêm vật tư — phần chọn nhóm',
    formFields: ['Nhóm vật tư', 'Phân loại * (chỉ khi nhóm = Vật tư khác)', 'Nhóm con Sắt * (chỉ khi nhóm = Sắt)'],
  },
  tables: [
    {
      title: 'Nhóm vật tư',
      intro: 'Sáu nhóm hệ thống. Nhóm quyết định ai khai định mức cho vật tư và khai ở tab nào.',
      columns: ['Nhóm', 'Dùng cho', 'Ai khai định mức', 'Ô phụ phải chọn thêm'],
      rows: [
        ['Dây', 'Dây đan gắn theo từng MẢNH của sản phẩm.', 'Chuyên viên định mức mảnh, tab Dây', '—'],
        ['Đinh', 'Đinh gắn theo từng mảnh.', 'Chuyên viên định mức mảnh, tab Đinh', '—'],
        ['Tán rút', 'Tán rút gắn theo từng mảnh.', 'Chuyên viên định mức mảnh, tab Tán rút', '—'],
        ['Nút nhựa', 'Nút nhựa gắn theo từng mảnh.', 'Chuyên viên định mức mảnh, tab Nút nhựa', '—'],
        ['Vật tư khác', 'Vật tư tính theo CẢ SẢN PHẨM.', 'Chuyên viên định mức chi tiết', 'Phân loại (bắt buộc)'],
        ['Sắt', 'Sắt cây và các nguyên liệu kim loại.', 'Chuyên viên định mức mảnh', 'Nhóm con Sắt (bắt buộc)'],
      ],
      note: 'Dây và Đinh còn quyết định một mảnh có phải đem đi đan hay không: mảnh có cả Dây lẫn Đinh là mảnh có đan.',
    },
    {
      title: 'Phân loại (khi nhóm là "Vật tư khác")',
      columns: ['Phân loại', 'Gồm những gì', 'Hiện ở đâu'],
      rows: [
        ['Sơn', 'Bột sơn, sơn dặm...', 'Tab Sơn của định mức chi tiết.'],
        ['Phụ kiện', 'Vít, bu lông, long đền, nhãn, tem, gói hút ẩm...', 'Tab Phụ kiện của định mức chi tiết.'],
        ['Bao bì', 'Thùng, bao nylon, màng PE, xốp...', 'Tab Bao bì, và là thứ Thủ kho xuất ở bước "Xuất vật tư đóng gói".'],
      ],
    },
    {
      title: 'Nhóm con Sắt (khi nhóm là "Sắt")',
      columns: ['Nhóm con', 'Dùng cho', 'Số cần mua tính thế nào', 'Có % hao hụt khi mua'],
      rows: [
        ['Phần mềm', 'Sắt cây thông thường: sắt hộp, sắt vuông, sắt ống.', 'Phần mềm tính phương án cắt quyết định số cây.', 'Không'],
        ['Tự tính', 'Vật tư cắt ra số miếng cố định, không cần tối ưu. VD tấm sắt la cắt ra các miếng pat, sắt phi.', 'Theo tỷ lệ cắt cố định đã khai.', 'Có'],
        ['Vật tư thành phẩm', 'Thứ gia công từ nguyên liệu mua về, không gắn với mảnh nào. VD chân nhôm làm từ thanh nhôm.', 'Theo "Định mức vật tư thành phẩm" (1 thanh nhôm ra bao nhiêu chân).', 'Có'],
      ],
      note: '"Định mức vật tư thành phẩm" do Admin hoặc chuyên viên định mức mảnh khai. Chưa có định mức này thì hệ thống chưa tính được nguyên liệu cho loại "Vật tư thành phẩm".',
    },
    {
      title: 'Đổi nhóm của vật tư đã có thì mất gì',
      columns: ['Thay đổi', 'Hệ thống tự xoá'],
      rows: [
        ['Rời khỏi nhóm "Vật tư khác"', 'Phân loại'],
        ['Rời khỏi nhóm "Sắt"', 'Nhóm con Sắt'],
        ['Đổi sang Sắt nhóm con "Phần mềm"', '% dự trù hao hụt khi mua'],
      ],
      note: 'Đổi nhầm rồi đổi lại sẽ phải điền lại các ô đã bị xoá.',
    },
  ],
  steps: [],
  result: 'Vật tư hiện đúng tab khi bộ phận định mức chọn, và đi đúng luồng mua hàng / cắt sắt / đóng gói.',
  warnings: [
    'Phân loại sai giữa Sơn / Phụ kiện / Bao bì: vật tư hiện nhầm tab ở định mức chi tiết. Riêng nhầm sang hoặc khỏi "Bao bì" còn làm sai bước xuất vật tư đóng gói của kho.',
    'Chọn nhầm Sắt "Phần mềm" cho thứ không phải sắt cây: vật tư sẽ bị đưa vào phần mềm cắt sắt và mất ô % hao hụt. Ngược lại, sắt cây mà chọn "Tự tính" thì không được tối ưu cắt.',
    'Vật tư đã nằm trong định mức của sản phẩm thì hạn chế đổi nhóm — định mức cũ vẫn trỏ tới vật tư này dưới nhóm cũ.',
  ],
  commonErrors: [
    { issue: '"Vật tư thuộc nhóm "Vật tư khác" phải chọn Phân loại (Sơn/Phụ kiện/Bao bì)"', cause: 'Nhóm là "Vật tư khác" nhưng chưa có Phân loại.', fix: 'Chọn một trong ba Phân loại.' },
    { issue: '"Vật tư thuộc nhóm "Sắt" phải chọn nhóm con (Phần mềm/Tự tính/Vật tư thành phẩm)"', cause: 'Nhóm là "Sắt" nhưng chưa có Nhóm con Sắt.', fix: 'Chọn một trong ba nhóm con.' },
    { issue: 'Chuyên viên định mức báo "không tìm thấy vật tư" dù đã thêm', cause: 'Vật tư chưa có Nhóm, hoặc sai Phân loại / Nhóm con nên đang nằm ở tab khác.', fix: 'Mở vật tư, kiểm tra ba ô nhóm theo bài này.' },
  ],
  tags: ['nhóm vật tư', 'phân loại', 'nhóm con sắt', 'phần mềm', 'tự tính', 'vật tư thành phẩm', 'sơn', 'phụ kiện', 'bao bì'],
  sourceRefs: ['src/modules/pages/Admin/masterData/MaterialsPage.tsx', 'DNA-ERP-BE/src/modules/materials/materials.service.ts'],
};

const donViMua: GuideArticle = {
  id: 'vt-don-vi-mua',
  title: 'Đơn vị tính, Đơn vị mua và Hệ số quy đổi',
  roles: ['materials', 'admin'],
  purpose: 'Nhiều vật tư được MUA theo một đơn vị nhưng ĐẾM trong kho theo đơn vị khác (mua đinh theo kg, đếm theo cây). Ba ô này cho hệ thống biết cách đổi qua lại, để Thủ kho nhập hàng theo đúng đơn vị trên hoá đơn.',
  highlight: {
    label: 'Cách quy đổi',
    text: 'Số nhập kho = Số theo đơn vị mua × Hệ số quy đổi',
    note: 'Ví dụ: vít đếm theo "cái", mua theo "kg", 1 kg được khoảng 250 cái. Hàng về 2 kg → hệ thống tự điền 500 cái.',
  },
  tables: [
    {
      title: 'Ba ô liên quan',
      columns: ['Ô', 'Là gì', 'Khi nào điền', 'Ví dụ'],
      rows: [
        ['Đơn vị tính', 'Đơn vị của KHO. Mọi con số tồn kho, định mức, số cần mua đều tính theo đơn vị này.', 'Luôn luôn (bắt buộc).', 'cái'],
        ['Đơn vị mua', 'Đơn vị nhà cung cấp bán.', 'Chỉ khi khác Đơn vị tính. Mua và đếm cùng đơn vị thì để trống.', 'kg'],
        ['Hệ số quy đổi', 'Số Đơn vị tính trong 1 Đơn vị mua.', 'Cùng lúc với Đơn vị mua — hai ô đi thành cặp.', '250'],
      ],
    },
  ],
  stepsTitle: 'Khi hàng về kho',
  steps: [
    'Thủ kho nhập số lượng theo đơn vị mua, đúng như trên hoá đơn (VD 2 kg).',
    'Hệ thống tự đổi ra đơn vị kho (500 cái) và điền sẵn.',
    'Thủ kho vẫn sửa tay được con số đã đổi nếu đếm thực tế khác.',
  ],
  result: 'Thủ kho nhập kho theo đúng đơn vị trên hoá đơn mà tồn kho vẫn được tính theo đơn vị xưởng dùng.',
  warnings: [
    'Hệ số sai là sai số nhập kho mỗi lần nhận hàng. Hệ thống có cảnh báo khi số Thủ kho nhập lệch nhiều so với số quy đổi, nhưng KHÔNG chặn.',
    'Hệ số quy đổi chỉ là con số gần đúng với những thứ cân ký (số cái trong 1 kg thay đổi theo lô). Chọn con số trung bình; Thủ kho chỉnh số thực tế khi nhập.',
  ],
  tags: ['đơn vị tính', 'đơn vị mua', 'hệ số quy đổi', 'kg', 'quy đổi'],
  sourceRefs: ['src/modules/pages/Admin/masterData/MaterialsPage.tsx', 'src/modules/pages/Manufacturing/NhapKhoPage.tsx'],
};

const haoHut: GuideArticle = {
  id: 'vt-hao-hut',
  title: '% dự trù hao hụt và Làm tròn khi mua',
  roles: ['materials', 'admin'],
  purpose: 'Khi một lệnh sản xuất thiếu vật tư, hệ thống tự lập đề xuất mua. Hai ô này quyết định hệ thống đề xuất mua DƯ bao nhiêu (để bù rách, hỏng, thất thoát) và có làm tròn lên số nguyên hay không. Sửa hai ô này là sửa trực tiếp con số Mua hàng nhìn thấy.',
  highlight: {
    label: 'Công thức',
    text: 'Số cần mua = (Số cần − Tồn khả dụng) × (1 + % hao hụt / 100)',
    note: 'Phần trăm chỉ cộng vào số CÒN THIẾU, sau khi đã trừ tồn kho — không cộng vào số đang có.',
  },
  tables: [
    {
      title: 'Ví dụ tính',
      columns: ['Vật tư', 'Còn thiếu', '% hao hụt', 'Làm tròn', 'Cần mua'],
      rows: [
        ['Đinh F 10 đen', '48 cây', '1,5%', 'Mặc định (giữ số thập phân)', '48,72 cây'],
        ['Dây đen', '6 kg', '0%', 'Mặc định (giữ số thập phân)', '6 kg'],
        ['Sắt phi', '1 cuộn', '1%', 'Mặc định (làm tròn lên)', '1,01 → 2 cuộn'],
        ['Tấm sắt la', '1 tấm', '1%', 'Ép giữ số thập phân', '1,01 tấm'],
      ],
    },
    {
      title: 'Bảng % đang áp dụng',
      intro: 'Chốt ngày 08/10/2026. Vật tư mới nên theo đúng bảng này trừ khi có chỉ đạo khác.',
      columns: ['% hao hụt', 'Áp cho'],
      rows: [
        ['0%', 'Dây đan, dây hàn, khí CO2, nhãn số, HDLR, poster.'],
        ['1%', 'Sắt nhóm con "Tự tính" và "Vật tư thành phẩm"; bì zipper.'],
        ['1,5%', 'Mọi thứ còn lại: đinh, vít, nút nhựa, tán rút, long đền, bu lông, sơn, xốp, bao bì...'],
        ['Không có', 'Sắt nhóm con "Phần mềm" — hai ô này không hiện.'],
      ],
    },
    {
      title: 'Ba lựa chọn "Làm tròn khi mua"',
      columns: ['Lựa chọn', 'Kết quả', 'Dùng khi'],
      rows: [
        ['Để trống (mặc định)', 'Vật tư tiêu hao và phụ kiện (dây, đinh, nút, sơn, bao bì...) GIỮ số thập phân. Sắt "Tự tính" và "Vật tư thành phẩm" LÀM TRÒN LÊN số nguyên.', 'Hầu hết trường hợp.'],
        ['Ép làm tròn LÊN số nguyên', 'Số cần mua luôn được làm tròn lên.', 'Thứ không mua lẻ được dù thuộc loại mặc định giữ thập phân. VD đinh, vít, nút bán theo con.'],
        ['Ép GIỮ số thập phân', 'Số cần mua giữ nguyên phần lẻ.', 'Thứ thuộc loại mặc định làm tròn nhưng thực tế mua lẻ được. VD tấm sắt la (đang được đặt như vậy).'],
      ],
    },
  ],
  stepsTitle: 'Cách đặt',
  steps: [
    'Mở vật tư (bút chì ở cuối dòng).',
    'Ô "% dự trù hao hụt khi mua": gõ con số phần trăm, dùng dấu chấm cho phần lẻ (1.5 = 1,5%). Để trống = không cộng gì.',
    'Ô "Làm tròn khi mua": để trống, hoặc chọn một trong hai kiểu ép theo bảng trên.',
    { text: 'Bấm "Lưu", rồi nhìn lại cột "% hao hụt" trong bảng để chắc không gõ nhầm (15 thay vì 1.5 là mua dư 15%).', critical: true },
  ],
  result: 'Đề xuất mua sinh ra sau khi lưu sẽ dùng % và cách làm tròn mới. Mua hàng thấy % này ở cột "Hao hụt" (dạng +1.5%) và số "Cần mua" đã cộng sẵn.',
  warnings: [
    'Sắt nhóm con "Phần mềm" KHÔNG có hai ô này: số cây cần mua do phần mềm tính phương án cắt quyết định; mức hao hụt khi cắt là mức chung của công ty, đợt nào cần cao hơn thì Kế hoạch sản xuất xin ở màn "Tối ưu cắt sắt".',
    'Thay đổi chỉ áp cho các đề xuất mua sinh ra SAU khi lưu. Đề xuất đã có giữ nguyên con số cũ.',
    'Mua hàng không cần tự cộng thêm hao hụt nữa — nếu họ vẫn cộng tay thì sẽ thành cộng hai lần. Báo cho bộ phận Mua hàng khi đổi % của nhóm vật tư lớn.',
  ],
  commonErrors: [
    { issue: 'Cột "% hao hụt" hiện "—" dù đã nhập', cause: 'Vật tư là Sắt nhóm con "Phần mềm" — hệ thống luôn bỏ % của loại này.', fix: 'Đúng thiết kế. Nếu vật tư thật ra không phải sắt cây, sửa lại Nhóm con Sắt.' },
    { issue: 'Số "Cần mua" bên Mua hàng ra lẻ (48,72) trong khi phải mua nguyên', cause: 'Vật tư thuộc loại mặc định giữ số thập phân.', fix: 'Mở vật tư, chọn "Ép làm tròn LÊN số nguyên" ở ô Làm tròn khi mua.' },
  ],
  tags: ['hao hụt', '% dự trù hao hụt', 'làm tròn khi mua', 'cần mua', 'mua dư', 'công thức'],
  sourceRefs: ['src/modules/pages/Admin/masterData/MaterialsPage.tsx', 'DNA-ERP-BE/docs/changelog-2026-10-10-hao-hut-mua-hang-that.html'],
};

const haoHutHangLoat: GuideArticle = {
  id: 'vt-hao-hut-hang-loat',
  title: 'Sửa hao hụt hàng loạt',
  roles: ['materials', 'admin'],
  purpose: 'Đặt cùng một % dự trù hao hụt cho nhiều vật tư trong một lần, thay vì mở từng vật tư. Dùng khi công ty chốt lại bảng % hoặc vừa nhập một loạt vật tư mới.',
  preconditions: ['Đã hiểu % hao hụt ảnh hưởng thế nào tới số cần mua — xem bài "% dự trù hao hụt và Làm tròn khi mua".'],
  mock: {
    title: 'Sửa % hao hụt hàng loạt',
    formFields: ['Theo từng vật tư | Theo cả nhóm vật tư', 'Tìm theo mã hoặc tên vật tư...', '% hao hụt mới'],
    buttons: ['Chọn tất cả', 'Bỏ chọn', 'Hủy', 'Áp dụng'],
  },
  tables: [
    {
      title: 'Hai phạm vi áp dụng',
      columns: ['Phạm vi', 'Chọn thế nào', 'Áp cho', 'Lưu ý'],
      rows: [
        ['Theo từng vật tư', 'Tick từng dòng. Gõ ô tìm để lọc theo mã/tên rồi bấm "Chọn tất cả" để tick hết các dòng đang hiện; "Bỏ chọn" để bỏ hết.', 'Đúng các vật tư đã tick.', 'Sắt nhóm con "Phần mềm" không có trong danh sách.'],
        ['Theo cả nhóm vật tư', 'Chọn một nhóm. Dòng dưới ô chọn cho biết nhóm có bao nhiêu vật tư.', 'MỌI vật tư trong nhóm đó.', 'Không chọn được nhóm Sắt (ghi chú "KHSX quyết định").'],
      ],
      note: 'Muốn đổi % cho Sắt "Tự tính" hoặc "Vật tư thành phẩm": dùng "Theo từng vật tư" và tick đúng các vật tư đó.',
    },
  ],
  steps: [
    'Bấm "Sửa hao hụt hàng loạt" (cạnh nút "Thêm vật tư").',
    'Chọn phạm vi ở hai nút trên cùng, rồi chọn vật tư hoặc nhóm theo bảng trên.',
    'Nhập "% hao hụt mới". Để TRỐNG nghĩa là XOÁ % hiện có của các vật tư đã chọn (về không cộng gì).',
    'Kiểm tra dòng dưới cùng "Áp dụng cho N vật tư" đúng số lượng mong muốn.',
    { text: 'Bấm "Áp dụng". Không có bước hỏi lại — giá trị mới ghi đè ngay lên % cũ của từng vật tư.', critical: true },
  ],
  result: 'Mọi vật tư trong phạm vi nhận cùng một % mới; cột "% hao hụt" trong bảng cập nhật ngay.',
  warnings: [
    'Không hoàn tác được. % cũ của từng vật tư bị ghi đè và không được lưu lại ở đâu — nếu các vật tư đang có % khác nhau, hãy ghi lại trước khi áp.',
    'Thao tác này chỉ đổi %, không đổi lựa chọn "Làm tròn khi mua" của từng vật tư.',
  ],
  commonErrors: [
    { issue: 'Nút "Áp dụng" bị mờ', cause: 'Chưa chọn vật tư/nhóm nào, hoặc đang chọn nguyên nhóm Sắt.', fix: 'Chọn ít nhất một vật tư; với Sắt thì chuyển sang "Theo từng vật tư".' },
    { issue: '"Vật tư nhóm Sắt không có % hao hụt để sửa - ngưỡng hao hụt cắt do KHSX quyết định ở màn "Tối ưu cắt sắt""', cause: 'Mọi vật tư đã chọn đều là Sắt "Phần mềm".', fix: 'Không sửa được ở đây — đúng thiết kế.' },
    { issue: '"Không tìm thấy vật tư nào để cập nhật"', cause: 'Nhóm đã chọn không còn vật tư nào, hoặc các vật tư đã chọn vừa bị xoá.', fix: 'Tải lại trang rồi chọn lại.' },
  ],
  tags: ['sửa hao hụt hàng loạt', 'hàng loạt', 'bulk', '% hao hụt'],
  sourceRefs: ['src/modules/pages/Admin/masterData/MaterialsBulkWasteModal.tsx', 'DNA-ERP-BE/src/modules/materials/materials.service.ts'],
};

const khoNguoiMua: GuideArticle = {
  id: 'vt-kho-nguoi-mua',
  title: 'Kho và Nhân viên mua hàng — ai thấy, hàng về đâu',
  roles: ['materials', 'admin'],
  purpose: 'Hai ô "Kho" và "Nhân viên mua hàng" không ảnh hưởng tới định mức, nhưng quyết định ai nhìn thấy vật tư trong công việc hằng ngày: thủ kho nào nhận và xuất nó, nhân viên mua hàng nào xử lý đề xuất mua nó.',
  tables: [
    {
      title: 'Ba loại kho và vật tư nên đặt ở đâu',
      intro: 'Ba kho nối tiếp nhau theo dòng sản xuất. Chọn kho theo NƠI vật tư được dùng.',
      columns: ['Kho', 'Phục vụ công đoạn', 'Vật tư nên đặt ở đây'],
      rows: [
        ['Phôi Sơn Hàn', 'Làm khung cơ khí: cắt, hàn, sơn.', 'Sắt, vật tư hàn, sơn.'],
        ['Vật tư thành phẩm', 'Đan và lắp.', 'Dây, đinh, nút nhựa, tán rút, vít, phụ kiện.'],
        ['Thành phẩm', 'Đóng gói.', 'Thùng, bao, xốp, nhãn, tem.'],
      ],
      note: 'Khi công ty có nhiều kho Thành phẩm: hàng mua về theo đúng kho thành phẩm mà lệnh sản xuất đã chọn, không cố định một kho.',
    },
    {
      title: 'Chọn Kho thì hệ thống dùng vào việc gì',
      columns: ['Việc', 'Kho của vật tư quyết định'],
      rows: [
        ['Nhập hàng mua về', 'Hàng vào kho đó; Thủ kho của kho đó thấy dòng chờ nhận ở "Nhập kho".'],
        ['Xem tồn', 'Cột Tồn kho / Khả dụng ở bảng Vật tư đọc số của kho đó.'],
        ['Xuất cho sản xuất', 'Các bước xuất lấy hàng từ kho đó. Vật tư chưa có kho thì bước xuất báo lỗi và dừng.'],
      ],
    },
    {
      title: 'Nhân viên mua hàng — ai thấy đề xuất mua',
      columns: ['Ô "Nhân viên mua hàng"', 'Ai xử lý được dòng vật tư này', 'Người khác thấy gì'],
      rows: [
        ['Đã giao cho một người', 'Chỉ người đó.', 'Các nhân viên mua hàng khác thấy dòng này để tham khảo, không xử lý được.'],
        ['Để trống (chưa giao cho ai)', 'Mọi nhân viên mua hàng.', 'Ai cũng thấy và xử lý được.'],
      ],
    },
  ],
  stepsTitle: 'Đổi kho hoặc người mua của một vật tư',
  steps: [
    'Bấm bút chì ở cuối dòng vật tư.',
    'Chọn kho khác ở ô "Kho", hoặc người khác ở ô "Nhân viên mua hàng". Chọn "— Không —" để gỡ.',
    'Bấm "Lưu".',
  ],
  result: 'Hàng mua về vào đúng kho, đúng thủ kho nhận; đề xuất mua tới đúng người phụ trách.',
  warnings: [
    'Vật tư không có Kho: các bước xuất kho cho sản xuất sẽ báo lỗi "Vật tư ... chưa được gán kho" và dừng lại cho tới khi có người vào đây chọn Kho.',
    'Khi một nhân viên mua hàng nghỉ việc, đừng sửa tay từng vật tư: Admin có nút "Chuyển giao vật tư mua hàng" ở Người dùng để chuyển toàn bộ sang người mới trong một lần. Hệ thống cũng không cho khoá tài khoản mua hàng khi người đó còn đang phụ trách vật tư.',
    'Danh sách ở ô "Nhân viên mua hàng" chỉ gồm tài khoản có chức năng Mua hàng. Thiếu ai thì nhờ Admin kiểm tra tài khoản người đó.',
  ],
  commonErrors: [
    { issue: 'Thủ kho báo không thấy hàng chờ nhận ở "Nhập kho"', cause: 'Vật tư đang gán cho kho khác với kho của thủ kho đó, hoặc chưa gán kho.', fix: 'Kiểm tra ô Kho của vật tư.' },
    { issue: 'Mua hàng báo "Bạn không được phân công mua vật tư nào trong đề xuất này"', cause: 'Mọi vật tư trong đề xuất đều đang giao cho người khác.', fix: 'Kiểm tra ô Nhân viên mua hàng của các vật tư đó; đổi người nếu phân công đã thay đổi.' },
  ],
  tags: ['kho', 'nhân viên mua hàng', 'người mua phụ trách', 'phân công', 'hàng về kho'],
  sourceRefs: ['src/modules/pages/Admin/masterData/MaterialsPage.tsx', 'DNA-ERP-BE/src/modules/purchase-proposals/purchase-proposals.service.ts'],
};

const suaXoa: GuideArticle = {
  id: 'vt-sua-xoa',
  title: 'Sửa và xoá vật tư',
  roles: ['materials', 'admin'],
  purpose: 'Sửa thông tin một vật tư đã có, hoặc xoá hẳn vật tư khai nhầm. Sửa thì gần như lúc nào cũng làm được; xoá thì chỉ được với vật tư chưa từng được dùng ở đâu.',
  mock: {
    title: 'Sửa vật tư',
    formFields: ['Mã vật tư', 'Tên vật tư', 'Đơn vị tính', 'Quy cách', 'Nhóm vật tư', 'Kho', 'Nhân viên mua hàng', 'Đơn vị mua', 'Hệ số quy đổi', '% dự trù hao hụt khi mua', 'Làm tròn khi mua', 'Ảnh vật tư'],
    buttons: ['Hủy', 'Lưu'],
  },
  tables: [
    {
      title: 'Khi nào không xoá được',
      columns: ['Tình trạng của vật tư', 'Xoá được không', 'Cách xử lý'],
      rows: [
        ['Mới khai, chưa dùng ở đâu', 'Được', 'Bấm thùng rác rồi xác nhận.'],
        ['Đang nằm trong định mức của sản phẩm', 'Không', 'Hệ thống liệt kê các định mức đang dùng (tối đa 5 chỗ). Nhờ chuyên viên định mức gỡ ở các chỗ đó trước, rồi xoá lại.'],
        ['Đã phát sinh dữ liệu: từng có tồn kho, phiếu kho, đề xuất mua hoặc lệnh sản xuất', 'Không, vĩnh viễn', 'Không có cách xoá. Nếu khai nhầm thì sửa lại thông tin cho đúng.'],
      ],
    },
    {
      title: 'Sửa ô nào thì phải cẩn thận',
      columns: ['Ô', 'Điều xảy ra khi sửa', 'Nên làm'],
      rows: [
        ['Đơn vị tính', 'Các con số cũ KHÔNG tự quy đổi: tồn 500 "cái" đổi sang "kg" sẽ thành 500 "kg".', 'Chỉ đổi khi vật tư còn mới, chưa có tồn và chưa nằm trong định mức.'],
        ['Mã vật tư', 'Đổi được, miễn mã mới chưa có vật tư nào dùng.', 'Hạn chế đổi mã của vật tư đang dùng — người khác đã quen gọi theo mã cũ.'],
        ['Kho', 'Hàng KHÔNG chuyển theo. Tồn vẫn ở kho cũ; cột Tồn kho đọc sang kho mới và có thể hiện 0.', 'Muốn chuyển hàng thật thì làm phiếu chuyển kho.'],
        ['Nhóm vật tư / Nhóm con Sắt', 'Các ô phụ thuộc tự xoá (Phân loại, Nhóm con Sắt, % hao hụt).', 'Mở lại vật tư và điền lại theo nhóm mới.'],
        ['% dự trù hao hụt', 'Chỉ áp cho đề xuất mua sinh ra sau khi lưu.', 'Báo bộ phận Mua hàng khi đổi cho nhiều vật tư.'],
      ],
    },
  ],
  steps: [
    'Sửa: bấm icon bút chì ở cuối dòng. Form giống lúc thêm mới, chỉ KHÔNG có ô "Tồn kho ban đầu".',
    'Sửa các ô cần đổi rồi bấm "Lưu". Ô nào không đụng tới thì giữ nguyên giá trị cũ.',
    'Muốn GỠ một lựa chọn (Kho, Nhân viên mua hàng, Nhóm vật tư): chọn dòng "— Không —" ở đầu danh sách rồi Lưu.',
    { text: 'Xoá: bấm icon thùng rác → xác nhận "Xóa vật tư ... ? Hành động này không thể hoàn tác."', critical: true },
  ],
  result: 'Sửa: thay đổi có hiệu lực ngay ở mọi màn đang dùng vật tư đó. Xoá: vật tư biến mất hẳn khỏi danh mục, kèm ảnh của nó.',
  warnings: [
    'Xoá là xoá hẳn, không có thùng rác để khôi phục.',
  ],
  commonErrors: [
    { issue: '"Không xoá được: vật tư ... đang dùng trong định mức ... Gỡ vật tư khỏi các định mức này trước."', cause: 'Vật tư đang được khai trong định mức của một hoặc nhiều sản phẩm.', fix: 'Nhờ chuyên viên định mức gỡ vật tư khỏi các định mức được liệt kê, rồi xoá lại. Nếu vật tư vẫn cần dùng thì không xoá.' },
    { issue: '"Không xoá được: vật tư ... đã phát sinh dữ liệu (tồn kho, phiếu kho, đề xuất mua hoặc sản xuất)."', cause: 'Vật tư đã từng được nhập, xuất, mua hoặc sản xuất.', fix: 'Không xoá được nữa. Nếu khai nhầm, sửa lại thông tin cho đúng thay vì xoá.' },
    { issue: '"Material ... already exists"', cause: 'Mã vừa sửa trùng với vật tư khác.', fix: 'Chọn mã khác hoặc giữ mã cũ.' },
    { issue: 'Sửa xong mà ô Phân loại / % hao hụt bị trống', cause: 'Vừa đổi Nhóm vật tư hoặc Nhóm con Sắt nên các ô phụ thuộc tự xoá.', fix: 'Mở lại vật tư và điền lại ô đó theo nhóm mới.' },
  ],
  tags: ['sửa vật tư', 'xoá vật tư', 'đổi mã', 'đổi đơn vị', 'không xoá được'],
  sourceRefs: ['src/modules/pages/Admin/masterData/MaterialsPage.tsx', 'DNA-ERP-BE/src/modules/materials/materials.service.ts'],
};

/** Các bài chi tiết về màn Vật tư, theo đúng thứ tự nên đọc. */
export const materialsCatalogArticles: GuideArticle[] = [
  bangVatTu,
  themVatTu,
  nhomPhanLoai,
  donViMua,
  haoHut,
  haoHutHangLoat,
  khoNguoiMua,
  suaXoa,
];
