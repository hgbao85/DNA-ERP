import { describe, expect, it } from 'vitest';
import { MAX_AUTO_RETRY_429, MAX_AUTO_WAIT_MS, retryDelayFor429 } from './retryAfter';

describe('retryDelayFor429 - tự thử lại GET bị 429', () => {
  it('Retry-After vài giây -> chờ đúng số giây đó (+250ms)', () => {
    expect(retryDelayFor429('3', 0)).toBe(3250);
    expect(retryDelayFor429(2, 1)).toBe(2250);
  });

  it('Retry-After lẻ giây thì làm tròn lên', () => {
    expect(retryDelayFor429('1.2', 0)).toBe(2250);
  });

  it('không có header / không phải số / <= 0 -> không đoán mò, không tự thử lại', () => {
    for (const v of [undefined, null, '', '   ', 'abc', '0', '-5', NaN]) {
      expect(retryDelayFor429(v, 0)).toBeNull();
    }
  });

  it('phải chờ lâu hơn trần tự thử lại (cửa sổ giới hạn 60 giây) -> báo lỗi, không treo màn', () => {
    expect(retryDelayFor429('60', 0)).toBeNull();
    expect(retryDelayFor429(String(MAX_AUTO_WAIT_MS / 1000), 0)).toBeNull(); // 10 giây + 250ms vượt trần
    expect(retryDelayFor429(String(MAX_AUTO_WAIT_MS / 1000 - 1), 0)).toBe(9250);
  });

  it('thử lại tối đa MAX_AUTO_RETRY_429 lần', () => {
    expect(retryDelayFor429('1', MAX_AUTO_RETRY_429 - 1)).toBe(1250);
    expect(retryDelayFor429('1', MAX_AUTO_RETRY_429)).toBeNull();
  });

  it('header dạng mảng (axios) lấy phần tử đầu', () => {
    expect(retryDelayFor429(['4'], 0)).toBe(4250);
  });
});
