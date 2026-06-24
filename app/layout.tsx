import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Demo · Định mức → Vật tư → Kho',
  description: 'Demo workflow định mức + duyệt + đối chiếu kho',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
