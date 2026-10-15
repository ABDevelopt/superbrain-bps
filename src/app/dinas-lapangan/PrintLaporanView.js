'use client';

import React, { useState } from 'react';
import { Printer, ArrowLeft, Download, FileText, CheckCircle2, Image as ImageIcon } from 'lucide-react';
import styles from './page.module.css';

// SVG BPS Logo (Crisp & High-Res for Print)
function BPSLogo({ size = 48 }) {
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

export default function PrintLaporanView({ trip, onBack, userProfile }) {
  // 'bps_word' (Exact match to sample docx) | 'formal_sk' (With kop & signatures)
  const [formatMode, setFormatMode] = useState('bps_word');
  const [includePhotos, setIncludePhotos] = useState(true);
  const [showKop, setShowKop] = useState(true);
  const [penandatanganType, setPenandatanganType] = useState('kepala'); // 'kepala' | 'ppk' | 'atasan'

  const handlePrint = () => {
    window.print();
  };

  if (!trip) {
    return (
      <div className={styles.printContainer}>
        <p>Data perjalanan dinas tidak ditemukan.</p>
        <button onClick={onBack} className={styles.secondaryBtn}>Kembali</button>
      </div>
    );
  }

  const laporan = trip.laporan || {};
  const pelaksanaList = trip.pelaksana && trip.pelaksana.length > 0 ? trip.pelaksana : [
    {
      nama: userProfile?.displayName || 'Yahya Abdurrohman, S.Tr.Stat.',
      nip: userProfile?.nip || '-',
      jabatan: userProfile?.jabatan || 'Statistisi Ahli Pertama',
      pangkatGol: userProfile?.pangkatGol || 'Penata Muda (III/a)',
      peran: 'Utama'
    }
  ];

  const primaryPelaksana = pelaksanaList[0];
  const photos = trip.dokumentasi || [];

  // Parse timeline activities: either from trip.laporan.jadwalKegiatan array or parse narrative text
  const timelineSlots = (laporan.jadwalKegiatan && laporan.jadwalKegiatan.length > 0)
    ? laporan.jadwalKegiatan
    : (() => {
        // Fallback: parse from hasilKegiatan text if it contains HH.MM - HH.MM lines
        if (!laporan.hasilKegiatan) return [];
        const lines = laporan.hasilKegiatan.split('\n');
        const slots = [];
        let currSlot = null;
        const timeRegex = /^(\d{2}[.:]\d{2}\s*[-–—]\s*\d{2}[.:]\d{2})\s*(.*)$/;

        lines.forEach(line => {
          const match = line.match(timeRegex);
          if (match) {
            if (currSlot) slots.push(currSlot);
            currSlot = {
              waktu: match[1].replace(':', '.'),
              uraian: match[2].trim()
            };
          } else if (currSlot) {
            currSlot.uraian += '\n' + line;
          } else {
            // General text before any time marker
            currSlot = {
              waktu: 'Kegiatan',
              uraian: line
            };
          }
        });
        if (currSlot) slots.push(currSlot);
        return slots.length > 0 ? slots : [
          { waktu: '08.00 – 16.00', uraian: laporan.hasilKegiatan }
        ];
      })();

  const destinationText = laporan.tujuan || trip.daerahTujuan || 'Wilayah Penugasan';
  const personName = laporan.namaPetugas || primaryPelaksana.nama;
  const assignmentDate = trip.tanggalMulai === trip.tanggalSelesai 
    ? formatDateIndo(trip.tanggalMulai)
    : `${formatDateIndo(trip.tanggalMulai)} s.d. ${formatDateIndo(trip.tanggalSelesai)}`;
  const assignmentSubject = laporan.perihal || trip.maksudTujuan || 'Pelaksanaan Tugas Lapangan BPS';

  // Function to export as Microsoft Word .doc
  const handleExportWord = () => {
    const cleanTujuan = (trip.daerahTujuan || 'Laporan').replace(/[^a-zA-Z0-9]/g, '_');
    const cleanTanggal = (trip.tanggalMulai || '').replace(/[^a-zA-Z0-9]/g, '_');

    let docHtml = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>Laporan Perjalanan Dinas - ${destinationText}</title>
        <style>
          @page {
            size: 21.0cm 29.7cm;
            margin: 2.0cm 2.0cm 2.0cm 2.0cm;
            mso-page-orientation: portrait;
          }
          body {
            font-family: Arial, 'Times New Roman', sans-serif;
            font-size: 11pt;
            line-height: 1.4;
            color: #000000;
          }
          .title {
            text-align: center;
            font-size: 13pt;
            font-weight: bold;
            margin-bottom: 16pt;
            letter-spacing: 0.5px;
            text-transform: uppercase;
          }
          table.main-table {
            width: 100%;
            border-collapse: collapse;
            border: 1.5px solid #000000;
            margin-bottom: 20pt;
          }
          table.main-table td, table.main-table th {
            border: 1px solid #000000;
            padding: 5pt 7pt;
            vertical-align: top;
          }
          .time-col {
            width: 110pt;
            font-weight: bold;
            white-space: nowrap;
          }
          .desc-col {
            text-align: justify;
          }
          .sub-bullets {
            margin: 2pt 0 2pt 14pt;
            text-indent: -14pt;
          }
          .doc-title {
            font-size: 12pt;
            font-weight: bold;
            text-align: center;
            margin-top: 24pt;
            margin-bottom: 12pt;
            text-transform: uppercase;
          }
          .photo-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10pt;
          }
          .photo-table td {
            border: 1px solid #000000;
            padding: 6pt;
            vertical-align: top;
            text-align: center;
            width: 50%;
          }
          .photo-caption {
            font-size: 9.5pt;
            font-weight: bold;
            margin-top: 6pt;
          }
        </style>
      </head>
      <body>
        <div class="title">LAPORAN PERJALANAN DINAS</div>
        <table class="main-table">
          <tr>
            <td style="width: 55%;"><strong>Tujuan</strong> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: ${destinationText}</td>
            <td style="width: 45%;"><strong>Nama</strong> &nbsp;: ${personName}</td>
          </tr>
          <tr>
            <td colspan="2"><strong>Tanggal Tugas</strong> &nbsp;: ${assignmentDate}</td>
          </tr>
          <tr>
            <td colspan="2"><strong>Perihal</strong> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: ${assignmentSubject}</td>
          </tr>
          <tr>
            <td colspan="2" style="font-weight: bold; background-color: #f8fafc;">Laporan Kegiatan</td>
          </tr>
          ${timelineSlots.map(slot => `
            <tr>
              <td class="time-col">${slot.waktu}</td>
              <td class="desc-col">${(slot.uraian || '').replace(/\n/g, '<br/>')}</td>
            </tr>
          `).join('')}
        </table>
    `;

    if (includePhotos && photos.length > 0) {
      docHtml += `
        <div class="doc-title">DOKUMENTASI KEGIATAN</div>
        <table class="photo-table">
      `;
      for (let i = 0; i < photos.length; i += 2) {
        docHtml += '<tr>';
        const p1 = photos[i];
        const p2 = photos[i + 1];
        docHtml += `
          <td>
            <img src="${p1.url}" style="max-width: 100%; max-height: 240px; object-fit: contain;" alt="${p1.caption || 'Dokumentasi'}" />
            <div class="photo-caption">${p1.caption || 'Dokumentasi pelaksanaan kegiatan lapangan.'}</div>
          </td>
        `;
        if (p2) {
          docHtml += `
            <td>
              <img src="${p2.url}" style="max-width: 100%; max-height: 240px; object-fit: contain;" alt="${p2.caption || 'Dokumentasi'}" />
              <div class="photo-caption">${p2.caption || 'Dokumentasi pelaksanaan kegiatan lapangan.'}</div>
            </td>
          `;
        } else {
          docHtml += '<td></td>';
        }
        docHtml += '</tr>';
      }
      docHtml += '</table>';
    }

    docHtml += '</body></html>';

    const blob = new Blob(['\ufeff', docHtml], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Laporan_Perjalanan_Dinas_${cleanTujuan}_${cleanTanggal}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.printWrapper}>
      {/* Top Non-Printed Control Bar */}
      <div className={styles.noPrintToolbar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={onBack} className={styles.secondaryBtn}>
            <ArrowLeft size={16} /> Kembali ke Menu DL
          </button>
          <span style={{ fontSize: '13px', color: '#94a3b8' }}>
            Pratinjau: <strong>{destinationText} ({assignmentDate})</strong>
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Format Mode Switcher */}
          <select 
            value={formatMode} 
            onChange={(e) => setFormatMode(e.target.value)}
            className={styles.printSelect}
            title="Pilih Format Tata Letak Laporan"
          >
            <option value="bps_word">Format Standar BPS Lapangan (Sesuai Word Asli)</option>
            <option value="formal_sk">Format Resmi SK (Kop BPS & Pengesahan)</option>
          </select>

          {/* Additional Options */}
          {formatMode === 'bps_word' ? (
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#cbd5e1', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={includePhotos} 
                onChange={(e) => setIncludePhotos(e.target.checked)} 
              />
              Sertakan Dokumentasi Foto
            </label>
          ) : (
            <>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#cbd5e1', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={showKop} 
                  onChange={(e) => setShowKop(e.target.checked)} 
                />
                Kop Surat
              </label>

              <select 
                value={penandatanganType} 
                onChange={(e) => setPenandatanganType(e.target.value)}
                className={styles.printSelect}
              >
                <option value="kepala">Mengetahui: Kepala BPS</option>
                <option value="ppk">Mengetahui: PPK</option>
                <option value="atasan">Mengetahui: Atasan Langsung</option>
              </select>
            </>
          )}

          {/* Word Download */}
          <button 
            onClick={handleExportWord} 
            className={styles.secondaryBtn}
            style={{ color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.4)' }}
            title="Unduh dokumen langsung dalam format Microsoft Word (.doc)"
          >
            <Download size={15} /> Unduh Word (.doc)
          </button>

          {/* Native Print / PDF */}
          <button onClick={handlePrint} className={styles.primaryBtn}>
            <Printer size={16} /> Cetak / Simpan PDF
          </button>
        </div>
      </div>

      {/* ========================================================
          MODE 1: FORMAT STANDAR BPS LAPANGAN (EXACT MATCH TO DOCX)
          ======================================================== */}
      {formatMode === 'bps_word' ? (
        <div className={styles.a4Sheet}>
          <div className={styles.bpsWordContainer}>
            {/* Header Title */}
            <h1 className={styles.bpsWordTitle}>LAPORAN PERJALANAN DINAS</h1>

            {/* Core Boxed Table */}
            <table className={styles.bpsWordTable}>
              <tbody>
                {/* Row 1: Tujuan & Nama */}
                <tr>
                  <td style={{ width: '55%' }}>
                    <span className={styles.bpsWordMetaLabel}>Tujuan</span>
                    <span>: {destinationText}</span>
                  </td>
                  <td style={{ width: '45%' }}>
                    <span style={{ width: '70px', display: 'inline-block', fontWeight: 500 }}>Nama</span>
                    <span>: {personName}</span>
                  </td>
                </tr>

                {/* Row 2: Tanggal Tugas */}
                <tr>
                  <td colSpan={2}>
                    <span className={styles.bpsWordMetaLabel}>Tanggal Tugas</span>
                    <span>: {assignmentDate}</span>
                  </td>
                </tr>

                {/* Row 3: Perihal */}
                <tr>
                  <td colSpan={2}>
                    <span className={styles.bpsWordMetaLabel}>Perihal</span>
                    <span>: {assignmentSubject}</span>
                  </td>
                </tr>

                {/* Row 4: Laporan Kegiatan Header */}
                <tr>
                  <td colSpan={2} className={styles.bpsWordSectionHeader}>
                    Laporan Kegiatan
                  </td>
                </tr>

                {/* Row 5+: Chronological Timeline Slots */}
                {timelineSlots.map((slot, sIdx) => (
                  <tr key={sIdx}>
                    <td className={styles.bpsWordTimeCol}>
                      {slot.waktu}
                    </td>
                    <td className={styles.bpsWordDescCol}>
                      <div className={styles.bpsWordDescText}>
                        {slot.uraian}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Dokumentasi Kegiatan (Directly included if checked) */}
            {includePhotos && photos.length > 0 && (
              <div style={{ marginTop: '24px', pageBreakInside: 'avoid' }}>
                <h2 className={styles.bpsWordDocTitle}>DOKUMENTASI KEGIATAN</h2>
                <div className={styles.bpsWordPhotoGrid}>
                  {photos.map((item, pIdx) => (
                    <div key={item.id || pIdx} className={styles.bpsWordPhotoItem}>
                      <div className={styles.bpsWordPhotoFrame}>
                        {item.url ? (
                          <img 
                            src={item.url} 
                            alt={item.caption || `Dokumentasi #${pIdx + 1}`} 
                            className={styles.bpsWordPhotoImg} 
                          />
                        ) : (
                          <div style={{ color: '#94a3b8', fontSize: '11px', textAlign: 'center' }}>
                            <ImageIcon size={24} style={{ margin: '0 auto 4px' }} />
                            <span>Gambar</span>
                          </div>
                        )}
                      </div>
                      <div className={styles.bpsWordPhotoCaption}>
                        {item.caption || `Dokumentasi kegiatan di ${destinationText}`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ========================================================
            MODE 2: FORMAT RESMI FORMAL (KOP SURAT & TANDA TANGAN)
            ======================================================== */
        <div className={styles.a4Sheet}>
          {showKop && (
            <div className={styles.officialHeader}>
              <BPSLogo size={58} />
              <div className={styles.officialHeaderText}>
                <h2 className={styles.headerLine1}>BADAN PUSAT STATISTIK</h2>
                <h3 className={styles.headerLine2}>KABUPATEN PENAJAM PASER UTARA</h3>
                <p className={styles.headerLine3}>Jl. Propinsi Km. 9 Kelurahan Nipah-Nipah, Kecamatan Penajam, Kab. Penajam Paser Utara, 76141</p>
                <p className={styles.headerLine4}>Laman: penajampaserutarakab.bps.go.id | Pos-el: bps6409@bps.go.id</p>
              </div>
            </div>
          )}

          <div className={styles.reportTitleSection}>
            <h1 className={styles.reportMainTitle}>LAPORAN PERJALANAN DINAS</h1>
            <div className={styles.reportSubtitle}>Nomor Surat Tugas: {trip.nomorSuratTugas || '-'}</div>
          </div>

          <div className={styles.reportBody}>
            <div className={styles.sectionBlock}>
              <h4 className={styles.sectionHeader}>I. DASAR PENUGASAN</h4>
              <table className={styles.kvTable}>
                <tbody>
                  <tr>
                    <td className={styles.kvKey}>1. Surat Tugas</td>
                    <td className={styles.kvSep}>:</td>
                    <td className={styles.kvVal}>Nomor {trip.nomorSuratTugas || '-'}</td>
                  </tr>
                  <tr>
                    <td className={styles.kvKey}>2. Tanggal Surat Tugas</td>
                    <td className={styles.kvSep}>:</td>
                    <td className={styles.kvVal}>{formatDateIndo(trip.tanggalSuratTugas)}</td>
                  </tr>
                  <tr>
                    <td className={styles.kvKey}>3. Pejabat Pemberi Tugas</td>
                    <td className={styles.kvSep}>:</td>
                    <td className={styles.kvVal}>{trip.pejabatPemberiTugas || 'Kepala BPS Kabupaten Penajam Paser Utara'}</td>
                  </tr>
                  {trip.bebanAnggaran && (
                    <tr>
                      <td className={styles.kvKey}>4. Beban Anggaran</td>
                      <td className={styles.kvSep}>:</td>
                      <td className={styles.kvVal}>{trip.bebanAnggaran}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className={styles.sectionBlock}>
              <h4 className={styles.sectionHeader}>II. MAKSUD DAN TUJUAN</h4>
              <p className={styles.sectionText}>
                {trip.maksudTujuan || 'Pelaksanaan tugas kedinasan / survei lapangan BPS.'}
              </p>
            </div>

            <div className={styles.sectionBlock}>
              <h4 className={styles.sectionHeader}>III. WAKTU DAN DAERAH TUJUAN</h4>
              <table className={styles.kvTable}>
                <tbody>
                  <tr>
                    <td className={styles.kvKey}>1. Waktu Pelaksanaan</td>
                    <td className={styles.kvSep}>:</td>
                    <td className={styles.kvVal}>{assignmentDate} ({trip.lamaHari || 1} hari)</td>
                  </tr>
                  <tr>
                    <td className={styles.kvKey}>2. Daerah / Lokasi Tujuan</td>
                    <td className={styles.kvSep}>:</td>
                    <td className={styles.kvVal}>
                      <strong>{destinationText}</strong>
                      {trip.lokasiSpesifik ? ` (${trip.lokasiSpesifik})` : ''}
                    </td>
                  </tr>
                  {trip.kendaraan && (
                    <tr>
                      <td className={styles.kvKey}>3. Moda Transportasi</td>
                      <td className={styles.kvSep}>:</td>
                      <td className={styles.kvVal}>{trip.kendaraan}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className={styles.sectionBlock}>
              <h4 className={styles.sectionHeader}>IV. PETUGAS PELAKSANA</h4>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th style={{ width: '40px', textAlign: 'center' }}>No</th>
                    <th>Nama / NIP</th>
                    <th>Pangkat / Gol.</th>
                    <th>Jabatan</th>
                    <th>Peran</th>
                  </tr>
                </thead>
                <tbody>
                  {pelaksanaList.map((p, idx) => (
                    <tr key={idx}>
                      <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                      <td>
                        <strong>{p.nama}</strong>
                        <br />
                        <span style={{ fontSize: '11px', color: '#475569' }}>NIP. {p.nip || '-'}</span>
                      </td>
                      <td>{p.pangkatGol || '-'}</td>
                      <td>{p.jabatan || 'Pegawai BPS'}</td>
                      <td>{p.peran || (idx === 0 ? 'Utama' : 'Pendamping')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={styles.sectionBlock}>
              <h4 className={styles.sectionHeader}>V. HASIL PELAKSANAAN KEGIATAN</h4>
              {timelineSlots.length > 0 ? (
                <table className={styles.dataTable} style={{ marginTop: '8px' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '130px' }}>Waktu Pelaksanaan</th>
                      <th>Rincian & Hasil Kegiatan Lapangan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timelineSlots.map((slot, sIdx) => (
                      <tr key={sIdx}>
                        <td style={{ fontWeight: 'bold', verticalAlign: 'top' }}>{slot.waktu}</td>
                        <td style={{ verticalAlign: 'top', whiteSpace: 'pre-wrap' }}>{slot.uraian}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className={styles.longContentText}>
                  {(laporan.hasilKegiatan || 'Belum ada uraian hasil pelaksanaan.').split('\n').map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              )}
            </div>

            {(laporan.kendalaMasalah || laporan.solusiTindakLanjut) && (
              <div className={styles.sectionBlock}>
                <h4 className={styles.sectionHeader}>VI. PERMASALAHAN DAN SARAN TINDAK LANJUT</h4>
                {laporan.kendalaMasalah && (
                  <div style={{ marginBottom: '8px' }}>
                    <strong>A. Permasalahan / Kendala:</strong>
                    <p style={{ margin: '4px 0 0 0' }}>{laporan.kendalaMasalah}</p>
                  </div>
                )}
                {laporan.solusiTindakLanjut && (
                  <div>
                    <strong>B. Saran & Tindak Lanjut:</strong>
                    <p style={{ margin: '4px 0 0 0' }}>{laporan.solusiTindakLanjut}</p>
                  </div>
                )}
              </div>
            )}

            <div className={styles.sectionBlock}>
              <h4 className={styles.sectionHeader}>
                {(laporan.kendalaMasalah || laporan.solusiTindakLanjut) ? 'VII. PENUTUP' : 'VI. PENUTUP'}
              </h4>
              <p className={styles.sectionText}>
                {laporan.kesimpulan || 'Demikian laporan hasil pelaksanaan perjalanan dinas ini dibuat dengan sebenar-benarnya untuk dipergunakan sebagaimana mestinya.'}
              </p>
            </div>
          </div>

          <div className={styles.signatureSection}>
            <div className={styles.sigColumn}>
              <p className={styles.sigTitle}>Mengetahui,</p>
              <p className={styles.sigRole}>
                {penandatanganType === 'ppk'
                  ? 'Pejabat Pembuat Komitmen'
                  : penandatanganType === 'atasan'
                    ? 'Atasan Langsung'
                    : (trip.pejabatPemberiTugas || 'Kepala BPS Kabupaten Penajam Paser Utara')}
              </p>
              <div className={styles.sigSpace} />
              <p className={styles.sigName}>
                <u>{trip.namaPejabat || '(Nama Pejabat / Kepala Satker)'}</u>
              </p>
              <p className={styles.sigNip}>NIP. {trip.nipPejabat || '................................'}</p>
            </div>

            <div className={styles.sigColumn}>
              <p className={styles.sigTitle}>
                {laporan.tempatLaporan || 'Penajam'}, {formatDateIndo(laporan.tanggalLaporan || trip.tanggalSelesai)}
              </p>
              <p className={styles.sigRole}>Pelaksana Tugas,</p>
              <div className={styles.sigSpace} />
              <p className={styles.sigName}>
                <u>{personName}</u>
              </p>
              <p className={styles.sigNip}>NIP. {primaryPelaksana.nip}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
