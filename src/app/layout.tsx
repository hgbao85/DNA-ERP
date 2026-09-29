import type { Metadata } from 'next';
import { AuthProvider } from '../context/AuthContext';
import { AuditLogProvider } from '../context/AuditLogContext';
import { InspectionProvider } from '../context/InspectionContext';
import { ThemeProvider, THEME_INIT_SCRIPT } from '../context/ThemeContext';
import { NotificationsProvider } from '../context/NotificationsContext';
import './globals.css';
import './theme-palette.css';

export const metadata: Metadata = {
  title: 'DNA-ERP — Đông Nam Á Corp',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // data-theme do script dưới đây đặt trước khi React hydrate nên lệch với HTML server — cố ý.
    <html lang="vi" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider>
          <AuthProvider>
            <AuditLogProvider>
              <NotificationsProvider>
                <InspectionProvider>{children}</InspectionProvider>
              </NotificationsProvider>
            </AuditLogProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
