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
  kind: string;
  unit: string;
  materialGroupId: number | null;
  khoUnitFactor: number | null;
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
    kind: data.kind || undefined,
    unit: data.unit,
    materialGroupId: data.materialGroupId || undefined,
    khoUnitFactor: data.khoUnitFactor,
  });
}

export async function updateMaterial(id: number | string, data: Record<string, unknown>): Promise<BeMaterial> {
  return http.patch<BeMaterial>(`/materials/${id}`, {
    code: data.code,
    name: data.name,
    kind: data.kind || undefined,
    unit: data.unit,
    materialGroupId: data.materialGroupId || undefined,
    khoUnitFactor: data.khoUnitFactor,
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
