import { describe, it, expect, vi } from 'vitest';
import { createEventBus } from './eventBus';
import type { RealtimeEnvelope } from './contract';

const envelope = (eventId: string, payload: unknown = {}): RealtimeEnvelope<unknown> => ({
  eventId,
  name: 'entity.changed',
  occurredAt: '2026-10-07T00:00:00.000Z',
  correlationId: null,
  payload,
});

describe('createEventBus', () => {
  it('phát event cho đúng listener của tên đó', () => {
    const bus = createEventBus();
    const onEntity = vi.fn();
    const onNotif = vi.fn();
    bus.on('entity.changed', onEntity);
    bus.on('notification.created', onNotif);

    expect(bus.dispatch('entity.changed', envelope('e1'))).toBe(true);
    expect(onEntity).toHaveBeenCalledTimes(1);
    expect(onNotif).not.toHaveBeenCalled();
  });

  it('khử trùng: cùng eventId đến 2 lần (vd sau kết nối lại) chỉ phát 1 lần', () => {
    const bus = createEventBus();
    const fn = vi.fn();
    bus.on('entity.changed', fn);

    expect(bus.dispatch('entity.changed', envelope('dup'))).toBe(true);
    expect(bus.dispatch('entity.changed', envelope('dup'))).toBe(false);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('bỏ qua envelope thiếu eventId', () => {
    const bus = createEventBus();
    const fn = vi.fn();
    bus.on('entity.changed', fn);
    expect(bus.dispatch('entity.changed', { ...envelope(''), eventId: '' })).toBe(false);
    expect(fn).not.toHaveBeenCalled();
  });

  it('giới hạn bộ nhớ khử trùng: eventId đã rớt khỏi cửa sổ có thể phát lại', () => {
    const bus = createEventBus({ seenLimit: 2 });
    const fn = vi.fn();
    bus.on('entity.changed', fn);
    bus.dispatch('entity.changed', envelope('a'));
    bus.dispatch('entity.changed', envelope('b'));
    bus.dispatch('entity.changed', envelope('c')); // đẩy 'a' ra khỏi cửa sổ
    expect(bus.dispatch('entity.changed', envelope('a'))).toBe(true);
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it('cách ly lỗi: listener ném lỗi không chặn listener khác và được báo qua onError', () => {
    const onError = vi.fn();
    const bus = createEventBus({ onError });
    const healthy = vi.fn();
    bus.on('entity.changed', () => {
      throw new Error('boom');
    });
    bus.on('entity.changed', healthy);

    bus.dispatch('entity.changed', envelope('x'));
    expect(healthy).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(expect.any(Error), 'entity.changed');
  });

  it('huỷ đăng ký: sau khi unsubscribe listener không còn nhận event (không rò listener)', () => {
    const bus = createEventBus();
    const fn = vi.fn();
    const off = bus.on('entity.changed', fn);
    bus.dispatch('entity.changed', envelope('1'));
    off();
    bus.dispatch('entity.changed', envelope('2'));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('listener tự huỷ đăng ký ngay trong lúc phát không làm bỏ sót listener khác', () => {
    const bus = createEventBus();
    const second = vi.fn();
    let off: () => void = () => {};
    off = bus.on('entity.changed', () => off());
    bus.on('entity.changed', second);
    bus.dispatch('entity.changed', envelope('self-off'));
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('resync: gọi mọi listener resync; huỷ đăng ký được', () => {
    const bus = createEventBus();
    const a = vi.fn();
    const b = vi.fn();
    const offA = bus.onResync(a);
    bus.onResync(b);
    bus.resync();
    offA();
    bus.resync();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(2);
  });
});

describe('onSafetyTick', () => {
  it('safetyTick gọi mọi listener; huỷ đăng ký thì không gọi nữa', () => {
    const bus = createEventBus();
    const a = vi.fn();
    const b = vi.fn();
    const offA = bus.onSafetyTick(a);
    bus.onSafetyTick(b);
    bus.safetyTick();
    offA();
    bus.safetyTick();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(2);
  });

  it('không kích hoạt resync (để banner "đã cập nhật" không bật theo định kỳ)', () => {
    const bus = createEventBus();
    const resync = vi.fn();
    bus.onResync(resync);
    bus.safetyTick();
    expect(resync).not.toHaveBeenCalled();
  });
});
