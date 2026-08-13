import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock đúng những gì restoreSession() phụ thuộc - không đụng localStorage/axios thật.
vi.mock('../services/api', () => ({ getProfile: vi.fn() }));
vi.mock('../services/core/http', () => ({
  http: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() },
  SESSION_EXPIRED_EVENT: 'session-expired',
}));
vi.mock('../services/core/tokenStorage', () => ({
  tokenStorage: {
    getAccessToken: vi.fn(),
    setUser: vi.fn(),
    clear: vi.fn(),
  },
}));

import { getProfile } from '../services/api';
import { tokenStorage } from '../services/core/tokenStorage';
import { restoreSession } from './AuthContext';

const getAccessToken = tokenStorage.getAccessToken as ReturnType<typeof vi.fn>;
const clear = tokenStorage.clear as ReturnType<typeof vi.fn>;
const getProfileMock = getProfile as ReturnType<typeof vi.fn>;

describe('restoreSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Bug đã xảy ra thật: code cũ set token vào state NGAY khi thấy có token lưu sẵn, rồi mới verify
  // qua getProfile() - trong lúc chờ verify, mọi consumer khác đọc token từ context tưởng đã đăng
  // nhập xong và gọi API luôn, gây 401 hàng loạt ngay trên /login khi token cũ đã hết hạn.
  // restoreSession() phải KHÔNG BAO GIỜ trả về 1 token chưa được getProfile() xác minh.
  it('trả về null (không lộ token) khi token đã lưu không còn hợp lệ', async () => {
    getAccessToken.mockReturnValue('stale-token');
    getProfileMock.mockRejectedValue(new Error('401 Unauthorized'));

    const session = await restoreSession();

    expect(session).toBeNull();
    expect(clear).toHaveBeenCalled();
  });

  it('không gọi getProfile() khi chưa từng đăng nhập (không có token lưu sẵn)', async () => {
    getAccessToken.mockReturnValue(null);

    const session = await restoreSession();

    expect(session).toBeNull();
    expect(getProfileMock).not.toHaveBeenCalled();
  });

  it('trả về đúng token+user khi token lưu sẵn còn hợp lệ (verify thành công)', async () => {
    getAccessToken.mockReturnValue('valid-token');
    getProfileMock.mockResolvedValue({
      id: '1',
      email: 'a@b.com',
      roles: ['BOSS'],
      firstName: 'A',
      lastName: 'B',
    });

    const session = await restoreSession();

    expect(session?.token).toBe('valid-token');
    expect(session?.user.role).toBe('BOSS');
  });
});
