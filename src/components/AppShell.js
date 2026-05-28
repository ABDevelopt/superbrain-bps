'use client';

import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import styles from './AppShell.module.css';
import { useAuth } from '@/contexts/AuthContext';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import LoadingScreen from './LoadingScreen';

export default function AppShell({ children }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const isLoginPage = pathname === '/login';

  useEffect(() => {
    if (!loading && !user && !isLoginPage) {
      router.push('/login');
    }
  }, [user, loading, isLoginPage, router]);

  if (loading) {
    return <LoadingScreen />;
  }

  // If on login page and not authenticated, just render children without shell
  if (isLoginPage) {
    return <>{children}</>;
  }

  // If not authenticated and not on login page, render nothing while redirecting
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
    </div>
  );
}
