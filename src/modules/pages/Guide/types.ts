// Kiểu dữ liệu cho nội dung trang Hướng dẫn sử dụng.
// Toàn bộ nội dung là dữ liệu tĩnh (không gọi API), viết dựa trên hành vi thật của
// phần mềm — xem các file trong ./content để biết nguồn tham chiếu (đường dẫn file:line).

/** Actor/role thực tế trong hệ thống — khớp với gate quyền trong code (AuthContext, resolveDefaultModule). */
export type GuideRole =
  | 'sales'        // isSale — Kinh doanh
  | 'khsx'         // isProductPlanner — Kế hoạch sản xuất
  | 'purchasing'   // isPurchaser — Mua hàng
  | 'warehouse'    // WAREHOUSE_STAFF không mfgRole/isPurchaser/isProductPlanner/isSale — Thủ kho
  | 'qlsx'         // mfgRole = PRODUCTION_MANAGER — Quản lý sản xuất
  | 'phoi'         // mfgRole = PHOI — Tổ Phôi
  | 'han'          // mfgRole = HAN — Tổ Hàn
  | 'son'          // mfgRole = SON — Tổ Sơn
  | 'kcs'          // mfgRole = KCS
  | 'spec_steel'   // mfgRole = SPEC_STEEL — Chuyên viên định mức mảnh
  | 'spec_detail'  // mfgRole = SPEC_ACCESSORY / SPEC_PACKAGING — Chuyên viên định mức chi tiết
  | 'boss'         // role = BOSS, không mfgRole — Giám đốc
  | 'admin';       // role = ADMIN — Quản trị hệ thống

export interface GuideRoleInfo {
  id: GuideRole;
  label: string;
  short: string;
  color: string;
  bg: string;
}

export interface GuideErrorCase {
  /** Thông báo lỗi / triệu chứng người dùng thấy được */
  issue: string;
  /** Vì sao xảy ra */
  cause: string;
  /** Cách xử lý */
  fix: string;
}

export interface GuideStatus {
  name: string;
  meaning: string;
}

export interface GuideStep {
  text: string;
  /** Đánh dấu bước quan trọng / rủi ro cao / không thể hoàn tác */
  critical?: boolean;
}

/** Mockup sơ đồ màn hình (không phải ảnh chụp thật) — dựng lại đúng tên cột/nút/nhãn trường
 * đã xác nhận qua code, giúp người đọc hình dung bố cục trước khi mở đúng màn hình đó. Số
 * liệu trong `rows` chỉ là ví dụ minh hoạ, không phải dữ liệu thật. */
export interface GuideMock {
  title: string;
  /** Tên cột bảng (nếu màn hình đó có bảng) */
  columns?: string[];
  /** Vài dòng ví dụ minh hoạ, khớp thứ tự với `columns` */
  rows?: string[][];
  /** Tên trường nhập liệu (nếu màn hình đó là form) */
  formFields?: string[];
  /** Nhãn các nút chính trên màn hình, nút quan trọng nhất để cuối cùng */
  buttons?: string[];
}

export interface GuideArticle {
  id: string;
  title: string;
  /** Vai trò thực hiện chính */
  roles: GuideRole[];
  purpose: string;
  preconditions?: string[];
  /** Sơ đồ minh hoạ bố cục màn hình chính của bài — hiện ngay dưới phần Mục đích. Dùng khi
   * chưa có ảnh chụp thật (screenshot) cho bài này. */
  mock?: GuideMock;
  /** Đường dẫn ảnh chụp MÀN HÌNH THẬT của hệ thống (trong /public/guide-screens/), ưu tiên
   * hiển thị thay cho `mock` khi có. Dữ liệu trong ảnh là dữ liệu demo minh hoạ, không phải
   * dữ liệu thật của khách hàng. */
  screenshot?: string;
  steps: (string | GuideStep)[];
  result: string;
  warnings?: string[];
  commonErrors?: GuideErrorCase[];
  statuses?: GuideStatus[];
  /** Từ khoá phụ để tìm kiếm (đồng nghĩa nghiệp vụ, tên nút cũ, viết tắt...) */
  tags?: string[];
  /** Nguồn tham chiếu trong code — CHỈ dành cho người bảo trì tài liệu, KHÔNG hiển thị cho người đọc */
  sourceRefs?: string[];
}

export interface GuideArticle {
  id: string;
  title: string;
  /** Vai trò thực hiện chính */
  roles: GuideRole[];
  purpose: string;
  preconditions?: string[];
  steps: (string | GuideStep)[];
  result: string;
  warnings?: string[];
  commonErrors?: GuideErrorCase[];
  statuses?: GuideStatus[];
  /** Từ khoá phụ để tìm kiếm (đồng nghĩa nghiệp vụ, tên nút cũ, viết tắt...) */
  tags?: string[];
  /** Nguồn tham chiếu trong code — CHỈ dành cho người bảo trì tài liệu, KHÔNG hiển thị cho người đọc */
  sourceRefs?: string[];
}

export interface GuideGroup {
  id: string;
  title: string;
  /** Tên icon trong lucide-react */
  icon: string;
  color: string;
  bg: string;
  roles: GuideRole[];
  description: string;
  articles: GuideArticle[];
}

export const GUIDE_ROLES: GuideRoleInfo[] = [
  { id: 'sales',       label: 'Kinh doanh (Sales)',                 short: 'Sales',    color: '#2E7D32', bg: '#E8F5E9' },
  { id: 'khsx',        label: 'Kế hoạch sản xuất (KHSX)',           short: 'KHSX',     color: '#2E7D32', bg: '#E8F5E9' },
  { id: 'purchasing',  label: 'Mua hàng',                           short: 'Mua hàng', color: '#4527A0', bg: '#EDE7F6' },
  { id: 'warehouse',   label: 'Thủ kho',                            short: 'Thủ kho',  color: '#4527A0', bg: '#EDE7F6' },
  { id: 'qlsx',        label: 'Quản lý sản xuất (QLSX)',            short: 'QLSX',     color: '#E65100', bg: '#FFF3E0' },
  { id: 'phoi',        label: 'Tổ Phôi (cắt sắt)',                  short: 'Phôi',     color: '#E65100', bg: '#FFF3E0' },
  { id: 'han',         label: 'Tổ Hàn',                             short: 'Hàn',      color: '#E65100', bg: '#FFF3E0' },
  { id: 'son',         label: 'Tổ Sơn',                             short: 'Sơn',      color: '#E65100', bg: '#FFF3E0' },
  { id: 'kcs',         label: 'KCS (Kiểm tra chất lượng)',          short: 'KCS',      color: '#E65100', bg: '#FFF3E0' },
  { id: 'spec_steel',  label: 'Chuyên viên định mức mảnh',          short: 'CV mảnh',  color: '#E65100', bg: '#FFF3E0' },
  { id: 'spec_detail', label: 'Chuyên viên định mức chi tiết',      short: 'CV CT',    color: '#E65100', bg: '#FFF3E0' },
  { id: 'boss',        label: 'Giám đốc (Sếp)',                     short: 'Sếp',      color: '#1565C0', bg: '#E3F2FD' },
  { id: 'admin',       label: 'Quản trị hệ thống (Admin)',          short: 'Admin',    color: '#283593', bg: '#E8EAF6' },
];

export function roleInfo(id: GuideRole): GuideRoleInfo {
  return GUIDE_ROLES.find(r => r.id === id) ?? { id, label: id, short: id, color: '#5a5a56', bg: '#f0efeb' };
}
