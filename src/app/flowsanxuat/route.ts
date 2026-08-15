import { serveDocPage } from '../_lib/serveDocPage';

export const dynamic = 'force-dynamic';

export async function GET() {
  return serveDocPage('quy-trinh-2026-08-15-hanh-trinh-don-hang.html');
}
