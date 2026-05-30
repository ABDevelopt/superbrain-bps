'use client';

import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import styles from './AppShell.module.css';
import { useAuth } from '@/contexts/AuthContext';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import LoadingScreen from './LoadingScreen';
import AIChatbot from './AIChatbot';

export default function AppShell({ children }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const isPublicPage = pathname === '/login' || pathname === '/privacy' || pathname === '/terms';

  useEffect(() => {
    if (!loading && !user && !isPublicPage) {
      router.push('/login');
    }
  }, [user, loading, isPublicPage, router]);

  if (loading) {
    return <LoadingScreen />;
  }

  // If on a public page (login, privacy, terms), render content directly without app shell
  if (isPublicPage) {
    return <>{children}</>;
  }

  // If not authenticated and not on public page, render nothing while redirecting
  if (!user) {
    return null;
  }

  return (
    <div className={styles.shell}>
      <Sidebar isOpen={isSidebarOpen} onToggle={() => setIsSidebarOpen(!isSidebarOpen)} />
      <main className={`${styles.main} ${!isSidebarOpen ? styles.mainCollapsed : ''}`}>
        {children}
      </main>
      <MobileNav />
      <AIChatbot />
    </div>
  );
}
