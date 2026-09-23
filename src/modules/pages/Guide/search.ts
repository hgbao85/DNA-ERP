import type { GuideArticle, GuideGroup } from './types';

export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

function articleText(a: GuideArticle): string {
  const steps = a.steps.map(s => (typeof s === 'string' ? s : s.text)).join(' ');
  const errs = (a.commonErrors ?? []).map(e => `${e.issue} ${e.cause} ${e.fix}`).join(' ');
  const warns = (a.warnings ?? []).join(' ');
  const statuses = (a.statuses ?? []).map(s => `${s.name} ${s.meaning}`).join(' ');
  return [a.title, a.purpose, steps, a.result, warns, errs, statuses, (a.tags ?? []).join(' ')].join(' ');
}

export interface SearchHit {
  group: GuideGroup;
  article: GuideArticle;
  score: number;
}

/** Khoảng cách Levenshtein (số ký tự thêm/xoá/sửa để biến a thành b) — dùng để chấp nhận gõ
 * gần đúng, vd "chuyen kiêm" vẫn khớp "chuyền kiểm". DP 1 hàng, đủ nhanh cho vài chục bài viết. */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j - 1], prev[j], cur[j - 1]);
    }
    prev = cur;
  }
  return prev[b.length];
}

/** Sai lệch tối đa chấp nhận được theo độ dài từ khoá — từ càng ngắn càng khắt khe, tránh
 * "ho" (2 ký tự) khớp bừa với hàng loạt từ không liên quan. */
function typoTolerance(len: number): number {
  if (len <= 3) return 0;
  if (len <= 6) return 1;
  return 2;
}

/** true nếu có ít nhất 1 từ trong `words` gõ gần đúng với `term` (trong sai số typoTolerance). */
function fuzzyMatchWords(words: string[], term: string): boolean {
  const tol = typoTolerance(term.length);
  if (tol === 0) return false;
  return words.some(w => Math.abs(w.length - term.length) <= tol && levenshtein(w, term) <= tol);
}

/** Tìm kiếm client-side: khớp theo từ khoá đã bỏ dấu, ưu tiên tiêu đề/tag; nếu 1 từ khoá không
 * khớp chính xác thì thử khớp gần đúng (chịu lỗi gõ) trên tiêu đề/tag — KHÔNG áp dụng fuzzy cho
 * toàn bộ nội dung bài (body) vì quá dài, dễ khớp nhiễu và tốn chi phí không cần thiết. */
export function searchArticles(groups: GuideGroup[], query: string): SearchHit[] {
  const q = normalize(query.trim());
  if (!q) return [];
  const terms = q.split(/\s+/).filter(Boolean);

  const hits: SearchHit[] = [];
  for (const group of groups) {
    for (const article of group.articles) {
      const title = normalize(article.title);
      const tags = normalize((article.tags ?? []).join(' '));
      const body = normalize(articleText(article));
      const titleWords = title.split(/\s+/);
      const tagWords = tags.split(/\s+/).filter(Boolean);

      let score = 0;
      for (const t of terms) {
        if (title.includes(t)) score += 5;
        else if (fuzzyMatchWords(titleWords, t)) score += 3;

        if (tags.includes(t)) score += 3;
        else if (fuzzyMatchWords(tagWords, t)) score += 1.5;

        if (body.includes(t)) score += 1;
      }
      if (score > 0) hits.push({ group, article, score });
    }
  }
  return hits.sort((a, b) => b.score - a.score);
}
