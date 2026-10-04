import './globals.css';
import AppShell from '@/components/AppShell';
import { ThemeProvider } from '@/contexts/ThemeContext';
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
    <html lang="id" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var savedMode = localStorage.getItem('superbrain_theme_mode');
                  var savedTheme = localStorage.getItem('superbrain_theme');
                  var theme = 'dark';
                  if (savedMode === 'light' || savedMode === 'dark') {
                    theme = savedMode;
                  } else if (savedTheme === 'light' || savedTheme === 'dark') {
                    theme = savedTheme;
                  } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
                    theme = 'light';
                  }
                  document.documentElement.setAttribute('data-theme', theme);
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body>
        <ThemeProvider>
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
          </ThemeProvider>
        </body>
      </html>
    );
}
