'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Link2, ExternalLink, Copy, Check, Trash2, Edit3, 
  Search, Plus, TrendingUp, BarChart2, Calendar, 
  MousePointerClick, ArrowRight, Loader2, Sparkles
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { 
  collection, query, where, onSnapshot, getDocs,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp 
} from 'firebase/firestore';
import ConfirmDialog from '@/components/ConfirmDialog';
import styles from './page.module.css';

export default function ShortLinksPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // Data States
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form States (Create)
  const [longUrl, setLongUrl] = useState('');
  const [slug, setSlug] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form States (Edit)
  const [editingLink, setEditingLink] = useState(null);
  const [editUrl, setEditUrl] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Filter & UI States
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  // Get base URL for short link creation
  const [baseShortUrl, setBaseShortUrl] = useState('http://localhost:3000/s/');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setBaseShortUrl(`${window.location.origin}/s/`);
    }
  }, []);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // Read Short Links in Realtime
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'short_links'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const linksData = [];
      snapshot.forEach((doc) => {
        linksData.push({ id: doc.id, ...doc.data() });
      });
      // Sort by createdAt descending
      linksData.sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });
      setLinks(linksData);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching short links:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Statistics
  const stats = useMemo(() => {
    const totalLinks = links.length;
    const totalClicks = links.reduce((sum, item) => sum + (item.clicks || 0), 0);
    const popularLink = links.length > 0 
      ? [...links].sort((a, b) => (b.clicks || 0) - (a.clicks || 0))[0] 
      : null;

    return { totalLinks, totalClicks, popularLink };
  }, [links]);

  // Filtered links based on search
  const filteredLinks = useMemo(() => {
    return links.filter(link => 
      link.slug.toLowerCase().includes(search.toLowerCase()) ||
      link.longUrl.toLowerCase().includes(search.toLowerCase())
    );
  }, [links, search]);

  // Copy to clipboard handler
  const handleCopy = (id, slugText) => {
    const fullUrl = `${baseShortUrl}${slugText}`;
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  // Create Short Link
  const handleCreate = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!longUrl) return;

    // Basic URL validation
    let formattedUrl = longUrl.trim();
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = 'https://' + formattedUrl;
    }

    setIsSubmitting(true);

    try {
      let finalSlug = slug.trim().toLowerCase();

      // If slug is empty, generate an 6-character alphanumeric slug
      if (!finalSlug) {
        let unique = false;
        let attempts = 0;
        while (!unique && attempts < 10) {
          const rand = Math.random().toString(36).substring(2, 8);
          // Check uniqueness in local state first for speed
          const exists = links.some(l => l.slug === rand);
          if (!exists) {
            finalSlug = rand;
            unique = true;
          }
          attempts++;
        }
      } else {
        // Validate custom slug format
        if (!/^[a-z0-9-_]+$/i.test(finalSlug)) {
          throw new Error('Slug hanya boleh menggunakan huruf, angka, tanda hubung (-) dan garis bawah (_).');
        }
        // Check uniqueness in database (across all users)
        const checkQuery = query(collection(db, 'short_links'), where('slug', '==', finalSlug));
        const checkSnap = await getDocs(checkQuery);
        if (!checkSnap.empty) {
          throw new Error('Slug ini sudah digunakan. Silakan gunakan slug lain.');
        }
      }

      // Save to firestore
      await addDoc(collection(db, 'short_links'), {
        slug: finalSlug,
        longUrl: formattedUrl,
        clicks: 0,
        userId: user.uid,
        createdAt: serverTimestamp()
      });

      setLongUrl('');
      setSlug('');
      setSuccessMsg(`Tautan singkat /s/${finalSlug} berhasil dibuat!`);
      setTimeout(() => setSuccessMsg(''), 5000);

    } catch (err) {
      setErrorMsg(err.message || 'Gagal membuat tautan singkat.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Edit Link URL
  const handleEditInit = (link) => {
    setEditingLink(link);
    setEditUrl(link.longUrl);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editingLink || !editUrl) return;

    let formattedUrl = editUrl.trim();
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = 'https://' + formattedUrl;
    }

    setIsUpdating(true);
    try {
      await updateDoc(doc(db, 'short_links', editingLink.id), {
        longUrl: formattedUrl
      });
      setEditingLink(null);
      setEditUrl('');
    } catch (err) {
      console.error('Error updating short link:', err);
      alert('Gagal memperbarui tautan asli.');
    } finally {
      setIsUpdating(false);
    }
  };

  // Delete Link
  const handleDelete = async () => {
    if (!deletingId) return;

    try {
      await deleteDoc(doc(db, 'short_links', deletingId));
      setDeletingId(null);
    } catch (err) {
      console.error('Error deleting short link:', err);
      alert('Gagal menghapus tautan singkat.');
    }
  };

  if (authLoading || loading) {
    return (
      <div className={styles.loadingContainer}>
        <Loader2 className={styles.spinner} size={36} />
        <p>Memuat pengelola tautan...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>🔗 Ringkas Link Bukti Dukung</h1>
          <p className={styles.subtitle}>Buat tautan singkat untuk menyederhanakan file bukti dukung kegiatan BPS Anda</p>
        </div>
      </header>

      {/* Metrics Row */}
      <div className={styles.metricsRow}>
        <div className={styles.metricCard}>
          <div className={styles.metricIcon} style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>
            <Link2 size={22} />
          </div>
          <div className={styles.metricContent}>
            <span className={styles.metricLabel}>Total Link Singkat</span>
            <span className={styles.metricValue}>{stats.totalLinks}</span>
          </div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricIcon} style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
            <MousePointerClick size={22} />
          </div>
          <div className={styles.metricContent}>
            <span className={styles.metricLabel}>Total Klik Diarahkan</span>
            <span className={styles.metricValue}>{stats.totalClicks}</span>
          </div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricIcon} style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
            <TrendingUp size={22} />
          </div>
          <div className={styles.metricContent}>
            <span className={styles.metricLabel}>Tautan Terpopuler</span>
            <span className={styles.metricValue} style={{ fontSize: '15px', color: '#fbbf24' }}>
              {stats.popularLink ? `/s/${stats.popularLink.slug} (${stats.popularLink.clicks} klik)` : 'Belum ada'}
            </span>
          </div>
        </div>
      </div>

      <div className={styles.mainGrid}>
        {/* Shortener Box */}
        <div className={styles.shortenerCard}>
          <h3>✨ Buat Tautan Baru</h3>
          <p className={styles.cardDesc}>Tulis URL panjang bukti dukung Anda dan tentukan slug kustom yang mudah diingat.</p>

          <form onSubmit={handleCreate} className={styles.form}>
            <div className={styles.formGroup}>
              <label>URL Panjang (Tujuan)</label>
              <input 
                type="text" 
                placeholder="https://drive.google.com/drive/folders/..." 
                value={longUrl} 
                onChange={(e) => setLongUrl(e.target.value)}
                className="input-base"
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label>Slug Kustom (Opsional)</label>
              <div className={styles.slugInputWrapper}>
                <span className={styles.slugPrefix}>{baseShortUrl.replace('http://', '').replace('https://', '')}</span>
                <input 
                  type="text" 
                  placeholder="bukti-sbr" 
                  value={slug} 
                  onChange={(e) => setSlug(e.target.value)}
                  className="input-base"
                  style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
                />
              </div>
              <span className={styles.helpText}>Gunakan huruf kecil, angka, atau tanda hubung. Kosongkan untuk slug acak.</span>
            </div>

            {errorMsg && <div className={styles.errorAlert}>{errorMsg}</div>}
            {successMsg && <div className={styles.successAlert}>{successMsg}</div>}

            <button type="submit" disabled={isSubmitting} className="btn btn-primary" style={{ width: '100%', marginTop: '8px' }}>
              {isSubmitting ? (
                <>
                  <Loader2 className={styles.btnSpinner} size={16} /> Menyimpan...
                </>
              ) : (
                <>
                  <Sparkles size={16} /> Perpendek Link
                </>
              )}
            </button>
          </form>
        </div>

        {/* Links List */}
        <div className={styles.listCard}>
          <div className={styles.listHeader}>
            <h3>📋 Daftar Link Singkat Anda</h3>
            <div className={styles.searchWrapper}>
              <Search size={16} className={styles.searchIcon} />
              <input 
                type="text" 
                placeholder="Cari slug atau url asli..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-base"
                style={{ paddingLeft: '36px', height: '36px', minWidth: '240px' }}
              />
            </div>
          </div>

          {filteredLinks.length === 0 ? (
            <div className={styles.emptyState}>
              <Link2 size={36} style={{ opacity: 0.3, marginBottom: '8px' }} />
              <p>{search ? 'Tidak ada tautan yang cocok dengan pencarian Anda.' : 'Belum ada tautan singkat yang dibuat.'}</p>
            </div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Tautan Singkat</th>
                    <th>Tautan Asli</th>
                    <th style={{ width: '90px', textAlign: 'center' }}>Klik</th>
                    <th style={{ width: '120px' }}>Dibuat</th>
                    <th style={{ width: '100px', textAlign: 'right' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLinks.map((link) => (
                    <tr key={link.id}>
                      <td>
                        <div className={styles.shortLinkCell}>
                          <a href={`/s/${link.slug}`} target="_blank" rel="noopener noreferrer" className={styles.shortUrlText}>
                            /s/{link.slug} <ExternalLink size={12} style={{ opacity: 0.6 }} />
                          </a>
                          <button 
                            className={styles.copyBtn} 
                            onClick={() => handleCopy(link.id, link.slug)}
                            title="Salin ke clipboard"
                          >
                            {copiedId === link.id ? (
                              <Check size={14} style={{ color: '#34d399' }} />
                            ) : (
                              <Copy size={14} />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className={styles.longUrlCell}>
                        <div className={styles.longUrlText} title={link.longUrl}>
                          {link.longUrl}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={styles.clicksCount}>
                          <MousePointerClick size={12} style={{ opacity: 0.6 }} /> {link.clicks || 0}
                        </span>
                      </td>
                      <td style={{ fontSize: '12px', color: '#94a3b8' }}>
                        {link.createdAt ? new Date(link.createdAt.seconds * 1000).toLocaleDateString('id-ID') : '-'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className={styles.actionCell}>
                          <button 
                            className={styles.editBtn} 
                            onClick={() => handleEditInit(link)}
                            title="Edit URL Tujuan"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button 
                            className={styles.deleteBtn} 
                            onClick={() => setDeletingId(link.id)}
                            title="Hapus Link"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editingLink && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h3>✏️ Edit URL Tujuan (/s/{editingLink.slug})</h3>
            <p className={styles.modalDesc}>Perbarui tautan asli tujuan tanpa mengubah URL singkat /s/{editingLink.slug}.</p>
            
            <form onSubmit={handleUpdate}>
              <div className={styles.formGroup} style={{ marginBottom: '20px' }}>
                <label>URL Panjang Baru</label>
                <input 
                  type="text" 
                  value={editUrl}
                  onChange={(e) => setEditUrl(e.target.value)}
                  className="input-base"
                  required
                  autoFocus
                />
              </div>

              <div className={styles.modalActions}>
                <button 
                  type="button" 
                  onClick={() => { setEditingLink(null); setEditUrl(''); }} 
                  className="btn btn-secondary"
                  disabled={isUpdating}
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={isUpdating}
                >
                  {isUpdating ? 'Menyimpan...' : 'Perbarui'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog 
        isOpen={!!deletingId}
        title="Hapus Tautan Singkat"
        message="Apakah Anda yakin ingin menghapus tautan singkat ini? Pengguna yang mengakses URL singkat ini tidak akan lagi diarahkan ke tautan asli."
        confirmText="Ya, Hapus"
        cancelText="Batal"
        onConfirm={handleDelete}
        onCancel={() => setDeletingId(null)}
        variant="danger"
      />
    </div>
  );
}
