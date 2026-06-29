import { mockDelay } from './delay';
import { mockStore } from './store';
import { nextId } from './id';
import type { MockState } from '../data/seed';


//CRUD chung cho mọi collection. Các service con kế thừa và override khi cần logic riêng.

export abstract class BaseService<T extends object> {
  protected constructor(protected readonly collectionKey: keyof MockState) {}

  protected collection(): T[] {
    return mockStore.get()[this.collectionKey] as unknown as T[];
  }

  protected clone<V>(v: V): V {
    return structuredClone(v);
  }

  async getAll(): Promise<T[]> {
    await mockDelay();
    return this.clone(this.collection());
  }

  async findById(id: number | string): Promise<T> {
    await mockDelay();
    const found = this.collection().find((x) => (x as any).id === id);
    if (!found) throw new Error('Not found');
    return this.clone(found);
  }

  async create(data: Record<string, unknown>, defaults: Record<string, unknown> = {}): Promise<T> {
    await mockDelay();
    let created!: T;
    mockStore.update((s) => {
      created = { id: nextId(), ...defaults, ...data } as unknown as T;
      (s[this.collectionKey] as unknown as T[]).push(created);
    });
    return created;
  }

  async update(id: number | string, data: Record<string, unknown>): Promise<T | undefined> {
    await mockDelay();
    mockStore.update((s) => {
      const arr = s[this.collectionKey] as unknown as any[];
      const i = arr.findIndex((x) => x.id === id);
      if (i >= 0) Object.assign(arr[i], data);
    });
    return this.collection().find((x) => (x as any).id === id);
  }

  async remove(id: number | string): Promise<{ id: number | string }> {
    await mockDelay();
    mockStore.update((s) => {
      (s as any)[this.collectionKey as string] = (s[this.collectionKey] as unknown as any[]).filter(
        (x: any) => x.id !== id,
      );
    });
    return { id };
  }
}
