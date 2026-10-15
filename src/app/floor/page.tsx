import type { Metadata, Viewport } from 'next';
import FloorScanApp from '../../modules/pages/Floor/FloorScanApp';

export const metadata: Metadata = { title: 'Báo sản lượng — DNA-ERP' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

/** Màn quét QR tại máy (2026-10-13) - xem FloorScanApp. Link trên tem: /floor?ws=<qrToken>. */
export default function FloorPage() {
  return <FloorScanApp />;
}
