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
 *
 * Mock tương ứng của các module trên đã bị xoá hẳn (không còn export trùng tên để "ghi đè").
 * Các phần thực thi Phôi/Hàn/Sơn/KCS (getStagesByPI, getKcsPendingCounts, getPhoiExecutions,
 * getPILaborCost, getPlanningPIs, checkPIMaterials...), phân bổ đan, đề xuất mua hàng, chuyển
 * kho, đóng gói, notifications CRUD, audit log, system stats... vẫn chạy mock cho tới khi BE
 * có API tương ứng — xem báo cáo bàn giao để biết danh sách đầy đủ.
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
export { getSalesPOs, createSalesPO, updateSalesPO } from './sales-orders-api';
export {
  getSkus, getSku, getSkuOptions, createSku, deleteSkus,
  updateSkuManhQuota, updateSkuDetailQuota, reviewSkuManhQuota, reviewSkuDetailQuota,
  approvePartsSku, approveDetailSku, reviewQlsxSku, requestBossApprovalSku,
  rejectSkuByQlsx, rejectSkuByBoss, approveFullSku,
} from './sku-api';
export {
  getProductionInvoices, getProductionInvoice, updateProductionInvoice,
  sendItemToQlsx, sendItemToBoss, approveItemByBoss, rejectProdItem,
} from './production-invoices-api';
