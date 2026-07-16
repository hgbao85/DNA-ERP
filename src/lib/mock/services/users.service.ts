import { mockDelay } from '../core/delay';
import { BaseService } from '../core/base.service';
import type { SystemUser } from '../../../types/admin';

// Lưu ý: password ở đây là mock-only, plaintext — cùng convention với
// MOCK_ACCOUNTS trước đây (mật khẩu chung demo1234). Không dùng cho production.
class UsersService extends BaseService<SystemUser> {
  constructor() { super('users'); }

  async create(data: Record<string, unknown>): Promise<SystemUser> {
    if (this.collection().some((u) => u.email === data.email)) {
      throw new Error('Email đã tồn tại');
    }
    return super.create(data, { isActive: true, createdAt: new Date().toISOString() });
  }

  async update(id: number | string, data: Record<string, unknown>): Promise<SystemUser | undefined> {
    if (typeof data.email === 'string' && this.collection().some((u) => u.email === data.email && u.id !== id)) {
      throw new Error('Email đã tồn tại');
    }
    return super.update(id, { ...data, updatedAt: new Date().toISOString() });
  }

  /** Dùng cho đăng nhập — thay thế MOCK_ACCOUNTS.find() cũ. */
  async verifyCredentials(email: string, password: string): Promise<SystemUser | undefined> {
    await mockDelay();
    return this.collection().find((u) => u.email === email && u.password === password && u.isActive);
  }
}

const usersSvc = new UsersService();

export const getUsers = () => usersSvc.getAll();
export const getUserById = (id: number | string) => usersSvc.findById(id);
export const createUser = (data: Record<string, unknown>) => usersSvc.create(data);
export const updateUser = (id: number | string, data: Record<string, unknown>) => usersSvc.update(id, data);
export const deleteUser = (id: number | string) => usersSvc.remove(id);
export const verifyUserCredentials = (email: string, password: string) => usersSvc.verifyCredentials(email, password);
