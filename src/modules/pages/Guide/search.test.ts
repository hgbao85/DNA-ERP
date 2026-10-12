import { describe, expect, it } from 'vitest';
import { GUIDE_GROUPS } from './content';
import { searchArticles } from './search';
import { materialsGroup } from './content/materials';

// 2026-10-12: bản cũ khớp chuỗi con sau khi bỏ dấu ("han" khớp cả "hàng") nên gần như truy vấn nào
// cũng ra đủ mọi bài và bài đúng không đứng đầu. Test chạy trên NỘI DUNG THẬT của guide.
const total = GUIDE_GROUPS.reduce((n, g) => n + g.articles.length, 0);
const ids = (q: string) => searchArticles(GUIDE_GROUPS, q).map((h) => h.article.id);

describe('searchArticles (nội dung guide thật)', () => {
  it('"han giao" không còn ra mọi bài, và bài Tạo đơn hàng đứng đầu', () => {
    const r = ids('han giao');
    expect(r.length).toBeLessThan(total / 2);
    expect(r[0]).toBe('sales-tao-po');
  });

  it('gõ có dấu cho cùng kết quả đầu', () => {
    expect(ids('hạn giao')[0]).toBe('sales-tao-po');
  });

  it.each([
    ['tinh phuong an cat', 'pp-gom-dot-cat'],
    ['chuyen kiem', 'wh-chuyen-kiem'],
    ['thong bao', 'journey-notifications'],
    ['van phong pham', 'wh-van-phong-pham'],
    ['dong goi', 'wh-dong-goi'],
  ])('"%s" -> %s đứng trong 2 kết quả đầu', (q, id) => {
    expect(ids(q).slice(0, 2)).toContain(id);
  });

  it('chịu lỗi gõ nhẹ ở tiêu đề và gõ dở từ (≥ 4 ký tự)', () => {
    expect(ids('chuyen kiêm').slice(0, 2)).toContain('wh-chuyen-kiem');
    expect(ids('chuyenn kiem').slice(0, 3)).toContain('wh-chuyen-kiem');
    expect(ids('chuy kiem').slice(0, 3)).toContain('wh-chuyen-kiem');
  });

  it('phải khớp MỌI từ khoá khi có bài khớp đủ; không bài nào khớp đủ thì nới về khớp 1 từ', () => {
    const both = ids('xuat dan');
    expect(both.length).toBeGreaterThan(0);
    expect(both.length).toBeLessThan(ids('xuat').length);
    expect(ids('xuat zzzkhongco').length).toBeGreaterThan(0);
  });

  it('/guide công khai không chứa bài của Admin hay Quản lý vật tư (2 vai trò có hướng dẫn riêng)', () => {
    const all = GUIDE_GROUPS.flatMap((g) => g.articles.map((a) => a.id));
    expect(all.filter((id) => id.startsWith('admin-'))).toEqual([]);
    expect(GUIDE_GROUPS.map((g) => g.id)).not.toContain('admin');
    expect(GUIDE_GROUPS.map((g) => g.id)).not.toContain('materials');
    expect(ids('tao tai khoan').some((id) => id.startsWith('admin-'))).toBe(false);
  });

  it('có bài chứa nguyên cụm từ khoá thì bỏ bài chỉ có các từ rời rạc (kể cả khi cụm nằm trong ngoặc kép)', () => {
    const ids = (q: string) => searchArticles([materialsGroup], q).map(h => h.article.id);
    const tonDau = ids('tồn kho ban đầu');
    expect(tonDau[0]).toBe('vt-them-vat-tu');
    expect(tonDau).toContain('vt-sua-xoa'); // nhắc tới ô "Tồn kho ban đầu" trong ngoặc kép
    expect(tonDau).not.toContain('vt-don-vi-mua');
    const lamTron = ids('làm tròn');
    expect(lamTron[0]).toBe('vt-hao-hut');
    expect(lamTron.length).toBeLessThan(materialsGroup.articles.length);
  });

  it('rỗng hoặc không khớp gì thì trả mảng rỗng', () => {
    expect(ids('   ')).toEqual([]);
    expect(ids('zzzkhongco')).toEqual([]);
  });
});
