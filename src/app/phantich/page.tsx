import type { Metadata } from 'next';

/**
 * Kiểm toán nghiệp vụ DNA-ERP — báo cáo tĩnh (server component, không gọi API).
 * Nội dung tổng hợp từ việc đọc trực tiếp source code BE (D:\DNA-ERP-BE\src, 31 module) và FE
 * (d:\DNA-ERP\src), đối chiếu prisma/schema.prisma + tài liệu nội bộ nhóm, tính đến 2026-08-17.
 * Không tự suy đoán nghiệp vụ ngoài bằng chứng code — các điểm chưa xác minh được ghi rõ trong nội dung.
 */

export const metadata: Metadata = {
  title: 'Kiểm toán nghiệp vụ DNA-ERP',
};

type Sev = 'crit' | 'high' | 'med' | 'low';

const SEV_META: Record<Sev, { label: string; badge: 'red' | 'amber' | 'blue' | 'green' }> = {
  crit: { label: 'Critical', badge: 'red' },
  high: { label: 'High', badge: 'amber' },
  med: { label: 'Medium', badge: 'blue' },
  low: { label: 'Low', badge: 'green' },
};

interface FindingItem {
  id: string;
  sev: Sev;
  title: string;
  module: string;
  hienTrang: string;
  vanDe: string;
  ruiRo: string;
  deXuat: string;
  anhHuong: string;
}

const FINDINGS: FindingItem[] = [
  {
    id: 'C1', sev: 'crit', module: 'Kho vận',
    title: 'Chặng kho "Vật tư TP → Thành phẩm" hiển thị đơn hàng giả và không ghi sổ khi xác nhận',
    hienTrang: 'Với 2/3 phạm vi kho (thanh-pham), `WarehouseXuatPage.tsx:74-114,167` vẫn khởi tạo danh sách "lệnh SX cần xuất" từ hằng số MOCK hardcode. Khi bấm "Xác nhận", FE gọi API chỉ gửi tên vật tư dạng text, không gửi materialId — DTO cho phép field này rỗng (`create-warehouse-transfer-item.dto.ts:6-9`), và BE bỏ qua thẳng dòng không có materialId khi ghi sổ (`warehouse-transfers.service.ts:428-429`).',
    vanDe: 'Phiếu chuyển kho tạo và xác nhận thành công (đổi trạng thái, có thời điểm xác nhận) nhưng không có bút toán StockLedger nào được ghi — tồn kho vật lý không đổi dù chứng từ báo đã xong.',
    ruiRo: 'Vi phạm trực tiếp nguyên tắc "StockLedger là nguồn sự thật duy nhất" — thủ kho tưởng đã chuyển xong nhưng số liệu kho thành phẩm không nhúc nhích, sai lệch kiểm kê tích luỹ theo thời gian.',
    deXuat: 'Thay MOCK bằng nguồn dữ liệu thật (theo đúng cách đã làm cho chặng phôi-sơn-hàn → vật tư-TP), bắt buộc materialId khi tạo dòng chuyển kho.',
    anhHuong: 'Báo cáo tồn kho thành phẩm, đối soát kiểm kê cuối kỳ, mọi màn hình đọc StockQuant.',
  },
  {
    id: 'C2', sev: 'crit', module: 'Kho vận',
    title: 'Xoá cứng Vật tư (Material) làm mất dấu vết trên sổ cái kho',
    hienTrang: '`MaterialsService.remove():293-301` gọi thẳng xoá DB, không kiểm ràng buộc. FK thật (đối chiếu migration, không phải schema.prisma) của stock_ledger.materialId → materials.id là ON DELETE SET NULL.',
    vanDe: 'Xoá 1 vật tư đã từng có bút toán kho (kể cả chỉ có OPENING_BALANCE/ADJUST) thành công bình thường, và mọi dòng StockLedger liên quan bị NULL hoá materialId vĩnh viễn.',
    ruiRo: '"Sổ cái bất biến, append-only" bị sửa đổi hồi tố — mất hẳn thông tin "bút toán này của vật tư nào", báo cáo theo vật tư không còn khớp SUM, không lần lại được nguồn gốc số dư.',
    deXuat: 'Đăng ký soft-delete cho Material (đã ghi nhận trong quy ước nhóm nhưng chưa làm), hoặc đổi FK về RESTRICT + trả lỗi nghiệp vụ rõ ràng thay vì cho xoá.',
    anhHuong: 'Mọi báo cáo tồn kho/kiểm toán, đối soát Purchase Proposal lịch sử, BOM đã dùng vật tư đó.',
  },
  {
    id: 'C3', sev: 'crit', module: 'Sản xuất/MES',
    title: 'Duyệt tay lại phương án cắt sắt có thể trừ tồn kho 2 lần',
    hienTrang: 'Nút "Tính lại" luôn tạo CuttingProposal mới. Guard chặn duyệt trùng (autoApproveBlockReason) chỉ áp dụng cho nhánh tự động duyệt; đường duyệt thủ công qua `POST /cutting-proposals/:id/approve` (`cutting-proposals.service.ts:639-733`) chỉ kiểm phương án đang duyệt là DRAFT, không kiểm đã có phương án khác APPROVED cùng neo (PO/PI) hay chưa.',
    vanDe: 'Người dùng có thể duyệt tay 1 phương án mới trong khi phương án cũ vẫn APPROVED — phương án cũ chỉ bị đánh SUPERSEDED, không hoàn tồn, không huỷ đề xuất mua đã sinh.',
    ruiRo: 'Trừ tồn kho sắt 2 lần cho cùng 1 nhu cầu thật, sinh đề xuất mua hàng trùng → mua thừa vật tư thật (tiền thật), tồn kho hệ thống lệch âm.',
    deXuat: 'Áp guard tương đương cho cả đường duyệt thủ công, bất kể gọi từ đâu.',
    anhHuong: 'Purchase Proposal, Stock Ledger, Material.',
  },
  {
    id: 'C4', sev: 'crit', module: 'Sản xuất/MES',
    title: 'Tồn kho sắt không được đối chiếu lại khi Phôi cắt thực tế lệch phương án đã duyệt',
    hienTrang: 'StockLedger (STEEL_ISSUE) chỉ ghi đúng 1 lần khi duyệt phương án cắt, theo số liệu đề xuất. Khi Phôi báo cắt xong với actualBarCount thực tế lệch (`steel-issues.service.ts:255-263`), cờ isOffPlan chỉ mang tính hiển thị — toàn bộ SteelIssuesService không import StockLedgerService, không có bút toán điều chỉnh nào.',
    vanDe: 'Không có cơ chế nào đối chiếu lại tồn kho theo số liệu cắt thực tế.',
    ruiRo: 'Tồn kho sắt trong hệ thống lệch vĩnh viễn so với tồn kho vật lý, sai lệch tích luỹ theo thời gian, không có cơ chế phát hiện.',
    deXuat: 'Cần quyết định nghiệp vụ: chấp nhận sai số có ghi chú rõ, hoặc bổ sung bút toán điều chỉnh khi lệch vượt ngưỡng.',
    anhHuong: 'Stock Ledger, kiểm kê kho, báo cáo tồn.',
  },
  {
    id: 'C5', sev: 'crit', module: 'Bán hàng / Mua hàng',
    title: 'Không có module công nợ/kế toán — cả 2 chiều phải thu và phải trả',
    hienTrang: 'Không có model Payable/Invoice/Payment nào trong schema. SalesOrder.depositAmount/paidAmount chỉ là 2 số tĩnh, không có API cập nhật theo thời gian, không có đơn giá SKU nào để tính giá trị đơn hàng thật. FE (`sales-orders-api.ts:60`) hard-code totalValue: 0, và `OrderManagementPage.tsx:270-271,357-358` vẫn hiển thị "Số tiền còn lại" tính từ số 0 đó cho nhân viên Sales.',
    vanDe: 'Hệ thống không có cách nào ghi nhận 1 khoản thanh toán mới; đồng thời phía mua hàng cũng không theo dõi đang nợ NCC bao nhiêu sau khi duyệt mua/nhận hàng.',
    ruiRo: 'Với đơn đã thanh toán > 0, "Số tiền còn lại" hiển thị số âm — dữ liệu sai hiển thị trực tiếp cho nhân viên; đồng thời không kiểm soát được công nợ NCC, rủi ro tài chính thực tế cho ERP xuất khẩu.',
    deXuat: 'Ẩn 2 trường số tiền cho tới khi có model giá trị đơn hàng thật; xác nhận với nghiệp vụ liệu công nợ có đang được quản lý ở hệ thống kế toán ngoài hay cần xây module riêng.',
    anhHuong: 'Không module nào trong hệ thống phụ thuộc — nhưng là khoảng trống nghiệp vụ lớn nếu cần kiểm soát công nợ trước khi golive thật.',
  },
  {
    id: 'C6', sev: 'crit', module: 'Auth/RBAC',
    title: 'Nghi vấn: soft-delete Role có thể không có hiệu lực ở đúng luồng đăng nhập/làm mới token',
    hienTrang: 'Cơ chế soft-delete (`soft-delete.extension.ts:29-92`) dùng đúng pattern Prisma Client Extension chuẩn, nhưng theo tài liệu Prisma chính thức, cơ chế này không tự áp dụng cho model được load qua include lồng từ model khác. UsersService.findAuthProfileByUsername/ById (dùng ở AuthService.login()/refresh()) load Role qua đúng kiểu include lồng 3 tầng (`users.service.ts:28-36,248-261`). Không có integration test thật (kết nối DB) nào xác nhận hành vi đúng cho đường này — 1 bug y hệt loại này đã từng xảy ra thật với Role trước đây (theo CONTRIBUTING.md).',
    vanDe: 'Chưa xác minh được 100% qua test thật trong phạm vi audit này — cần 1 integration test DB thật để kết luận chắc chắn.',
    ruiRo: 'Nếu đúng như nghi vấn: 1 Role bị xoá mềm vẫn xuất hiện đầy đủ trong JWT payload lúc login/refresh — quyền đã thu hồi vẫn có hiệu lực tới 7 ngày qua refresh token.',
    deXuat: 'Viết ngay 1 integration test thật (không mock Prisma): xoá 1 Role, gọi lại findAuthProfileById cho user còn giữ role đó, assert quyền không còn xuất hiện. Vá nếu fail.',
    anhHuong: 'Toàn bộ RBAC — mọi guard đều tin tưởng payload sinh ra từ đúng luồng này.',
  },

  {
    id: 'H1', sev: 'high', module: 'Bán hàng / BOM',
    title: 'SKU đã duyệt/đang sản xuất vẫn xoá được',
    hienTrang: '`SkusService.remove():185-192` xoá thẳng, không kiểm status — khác hẳn BomRevisionsService.remove() vốn chặn rõ ràng khi không phải DRAFT.',
    vanDe: '1 PlanForm đã APPROVED (đã activate BOM, đã sinh ProductionOrder đang chạy) vẫn xoá được qua API bình thường.',
    ruiRo: 'Mất toàn bộ vết duyệt (lịch sử review, người tạo, khách hàng) của 1 lô đang sản xuất thật, trong khi PO/PI vẫn chạy tiếp "mồ côi" nguồn gốc.',
    deXuat: 'Chặn xoá khi status khác IN_PROGRESS, theo đúng pattern đã áp cho BomRevision.',
    anhHuong: 'Production Order/Invoice (mất truy vết định mức nguồn), Audit.',
  },
  {
    id: 'H2', sev: 'high', module: 'Kho vận',
    title: 'Xuất vật tư tiêu hao không đối chiếu tồn kho vật lý thực',
    hienTrang: '`MaterialIssuesService.create():90-103` chỉ so với định mức BOM còn lại, không khoá/so với stock_quant thật như các luồng trừ tồn khác đều làm. DB cũng không có CHECK chặn âm.',
    vanDe: 'Có thể xuất vượt tồn kho thực (CO₂, dây hàn, bột sơn...) miễn còn nằm trong định mức BOM.',
    ruiRo: 'Tồn kho âm không cảnh báo, sai lệch giữa sổ sách và tồn thực khi kiểm kê.',
    deXuat: 'Thêm bước kiểm tồn thật trước khi cho xuất, theo đúng pattern đã dùng ở luồng chuyển kho.',
    anhHuong: 'Kiểm kê kho, báo cáo tồn vật tư tiêu hao.',
  },
  {
    id: 'H3', sev: 'high', module: 'Sản xuất/MES',
    title: 'Phế liệu KCS không bao giờ ghi sổ kho',
    hienTrang: 'QcReviewsService ghi scrapQty vào QcReview và tạo đề xuất cấp lại khi có phế, nhưng không nơi nào gọi ghi StockLedger vào kho ảo SCRAP — cả nhánh Phôi lẫn Hàn/Sơn.',
    vanDe: 'Kho ảo SCRAP tồn tại trong seed nhưng chưa từng nhận bút toán nào từ luồng KCS thật.',
    ruiRo: 'Không thể tra "đã phế bao nhiêu vật tư/mảnh nào" qua sổ kho — chỉ suy gián tiếp qua tổng scrapQty, không đúng mô hình sổ cái kép hệ thống công bố.',
    deXuat: 'Bổ sung bút toán chuyển vào kho SCRAP khi scrapQty > 0 ở cả 2 nhánh.',
    anhHuong: 'Báo cáo tỷ lệ phế/hao hụt sản xuất, đối chiếu định mức cắt.',
  },
  {
    id: 'H4', sev: 'high', module: 'Mua hàng',
    title: 'Nhận hàng mua không kiểm phạm vi kho được phân quyền',
    hienTrang: 'PurchaseProposalsService.receiveItem() xác định kho nhận hoàn toàn theo material.warehouseId, không đối chiếu warehouseScope của người thao tác — khác hẳn WarehouseTransfersService.confirm() có kiểm rõ ràng.',
    vanDe: 'Tài khoản thủ kho bị giới hạn ở 1 kho vẫn nhập được hàng vào kho khác, miễn có quyền chung PURCHASE_RECEIPT:UPDATE.',
    ruiRo: 'Không đúng nguyên tắc phân quyền theo kho đã áp dụng nhất quán ở các module kho khác — cùng loại lỗ hổng đã từng bị vá ở chiều khác nhưng bỏ sót ở chiều "kho nhận".',
    deXuat: 'Thêm kiểm tra warehouseScope trước khi ghi bút toán nhận hàng.',
    anhHuong: 'RBAC tổng thể của domain kho.',
  },
  {
    id: 'H5', sev: 'high', module: 'Sản xuất/MES',
    title: 'Đề xuất cắt sắt có thể treo vĩnh viễn khi tính toán',
    hienTrang: 'Gọi solver theo kiểu fire-and-forget, record tạo trạng thái CALCULATING trước. Toàn bộ backend không có bất kỳ cron job nào để quét dọn.',
    vanDe: 'Nếu tiến trình server crash/restart đúng lúc đang xử lý, record kẹt ở CALCULATING mãi mãi, không ai được thông báo.',
    ruiRo: '1 PO/PI "treo" không rõ ràng; nếu nằm trong PI gộp, không SKU nào trong nhóm dùng được phương án cắt.',
    deXuat: 'Thêm cron quét các bản ghi CALCULATING quá TTL (vd 10 phút) → đánh FAILED để người dùng bấm "Tính lại".',
    anhHuong: 'Purchase Proposal, thông báo QLSX.',
  },
  {
    id: 'H6', sev: 'high', module: 'Sản xuất/MES',
    title: 'QC Phôi tính theo cây sắt, không theo sản phẩm cắt ra',
    hienTrang: 'QcReviewsService.review() tính đơn vị theo "cây" (actualBarCount ?? barCount), trong khi 1 cây có thể chứa nhiều đoạn khác cỡ cho nhiều mảnh khác nhau.',
    vanDe: 'Reject 1 cây có thể loại bỏ oan nhiều sản phẩm hợp lệ cắt trên cùng cây đó nếu chỉ 1 đoạn thật sự lỗi.',
    ruiRo: 'Sai lệch dữ liệu KCS ở mức "cây" so với thực tế mức "sản phẩm", ảnh hưởng số liệu hao hụt và cấp bù.',
    deXuat: 'Xác nhận nghiệp vụ có chấp nhận đơn vị "cây" hay cần chi tiết hoá theo từng bó cắt (CutBundle).',
    anhHuong: 'Steel Issue, Replenish Request, báo cáo hao hụt.',
  },
  {
    id: 'H7', sev: 'high', module: 'Sản xuất/MES',
    title: 'Hàn/Sơn không có đường cấp bù khi báo lỗi',
    hienTrang: 'QcReviewsService.fulfillReplenishRequest() chặn cứng cho mọi request không thuộc nhánh Phôi — request sinh từ Hàn/Sơn chỉ có thể bị từ chối, không bao giờ fulfill được.',
    vanDe: 'Hàng hỏng ở Hàn/Sơn (đã tiêu tốn vật tư tiêu hao thật) không có đường cấp lại bán-thành-phẩm chính thức trong hệ thống.',
    ruiRo: 'Quy trình thực tế phải xử lý ngoài hệ thống (giấy tờ/miệng), không có audit trail.',
    deXuat: 'Xác nhận với nghiệp vụ: nếu quy trình thật là "báo lô mới thay vì cấp bù", cần chốt tài liệu; nếu không, thiết kế đường cấp bù cho Hàn/Sơn.',
    anhHuong: 'Material Issue, Replenish Request.',
  },
  {
    id: 'H8', sev: 'high', module: 'Auth/RBAC',
    title: 'Tham số hệ thống (solver, dung sai) không được audit',
    hienTrang: 'SystemConfig không nằm trong danh sách model được audit tự động, dù chính comment trong schema đã tự cảnh báo: sửa sai solverStockLengths gây đề xuất mua sai cỡ mà "không ai phát hiện được".',
    vanDe: 'Không có writeAuditLog() nào cho model này.',
    ruiRo: 'Khi có tranh chấp "ai đổi tham số, làm sai lệch hàng loạt đề xuất cắt/mua, lúc nào" — không tra được.',
    deXuat: 'Thêm SystemConfig vào danh sách audit — chi phí gần như bằng 0.',
    anhHuong: 'Cutting Proposals, Purchase Proposals.',
  },
  {
    id: 'H9', sev: 'high', module: 'Auth/RBAC',
    title: '2 lớp phân quyền (Role & mfgRole) có thể lệch pha',
    hienTrang: 'PATCH /users/:id (sửa roleIds) và PATCH /users/:id/mfg-attributes (sửa mfgRole) đều chỉ cần cùng 1 quyền USER:UPDATE, không ràng buộc chéo với nhau.',
    vanDe: 'Admin có thể gán/xoá role không khớp với mfgRole hiện tại của user (vd user mfgRole=PHOI nhưng bị tước role PHOI_STAFF).',
    ruiRo: '2 guard độc lập (theo Permission và theo mfgRole) có thể ứng xử không nhất quán cho cùng 1 user, gây 403 khó hiểu.',
    deXuat: 'Chặn/cảnh báo khi roleIds mới không khớp mfgRole hiện có; hoặc không cho sửa roleIds trực tiếp cho user đã có mfgRole.',
    anhHuong: 'Mọi endpoint dùng cả 2 guard cùng lúc: production-invoices, qc-reviews, steel-issues, material-issues, production-batches.',
  },
  {
    id: 'H10', sev: 'high', module: 'FE toàn hệ thống',
    title: 'Nhiều màn hình FE vẫn hiển thị dữ liệu giả cho người dùng cuối',
    hienTrang: 'Grep toàn bộ FE (2026-08-17) xác nhận còn tồn tại: Manufacturing/XuatKhoPage.tsx (tồn kho + lịch sử xuất kho hoàn toàn giả), Manufacturing/PhoiDinhMucManhPage.tsx (100% mock, tự khai trong code), ProductionPlan/VatTuDashboardPage.tsx (trộn lẫn số thật/giả không phân biệt được trên UI), InboundWarehouse/WarehouseXuatPage.tsx phần kho thành phẩm (đơn hàng giả, xem C1).',
    vanDe: 'Đây là các trang tác nghiệp thật, không phải trang demo — người dùng cuối (thủ kho, KHSX) nhìn thấy số liệu không có thật.',
    ruiRo: 'Ra quyết định xuất kho/điều phối dựa trên tồn kho ảo, nhầm đơn hàng giả là thật.',
    deXuat: 'Ưu tiên vá XuatKhoPage.tsx trước (rủi ro cao nhất), sau đó tới các trang còn lại.',
    anhHuong: 'Manufacturing, ProductionPlan, InboundWarehouse — quyết định vận hành kho/sản xuất hàng ngày.',
  },

  {
    id: 'M1', sev: 'med', module: 'Bán hàng / BOM',
    title: 'Dữ liệu BOM nháp mồ côi khi xoá SKU',
    hienTrang: 'FK bom_revision.sourcePlanFormId là SET NULL; SkusService.remove() không đụng gì tới BomRevision/dữ liệu con.',
    vanDe: 'Xoá SKU đang nhập định mức dở để lại 1 revision DRAFT + dòng con vĩnh viễn, không còn tra ngược được.',
    ruiRo: 'Rác dữ liệu tích luỹ, nhiễu lịch sử số revision của sản phẩm.',
    deXuat: 'Xoá kèm BomRevision DRAFT sở hữu bởi SKU đó trong cùng transaction.',
    anhHuong: 'BOM Revisions.',
  },
  {
    id: 'M2', sev: 'med', module: 'Bán hàng / BOM',
    title: 'Endpoint activate BOM là đường vòng, bỏ qua bất biến pipeline SKU',
    hienTrang: 'POST /bom-revisions/:id/activate chỉ kiểm quyền APPROVE, không kiểm PlanForm đã qua đủ 2 nhánh duyệt hay chưa — khác hẳn đường duyệt chuẩn qua SKU.',
    vanDe: 'Gọi trực tiếp endpoint này activate được 1 BOM DRAFT dù SKU chưa từng qua duyệt.',
    ruiRo: 'Định mức chưa được KHSX rà soát đầy đủ có thể lọt vào sản xuất thật (khả năng xảy ra thấp do FE không gọi, nhưng hậu quả cao).',
    deXuat: 'Bỏ endpoint generic này khỏi domain SKU, hoặc thêm điều kiện chặn khi PlanForm nguồn chưa APPROVED.',
    anhHuong: 'Production Order (ghim BOM sai thời điểm).',
  },
  {
    id: 'M3', sev: 'med', module: 'Lệnh sản xuất',
    title: 'SKU trong PI có thể kẹt vĩnh viễn ở "đã duyệt" mà không có lệnh SX',
    hienTrang: 'Nếu bước tạo ProductionOrder thất bại sau khi đã ghi APPROVED (race hiếm, chính code tự nhận), catch chỉ log lỗi, không rollback trạng thái.',
    vanDe: 'Item ở trạng thái APPROVED "giả" — Sếp tưởng đã duyệt xong nhưng xưởng không có gì để làm.',
    ruiRo: 'Đơn hàng trễ tiến độ mà không ai phát hiện cho tới khi thủ kho báo "không thấy lệnh sản xuất".',
    deXuat: 'Thêm endpoint/job liệt kê item APPROVED không có ProductionOrder, hoặc rollback khi tạo PO thất bại.',
    anhHuong: 'Production Orders, Cutting Proposals, Notifications.',
  },
  {
    id: 'M4', sev: 'med', module: 'Bán hàng',
    title: 'Trạng thái hiển thị cho Sales không tự đồng bộ với tiến độ SX thật',
    hienTrang: 'Duy nhất 1 đường ghi SalesOrderItem.status — nhận thẳng từ DTO client gửi lên, không có nơi nào trong Production Invoice/Cutting Proposal/Weaving tự động cập nhật lại.',
    vanDe: 'Stepper 7 bước hiển thị cho Sales là dữ liệu nhập tay, không ràng buộc khớp với PI/ProductionOrder thật.',
    ruiRo: 'Sales/khách hàng thấy tiến độ "đẹp" nhưng có thể lệch hoàn toàn thực tế nếu không ai cập nhật tay đều đặn.',
    deXuat: 'Auto-derive status này từ trạng thái PI/ProductionOrder/chuyền kiểm/đóng gói thật, hoặc làm rõ ai chịu trách nhiệm cập nhật tay.',
    anhHuong: 'Production Invoices (nguồn sự thật thật sự nằm ở đó, không đồng bộ ngược).',
  },
  {
    id: 'M5', sev: 'med', module: 'FE / Sản xuất',
    title: 'Bảng thống kê KHSX vẫn dựng số liệu giả dù BE đã có API thật',
    hienTrang: 'ThongKePagePlan.tsx sinh trạng thái Chuyền kiểm/Đóng gói bằng hash giả theo mã PO thay vì gọi API thật (BE đã có listTransferCheckPieces/getPackaging từ lâu). Một comment cũ trong LenhSanXuatHan.tsx nhắc "KhoPhoiPage còn mock" cũng đã lỗi thời — trang đó đã nối API thật.',
    vanDe: 'Trang tác nghiệp (KhoDongGoiPage) đã nối đúng, nhưng trang tổng quan tiến độ KHSX xem lại vẫn hiện số giả cho đúng 2 công đoạn đó.',
    ruiRo: 'KHSX ra quyết định điều phối sai vì tin vào % tiến độ giả (vd tưởng đã đóng gói xong trong khi chưa).',
    deXuat: 'Nối vào API thật đã sẵn có — hạ tầng BE không thiếu, chỉ thiếu tầng gọi API ở FE. Dọn kèm comment lỗi thời.',
    anhHuong: 'Production Invoices, Weaving Issues.',
  },
  {
    id: 'M6', sev: 'med', module: 'Bán hàng',
    title: 'Tạo đơn hàng/lệnh sản xuất không atomic',
    hienTrang: 'Tạo SalesOrder rồi tạo ProductionInvoice liên kết là 2-3 lời gọi Prisma tuần tự, không bọc trong 1 transaction.',
    vanDe: 'Crash giữa các bước để lại đơn hàng không có PI liên kết, hoặc PI với mã tạm chưa kịp đổi.',
    ruiRo: 'Thấp về tần suất, khó phát hiện khi xảy ra vì không có lỗi trả về cho client ở bước đã thành công trước đó.',
    deXuat: 'Bọc toàn bộ trong 1 transaction.',
    anhHuong: 'Production Invoices/Sales Orders liên kết 1-1.',
  },
  {
    id: 'M7', sev: 'med', module: 'Kho vận',
    title: 'Điều chỉnh tồn kho thủ công không giới hạn âm, không bắt buộc lý do',
    hienTrang: 'StockLedgerService.adjust() chỉ validate số lượng > 0 và đúng 1 chân hàng — không đọc/so với tồn hiện có trước khi ghi; trường ghi chú lý do là tuỳ chọn.',
    vanDe: '1 điều chỉnh tay có thể đẩy tồn kho bất kỳ dòng nào xuống âm không giới hạn, có thể không kèm lý do.',
    ruiRo: 'Lạm dụng/nhầm lẫn thao tác gây sai lệch tồn kho không kiểm soát.',
    deXuat: 'Validate tồn khả dụng trước khi cho trừ; bắt buộc ghi lý do khi điều chỉnh.',
    anhHuong: 'Toàn bộ báo cáo tồn kho.',
  },
  {
    id: 'M8', sev: 'med', module: 'Mua hàng',
    title: 'Không lưu lịch sử giá vật tư theo nhà cung cấp',
    hienTrang: 'Đổi giá NCC ghi đè trực tiếp, không có bảng lịch sử; bảng giá này cũng không nằm trong danh sách audit.',
    vanDe: 'Mỗi lần đổi giá, giá cũ mất hẳn.',
    ruiRo: 'Không thể so sánh xu hướng giá hoặc đối chiếu khi có tranh chấp với NCC.',
    deXuat: 'Cần xác minh mức độ cần thiết với nghiệp vụ; nếu cần, thêm bảng lịch sử giá hoặc đưa vào audit log.',
    anhHuong: 'Không lớn — báo giá theo từng đề xuất mua đã có lưu riêng, đây chỉ là "giá niêm yết" tham khảo.',
  },
  {
    id: 'M9', sev: 'med', module: 'Kho vận',
    title: 'Race condition nhẹ khi tạo phiếu chuyển kho cho mảnh',
    hienTrang: 'createPieceTransfer()/getPieceTransferPlan() không khoá dòng (FOR UPDATE) như luồng vật tư tương đương — chính code đã tự nhận đây là đánh đổi có chủ đích vì mảnh không có StockQuant để khoá.',
    vanDe: '2 request gần như đồng thời cho cùng (PO, mảnh) đều đọc cùng số gợi ý, đều tạo phiếu được.',
    ruiRo: 'Double-book mảnh đã qua KCS cho 2 phiếu chuyển kho khác nhau — sai lệch logic "đã chuyển bao nhiêu", dù không gây tồn âm ở tầng StockLedger.',
    deXuat: 'Cân nhắc advisory lock theo (PO, mảnh) khi tạo phiếu, hoặc transaction serializable.',
    anhHuong: 'QC, kế hoạch chuyển kho, báo cáo tiến độ.',
  },
  {
    id: 'M10', sev: 'med', module: 'Sản xuất/MES',
    title: 'Không có khái niệm "thành phẩm nhập kho" xuyên suốt hệ thống',
    hienTrang: 'Đóng gói (theo đơn vị thùng) không ràng buộc phải qua Chuyền kiểm (quyết định nghiệp vụ có chủ đích), và hoàn toàn không ghi StockLedger — tách biệt khỏi số mảnh đã chuyển vào kho vật tư-TP.',
    vanDe: '2 con số (số mảnh đã chuyển kho, số thùng đã đóng gói) hoàn toàn độc lập, không đối chiếu chéo được.',
    ruiRo: 'Không thể trả lời "kho thành phẩm thực tế đang có bao nhiêu" từ sổ kho — phải dựa hoàn toàn vào số đếm đóng gói, tách rời khỏi hệ thống StockLedger dùng cho mọi kho khác.',
    deXuat: 'Xem mục "Nghiệp vụ còn thiếu" — cần quyết định nghiệp vụ về việc biểu diễn SKU thành phẩm trong StockLedger trước khi làm.',
    anhHuong: 'Kho thành phẩm, báo cáo tồn kho tổng, xuất hàng bán.',
  },
  {
    id: 'M11', sev: 'med', module: 'Sản xuất/MES',
    title: 'Thiếu khoá chống trùng khi ghi nhận chuyền kiểm/đóng gói',
    hienTrang: '2 endpoint ghi nhận Chuyền kiểm/Đóng gói không nhận header chống trùng, khác quy ước đã áp dụng nhất quán ở mọi module MES khác (SteelIssue/WeavingIssue/ProductionBatch/WarehouseTransfer).',
    vanDe: 'Mất mạng/timeout rồi client thử lại (phổ biến trên thiết bị xưởng/kho) sẽ tạo dòng ghi nhận trùng.',
    ruiRo: 'Với Chuyền kiểm, số đã kiểm cộng dồn sai vĩnh viễn không có trần nào chặn; với Đóng gói, double-submit gần ngưỡng có thể chặn nhầm phần hợp lệ còn lại.',
    deXuat: 'Bổ sung header chống trùng cho 2 endpoint này, theo đúng quy ước đã có.',
    anhHuong: 'Báo cáo tiến độ Chuyền kiểm/Đóng gói, PI.',
  },
  {
    id: 'M12', sev: 'med', module: 'Auth/RBAC',
    title: 'Không giới hạn phiên đăng nhập; token làm mới lưu ở localStorage',
    hienTrang: '2026-08-21: ĐÃ SỬA phần lưu token — access/refresh token giờ nằm trong cookie httpOnly do BE set (không còn ở localStorage), FE gọi qua proxy same-origin (Next.js rewrites, xem next.config.mjs) để cookie hoạt động ổn định kể cả Safari/iOS dù FE (Vercel) và BE (Render) khác domain. Đăng nhập mới vẫn CHƯA revoke token cũ nào (phần này còn mở, xem đề xuất).',
    vanDe: 'Không giới hạn số thiết bị đăng nhập cùng lúc. Rủi ro XSS-đánh-cắp-token (refresh token 7 ngày) đã giảm đáng kể vì JS không còn đọc được token nữa — vẫn còn CSRF về lý thuyết nhưng SameSite=Lax + same-origin proxy đã chặn vector thực tế cho API JSON thuần.',
    ruiRo: 'Trung bình với ERP nội bộ ít traffic công khai, nhưng là điểm yếu chuẩn nếu FE có lỗ hổng XSS trong tương lai.',
    deXuat: 'Thêm chức năng "đăng xuất khỏi mọi thiết bị" (revoke toàn bộ refresh token của user).',
    anhHuong: 'Toàn hệ thống auth.',
  },
  {
    id: 'M13', sev: 'med', module: 'Auth/RBAC',
    title: 'Thông báo không có cơ chế đẩy — chỉ xem khi chủ động vào trang',
    hienTrang: 'Không có polling/WebSocket/SSE nào ở FE cho notification; chỉ hiển thị khi vào đúng trang Admin.',
    vanDe: 'BE hỗ trợ broadcast theo nhóm người dùng nhưng FE không đẩy tới đúng người, đúng lúc.',
    ruiRo: 'Cảnh báo khẩn (hết hàng, solver lỗi...) không có tác dụng thực tế — tồn tại trong DB nhưng không tới người cần biết.',
    deXuat: 'Thêm polling định kỳ nhẹ kèm badge số chưa đọc ở layout chung cho mọi role.',
    anhHuong: 'Mọi cảnh báo nghiệp vụ tương lai.',
  },
  {
    id: 'M14', sev: 'med', module: 'Auth/RBAC',
    title: 'Upload ảnh không kiểm quyền',
    hienTrang: 'POST /uploads/image chỉ yêu cầu đăng nhập, không có kiểm tra quyền theo module — vi phạm chính quy ước RBAC nhóm tự đặt ra (mọi route phải có, trừ route công khai tường minh).',
    vanDe: 'Bất kỳ user đã đăng nhập nào (kể cả quyền thấp nhất) đều upload được ảnh.',
    ruiRo: 'Thấp về lộ dữ liệu (đã giới hạn dung lượng/kiểu file), nhưng là lỗ hổng lạm dụng tài nguyên lưu trữ.',
    deXuat: 'Gắn kiểm tra quyền tối thiểu, hoặc ghi rõ lý do cố ý miễn trừ.',
    anhHuong: 'Mọi module có upload ảnh (materials, packaging...).',
  },
  {
    id: 'M15', sev: 'med', module: 'Auth/RBAC',
    title: 'Cơ chế phân quyền theo kho đăng ký toàn cục nhưng không route nào dùng',
    hienTrang: 'Guard/decorator phân quyền theo kho đăng ký toàn cục nhưng chưa từng được gắn ở bất kỳ controller nào — enforcement thật hiện nằm rải rác thủ công trong service (WarehouseTransfers, StockLedger).',
    vanDe: 'Hạ tầng tồn tại nhưng "chết", không kích hoạt.',
    ruiRo: 'Không phải lỗ hổng hiện tại, nhưng dễ gây lỗ hổng mới: dev tương lai viết module liên quan kho có thể tưởng nhầm guard này đã lo, quên tự viết kiểm tra tay (đã có tiền lệ lặp lại nhiều lần trong lịch sử dự án).',
    deXuat: 'Xoá guard nếu không dùng để tránh hiểu nhầm, hoặc thực sự áp dụng lên các route theo kho hiện có.',
    anhHuong: 'Mọi module thao tác theo kho cụ thể.',
  },

  {
    id: 'L1', sev: 'low', module: 'Mua hàng',
    title: 'Xoá nhà cung cấp làm mất liên kết trên lịch sử báo giá',
    hienTrang: 'FK báo giá → NCC là SET NULL, trong khi FK vật tư-NCC là RESTRICT — không nhất quán giữa 2 bảng liên quan cùng 1 NCC.',
    vanDe: 'Xoá 1 NCC đã từng được chọn trong lịch sử mua hàng làm mất liên kết ngược, dù tên NCC vẫn còn dạng text snapshot.',
    ruiRo: 'Thấp — vẫn còn text hiển thị, chỉ mất khả năng tra cứu ngược qua khoá ngoại thật.',
    deXuat: 'Cân nhắc đổi sang RESTRICT nếu cần audit trail đầy đủ theo NCC.',
    anhHuong: 'Không đáng kể.',
  },
  {
    id: 'L2', sev: 'low', module: 'Kho vận',
    title: 'Xem sổ kho không lọc theo phạm vi kho được phân quyền',
    hienTrang: 'API xem StockLedger/StockQuant chỉ yêu cầu quyền xem chung, không áp dụng warehouseScope như các module kho khác.',
    vanDe: 'Nhân viên kho bị giới hạn 1 kho vẫn xem được toàn bộ dữ liệu kho khác qua API.',
    ruiRo: 'Rò rỉ thông tin tồn kho nhẹ (chỉ đọc) — có thể là chủ ý (thủ kho cần biết tồn kho khác để yêu cầu điều chuyển), cần xác minh nghiệp vụ.',
    deXuat: 'Xác nhận có phải chủ ý; nếu không, thêm bộ lọc phạm vi.',
    anhHuong: 'Không đáng kể.',
  },
  {
    id: 'L3', sev: 'low', module: 'Toàn hệ thống',
    title: 'Hard-delete chưa nhất quán trên các model danh mục',
    hienTrang: 'Material/Supplier/Warehouse/ProductVariant/Customer... đã có sẵn cột hỗ trợ xoá mềm nhưng chưa đăng ký sử dụng — xác nhận đúng như tài liệu quy ước nhóm đã tự ghi nhận.',
    vanDe: 'Đã được nghiệp vụ chấp nhận tạm thời (gap an toàn để pending), phần lớn trường hợp nguy hiểm đã được khoá ngoại RESTRICT chặn sẵn.',
    ruiRo: 'Thấp — đã có backstop RESTRICT cho các trường hợp nguy hiểm nhất.',
    deXuat: 'Không cần hành động thêm ngoài lộ trình đã ghi trong tài liệu quy ước.',
    anhHuong: 'Không đáng kể.',
  },
  {
    id: 'L4', sev: 'low', module: 'Auth/RBAC',
    title: '2 route tự-phục-vụ không gắn decorator quyền tường minh',
    hienTrang: 'GET /auth/me và đổi mật khẩu chỉ yêu cầu đăng nhập hợp lệ, có comment giải thích lý do nhưng không có decorator ngữ nghĩa riêng để phân biệt "cố ý miễn trừ" khỏi "quên gắn".',
    vanDe: 'Không phải lỗ hổng (cả 2 chỉ thao tác trên chính người gọi), chỉ là điểm phá lệ quy ước không có cờ đánh dấu rõ ràng.',
    ruiRo: 'Không đáng kể.',
    deXuat: 'Cân nhắc thêm 1 decorator ngữ nghĩa riêng để lần audit sau dễ phân biệt tự động.',
    anhHuong: 'Không đáng kể.',
  },
];

const bySev = (s: Sev) => FINDINGS.filter((f) => f.sev === s);
const findingRef = (id: string) => FINDINGS.find((f) => f.id === id)!;

const MODULE_GROUPS: { group: string; rows: [string, string][] }[] = [
  {
    group: 'Nền tảng & quản trị',
    rows: [
      ['auth', 'Đăng nhập, JWT access/refresh token, đổi mật khẩu'],
      ['users / roles', 'Quản lý tài khoản, gán Role, thuộc tính MES (mfgRole/warehouseScope)'],
      ['audit-log', 'Nhật ký create/update/delete tự động qua Prisma extension'],
      ['notifications', 'Thông báo broadcast theo audience (ALL/BOSS/kho/QLSX)'],
      ['system-config', 'Cấu hình singleton: tham số solver cắt sắt, dung sai nhận hàng'],
      ['uploads', 'Upload ảnh (Cloudinary) dùng chung nhiều module'],
    ],
  },
  {
    group: 'Danh mục gốc & sản phẩm',
    rows: [
      ['materials / material-groups', 'Vật tư (sắt, dây, đinh, sơn, phụ kiện, bao bì), nhóm vật tư hệ thống'],
      ['suppliers', 'Nhà cung cấp, giá theo vật tư'],
      ['warehouses', '6 kho vật lý + 3 kho ảo (SUPPLIER/PRODUCTION/SCRAP)'],
      ['weaving-points', 'Điểm đan gia công ngoài'],
      ['customers', 'Khách hàng nội địa & xuất khẩu'],
      ['defect-reasons', 'Danh mục lý do lỗi cho QC'],
      ['products', 'Sản phẩm, biến thể (màu), Mảnh (Piece), Chi tiết (Part — gần như chưa dùng)'],
    ],
  },
  {
    group: 'Định mức (BOM)',
    rows: [
      ['bom-revisions', 'Phiên bản định mức theo sản phẩm (DRAFT/ACTIVE/RETIRED)'],
      ['segment-specs', 'Đoạn sắt (vật tư + chiều dài cắt) dùng trong BOM Phôi'],
    ],
  },
  {
    group: 'Bán hàng & kế hoạch sản xuất',
    rows: [
      ['sales-orders', 'Đơn hàng khách, SKU dự kiến, ship, đặt cọc/thanh toán (tĩnh)'],
      ['skus', 'Pipeline duyệt định mức SKU (PlanForm): KHSX nhập → duyệt nhóm → Sếp duyệt cuối'],
    ],
  },
  {
    group: 'Lệnh sản xuất & mua hàng',
    rows: [
      ['production-invoices', 'Lệnh sản xuất (PI), duyệt từng SKU, chuyền kiểm, đóng gói'],
      ['production-orders', 'Lệnh SX tại xưởng, tự sinh 1-1 khi Sếp duyệt SKU trong PI'],
      ['cutting-proposals', 'Đề xuất cắt sắt tối ưu, gọi solver ngoài cat_sat_iea'],
      ['purchase-proposals', 'Đề xuất mua hàng, báo giá NCC, nhận hàng'],
    ],
  },
  {
    group: 'Kho vận & thực thi xưởng (MES)',
    rows: [
      ['stock', 'Sổ cái kho (StockLedger) & cache tồn (StockQuant)'],
      ['warehouse-transfers', 'Chuyển kho nội bộ 2 bước (vật tư & mảnh)'],
      ['steel-issues', 'Xuất sắt cho Phôi, báo cắt xong, kiểu cắt thực tế'],
      ['material-issues', 'Xuất vật tư tiêu hao (CO₂, dây hàn, bột sơn) cho Hàn/Sơn'],
      ['production-batches', 'Hàn/Sơn báo sản lượng theo mảnh'],
      ['qc-reviews', 'KCS duyệt Phôi/Hàn/Sơn, rework, cấp bù phế liệu'],
    ],
  },
];

const WORKFLOW: { title: string; body: string; gap?: string }[] = [
  { title: 'Sales tạo đơn hàng', body: 'Tạo SalesOrder + SalesOrderItem (SKU dự kiến, số lượng, ngày giao) — hệ thống tự sinh 1 ProductionInvoice liên kết 1-1.' },
  { title: 'KHSX xây định mức SKU (PlanForm)', body: 'Nhập định mức mảnh (Sắt/Dây/Đinh) và định mức chi tiết (Sơn/Phụ kiện/Bao bì) — 2 nhánh tiến độ độc lập, mỗi nhóm tự duyệt qua PlanFormManhReview/PlanFormDetailReview.' },
  { title: 'Sếp duyệt định mức', body: 'Khi cả 2 nhánh forward xong → WAITING_BOSS_APPROVAL → Sếp duyệt → activate BomRevision (retire bản ACTIVE cũ trong cùng transaction, đảm bảo luôn đúng 1 bản ACTIVE/sản phẩm).' },
  { title: 'Duyệt lệnh sản xuất theo từng SKU trong PI', body: 'QLSX → Sếp duyệt từng ProductionInvoiceItem. Khi Sếp duyệt: hệ thống tự động tạo ProductionOrder (ghim BomRevision + số lượng tại thời điểm đó) — không có bước "release" thủ công riêng.' },
  { title: 'Đề xuất cắt sắt tối ưu', body: 'Solver ngoài tính phương án cắt tối ưu cho 1 PO hoặc cả cụm PI gộp. Khi duyệt: trừ tồn kho sắt ngay lập tức + tự sinh đề xuất mua cho phần thiếu.' },
  { title: 'Kiểm tra vật tư trước sản xuất', body: 'Đối chiếu 3 kho (phôi-sơn-hàn / vật tư-TP / thành phẩm) — đủ cả 3 mới cho phép bấm "Bắt đầu sản xuất".' },
  { title: 'Mua hàng', body: 'Báo giá NCC → Sếp chọn & duyệt → thủ kho nhận hàng (có dung sai giao thừa, hỗ trợ nhận nhiều đợt) → ghi StockLedger.' },
  { title: 'Phôi: xuất sắt → cắt → KCS', body: 'Kho xuất sắt cho Phôi → Phôi báo cắt xong (có thể lệch kiểu cắt đề xuất) → KCS duyệt lô, tạo rework/đề xuất cấp lại nếu có phế.' },
  { title: 'Hàn / Sơn: cấp vật tư tiêu hao → báo sản lượng → KCS', body: 'Kho vật tư-TP xuất tiêu hao (CO₂, dây hàn, bột sơn) → tổ báo sản lượng theo mảnh → KCS duyệt.' },
  { title: 'Chuyển kho nội bộ phôi-sơn-hàn → vật tư-TP', body: 'Tính năng mới nhất (2026-08-17): chuyển mảnh đã qua KCS sang kho vật tư thành phẩm, theo từng PO, số liệu lấy từ sản xuất thực tế (không phải định mức).' },
  { title: 'Đan (gia công ngoài)', body: 'Xuất khung cho điểm đan ngoài (WeavingIssue) → nhận lại hàng đan xong (WeavingReceipt).' },
  {
    title: 'Chuyền kiểm → Đóng gói → Xuất hàng',
    body: 'Kiểm từng mảnh trước khi đóng gói → đóng thùng theo SKU → Sales ghi nhận đã ship (shippedQty).',
    gap: 'Khoảng trống: chưa có bước "thành phẩm nhập kho" ghi StockLedger — xem mục Nghiệp vụ còn thiếu',
  },
];

const RULES: { title: string; body: string }[] = [
  { title: '1 sản phẩm — đúng 1 BOM ACTIVE', body: 'Enforce bằng unique index có điều kiện ở DB (không chỉ ở tầng app) — retire bản cũ và activate bản mới trong cùng 1 transaction.' },
  { title: 'StockLedger — sổ cái kép bất biến', body: 'Append-only, mỗi dòng có đúng 1 trong 4 "chân hàng" (vật tư/đoạn sắt/mảnh/biến thể sản phẩm) — XOR enforce bằng CHECK constraint ở DB.' },
  { title: 'Chuyển kho nội bộ — state machine 1 chiều', body: 'PENDING → CONFIRMED|REJECTED, không quay lại. Có cơ chế giữ chỗ (reservation) chống 2 phiếu double-book cùng tồn kho.' },
  { title: 'Idempotency-Key cho mọi thao tác ghi 1 lần', body: 'Áp dụng nhất quán cho SteelIssue/WeavingIssue/MaterialIssue/ProductionBatch/WarehouseTransfer/duyệt SKU — resolve-or-return khi client gọi lại do mất mạng.' },
  { title: 'Lệnh SX tại xưởng sinh tự động, không thủ công', body: 'ProductionOrder chỉ có đúng 1 cách tạo: tự động khi Sếp duyệt 1 SKU trong PI, ghim định mức + số lượng tại đúng thời điểm đó.' },
  { title: 'RBAC 2 lớp', body: 'Role/Permission chuẩn (module+action) cộng thêm lớp thuộc tính MES (mfgRole/warehouseScope) cho guard đặc thù xưởng/kho.' },
  { title: 'Soft-delete có chọn lọc', body: 'Chỉ áp dụng cho model được đăng ký tường minh (User, Role, SalesOrder...) — nhiều model danh mục vẫn hard-delete có chủ đích tạm thời.' },
  { title: 'Audit log tự động qua Prisma extension', body: 'Mọi create/update/delete của model trong danh sách đăng ký được ghi kèm user/IP/correlationId — junction/line-item con của revision được loại trừ có chủ đích.' },
];

const DEPENDENCY_ROWS: [string, string, string][] = [
  ['sales-orders', 'production-invoices', 'Tự sinh 1 PI liên kết 1-1 khi tạo đơn hàng'],
  ['skus (PlanForm)', 'bom-revisions', 'Tạo lười 1 BomRevision DRAFT ở lần ghi định mức đầu tiên'],
  ['skus → Sếp duyệt', 'bom-revisions (ACTIVE)', 'Activate + retire bản cũ trong 1 transaction'],
  ['production-invoices → Sếp duyệt SKU', 'production-orders', 'Tự động tạo, ghim BomRevision ACTIVE + số lượng tại thời điểm đó'],
  ['production-orders', 'cutting-proposals', 'Solver tính phương án cắt theo BOM đã ghim'],
  ['cutting-proposals → duyệt', 'purchase-proposals + stock (trừ tồn)', 'Tự sinh đề xuất mua cho phần thiếu, ghi StockLedger ngay'],
  ['production-orders', 'steel-issues / weaving-issues / material-issues / production-batches', 'Mọi thực thi tại xưởng đều neo theo (ProductionOrder, mảnh)'],
  ['steel-issues / production-batches', 'qc-reviews', 'KCS duyệt qua FK XOR dùng chung 1 bảng cho cả 2 nhánh'],
  ['production-batches (QC_DONE)', 'warehouse-transfers (mảnh)', 'Mốc "sẵn sàng chuyển" tính từ SUM sản lượng đã qua KCS'],
  ['users / roles', 'toàn bộ module', 'RBAC qua Permission + lớp thuộc tính mfgRole/warehouseScope'],
  ['system-config', 'cutting-proposals, purchase-proposals', 'Tham số solver & dung sai nhận hàng dùng chung toàn hệ thống'],
  ['audit-log', 'quan sát mọi module đã đăng ký', 'Prisma extension tự ghi cho create/update/delete'],
];

const GAPS: { title: string; body: string }[] = [
  { title: 'Kế toán công nợ (phải thu & phải trả)', body: 'Không có invoice, không có lịch sử thanh toán, không có công nợ NCC. Xem C5.' },
  { title: 'Đơn giá & giá trị đơn hàng', body: 'SalesOrderItem không có đơn giá — không thể tính giá trị đơn hàng thật, doanh thu, hay biên lợi nhuận theo SKU.' },
  { title: '"Thành phẩm nhập kho" trong sổ cái', body: 'StockLedger chỉ ghi được hàng thành phẩm qua chân biến thể sản phẩm — nhưng 100% lệnh sản xuất hiện có không gắn biến thể nào. Đã điều tra, tạm dừng, 3 hướng chưa chọn. Xem M10.' },
  { title: 'Đường cấp bù bán-thành-phẩm cho Hàn/Sơn', body: 'Chỉ Phôi có cơ chế cấp lại khi phế; Hàn/Sơn chưa có quyết định nghiệp vụ. Xem H7.' },
  { title: 'Cảnh báo thời gian thực', body: 'Notification tồn tại ở BE nhưng FE không có kênh đẩy chủ động (polling/WebSocket) — không đủ cho cảnh báo khẩn cấp vận hành.' },
  { title: 'Phân trang thật', body: 'Toàn bộ danh sách FE hiện tải hết một lần, không tham số — sẽ trở thành nút thắt hiệu năng khi dữ liệu lớn dần.' },
  { title: 'Bao phủ kiểm thử end-to-end', body: 'Chỉ có đúng 1 kịch bản Playwright ("luồng vàng") — phần lớn nhánh rẽ, trường hợp từ chối/huỷ chưa có kiểm thử tự động qua UI thật.' },
  { title: 'Lịch sử giá nhà cung cấp', body: 'Chỉ có giá hiện tại, không theo dõi xu hướng biến động giá theo thời gian. Xem M8.' },
];

const PRIORITY_WAVES: { badge: string; title: string; desc: string; ids: string[] }[] = [
  {
    badge: 'Đợt 1',
    title: 'Vá ngay — lỗi toàn vẹn dữ liệu đang chạy thật, không cần quyết định nghiệp vụ mới',
    desc: 'Đây là các lỗ hổng có thể gây sai lệch tồn kho/quyền hạn ngay trong vận hành hiện tại, cách sửa đã rõ ràng.',
    ids: ['C1', 'C2', 'C3', 'C6', 'H1', 'H3', 'H4', 'H8'],
  },
  {
    badge: 'Đợt 2',
    title: 'Quyết định nghiệp vụ trước, code sau',
    desc: 'Cần chốt với ban lãnh đạo/kế toán trước khi bất kỳ dòng code nào được viết, vì lựa chọn thiết kế ảnh hưởng schema lâu dài.',
    ids: ['C4', 'C5', 'H6', 'H7', 'M10'],
  },
  {
    badge: 'Đợt 3',
    title: 'Vá High còn lại & dọn dữ liệu giả trên FE tác nghiệp',
    desc: 'Ưu tiên các trang người dùng cuối đang thao tác hàng ngày (kho, KHSX) trước các trang quản trị ít dùng.',
    ids: ['H2', 'H5', 'H9', 'H10', 'M3', 'M4', 'M5'],
  },
  {
    badge: 'Đợt 4',
    title: 'Dọn nợ kỹ thuật & hoàn thiện nền tảng',
    desc: 'An toàn để làm dần khi có thời gian rảnh giữa các đợt tính năng — không chặn vận hành hiện tại.',
    ids: ['M1', 'M2', 'M6', 'M7', 'M8', 'M9', 'M11', 'M12', 'M13', 'M14', 'M15', 'L1', 'L2', 'L3', 'L4'],
  },
];

function renderInline(text: string) {
  return text.split('`').map((part, i) =>
    i % 2 === 1 ? (
      <code className="pt-ref" key={i}>{part}</code>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

function SevPill({ sev }: { sev: Sev }) {
  const meta = SEV_META[sev];
  return <span className={`badge ${meta.badge}`}>{meta.label}</span>;
}

function Finding({ f }: { f: FindingItem }) {
  return (
    <article className={`pt-finding pt-finding-${f.sev}`} id={f.id.toLowerCase()}>
      <div className="pt-finding-head">
        <span className="pt-finding-id">{f.id}</span>
        <h4>{f.title}</h4>
        <span className="chip">{f.module}</span>
      </div>
      <div className="pt-kv"><div className="pt-k">Hiện trạng</div><div className="pt-v">{renderInline(f.hienTrang)}</div></div>
      <div className="pt-kv"><div className="pt-k">Vấn đề</div><div className="pt-v">{renderInline(f.vanDe)}</div></div>
      <div className="pt-kv"><div className="pt-k">Rủi ro</div><div className="pt-v">{renderInline(f.ruiRo)}</div></div>
      <div className="pt-kv"><div className="pt-k">Đề xuất</div><div className="pt-v">{renderInline(f.deXuat)}</div></div>
      <div className="pt-kv"><div className="pt-k">Ảnh hưởng</div><div className="pt-v">{renderInline(f.anhHuong)}</div></div>
    </article>
  );
}

const TOC = [
  ['tong-quan', 'Tổng quan hệ thống'],
  ['module', 'Module & nghiệp vụ'],
  ['workflow', 'Workflow chính'],
  ['rules', 'Business rules'],
  ['findings', 'Vấn đề phát hiện'],
  ['dependency', 'Dependency module'],
  ['gaps', 'Nghiệp vụ còn thiếu'],
  ['risk-register', 'Rủi ro ưu tiên xử lý'],
  ['priority', 'Thứ tự cải thiện'],
  ['conclusion', 'Kết luận'],
] as const;

export default function PhanTichPage() {
  const critCount = bySev('crit').length;
  const highCount = bySev('high').length;
  const medCount = bySev('med').length;
  const lowCount = bySev('low').length;
  const riskRegister = FINDINGS.filter((f) => f.sev === 'crit' || f.sev === 'high');

  return (
    <div className="pt-shell">
      <style>{`
        .pt-shell { display: grid; grid-template-columns: 260px minmax(0,1fr); max-width: 1220px; margin: 0 auto; }
        @media (max-width: 900px) { .pt-shell { grid-template-columns: 1fr; } }

        .pt-toc { position: sticky; top: 0; align-self: start; height: 100vh; overflow-y: auto;
          padding: 30px 18px 30px 22px; border-right: 1px solid var(--border); background: var(--surface); }
        @media (max-width: 900px) {
          .pt-toc { position: static; height: auto; overflow-x: auto; overflow-y: visible;
            border-right: none; border-bottom: 1px solid var(--border); padding: 12px 16px;
            display: flex; gap: 4px; white-space: nowrap; }
          .pt-toc-brand { display: none; }
          .pt-toc ol { display: flex; gap: 4px; }
        }
        .pt-toc-brand { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--blue-text);
          font-weight: 700; margin-bottom: 18px; }
        .pt-toc ol { list-style: none; margin: 0; padding: 0; counter-reset: pttoc; }
        .pt-toc li { counter-increment: pttoc; }
        .pt-toc a { display: flex; gap: 9px; align-items: baseline; padding: 6px 8px; border-radius: var(--radius);
          font-size: 13px; color: var(--text2); text-decoration: none; }
        .pt-toc a::before { content: counter(pttoc, decimal-leading-zero); font-size: 10px; color: var(--text3); }
        .pt-toc a:hover { background: var(--surface2); color: var(--text); }

        .pt-main { padding-bottom: 80px; min-width: 0; }
        .pt-masthead { padding: 44px 44px 32px; border-bottom: 1px solid var(--border); }
        @media (max-width: 640px) { .pt-masthead { padding: 30px 20px 24px; } }
        .pt-eyebrow { font-size: 11.5px; letter-spacing: .1em; text-transform: uppercase; color: var(--blue-text);
          font-weight: 700; margin-bottom: 12px; }
        .pt-title { font-size: clamp(1.7rem, 3.6vw, 2.3rem); font-weight: 800; line-height: 1.18; margin: 0 0 14px; color: var(--text); }
        .pt-lede { font-size: 15px; color: var(--text2); max-width: 62ch; line-height: 1.6; margin: 0 0 20px; }
        .pt-meta { display: flex; flex-wrap: wrap; gap: 8px 22px; font-size: 12.5px; color: var(--text3); }
        .pt-meta b { color: var(--text2); font-weight: 600; }

        .pt-section { padding: 40px 44px; border-bottom: 1px solid var(--border); }
        .pt-section:last-of-type { border-bottom: none; }
        @media (max-width: 640px) { .pt-section { padding: 30px 20px; } }
        .pt-section-head { display: flex; align-items: baseline; gap: 12px; margin-bottom: 6px; }
        .pt-section-num { font-size: 12px; color: var(--blue-text); font-weight: 700; }
        .pt-section h2 { font-size: 1.4rem; font-weight: 800; margin: 0; color: var(--text); }
        .pt-section-sub { color: var(--text3); font-size: 13.5px; max-width: 62ch; margin: 8px 0 24px; }
        .pt-section h3 { font-size: 1.05rem; font-weight: 700; margin: 26px 0 10px; color: var(--text); }
        .pt-section h3:first-child { margin-top: 0; }
        .pt-prose p { max-width: 68ch; color: var(--text2); margin: 0 0 12px; font-size: 14.5px; line-height: 1.65; }

        .pt-table-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface); }
        .pt-table { border-collapse: collapse; width: 100%; font-size: 13.5px; min-width: 560px; }
        .pt-table thead th { text-align: left; font-size: 10.5px; letter-spacing: .05em; text-transform: uppercase;
          color: var(--text3); font-weight: 700; padding: 10px 14px; border-bottom: 1px solid var(--border2);
          background: var(--surface2); white-space: nowrap; }
        .pt-table tbody td { padding: 10px 14px; border-bottom: 1px solid var(--border); color: var(--text2); vertical-align: top; }
        .pt-table tbody tr:last-child td { border-bottom: none; }
        .pt-table td.pt-mod { color: var(--text); font-weight: 600; }
        .pt-ref { font-family: Consolas, "SF Mono", monospace; font-size: .84em; background: var(--surface2);
          padding: 1px 5px; border-radius: 4px; color: var(--text2); }

        .pt-rule-grid, .pt-gap-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(270px, 1fr)); gap: 14px; }
        .pt-rule-card, .pt-gap-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 16px 18px; }
        .pt-rule-card h4, .pt-gap-card h4 { margin: 0 0 6px; font-size: 13.5px; color: var(--text); font-weight: 700; }
        .pt-rule-card p, .pt-gap-card p { margin: 0; font-size: 13px; color: var(--text2); line-height: 1.55; }

        .pt-flow { list-style: none; margin: 0; padding: 0; counter-reset: ptflow; }
        .pt-flow li { counter-increment: ptflow; position: relative; padding: 0 0 22px 40px; border-left: 2px solid var(--border); margin-left: 13px; }
        .pt-flow li:last-child { border-left-color: transparent; padding-bottom: 0; }
        .pt-flow li::before { content: counter(ptflow, decimal-leading-zero); position: absolute; left: -15px; top: -1px;
          width: 28px; height: 28px; border-radius: 50%; background: var(--surface); border: 1.5px solid var(--blue);
          color: var(--blue-text); font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
        .pt-flow-title { font-weight: 700; color: var(--text); margin-bottom: 3px; font-size: 14.5px; }
        .pt-flow-body { color: var(--text2); font-size: 13.5px; max-width: 64ch; line-height: 1.55; }
        .pt-flow-gap { display: inline-block; margin-top: 7px; font-size: 12px; background: var(--red-bg); color: var(--red);
          border: 1px solid #f0c1c1; padding: 3px 9px; border-radius: 6px; }

        .pt-sev-block { margin-bottom: 38px; }
        .pt-sev-block:last-child { margin-bottom: 0; }
        .pt-sev-block-head { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
        .pt-sev-block-head h3 { margin: 0; }
        .pt-sev-count { font-size: 12px; color: var(--text3); }

        .pt-finding { background: var(--surface); border: 1px solid var(--border); border-left: 4px solid var(--border2);
          border-radius: var(--radius-lg); padding: 18px 20px; margin-bottom: 12px; scroll-margin-top: 16px; }
        .pt-finding-crit { border-left-color: var(--red); }
        .pt-finding-high { border-left-color: var(--amber); }
        .pt-finding-med { border-left-color: var(--blue); }
        .pt-finding-low { border-left-color: var(--green); }
        .pt-finding-head { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
        .pt-finding-id { font-family: Consolas, "SF Mono", monospace; font-size: 11.5px; color: var(--text3); }
        .pt-finding h4 { font-size: 15px; font-weight: 700; margin: 0; color: var(--text); flex: 1 1 auto; min-width: 200px; }
        .pt-kv { display: flex; gap: 12px; padding: 6px 0; border-top: 1px dashed var(--border); }
        .pt-kv:first-of-type { border-top: none; padding-top: 0; }
        .pt-k { flex: 0 0 100px; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; color: var(--text3); padding-top: 2px; font-weight: 600; }
        .pt-v { flex: 1 1 auto; font-size: 13.5px; color: var(--text2); line-height: 1.55; }
        @media (max-width: 620px) { .pt-kv { flex-direction: column; gap: 2px; } .pt-k { flex: none; } }

        .pt-wave { display: flex; gap: 16px; margin-bottom: 20px; align-items: flex-start; }
        .pt-wave:last-child { margin-bottom: 0; }
        .pt-wave-badge { flex: 0 0 auto; font-size: 11.5px; font-weight: 700; color: var(--blue-text);
          background: var(--blue-bg); border-radius: 7px; padding: 6px 11px; white-space: nowrap; }
        .pt-wave-body h4 { margin: 0 0 5px; font-size: 14.5px; color: var(--text); }
        .pt-wave-body p { margin: 0 0 8px; font-size: 13.5px; color: var(--text2); }
        .pt-wave-tags { display: flex; flex-wrap: wrap; gap: 5px; }
        .pt-wave-tags a { text-decoration: none; }

        .pt-verdict { background: var(--blue-bg); border: 1px solid var(--blue); border-radius: var(--radius-lg); padding: 22px 24px; margin: 18px 0 24px; }
        .pt-verdict h3 { margin: 0 0 8px !important; color: var(--blue-text); }
        .pt-verdict p { color: var(--text); max-width: none; font-size: 14px; margin: 0 0 10px; }
        .pt-verdict p:last-child { margin-bottom: 0; }

        .pt-checklist { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
        .pt-checklist li { display: flex; gap: 9px; font-size: 13.5px; color: var(--text2); align-items: baseline; }
        .pt-checklist li::before { content: "—"; color: var(--text3); flex: 0 0 auto; }

        .pt-footer { padding: 26px 44px 50px; font-size: 11.5px; color: var(--text3); font-family: Consolas, "SF Mono", monospace; }
        @media (max-width: 640px) { .pt-footer { padding: 20px 20px 40px; } }
      `}</style>

      <nav className="pt-toc" aria-label="Mục lục">
        <div className="pt-toc-brand">DNA-ERP · Kiểm toán</div>
        <ol>
          {TOC.map(([href, label]) => (
            <li key={href}><a href={`#${href}`}>{label}</a></li>
          ))}
        </ol>
      </nav>

      <main className="pt-main">
        <header className="pt-masthead">
          <div className="pt-eyebrow">Senior ERP Business Analyst Review</div>
          <h1 className="pt-title">Kiểm toán nghiệp vụ hệ thống DNA-ERP</h1>
          <p className="pt-lede">
            Đánh giá toàn diện module, workflow, business rules và rủi ro nghiệp vụ của DNA-ERP — hệ thống quản trị
            sản xuất khung sắt &amp; hàng dệt đan xuất khẩu — dựa trên việc đọc trực tiếp source code backend
            (NestJS + Prisma/PostgreSQL) và frontend (Next.js), đối chiếu tài liệu nội bộ nhóm.
          </p>
          <div className="pt-meta">
            <span><b>Phạm vi:</b> 31 module BE · toàn bộ FE</span>
            <span><b>Ngày đọc code:</b> 2026-08-17</span>
            <span><b>Phát hiện:</b> {FINDINGS.length} vấn đề ({critCount} Critical · {highCount} High · {medCount} Medium · {lowCount} Low)</span>
          </div>
        </header>

        <section className="pt-section" id="tong-quan">
          <div className="pt-section-head"><span className="pt-section-num">01</span><h2>Tổng quan hệ thống</h2></div>
          <div className="pt-prose">
            <p>
              DNA-ERP là hệ thống quản trị sản xuất cho một xưởng khung sắt kết hợp hàng dệt đan xuất khẩu — sản phẩm
              đi qua chuỗi công đoạn Phôi (cắt sắt) → Hàn → Sơn → Đan → Chuyền kiểm → Đóng gói, song song với nhánh
              Bán hàng → Duyệt định mức (BOM) → Duyệt lệnh sản xuất → Mua vật tư. Backend viết bằng NestJS 11 +
              Prisma trên PostgreSQL, khoá chính dùng UUID cho domain Auth/Core và BigInt tự tăng cho mọi domain
              nghiệp vụ từ Phase 2 trở đi (quyết định kiến trúc có chủ đích, không phải thiếu nhất quán). Frontend là
              Next.js (App Router).
            </p>
            <p>
              Trục xương sống của toàn hệ thống là một sổ cái kho bút toán kép, bất biến (StockLedger, append-only)
              — mọi thay đổi tồn kho, dù là mua hàng, cắt sắt, chuyển kho hay điều chỉnh tay, đều phải đi qua đúng
              một điểm ghi sổ. StockQuant chỉ là cache số dư, materialize qua trigger DB, không bao giờ được ghi
              trực tiếp. Phân quyền có 2 lớp chồng nhau: RBAC chuẩn (Role/Permission theo module+action) và một lớp
              thuộc tính nghiệp vụ riêng trên User (mfgRole, warehouseScope, isPurchaser...) dùng cho các guard đặc
              thù MES.
            </p>
            <p>
              Theo đúng quy ước nội bộ nhóm, dự án đang ở giai đoạn <b>&quot;sân chơi nội bộ&quot;</b> — MVP cho
              người dùng thật thử trước khi hoàn thiện toàn bộ. Tính đến 2026-08-14, đội ngũ tự báo cáo đã hoàn
              thành toàn bộ 7 domain thực thi tại xưởng (backend thật + FE đã nối), và tiếp tục phát triển thêm tính
              năng chuyển kho nội bộ cho mảnh tới 2026-08-17 (thời điểm audit này thực hiện). Đáng chú ý: tài liệu
              nội bộ của nhóm (schema comment, changelog, review doc) có chất lượng tự phê bình cao — nhiều vấn đề
              trong báo cáo này đã được chính đội ngũ ghi nhận một phần, nhưng vẫn còn nhiều lỗ hổng mới chưa được
              phát hiện, đặc biệt ở các đường ít được test qua UI thật.
            </p>
          </div>
        </section>

        <section className="pt-section" id="module">
          <div className="pt-section-head"><span className="pt-section-num">02</span><h2>Danh sách module &amp; nghiệp vụ</h2></div>
          <p className="pt-section-sub">31 module backend, nhóm theo 6 khối nghiệp vụ.</p>
          {MODULE_GROUPS.map((g) => (
            <div key={g.group}>
              <h3>{g.group}</h3>
              <div className="pt-table-wrap">
                <table className="pt-table">
                  <thead><tr><th>Module</th><th>Nghiệp vụ</th></tr></thead>
                  <tbody>
                    {g.rows.map(([name, desc]) => (
                      <tr key={name}><td className="pt-mod">{name}</td><td>{desc}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </section>

        <section className="pt-section" id="workflow">
          <div className="pt-section-head"><span className="pt-section-num">03</span><h2>Workflow chính — hành trình 1 đơn hàng</h2></div>
          <p className="pt-section-sub">Chuỗi sự kiện thực tế từ lúc nhận đơn tới khi đóng gói, theo đúng thứ tự phụ thuộc dữ liệu trong code.</p>
          <ol className="pt-flow">
            {WORKFLOW.map((w) => (
              <li key={w.title}>
                <div className="pt-flow-title">{w.title}</div>
                <div className="pt-flow-body">
                  {renderInline(w.body)}
                  {w.gap && <><br /><span className="pt-flow-gap">⚠ {w.gap}</span></>}
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="pt-section" id="rules">
          <div className="pt-section-head"><span className="pt-section-num">04</span><h2>Business rules hiện tại</h2></div>
          <p className="pt-section-sub">Các bất biến (invariant) nền tảng mà phần lớn logic nghiệp vụ dựa vào.</p>
          <div className="pt-rule-grid">
            {RULES.map((r) => (
              <div className="pt-rule-card" key={r.title}>
                <h4>{r.title}</h4>
                <p>{renderInline(r.body)}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="pt-section" id="findings">
          <div className="pt-section-head"><span className="pt-section-num">05</span><h2>Các vấn đề nghiệp vụ phát hiện được</h2></div>
          <p className="pt-section-sub">
            {FINDINGS.length} phát hiện, mỗi mục dẫn bằng chứng cụ thể từ code (đường dẫn file + dòng). Xếp theo
            mức độ nghiêm trọng Critical → High → Medium → Low.
          </p>

          {(['crit', 'high', 'med', 'low'] as Sev[]).map((sev) => (
            <div className="pt-sev-block" key={sev}>
              <div className="pt-sev-block-head">
                <SevPill sev={sev} />
                <h3>{bySev(sev).length} phát hiện</h3>
              </div>
              {bySev(sev).map((f) => <Finding f={f} key={f.id} />)}
            </div>
          ))}
        </section>

        <section className="pt-section" id="dependency">
          <div className="pt-section-head"><span className="pt-section-num">06</span><h2>Dependency giữa các module</h2></div>
          <p className="pt-section-sub">Chuỗi phụ thuộc dữ liệu chính — module bên trái ghim/kích hoạt module bên phải, không thể đảo ngược thứ tự.</p>
          <div className="pt-table-wrap">
            <table className="pt-table">
              <thead><tr><th>Module nguồn</th><th>Kích hoạt / ghim vào</th><th>Cơ chế</th></tr></thead>
              <tbody>
                {DEPENDENCY_ROWS.map(([src, dst, mech]) => (
                  <tr key={src + dst}><td className="pt-mod">{src}</td><td>{dst}</td><td>{mech}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="pt-section" id="gaps">
          <div className="pt-section-head"><span className="pt-section-num">07</span><h2>Các nghiệp vụ còn thiếu</h2></div>
          <p className="pt-section-sub">Không phải lỗi — là chức năng chưa tồn tại, cần quyết định nghiệp vụ trước khi xây.</p>
          <div className="pt-gap-grid">
            {GAPS.map((g) => (
              <div className="pt-gap-card" key={g.title}>
                <h4>{g.title}</h4>
                <p>{g.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="pt-section" id="risk-register">
          <div className="pt-section-head"><span className="pt-section-num">08</span><h2>Rủi ro Critical/High cần xử lý trước</h2></div>
          <p className="pt-section-sub">{riskRegister.length} phát hiện có bằng chứng code cụ thể, ảnh hưởng trực tiếp tới toàn vẹn dữ liệu kho/tài chính hoặc bảo mật RBAC.</p>
          <div className="pt-table-wrap">
            <table className="pt-table">
              <thead><tr><th>Mã</th><th>Mức độ</th><th>Tiêu đề</th><th>Module</th></tr></thead>
              <tbody>
                {riskRegister.map((f) => (
                  <tr key={f.id}>
                    <td><a href={`#${f.id.toLowerCase()}`}>{f.id}</a></td>
                    <td><SevPill sev={f.sev} /></td>
                    <td>{f.title}</td>
                    <td>{f.module}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="pt-section" id="priority">
          <div className="pt-section-head"><span className="pt-section-num">09</span><h2>Đề xuất thứ tự ưu tiên cải thiện</h2></div>
          <p className="pt-section-sub">4 đợt, xếp theo nguyên tắc: vá lỗi toàn vẹn dữ liệu đang âm thầm chạy thật trước, việc cần quyết định nghiệp vụ mới xếp sau, dọn nợ kỹ thuật để cuối.</p>
          {PRIORITY_WAVES.map((w) => (
            <div className="pt-wave" key={w.badge}>
              <div className="pt-wave-badge">{w.badge}</div>
              <div className="pt-wave-body">
                <h4>{w.title}</h4>
                <p>{w.desc}</p>
                <div className="pt-wave-tags">
                  {w.ids.map((id) => (
                    <a href={`#${id.toLowerCase()}`} key={id}>
                      <SevPill sev={findingRef(id).sev} />
                    </a>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </section>

        <section className="pt-section" id="conclusion">
          <div className="pt-section-head"><span className="pt-section-num">10</span><h2>Kết luận</h2></div>
          <div className="pt-prose">
            <p>
              <b>Hệ thống hiện tại chưa đủ điều kiện đưa vào production theo nghĩa ERP đầy đủ</b> (xử lý dữ liệu tài
              chính/khách hàng thật, chịu trách nhiệm pháp lý về sổ sách) — nhưng phù hợp để tiếp tục vận hành như
              đúng định hướng nội bộ nhóm đã tuyên bố: <b>&quot;sân chơi nội bộ có kiểm soát&quot;</b>, cho người
              dùng thật thử nghiệm song song với việc thu hẹp dần khoảng trống.
            </p>
          </div>

          <div className="pt-verdict">
            <h3>Vì sao</h3>
            <p>
              Kiến trúc nền — sổ cái kho bút toán kép bất biến, state machine rõ ràng cho từng vòng đời (BOM, PI,
              chuyển kho, đề xuất mua), idempotency-key nhất quán, RBAC 2 lớp — được thiết kế đúng bài bản và đội
              ngũ đã nhiều lần tự phát hiện, tự vá các lớp lỗi tương tự (dung sai nhận hàng, race condition ship
              hàng, reservation chống double-book). Đây là nền tảng kỹ thuật vững để tiếp tục xây.
            </p>
            <p>
              Nhưng audit này phát hiện <b>{critCount} lỗ hổng Critical</b> — phần lớn liên quan trực tiếp tới toàn
              vẹn dữ liệu kho (trừ tồn 2 lần, mất dấu vết sổ cái, không ghi sổ khi xác nhận chuyển kho) và hoàn toàn
              thiếu vắng module công nợ. Với một ERP sản xuất xuất khẩu, đây là 2 lớp rủi ro không thể chấp nhận cho
              môi trường production thật: sai lệch tồn kho vật lý so với hệ thống, và không kiểm soát được dòng
              tiền với khách hàng/nhà cung cấp.
            </p>
          </div>

          <h3>Điều kiện tối thiểu trước khi coi là &quot;sẵn sàng production&quot;</h3>
          <ul className="pt-checklist">
            <li>Đóng toàn bộ {critCount} phát hiện Critical (mục 08), đặc biệt xác minh dứt điểm nghi vấn C6 bằng integration test thật.</li>
            <li>Có quyết định nghiệp vụ rõ ràng và triển khai tối thiểu 1 module công nợ (dù đơn giản), trước khi cho phép nhập liệu tài chính thật.</li>
            <li>Dọn sạch dữ liệu giả trên các trang tác nghiệp FE đang phục vụ người dùng cuối hàng ngày (H10).</li>
            <li>Mở rộng bao phủ kiểm thử end-to-end ra ngoài đúng 1 luồng vàng hiện có.</li>
          </ul>
        </section>

        <footer className="pt-footer">
          Nguồn: đọc trực tiếp D:\DNA-ERP-BE\src (31 module) và d:\DNA-ERP\src, đối chiếu prisma/schema.prisma,
          migrations, và tài liệu nội bộ nhóm (CONTRIBUTING.md, changelog, review doc) tính đến 2026-08-17. Không
          tự suy đoán nghiệp vụ ngoài bằng chứng code — các điểm chưa xác minh được đã ghi rõ trong từng mục.
        </footer>
      </main>
    </div>
  );
}
