'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ClipboardList, Edit3, Calendar, CheckSquare, Award } from 'lucide-react';
import styles from './MobileNav.module.css';

const navItems = [
  { href: '/',         icon: <Home size={20} />, label: 'Beranda' },
  { href: '/ckp',      icon: <Edit3 size={20} />, label: 'CKP' },
  { href: '/skp',      icon: <ClipboardList size={20} />, label: 'SKP' },
  { href: '/evaluasi', icon: <Award size={20} />, label: 'Evaluasi' },
  { href: '/schedule', icon: <Calendar size={20} />, label: 'Jadwal' },
];

export default function MobileNav() {
  const pathname = usePathname();

  const isActive = (href) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <nav className={styles.mobileNav}>
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`${styles.navItem} ${isActive(item.href) ? styles.navItemActive : ''}`}
        >
          <span className={styles.navIcon}>{item.icon}</span>
          <span className={styles.navLabel}>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
