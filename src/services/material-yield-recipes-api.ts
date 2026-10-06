/**
 * Adapter MATERIAL YIELD RECIPES: FE ⇄ BE thật (module `material-yield-recipes`, 2026-10-01).
 * Định mức "vật tư thành phẩm không gắn piece" (vd thanh nhôm → chân nhôm) - xem doc comment
 * MaterialYieldRecipesService (BE). outputMaterialId PHẢI thuộc nhóm Sắt + nhóm con
 * FINISHED_COMPONENT (BE tự validate, xem MaterialsPage.tsx field "Nhóm con Sắt").
 */
import { http } from './core/http';
import type { ProcessStep } from '../types/sku';

export interface BeMaterialYieldRecipe {
  id: number;
  outputMaterialId: string;
  outputMaterialCode: string;
  outputMaterialName: string;
  inputMaterialId: string;
  inputMaterialCode: string;
  inputMaterialName: string;
  /** Số vật tư ra cắt được từ 1 đơn vị vật tư vào (vd 1 thanh nhôm = 12 chân). */
  piecesPerBar: number;
  processSteps: ProcessStep[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function getMaterialYieldRecipes(): Promise<BeMaterialYieldRecipe[]> {
  const res = await http.get<BeMaterialYieldRecipe[] | { data: BeMaterialYieldRecipe[] }>(
    '/material-yield-recipes',
  );
  return Array.isArray(res) ? res : res.data;
}

export async function createMaterialYieldRecipe(
  data: Record<string, unknown>,
): Promise<BeMaterialYieldRecipe> {
  return http.post<BeMaterialYieldRecipe>('/material-yield-recipes', {
    outputMaterialId: data.outputMaterialId,
    inputMaterialId: data.inputMaterialId,
    piecesPerBar: data.piecesPerBar,
    processSteps: data.processSteps ?? [],
  });
}

export async function updateMaterialYieldRecipe(
  id: number | string,
  data: Record<string, unknown>,
): Promise<BeMaterialYieldRecipe> {
  return http.patch<BeMaterialYieldRecipe>(`/material-yield-recipes/${id}`, {
    outputMaterialId: data.outputMaterialId,
    inputMaterialId: data.inputMaterialId,
    piecesPerBar: data.piecesPerBar,
    processSteps: data.processSteps ?? [],
    isActive: data.isActive,
  });
}

export async function deleteMaterialYieldRecipe(
  id: number | string,
): Promise<{ id: number | string }> {
  await http.del(`/material-yield-recipes/${id}`);
  return { id };
}
