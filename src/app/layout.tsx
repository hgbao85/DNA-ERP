import type { Metadata } from 'next';
import { AuthProvider } from '../context/AuthContext';
import { AuditLogProvider } from '../context/AuditLogContext';
import { InspectionProvider } from '../context/InspectionContext';
import './globals.css';

export const metadata: Metadata = {
  title: 'DNA-ERP — Đông Nam Á Corp',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <AuthProvider>
          <AuditLogProvider>
            <InspectionProvider>{children}</InspectionProvider>
          </AuditLogProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
