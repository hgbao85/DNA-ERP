import { mockDelay } from '../core/delay';
import { mockStore } from '../core/store';
import { nextId } from '../core/id';
import { BaseService } from '../core/base.service';
import type { CreatePlanFormPayload, PlanForm } from '../../../types/plan-form';

// ─── Service class ────────────────────────────────────────────────────────────

class PlanFormService extends BaseService<PlanForm> {
  constructor() { super('planForms'); }

  private buildMaterialType(dto: CreatePlanFormPayload['materialType']) {
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

  private enrich(pf: PlanForm): PlanForm {
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

  async getAll(): Promise<PlanForm[]> {
    await mockDelay();
    return mockStore.get().planForms.map((pf) => this.enrich(pf));
  }

  async getOptions() {
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

  async findPlanForm(id: number): Promise<PlanForm> {
    await mockDelay();
    const pf = mockStore.get().planForms.find((p) => p.id === id);
    if (!pf) throw new Error(`PlanForm #${id} not found`);
    return this.enrich(pf);
  }

  async createForm(data: CreatePlanFormPayload): Promise<PlanForm> {
    await mockDelay();
    let created!: PlanForm;
    mockStore.update((s) => {
      const quota = this.buildMaterialType(data.materialType);
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
    return this.enrich(created);
  }

  async propose(data: CreatePlanFormPayload): Promise<PlanForm> {
    const created = await this.createForm(data);
    return this.proposeById(created.id);
  }

  async proposeById(id: number): Promise<PlanForm> {
    await mockDelay();
    let updated!: PlanForm;
    mockStore.update((s) => {
      const idx = s.planForms.findIndex((p) => p.id === id);
      if (idx < 0) throw new Error(`PlanForm #${id} not found`);
      updated = { ...s.planForms[idx], status: 'PROPOSED', proposedAt: new Date().toISOString() };
      s.planForms[idx] = updated;
    });
    return this.enrich(updated);
  }

  async deleteMany(ids: number[]): Promise<void> {
    await mockDelay();
    mockStore.update((s) => {
      s.planForms = s.planForms.filter((p) => !ids.includes(p.id));
    });
  }
}

// ─── Service instance (singleton) ────────────────────────────────────────────

const planFormSvc = new PlanFormService();

// ─── Exports (API công khai, tương thích ngược hoàn toàn) ────────────────────

export const getPlanForms = () => planFormSvc.getAll();
export const getPlanFormOptions = () => planFormSvc.getOptions();
export const getPlanForm = (id: number) => planFormSvc.findPlanForm(id);
export const createPlanForm = (data: CreatePlanFormPayload) => planFormSvc.createForm(data);
export const proposePlanForm = (data: CreatePlanFormPayload) => planFormSvc.propose(data);
export const proposePlanFormById = (id: number) => planFormSvc.proposeById(id);
export const deletePlanForms = (ids: number[]) => planFormSvc.deleteMany(ids);
