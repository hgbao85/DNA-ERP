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
  const tables = (a.tables ?? []).map(t => [t.title, t.intro ?? '', t.columns.join(' '), t.rows.flat().join(' '), t.note ?? ''].join(' ')).join(' ');
  const highlight = a.highlight ? `${a.highlight.label} ${a.highlight.text} ${a.highlight.note ?? ''}` : '';
  return [a.title, a.purpose, highlight, tables, steps, a.result, warns, errs, statuses, (a.tags ?? []).join(' ')].join(' ');
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

/** Tách chuỗi (đã bỏ dấu) thành các từ - mọi ký tự không phải chữ/số đều là dấu ngăn. */
function wordsOf(normalized: string): string[] {
  return normalized.split(/[^a-z0-9]+/).filter(Boolean);
}

/** Từ khoá khớp 1 từ trong danh sách: đúng nguyên từ, hoặc là phần đầu của từ khi đã gõ ≥ 4 ký tự
 * (đang gõ dở "chuy" vẫn ra "chuyền"). KHÔNG khớp chuỗi con tuỳ ý: trước đây "han" (hạn) khớp cả
 * "hang" (hàng/khách hàng) nên gần như truy vấn nào cũng ra đủ mọi bài. */
function wordHit(words: Set<string>, list: string[], term: string): boolean {
  if (words.has(term)) return true;
  return term.length >= 4 && list.some(w => w.startsWith(term));
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let n = 0;
  for (let at = haystack.indexOf(needle); at !== -1; at = haystack.indexOf(needle, at + needle.length)) n++;
  return n;
}

interface IndexedArticle {
  title: string; tags: string; body: string;
  titleList: string[]; tagList: string[]; bodyList: string[];
  titleWords: Set<string>; tagWords: Set<string>; bodyWords: Set<string>;
  /** Bản CÒN DẤU (chỉ hạ chữ thường) - để ưu tiên kết quả khớp đúng dấu khi người dùng gõ có dấu. */
  accentedTitle: string; accentedBody: string;
}

// Nội dung là dữ liệu tĩnh nên chỉ cần lập chỉ mục 1 lần cho mỗi bài, không lặp lại mỗi phím gõ.
const INDEX = new WeakMap<GuideArticle, IndexedArticle>();
function indexOf(article: GuideArticle): IndexedArticle {
  const hit = INDEX.get(article);
  if (hit) return hit;
  const rawBody = articleText(article);
  const title = normalize(article.title);
  const tags = normalize((article.tags ?? []).join(' '));
  const body = normalize(rawBody);
  const titleList = wordsOf(title);
  const tagList = wordsOf(tags);
  const bodyList = [...new Set(wordsOf(body))];
  const entry: IndexedArticle = {
    title, tags, body, titleList, tagList, bodyList,
    titleWords: new Set(titleList), tagWords: new Set(tagList), bodyWords: new Set(bodyList),
    accentedTitle: article.title.normalize('NFC').toLowerCase(), accentedBody: rawBody.normalize('NFC').toLowerCase(),
  };
  INDEX.set(article, entry);
  return entry;
}

/**
 * Tìm kiếm client-side trên nội dung đã bỏ dấu (gõ không dấu vẫn ra).
 *
 * Quy tắc (viết lại 2026-10-12 - bản cũ khớp chuỗi con nên "han giao" ra 69/69 bài):
 *  - Khớp theo TỪ, không theo chuỗi con (xem wordHit); tiêu đề/tag chịu được lỗi gõ nhẹ.
 *  - Bài phải khớp MỌI từ khoá. Chỉ khi không bài nào khớp đủ mới nới về "khớp ít nhất 1 từ", để
 *    người dùng vẫn có gì đó để bấm thay vì màn trắng.
 *  - Điểm: tiêu đề > tag > nội dung; cộng thêm khi cả CỤM từ khoá đứng liền nhau (đếm số lần xuất
 *    hiện trong bài, có trần) và khi khớp đúng cả dấu tiếng Việt người dùng đã gõ.
 */
export function searchArticles(groups: GuideGroup[], query: string): SearchHit[] {
  const q = normalize(query.trim());
  if (!q) return [];
  const terms = wordsOf(q);
  if (terms.length === 0) return [];
  const phrase = terms.join(' ');
  const accentedQuery = query.trim().normalize('NFC').toLowerCase().replace(/\s+/g, ' ');
  const hasAccent = normalize(accentedQuery) !== accentedQuery;

  const all: (SearchHit & { matched: number })[] = [];
  for (const group of groups) {
    for (const article of group.articles) {
      const ix = indexOf(article);
      let score = 0;
      let matched = 0;
      for (const t of terms) {
        let termScore = 0;
        if (wordHit(ix.titleWords, ix.titleList, t)) termScore += 5;
        else if (fuzzyMatchWords(ix.titleList, t)) termScore += 3;

        if (wordHit(ix.tagWords, ix.tagList, t)) termScore += 3;
        else if (fuzzyMatchWords(ix.tagList, t)) termScore += 1.5;

        if (wordHit(ix.bodyWords, ix.bodyList, t)) termScore += 1;
        if (termScore > 0) matched++;
        score += termScore;
      }
      if (matched === 0) continue;

      if (terms.length > 1) {
        // Khoảng trắng 2 đầu để "han giao" không khớp giữa chừng "…khach hang giao…".
        if (` ${ix.title} `.includes(` ${phrase} `)) score += 8;
        // Tiêu đề MỞ ĐẦU bằng cụm đó = bài nói thẳng về nó ("Đóng gói (đếm thùng)"), xếp trên bài chỉ
        // nhắc tới ở cuối tiêu đề ("… → Chuyền kiểm → Đóng gói").
        if (ix.titleList.slice(0, terms.length).join(' ') === phrase) score += 3;
        if (` ${ix.tags} `.includes(` ${phrase} `)) score += 5;
        score += Math.min(countOccurrences(ix.body, phrase), 6) * 1.5;
      }
      if (hasAccent) {
        if (ix.accentedTitle.includes(accentedQuery)) score += 4;
        score += Math.min(countOccurrences(ix.accentedBody, accentedQuery), 4);
      }
      all.push({ group, article, score, matched });
    }
  }
  const full = all.filter(h => h.matched === terms.length);
  return (full.length > 0 ? full : all)
    .sort((a, b) => b.score - a.score)
    .map(({ group, article, score }) => ({ group, article, score }));
}
