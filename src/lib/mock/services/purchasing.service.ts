import { mockDelay } from '../core/delay';
import { mockStore } from '../core/store';
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

  async getByMaterial(_materialId?: number) {
    await mockDelay();
    return this.clone(this.collection());
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

class PurchaseCommandService extends BaseService<any> {
  constructor() { super('purchaseCommands'); }

  async findById(id: number | string): Promise<any> {
    await mockDelay();
    return this.clone(this.collection().find((c) => c.id === id));
  }

  async compute(id: number) {
    await mockDelay();
    return { id, computed: true };
  }

  async updateItem(itemId: number, data: Record<string, unknown>) {
    await mockDelay();
    return { id: itemId, ...data };
  }
}

// ─── Service instances (singletons) ──────────────────────────────────────────

const supplierSvc = new SupplierService();
const materialSupplierSvc = new MaterialSupplierService();
const purchaseCommandSvc = new PurchaseCommandService();

// ─── Exports (API công khai, tương thích ngược hoàn toàn) ────────────────────

export const getSuppliers = () => supplierSvc.getAll();
export const createSupplier = (data: Record<string, unknown>) => supplierSvc.create(data);
export const updateSupplier = (id: number, data: Record<string, unknown>) => supplierSvc.update(id, data);
export const deleteSupplier = (id: number) => supplierSvc.remove(id);

export const getMaterialSuppliers = (materialId?: number) => materialSupplierSvc.getByMaterial(materialId);
export const createMaterialSupplier = (data: Record<string, unknown>) => materialSupplierSvc.create(data);
export const updateMaterialSupplier = (id: number, data: Record<string, unknown>) => materialSupplierSvc.update(id, data);
export const deleteMaterialSupplier = (id: number) => materialSupplierSvc.remove(id);

export const getPurchaseCommands = () => purchaseCommandSvc.getAll();
export const getPurchaseCommand = (id: number) => purchaseCommandSvc.findById(id);
export const computePurchaseCommand = (id: number) => purchaseCommandSvc.compute(id);
export const updateCommandItem = (itemId: number, data: Record<string, unknown>) => purchaseCommandSvc.updateItem(itemId, data);
