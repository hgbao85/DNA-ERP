import { describe, expect, it } from 'vitest';
import { errMsg } from './errors';
import { ApiError } from '../services/core/apiError';

// core/http.ts luôn chuẩn hoá lỗi request thành ApiError (Error thật, .message = câu tiếng Việt
// BE trả về) trước khi tới bất kỳ catch nào trong app - đây là ca thật sự xảy ra nhiều nhất.
describe('errMsg — lấy đúng câu lỗi tiếng Việt từ ApiError (ca thật, D.p0-error-msg)', () => {
  it('ApiError (lỗi BE thật) -> trả .message, không phải .error (tên class)', () => {
    const e = new ApiError('Purchase proposal 999999 not found', 404, 'NotFoundException');
    expect(errMsg(e)).toBe('Purchase proposal 999999 not found');
  });

  it('ApiError với message đã join từ mảng validation (BE trả message: string[])', () => {
    const e = new ApiError('a phải là số, b không được để trống', 400, 'BadRequestException');
    expect(errMsg(e)).toBe('a phải là số, b không được để trống');
  });
});

describe('errMsg — fallback khi không phải ApiError/Error', () => {
  it('Error thường (network lỗi trước khi tới interceptor) -> vẫn lấy .message', () => {
    expect(errMsg(new Error('Network Error'))).toBe('Network Error');
  });

  it('throw không phải Error (string/object/undefined) -> dùng fallback truyền vào', () => {
    expect(errMsg('chuỗi lỗi thô', 'Lỗi xử lý')).toBe('Lỗi xử lý');
    expect(errMsg(undefined, 'Lỗi lưu thời hạn')).toBe('Lỗi lưu thời hạn');
    expect(errMsg({ code: 500 }, 'Lỗi gửi QLSX')).toBe('Lỗi gửi QLSX');
  });

  it('không truyền fallback -> dùng mặc định "Lỗi xử lý"', () => {
    expect(errMsg(null)).toBe('Lỗi xử lý');
  });

  it('Error với message rỗng -> vẫn rơi về fallback (không trả chuỗi rỗng)', () => {
    expect(errMsg(new Error(''), 'Lỗi mặc định')).toBe('Lỗi mặc định');
  });
});
