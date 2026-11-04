import { describe, expect, it } from 'vitest';
import {
  isValidLsxCode,
  lenhDisplayCode,
  lenhLsxCodes,
  lineCode,
  lsxCodeError,
  lsxNumberOf,
  lsxPrefixOf,
  matchesLenhSearch,
  normalizeLsxCode,
  parseLsxPrefixes,
} from './lenhCode';

describe('normalizeLsxCode - chuẩn hoá số LSX', () => {
  it('in hoa, chèn gạch nối', () => {
    expect(normalizeLsxCode('my 313')).toBe('MY-313');
    expect(normalizeLsxCode('MY_313')).toBe('MY-313');
    expect(normalizeLsxCode('my313')).toBe('MY-313');
    expect(normalizeLsxCode('  gp-176  ')).toBe('GP-176');
  });
  it('sai dạng thì trả chuỗi đã in hoa, bỏ trắng', () => {
    expect(normalizeLsxCode('abc')).toBe('ABC');
    expect(normalizeLsxCode('12 34')).toBe('1234');
    expect(normalizeLsxCode('')).toBe('');
  });
});

describe('isValidLsxCode - biên', () => {
  it('đúng dạng', () => {
    expect(isValidLsxCode('MY-313')).toBe(true);
    expect(isValidLsxCode('A-1')).toBe(true);
    expect(isValidLsxCode('ABCDEF-123456')).toBe(true);
  });
  it('sai dạng', () => {
    expect(isValidLsxCode('ABCDEFG-1')).toBe(false); // 7 chữ cái
    expect(isValidLsxCode('MY-1234567')).toBe(false); // 7 chữ số
    expect(isValidLsxCode('my-313')).toBe(false); // chưa in hoa
    expect(isValidLsxCode('MY313')).toBe(false);
    expect(isValidLsxCode('MY-')).toBe(false);
    expect(isValidLsxCode('-313')).toBe(false);
    expect(isValidLsxCode('')).toBe(false);
  });
});

describe('lsxPrefixOf / lsxNumberOf', () => {
  it('tách tiền tố và số', () => {
    expect(lsxPrefixOf('MY-313')).toBe('MY');
    expect(lsxNumberOf('MY-313')).toBe('313');
  });
  it('sai dạng -> null', () => {
    expect(lsxPrefixOf('abc')).toBeNull();
    expect(lsxNumberOf('abc')).toBeNull();
  });
});

describe('parseLsxPrefixes', () => {
  it('bỏ trắng, in hoa, bỏ trùng, giữ thứ tự', () => {
    expect(parseLsxPrefixes('my, gp ,MY')).toEqual(['MY', 'GP']);
  });
  it('rỗng -> []', () => {
    expect(parseLsxPrefixes('')).toEqual([]);
    expect(parseLsxPrefixes(' , ; ')).toEqual([]);
  });
});

describe('lsxCodeError', () => {
  it('sai dạng', () => {
    expect(lsxCodeError('abc', [])).toMatch(/TIỀN TỐ-SỐ/);
  });
  it('tiền tố ngoài danh sách', () => {
    const err = lsxCodeError('XX-1', ['MY', 'GP']);
    expect(err).toMatch(/Tiền tố XX/);
    expect(err).toContain('MY, GP');
  });
  it('đúng dạng và nằm trong danh sách', () => {
    expect(lsxCodeError('MY-313', ['MY', 'GP'])).toBeNull();
  });
  it('danh sách rỗng chấp nhận mọi tiền tố đúng dạng', () => {
    expect(lsxCodeError('ZZ-9', [])).toBeNull();
  });
});

describe('lenhLsxCodes / lenhDisplayCode', () => {
  const pi = { code: 'PI-2026-016' };
  it('gộp nhiều dòng: nối " + "', () => {
    expect(lenhDisplayCode(pi, [{ lsxCode: 'MY-313' }, { lsxCode: 'MY-314' }])).toBe('MY-313 + MY-314');
  });
  it('trùng chỉ hiện 1 lần', () => {
    expect(lenhDisplayCode(pi, [{ lsxCode: 'MY-313' }, { lsxCode: 'MY-313' }])).toBe('MY-313');
  });
  it('dòng null/rỗng bị bỏ', () => {
    expect(lenhDisplayCode(pi, [{ lsxCode: null }, { lsxCode: 'MY-313' }, { lsxCode: '  ' }, {}])).toBe('MY-313');
  });
  it('chưa dòng nào có LSX -> mã PI', () => {
    expect(lenhDisplayCode(pi, [{ lsxCode: null }, {}])).toBe('PI-2026-016');
    expect(lenhDisplayCode(pi, [])).toBe('PI-2026-016');
    expect(lenhDisplayCode(pi, null)).toBe('PI-2026-016');
    expect(lenhDisplayCode(pi, undefined)).toBe('PI-2026-016');
  });
  it('giữ thứ tự dòng (không sắp lại)', () => {
    expect(lenhDisplayCode(pi, [{ lsxCode: 'MY-314' }, { lsxCode: 'GP-1' }, { lsxCode: 'MY-313' }])).toBe('MY-314 + GP-1 + MY-313');
    expect(lenhLsxCodes([{ lsxCode: 'B-2' }, { lsxCode: 'A-1' }])).toEqual(['B-2', 'A-1']);
  });
});

describe('lineCode - mã của 1 dòng SKU', () => {
  it('có LSX thì dùng LSX', () => {
    expect(lineCode({ lsxCode: 'MY-313' }, 'PI-1')).toBe('MY-313');
  });
  it('chưa có (null/rỗng/trắng) thì mã PI', () => {
    expect(lineCode({ lsxCode: null }, 'PI-1')).toBe('PI-1');
    expect(lineCode({}, 'PI-1')).toBe('PI-1');
    expect(lineCode({ lsxCode: '  ' }, 'PI-1')).toBe('PI-1');
  });
});

describe('matchesLenhSearch - ô "Tìm mã PI hoặc số LSX"', () => {
  const pi = { code: 'PI-2026-016', displayCode: 'MY-313 + MY-314', items: [{ lsxCode: 'MY-313' }, { lsxCode: 'MY-314' }] };
  it('theo mã PI', () => {
    expect(matchesLenhSearch(pi, '2026-016')).toBe(true);
  });
  it('theo số LSX của một dòng', () => {
    expect(matchesLenhSearch(pi, 'MY-314')).toBe(true);
  });
  it('không phân biệt hoa thường, bỏ trắng 2 đầu', () => {
    expect(matchesLenhSearch(pi, '  my-313 ')).toBe(true);
    expect(matchesLenhSearch(pi, 'pi-2026')).toBe(true);
  });
  it('ô rỗng = khớp hết', () => {
    expect(matchesLenhSearch(pi, '')).toBe(true);
    expect(matchesLenhSearch(pi, '   ')).toBe(true);
  });
  it('không khớp', () => {
    expect(matchesLenhSearch(pi, 'GP-999')).toBe(false);
  });
  it('lệnh cũ chưa có LSX vẫn tìm được theo mã PI', () => {
    expect(matchesLenhSearch({ code: 'PI-2026-001', items: [{ lsxCode: null }] }, 'pi-2026-001')).toBe(true);
    expect(matchesLenhSearch({ code: 'PI-2026-001' }, 'MY')).toBe(false);
  });
});
