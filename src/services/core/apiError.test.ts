import { describe, expect, it } from 'vitest';
import { ApiError, fallbackErrorMessage, isInvalidCredentials } from './apiError';

describe('fallbackErrorMessage (phản hồi không có câu lỗi của BE)', () => {
  it('mất mạng / 5xx / mã lạ đều ra câu tiếng Việt, không lộ câu axios', () => {
    expect(fallbackErrorMessage(0)).toMatch(/Không kết nối được máy chủ/);
    expect(fallbackErrorMessage(502)).toMatch(/Hệ thống đang lỗi/);
    expect(fallbackErrorMessage(429)).toMatch(/Đợi khoảng 1 phút/);
    expect(fallbackErrorMessage(418)).toBe(
      'Yêu cầu không thành công (mã 418). Thử lại; vẫn lỗi thì báo quản trị hệ thống.',
    );
    for (const s of [0, 400, 401, 403, 404, 413, 429, 500, 503]) {
      expect(fallbackErrorMessage(s)).not.toMatch(/Network|Request failed|HTTP/);
    }
  });
});

describe('isInvalidCredentials', () => {
  it('nhận cả câu cũ (tiếng Anh) và câu mới (tiếng Việt) của BE', () => {
    expect(isInvalidCredentials(new ApiError('Invalid credentials', 401, 'UnauthorizedException'))).toBe(true);
    expect(
      isInvalidCredentials(new ApiError('Tên đăng nhập hoặc mật khẩu không đúng', 401, 'UnauthorizedException')),
    ).toBe(true);
  });

  it('câu riêng của công nhân (còn N lần thử) và lỗi thường thì không', () => {
    expect(
      isInvalidCredentials(new ApiError('Sai PIN - còn 2 lần thử trước khi bị khoá tạm 15 phút', 401, 'x')),
    ).toBe(false);
    expect(isInvalidCredentials(new Error('Invalid credentials'))).toBe(false);
  });
});
