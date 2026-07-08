import { mockDelay } from '../core/delay';
import { mockStore } from '../core/store';
import { nextId } from '../core/id';
import { BaseService } from '../core/base.service';
import type { SalesCustomer, SalesPO, SalesPOItem } from '../../../types/sales';

class SalesCustomerService extends BaseService<SalesCustomer> {
  constructor() { super('salesCustomers'); }

  async create(data: Record<string, unknown>): Promise<SalesCustomer> {
    return super.create(data, { createdAt: new Date().toISOString() });
  }
}

class SalesPOService extends BaseService<SalesPO> {
  constructor() { super('salesPOs'); }

  async create(data: Record<string, unknown>): Promise<SalesPO> {
    await mockDelay();
    let created: Record<string, unknown> = {};
    mockStore.update((s) => {
      const items = ((data.items as Omit<SalesPOItem, 'id'>[]) ?? []).map((it) => ({ id: nextId(), ...it }));
      created = {
        id: nextId(),
        code: `PO-${String(s.salesPOs.length + 1).padStart(3, '0')}`,
        createdAt: new Date().toISOString(),
        depositAmount: 0,
        depositConfirmed: false,
        paidAmount: 0,
        ...data,
        items,
      };
      s.salesPOs.unshift(created as unknown as SalesPO);
    });
    return created as unknown as SalesPO;
  }

  async update(id: number, data: Record<string, unknown>): Promise<SalesPO | undefined> {
    await mockDelay();
    mockStore.update((s) => {
      const po = s.salesPOs.find((x) => x.id === id);
      if (!po) return;
      const items = data.items as (Partial<SalesPOItem> & Omit<SalesPOItem, 'id'>)[] | undefined;
      Object.assign(po, {
        ...data,
        ...(items ? { items: items.map((it) => (it.id ? it : { id: nextId(), ...it })) } : {}),
      });
    });
    return mockStore.get().salesPOs.find((x) => x.id === id);
  }
}

const salesCustomerSvc = new SalesCustomerService();
const salesPOSvc = new SalesPOService();

export const getSalesCustomers = () => salesCustomerSvc.getAll();
export const createSalesCustomer = (data: Record<string, unknown>) => salesCustomerSvc.create(data);
export const updateSalesCustomer = (id: number, data: Record<string, unknown>) => salesCustomerSvc.update(id, data);
export const deleteSalesCustomer = (id: number) => salesCustomerSvc.remove(id);

export const getSalesPOs = () => salesPOSvc.getAll();
export const createSalesPO = (data: Record<string, unknown>) => salesPOSvc.create(data);
export const updateSalesPO = (id: number, data: Record<string, unknown>) => salesPOSvc.update(id, data);
