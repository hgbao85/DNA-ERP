import { readFile } from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';

/**
 * Đọc trực tiếp 1 file HTML tự chứa (title + style + markup, không có thẻ html/head/body) từ
 * thư mục docs/ tại thời điểm request — docs/ là nguồn duy nhất, sửa file .html là thấy ngay,
 * không phải build/deploy lại hay đồng bộ 2 nơi.
 */
export async function serveDocPage(fileName: string): Promise<NextResponse> {
  const filePath = path.join(process.cwd(), 'docs', fileName);
  const fragment = await readFile(filePath, 'utf-8');
  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body>
${fragment}
</body>
</html>
`;
  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
