import type { GuideGroup } from '../types';
import type { GuideArticle } from '../types';
import { materialsCatalogArticles, materialsRoleArticle } from './materialsShared';

// Ảnh của các bài Vật tư dùng chung - chụp trong phân hệ Admin (có sidebar quản trị). Bên Quản lý
// vật tư gắn bộ ảnh riêng, xem materials.ts.
const MATERIAL_SCREENSHOTS: Record<string, string> = {
  'admin-quan-ly-vat-tu-role': '/guide-screens/admin-quan-ly-vat-tu-role.png',
  'vt-bang-vat-tu': '/guide-screens/admin-vat-tu.png',
  'vt-them-vat-tu': '/guide-screens/admin-vat-tu-them.png',
  'vt-nhom-phan-loai': '/guide-screens/admin-vat-tu-nhom-con-sat.png',
  'vt-hao-hut-hang-loat': '/guide-screens/admin-vat-tu-hao-hut-hang-loat.png',
  'vt-sua-xoa': '/guide-screens/admin-vat-tu-sua.png',
};
const withMaterialShot = (a: GuideArticle): GuideArticle =>
  MATERIAL_SCREENSHOTS[a.id] ? { ...a, screenshot: MATERIAL_SCREENSHOTS[a.id] } : a;

// Nguồn: AdminApp.tsx, UsersPage.tsx, MfgWarehousesPage.tsx (chế độ isAdmin=true),
// OfficeSuppliesAdminPage.tsx, PhoiSkuAdminPage.tsx, AuditLogPage.tsx, MasterDataPage.tsx
// (SuppliersPage/SalesCustomersPage/ExportCustomersPage/MaterialGroupsPage/MaterialsPage/
// WeavingPointsPage/DefectReasonsPage), BusinessDataPage.tsx, AttachmentsPage.tsx,
// NotificationsPage.tsx, SystemConfigPage.tsx, SystemStatusPage.tsx — đọc mã nguồn 22/09/2026,
// đối chiếu lại 12/10/2026.

export const adminGroup: GuideGroup = {
  id: 'admin',
  title: 'Quản trị hệ thống',
  icon: 'Shield',
  color: 'var(--fg-334155)',
  bg: 'var(--bg-e2e8f0)',
  roles: ['admin', 'materials'],
  description: 'Tạo tài khoản và kho, khai báo danh mục nền (vật tư, khách hàng, NCC...), xử lý sự cố kỹ thuật.',
  articles: [
    {
      id: 'admin-nguoi-dung',
      title: 'Tạo và quản lý tài khoản (Người dùng & Phân quyền)',
      roles: ['admin'],
      purpose: 'Nơi DUY NHẤT tạo tài khoản cho mọi vai trò trong hệ thống, gán "Loại nhân viên" quyết định họ dùng module nào.',
      screenshot: '/guide-screens/admin-nguoi-dung.png',
      mock: {
        title: 'Thêm tài khoản',
        formFields: ['Họ tên *', 'Tên đăng nhập *', 'Email *', 'Mật khẩu *', 'Vai trò *', 'Loại nhân viên'],
        buttons: ['Hủy', 'Lưu'],
      },
      steps: [
        'Bấm "Thêm tài khoản": nhập Họ tên, Tên đăng nhập (tối thiểu 3 ký tự, chỉ chữ/số . _ -), Email, Mật khẩu (tối thiểu 8 ký tự), chọn Vai trò (Quản trị viên / Giám đốc / Nhân viên). Tên đăng nhập và Email chỉ nhập được lúc tạo — khi sửa tài khoản hai ô này chỉ hiển thị.',
        { text: 'Nếu Vai trò = Nhân viên, bắt buộc chọn thêm 1 trong 4 "Loại nhân viên": Văn phòng / Kho / Định mức / Sản xuất — mỗi loại có dropdown con riêng.', critical: true },
        '— Văn phòng: chọn Chức năng (Sales / KH Sản xuất (KHSX) / Quản lý sản xuất (QLSX) / Mua hàng / Quản lý vật tư).',
        '— Kho: chọn Kho phụ trách (không bắt buộc chọn ngay, có thể gán sau).',
        '— Định mức: chọn Vị trí (NV Định mức mảnh / NV Định mức chi tiết).',
        '— Sản xuất: chọn Công đoạn (Phôi/Hàn/Sơn hoặc KCS) + Kho phụ trách (mặc định Kho gốc Phôi Sơn Hàn).',
        'Bấm "Lưu".',
        'Trên mỗi dòng tài khoản có các nút: Khóa/Mở khóa, "Đặt lại mật khẩu" (nhập mật khẩu mới 2 lần — mật khẩu không sửa trong form sửa thông tin), và với nhân viên Mua hàng có thêm "Chuyển giao vật tư mua hàng".',
        { text: 'Nhân viên Mua hàng nghỉ việc/đổi vị trí: bấm "Chuyển giao vật tư mua hàng", chọn người nhận ở "Chuyển cho", bấm "Chuyển N vật tư" — SAU ĐÓ mới khoá tài khoản cũ.', critical: true },
      ],
      result: 'Tài khoản mới có thể đăng nhập và tự động vào đúng module tương ứng với loại nhân viên đã chọn.',
      warnings: [
        'Mỗi tài khoản Kho chỉ phụ trách được đúng 1 kho tại 1 thời điểm — muốn đổi thủ kho của một kho, phải gỡ người cũ (đặt về trống) trước rồi mới gán được người mới.',
        'Không thể tự khoá/xoá/đổi vai trò của chính tài khoản đang đăng nhập.',
        'Hệ thống CHẶN khoá, xoá hoặc bỏ chức năng Mua hàng của một tài khoản khi người đó còn đang phụ trách vật tư — phải chuyển giao hết vật tư trước. Đừng đổi tên tài khoản cũ để giao cho người mới: lịch sử duyệt mua lưu theo tài khoản, đổi tên sẽ ghi việc người cũ đã làm sang tên người mới.',
        'Việc phân công vật tư cho từng nhân viên Mua hàng làm ở Admin > Vật tư (cột "Nhân viên mua hàng"), không còn gán theo kho.',
      ],
      commonErrors: [
        { issue: '"Email ... is already in use" / "Username ... is already in use"', cause: 'Email hoặc tên đăng nhập đã tồn tại.', fix: 'Đổi sang giá trị khác chưa dùng.' },
        { issue: '"You cannot change your own roles" / "...deactivate your own account" / "...delete your own account"', cause: 'Đang cố tự khoá/xoá/đổi vai trò chính mình.', fix: 'Nhờ một Admin khác thực hiện thay nếu thật sự cần.' },
        { issue: '"Bắt buộc" hiện dưới một trường', cause: 'Trường bắt buộc bị bỏ trống.', fix: 'Điền đầy đủ các trường có dấu *.' },
      ],
      statuses: [
        { name: 'Hoạt động', meaning: 'Tài khoản đăng nhập được bình thường.' },
        { name: 'Đã khóa', meaning: 'Không đăng nhập được — dùng nút khoá/mở khoá theo dòng để chuyển đổi.' },
      ],
      tags: ['tạo tài khoản', 'người dùng', 'phân quyền', 'loại nhân viên'],
      sourceRefs: ['src/modules/pages/Admin/UsersPage.tsx'],
    },
    {
      id: 'admin-quan-ly-kho',
      title: 'Tạo và xoá kho',
      roles: ['admin'],
      purpose: 'Nơi DUY NHẤT tạo thêm kho vật lý mới hoặc xoá kho — Giám đốc/Thủ kho chỉ xem được, không tạo/xoá được.',
      screenshot: '/guide-screens/admin-quan-ly-kho.png',
      mock: {
        title: 'Tạo kho mới',
        formFields: ['Loại kho *', 'Tên kho *', 'Thủ kho phụ trách'],
        buttons: ['Tạo kho'],
      },
      steps: [
        'Bấm "Tạo kho mới": chọn Loại kho (một trong 3 gia đình: Phôi Sơn Hàn / Vật tư thành phẩm / Thành phẩm), đặt Tên kho (có gợi ý sẵn), tuỳ chọn chọn 1 tài khoản Thủ kho có sẵn (chỉ hiện người CHƯA phụ trách kho nào) để gán ngay.',
        'Mở chi tiết một kho: tab "Tồn kho" (Mã vật tư / Tên / Nhóm / Quy cách / ĐVT / Tồn / Khả dụng; kho Phôi Sơn Hàn có thêm cột "Chiều dài" theo cỡ cây) và tab "Lịch sử Nhập/Xuất". Dùng "Thêm vật tư" hoặc "Sao chép vật tư từ kho khác" để không phải khai lại danh mục từ đầu cho kho mới.',
        { text: 'Sửa nhanh số tồn: bấm vào con số ở cột "Tồn" (gạch chân chấm), nhập số mới và xác nhận — hệ thống ghi một bút toán điều chỉnh vào lịch sử kho.', critical: true },
        { text: 'Bấm "Xoá kho" (chỉ hiện với kho không phải 1 trong 3 kho gốc) để xoá một kho phụ không còn dùng.', critical: true },
      ],
      result: 'Tạo: kho mới hoạt động độc lập như kho gốc cùng gia đình. Xoá: kho và (các) tài khoản đang được gán phụ trách kho đó bị xoá cùng lúc — không thể hoàn tác.',
      warnings: [
        '3 kho gốc (Phôi Sơn Hàn, Vật tư thành phẩm, Thành phẩm) và các kho ảo hệ thống được bảo vệ — không xoá/đổi mã được.',
        'Nếu kho còn vật tư/tồn kho tham chiếu, thao tác xoá sẽ thất bại toàn bộ (không xoá dở dang) — phải xử lý hết dữ liệu liên quan trước.',
        'Một tài khoản Kho chỉ phụ trách 1 kho: chọn một thủ kho đang phụ trách kho khác làm "Thủ kho phụ trách" của kho mới sẽ CHUYỂN họ khỏi kho hiện tại (form có cảnh báo trước khi tạo).',
      ],
      commonErrors: [
        { issue: '"Warehouse ... already exists"', cause: 'Mã kho bị trùng (hiếm gặp vì mã tự sinh).', fix: 'Thử tạo lại.' },
        { issue: '"Warehouse ... is protected and cannot be deleted/renamed"', cause: 'Cố xoá/đổi tên 1 trong 3 kho gốc hoặc kho ảo hệ thống.', fix: 'Không thao tác được với các kho này — đây là giới hạn có chủ đích.' },
      ],
      tags: ['tạo kho', 'xoá kho', 'quản lý kho', 'sao chép vật tư'],
      sourceRefs: ['src/modules/pages/Manufacturing/MfgWarehousesPage.tsx'],
    },
    {
      id: 'admin-nhom-vat-tu',
      title: 'Nhóm vật tư — tạo, sửa, xoá nhóm',
      roles: ['admin'],
      purpose: 'Nhóm vật tư là khung phân loại mà mọi vật tư phải thuộc về. Chỉ Admin tạo/sửa/xoá được nhóm; tài khoản Quản lý vật tư chỉ chọn nhóm có sẵn khi khai vật tư.',
      mock: {
        title: 'Thêm nhóm vật tư',
        formFields: ['Tên nhóm vật tư *', 'Tiền tố mã vật tư *'],
        buttons: ['Hủy', 'Lưu'],
      },
      steps: [
        'Vào Danh mục hệ thống > tab "Nhóm vật tư", bấm "Thêm nhóm vật tư".',
        'Nhập "Tên nhóm vật tư". Ô "Tiền tố mã vật tư" tự gợi ý theo tên, sửa được: 2-8 ký tự, chỉ chữ IN HOA A-Z và số, không trùng nhóm khác.',
        'Tiền tố dùng để tự sinh mã cho vật tư trong nhóm (VD tiền tố SAT → SAT-001, SAT-002...).',
        'Bấm "Lưu".',
      ],
      result: 'Nhóm mới xuất hiện ở ô chọn "Nhóm vật tư" của form Vật tư và ở dãy nút lọc phía trên bảng Vật tư.',
      warnings: [
        '6 nhóm hệ thống (Sắt, Dây, Đinh, Tán rút, Nút nhựa, Vật tư khác) gắn với các luồng định mức và mua hàng — vật tư thuộc nhóm tự tạo sẽ KHÔNG hiện ở các tab định mức đó. Chỉ tạo nhóm mới khi thật sự cần một cách phân loại khác.',
        'Xoá một nhóm không xoá vật tư trong nhóm, nhưng các vật tư đó trở thành "không có nhóm" và biến mất khỏi mọi ô chọn định mức cho tới khi được gán nhóm khác.',
      ],
      commonErrors: [
        { issue: '"Tiền tố mã phải 2-8 ký tự, chỉ chữ IN HOA A-Z và số"', cause: 'Tiền tố có chữ thường, dấu hoặc ký tự đặc biệt.', fix: 'Sửa lại đúng định dạng.' },
      ],
      tags: ['nhóm vật tư', 'tiền tố mã', 'material group'],
      sourceRefs: ['src/modules/pages/Admin/masterData/MaterialGroupsPage.tsx'],
    },
    ...materialsCatalogArticles.map(withMaterialShot),
    withMaterialShot(materialsRoleArticle),
    {
      id: 'admin-danh-muc-khac',
      title: 'Danh mục hệ thống khác: Nhà cung cấp, Khách hàng, Định mức vật tư thành phẩm, Điểm đan, Lý do lỗi',
      roles: ['admin'],
      purpose: 'Khai báo các danh mục nền còn lại dùng chung cho nhiều phân hệ nghiệp vụ.',
      screenshot: '/guide-screens/admin-danh-muc-khac.png',
      mock: {
        title: 'Thêm nhà cung cấp',
        formFields: ['Tên nhà cung cấp *', 'Điện thoại', 'Đang hoạt động'],
        buttons: ['Lưu'],
      },
      steps: [
        '"Nhà cung cấp": Tên*, Điện thoại, trạng thái hoạt động.',
        '"Khách hàng bán hàng" / "Khách hàng xuất khẩu": khai báo khách hàng (2 màn dùng chung 1 bảng dữ liệu nhưng khai báo field khác nhau — cần lưu ý khi tra cứu chéo).',
        '"Định mức vật tư thành phẩm": khai "1 vật tư vào cắt ra N vật tư ra" (ví dụ thanh nhôm → chân nhôm) — xem bài "Định mức vật tư thành phẩm" ở nhóm Sản xuất của trang hướng dẫn chung (/guide).',
        '"Điểm đan": Mã/Tên điểm đan*, Tên đầy đủ, điện thoại, địa chỉ, trạng thái hoạt động — dùng khi Thủ kho xuất/nhập đan (Thủ kho Vật tư thành phẩm cũng tự thêm được ở "Quản lý điểm đan").',
        '"Lý do lỗi": nội dung lỗi + công đoạn (Phôi/Hàn/Sơn) — danh mục cho KCS chọn khi chấm lỗi.',
      ],
      result: 'Các danh mục này sẵn sàng để chọn ở đúng màn nghiệp vụ tương ứng (Mua hàng chọn NCC, Sales chọn khách hàng, Kho chọn điểm đan, KCS chọn lý do lỗi).',
      warnings: ['Đây là dữ liệu nền dùng chung — sửa/xoá tại đây ảnh hưởng tới mọi phân hệ đang tham chiếu.'],
      commonErrors: [
        { issue: 'Xoá Nhà cung cấp/Nhóm vật tư xong các vật tư liên quan mất tên nhóm/NCC', cause: 'Xoá danh mục không kiểm tra ràng buộc — các bản ghi liên quan chỉ mất liên kết, không bị xoá theo.', fix: 'Cân nhắc kỹ trước khi xoá danh mục đang được tham chiếu.' },
      ],
      tags: ['nhà cung cấp', 'khách hàng', 'điểm đan', 'lý do lỗi', 'danh mục'],
      sourceRefs: ['src/modules/pages/Admin/MasterDataPage.tsx'],
    },
    {
      id: 'admin-sua-sku-phoi',
      title: 'Sửa SKU đợt Phôi (gán lại SKU cho đợt cắt nhầm)',
      roles: ['admin'],
      purpose: 'Sửa lại SKU khi Tổ Phôi gán nhầm SKU cho một đợt cắt/uốn/dập — chỉ Admin sửa lại được vì Phôi chỉ gán được một lần.',
      preconditions: ['Áp dụng cho PI có từ 2 SKU trở lên (PI 1 SKU thì mọi đợt tự tính đúng cho SKU đó, không cần sửa).'],
      screenshot: '/guide-screens/admin-sua-sku-phoi.png',
      mock: {
        title: 'Sửa SKU đợt Phôi',
        columns: ['Đợt', 'SKU hiện tại', 'Sửa SKU'],
        rows: [['Đợt #12', 'GHE-001', '▾ Chọn SKU mới…']],
        buttons: ['Đổi'],
      },
      steps: [
        'Chọn PI cần sửa.',
        'Ở bảng "Các đợt Phôi", chọn SKU mới ở dropdown "Sửa SKU" cho đúng đợt, bấm "Đổi".',
        { text: 'Xác nhận trong hộp thoại.', critical: true },
      ],
      result: 'Đợt Phôi được gán lại đúng SKU; lịch sử đổi được ghi lại và hiển thị ngay bên dưới bảng.',
      commonErrors: [
        { issue: '"Không đổi được SKU"', cause: 'Lỗi từ máy chủ khi lưu thay đổi.', fix: 'Kiểm tra lại và thử lại.' },
      ],
      tags: ['sửa sku phôi', 'gán lại sku', 'cut bundle'],
      sourceRefs: ['src/modules/pages/Admin/PhoiSkuAdminPage.tsx'],
    },
    {
      id: 'admin-tep-dinh-kem',
      title: 'Quản lý tệp đính kèm — sửa/xoá bằng chứng đã tải lên',
      roles: ['admin'],
      purpose: 'Sửa sai khi lỡ tải nhầm ảnh/file bằng chứng ở 3 nơi vốn chỉ tạo mới, không tự sửa/xoá được trong luồng nghiệp vụ bình thường: ảnh lỗi KCS, ảnh lỗi chuyền kiểm kho, phiếu Giám đốc đã ký duyệt mua hàng.',
      screenshot: '/guide-screens/admin-tep-dinh-kem.png',
      mock: { title: 'Quản lý tệp đính kèm', buttons: ['KCS', 'Kho', 'Mua hàng', 'Thay file', 'Xóa file'] },
      steps: [
        'Chọn đúng tab: "KCS" (ảnh lỗi kiểm chất lượng) / "Kho" (ảnh lỗi chuyền kiểm) / "Mua hàng" (file Giám đốc đã ký).',
        { text: 'Bấm "Đổi ảnh/Thay file" để thay bằng file mới, hoặc "Xóa ảnh/Xóa file" để xoá hẳn — xác nhận trong hộp thoại "Không thể hoàn tác".', critical: true },
      ],
      result: 'Bằng chứng được cập nhật hoặc xoá; mọi thao tác được ghi lại vào nhật ký thật của hệ thống.',
      warnings: [
        'Xoá file phiếu Giám đốc đã ký (tab "Mua hàng") CHỈ mất bằng chứng lịch sử — không ảnh hưởng tới việc Kho nhận hàng, vì bước nhận hàng không đọc file này.',
        'Chỉ dùng tính năng này khi thật sự cần — hành động không thể hoàn tác.',
      ],
      tags: ['tệp đính kèm', 'xoá ảnh lỗi', 'xoá file duyệt mua'],
      sourceRefs: ['src/modules/pages/Admin/AttachmentsPage.tsx'],
    },
    {
      id: 'admin-cat-sat-tinh-lai',
      title: '"Module nghiệp vụ" > Cắt sắt — nút "Tính lại" (thao tác thật, không chỉ xem)',
      roles: ['admin'],
      purpose: 'Gọi lại công cụ tính phương án cắt sắt (solver) khi phương án bị lỗi hoặc cần xử lý — hầu hết các tab khác trong "Module nghiệp vụ" chỉ để tra cứu, riêng tab này có thao tác ghi thật.',
      preconditions: ['Phương án cắt đang ở trạng thái cần xử lý (hiện nút "Tính lại").'],
      screenshot: '/guide-screens/admin-cat-sat-tinh-lai.png',
      mock: {
        title: 'Cắt sắt',
        columns: ['Mã PO', 'SKU / Sản phẩm', 'Trạng thái', 'Tổng số cây', 'Hao hụt %', 'Ngày yêu cầu', 'Thao tác'],
        rows: [['PO-2026-014', 'GHE-001 — Ghế ăn mây nhựa', 'Cần xử lý', '—', '—', '01/10/2026 09:10', 'Tính lại']],
        buttons: ['Tính lại'],
      },
      steps: [
        'Bấm một dòng để mở "Chi tiết đề xuất cắt sắt": từng loại sắt Khả thi/Không khả thi, Số cây, Hao hụt %, Chiều dài (có nhãn "⚠ đặt riêng" nếu không phải cây chuẩn), thời gian giải.',
        { text: 'Bấm "Tính lại" trên dòng cần xử lý — xác nhận "Gọi lại solver cho ... — kết quả cũ (nếu có) sẽ được thay thế bằng phương án mới."', critical: true },
      ],
      result: 'Hệ thống tính lại phương án cắt sắt mới cho PO/PI đó, thay thế kết quả cũ.',
      warnings: [
        'Đừng nhầm đây là "chỉ xem" như các tab còn lại trong "Module nghiệp vụ" — đây là hành động THẬT, kích hoạt lại việc tính toán.',
      ],
      commonErrors: [
        { issue: '"Lỗi tính lại"', cause: 'Solver gặp lỗi hoặc dữ liệu đầu vào không hợp lệ.', fix: 'Kiểm tra lại dữ liệu định mức/tồn kho liên quan trước khi thử lại.' },
      ],
      tags: ['tính lại phương án cắt', 'solver', 'cutting proposal retry'],
      sourceRefs: ['src/modules/pages/Admin/businessData/CuttingProposalsPage.tsx'],
    },
    {
      id: 'admin-thong-bao',
      title: 'Gửi thông báo chung',
      roles: ['admin'],
      purpose: 'Soạn tay một thông báo chung (lịch nghỉ, thay đổi quy trình...) gửi tới một nhóm người dùng. Thông báo về từng lệnh sản xuất/đơn hàng cụ thể do hệ thống tự phát, không tạo ở đây.',
      screenshot: '/guide-screens/admin-thong-bao.png',
      mock: {
        title: 'Tạo thông báo chung',
        formFields: ['Tiêu đề', 'Nội dung', 'Đối tượng nhận'],
        buttons: ['Hủy', 'Gửi thông báo'],
      },
      steps: [
        'Bấm "Tạo thông báo", nhập Tiêu đề, Nội dung, chọn Đối tượng nhận (Tất cả / Giám đốc / Nhân viên kho / Quản lý sản xuất).',
        { text: 'Bấm "Gửi thông báo".', critical: false },
        'Theo dõi ở bảng bên dưới: Tiêu đề / Nội dung / Đối tượng / Đã đọc / Thời gian.',
      ],
      result: 'Người dùng thuộc đối tượng nhận thấy thông báo ở chuông thông báo của họ (loại "Thông báo chung").',
      warnings: ['Không có nút Sửa/Xoá thông báo sau khi đã gửi.'],
      tags: ['thông báo', 'notification'],
      sourceRefs: ['src/modules/pages/Admin/NotificationsPage.tsx'],
    },
    {
      id: 'admin-nhat-ky-canh-bao',
      title: 'Lưu ý về "Tổng quan", "Nhật ký hoạt động", "Văn phòng phẩm" và "Tình trạng hệ thống"',
      roles: ['admin'],
      purpose: 'Hiểu đúng phạm vi và giới hạn của 2 màn quản trị dễ gây hiểu nhầm nhất.',
      steps: [
        '"Tổng quan": số liệu tham khảo — tổng người dùng theo vai trò, hoạt động gần đây, số đơn hàng bán / lệnh sản xuất (PI) / nhà cung cấp. Không thao tác gì ở đây.',
        '"Văn phòng phẩm": chọn một kho ở ô "Chọn kho" để xem và quản lý vật tư văn phòng của đúng kho đó — thao tác giống hệt tab "Văn phòng phẩm" của Thủ kho.',
        '"Nhật ký hoạt động": ghi lại các thao tác thêm/sửa/xoá ở Admin (Người dùng, Danh mục hệ thống...). Đây KHÔNG phải nhật ký kỹ thuật của máy chủ — dữ liệu lưu trong trình duyệt hiện tại, không đồng bộ giữa các máy/trình duyệt khác nhau và sẽ mất nếu xoá bộ nhớ đệm. Việc sửa/xoá tệp đính kèm (ảnh lỗi KCS/Kho, phiếu duyệt mua) KHÔNG hiện ở đây — được ghi vào nhật ký phía máy chủ mà trang này chưa đọc; việc đổi SKU đợt Phôi có bảng "Lịch sử đổi SKU" riêng ngay dưới bảng thao tác của nó.',
        '"Tình trạng hệ thống" > "Reset dữ liệu demo": CHỈ xoá dữ liệu mẫu còn sót trong trình duyệt (chủ yếu ảnh hưởng Nhật ký hoạt động) — KHÔNG xoá dữ liệu thật đã lưu trên máy chủ (người dùng, đơn hàng, vật tư, kho... đã hoạt động thật không bị ảnh hưởng), dù dòng xác nhận của nút này liệt kê như thể sẽ mất toàn bộ.',
      ],
      result: 'Tránh hoang mang hoặc chủ quan sai khi thao tác 2 màn này.',
      warnings: [
        'Đừng dựa vào "Nhật ký hoạt động" làm bằng chứng pháp lý/kiểm toán chính thức — nó không đầy đủ và không đồng bộ đa thiết bị.',
        '"Cấu hình hệ thống" (thông tin công ty) hiện chỉ mang tính hiển thị tham khảo — chưa có nghiệp vụ nào trong hệ thống tự động đọc và sử dụng các giá trị này.',
      ],
      tags: ['nhật ký hoạt động', 'reset dữ liệu demo', 'tình trạng hệ thống', 'cấu hình hệ thống'],
      sourceRefs: ['src/modules/pages/Admin/AuditLogPage.tsx', 'src/modules/pages/Admin/SystemStatusPage.tsx', 'src/modules/pages/Admin/SystemConfigPage.tsx'],
    },
  ],
};
