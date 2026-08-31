/**
 * Facade API. Mặc định trỏ mock; các module đã cắt sang BE thật được export ở đây.
 * Giữ nguyên import path `services/api` cho mọi page hiện có.
 *
 * ĐÃ NỐI BE THẬT (phase 2 — danh mục hệ thống):
 *  - auth (loginUser/getProfile/logoutUser — auth-api.ts)
 *  - users (getUsers/createUser/updateUser/deleteUser/... — users-api.ts)
 *  - materials + material-suppliers (materials-api.ts)
 *  - material-groups (material-groups-api.ts)
 *  - suppliers (suppliers-api.ts)
 *  - customers — dùng chung cho CẢ "Khách hàng bán hàng" (SalesCustomersPage) LẪN "Khách hàng
 *    xuất khẩu" (ExportCustomersPage): BE hợp nhất 2 khái niệm này vào 1 bảng `customers` duy
 *    nhất (không có field phân biệt loại) nên export cùng 1 cặp hàm dưới cả 2 tên cũ để không
 *    phải sửa 2 page — xem customers-api.ts. Hệ quả: 1 khách hàng tạo ở page nào cũng hiện ở
 *    page còn lại (đúng theo thiết kế BE, không phải bug).
 *  - defect-reasons (defect-reasons-api.ts)
 *  - weaving-points — CHỈ phần CRUD danh mục cơ bản (weaving-points-api.ts); nghiệp vụ phân bổ/
 *    nhận đan/chuyển kiểm vẫn ở mock (mfg.service.ts) vì BE chưa có API tương ứng.
 *  - system-config (system-config-api.ts)
 *  - products (products-api.ts) — an toàn để nối vì sales-orders/skus bên dưới đã dùng
 *    products thật; không còn "2 nguồn sự thật" như lúc chỉ có Sku mock.
 *  - sales-orders (sales-orders-api.ts) — hợp nhất "salesPOs" (Sales) + "exportOrders" (Mfg)
 *    của mock thành 1 bảng thật duy nhất; `getExportOrders`/`createExportOrder` không còn cần
 *    (BE tự resolve PI khi tạo Sku/duyệt PI item, xem sku-api.ts) nên đã bỏ hẳn.
 *  - skus (sku-api.ts) — toàn bộ state machine duyệt định mức SKU. Field JSON tự
 *    do (manhData/quotaManagement.materialType) round-trip nguyên vẹn qua BE (lưu opaque),
 *    Spec pages (SpecSteelPage...) không cần sửa. `stages`/execution Phôi-Hàn-Sơn-KCS vẫn mock.
 *  - production-invoices (production-invoices-api.ts) — state machine duyệt sản xuất theo
 *    item. Lưu ý: itemId nay là id thật (không phải index như mock) — mọi call site đã cập
 *    nhật để truyền `item.id`.
 *  - warehouses (warehouses-api.ts) — getWarehouses()/createWarehouse()/deleteWarehouse(). Dùng
 *    để resolve code->id thật cho warehouse-transfers bên dưới, và bởi MfgWarehousesPage.tsx
 *    (Tổng hợp kho - nối BE thật, không còn local mock).
 *  - warehouse-transfers (warehouse-transfers-api.ts) — tạo/xác nhận/từ chối phiếu chuyển kho nội
 *    bộ (Phase 3 - Ledger Core). GET list không kèm items như mock cũ, adapter tự fetch chi tiết
 *    từng phiếu để giữ nguyên hợp đồng cũ cho page — xem comment đầu file đó. Không còn `piCode`
 *    (BE không có field này, chỉ có `note` tự do hoặc `planFormId` thật).
 *  - stock (stock-api.ts) — getStockQuants()/getStockLedger() chỉ đọc (GET /stock-quant,
 *    GET /stock-ledger). adjustStock() là ngoại lệ ghi trực tiếp (POST /stock-ledger/adjust) -
 *    dùng cho "Sửa nhanh tồn kho" ở MfgWarehousesPage.tsx và MaterialsPage.tsx (Admin > Vật tư).
 *    Ghi bút toán kho khác vẫn đi qua warehouse-transfers hoặc các flow nghiệp vụ khác.
 *  - notifications (notifications-api.ts) — CHỈ list/create (BE không có update/delete);
 *    NotificationsPage bỏ hẳn nút sửa/xóa thay vì gọi vào endpoint không tồn tại. GET list lọc
 *    theo audience của người gọi (không phải "xem tất cả"). KHÔNG áp dụng cho AuditLogPage - đó
 *    là 1 khái niệm khác hẳn (nhật ký hoạt động ngữ nghĩa tự viết tay qua AuditLogContext, so với
 *    audit_logs của BE là diff tự động theo field trên model) nên vẫn giữ mock, xem AuditLogContext.tsx.
 *  - transfer-check (transfer-check-api.ts) — mốc TRANSFER_CHECK của production-invoices
 *    (KhoChuyenKiemPage), key theo productionInvoiceItemId, resolve qua production-invoice-item.ts.
 *  - packaging (packaging-api.ts) — mốc đóng gói cuối cùng của production-invoices
 *    (KhoDongGoiPage), model PackagingRecord (append-only, SUM-on-read), cùng cách resolve itemId
 *    với transfer-check ở trên.
 *  - weaving-issues (weaving-issues-api.ts) — Phân bổ/nhận hàng đan (KhoXuatDanPage/
 *    KhoNhapDanPage), thay manh.service.ts. Key theo productionOrderId (khác productionInvoiceItemId
 *    ở trên) - resolve qua resolveProductionOrderId() (production-invoice-item.ts). Cùng file:
 *    getWeavingByPoint() — "Quản lý điểm đan" (QuanLyDiemDanPage), flat GET /weaving-issues/by-point
 *    gộp qua mọi PO, thay WeavingService.getByPoint() mock — thêm 2026-08-19.
 *  - material-issues (material-issues-api.ts) — Xuất vật tư tiêu hao Hàn/Sơn
 *    (XuatVatTuTieuHaoPage/PhanPhoiNoiBoPage) + Xác nhận nhận (XacNhanVatTuPage), thay
 *    vat-tu-noi-bo.service.ts. Khác weaving-issues/steel-issues: BE CÓ ghi StockLedger
 *    MATERIAL_ISSUE ngay lúc xuất. 2 phía dùng 2 cách khác nhau (permission khác nhau, rà lại lúc
 *    nối FE): kho key theo productionOrderId (cùng cách resolve với weaving-issues), tổ Hàn/Sơn
 *    KHÔNG có SKU:VIEW/PRODUCTION_ORDER:VIEW nên dùng getMaterialIssuesByStage() (flat, GET
 *    /material-issues?stage=X, không cần resolve PO) — xem comment đầu material-issues-api.ts.
 *  - packaging-issues (packaging-issues-api.ts) — Xuất vật tư đóng gói (WarehouseXuatPage scope
 *    'vat-tu-tp'), thay MOCK. Khác material-issues: KHÔNG có bước "tổ xác nhận nhận" (cả kho
 *    nguồn vat-tu-tp lẫn đích thanh-pham đều là thủ kho) — ghi StockLedger ngay lúc xuất. Định mức
 *    nguồn BomAccessoryItem (kind=PACKAGING), không phải ConsumableBom. Thêm 2026-08-19.
 *
 * Mock tương ứng của các module trên đã bị xoá hẳn (không còn export trùng tên để "ghi đè").
 * Thực thi Phôi/Hàn/Sơn/KCS thật (xuất/nhận sắt, KCS, báo sản lượng) đã cutover hết sang
 * steel-issues-api.ts + production-batches-api.ts (XuatSatPage/LenhSanXuatPhoi/KcsPhoiPage/
 * XacNhanSanLuongPage/KcsStagePage/sanxuat core.tsx) - dọn ngày 2026-08-14, xoá luôn
 * phoi-lenh-sx.service.ts (không còn ai đọc `phoiRows`). phoi-sat.service.ts/san-luong.service.ts
 * chỉ còn giữ vài hàm ĐỌC dùng cho các màn tổng hợp tồn kho (getDotXuatSat, getDoanTonKho,
 * getSanLuongByStage — dùng bởi sanxuat/core.tsx và KhoPhoiPage.tsx). mfg.service.ts vốn chỉ còn
 * giữ vài hàm còn dùng thật (getMfgWarehouses/Items cho VatTuDashboardPage, uploadContractFile);
 * phần machinery PI-stages/packaging/weaving-allocation/
 * spec-entry-proposal cũ trong đó là code chết (không trang nào gọi) đã dọn ngày 2026-08-07.
 * "Mục đích xuất" (export-purposes) đã xoá hẳn khỏi Admin ngày 2026-08-19 — không có form/trang
 * nào khác đọc danh mục này (rà toàn repo xác nhận), không đáng xây BE cho danh mục chết.
 * Phân bổ đan, đề xuất mua hàng, notifications CRUD, audit log, system stats, stock-ledger/
 * stock-quant (Phase 3 xây rồi nhưng chưa có trang FE nào đọc)... vẫn chạy mock hoặc chưa có
 * adapter cho tới khi cần.
 */
export * from '../lib/mock/services';
export { getUsers, createUser, updateUser, deleteUser, resetUserPassword, setUserActive } from './users-api';
export { loginUser, getProfile, logoutUser } from './auth-api';
export { getMaterials, createMaterial, updateMaterial, deleteMaterial, getMaterialSuppliers, createMaterialSupplier, updateMaterialSupplier, deleteMaterialSupplier } from './materials-api';
export { getMaterialGroups, createMaterialGroup, updateMaterialGroup, deleteMaterialGroup } from './material-groups-api';
export { getSuppliers, createSupplier, updateSupplier, deleteSupplier } from './suppliers-api';
export {
  getCustomers as getSalesCustomers, createCustomer as createSalesCustomer, updateCustomer as updateSalesCustomer, deleteCustomer as deleteSalesCustomer,
  getCustomers as getMfgExportCustomers, createCustomer as createMfgExportCustomer, updateCustomer as updateMfgExportCustomer, deleteCustomer as deleteMfgExportCustomer,
} from './customers-api';
export { getDefectReasons, createDefectReason, updateDefectReason, deleteDefectReason } from './defect-reasons-api';
export { getWeavingPoints, createWeavingPoint, updateWeavingPoint, deleteWeavingPoint } from './weaving-points-api';
export { getSystemConfig, updateSystemConfig } from './system-config-api';
export { getMfgProducts, createMfgProduct } from './products-api';
export { getSalesOrders, createSalesOrder, updateSalesOrder, shipSalesOrderItem } from './sales-orders-api';
export {
  getSkus, getSku, getSkuOptions, createSku, deleteSkus,
  updateSkuManhQuota, updateSkuDetailQuota, reviewSkuManhQuota, reviewSkuDetailQuota,
  approvePartsSku, approveDetailSku, rejectSkuByBoss, approveFullSku,
} from './sku-api';
export {
  getProductionInvoices, getProductionInvoice, updateProductionInvoice, updateProductionInvoiceItem,
  sendItemToQlsx, sendItemToBoss, sendPiToQlsx, sendPiToBoss,
  approveItemByBoss, rejectProdItem, rejectProdItemByQlsx, rejectPiByQlsx,
  approveBatchByBoss, rejectBatchByBoss,
} from './production-invoices-api';
export { getWarehouses, createWarehouse, deleteWarehouse } from './warehouses-api';
export {
  getWarehouseTransfers, getWarehouseTransfer, createWarehouseTransfer,
  confirmWarehouseTransfer, rejectWarehouseTransfer,
  getPieceTransferPlan, createPieceWarehouseTransfer,
} from './warehouse-transfers-api';
export { getStockQuants, getStockLedger, adjustStock } from './stock-api';
export { uploadImage, uploadDocument } from './uploads-api';
export { getNotifications, createNotification, markNotificationRead } from './notifications-api';
export { getTransferCheckPieces, getTransferCheckPiecesBatch, recordTransferCheck } from './transfer-check-api';
export { getPackaging, getPackagingBatch, recordPackaging } from './packaging-api';
export { getWeavingIssuePlan, getWeavingIssuePlanBatch, issueWeaving, receiveWeaving, getWeavingByPoint } from './weaving-issues-api';
export { getMaterialIssuePlan, getMaterialIssuesByStage, issueMaterial, receiveMaterialIssue } from './material-issues-api';
export { getPackagingIssuePlan, issuePackaging } from './packaging-issues-api';
export {
  getProductionBatchesByStage, reviewProductionBatch,
  listProductionOrdersForStage, getProductionBatchPlan, getProductionBatchPlanBatch, reportProductionBatch,
  startProductionOrderFloor, finishProductionOrderFloor,
} from './production-batches-api';
export {
  getSteelIssuePlan, getSteelIssuesForInvoice, getSteelIssuesForInvoiceBatch, issueSteel,
  getSteelIssuesByStatus, getSteelIssue, getCutBundles, receiveSteelIssue,
  recordCutBatch, finishCutting, completeStep, getPhoiProgress, getStepProgress, recordStepBatch, getPiOrderSummary,
  reviewSteelIssueQc, reportSegmentDone, recheckQc, getQcReviewsForSteelIssues,
  getReplenishRequests, fulfillReplenishRequest, rejectReplenishRequest,
} from './steel-issues-api';
