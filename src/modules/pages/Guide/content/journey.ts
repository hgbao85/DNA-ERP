import type { GuideGroup } from '../types';

// Nhóm "Hành trình một đơn hàng" — tổng hợp theo đúng chuỗi nghiệp vụ thật (không phải liệt kê
// tính năng theo module). Nội dung dựa trên docs/quy-trinh-2026-08-15-hanh-trinh-don-hang.html
// và docs/quy-trinh-2026-08-15-tao-dinh-muc-moi.html, đối chiếu lại với source code tới
// 22/09/2026. Đây là bức tranh toàn cảnh; chi tiết thao tác từng màn hình nằm ở nhóm theo
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
        'Lệnh sản xuất (KHSX → QLSX → Giám đốc duyệt)',
        'Cắt sắt tự động → Mua hàng (chỉ khi thiếu vật tư)',
        'Xuất vật tư xuống xưởng → Phôi → Hàn → Sơn',
        'Đan (gia công ngoài) → Chuyền kiểm → Đóng gói',
      ],
      result: 'Nắm được bức tranh tổng thể trước khi đi vào từng phân hệ.',
      warnings: [
        'Các mốc tiến độ hiển thị trên đơn hàng (Lên kế hoạch → Mua hàng → Khung cơ khí → Đan → Chuyền kiểm → Đóng gói → Hoàn thành) không tự cập nhật theo tiến độ thực tế dưới xưởng — phải có người cập nhật tay.',
        'Hệ thống chưa có nút/trạng thái nào tự động đánh dấu "đơn hàng đã hoàn thành 100%". Muốn biết phải tự so sánh số đã đóng gói với tổng số cần giao.',
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
        { name: 'PI', meaning: 'Phiếu/lệnh sản xuất — tập hợp một hoặc nhiều SKU dùng chung một đợt cắt sắt. Do KHSX tạo ra ở bước "Tối ưu cắt sắt".' },
        { name: 'SKU', meaning: 'Mã một sản phẩm cụ thể (ví dụ một mẫu ghế) — mỗi SKU có công thức/định mức vật tư riêng.' },
        { name: 'Định mức', meaning: 'Công thức: một sản phẩm cần bao nhiêu vật tư (sắt, dây, sơn, phụ kiện, bao bì...) mới làm ra được. Chia làm 2 phần: định mức mảnh và định mức chi tiết.' },
        { name: 'Mảnh', meaning: 'Một bộ phận cấu thành sản phẩm (ví dụ: mảnh tựa, mảnh chân, mảnh mặt ghế) — mỗi mảnh cắt/hàn/sơn riêng theo định mức của nó.' },
        { name: 'KHSX', meaning: 'Kế hoạch sản xuất — tạo SKU, gộp đợt cắt sắt, lập và trình lệnh sản xuất.' },
        { name: 'QLSX', meaning: 'Quản lý sản xuất — chọn kho thành phẩm nhận hàng, bấm Bắt đầu/Kết thúc cho xưởng hoạt động.' },
        { name: 'KCS', meaning: 'Kiểm tra chất lượng sau mỗi công đoạn cắt/hàn/sơn.' },
        { name: 'NCC', meaning: 'Nhà cung cấp — nơi bán vật tư cho công ty.' },
      ],
      tags: ['glossary', 'từ điển', 'giải thích', 'po là gì', 'pi là gì', 'sku là gì', 'viết tắt'],
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
      mock: {
        title: 'Tạo PO mới',
        formFields: ['Mã đơn hàng *', 'Khách hàng *', 'Ngày đặt'],
        columns: ['SKU', 'Hạn giao', 'Tổng số'],
        rows: [['GHE-001', '30/09/2026', '200']],
        buttons: ['Thêm SKU', 'Lưu'],
      },
      steps: [
        'Chọn khách hàng cho đơn hàng.',
        'Thêm từng dòng sản phẩm: chọn SKU đã duyệt, nhập số lượng và ngày cần giao.',
        'Lưu đơn hàng.',
        { text: 'Đánh dấu đã nhận cọc và ghi nhận từng đợt xuất hàng khi có.', critical: false },
      ],
      result:
        'Đơn hàng được tạo; hệ thống tự sinh một "lệnh sản xuất" tương ứng phía sau cho bộ phận Kế hoạch sản xuất xử lý tiếp — Kinh doanh không thấy và không cần thao tác phần đó.',
      warnings: [
        'Mốc tiến độ trên đơn hàng là thủ công, không tự động đồng bộ với xưởng.',
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
        title: 'Duyệt SKU — Định mức mảnh',
        columns: ['Mảnh', 'Sắt', 'Dây', 'Đinh'],
        rows: [['Mảnh tựa', 'Ø14 x 400mm', '2m', '8']],
        buttons: ['Từ chối', 'Duyệt', 'Xác nhận hoàn tất'],
      },
      steps: [
        'KHSX tạo hồ sơ SKU mới (ở màn "Duyệt SKU"): nhập mã SKU (bắt buộc) + Mã khách hàng (tuỳ chọn).',
        { text: 'Nhánh mảnh (chuyên viên định mức mảnh): chia sản phẩm thành từng "mảnh" (VD: mảnh tựa, mảnh chân), khai chiều dài sắt cần cắt + số đoạn, và vật tư phụ (dây, đinh, tán rút, nút nhựa) cho từng mảnh.', critical: false },
        { text: 'Nhánh chi tiết (chuyên viên định mức chi tiết): khai sơn, phụ kiện, bao bì cho cả sản phẩm — làm song song, không cần chờ nhánh mảnh.', critical: false },
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
        'Hệ thống không tự bắn thông báo cho bước kế tiếp — mỗi người phải tự vào kiểm tra màn hình danh sách của mình để biết có hồ sơ mới cần xử lý.',
        'Nếu mã SKU trùng với một hồ sơ khác chưa được duyệt xong, hệ thống chỉ cảnh báo mềm ("Sản phẩm đã có hồ sơ định mức" kèm nút "Vẫn tạo mới") chứ không chặn.',
        'Xoá SKU (ở màn "Danh sách SKU") là xoá cứng, không thể hoàn tác — kể cả SKU đã được duyệt.',
      ],
      commonErrors: [
        { issue: 'Nút Duyệt/Từ chối bị khoá', cause: 'Chuyên viên phụ trách nhánh đó chưa nhập gì (không có dữ liệu để duyệt).', fix: 'Chờ chuyên viên nhập xong (hoặc liên hệ trực tiếp) rồi duyệt lại.' },
        { issue: 'Sản phẩm báo "chưa có định mức đang active" (active = đang có hiệu lực) khi tạo đơn hàng/lệnh sản xuất', cause: 'SKU chưa từng được Giám đốc duyệt định mức, hoặc bản duyệt cũ đã bị thay thế bởi một hồ sơ khác đang chờ duyệt.', fix: 'Kiểm tra trạng thái SKU ở màn "Duyệt SKU"; hoàn tất quy trình duyệt định mức trước.' },
        { issue: '"Chưa duyệt đủ nhóm mảnh: còn thiếu SAT" (hoặc tương tự cho chi tiết)', cause: 'Bấm "Xác nhận hoàn tất" khi nhóm vật tư đó của nhánh chưa có dữ liệu/chưa duyệt xong.', fix: 'Kiểm tra đủ dữ liệu cho mọi nhóm vật tư trong nhánh trước khi xác nhận hoàn tất.' },
        { issue: '"Plan form ... đang ở trạng thái ... - chỉ có thể sửa khi đang làm định mức"', cause: 'Cố sửa tên/mã SKU khi hồ sơ đã gửi chờ Giám đốc duyệt hoặc đã duyệt xong.', fix: 'Chỉ sửa được thông tin SKU khi đang ở trạng thái "Đang làm định mức".' },
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
      id: 'journey-10-11-12-weaving-pack',
      title: '10-12. Đan ngoài → Chuyền kiểm → Đóng gói',
      roles: ['warehouse'],
      purpose: 'Đoạn cuối hành trình một mảnh sản phẩm: rời khung cơ khí, ra điểm đan (nếu cần), quay về kiểm tra, rồi đóng gói thành phẩm.',
      preconditions: [
        'Mảnh đã cắt/hàn/sơn xong và kiểm đạt đã được chuyển sang kho Vật tư thành phẩm (thủ kho khu vực khung cơ khí chuyển, thủ kho Vật tư thành phẩm xác nhận nhận).',
      ],
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
        'Lỗi chất lượng (KCS) luôn tách "sửa được" và "phế bỏ hẳn" — không chỉ đạt/không đạt.',
        'Nhận thiếu vẫn được ghi nhận — cả khi nhận hàng mua về lẫn khi nhận vật tư xuống xưởng, không bắt buộc khớp tuyệt đối.',
        'Gộp đợt cắt sắt (nhiều sản phẩm dùng chung loại sắt) chỉ thực hiện được TRƯỚC khi Giám đốc duyệt lệnh sản xuất.',
      ],
      result: 'Hiểu đúng các quy tắc chung, tránh nhầm lẫn khi thao tác thực tế.',
      tags: ['ngoại lệ', 'từ chối', 'reject', 'sửa được', 'phế'],
      sourceRefs: ['docs/quy-trinh-2026-08-15-hanh-trinh-don-hang.html'],
    },
  ],
};
