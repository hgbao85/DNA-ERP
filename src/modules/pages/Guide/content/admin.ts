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
      tables: [
        {
          title: 'Từng ô trên form "Thêm tài khoản"',
          columns: ['Ô', 'Bắt buộc', 'Quy tắc'],
          rows: [
            ['Họ tên', 'Có', 'Tên hiển thị của người dùng.'],
            ['Tên đăng nhập', 'Có', 'Tối thiểu 3 ký tự, chỉ chữ, số và các dấu . _ -. Chỉ nhập được lúc tạo — khi sửa tài khoản ô này chỉ hiển thị.'],
            ['Email', 'Có', 'Chỉ nhập được lúc tạo — khi sửa tài khoản ô này chỉ hiển thị.'],
            ['Mật khẩu', 'Có', 'Tối thiểu 8 ký tự. Sau này đổi bằng nút "Đặt lại mật khẩu", không sửa trong form sửa thông tin.'],
            ['Vai trò', 'Có', 'Quản trị viên / Giám đốc / Nhân viên.'],
            ['Loại nhân viên', 'Có, khi Vai trò là Nhân viên', 'Văn phòng / Kho / Định mức / Sản xuất — xem bảng dưới.'],
          ],
        },
        {
          title: 'Loại nhân viên và ô phải chọn kèm',
          intro: 'Loại nhân viên quyết định người đó dùng phân hệ nào sau khi đăng nhập.',
          columns: ['Loại nhân viên', 'Ô chọn kèm', 'Các lựa chọn'],
          rows: [
            ['Văn phòng', 'Chức năng', 'Sales / KH Sản xuất (KHSX) / Quản lý sản xuất (QLSX) / Mua hàng / Quản lý vật tư.'],
            ['Kho', 'Kho phụ trách', 'Không bắt buộc chọn ngay, có thể gán sau.'],
            ['Định mức', 'Vị trí', 'NV Định mức mảnh / NV Định mức chi tiết.'],
            ['Sản xuất', 'Công đoạn và Kho phụ trách', 'Công đoạn: Phôi/Hàn/Sơn hoặc KCS. Kho phụ trách mặc định là Kho gốc Phôi Sơn Hàn.'],
          ],
        },
        {
          title: 'Các nút trên mỗi dòng tài khoản',
          columns: ['Nút', 'Dùng để', 'Lưu ý'],
          rows: [
            ['Khóa / Mở khóa', 'Chặn hoặc cho phép tài khoản đăng nhập.', 'Không tự khoá được chính mình.'],
            ['Đặt lại mật khẩu', 'Đặt mật khẩu mới cho người dùng.', 'Nhập mật khẩu mới 2 lần.'],
            ['Chuyển giao vật tư mua hàng', 'Chuyển toàn bộ vật tư một nhân viên Mua hàng đang phụ trách sang người khác: chọn người nhận ở "Chuyển cho", bấm "Chuyển N vật tư".', 'Chỉ có với nhân viên Mua hàng. Làm TRƯỚC khi khoá tài khoản cũ.'],
          ],
        },
      ],
      stepsTitle: 'Tạo tài khoản mới',
      steps: [
        'Bấm "Thêm tài khoản".',
        'Nhập Họ tên, Tên đăng nhập, Email, Mật khẩu và chọn Vai trò theo bảng trên.',
        { text: 'Nếu Vai trò là Nhân viên: chọn "Loại nhân viên", rồi chọn ô kèm theo của loại đó.', critical: true },
        'Bấm "Lưu".',
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
      tables: [
        {
          title: 'Từng ô khi tạo kho',
          columns: ['Ô', 'Bắt buộc', 'Điền gì'],
          rows: [
            ['Loại kho', 'Có', 'Một trong 3 gia đình: Phôi Sơn Hàn / Vật tư thành phẩm / Thành phẩm.'],
            ['Tên kho', 'Có', 'Có gợi ý sẵn, sửa được.'],
            ['Thủ kho phụ trách', 'Không', 'Chọn một tài khoản Kho có sẵn để gán ngay. Danh sách chỉ gồm người CHƯA phụ trách kho nào.'],
          ],
        },
        {
          title: 'Trong chi tiết một kho',
          columns: ['Chỗ', 'Có gì', 'Lưu ý'],
          rows: [
            ['Tab "Tồn kho"', 'Mã vật tư / Tên / Nhóm / Quy cách / ĐVT / Tồn / Khả dụng.', 'Kho Phôi Sơn Hàn có thêm cột "Chiều dài" theo cỡ cây.'],
            ['Tab "Lịch sử Nhập/Xuất"', 'Mọi lần nhập, xuất, điều chỉnh của kho.', '—'],
            ['"Thêm vật tư" / "Sao chép vật tư từ kho khác"', 'Đưa vật tư vào kho mới mà không phải khai lại danh mục từ đầu.', '—'],
            ['Con số ở cột "Tồn" (gạch chân chấm)', 'Sửa nhanh số tồn: bấm vào số, nhập số mới và xác nhận.', 'Hệ thống ghi một bút toán điều chỉnh vào lịch sử kho.'],
            ['"Xoá kho"', 'Xoá một kho phụ không còn dùng.', 'Chỉ hiện với kho không phải 1 trong 3 kho gốc. Không hoàn tác được.'],
          ],
        },
      ],
      stepsTitle: 'Tạo kho mới',
      steps: [
        'Bấm "Tạo kho mới".',
        'Chọn Loại kho, đặt Tên kho, tuỳ chọn chọn Thủ kho phụ trách.',
        { text: 'Bấm "Tạo kho".', critical: true },
        'Mở kho vừa tạo, dùng "Sao chép vật tư từ kho khác" hoặc "Thêm vật tư" để có danh mục vật tư cho kho.',
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
      screenshot: '/guide-screens/admin-nhom-vat-tu.png',
      mock: {
        title: 'Thêm nhóm vật tư',
        formFields: ['Tên nhóm vật tư *', 'Tiền tố mã vật tư *'],
        buttons: ['Hủy', 'Lưu'],
      },
      tables: [
        {
          title: 'Hai ô trên form',
          columns: ['Ô', 'Bắt buộc', 'Quy tắc', 'Ví dụ'],
          rows: [
            ['Tên nhóm vật tư', 'Có', 'Tên hiển thị của nhóm.', 'Keo dán'],
            ['Tiền tố mã vật tư', 'Có', 'Tự gợi ý theo tên, sửa được. 2-8 ký tự, chỉ chữ IN HOA A-Z và số, không trùng nhóm khác. Dùng để tự sinh mã cho vật tư trong nhóm.', 'SAT → SAT-001, SAT-002...'],
          ],
        },
      ],
      steps: [
        'Vào Danh mục hệ thống > tab "Nhóm vật tư", bấm "Thêm nhóm vật tư".',
        'Nhập "Tên nhóm vật tư" và kiểm tra "Tiền tố mã vật tư".',
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
      tables: [
        {
          title: 'Năm danh mục',
          columns: ['Danh mục', 'Khai gì', 'Dùng ở đâu'],
          rows: [
            ['Nhà cung cấp', 'Tên (bắt buộc), Điện thoại, trạng thái hoạt động.', 'Mua hàng chọn nhà cung cấp.'],
            ['Khách hàng bán hàng / Khách hàng xuất khẩu', 'Thông tin khách hàng. Hai màn dùng chung một bảng dữ liệu nhưng khai các ô khác nhau — lưu ý khi tra cứu chéo.', 'Sales chọn khách hàng khi tạo đơn.'],
            ['Định mức vật tư thành phẩm', '"1 vật tư vào cắt ra N vật tư ra" (VD thanh nhôm → chân nhôm).', 'Tính nguyên liệu cho Sắt nhóm con "Vật tư thành phẩm". Xem bài cùng tên ở nhóm Sản xuất của trang hướng dẫn chung (/guide).'],
            ['Điểm đan', 'Mã/Tên điểm đan (bắt buộc), Tên đầy đủ, điện thoại, địa chỉ, trạng thái hoạt động.', 'Thủ kho chọn khi xuất/nhập đan. Thủ kho Vật tư thành phẩm cũng tự thêm được ở "Quản lý điểm đan".'],
            ['Lý do lỗi', 'Nội dung lỗi và công đoạn (Phôi/Hàn/Sơn).', 'KCS chọn khi chấm lỗi.'],
          ],
        },
      ],
      steps: [],
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
      id: 'admin-sua-dinh-muc-sku',
      title: '"Sửa định mức SKU" — ghi đè định mức của SKU đã duyệt',
      roles: ['admin'],
      purpose: 'Sửa định mức mảnh hoặc định mức chi tiết (Sơn/Phụ kiện/Bao bì) của 1 SKU ngay cả khi đã qua KHSX/Sếp duyệt — không cần gửi lại và chờ duyệt lại như luồng bình thường.',
      preconditions: ['Chỉ Admin thấy menu này và ghi đè được — Chuyên viên định mức mảnh/chi tiết vẫn theo đúng luồng duyệt bình thường.'],
      screenshot: '/guide-screens/admin-sua-dinh-muc-sku.png',
      mock: { title: 'Sửa định mức SKU', buttons: ['Định mức mảnh', 'Định mức chi tiết'] },
      steps: [
        'Mở Admin > "Sửa định mức SKU", chọn "Định mức mảnh" hoặc "Định mức chi tiết" — 2 màn này tái dùng nguyên giao diện nhập định mức của Chuyên viên định mức (Sắt / Chi tiết), chỉ khác là không bị khoá khi SKU đã duyệt.',
        'Chọn SKU cần sửa — kể cả SKU mang nhãn "✓ Đã duyệt (Admin ghi đè)" cũng hiện ở đây (tài khoản Chuyên viên định mức không thấy SKU đã duyệt trong danh sách của họ).',
        'Sửa mảnh/vật tư như bình thường.',
        { text: 'Bấm nút ở cuối trang — với SKU đã duyệt, nút ghi rõ "Ghi đè định mức →" (khác "Gửi phê duyệt →" của luồng thường) để tránh bấm nhầm.', critical: true },
      ],
      result: 'Định mức được ghi đè ngay lập tức, không qua bước chờ KHSX/Sếp duyệt lại; SKU vẫn mang nhãn "Admin ghi đè" để phân biệt với định mức duyệt theo luồng thường.',
      warnings: [
        'Hành động ghi đè không có bước "từ chối" để lùi lại như luồng duyệt thường — sửa sai thì phải vào sửa lại lần nữa.',
        'SKU chưa từng duyệt (đang "Có thể nhập", "Chờ duyệt" hoặc "Bị từ chối") thì màn này hoạt động y hệt tài khoản Chuyên viên định mức, không có gì khác biệt.',
        'Với SKU có tick màu dây/màu nệm: không gỡ được tick của một màu đang nằm trên dòng đơn chưa giao hết — hệ thống chặn (409) và nêu mã vật tư cùng mã đơn đang dùng. Chờ các đơn đó giao xong rồi mới gỡ.',
      ],
      tags: ['ghi đè định mức', 'sửa định mức sku', 'sku đã duyệt'],
      sourceRefs: ['src/modules/pages/Admin/SkuQuotaAdminPage.tsx'],
    },
    {
      id: 'admin-tep-dinh-kem',
      title: 'Quản lý tệp đính kèm — sửa/xoá bằng chứng đã tải lên',
      roles: ['admin'],
      purpose: 'Sửa sai khi lỡ tải nhầm ảnh/file bằng chứng ở 3 nơi vốn chỉ tạo mới, không tự sửa/xoá được trong luồng nghiệp vụ bình thường: ảnh lỗi KCS, ảnh lỗi chuyền kiểm kho, phiếu Giám đốc đã ký duyệt mua hàng.',
      screenshot: '/guide-screens/admin-tep-dinh-kem.png',
      mock: { title: 'Quản lý tệp đính kèm', buttons: ['KCS', 'Kho', 'Mua hàng', 'Thay file', 'Xóa file'] },
      tables: [
        {
          title: 'Ba tab',
          columns: ['Tab', 'Chứa gì', 'Xoá thì ảnh hưởng gì'],
          rows: [
            ['KCS', 'Ảnh lỗi kiểm chất lượng.', 'Mất ảnh bằng chứng của lần chấm lỗi đó.'],
            ['Kho', 'Ảnh lỗi chuyền kiểm.', 'Mất ảnh bằng chứng của lần chuyền kiểm đó.'],
            ['Mua hàng', 'File phiếu Giám đốc đã ký duyệt mua.', 'Chỉ mất bằng chứng lịch sử. Không ảnh hưởng việc Kho nhận hàng, vì bước nhận hàng không đọc file này.'],
          ],
        },
      ],
      steps: [
        'Chọn đúng tab theo bảng trên.',
        { text: 'Bấm "Đổi ảnh/Thay file" để thay bằng file mới, hoặc "Xóa ảnh/Xóa file" để xoá hẳn — xác nhận trong hộp thoại "Không thể hoàn tác".', critical: true },
      ],
      result: 'Bằng chứng được cập nhật hoặc xoá; mọi thao tác được ghi lại vào nhật ký thật của hệ thống.',
      warnings: [
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
      id: 'admin-cau-hinh-qr-ip',
      title: '"Cấu hình hệ thống" — địa chỉ tem QR và giới hạn mạng công nhân',
      roles: ['admin'],
      purpose: '2 cài đặt có tác dụng thật (khác các trường thông tin công ty khác, chỉ mang tính hiển thị): địa chỉ in trên tem QR của xưởng, và giới hạn mạng được phép cho tài khoản công nhân/tổ Phôi-Hàn-Sơn.',
      screenshot: '/guide-screens/admin-cau-hinh-qr-ip.png',
      steps: [
        'Mở Admin > "Cấu hình hệ thống". Ở "Địa chỉ ERP dùng cho tem QR máy xưởng": điền đúng địa chỉ thật mà điện thoại ở xưởng mở được (vd https://erpdna.vercel.app) — để trống thì tem dùng địa chỉ trình duyệt đang mở lúc QLSX in tem.',
        'Ở "Mạng công ty được phép đăng nhập (công nhân)": mỗi dòng 1 địa chỉ IP công cộng (hoặc dải IP) của công ty, có thể ghi chú sau dấu #. Mở màn này từ đúng mạng công ty rồi bấm "Thêm IP hiện tại của tôi" để điền nhanh.',
      ],
      result: 'Tem QR dẫn đúng về hệ thống thật; nếu có khai ít nhất 1 IP, tài khoản công nhân và tổ Phôi/Hàn/Sơn chỉ đăng nhập và thao tác được khi đang nối đúng mạng đó (dùng 4G hoặc mạng ngoài sẽ bị chặn ngay, kể cả người đang đăng nhập dở).',
      warnings: [
        'Đã dán tem rồi thì đừng đổi địa chỉ tem QR nếu không thật sự cần — tem cũ chỉ còn quét được nếu địa chỉ cũ vẫn hoạt động.',
        'Giới hạn mạng CHỈ áp dụng cho công nhân/tổ Phôi-Hàn-Sơn — Sếp, QLSX, KCS, Admin không bị giới hạn bởi cài đặt này.',
        'Để trống ô giới hạn mạng = không giới hạn gì (đăng nhập được từ bất kỳ đâu).',
      ],
      tags: ['tem qr', 'địa chỉ tem qr', 'giới hạn ip', 'mạng công ty', 'cấu hình hệ thống'],
      sourceRefs: ['src/modules/pages/Admin/SystemConfigPage.tsx'],
    },
    {
      id: 'admin-nhat-ky-canh-bao',
      title: 'Lưu ý về "Tổng quan", "Nhật ký hoạt động", "Văn phòng phẩm" và "Tình trạng hệ thống"',
      roles: ['admin'],
      purpose: 'Hiểu đúng phạm vi và giới hạn của các màn quản trị dễ gây hiểu nhầm nhất.',
      tables: [
        {
          title: 'Bốn màn và giới hạn của từng màn',
          columns: ['Màn', 'Để làm gì', 'Giới hạn cần biết'],
          rows: [
            ['Tổng quan', 'Số liệu tham khảo: tổng người dùng theo vai trò, hoạt động gần đây, số đơn hàng bán / lệnh sản xuất (PI) / nhà cung cấp.', 'Không thao tác gì ở đây.'],
            ['Văn phòng phẩm', 'Chọn một kho ở ô "Chọn kho" để xem và quản lý vật tư văn phòng của đúng kho đó.', 'Thao tác giống hệt tab "Văn phòng phẩm" của Thủ kho.'],
            ['Nhật ký hoạt động', 'Ghi lại các thao tác thêm/sửa/xoá ở Admin (Người dùng, Danh mục hệ thống...).', 'KHÔNG phải nhật ký kỹ thuật của máy chủ: dữ liệu lưu trong trình duyệt hiện tại, không đồng bộ giữa các máy và sẽ mất nếu xoá bộ nhớ đệm. Việc sửa/xoá tệp đính kèm không hiện ở đây; việc đổi SKU đợt Phôi có bảng "Lịch sử đổi SKU" riêng.'],
            ['Tình trạng hệ thống > "Reset dữ liệu demo"', 'Xoá dữ liệu mẫu còn sót trong trình duyệt (chủ yếu ảnh hưởng Nhật ký hoạt động).', 'KHÔNG xoá dữ liệu thật trên máy chủ (người dùng, đơn hàng, vật tư, kho...), dù dòng xác nhận của nút liệt kê như thể sẽ mất toàn bộ.'],
          ],
        },
      ],
      steps: [],
      result: 'Tránh hoang mang hoặc chủ quan sai khi thao tác các màn này.',
      warnings: [
        'Đừng dựa vào "Nhật ký hoạt động" làm bằng chứng pháp lý/kiểm toán chính thức — nó không đầy đủ và không đồng bộ đa thiết bị.',
        '"Cấu hình hệ thống": các trường thông tin công ty (tên, địa chỉ, điện thoại, email, mã số thuế, đơn vị tiền tệ) chỉ mang tính hiển thị tham khảo. Riêng "Địa chỉ ERP dùng cho tem QR" và "Mạng công ty được phép đăng nhập" có tác dụng thật — xem bài riêng. Nhóm "Máy cắt" cũng có tác dụng thật: máy mặc định MC Laser / MC Tự động và thông số bó (lưỡi cắt, tề đầu, hệ số bó, số cây cắt tay tối đa, số cỡ đoạn tối đa mỗi kiểu cắt) do màn Tối ưu cắt sắt đọc; ô nào nhập sai sẽ báo đỏ ngay dưới ô đó. Khối "Gợi ý gộp đơn" đặt cỡ lệnh gộp: các SKU trong một lệnh gộp phải có mốc cần sắt nằm trong khung bao nhiêu ngày (luật cứng, mặc định 3 = ngày 1 gộp được ngày 3, không gộp được ngày 4) và tối đa bao nhiêu SKU mỗi lệnh (mặc định 2).',
      ],
      tags: ['nhật ký hoạt động', 'reset dữ liệu demo', 'tình trạng hệ thống', 'cấu hình hệ thống'],
      sourceRefs: ['src/modules/pages/Admin/AuditLogPage.tsx', 'src/modules/pages/Admin/SystemStatusPage.tsx', 'src/modules/pages/Admin/SystemConfigPage.tsx'],
    },
  ],
};
