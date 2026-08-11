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
  /** Sơn/Phụ kiện/Bao bì — chỉ có ý nghĩa khi materialGroupId thuộc nhóm systemKey OTHER
   *  ("Vật tư khác"), null với mọi nhóm khác. Dùng để lọc riêng từng tab ở SpecDetailQuotaPage
   *  vì 3 tab đó giờ dùng chung 1 nhóm vật tư — xem MaterialPicker.tsx. */
  detailKind: 'PAINT' | 'ACCESSORY' | 'PACKAGING' | null;
  warehouseId: string | null;
  buyerId: string | null;
  /** Đơn vị mua hàng từ NCC khi khác `unit` (đơn vị tồn kho/sản xuất) — vd NCC bán theo "kg"
   *  nhưng sản xuất dùng "cái". null nếu vật tư chỉ có 1 đơn vị duy nhất. */
  purchaseUnit: string | null;
  khoUnitFactor: number | null;
  /** CHỈ có ý nghĩa với vật tư nhóm Sắt (systemKey STEEL_BAR) - ngưỡng hao hụt tối đa chấp
   *  nhận được khi cắt, gửi xuống solver cắt sắt (ghi đè mặc định hệ thống). null với mọi
   *  nhóm khác - xem MaterialsService.resolveWasteFields (BE). */
  maxCuttingWastePercentage: number | null;
  /** CHỈ có ý nghĩa với vật tư KHÔNG thuộc nhóm Sắt - % dự trù cộng thêm vào số lượng đề xuất
   *  mua (chưa nối vào luồng đề xuất mua nào). null với vật tư Sắt. */
  purchaseWastePercentage: number | null;
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

export async function getMaterials(): Promise<BeMaterial[]> {
  const res = await http.get<BeMaterial[] | { data: BeMaterial[] }>('/materials?limit=100');
  return Array.isArray(res) ? res : res.data;
}

export async function createMaterial(data: Record<string, unknown>): Promise<BeMaterial> {
  return http.post<BeMaterial>('/materials', {
    code: data.code,
    name: data.name,
    unit: data.unit,
    spec: data.spec,
    materialGroupId: data.materialGroupId || undefined,
    detailKind: data.detailKind || undefined,
    warehouseId: data.warehouseId || undefined,
    buyerId: data.buyerId || undefined,
    purchaseUnit: data.purchaseUnit || undefined,
    khoUnitFactor: data.khoUnitFactor,
    // Truyền thẳng (KHÔNG `|| undefined`) - 0 là giá trị hợp lệ cho purchaseWastePercentage
    // (vật tư không có hao hụt mua), `|| undefined` sẽ vô tình nuốt mất nó.
    maxCuttingWastePercentage: data.maxCuttingWastePercentage,
    purchaseWastePercentage: data.purchaseWastePercentage,
    openingQty: data.openingQty || undefined,
    imageUrl: data.imageUrl || undefined,
  });
}

export async function updateMaterial(id: number | string, data: Record<string, unknown>): Promise<BeMaterial> {
  return http.patch<BeMaterial>(`/materials/${id}`, {
    code: data.code,
    name: data.name,
    unit: data.unit,
    spec: data.spec,
    materialGroupId: data.materialGroupId || undefined,
    detailKind: data.detailKind || undefined,
    warehouseId: data.warehouseId || undefined,
    buyerId: data.buyerId || undefined,
    purchaseUnit: data.purchaseUnit,
    khoUnitFactor: data.khoUnitFactor,
    // `?? null` (KHÔNG để undefined trôi qua) - input số phát undefined khi bị xoá trắng
    // (AdminEntityPage.tsx), undefined sẽ bị JSON.stringify bỏ khỏi payload PATCH khiến BE
    // không đụng cột (tưởng "không gửi field này" = giữ nguyên) dù người dùng vừa xoá trắng để
    // xin về mặc định hệ thống - lưu xong không có gì đổi mà vẫn báo thành công. Ép null để
    // gửi đúng ý định "xoá field" (đã từng là defect thật với khoUnitFactor, chưa sửa - không
    // đụng ở đây vì ngoài phạm vi 2 field hao hụt).
    maxCuttingWastePercentage: data.maxCuttingWastePercentage ?? null,
    purchaseWastePercentage: data.purchaseWastePercentage ?? null,
    imageUrl: data.imageUrl,
    isActive: data.isActive,
  });
}

export async function deleteMaterial(id: number | string): Promise<{ id: number | string }> {
  await http.del(`/materials/${id}`);
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
