'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ClipboardList, Map as MapIcon, Edit3, Calendar, Settings } from 'lucide-react';
import styles from './MobileNav.module.css';

const navItems = [
  { href: '/',         icon: <Home size={20} />, label: 'Beranda' },
  { href: '/ckp',      icon: <Edit3 size={20} />, label: 'CKP' },
  { href: '/schedule', icon: <Calendar size={20} />, label: 'Jadwal' },
  { href: '/skp',      icon: <ClipboardList size={20} />, label: 'SKP' },
  { href: '/mapping',  icon: <MapIcon size={20} />, label: 'Mapping' },
  { href: '/settings', icon: <Settings size={20} />, label: 'Setelan' },
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
