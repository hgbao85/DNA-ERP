import { describe, expect, it } from 'vitest';
import type { ManhChildGroup } from '../types/sku';
import {
  countRowsWithQty,
  dropBlankTickedWireRows,
  isWovenCandidate,
  missingTickedWires,
  syncTickedWireRows,
  tickedWiresWithoutQty,
} from './wireOptions';

interface Row { id: number; group: ManhChildGroup; materialId: string; soLuong: string }
interface Piece { id: number; children: Row[] }

const wire = (materialId: string, materialCode = `SHT${materialId}`) => ({ materialId, materialCode });
const row = (id: number, group: ManhChildGroup, materialId: string, soLuong = ''): Row => ({ id, group, materialId, soLuong });

// Mảnh "Tựa" đã có Đinh (đan được), mảnh "Chân" chỉ có Sắt (không đan).
const tua = (): Piece => ({ id: 1, children: [row(10, 'sat', '1', '2'), row(11, 'dinh', '70', '4')] });
const chan = (): Piece => ({ id: 2, children: [row(20, 'sat', '1', '2')] });

describe('isWovenCandidate', () => {
  it('có Dây hoặc Đinh thì là mảnh có thể đan, mảnh chỉ có Sắt thì không', () => {
    expect(isWovenCandidate(tua().children)).toBe(true);
    expect(isWovenCandidate([row(1, 'day', '60')])).toBe(true);
    expect(isWovenCandidate(chan().children)).toBe(false);
  });
});

describe('syncTickedWireRows', () => {
  let nextId = 100;
  const build = (w: { materialId: string }) => row(nextId++, 'day', w.materialId);

  it('tick loại dây mới: chỉ thêm dòng trống vào mảnh có thể đan, mảnh Sắt thuần giữ nguyên', () => {
    const manhs = [tua(), chan()];

    const result = syncTickedWireRows(manhs, [], [wire('60'), wire('61')], build);

    expect(result[0].children.filter((c) => c.group === 'day').map((c) => [c.materialId, c.soLuong])).toEqual([
      ['60', ''],
      ['61', ''],
    ]);
    expect(result[1]).toBe(manhs[1]); // không đổi -> cùng tham chiếu
  });

  it('không thêm trùng khi mảnh đã có dòng của loại dây đó (kể cả đã nhập số lượng)', () => {
    const piece: Piece = { id: 1, children: [row(11, 'dinh', '70', '4'), row(12, 'day', '60', '3')] };

    const result = syncTickedWireRows([piece], [], [wire('60'), wire('61')], build);

    const days = result[0].children.filter((c) => c.group === 'day');
    expect(days.map((c) => c.materialId)).toEqual(['60', '61']);
    expect(days[0].soLuong).toBe('3'); // dòng cũ giữ nguyên số lượng
  });

  it('bỏ tick: xoá dòng dây của loại đó ở mọi mảnh, không đụng đinh/sắt/dây loại khác', () => {
    const piece: Piece = {
      id: 1,
      children: [row(10, 'sat', '1', '2'), row(11, 'dinh', '70', '4'), row(12, 'day', '60', '3'), row(13, 'day', '61', '5')],
    };

    const result = syncTickedWireRows([piece], [wire('60'), wire('61')], [wire('61')], build);

    expect(result[0].children.map((c) => `${c.group}:${c.materialId}`)).toEqual(['sat:1', 'dinh:70', 'day:61']);
  });

  it('không có thay đổi tick thì trả về đúng các mảnh cũ', () => {
    const manhs = [tua()];

    const result = syncTickedWireRows(manhs, [wire('60')], [wire('60')], build);

    expect(result[0]).toBe(manhs[0]);
  });
});

describe('missingTickedWires', () => {
  it('liệt kê loại dây đã tick mà mảnh chưa có (cho nút "Thêm dây đã tick")', () => {
    const piece: Piece = { id: 1, children: [row(12, 'day', '60', '3')] };

    expect(missingTickedWires(piece, [wire('60'), wire('61')]).map((w) => w.materialId)).toEqual(['61']);
  });

  it('dòng dây của loại khác nhóm (vd trùng id với Đinh) không tính là đã có', () => {
    const piece: Piece = { id: 1, children: [row(12, 'dinh', '60', '3')] };

    expect(missingTickedWires(piece, [wire('60')]).map((w) => w.materialId)).toEqual(['60']);
  });
});

describe('tickedWiresWithoutQty', () => {
  it('loại dây chỉ có dòng trống (hoặc 0) ở mọi mảnh bị liệt kê; loại có số lượng > 0 ở ít nhất 1 mảnh thì không', () => {
    const manhs: Piece[] = [
      { id: 1, children: [row(1, 'day', '60', '3'), row(2, 'day', '61', '')] },
      { id: 2, children: [row(3, 'day', '61', '0'), row(4, 'day', '62', '')] },
    ];

    expect(tickedWiresWithoutQty(manhs, [wire('60'), wire('61'), wire('62')])).toEqual(['SHT61', 'SHT62']);
  });

  it('không tick loại nào thì không có gì để chặn', () => {
    expect(tickedWiresWithoutQty([tua()], [])).toEqual([]);
  });
});

describe('dropBlankTickedWireRows', () => {
  it('bỏ dòng dây đã tick chưa có số lượng, giữ dòng có số lượng và mọi dòng khác (kể cả dây không tick)', () => {
    const piece: Piece = {
      id: 1,
      children: [
        row(1, 'sat', '1', '2'),
        row(2, 'day', '60', '3'), // đã tick, có số lượng -> giữ
        row(3, 'day', '61', ''), // đã tick, trống -> bỏ
        row(4, 'day', '99', ''), // KHÔNG tick (dây cũ luôn tính) -> giữ nguyên, để BE tự xử lý
        row(5, 'dinh', '60', ''), // khác nhóm dù trùng id -> giữ
      ],
    };

    const [result] = dropBlankTickedWireRows([piece], new Set(['60', '61']));

    expect(result.children.map((c) => c.id)).toEqual([1, 2, 4, 5]);
  });

  it('mảnh không có gì để bỏ giữ nguyên tham chiếu', () => {
    const piece = tua();

    expect(dropBlankTickedWireRows([piece], new Set(['60']))[0]).toBe(piece);
  });
});

describe('countRowsWithQty', () => {
  it('đếm dòng dây của các loại sắp bỏ tick mà đã nhập số lượng', () => {
    const manhs: Piece[] = [
      { id: 1, children: [row(1, 'day', '60', '3'), row(2, 'day', '61', '')] },
      { id: 2, children: [row(3, 'day', '60', '5'), row(4, 'day', '62', '9')] },
    ];

    expect(countRowsWithQty(manhs, ['60', '61'])).toBe(2);
  });
});
