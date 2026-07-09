import { mockDelay } from '../core/delay';
import { nextId } from '../core/id';
import { BaseService } from '../core/base.service';

// ─── Service classes ──────────────────────────────────────────────────────────

class SupplierService extends BaseService<any> {
  constructor() { super('suppliers'); }

  async create(data: Record<string, unknown>): Promise<Record<string, unknown>> {
    return super.create(data, { isActive: true });
  }

  async update(id: number, data: Record<string, unknown>) {
    await mockDelay();
    return { id, ...data };
  }

  async remove(id: number) {
    await mockDelay();
    return { id };
  }
}

class MaterialSupplierService extends BaseService<any> {
  constructor() { super('materialSuppliers'); }

  async getByMaterial(materialId?: number) {
    await mockDelay();
    const all = this.clone(this.collection());
    return materialId != null ? all.filter((x: any) => x.materialId === materialId) : all;
  }

  async create(data: Record<string, unknown>): Promise<Record<string, unknown>> {
    await mockDelay();
    return { id: nextId(), ...data };
  }

  async update(id: number, data: Record<string, unknown>) {
    await mockDelay();
    return { id, ...data };
  }

  async remove(id: number) {
    await mockDelay();
    return { id };
  }
}

// ─── Service instances (singletons) ──────────────────────────────────────────

const supplierSvc = new SupplierService();
const materialSupplierSvc = new MaterialSupplierService();

// ─── Exports (API công khai, tương thích ngược hoàn toàn) ────────────────────

export const getSuppliers = () => supplierSvc.getAll();
export const createSupplier = (data: Record<string, unknown>) => supplierSvc.create(data);
export const updateSupplier = (id: number, data: Record<string, unknown>) => supplierSvc.update(id, data);
export const deleteSupplier = (id: number) => supplierSvc.remove(id);

export const getMaterialSuppliers = (materialId?: number) => materialSupplierSvc.getByMaterial(materialId);
export const createMaterialSupplier = (data: Record<string, unknown>) => materialSupplierSvc.create(data);
export const updateMaterialSupplier = (id: number, data: Record<string, unknown>) => materialSupplierSvc.update(id, data);
export const deleteMaterialSupplier = (id: number) => materialSupplierSvc.remove(id);
