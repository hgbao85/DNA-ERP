import { mockDelay } from '../core/delay';
import { verifyUserCredentials } from './users.service';
import { normalizeUser } from '../../../utils/normalizeUser';
import type { User } from '../../../context/AuthContext';

export async function loginUser(data: { email: string; password: string }) {
  const account = await verifyUserCredentials(data.email, data.password);
  if (!account) {
    const err = new Error('Email hoặc mật khẩu không đúng') as Error & {
      response?: { status: number; data: { message: string } };
    };
    err.response = { status: 401, data: { message: 'Email hoặc mật khẩu không đúng' } };
    throw err;
  }
  return {
    accessToken: `mock-token-${account.id}`,
    user: normalizeUser(account as unknown as Record<string, unknown>),
  };
}

export async function getProfile(): Promise<User> {
  await mockDelay();
  const raw = localStorage.getItem('user_info');
  if (!raw) {
    const err = new Error('Unauthorized') as Error & { response?: { status: number } };
    err.response = { status: 401 };
    throw err;
  }
  return normalizeUser(JSON.parse(raw) as Record<string, unknown>);
}
