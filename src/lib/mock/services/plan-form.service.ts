import { mockDelay } from '../core/delay';
import { mockStore } from '../core/store';
import { nextId } from '../core/id';
import type { CreatePlanFormPayload, PlanForm } from '../../../types/plan-form';

function buildMaterialType(dto: CreatePlanFormPayload['materialType']) {
  return {
    id: nextId(),
    materialType: {
      sat: [{ id: nextId(), name: dto.sat.type, specifications: dto.sat.specifications, thickness: dto.sat.thickness, unit: 'cây', quantity: 1 }],
      daySon: [{ id: nextId(), name: dto.daySon.specifications ?? 'Dây/Sơn', specifications: dto.daySon.specifications, kg: dto.daySon.kg, unit: 'kg' }],
      vatTuPhuKien: [{ id: nextId(), name: 'Phụ kiện', unit: dto.vatTuPhuKien.unit, quantity: 1 }],
      baoBiDongGoi: [{ id: nextId(), name: 'Bao bì', unit: dto.baoBiDongGoi.unit, quantity: 1 }],
    },
  };
}

function enrichPlanForm(pf: PlanForm): PlanForm {
  const s = mockStore.get();
  const exportOrder = s.exportOrders.find((o: any) => o.id === pf.exportOrderId);
  const mfgProduct = s.mfgProducts.find((p: any) => p.id === pf.mfgProductId);
  return {
    ...pf,
    exportOrder: exportOrder
      ? { id: exportOrder.id, poNumber: exportOrder.poNumber, deliveryDate: exportOrder.deliveryDate }
      : pf.exportOrder,
    mfgProduct: mfgProduct
      ? { id: mfgProduct.id, factoryCode: mfgProduct.factoryCode, name: mfgProduct.name }
      : pf.mfgProduct,
    customerName: pf.customerName ?? exportOrder?.exportCustomer?.name ?? null,
    createdBy: pf.createdBy ?? { id: 39, name: 'NV Kế hoạch SX Linh' },
  };
}

export async function getPlanForms() {
  await mockDelay();
  return mockStore.get().planForms.map(enrichPlanForm);
}

export async function getPlanFormOptions() {
  await mockDelay();
  const s = mockStore.get();
  return {
    exportOrders: s.exportOrders.map((o) => ({
      id: o.id,
      poNumber: o.poNumber,
      deliveryDate: o.deliveryDate,
      status: o.status,
    })),
    mfgProducts: s.mfgProducts.map((p) => ({
      id: p.id,
      factoryCode: p.factoryCode,
      name: p.name,
    })),
  };
}

export async function getPlanForm(id: number) {
  await mockDelay();
  const pf = mockStore.get().planForms.find((p) => p.id === id);
  if (!pf) throw new Error(`PlanForm #${id} not found`);
  return enrichPlanForm(pf);
}

export async function createPlanForm(data: CreatePlanFormPayload) {
  await mockDelay();
  let created!: PlanForm;
  mockStore.update((s) => {
    const quota = buildMaterialType(data.materialType);
    created = {
      id: nextId(),
      exportOrderId: data.exportOrderId,
      mfgProductId: data.mfgProductId,
      status: 'DRAFT',
      note: data.note,
      customerName: data.customerName ?? null,
      createdAt: new Date().toISOString(),
      createdBy: { id: 39, name: 'NV Kế hoạch SX Linh' },
      quotaManagement: quota,
    };
    s.planForms.unshift(created);
  });
  return enrichPlanForm(created);
}

export async function proposePlanForm(data: CreatePlanFormPayload) {
  const created = await createPlanForm(data);
  return proposePlanFormById(created.id);
}

export async function proposePlanFormById(id: number) {
  await mockDelay();
  let updated!: PlanForm;
  mockStore.update((s) => {
    const idx = s.planForms.findIndex((p) => p.id === id);
    if (idx < 0) throw new Error(`PlanForm #${id} not found`);
    updated = {
      ...s.planForms[idx],
      status: 'PROPOSED',
      proposedAt: new Date().toISOString(),
    };
    s.planForms[idx] = updated;
  });
  return enrichPlanForm(updated);
}

export async function deletePlanForms(ids: number[]) {
  await mockDelay();
  mockStore.update((s) => {
    s.planForms = s.planForms.filter((p) => !ids.includes(p.id));
  });
}
