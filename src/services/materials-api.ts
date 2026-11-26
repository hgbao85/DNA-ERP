/**
 * Adapter MATERIALS: FE ⇄ BE thật (module `materials` — vật tư + liên kết NCC).
 * BE dùng id dạng bigint-as-string (không phải UUID) — không cần Number(), truyền thẳng string
 * trong URL. Field `id`/`materialGroupId`/`materialId`/`supplierId` khai `number` ở type (dù giá
 * trị runtime là string) để khớp các interface `{ id: number }` cũ trong page — cùng cách
 * users-mapper.ts đang làm cho SystemUser.id.
 */
import { http } from './core/http';

export interface BeMaterial {
  id: number;
  code: string;
  name: string;
  unit: string;
  spec: string | null;
  materialGroupId: number | null;
  /** Denormalized từ MaterialGroup.name (BE toResponseDto) — dùng ở VatTuDashboardPage để lọc
   *  theo Nhóm vật tư mà không cần gọi riêng GET /material-groups (WAREHOUSE_STAFF không có
   *  quyền MATERIAL_GROUP:VIEW). */
  materialGroupName: string | null;
  /** Sơn/Phụ kiện/Bao bì — chỉ có ý nghĩa khi materialGroupId thuộc nhóm systemKey OTHER
   *  ("Vật tư khác"), null với mọi nhóm khác. Dùng để lọc riêng từng tab ở SpecDetailQuotaPage
   *  vì 3 tab đó giờ dùng chung 1 nhóm vật tư — xem MaterialPicker.tsx. */
  detailKind: 'PAINT' | 'ACCESSORY' | 'CUSHION' | 'PACKAGING' | null;
  /** Nhóm con của Sắt (2026-10-01) - chỉ có ý nghĩa khi materialGroupId thuộc nhóm systemKey
   *  STEEL_BAR, null với mọi nhóm khác. Dùng để lọc riêng Sắt/Tự tính/Vật tư thành phẩm ở
   *  SpecSteelPage.tsx - xem MaterialPicker.tsx (steelSubGroup prop). */
  steelSubGroup: 'SOFTWARE' | 'SELF_CALC' | 'FINISHED_COMPONENT' | null;
  warehouseId: string | null;
  /** Denormalized từ Warehouse.code/name — cùng lý do materialGroupName ở trên. */
  warehouseCode: string | null;
  warehouseName: string | null;
  buyerId: string | null;
  /** CHỈ có ý nghĩa với vật tư nhóm Sắt (systemKey STEEL_BAR) - ngưỡng hao hụt tối đa chấp
   *  nhận được khi cắt, gửi xuống solver cắt sắt (ghi đè mặc định hệ thống). null với mọi
   *  nhóm khác - xem MaterialsService.resolveWasteFields (BE). */
  maxCuttingWastePercentage: number | null;
  /** CHỈ có ý nghĩa với vật tư KHÔNG thuộc nhóm Sắt phần mềm - % dự trù cộng thêm vào số lượng
   *  đề xuất mua. null với Sắt phần mềm. */
  purchaseWastePercentage: number | null;
  /** Tri-state (2026-10-10) - ép CÁCH làm tròn buyQty khi tính đề xuất mua. null = mỗi luồng tự
   *  theo mặc định gốc (vật tư tiêu hao giữ thập phân, Sắt tự tính luôn ceil nguyên cây/tấm).
   *  true = ép ceil lên nguyên (vd Đinh/Vis/Nút). false = ép GIỮ thập phân (vd Tấm sắt la). */
  purchaseRoundUp: boolean | null;
  imageUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BeMaterialSupplier {
  id: number;
  materialId: number;
  supplierId: number;
  supplierName: string;
  price: number;
  leadTimeDays: number | null;
}

/** BE giới hạn `limit` tối đa 100 (PaginationQueryDto @Max(100)) - gọi lần lượt từng trang rồi gộp
 *  để danh mục > 100 vật tư không bị cắt (trước đây chỉ lấy 100 vật tư mới nhất). */
const MATERIALS_PAGE_SIZE = 100;
const MATERIALS_MAX_PAGES = 50; // chặn vòng lặp vô hạn nếu BE trả meta sai

async function fetchAllMaterials(): Promise<BeMaterial[]> {
  const all: BeMaterial[] = [];
  for (let page = 1; page <= MATERIALS_MAX_PAGES; page += 1) {
    const res = await http.get<BeMaterial[] | { data: BeMaterial[]; meta?: { totalPages?: number } }>(
      `/materials?limit=${MATERIALS_PAGE_SIZE}&page=${page}`,
    );
    if (Array.isArray(res)) return res;
    all.push(...res.data);
    const totalPages = res.meta?.totalPages ?? 1;
    if (page >= totalPages || res.data.length === 0) break;
  }
  return all;
}

/**
 * 26/11/2026 (lỗi 429 "Thao tác quá nhanh"): 9 màn gọi getMaterials(), mỗi lần tải cả danh mục theo từng trang 100 dòng (409 vật
 * tư = 5 request) nên đổi qua lại vài màn là chạm trần 100 request / 60 giây của BE. Nay các lần gọi trong 30 giây DÙNG CHUNG 1
 * lần tải (cả các lần gọi cùng lúc), và xoá bộ nhớ ngay khi có thao tác ghi vật tư ở đây hoặc khi tải lỗi (lần sau tải lại).
 * Mỗi nơi gọi nhận 1 bản sao mảng riêng nên sắp xếp / lọc tại chỗ không ảnh hưởng nơi khác.
 */
export const MATERIALS_CACHE_TTL_MS = 30_000;
let materialsCache: { at: number; promise: Promise<BeMaterial[]> } | null = null;

export function invalidateMaterialsCache(): void {
  materialsCache = null;
}

export function getMaterials(): Promise<BeMaterial[]> {
  const now = Date.now();
  if (!materialsCache || now - materialsCache.at > MATERIALS_CACHE_TTL_MS) {
    const promise = fetchAllMaterials();
    materialsCache = { at: now, promise };
    promise.catch(() => {
      if (materialsCache?.promise === promise) materialsCache = null;
    });
  }
  return materialsCache.promise.then((list) => list.slice());
}

// AdminEntityPage's <select> cho purchaseRoundUp chỉ gửi được string ("true"/"false") hoặc
// null/undefined ("— Mặc định —", xem comment ở field config trong MaterialsPage.tsx) - decode
// về đúng kiểu boolean|null|undefined mà BE mong đợi trước khi gửi.
function decodeRoundUp(v: unknown): boolean | null | undefined {
  if (v === 'true') return true;
  if (v === 'false') return false;
  return v as null | undefined;
}

export async function createMaterial(data: Record<string, unknown>): Promise<BeMaterial> {
  const created = await http.post<BeMaterial>('/materials', {
    code: data.code,
    name: data.name,
    unit: data.unit,
    spec: data.spec,
    materialGroupId: data.materialGroupId || undefined,
    detailKind: data.detailKind || undefined,
    steelSubGroup: data.steelSubGroup || undefined,
    warehouseId: data.warehouseId || undefined,
    buyerId: data.buyerId || undefined,
    // Truyền thẳng (KHÔNG `|| undefined`) - 0 là giá trị hợp lệ cho purchaseWastePercentage
    // (vật tư không có hao hụt mua), `|| undefined` sẽ vô tình nuốt mất nó.
    // maxCuttingWastePercentage KHÔNG gửi nữa (2026-09-30): Sắt không còn ngưỡng cắt riêng theo vật tư.
    purchaseWastePercentage: data.purchaseWastePercentage,
    purchaseRoundUp: decodeRoundUp(data.purchaseRoundUp),
    openingQty: data.openingQty || undefined,
    imageUrl: data.imageUrl || undefined,
  });
  invalidateMaterialsCache();
  return created;
}

export async function updateMaterial(id: number | string, data: Record<string, unknown>): Promise<BeMaterial> {
  const updated = await http.patch<BeMaterial>(`/materials/${id}`, {
    code: data.code,
    name: data.name,
    unit: data.unit,
    spec: data.spec,
    // `?? null` (KHÔNG `|| undefined`) - đính chính audit toàn diện 09/09 (Cao/H1): FE
    // (AdminEntityPage.tsx) đã gửi đúng `null` khi Admin chọn "— Không —" để gỡ gán, nhưng
    // `null || undefined` luôn ra `undefined` nên `JSON.stringify` xoá hẳn field khỏi payload
    // PATCH - BE tưởng "không gửi field này" = giữ nguyên, âm thầm KHÔNG gỡ gán dù báo lưu
    // thành công. Cùng lỗi/cùng cách sửa đã áp dụng cho maxCuttingWastePercentage/
    // purchaseWastePercentage ngay bên dưới.
    materialGroupId: data.materialGroupId ?? null,
    detailKind: data.detailKind || undefined,
    steelSubGroup: data.steelSubGroup || undefined,
    warehouseId: data.warehouseId ?? null,
    buyerId: data.buyerId ?? null,
    purchaseWastePercentage: data.purchaseWastePercentage ?? null,
    purchaseRoundUp: decodeRoundUp(data.purchaseRoundUp),
    imageUrl: data.imageUrl,
    isActive: data.isActive,
  });
  invalidateMaterialsCache();
  return updated;
}

/**
 * Sửa % hao hụt hàng loạt (Admin > Vật tư) - đúng 1 trong 2 phạm vi: `materialIds` (chọn tay,
 * có thể khác nhóm nhau) hoặc `materialGroupId` (áp dụng cho cả nhóm). `value: null` = xoá %
 * hao hụt hiện có - hành động hàng loạt luôn GHI ĐÈ, không có khái niệm "để trống = giữ nguyên"
 * như PATCH từng vật tư (xem MaterialsService.bulkUpdateWaste ở BE, field thật sự ghi
 * (maxCuttingWastePercentage/purchaseWastePercentage) tuỳ nhóm của TỪNG vật tư).
 */
export async function bulkUpdateMaterialWaste(payload: {
  materialIds?: string[];
  materialGroupId?: string;
  value: number | null;
}): Promise<{ updated: number; skippedSteel: number }> {
  const result = await http.patch<{ updated: number; skippedSteel: number }>('/materials/bulk-waste', payload);
  invalidateMaterialsCache();
  return result;
}

export async function deleteMaterial(id: number | string): Promise<{ id: number | string }> {
  await http.del(`/materials/${id}`);
  invalidateMaterialsCache();
  return { id };
}

export async function getMaterialSuppliers(materialId: number | string): Promise<BeMaterialSupplier[]> {
  return http.get<BeMaterialSupplier[]>(`/materials/${materialId}/suppliers`);
}

export async function createMaterialSupplier(data: Record<string, unknown>): Promise<BeMaterialSupplier> {
  const { materialId, ...body } = data;
  return http.post<BeMaterialSupplier>(`/materials/${materialId}/suppliers`, body);
}

export async function updateMaterialSupplier(
  materialId: number | string,
  id: number | string,
  data: Record<string, unknown>,
): Promise<BeMaterialSupplier> {
  return http.patch<BeMaterialSupplier>(`/materials/${materialId}/suppliers/${id}`, data);
}

export async function deleteMaterialSupplier(materialId: number | string, id: number | string): Promise<{ id: number | string }> {
  await http.del(`/materials/${materialId}/suppliers/${id}`);
  return { id };
}
