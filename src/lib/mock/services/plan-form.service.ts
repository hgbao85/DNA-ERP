import { mockDelay } from '../core/delay';
import { mockStore } from '../core/store';
import { nextId } from '../core/id';
import type { CreatePlanFormPayload, PlanForm } from '../../../types/plan-form';

function buildMaterialType(dto: CreatePlanFormPayload['materialType']) {
  const satId = nextId();
  const daySonId = nextId();
  const vtpkId = nextId();
  const bbdgId = nextId();
  return {
    id: nextId(),
    materialType: {
      sat: { id: satId, ...dto.sat },
      daySon: { id: daySonId, ...dto.daySon },
      vatTuPhuKien: { id: vtpkId, ...dto.vatTuPhuKien },
      baoBiDongGoi: { id: bbdgId, ...dto.baoBiDongGoi },
    },
  };
}

function enrichPlanForm(pf: PlanForm): PlanForm {
  const s = mockStore.get();
  const exportOrder = s.exportOrders.find((o) => o.id === pf.exportOrderId);
  const mfgProduct = s.mfgProducts.find((p) => p.id === pf.mfgProductId);
  return {
    ...pf,
    exportOrder: exportOrder
      ? { id: exportOrder.id, poNumber: exportOrder.poNumber, deliveryDate: exportOrder.deliveryDate }
      : pf.exportOrder,
    mfgProduct: mfgProduct
      ? { id: mfgProduct.id, factoryCode: mfgProduct.factoryCode, name: mfgProduct.name }
      : pf.mfgProduct,
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
