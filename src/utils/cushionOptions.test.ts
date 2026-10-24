import { describe, expect, it } from 'vitest';
import {
  countCushionLinesWithQty,
  dropBlankTickedCushionLines,
  syncTickedCushionLines,
  tickedCushionsWithoutQty,
} from './cushionOptions';

type Group = 'daySon' | 'vatTuPhuKien' | 'baoBiDongGoi';
interface Line { id: number; group: Group; materialId: string; soLuong: string }

const cushion = (materialId: string, materialCode = `NEM-${materialId}`) => ({ materialId, materialCode });
const line = (id: number, group: Group, materialId: string, soLuong = ''): Line => ({ id, group, materialId, soLuong });

describe('syncTickedCushionLines', () => {
  let nextId = 100;
  const build = (c: { materialId: string }) => line(nextId++, 'vatTuPhuKien', c.materialId);

  it('tick loại nệm mới: thêm 1 dòng Phụ kiện trống, giữ nguyên các dòng khác', () => {
    const lines = [line(1, 'daySon', '5', '2'), line(2, 'baoBiDongGoi', '8', '1')];

    const result = syncTickedCushionLines(lines, [], [cushion('90'), cushion('91')], build);

    expect(result.map((l) => `${l.group}:${l.materialId}:${l.soLuong}`)).toEqual([
      'daySon:5:2',
      'baoBiDongGoi:8:1',
      'vatTuPhuKien:90:',
      'vatTuPhuKien:91:',
    ]);
  });

  it('không thêm trùng khi đã có dòng Phụ kiện của loại nệm đó (giữ số lượng đã nhập)', () => {
    const lines = [line(1, 'vatTuPhuKien', '90', '3')];

    const result = syncTickedCushionLines(lines, [], [cushion('90')], build);

    expect(result).toHaveLength(1);
    expect(result[0].soLuong).toBe('3');
  });

  it('bỏ tick: xoá dòng Phụ kiện của loại đó, không đụng Sơn/Bao bì dù trùng materialId', () => {
    const lines = [line(1, 'vatTuPhuKien', '90', '3'), line(2, 'vatTuPhuKien', '91', '1'), line(3, 'baoBiDongGoi', '90', '1')];

    const result = syncTickedCushionLines(lines, [cushion('90'), cushion('91')], [cushion('91')], build);

    expect(result.map((l) => l.id)).toEqual([2, 3]);
  });
});

describe('tickedCushionsWithoutQty / dropBlankTickedCushionLines / countCushionLinesWithQty', () => {
  const lines = [
    line(1, 'vatTuPhuKien', '90', '3'), // có số lượng
    line(2, 'vatTuPhuKien', '91', ''), // trống
    line(3, 'vatTuPhuKien', '99', ''), // không tick - dòng phụ kiện thường
    line(4, 'baoBiDongGoi', '91', ''), // khác nhóm dù trùng id
  ];

  it('liệt kê loại nệm đã tick mà chưa có số lượng > 0', () => {
    expect(tickedCushionsWithoutQty(lines, [cushion('90'), cushion('91'), cushion('92')])).toEqual(['NEM-91', 'NEM-92']);
  });

  it('chỉ bỏ dòng nệm đã tick còn trống, giữ phụ kiện thường và dòng nhóm khác', () => {
    const result = dropBlankTickedCushionLines(lines, new Set(['90', '91']));

    expect(result.map((l) => l.id)).toEqual([1, 3, 4]);
  });

  it('đếm dòng nệm sắp mất có số lượng khi bỏ tick', () => {
    expect(countCushionLinesWithQty(lines, ['90', '91'])).toBe(1);
  });
});
