import './globals.css';
import AppShell from '@/components/AppShell';
import { AuthProvider } from '@/contexts/AuthContext';
import { AlertProvider } from '@/contexts/AlertContext';
import { ChatActionProvider } from '@/contexts/ChatActionContext';
import { UndoRedoProvider } from '@/contexts/UndoRedoContext';
import { AIProvider } from '@/contexts/AIContext';

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#0a0e1a',
};

export const metadata = {
  title: 'Arkulaza Brain — Second Brain BPS',
  description: 'Aplikasi manajemen kerja dan produktivitas personal untuk pegawai BPS. Kelola SKP, CKP, pemetaan pekerjaan, dan jadwal dalam satu dashboard.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Arkulaza Brain',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>
        <AuthProvider>
          <UndoRedoProvider>
            <AlertProvider>
              <ChatActionProvider>
                <AIProvider>
                  <AppShell>{children}</AppShell>
                </AIProvider>
              </ChatActionProvider>
            </AlertProvider>
          </UndoRedoProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
