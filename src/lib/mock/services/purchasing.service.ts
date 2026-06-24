import { mockDelay } from '../core/delay';
import { mockStore } from '../core/store';
import { nextId } from '../core/id';

const clone = <T>(v: T): T => structuredClone(v);
const ok = async <T>(v: T) => { await mockDelay(); return v; };

export const getSuppliers = () => ok(clone(mockStore.get().suppliers));
export const createSupplier = async (data: Record<string, unknown>) => {
  await mockDelay();
  const row = { id: nextId(), isActive: true, ...data };
  mockStore.update((s) => s.suppliers.push(row as never));
  return row;
};
export const updateSupplier = async (id: number, data: Record<string, unknown>) => ok({ id, ...data });
export const deleteSupplier = async (id: number) => ok({ id });

export const getMaterialSuppliers = (_materialId?: number) =>
  ok(clone(mockStore.get().materialSuppliers));
export const createMaterialSupplier = async (data: Record<string, unknown>) => ok({ id: nextId(), ...data });
export const updateMaterialSupplier = async (id: number, data: Record<string, unknown>) => ok({ id, ...data });
export const deleteMaterialSupplier = async (id: number) => ok({ id });

export const getPurchaseCommands = () => ok(clone(mockStore.get().purchaseCommands));
export const getPurchaseCommand = (id: number) =>
  ok(clone(mockStore.get().purchaseCommands.find((c) => c.id === id)));
export const computePurchaseCommand = (id: number) => ok({ id, computed: true });
export const updateCommandItem = async (itemId: number, data: Record<string, unknown>) =>
  ok({ id: itemId, ...data });
