'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ClipboardList, Edit3, Calendar, CheckSquare } from 'lucide-react';
import styles from './MobileNav.module.css';

const navItems = [
  { href: '/',         icon: <Home size={19} />, label: 'Beranda' },
  { href: '/schedule', icon: <Calendar size={19} />, label: 'Jadwal' },
  { href: '/ckp',      icon: <Edit3 size={20} />, label: 'CKP', isCenter: true },
  { href: '/skp',      icon: <ClipboardList size={19} />, label: 'SKP' },
  { href: '/tasks',    icon: <CheckSquare size={19} />, label: 'Papan' },
];

export default function MobileNav() {
  const pathname = usePathname();

  const isActive = (href) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <nav className={styles.mobileNav}>
      {navItems.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`${styles.navItem} ${item.isCenter ? styles.navItemCenter : ''} ${active ? styles.navItemActive : ''}`}
          >
            <span className={item.isCenter ? styles.centerIconWrap : styles.navIcon}>
              {item.icon}
            </span>
            <span className={styles.navLabel}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
