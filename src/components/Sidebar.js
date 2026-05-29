'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ClipboardList, Map as MapIcon, Edit3, Calendar, BrainCircuit, LogOut, PanelLeftClose, PanelLeftOpen, Settings, CheckSquare } from 'lucide-react';
import styles from './Sidebar.module.css';
import { useAuth } from '@/contexts/AuthContext';
import ConfirmDialog from './ConfirmDialog';
import { useState } from 'react';

const navItems = [
  { href: '/',         icon: <Home size={20} />, label: 'Dashboard' },
  { href: '/tasks',    icon: <CheckSquare size={20} />, label: 'Papan Tugas' },
  { href: '/schedule', icon: <Calendar size={20} />, label: 'Jadwal & Agenda' },
  { href: '/ckp',      icon: <Edit3 size={20} />, label: 'CKP Harian' },
  { href: '/skp',      icon: <ClipboardList size={20} />, label: 'Manajemen SKP' },
  { href: '/mapping',  icon: <MapIcon size={20} />, label: 'Pemetaan Kerja' },
  { href: '/settings', icon: <Settings size={20} />, label: 'Pengaturan' },
];

export default function Sidebar({ isOpen = true, onToggle }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const isActive = (href) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <aside className={`${styles.sidebar} ${!isOpen ? styles.sidebarCollapsed : ''}`}>
      {/* Brand */}
      <div className={styles.brand}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span className={styles.brandIcon}><BrainCircuit size={28} color="#6366f1" /></span>
          <div className={styles.brandText}>
            <span className={styles.brandTitle}>Arkulaza Brain</span>
            <span className={styles.brandSub}>Second Brain</span>
          </div>
        </div>
        <button onClick={onToggle} className={styles.toggleBtn} title={isOpen ? "Tutup Sidebar" : "Buka Sidebar"}>
          {isOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
        </button>
      </div>

      {/* User Profile */}
      <div className={styles.userSection}>
        <div className={styles.userAvatar}>
          {user?.photoURL ? (
            <img src={user.photoURL} alt="Avatar" style={{width: '100%', height: '100%', borderRadius: '50%'}} />
          ) : (
            'YA'
          )}
        </div>
        <div className={styles.userInfo}>
          <div className={styles.userName}>{user?.displayName || 'Yahya Abdurrohman'}</div>
          <div className={styles.userUnit}>BPS Kab. Penajam Paser Utara</div>
        </div>
      </div>

      {/* Navigation */}
      <div className={styles.navLabel}>Menu</div>
      <nav className={styles.nav}>
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`${styles.navItem} ${isActive(item.href) ? styles.navItemActive : ''}`}
          >
            <span className={styles.navIcon}>{item.icon}</span>
            <span className={styles.navText}>{item.label}</span>
          </Link>
        ))}
      </nav>

      {/* Footer */}
      <div className={styles.sidebarFooter}>
        <button className={styles.logoutBtn} onClick={() => setShowLogoutConfirm(true)} title="Logout">
          <LogOut size={18} /> <span>Logout</span>
        </button>
      </div>

      <ConfirmDialog 
        isOpen={showLogoutConfirm} 
        onConfirm={() => {
          setShowLogoutConfirm(false);
          logout();
        }} 
        onCancel={() => setShowLogoutConfirm(false)} 
        title="Konfirmasi Keluar" 
        message="Apakah Anda yakin ingin keluar dari sesi ini?" 
        confirmText="Ya, Keluar" 
        variant="danger" 
      />
    </aside>
  );
}
