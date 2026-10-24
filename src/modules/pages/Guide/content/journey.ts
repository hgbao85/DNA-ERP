import type { GuideGroup } from '../types';

// Nhóm "Hành trình một đơn hàng" — tổng hợp theo đúng chuỗi nghiệp vụ thật (không phải liệt kê
// tính năng theo module). Nội dung dựa trên docs/quy-trinh-2026-08-15-hanh-trinh-don-hang.html
// và docs/quy-trinh-2026-08-15-tao-dinh-muc-moi.html, đối chiếu lại với source code tới
// 12/10/2026. Đây là bức tranh toàn cảnh; chi tiết thao tác từng màn hình nằm ở nhóm theo
// phân hệ bên dưới trong sidebar — mỗi bước ở đây có thể trỏ người đọc sang đó.

export const journeyGroup: GuideGroup = {
  id: 'journey',
  title: 'Hành trình một đơn hàng',
  icon: 'Route',
  color: 'var(--fg-b45309)',
  bg: 'var(--bg-fef3c7)',
  roles: ['sales', 'khsx', 'qlsx', 'boss', 'purchasing', 'warehouse', 'phoi', 'han', 'son', 'kcs'],
  description:
    'Toàn cảnh từ lúc Kinh doanh tạo đơn hàng tới lúc đóng gói giao khách — ai làm gì, ở bước nào. Đọc nhóm này trước nếu bạn mới dùng hệ thống.',
  articles: [
    {
      id: 'journey-overview',
      title: 'Toàn cảnh quy trình & vai trò',
      roles: ['sales', 'khsx', 'qlsx', 'boss', 'purchasing', 'warehouse', 'phoi', 'han', 'son', 'kcs'],
      purpose:
        'Đây là nhà máy sản xuất đồ nội thất khung sắt (ghế, bàn...): cắt sắt thành từng đoạn, hàn thành khung, sơn, rồi gửi phần khung/mảnh ra các điểm đan bên ngoài để đan mặt ghế, sau đó nhận về kiểm tra và đóng gói. Gần như mọi quyết định quan trọng — duyệt công thức sản phẩm, duyệt lệnh sản xuất — đều qua tay Giám đốc ký cuối cùng (riêng việc chọn nhà cung cấp khi mua hàng do Giám đốc ký tay ngoài hệ thống).',
      steps: [
        'Đơn hàng (Kinh doanh) → Duyệt định mức sản phẩm (KHSX + chuyên viên định mức + Giám đốc)',
        'Tối ưu cắt sắt: KHSX cho hệ thống tính phương án cắt rồi tạo lệnh sản xuất',
        'Lệnh sản xuất (KHSX → QLSX → Giám đốc duyệt) → Mua hàng (chỉ khi thiếu vật tư)',
        'Xuất vật tư xuống xưởng → Phôi → Hàn → Sơn',
        'Đan (gia công ngoài) → Chuyền kiểm → Đóng gói',
      ],
      result: 'Nắm được bức tranh tổng thể trước khi đi vào từng phân hệ.',
      warnings: [
        'Các mốc tiến độ hiển thị trên đơn hàng (Lên kế hoạch → Mua hàng → Khung cơ khí → Đan → Chuyền kiểm → Đóng gói → Hoàn thành) được hệ thống TỰ SUY từ dữ liệu sản xuất thật (đã duyệt lệnh chưa, xưởng đã báo sản lượng chưa, đã xuất đan/chuyền kiểm/đóng gói chưa) — không ai phải cập nhật tay và cũng không sửa tay được.',
        'Một dòng SKU chỉ lên mốc "Hoàn thành" khi ĐỦ CẢ HAI điều kiện: số thùng đã đóng gói ≥ số lượng của lệnh, VÀ QLSX đã bấm "Kết thúc" lệnh đó. Thiếu một trong hai thì vẫn ở mốc đang làm.',
        'Từng bước đều có thông báo tự động gửi cho người ở bước kế tiếp — xem bài "Thông báo & việc đang chờ bạn xử lý".',
      ],
      tags: ['tổng quan', 'vai trò', 'quy trình', 'sơ đồ'],
      sourceRefs: ['docs/quy-trinh-2026-08-15-hanh-trinh-don-hang.html'],
    },
    {
      id: 'journey-glossary',
      title: 'Từ viết tắt & thuật ngữ thường gặp',
      roles: ['sales', 'khsx', 'qlsx', 'boss', 'purchasing', 'warehouse', 'phoi', 'han', 'son', 'kcs'],
      purpose:
        'Một vài chữ viết tắt xuất hiện thật trên màn hình (PO, PI, SKU...) — không phải thuật ngữ kỹ thuật bịa ra, nên tài liệu vẫn dùng nguyên để khớp với những gì bạn nhìn thấy khi thao tác. Đọc bảng dưới một lần để không phải đoán mỗi khi gặp lại.',
      steps: [
        'Đọc bảng bên dưới khi gặp một từ lạ trong tài liệu hoặc trên màn hình.',
        'Dùng ô tìm kiếm (hoặc Ctrl+K) để quay lại bài này bất cứ lúc nào.',
      ],
      result: 'Hiểu đúng các từ viết tắt sẽ gặp lại nhiều lần trong tài liệu và trên phần mềm.',
      statuses: [
        { name: 'PO', meaning: 'Mã đơn hàng của khách (Kinh doanh tạo). Một PO có thể có nhiều dòng SKU.' },
        { name: 'PI', meaning: 'Phiếu/lệnh sản xuất — tập hợp một hoặc nhiều SKU dùng chung một đợt cắt sắt. Do KHSX tạo ra ở bước "Tối ưu cắt sắt" sau khi đã tính xong phương án cắt.' },
        { name: 'SKU', meaning: 'Mã một sản phẩm cụ thể (ví dụ một mẫu ghế) — mỗi SKU có công thức/định mức vật tư riêng.' },
        { name: 'Định mức', meaning: 'Công thức: một sản phẩm cần bao nhiêu vật tư (sắt, dây, sơn, phụ kiện, bao bì...) mới làm ra được. Chia làm 2 phần: định mức mảnh và định mức chi tiết.' },
        { name: 'Mảnh', meaning: 'Một bộ phận cấu thành sản phẩm (ví dụ: mảnh tựa, mảnh chân, mảnh mặt ghế) — mỗi mảnh cắt/hàn/sơn riêng theo định mức của nó.' },
        { name: 'KHSX', meaning: 'Kế hoạch sản xuất — tạo SKU, tính phương án cắt sắt, lập và trình lệnh sản xuất.' },
        { name: 'Khả dụng', meaning: 'Số tồn kho còn dùng được = Tồn kho trừ phần đang được giữ chỗ (cho phương án cắt sắt hoặc phiếu chuyển kho đang chờ).' },
        { name: 'Nhóm con Sắt', meaning: 'Vật tư nhóm Sắt chia 3 loại: "Phần mềm" (cắt theo phương án do hệ thống tính), "Tự tính" (cắt theo tỷ lệ cố định, ví dụ tấm sắt la → pat), "Vật tư thành phẩm" (gia công từ nguyên liệu mua về, ví dụ thanh nhôm → chân nhôm).' },
        { name: 'QLSX', meaning: 'Quản lý sản xuất — chọn kho thành phẩm nhận hàng, bấm Bắt đầu/Kết thúc cho xưởng hoạt động.' },
        { name: 'KCS', meaning: 'Kiểm tra chất lượng sau mỗi công đoạn cắt/hàn/sơn.' },
        { name: 'NCC', meaning: 'Nhà cung cấp — nơi bán vật tư cho công ty.' },
      ],
      tags: ['glossary', 'từ điển', 'giải thích', 'po là gì', 'pi là gì', 'sku là gì', 'viết tắt'],
    },
    {
      id: 'journey-notifications',
      title: 'Thông báo & việc đang chờ bạn xử lý',
      roles: ['sales', 'khsx', 'qlsx', 'boss', 'purchasing', 'materials', 'warehouse', 'phoi', 'han', 'son', 'kcs', 'spec_steel', 'spec_detail', 'admin'],
      screenshot: '/guide-screens/journey-notifications.png',
      purpose:
        'Hệ thống tự gửi thông báo cho đúng người ở bước kế tiếp (ví dụ: SKU cần nhập định mức, định mức chờ duyệt, lệnh sản xuất chờ QLSX/Giám đốc, có hàng mua về chờ nhận, đợt cắt/hàn/sơn chờ KCS, kho vừa xuất vật tư cho tổ...). Không cần tự vào từng màn để dò xem có việc mới hay không.',
      steps: [
        'Bấm icon chuông (cạnh tên bạn ở cuối thanh menu; trên điện thoại nằm ở thanh trên cùng) để mở danh sách thông báo — có 2 tab "Cần xử lý" và "Tất cả".',
        'Bấm vào một thông báo: hệ thống mở đúng phân hệ, đúng tab và làm nổi bật đúng dòng cần xử lý.',
        'Số đỏ cạnh một mục menu (ví dụ "Nhập kho", "Duyệt SKU", "Xử lý lệnh sản xuất", "Xác nhận nhận sắt", KCS Phôi/Hàn/Sơn) = số việc đang chờ bạn ở mục đó.',
        'Bấm "Xem tất cả" để mở trang "Thông báo của tôi": tìm theo tiêu đề/nội dung, lọc theo loại (Cần xử lý / Kết quả / Cảnh báo / Thông tin / Thông báo chung) và theo đã đọc/chưa đọc.',
        'Bấm "Đọc tất cả" để đánh dấu đã đọc toàn bộ.',
      ],
      result: 'Biết ngay khi có việc tới lượt mình; các bảng danh sách cũng tự làm mới khi người khác vừa thao tác, không cần tải lại trang.',
      warnings: [
        'Thông báo ghi "Chỉ để xem" = nó trỏ tới màn hình của phân hệ khác mà vai trò của bạn không mở được — chỉ để nắm thông tin.',
        'Thông báo ghi "Đã xử lý" = việc đó đã có người làm xong, không cần thao tác nữa.',
        '"Thông báo chung" (lịch nghỉ, thay đổi quy trình...) do Admin soạn tay; các thông báo còn lại do hệ thống tự phát theo nghiệp vụ.',
      ],
      tags: ['thông báo', 'chuông', 'việc chờ xử lý', 'notification', 'badge'],
      sourceRefs: ['src/components/NotificationCenter.tsx', 'src/components/MyNotificationsPage.tsx', 'DNA-ERP-BE/src/modules/notifications/notification-types.ts'],
    },
    {
      id: 'journey-1-order',
      title: '1. Kinh doanh tạo đơn hàng',
      roles: ['sales'],
      purpose: 'Điểm bắt đầu của toàn bộ quy trình — ghi nhận nhu cầu của khách hàng vào hệ thống.',
      preconditions: [
        'Khách hàng đã tồn tại trong danh mục (hoặc tạo mới ngay khi lập đơn).',
        'Sản phẩm muốn bán đã có "công thức sản xuất" (định mức) được Giám đốc duyệt — xem bài "2. Duyệt định mức sản phẩm". Sản phẩm chưa duyệt sẽ không chọn được vào đơn.',
      ],
      screenshot: '/guide-screens/sales-tao-po.png',
      mock: {
        title: 'Tạo PO mới',
        formFields: ['Mã đơn hàng *', 'Khách hàng *', 'Ngày đặt', 'File đính kèm (PO, hợp đồng...)', 'Ghi chú'],
        columns: ['SKU', 'Hạn giao *', 'Tổng số *'],
        rows: [['GHE-001', '30/09/2026', '200']],
        buttons: ['Thêm SKU', 'Lưu'],
      },
      steps: [
        'Chọn khách hàng cho đơn hàng.',
        'Thêm từng dòng sản phẩm: chọn SKU đã duyệt, nhập số lượng và hạn giao (bắt buộc cho từng dòng — hạn này đi theo xuống lệnh sản xuất của đúng đơn đó). Nếu SKU có nhiều màu dây/màu nệm thì chọn thêm "Màu dây" và "Màu nệm" cho dòng đó — xem bài "Màu dây & màu nệm theo từng dòng đơn".',
        'Lưu đơn hàng.',
        { text: 'Đánh dấu đã nhận cọc khi có. Số lượng đã xuất hàng do Thủ kho ghi nhận ở "Xuất theo đơn hàng", Kinh doanh chỉ theo dõi.', critical: false },
      ],
      result:
        'Đơn hàng được tạo; hệ thống tự sinh một "lệnh sản xuất" tương ứng phía sau cho bộ phận Kế hoạch sản xuất xử lý tiếp — Kinh doanh không thấy và không cần thao tác phần đó.',
      warnings: [
        'Mốc tiến độ trên đơn hàng do hệ thống tự suy từ dữ liệu sản xuất thật — Kinh doanh chỉ xem, không sửa tay.',
        'Việc theo dõi tiền dừng ở mức "đã nhận cọc / chưa nhận cọc" — chưa tính được đã thanh toán bao nhiêu, còn nợ bao nhiêu.',
      ],
      commonErrors: [
        { issue: 'Không tìm thấy sản phẩm cần bán trong danh sách chọn', cause: 'Sản phẩm chưa có định mức đang có hiệu lực — có thể đang chờ duyệt hoặc chưa được tạo.', fix: 'Liên hệ KHSX kiểm tra trạng thái định mức của SKU đó; chỉ sản phẩm đã được Giám đốc duyệt định mức mới chọn được vào đơn.' },
      ],
      tags: ['đơn hàng', 'bán hàng', 'khách hàng', 'sales order'],
      sourceRefs: ['src/modules/pages/Sales/OrderManagementPage.tsx'],
    },
    {
      id: 'journey-2-bom',
      title: '2. Xây dựng & duyệt định mức sản phẩm (SKU)',
      roles: ['khsx', 'spec_steel', 'spec_detail', 'boss'],
      purpose:
        'Một sản phẩm chỉ cần duyệt định mức một lần rồi dùng lại cho mọi đơn hàng sau này. "Định mức" là bộ dữ liệu quyết định sản phẩm cần bao nhiêu vật tư — chia làm hai nhánh độc lập, làm song song.',
      preconditions: [
        'Vật tư (sắt, dây, đinh, sơn, phụ kiện, bao bì...) đã được Admin khai báo sẵn trong danh mục — hai chuyên viên chỉ chọn được từ danh mục có sẵn, không gõ tự do.',
      ],
      mock: {
        title: 'Duyệt SKU — Định mức mảnh (thẻ "Mảnh tựa ×1 / SKU")',
        columns: ['Nhóm', 'Vật tư', 'Quy cách', 'Chiều dài / Số lượng/ĐVT', 'Số lượng', 'ĐVT'],
        rows: [['Sắt', 'SAT-003 — Sắt hộp 20x20', '20x20x0.8', '400', '2', 'cây'], ['Dây', 'DAY-011 — Dây nhựa giả mây', '—', '—', '0.5', 'kg']],
        buttons: ['Từ chối', 'Duyệt', 'Xác nhận hoàn tất'],
      },
      steps: [
        'KHSX tạo hồ sơ SKU mới (ở màn "Duyệt SKU"): nhập mã SKU (bắt buộc) + Mã khách hàng và Ảnh sản phẩm (tuỳ chọn).',
        { text: 'Nhánh mảnh (chuyên viên định mức mảnh): chia sản phẩm thành từng "mảnh" (VD: mảnh tựa, mảnh chân), đánh dấu mảnh có Cần Hàn / Cần Sơn hay không, khai chiều dài sắt cần cắt + số đoạn, và vật tư phụ (dây, đinh, tán rút, nút nhựa) cho từng mảnh. Với dây, chuyên viên còn tick các MÀU dây mà Sales được chọn khi lên đơn.', critical: false },
        { text: 'Nhánh chi tiết (chuyên viên định mức chi tiết): khai sơn, phụ kiện (kể cả nệm), bao bì cho cả sản phẩm, và tick các MÀU nệm Sales được chọn — làm song song, không cần chờ nhánh mảnh.', critical: false },
        'KHSX mở chi tiết SKU, xem 2 tab "Định mức mảnh" và "Định mức chi tiết": mỗi tab chỉ có MỘT quyết định Duyệt/Từ chối duy nhất cho toàn bộ nhánh đó (không duyệt riêng từng nhóm vật tư con).',
        'Sau khi Duyệt một nhánh, bấm thêm "Xác nhận hoàn tất" cho nhánh đó để chính thức chốt (duyệt xong chưa tự chốt).',
        { text: 'Khi cả hai nhánh đã được chốt xong (theo bất kỳ thứ tự nào), hồ sơ TỰ ĐỘNG chuyển sang chờ Giám đốc duyệt — không còn bước "QLSX duyệt cục bộ" ở giữa, và không ai phải bấm nút "gửi Sếp".', critical: true },
        { text: 'Giám đốc xem gộp cả hai nhánh trên cùng một màn, bấm Duyệt hoặc Từ chối (kèm lý do nếu từ chối).', critical: true },
      ],
      result:
        'Định mức của sản phẩm chính thức có hiệu lực (đã duyệt) — chỉ từ lúc này Kinh doanh mới chọn được sản phẩm vào đơn hàng mới, và KHSX mới lập được lệnh sản xuất cho nó.',
      warnings: [
        'Mỗi lần chuyên viên bấm lưu/gửi là GHI ĐÈ TOÀN BỘ danh sách mảnh (hoặc dòng chi tiết) của SKU đó — không phải sửa từng dòng. Gửi thiếu là mất dữ liệu cũ, không có bản khôi phục.',
        'Nếu chuyên viên nhập lại dữ liệu sau khi KHSX đã duyệt, quyết định duyệt cũ của nhánh đó bị xoá — KHSX phải duyệt lại dù nút "Xác nhận" từng ghi "không thể sửa lại quyết định này".',
        'Nếu Giám đốc từ chối ở bước cuối, quyết định duyệt của KHSX ở CẢ HAI nhánh đều bị xoá (không riêng nhánh có lỗi) và SKU quay về "Đang làm định mức" — KHSX phải duyệt và chốt lại từ đầu cả hai nhánh. Số liệu định mức đã nhập không mất, chỉ mất quyết định duyệt.',
        'Mỗi bước đều có thông báo tự động cho người kế tiếp (chuyên viên được báo có SKU cần nhập, KHSX được báo có định mức chờ duyệt, Giám đốc được báo có SKU chờ duyệt, và ngược lại khi bị từ chối) kèm số đỏ trên menu — xem bài "Thông báo & việc đang chờ bạn xử lý".',
        'Hệ thống không chặn và không cảnh báo khi mã SKU trùng với SKU đã có: mỗi lần "Tạo SKU mới" là một sản phẩm riêng với định mức riêng (hai khách hàng có thể dùng cùng một mã). Hãy tự kiểm tra ở "Danh sách SKU" trước khi tạo.',
        'Xoá SKU (ở màn "Danh sách SKU") là xoá cứng, không thể hoàn tác — kể cả SKU đã được duyệt.',
      ],
      commonErrors: [
        { issue: 'Nút Duyệt/Từ chối bị khoá', cause: 'Chuyên viên phụ trách nhánh đó chưa nhập gì (không có dữ liệu để duyệt).', fix: 'Chờ chuyên viên nhập xong (hoặc liên hệ trực tiếp) rồi duyệt lại.' },
        { issue: 'Sản phẩm báo "chưa có định mức đang active" (active = đang có hiệu lực) khi tạo đơn hàng/lệnh sản xuất', cause: 'SKU chưa từng được Giám đốc duyệt định mức, hoặc bản duyệt cũ đã bị thay thế bởi một hồ sơ khác đang chờ duyệt.', fix: 'Kiểm tra trạng thái SKU ở màn "Duyệt SKU"; hoàn tất quy trình duyệt định mức trước.' },
        { issue: '"Chưa duyệt đủ nhóm mảnh: còn thiếu SAT" (hoặc tương tự cho chi tiết)', cause: 'Bấm "Xác nhận hoàn tất" khi nhóm vật tư đó của nhánh chưa có dữ liệu/chưa duyệt xong.', fix: 'Kiểm tra đủ dữ liệu cho mọi nhóm vật tư trong nhánh trước khi xác nhận hoàn tất.' },
        { issue: '"Plan form ... đang ở trạng thái ... - chỉ có thể sửa khi đang làm định mức (chưa gửi Sếp duyệt)"', cause: 'Cố sửa tên/mã SKU khi hồ sơ đã gửi chờ Giám đốc duyệt hoặc đã duyệt xong.', fix: 'Chỉ sửa được thông tin SKU khi đang ở trạng thái "Đang làm định mức".' },
      ],
      statuses: [
        { name: 'Đang làm định mức', meaning: 'SKU vừa tạo hoặc vừa bị Giám đốc từ chối — đang chờ chuyên viên nhập/KHSX duyệt từng nhánh.' },
        { name: 'Chờ sếp duyệt', meaning: 'Cả hai nhánh đã được KHSX xác nhận hoàn tất, tự động chuyển sang chờ Giám đốc.' },
        { name: 'Đã duyệt', meaning: 'Định mức chính thức có hiệu lực, dùng được cho đơn hàng và lệnh sản xuất.' },
      ],
      tags: ['sku', 'bom', 'định mức', 'công thức sản phẩm', 'duyệt định mức'],
      sourceRefs: ['src/modules/pages/ProductionPlan/SKUDetail.tsx', 'src/modules/pages/ProductionPlan/SKUReviewPage.tsx'],
    },
    {
      id: 'journey-mau-day-nem',
      title: 'Màu dây & màu nệm theo từng dòng đơn — đi xuyên suốt từ định mức tới xuất đan',
      roles: ['sales', 'khsx', 'spec_steel', 'spec_detail', 'purchasing', 'warehouse'],
      purpose:
        'Một sản phẩm có thể làm bằng nhiều màu dây (mỗi mã SHT là một loại dây riêng, ví dụ "Dây nâu SHT08") và nhiều màu nệm. Khách đặt màu nào thì mua hàng và xuất đan phải đúng màu đó — không còn cộng dồn mọi màu như trước. Bài này nối các bước nằm rải rác ở nhiều phân hệ thành một đường đi duy nhất, để mỗi người biết phần của mình nằm ở đâu.',
      preconditions: [
        'Các màu dây (nhóm Dây) và màu nệm (nhóm "Vật tư khác", Phân loại = Nệm) đã được khai ở danh mục Vật tư — mỗi màu là MỘT vật tư riêng, nên thêm ảnh mẫu để Sales dễ chọn.',
      ],
      screenshot: '/guide-screens/journey-mau-day-nem.png',
      highlight: {
        label: 'Quy tắc cốt lõi',
        text: 'Định mức khai TẤT CẢ các màu được phép (tick). Sales chọn ĐÚNG 1 màu dây và 1 màu nệm cho TỪNG dòng đơn. Từ đó mua hàng và xuất đan chỉ tính đúng màu đã chọn.',
        note: 'Chỉ dây và nệm có lựa chọn màu. Đinh, tán rút, nút nhựa, sắt, sơn, bao bì không đổi theo màu — luôn tính như cũ. Không có "dây cố định" hay "nệm cố định": mọi dòng dây và mọi dòng nệm trong định mức bắt buộc là một màu đã tick (SKU chỉ dùng một màu vẫn phải tick màu đó; SKU không dùng dây/nệm thì không cần tick).',
      },
      mock: {
        title: 'Tạo PO mới — dòng SKU có lựa chọn màu',
        formFields: ['SKU', 'Hạn giao *', 'Tổng số *', 'Màu dây *', 'Màu nệm *'],
        buttons: ['Thêm SKU', 'Lưu'],
      },
      steps: [],
      tables: [
        {
          title: 'Đường đi của một lựa chọn màu',
          intro: 'Theo đúng thứ tự thời gian, từ lúc khai định mức tới lúc xuất đan.',
          columns: ['Bước', 'Ai làm', 'Ở đâu', 'Việc cần làm'],
          rows: [
            ['1. Khai các màu được phép', 'Chuyên viên định mức mảnh (dây), chuyên viên định mức chi tiết (nệm)', 'Quản lý định mức > Định mức mảnh / Định mức mới', 'Bấm "Chọn các màu dây" / "Chọn các màu nệm", tick các màu Sales được chọn. Rồi nhập số lượng của từng màu: dây theo từng mảnh, nệm theo từng dòng Phụ kiện.'],
            ['2. Duyệt định mức', 'KHSX, rồi Giám đốc', 'Duyệt SKU', 'Duyệt như thường lệ. Danh sách màu đã tick đi cùng bản định mức, và bị khoá khi bản đó đã duyệt.'],
            ['3. Chọn màu cho dòng đơn', 'Sales', 'Quản lí đơn hàng > Tạo PO', 'Mỗi dòng SKU chọn 1 "Màu dây" và 1 "Màu nệm" trong số đã tick. Muốn hai màu khác nhau của cùng một SKU thì thêm hai dòng.'],
            ['4. Gộp & tạo lệnh sản xuất', 'KHSX', 'Tối ưu cắt sắt', 'Hai dòng cùng SKU khác màu vẫn gộp chung một đợt cắt được (dây và nệm không ảnh hưởng cắt sắt). Nhãn màu hiện cạnh mã SKU để phân biệt.'],
            ['5. Duyệt lệnh', 'QLSX, rồi Giám đốc', 'Lệnh sản xuất', 'Khi duyệt, hệ thống kiểm màu đã chọn có khớp bản định mức sắp áp dụng không, rồi CHỐT màu vào lệnh. Từ đây mua hàng và xuất đan đọc màu từ lệnh, không đọc lại đơn.'],
            ['6. Mua hàng & nhập kho', 'Mua hàng, Thủ kho', 'Lệnh mua vật tư, Nhập kho', 'Đề xuất mua chỉ gồm dây/nệm của màu đã chọn, tính riêng cho từng lệnh. Nệm khác quy cách ra dòng riêng, Thủ kho nhận hàng đúng dòng đó.'],
            ['7. Xuất đan', 'Thủ kho Vật tư thành phẩm', 'Theo dõi xuất đan', 'Vật tư mang kèm chỉ có dây đúng màu đã chọn cho lệnh đó.'],
          ],
        },
        {
          title: 'Màu đã chọn hiện ở đâu',
          intro: 'Nhãn hiện TÊN màu (ví dụ "Dây nâu SHT08", "Nệm màu be"), không hiện mã vật tư; dây có thêm ảnh nhỏ. Rê chuột vào nhãn để xem "Màu dây: …" / "Màu nệm: …".',
          columns: ['Màn hình', 'Hiện thế nào'],
          rows: [
            ['Quản lí đơn hàng (Sales)', 'Mỗi dòng trong chi tiết đơn có nhãn màu dây · màu nệm.'],
            ['Tối ưu cắt sắt, Lệnh sản xuất (KHSX, QLSX, Giám đốc)', 'Nhãn màu cạnh mã SKU, để phân biệt hai dòng cùng SKU khác màu.'],
            ['Bảng thống kê, chi tiết PI của QLSX', 'Nhãn màu ở đầu trang, trong bảng và trên thẻ điện thoại. Bảng Mua hàng của từng SKU chỉ giữ dây/nệm của màu SKU đó; sắt, đinh... giữ số gộp cả PI kèm chữ "(mua chung)".'],
            ['Các màn của Thủ kho', 'Theo dõi xuất đan, Theo dõi nhập đan, Chuyền kiểm, Đóng gói, và Phân phối nội bộ > Xuất vật tư TP / hàn / sơn: mỗi LỆNH một dòng, kèm nhãn màu.'],
          ],
        },
        {
          title: 'Hệ thống chặn gì',
          columns: ['Tình huống', 'Kết quả'],
          rows: [
            ['SKU có tick màu nhưng dòng đơn chưa chọn', 'Không lưu được đơn; dưới bảng SKU có dòng nhắc "chọn đủ Màu dây và Màu nệm".'],
            ['SKU chỉ có đúng một màu', 'Hệ thống chọn sẵn, Sales khỏi bấm.'],
            ['SKU không tick màu nào', 'Hai ô màu không hiện; mọi thứ chạy như trước (SKU này không có dây/nệm, hoặc là SKU cũ chưa có tick).'],
            ['Dòng dây hoặc dòng nệm trong định mức không thuộc màu đã tick', 'Không gửi phê duyệt được (máy chủ cũng từ chối, 400) — tick màu đó hoặc xoá dòng.'],
            ['Đơn tạo trước khi có tính năng này (chưa chọn màu)', 'Chạy như trước, không lọc gì.'],
            ['Duyệt lệnh mà màu đã chọn không khớp bản định mức sắp áp dụng', 'Bị chặn ngay lúc duyệt (409), kèm lý do — chưa ghi gì.'],
            ['Xuất đan mang kèm dây khác màu đã chọn', 'Bị từ chối (400), không tạo phiếu xuất.'],
            ['Gỡ tick một màu đang nằm trên đơn chưa giao hết', 'Bị chặn (409), nêu mã vật tư và mã đơn. Chỉ gặp khi Admin sửa định mức đã duyệt.'],
            ['Đổi màu sau khi lệnh sản xuất của dòng đã được duyệt', 'Không đổi được. Giao diện Sales hiện cũng chưa có chỗ sửa màu của một đơn đã tạo.'],
          ],
        },
      ],
      result: 'Mỗi dòng đơn đi đúng màu dây và màu nệm khách chọn, từ lúc đặt hàng tới lúc xuất đan — không mua dư, không xuất nhầm màu.',
      warnings: [
        'Nệm chỉ khác nhau theo MÀU ở danh mục vật tư; kích thước (quy cách) nhập tay theo từng SKU ở Định mức chi tiết, ví dụ "Đôi 870x450x50". Một SKU có thể có nhiều dòng cùng một màu nệm nếu khác quy cách. Đề xuất mua, nhận hàng, tồn kho và chuyển kho của nệm đều tách theo từng quy cách như vậy.',
        'Nếu Sales chọn nhầm màu: chưa gộp vào PI thì xoá đơn rồi tạo lại (xem bài "Xoá đơn hàng"). Đã gộp hoặc đã duyệt lệnh thì báo KHSX/Admin, không tự sửa được trên giao diện.',
        'Với đề xuất mua gộp theo PI, số lượng sắt, đinh... là số gộp cả PI (cây sắt dùng chung giữa các SKU nên không chia riêng được) — vì vậy ở bảng Mua hàng của từng SKU chúng ghi "(mua chung)", chỉ dây và nệm là số riêng của SKU đó.',
      ],
      commonErrors: [
        { issue: 'Nút "Lưu" ở Tạo PO bị mờ, dưới bảng SKU có dòng "SKU có nhiều màu dây/nệm - chọn đủ Màu dây và Màu nệm cho từng dòng thì mới lưu được"', cause: 'Có dòng SKU chưa chọn Màu dây hoặc Màu nệm.', fix: 'Chọn đủ hai ô cho mọi dòng SKU đang hiện chúng.' },
        { issue: '"... chưa chọn màu dây (bản định mức ... có ... lựa chọn) - Sales cần chọn trước khi duyệt" (hoặc "màu nệm") khi duyệt lệnh', cause: 'Dòng đơn chưa có màu nhưng bản định mức sắp áp dụng có tick màu (ví dụ định mức được thêm màu sau khi đơn đã tạo).', fix: 'Nhờ Sales xoá đơn (nếu còn xoá được) và tạo lại với đủ màu; nếu không xoá được thì báo Admin.' },
        { issue: '"... màu dây đã chọn không nằm trong bản định mức ... - cần chọn lại"', cause: 'Màu Sales đã chọn không còn trong danh sách tick của bản định mức sắp áp dụng.', fix: 'Như trên: tạo lại đơn với màu còn trong danh sách, hoặc báo Admin.' },
        { issue: '"Không thể gỡ tick dây đang được đơn hàng chưa giao xong sử dụng: ..."', cause: 'Admin đang gỡ một màu vẫn nằm trên dòng đơn chưa giao hết.', fix: 'Giữ nguyên tick đó cho tới khi các đơn dùng màu này giao xong.' },
        { issue: '"Vật tư ... không thuộc màu dây/nệm đã chọn cho lệnh sản xuất này - không thể mang kèm"', cause: 'Phiếu xuất đan mang kèm một dây khác màu đã chọn cho lệnh.', fix: 'Chỉ nhập số lượng cho đúng dây hiện sẵn trong kế hoạch xuất đan của lệnh đó.' },
      ],
      tags: ['màu dây', 'màu nệm', 'loại dây', 'loại nệm', 'sht', 'chọn màu', 'tick dây', 'tick nệm', 'dây nệm theo đơn', 'quy cách nệm', 'bom option'],
      sourceRefs: [
        'docs/changelog-2026-10-22-chon-loai-day-nem-theo-dong-don.html',
        'src/components/MaterialOptionsPanel.tsx',
        'src/components/MaterialChoiceTags.tsx',
        'src/modules/pages/Sales/OrderManagementPage.tsx',
      ],
    },
    {
      id: 'journey-10-11-12-weaving-pack',
      title: '10-12. Đan ngoài → Chuyền kiểm → Đóng gói',
      roles: ['warehouse'],
      purpose: 'Đoạn cuối hành trình một mảnh sản phẩm: rời khung cơ khí, ra điểm đan (nếu cần), quay về kiểm tra, rồi đóng gói thành phẩm.',
      preconditions: [
        'Mảnh đã cắt/hàn/sơn xong và kiểm đạt đã được chuyển sang kho Vật tư thành phẩm (thủ kho khu vực khung cơ khí chuyển, thủ kho Vật tư thành phẩm xác nhận nhận).',
      ],
      screenshot: '/guide-screens/wh-chuyen-kiem.png',
      mock: {
        title: 'Chuyền kiểm',
        columns: ['Mảnh', 'Tổng cần', 'Hiện có', 'Đã kiểm', 'Lỗi'],
        rows: [['Mảnh tay (có đan)', '558', '200', '150', '3'], ['Chân nhôm (không đan)', '279', '0', '0', '0']],
        buttons: ['Kiểm'],
      },
      steps: [
        { text: 'Mảnh cần đan (có Dây và Đinh): thủ kho Vật tư thành phẩm "Xuất đan" — chọn mảnh, chọn điểm đan, ghi số lượng gửi. Mảnh không cần đan bỏ qua bước này, đi thẳng sang Chuyền kiểm.', critical: false },
        'Khi điểm đan trả hàng: thủ kho THÀNH PHẨM (khác thủ kho Vật tư thành phẩm) "Nhập đan" — ghi nhận số nhận về, không vượt quá số điểm đan đang giữ.',
        { text: 'Chuyền kiểm (bắt buộc cho MỌI mảnh, kể cả mảnh không đan): kiểm từng mảnh, ghi số đạt; nếu lỗi thì chọn nguyên nhân, có thể đính kèm ảnh.', critical: true },
        { text: 'Xuất vật tư đóng gói: thủ kho đang giữ vật tư đóng gói (tem, màng bọc, thùng...) bấm Xác nhận xuất — đây là bước DUY NHẤT thực sự ghi nhận hàng "về" kho thành phẩm trên sổ sách.', critical: true },
        'Đóng thùng: đếm và ghi nhận số thùng đã đóng xong (không bắt buộc chờ Chuyền kiểm xong hết mới đếm được).',
      ],
      result: 'Hàng thành phẩm sẵn sàng giao cho khách; số liệu cập nhật lại cho Kinh doanh.',
      warnings: [
        'Xuất đan/Nhập đan chỉ là GHI CHÉP đối chiếu với điểm đan — KHÔNG làm thay đổi tồn kho chính thức. Trên sổ sách, mảnh vẫn tính là thuộc kho Vật tư thành phẩm cho tới khi Xuất vật tư đóng gói.',
        'Có 3 màn hình dễ nhầm là một vì đều nằm trong khu vực Kho: (1) "Đóng gói" trên menu chỉ đếm thùng, không đổi tồn kho; (2) nút "Xác nhận" ở "Xuất kho" khi xuất vật tư đóng gói — đây mới là bước hàng thật sự "về" kho thành phẩm, hiển thị theo TÊN VẬT TƯ chứ không theo tên sản phẩm; (3) màn xuất hàng cho khách — hiển thị theo tên sản phẩm, không liên quan Chuyền kiểm.',
        'Muốn xuất vật tư đóng gói phải thoả cả 3 điều kiện: không vượt định mức, không vượt số đã qua đủ Chuyền kiểm, không vượt tồn kho thực tế.',
        'Hiếm khi xảy ra: nếu 2 lệnh sản xuất cùng xin xuất gần hết một vật tư đóng gói vào đúng cùng một lúc, tồn kho có thể bị âm. Khi thấy tồn kho âm, báo ngay cho Admin để kiểm tra.',
        'Phần mềm không có một con số "tồn kho thành phẩm" tính theo sản phẩm — chỉ có theo mảnh và theo vật tư đóng gói.',
      ],
      commonErrors: [
        { issue: 'Không xuất được vật tư đóng gói dù còn tồn kho', cause: 'Số sản phẩm chưa qua đủ Chuyền kiểm (thiếu dù chỉ 1 mảnh cấu thành cũng không tính).', fix: 'Kiểm tra và hoàn tất Chuyền kiểm cho đủ số lượng trước.' },
        { issue: 'Không nhập đan được, báo vượt số lượng', cause: 'Số nhập vượt quá số điểm đan đó đang thực sự giữ (đã gửi trừ đã nhận trước đó).', fix: 'Đối chiếu lại sổ sách xuất đan trước khi nhập.' },
      ],
      statuses: [
        { name: 'Hiện có (Chuyền kiểm)', meaning: 'Mảnh có đan: tổng đã nhập đan về. Mảnh không đan: tổng dòng chuyển kho nội bộ đã xác nhận (phiếu đang chờ hoặc bị từ chối không tính).' },
      ],
      tags: ['xuất đan', 'nhập đan', 'chuyền kiểm', 'đóng gói', 'đóng thùng', 'thành phẩm'],
      sourceRefs: [
        'docs/quy-trinh-2026-09-08-xuat-dan-den-dong-goi.html',
        'docs/quy-trinh-2026-09-19-chuyen-kiem-hien-co.html',
      ],
    },
    {
      id: 'journey-branches',
      title: 'Những rẽ nhánh cần biết',
      roles: ['sales', 'khsx', 'qlsx', 'boss', 'purchasing', 'warehouse'],
      purpose: 'Các trường hợp ngoại lệ lặp lại nhiều lần trong hệ thống — biết trước để không bối rối khi gặp.',
      steps: [
        'Từ chối ở bất kỳ cổng duyệt nào (định mức, lệnh sản xuất, gộp đợt cắt...): hồ sơ quay lại đúng người phụ trách kèm lý do, dữ liệu đã nhập không mất.',
        'Lỗi chất lượng (KCS) chỉ ghi hai kết quả Đạt / Không đạt (kèm nguyên nhân). Phần không đạt KHÔNG tự sinh lô làm lại — tổ sản xuất tự báo một đợt mới để bù (nút "Bù đủ").',
        'Nhận thiếu vẫn được ghi nhận — cả khi nhận hàng mua về lẫn khi nhận vật tư xuống xưởng, không bắt buộc khớp tuyệt đối.',
        'Gộp đợt cắt sắt (nhiều sản phẩm dùng chung loại sắt) và tính lại phương án cắt chỉ thực hiện được TRƯỚC khi Giám đốc duyệt lệnh sản xuất.',
        'QLSX hoặc Giám đốc từ chối lệnh sản xuất = lệnh bị XOÁ, SKU quay về màn "Tối ưu cắt sắt" để KHSX tính và tạo lệnh lại từ đầu.',
      ],
      result: 'Hiểu đúng các quy tắc chung, tránh nhầm lẫn khi thao tác thực tế.',
      tags: ['ngoại lệ', 'từ chối', 'reject', 'sửa được', 'phế'],
      sourceRefs: ['docs/quy-trinh-2026-08-15-hanh-trinh-don-hang.html'],
    },
  ],
};
