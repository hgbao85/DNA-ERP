import { mockDelay } from '../core/delay';
import { mockStore } from '../core/store';
import { nextId } from '../core/id';

const clone = <T>(v: T): T => structuredClone(v);

export async function getProducts() {
  await mockDelay();
  return clone(mockStore.get().products);
}

export async function createProduct(data: Record<string, unknown>) {
  await mockDelay();
  let created: Record<string, unknown> = {};
  mockStore.update((s) => {
    created = { id: data.id ?? `SP-${nextId()}`, ...data };
    s.products.push(created as unknown as (typeof s.products)[0]);
  });
  return created;
}

export async function updateProduct(id: string, data: Record<string, unknown>) {
  await mockDelay();
  mockStore.update((s) => {
    const i = s.products.findIndex((p) => p.id === id);
    if (i >= 0) s.products[i] = { ...s.products[i], ...data };
  });
  return mockStore.get().products.find((p) => p.id === id);
}

export async function deleteProduct(id: string) {
  await mockDelay();
  mockStore.update((s) => {
    s.products = s.products.filter((p) => p.id !== id);
  });
  return { id };
}

export async function getAgencyWarehouses() {
  await mockDelay();
  return clone(mockStore.get().agencyWarehouses);
}

export async function getOrders() {
  await mockDelay();
  return clone(mockStore.get().orders);
}

export async function getSalesUsers() {
  await mockDelay();
  return clone(mockStore.get().salesUsers);
}

export async function createUser(data: Record<string, unknown>) {
  await mockDelay();
  const user = { id: nextId(), ...data };
  mockStore.update((s) => {
    s.salesUsers.push(user as unknown as (typeof s.salesUsers)[0]);
  });
  return user;
}

export async function getRetailCustomers() {
  await mockDelay();
  return clone(mockStore.get().retailCustomers);
}

export async function getRetailCustomerDetail(id: number) {
  await mockDelay();
  const c = mockStore.get().retailCustomers.find((x) => x.id === id);
  if (!c) throw new Error('Not found');
  return clone({ ...c, careHistory: c.careHistory ?? [], orders: c.orders ?? [] });
}

export async function createRetailCustomer(data: Record<string, unknown>) {
  await mockDelay();
  let created: Record<string, unknown> = {};
  mockStore.update((s) => {
    created = { id: nextId(), createdAt: new Date().toISOString(), debt: 0, ...data };
    s.retailCustomers.push(created as unknown as (typeof s.retailCustomers)[0]);
  });
  return created;
}

export async function updateRetailCustomer(id: number, data: Record<string, unknown>) {
  await mockDelay();
  mockStore.update((s) => {
    const i = s.retailCustomers.findIndex((c) => c.id === id);
    if (i >= 0) s.retailCustomers[i] = { ...s.retailCustomers[i], ...data };
  });
  return mockStore.get().retailCustomers.find((c) => c.id === id);
}

export async function deleteRetailCustomer(id: number) {
  await mockDelay();
  mockStore.update((s) => {
    s.retailCustomers = s.retailCustomers.filter((c) => c.id !== id);
  });
  return { id };
}

export async function assignRetailCustomerSales(id: number, salesId: number) {
  await mockDelay();
  mockStore.update((s) => {
    const c = s.retailCustomers.find((x) => x.id === id);
    if (c) {
      c.assignedSalesId = salesId;
      c.assignedSales = s.salesUsers.find((u) => u.id === salesId);
    }
  });
  return getRetailCustomerDetail(id);
}

export async function addRetailCareHistory(id: number, note: string) {
  await mockDelay();
  mockStore.update((s) => {
    const c = s.retailCustomers.find((x) => x.id === id);
    if (c) {
      if (!c.careHistory) c.careHistory = [];
      c.careHistory.unshift({ id: nextId(), note, createdAt: new Date().toISOString() });
    }
  });
  return getRetailCustomerDetail(id);
}

export async function getCareReminders() {
  await mockDelay();
  return clone(mockStore.get().careReminders);
}

export async function updateCareReminder(id: number, data: Record<string, unknown>) {
  await mockDelay();
  mockStore.update((s) => {
    const i = s.careReminders.findIndex((r) => r.id === id);
    if (i >= 0) s.careReminders[i] = { ...s.careReminders[i], ...data };
  });
  return mockStore.get().careReminders.find((r) => r.id === id);
}

export async function getWholesaleCareReminders() {
  await mockDelay();
  return clone(mockStore.get().wholesaleCareReminders);
}

export async function updateWholesaleCareReminder(id: number, data: Record<string, unknown>) {
  await mockDelay();
  mockStore.update((s) => {
    const i = s.wholesaleCareReminders.findIndex((r) => r.id === id);
    if (i >= 0) s.wholesaleCareReminders[i] = { ...s.wholesaleCareReminders[i], ...data };
  });
  return mockStore.get().wholesaleCareReminders.find((r) => r.id === id);
}

export async function getPromotions() {
  await mockDelay();
  return clone(mockStore.get().promotions);
}

export async function createPromotion(data: Record<string, unknown>) {
  await mockDelay();
  let created: Record<string, unknown> = {};
  mockStore.update((s) => {
    created = { id: nextId(), createdAt: new Date().toISOString(), ...data };
    s.promotions.push(created as unknown as (typeof s.promotions)[0]);
  });
  return created;
}

export async function updatePromotion(id: number, data: Record<string, unknown>) {
  await mockDelay();
  mockStore.update((s) => {
    const i = s.promotions.findIndex((p) => p.id === id);
    if (i >= 0) s.promotions[i] = { ...s.promotions[i], ...data };
  });
  return mockStore.get().promotions.find((p) => p.id === id);
}

export async function deletePromotion(id: number) {
  await mockDelay();
  mockStore.update((s) => {
    s.promotions = s.promotions.filter((p) => p.id !== id);
  });
  return { id };
}

export async function getWholesaleCustomers() {
  await mockDelay();
  return clone(mockStore.get().wholesaleCustomers);
}

export async function getWholesaleCustomerDetail(id: number) {
  await mockDelay();
  const c = mockStore.get().wholesaleCustomers.find((x) => x.id === id);
  if (!c) throw new Error('Not found');
  return clone(c);
}

export async function createWholesaleCustomer(data: Record<string, unknown>) {
  await mockDelay();
  let created: Record<string, unknown> = {};
  mockStore.update((s) => {
    created = { id: nextId(), createdAt: new Date().toISOString(), debt: 0, ...data };
    s.wholesaleCustomers.push(created as unknown as (typeof s.wholesaleCustomers)[0]);
  });
  return created;
}

export async function updateWholesaleCustomer(id: number, data: Record<string, unknown>) {
  await mockDelay();
  mockStore.update((s) => {
    const i = s.wholesaleCustomers.findIndex((c) => c.id === id);
    if (i >= 0) s.wholesaleCustomers[i] = { ...s.wholesaleCustomers[i], ...data };
  });
  return mockStore.get().wholesaleCustomers.find((c) => c.id === id);
}

export async function deleteWholesaleCustomer(id: number) {
  await mockDelay();
  mockStore.update((s) => {
    s.wholesaleCustomers = s.wholesaleCustomers.filter((c) => c.id !== id);
  });
  return { id };
}

export async function addWholesaleCareHistory(id: number, note: string) {
  await mockDelay();
  mockStore.update((s) => {
    const c = s.wholesaleCustomers.find((x) => x.id === id);
    if (c) {
      if (!c.careHistory) c.careHistory = [];
      c.careHistory.unshift({ id: nextId(), note, createdAt: new Date().toISOString() });
    }
  });
  return getWholesaleCustomerDetail(id);
}

export async function assignWholesaleCustomerSales(id: number, salesId: number) {
  await mockDelay();
  mockStore.update((s) => {
    const c = s.wholesaleCustomers.find((x) => x.id === id);
    if (c) {
      c.assignedSalesId = salesId;
      c.assignedSales = s.salesUsers.find((u) => u.id === salesId);
    }
  });
  return getWholesaleCustomerDetail(id);
}

export async function getQuotations() {
  await mockDelay();
  return clone(mockStore.get().quotations);
}

export async function createQuotation(data: Record<string, unknown>) {
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
  return created;
}

export async function submitQuotation(id: number) {
  await mockDelay();
  mockStore.update((s) => {
    const q = s.quotations.find((x) => x.id === id);
    if (q) q.status = 'PENDING';
  });
  return mockStore.get().quotations.find((q) => q.id === id);
}

export async function approveQuotation(id: number) {
  await mockDelay();
  mockStore.update((s) => {
    const q = s.quotations.find((x) => x.id === id);
    if (q) q.status = 'APPROVED';
  });
  return mockStore.get().quotations.find((q) => q.id === id);
}

export async function rejectQuotation(id: number, rejectReason: string) {
  await mockDelay();
  mockStore.update((s) => {
    const q = s.quotations.find((x) => x.id === id);
    if (q) {
      q.status = 'REJECTED';
      q.rejectReason = rejectReason;
    }
  });
  return mockStore.get().quotations.find((q) => q.id === id);
}
