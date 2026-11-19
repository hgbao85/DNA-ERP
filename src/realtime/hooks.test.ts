import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRefetchScheduler, nextRefetchDelay } from './hooks';

describe('nextRefetchDelay', () => {
  it('chưa chạm trần: giữ nguyên debounce', () => {
    expect(nextRefetchDelay(1000, 1000, 3000, 5000)).toBe(3000);
  });
  it('gần trần: rút ngắn còn đúng phần còn lại', () => {
    expect(nextRefetchDelay(5000, 1000, 3000, 5000)).toBe(1000);
  });
  it('quá trần: 0, không âm', () => {
    expect(nextRefetchDelay(9000, 1000, 3000, 5000)).toBe(0);
  });
});

describe('createRefetchScheduler (giờ giả)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('một event lẻ: tải lại sau debounce', () => {
    const run = vi.fn();
    const s = createRefetchScheduler(run, 3000, 5000);
    s.event();
    vi.advanceTimersByTime(2999);
    expect(run).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('event đến liên tục mỗi 1 giây: vẫn tải lại chậm nhất 5 giây từ event đầu', () => {
    const run = vi.fn();
    const s = createRefetchScheduler(run, 3000, 5000);
    s.event();
    for (let i = 0; i < 4; i++) { vi.advanceTimersByTime(1000); s.event(); }
    expect(run).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000); // t = 5000
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('sau khi tải lại, đợt mới tính trần từ event đầu mới', () => {
    const run = vi.fn();
    const s = createRefetchScheduler(run, 3000, 5000);
    s.event();
    vi.advanceTimersByTime(3000);
    expect(run).toHaveBeenCalledTimes(1);
    s.event();
    vi.advanceTimersByTime(2999);
    expect(run).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('now() (resync / safetyTick) tải lại ngay', () => {
    const run = vi.fn();
    const s = createRefetchScheduler(run, 3000, 5000);
    s.event();
    s.now();
    vi.advanceTimersByTime(0);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('mặc định maxWait 5000 với debounce nhỏ không đổi hành vi', () => {
    const run = vi.fn();
    const s = createRefetchScheduler(run, 400);
    s.event();
    vi.advanceTimersByTime(400);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('cancel: không tải lại', () => {
    const run = vi.fn();
    const s = createRefetchScheduler(run, 400, 5000);
    s.event();
    s.cancel();
    vi.advanceTimersByTime(10000);
    expect(run).not.toHaveBeenCalled();
  });
});
