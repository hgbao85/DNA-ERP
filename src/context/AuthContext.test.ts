import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock đúng những gì restoreSession() phụ thuộc - không đụng localStorage/axios thật.
vi.mock('../services/api', () => ({ getProfile: vi.fn() }));
vi.mock('../services/core/http', () => ({
  http: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() },
  SESSION_EXPIRED_EVENT: 'session-expired',
}));
vi.mock('../services/core/tokenStorage', () => ({
  tokenStorage: {
    getUser: vi.fn(),
    setUser: vi.fn(),
    clearUser: vi.fn(),
  },
}));

import { getProfile } from '../services/api';
import { tokenStorage } from '../services/core/tokenStorage';
import { restoreSession } from './AuthContext';

const setUser = tokenStorage.setUser as ReturnType<typeof vi.fn>;
const clearUser = tokenStorage.clearUser as ReturnType<typeof vi.fn>;
const getProfileMock = getProfile as ReturnType<typeof vi.fn>;

describe('restoreSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Bug đã xảy ra thật: code cũ set token vào state NGAY khi thấy có token lưu sẵn, rồi mới verify
  // qua getProfile() - trong lúc chờ verify, mọi consumer khác đọc token từ context tưởng đã đăng
  // nhập xong và gọi API luôn, gây 401 hàng loạt ngay trên /login khi token cũ đã hết hạn.
  // restoreSession() phải KHÔNG BAO GIỜ trả về 1 phiên chưa được getProfile() xác minh.
  it('trả về null (không lộ phiên) khi getProfile() thất bại (cookie hết hạn/không có)', async () => {
    getProfileMock.mockRejectedValue(new Error('401 Unauthorized'));

    const user = await restoreSession();

    expect(user).toBeNull();
    expect(clearUser).toHaveBeenCalled();
  });

  // Access/refresh token nằm trong cookie httpOnly (JS không đọc được) từ 2026-08-21 - không còn
  // cách nào "check trước có token hay không" như bản cũ (getAccessToken() trả null -> skip hẳn
  // getProfile()). Luôn phải gọi getProfile() và coi 401 là "chưa đăng nhập" - đánh đổi 1 request
  // dư trên /login của khách vãng lai để đổi lấy việc token không bao giờ lộ ra JS.
  it('trả về đúng user khi phiên hợp lệ (verify qua getProfile thành công)', async () => {
    getProfileMock.mockResolvedValue({
      id: '1',
      email: 'a@b.com',
      roles: ['BOSS'],
      firstName: 'A',
      lastName: 'B',
    });

    const user = await restoreSession();

    expect(user?.role).toBe('BOSS');
    expect(setUser).toHaveBeenCalled();
  });
});
