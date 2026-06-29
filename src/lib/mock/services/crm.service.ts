import { mockDelay } from '../core/delay';
import { mockStore } from '../core/store';
import { nextId } from '../core/id';
import { BaseService } from '../core/base.service';
import type {
  Product,
  RetailCustomer,
  WholesaleCustomer,
  CareReminder,
  WholesaleCareReminder,
  Promotion,
  Quotation,
  AgencyWarehouseSummary,
  Order,
  SalesUserSummary,
} from '../../../types/index';

// ─── Service classes ──────────────────────────────────────────────────────────

class ProductService extends BaseService<Product> {
  constructor() { super('products'); }

  async create(data: Record<string, unknown>): Promise<Product> {
    await mockDelay();
    let created: Record<string, unknown> = {};
    mockStore.update((s) => {
      created = { id: data.id ?? `SP-${nextId()}`, ...data };
      (s.products as unknown as Record<string, unknown>[]).push(created);
    });
    return created as unknown as Product;
  }
}

class AgencyWarehouseService extends BaseService<AgencyWarehouseSummary> {
  constructor() { super('agencyWarehouses'); }
}

class OrderService extends BaseService<Order> {
  constructor() { super('orders'); }
}

class SalesUserService extends BaseService<SalesUserSummary> {
  constructor() { super('salesUsers'); }

  async create(data: Record<string, unknown>): Promise<SalesUserSummary> {
    await mockDelay();
    const user = { id: nextId(), ...data };
    mockStore.update((s) => {
      s.salesUsers.push(user as unknown as (typeof s.salesUsers)[0]);
    });
    return user as unknown as SalesUserSummary;
  }
}

class RetailCustomerService extends BaseService<RetailCustomer> {
  constructor() { super('retailCustomers'); }

  async create(data: Record<string, unknown>): Promise<RetailCustomer> {
    return super.create(data, { debt: 0, createdAt: new Date().toISOString() });
  }

  async detail(id: number): Promise<RetailCustomer> {
    await mockDelay();
    const c = mockStore.get().retailCustomers.find((x) => x.id === id);
    if (!c) throw new Error('Not found');
    return this.clone({ ...c, careHistory: c.careHistory ?? [], orders: c.orders ?? [] });
  }

  async assignSales(id: number, salesId: number): Promise<RetailCustomer> {
    await mockDelay();
    mockStore.update((s) => {
      const c = s.retailCustomers.find((x) => x.id === id);
      if (c) {
        c.assignedSalesId = salesId;
        c.assignedSales = s.salesUsers.find((u) => u.id === salesId);
      }
    });
    return this.detail(id);
  }

  async addCareHistory(id: number, note: string): Promise<RetailCustomer> {
    await mockDelay();
    mockStore.update((s) => {
      const c = s.retailCustomers.find((x) => x.id === id);
      if (c) {
        if (!c.careHistory) c.careHistory = [];
        c.careHistory.unshift({ id: nextId(), note, createdAt: new Date().toISOString() });
      }
    });
    return this.detail(id);
  }
}

class CareReminderService extends BaseService<CareReminder> {
  constructor() { super('careReminders'); }
}

class WholesaleCustomerService extends BaseService<WholesaleCustomer> {
  constructor() { super('wholesaleCustomers'); }

  async create(data: Record<string, unknown>): Promise<WholesaleCustomer> {
    return super.create(data, { debt: 0, createdAt: new Date().toISOString() });
  }

  async detail(id: number): Promise<WholesaleCustomer> {
    await mockDelay();
    const c = mockStore.get().wholesaleCustomers.find((x) => x.id === id);
    if (!c) throw new Error('Not found');
    return this.clone(c);
  }

  async addCareHistory(id: number, note: string): Promise<WholesaleCustomer> {
    await mockDelay();
    mockStore.update((s) => {
      const c = s.wholesaleCustomers.find((x) => x.id === id);
      if (c) {
        if (!c.careHistory) c.careHistory = [];
        c.careHistory.unshift({ id: nextId(), note, createdAt: new Date().toISOString() });
      }
    });
    return this.detail(id);
  }

  async assignSales(id: number, salesId: number): Promise<WholesaleCustomer> {
    await mockDelay();
    mockStore.update((s) => {
      const c = s.wholesaleCustomers.find((x) => x.id === id);
      if (c) {
        c.assignedSalesId = salesId;
        c.assignedSales = s.salesUsers.find((u) => u.id === salesId);
      }
    });
    return this.detail(id);
  }
}

class WholesaleCareReminderService extends BaseService<WholesaleCareReminder> {
  constructor() { super('wholesaleCareReminders'); }
}

class PromotionService extends BaseService<Promotion> {
  constructor() { super('promotions'); }

  async create(data: Record<string, unknown>): Promise<Promotion> {
    return super.create(data, { createdAt: new Date().toISOString() });
  }
}

class QuotationService extends BaseService<Quotation> {
  constructor() { super('quotations'); }

  async create(data: Record<string, unknown>): Promise<Quotation> {
    await mockDelay();
    let created: Record<string, unknown> = {};
    mockStore.update((s) => {
      created = {
        id: nextId(),
        code: `BG-2026-${String(s.quotations.length + 1).padStart(3, '0')}`,
        status: 'DRAFT',
        createdAt: new Date().toISOString(),
        items: [],
        discountPercent: 0,
        discountAmount: 0,
        totalAmount: 0,
        ...data,
      };
      s.quotations.unshift(created as unknown as (typeof s.quotations)[0]);
    });
    return created as unknown as Quotation;
  }

  async submit(id: number): Promise<Quotation | undefined> {
    await mockDelay();
    mockStore.update((s) => {
      const q = s.quotations.find((x) => x.id === id);
      if (q) q.status = 'PENDING';
    });
    return mockStore.get().quotations.find((q) => q.id === id);
  }

  async approve(id: number): Promise<Quotation | undefined> {
    await mockDelay();
    mockStore.update((s) => {
      const q = s.quotations.find((x) => x.id === id);
      if (q) q.status = 'APPROVED';
    });
    return mockStore.get().quotations.find((q) => q.id === id);
  }

  async reject(id: number, rejectReason: string): Promise<Quotation | undefined> {
    await mockDelay();
    mockStore.update((s) => {
      const q = s.quotations.find((x) => x.id === id);
      if (q) { q.status = 'REJECTED'; q.rejectReason = rejectReason; }
    });
    return mockStore.get().quotations.find((q) => q.id === id);
  }
}

// ─── Service instances (singletons) ──────────────────────────────────────────

const productSvc = new ProductService();
const agencyWarehouseSvc = new AgencyWarehouseService();
const orderSvc = new OrderService();
const salesUserSvc = new SalesUserService();
const retailSvc = new RetailCustomerService();
const careReminderSvc = new CareReminderService();
const wholesaleSvc = new WholesaleCustomerService();
const wholesaleCareReminderSvc = new WholesaleCareReminderService();
const promotionSvc = new PromotionService();
const quotationSvc = new QuotationService();

// ─── Exports (API công khai, tương thích ngược hoàn toàn) ────────────────────

export const getProducts = () => productSvc.getAll();
export const createProduct = (data: Record<string, unknown>) => productSvc.create(data);
export const updateProduct = (id: string, data: Record<string, unknown>) => productSvc.update(id, data);
export const deleteProduct = (id: string) => productSvc.remove(id);

export const getAgencyWarehouses = () => agencyWarehouseSvc.getAll();

export const getOrders = () => orderSvc.getAll();

export const getSalesUsers = () => salesUserSvc.getAll();
export const createUser = (data: Record<string, unknown>) => salesUserSvc.create(data);

export const getRetailCustomers = () => retailSvc.getAll();
export const getRetailCustomerDetail = (id: number) => retailSvc.detail(id);
export const createRetailCustomer = (data: Record<string, unknown>) => retailSvc.create(data);
export const updateRetailCustomer = (id: number, data: Record<string, unknown>) => retailSvc.update(id, data);
export const deleteRetailCustomer = (id: number) => retailSvc.remove(id);
export const assignRetailCustomerSales = (id: number, salesId: number) => retailSvc.assignSales(id, salesId);
export const addRetailCareHistory = (id: number, note: string) => retailSvc.addCareHistory(id, note);

export const getCareReminders = () => careReminderSvc.getAll();
export const updateCareReminder = (id: number, data: Record<string, unknown>) => careReminderSvc.update(id, data);

export const getWholesaleCustomers = () => wholesaleSvc.getAll();
export const getWholesaleCustomerDetail = (id: number) => wholesaleSvc.detail(id);
export const createWholesaleCustomer = (data: Record<string, unknown>) => wholesaleSvc.create(data);
export const updateWholesaleCustomer = (id: number, data: Record<string, unknown>) => wholesaleSvc.update(id, data);
export const deleteWholesaleCustomer = (id: number) => wholesaleSvc.remove(id);
export const addWholesaleCareHistory = (id: number, note: string) => wholesaleSvc.addCareHistory(id, note);
export const assignWholesaleCustomerSales = (id: number, salesId: number) => wholesaleSvc.assignSales(id, salesId);

export const getWholesaleCareReminders = () => wholesaleCareReminderSvc.getAll();
export const updateWholesaleCareReminder = (id: number, data: Record<string, unknown>) => wholesaleCareReminderSvc.update(id, data);

export const getPromotions = () => promotionSvc.getAll();
export const createPromotion = (data: Record<string, unknown>) => promotionSvc.create(data);
export const updatePromotion = (id: number, data: Record<string, unknown>) => promotionSvc.update(id, data);
export const deletePromotion = (id: number) => promotionSvc.remove(id);

export const getQuotations = () => quotationSvc.getAll();
export const createQuotation = (data: Record<string, unknown>) => quotationSvc.create(data);
export const submitQuotation = (id: number) => quotationSvc.submit(id);
export const approveQuotation = (id: number) => quotationSvc.approve(id);
export const rejectQuotation = (id: number, rejectReason: string) => quotationSvc.reject(id, rejectReason);
