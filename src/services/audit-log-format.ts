/**
 * Dịch 1 dòng `audit_logs` của BE (diff tự động theo field, `oldValue`/`newValue` là ảnh chụp cả bản
 * ghi) sang chữ đọc được cho trang Admin "Nhật ký hoạt động" (16/11/2026 - thay bản mock localStorage).
 */
import { format } from 'date-fns';
import type { BeAuditLogEntry } from './audit-log-api';
import { AUDIT_ACTIONS } from '../context/AuditLogContext';

/** Tên bảng BE -> nhãn. Cũng là danh sách lựa chọn ở bộ lọc "Đối tượng". */
export const AUDIT_TABLE_LABEL: Record<string, string> = {
  User: 'Người dùng',
  UserRole: 'Gán vai trò',
  Role: 'Vai trò',
  RolePermission: 'Quyền của vai trò',
  SystemConfig: 'Cấu hình hệ thống',
  Material: 'Vật tư',
  MaterialGroup: 'Nhóm vật tư',
  Supplier: 'Nhà cung cấp',
  Customer: 'Khách hàng',
  DefectReason: 'Lý do lỗi',
  WeavingPoint: 'Điểm đan',
  Warehouse: 'Kho',
  MfgProduct: 'Sản phẩm',
  ProductVariant: 'Biến thể sản phẩm',
  Piece: 'Mảnh',
  Part: 'Chi tiết',
  SegmentSpec: 'Quy cách đoạn',
  BomRevision: 'Phiên bản định mức',
  PlanForm: 'SKU / Định mức',
  SalesOrder: 'Đơn hàng bán',
  SalesOrderItem: 'Dòng đơn hàng bán',
  ProductionInvoice: 'Lệnh sản xuất (PI)',
  ProductionInvoiceItem: 'Dòng lệnh sản xuất',
  ProductionOrder: 'Lệnh sản xuất theo SKU',
  CuttingProposal: 'Phương án cắt',
  CutBundle: 'Bó cắt',
  SegmentOverage: 'Đoạn cắt dư',
  PurchaseProposal: 'Đề xuất mua hàng',
  PurchaseProposalItem: 'Dòng đề xuất mua',
  PurchaseProposalQuote: 'Chọn NCC / giá',
  SupplierOrder: 'Đơn đặt hàng NCC',
  StockReservation: 'Giữ chỗ tồn kho',
  WarehouseTransfer: 'Chuyển kho',
  SteelIssue: 'Xuất sắt',
  QcReview: 'Lượt KCS',
  ProductionBatch: 'Lô sản xuất',
  MaterialIssue: 'Xuất vật tư tiêu hao',
  PackagingIssue: 'Xuất vật tư đóng gói',
  MaterialYieldRecipe: 'Công thức vật tư thành phẩm',
  MaterialYieldIssue: 'Xuất vật tư theo định mức cắt',
  MaterialYieldRecipeIssue: 'Xuất vật tư theo công thức',
  IssueSlip: 'Phiếu xuất XK',
  MaterialYieldStepBatch: 'Đợt công đoạn vật tư TP',
  MaterialYieldStepBundle: 'Bó công đoạn vật tư TP',
  WeavingIssue: 'Xuất đan',
  WeavingReceipt: 'Nhận đan',
  TransferCheckDefect: 'Lỗi chuyền kiểm',
  bookings: 'Booking xuất hàng',
  SkuHistory: 'Lịch sử duyệt SKU',
};

export const AUDIT_ACTION_META: Record<BeAuditLogEntry['action'], { label: string; color: string; bg: string }> = {
  CREATE: { label: 'Tạo', color: 'var(--fg-2563eb)', bg: 'var(--bg-eff6ff, rgba(37,99,235,0.08))' },
  UPDATE: { label: 'Sửa', color: 'var(--fg-d97706)', bg: 'var(--bg-fffbeb, rgba(217,119,6,0.08))' },
  DELETE: { label: 'Xoá', color: 'var(--fg-c62828)', bg: 'var(--bg-fef2f2, rgba(198,40,40,0.08))' },
};

const FIELD_LABEL: Record<string, string> = {
  status: 'Trạng thái',
  name: 'Tên',
  code: 'Mã',
  username: 'Tên đăng nhập',
  email: 'Email',
  firstName: 'Tên',
  lastName: 'Họ',
  isActive: 'Hoạt động',
  deletedAt: 'Đã xoá lúc',
  quantity: 'Số lượng',
  unit: 'Đơn vị',
  note: 'Ghi chú',
  reason: 'Lý do',
  buyerId: 'Người mua',
  warehouseId: 'Kho',
  supplierId: 'Nhà cung cấp',
  orderQty: 'Số mua',
  buyQty: 'Số cần mua',
  factoryCode: 'Mã nhà máy',
  deliveryDate: 'Hạn giao',
  approvedAt: 'Duyệt lúc',
  rejectedAt: 'Từ chối lúc',
  submittedAt: 'Gửi lúc',
  purchasedAt: 'Mua xong lúc',
  floorStage: 'Tiến độ xưởng',
  wastePercentage: 'Hao hụt %',
  purchaseWastePercentage: 'Hao hụt mua %',
  detailDraftSavedAt: 'Lưu nháp định mức chi tiết lúc',
  manhDraftSavedAt: 'Lưu nháp định mức mảnh lúc',
};

/** Trường hệ thống, đổi ở mọi lần ghi - không đáng hiện. */
const IGNORED_FIELDS = new Set(['id', 'createdAt', 'updatedAt', 'password', 'passwordHash', 'pinHash']);

/** Trường dùng làm "tên" của bản ghi, theo thứ tự ưu tiên. */
const IDENTITY_FIELDS = ['code', 'factoryCode', 'username', 'name', 'skuCode', 'title'];

type Snapshot = Record<string, unknown>;

function asSnapshot(v: unknown): Snapshot | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Snapshot) : null;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

export function formatAuditValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return 'trống';
  if (typeof v === 'boolean') return v ? 'Có' : 'Không';
  if (typeof v === 'string' && ISO_DATE.test(v)) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? v : format(d, 'dd/MM/yyyy HH:mm');
  }
  const s = String(v);
  return s.length > 60 ? `${s.slice(0, 57)}…` : s;
}

export function auditTableLabel(tableName: string): string {
  return AUDIT_TABLE_LABEL[tableName] ?? tableName;
}

export function auditFieldLabel(field: string): string {
  return FIELD_LABEL[field] ?? field;
}

/** "Thép ống 21" / "PB-OH-A"... lấy từ ảnh chụp mới (hoặc cũ khi xoá); không có thì null. */
export function auditRecordName(entry: BeAuditLogEntry): string | null {
  const snap = asSnapshot(entry.newValue) ?? asSnapshot(entry.oldValue);
  if (!snap) return null;
  // Dòng lịch sử duyệt SKU (BE sku-history.ts): newValue = { event: 'sku.boss_approved', note } -
  // hiện tên bước thay vì tìm mã/tên như bản ghi thường. recordId là id SKU (PlanForm).
  if (entry.tableName === 'SkuHistory' && typeof snap.event === 'string') {
    const label = (AUDIT_ACTIONS as Record<string, { label: string }>)[snap.event]?.label ?? snap.event;
    return typeof snap.note === 'string' && snap.note ? `${label} — ${snap.note}` : label;
  }
  if (typeof snap.firstName === 'string' || typeof snap.lastName === 'string') {
    const full = [snap.lastName, snap.firstName].filter((x) => typeof x === 'string' && x).join(' ');
    if (full) return full;
  }
  for (const f of IDENTITY_FIELDS) {
    const v = snap[f];
    if (typeof v === 'string' && v.trim()) return v;
  }
  return null;
}

export interface AuditFieldChange {
  field: string;
  label: string;
  from: string;
  to: string;
}

/**
 * Các trường đơn (không phải object/mảng) đã đổi giữa oldValue và newValue. Bỏ trường quan hệ lồng
 * (ảnh chụp kèm `mfgProduct`, `salesOrder`... đổi theo bản ghi khác, không phải thay đổi của chính dòng
 * này) và trường hệ thống. Chỉ có ý nghĩa với UPDATE.
 */
export function auditChanges(entry: BeAuditLogEntry): AuditFieldChange[] {
  if (entry.action !== 'UPDATE') return [];
  const before = asSnapshot(entry.oldValue) ?? {};
  const after = asSnapshot(entry.newValue) ?? {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changes: AuditFieldChange[] = [];
  for (const key of keys) {
    if (IGNORED_FIELDS.has(key)) continue;
    const a = before[key];
    const b = after[key];
    if ((a !== null && typeof a === 'object') || (b !== null && typeof b === 'object')) continue;
    if (a === b || (a == null && b == null)) continue;
    changes.push({ field: key, label: auditFieldLabel(key), from: formatAuditValue(a), to: formatAuditValue(b) });
  }
  // Trạng thái lên đầu - thường là điều người xem cần biết nhất.
  return changes.sort((x, y) => (x.field === 'status' ? -1 : y.field === 'status' ? 1 : 0));
}

/**
 * Lý do 1 dòng UPDATE không có trường đơn nào đổi (auditChanges rỗng) - để không hiện chung chung.
 * Khoảng 1/5 dòng UPDATE thật là lần BE ghi lại khi tính lại dữ liệu (rollup đề xuất mua, giữ chỗ...)
 * mà giá trị y nguyên; User thì mật khẩu bị BE gỡ khỏi ảnh chụp nên đổi mật khẩu trông như không đổi.
 */
export function auditNoVisibleChangeReason(entry: BeAuditLogEntry): string {
  if (entry.tableName === 'User') return 'Không có trường hiển thị được (vd. đổi mật khẩu, đổi vai trò)';
  const before = asSnapshot(entry.oldValue) ?? {};
  const after = asSnapshot(entry.newValue) ?? {};
  const nestedChanged = [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((k) => !IGNORED_FIELDS.has(k))
    .some((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
  return nestedChanged
    ? 'Chỉ đổi dữ liệu lồng bên trong (nháp, danh sách con, tham số…)'
    : 'Không có giá trị nào đổi (hệ thống ghi lại khi tính lại dữ liệu)';
}
