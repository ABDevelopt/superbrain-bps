'use client';

import React, { useState } from 'react';
import { Printer, ArrowLeft, LayoutGrid, Image as ImageIcon, MapPin, Calendar, Clock } from 'lucide-react';
import styles from './page.module.css';

// SVG BPS Logo
function BPSLogo({ size = 44 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <path d="M50 8 L82 32 L50 48 L18 32 Z" fill="#0284C7" />
      <path d="M14 38 L46 54 L30 88 L6 62 Z" fill="#10B981" />
      <path d="M54 54 L86 38 L94 62 L70 88 Z" fill="#F97316" />
      <circle cx="50" cy="46" r="6" fill="#FFFFFF" opacity="0.9" />
    </svg>
  );
}

function formatDateIndo(dateStr) {
  if (!dateStr) return '-';
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    return `${d} ${months[m - 1]} ${y}`;
  } catch (e) {
    return dateStr;
  }
}

export default function PrintDokumentasiView({ trip, onBack, userProfile }) {
  // '2_per_page' or '4_per_page'
  const [layoutMode, setLayoutMode] = useState('2_per_page');

  const handlePrint = () => {
    window.print();
  };

  if (!trip) {
    return (
      <div className={styles.printContainer}>
        <p>Data perjalanan dinas tidak ditemukan.</p>
        <button onClick={onBack} className={styles.backBtn}>Kembali</button>
      </div>
    );
  }

  const photos = trip.dokumentasi || [];
  const itemsPerPage = layoutMode === '2_per_page' ? 2 : 4;
  
  // Group photos into pages for clean A4 printing
  const pages = [];
  for (let i = 0; i < photos.length; i += itemsPerPage) {
    pages.push(photos.slice(i, i + itemsPerPage));
  }

  const primaryPelaksana = (trip.pelaksana && trip.pelaksana[0]) || {
    nama: userProfile?.displayName || 'Pegawai Pelaksana',
    nip: userProfile?.nip || '-'
  };

  return (
    <div className={styles.printWrapper}>
      {/* Non-printed Toolbar */}
      <div className={styles.noPrintToolbar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={onBack} className={styles.secondaryBtn}>
            <ArrowLeft size={16} /> Kembali ke Menu DL
          </button>
          <span style={{ fontSize: '13px', color: '#94a3b8' }}>
            Pratinjau Dokumentasi: <strong>{photos.length} Foto Tersedia</strong>
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: '#cbd5e1' }}>Tata Letak:</span>
            <select
              value={layoutMode}
              onChange={(e) => setLayoutMode(e.target.value)}
              className={styles.printSelect}
            >
              <option value="2_per_page">2 Foto / Lembar (Besar & Jelas)</option>
              <option value="4_per_page">4 Foto / Lembar (Grid 2x2 Hemat Kertas)</option>
            </select>
          </div>

          <button 
            onClick={() => {
              const cleanTujuan = (trip.daerahTujuan || 'Dokumentasi').replace(/[^a-zA-Z0-9]/g, '_');
              let docHtml = `
                <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
                <head>
                  <meta charset='utf-8'>
                  <title>Dokumentasi Kegiatan</title>
                  <style>
                    body { font-family: Arial, sans-serif; font-size: 11pt; text-align: center; }
                    .doc-title { font-size: 13pt; font-weight: bold; margin-bottom: 16pt; text-transform: uppercase; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10pt; }
                    td { border: 1px solid #000; padding: 6pt; text-align: center; vertical-align: top; width: 50%; }
                    .caption { font-size: 9.5pt; font-weight: bold; margin-top: 6pt; }
                  </style>
                </head>
                <body>
                  <div class="doc-title">DOKUMENTASI KEGIATAN</div>
                  <div style="font-size: 10pt; margin-bottom: 14pt;">${trip.maksudTujuan || ''} - ${trip.daerahTujuan || ''} (${formatDateIndo(trip.tanggalMulai)})</div>
                  <table>
              `;
              for (let i = 0; i < photos.length; i += 2) {
                docHtml += '<tr>';
                const p1 = photos[i];
                const p2 = photos[i + 1];
                docHtml += `
                  <td>
                    <img src="${p1.url}" style="max-width: 100%; max-height: 260px;" alt="${p1.caption || 'Foto'}" />
                    <div class="caption">${p1.caption || 'Dokumentasi lapangan'}</div>
                  </td>
                `;
                if (p2) {
                  docHtml += `
                    <td>
                      <img src="${p2.url}" style="max-width: 100%; max-height: 260px;" alt="${p2.caption || 'Foto'}" />
                      <div class="caption">${p2.caption || 'Dokumentasi lapangan'}</div>
                    </td>
                  `;
                } else {
                  docHtml += '<td></td>';
                }
                docHtml += '</tr>';
              }
              docHtml += '</table></body></html>';

              const blob = new Blob(['\ufeff', docHtml], { type: 'application/msword;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = `Dokumentasi_${cleanTujuan}.doc`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(url);
            }} 
            className={styles.secondaryBtn}
            style={{ color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.4)' }}
            title="Unduh Lembar Dokumentasi dalam format Microsoft Word (.doc)"
          >
            Unduh Word (.doc)
          </button>

          <button onClick={handlePrint} className={styles.primaryBtn}>
            <Printer size={16} /> Cetak / Simpan PDF
          </button>
        </div>
      </div>

      {photos.length === 0 ? (
        <div className={styles.a4Sheet} style={{ minHeight: '300px', textAlign: 'center', padding: '40px' }}>
          <ImageIcon size={48} color="#94a3b8" style={{ margin: '0 auto 16px' }} />
          <h3>Belum Ada Foto Dokumentasi</h3>
          <p style={{ color: '#64748b', fontSize: '13px', maxWidth: '420px', margin: '8px auto 20px' }}>
            Silakan tambahkan foto dokumentasi lapangan pada tab "Laporan & Dokumentasi" terlebih dahulu sebelum mencetak.
          </p>
          <button onClick={onBack} className={styles.primaryBtn} style={{ margin: '0 auto' }}>
            Kembali & Tambah Foto
          </button>
        </div>
      ) : (
        pages.map((pagePhotos, pageIdx) => (
          <div key={pageIdx} className={`${styles.a4Sheet} ${pageIdx < pages.length - 1 ? styles.pageBreakAfter : ''}`}>
            {/* Header Lampiran */}
            <div className={styles.docHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <BPSLogo size={42} />
                <div>
                  <h3 className={styles.docHeaderSatker}>BADAN PUSAT STATISTIK KABUPATEN PENAJAM PASER UTARA</h3>
                  <h2 className={styles.docHeaderTitle}>LAMPIRAN DOKUMENTASI PELAKSANAAN KEGIATAN</h2>
                </div>
              </div>
              <div className={styles.docHeaderMeta}>
                <div><strong>Surat Tugas:</strong> {trip.nomorSuratTugas || '-'}</div>
                <div><strong>Tanggal:</strong> {formatDateIndo(trip.tanggalMulai)} {trip.tanggalMulai !== trip.tanggalSelesai ? `s.d. ${formatDateIndo(trip.tanggalSelesai)}` : ''}</div>
                <div><strong>Kegiatan:</strong> {trip.maksudTujuan || '-'}</div>
                <div><strong>Wilayah:</strong> {trip.daerahTujuan || '-'} {trip.lokasiSpesifik ? `(${trip.lokasiSpesifik})` : ''}</div>
              </div>
            </div>

            {/* Photo Grid */}
            <div className={layoutMode === '2_per_page' ? styles.photoGrid2 : styles.photoGrid4}>
              {pagePhotos.map((item, pIdx) => {
                const globalIndex = pageIdx * itemsPerPage + pIdx + 1;
                return (
                  <div key={item.id || pIdx} className={styles.photoItemCard}>
                    <div className={styles.photoFrame}>
                      {item.url ? (
                        <img 
                          src={item.url} 
                          alt={item.caption || `Dokumentasi ${globalIndex}`} 
                          className={styles.photoImg}
                        />
                      ) : (
                        <div className={styles.photoPlaceholder}>
                          <ImageIcon size={32} color="#94a3b8" />
                          <span>Gambar tidak tersedia</span>
                        </div>
                      )}
                      <span className={styles.photoNumberBadge}>Foto #{globalIndex}</span>
                    </div>

                    <div className={styles.photoCaptionBox}>
                      <p className={styles.photoCaptionText}>
                        <strong>Keterangan:</strong> {item.caption || 'Dokumentasi pelaksanaan penugasan di lapangan.'}
                      </p>
                      
                      <div className={styles.photoMetaRow}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Calendar size={11} color="#64748b" />
                          <span>{formatDateIndo(item.tanggal || trip.tanggalMulai)}</span>
                        </div>
                        {item.lokasi && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <MapPin size={11} color="#64748b" />
                            <span>{item.lokasi}</span>
                          </div>
                        )}
                        {(item.lat && item.lon) && (
                          <span style={{ fontSize: '10px', color: '#64748b', fontFamily: 'monospace' }}>
                            [{item.lat.toFixed(5)}, {item.lon.toFixed(5)}]
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Page Footer */}
            <div className={styles.docFooter}>
              <span>SuperBrain BPS — Halaman {pageIdx + 1} dari {pages.length}</span>
              <span>Pelaksana: {primaryPelaksana.nama} (NIP. {primaryPelaksana.nip})</span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
