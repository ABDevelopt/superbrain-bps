import fs from 'fs';
import { ckpOktoberEntries } from '../src/data/ckpOktober2026.js';

const updated = JSON.parse(JSON.stringify(ckpOktoberEntries));
updated.forEach(item => {
  if (item.id === 'ckp_20261029_1') {
    item.rincian = 'Pengembangan dan pengujian modul otomasi reallokasi penugasan wilayah SLS SE2026 pada sistem pengolahan BPS';
    item.satuan = 'Modul';
    item.kuantitas = 1;
    item.capaian = '1 Modul';
    item.buktiDukung = 'Bukti_41_Skrip_Reallokasi_Penugasan_SLS.py';
    item.buktiDukungKet = 'Skrip Python otomasi reallokasi wilayah khusus penugasan prelist SE2026 ke SLS resmi BPS PPU';
  }

  if (item.skpId === 1) {
    item.satuan = 'Modul';
    item.capaian = item.kuantitas + ' Modul';
    if (item.id === 'ckp_20261001_1') {
      item.rincian = 'Pengoptimalan modul sistem monitoring dan filter wilayah hierarkis 6-level FASIH-SM pada server VPS BPS';
    } else if (item.id === 'ckp_20261002_1') {
      item.rincian = 'Penyempurnaan modul visual drag-and-drop alokasi wilayah dan penugasan petugas sensus';
    } else if (item.id === 'ckp_20261006_1') {
      item.rincian = 'Penyiapan dan pengujian modul skrip harvester otomatisasi pengunduhan microdata sensus';
    }
  } else if (item.skpId === 2) {
    item.satuan = 'Dokumen';
    if (item.id === 'ckp_20261001_2') {
      item.kuantitas = 1;
      item.capaian = '1 Dokumen';
      item.rincian = 'Penyusunan dokumen algoritma standarisasi ejaan nama usaha dan nama kepala keluarga direktori SBR & SE2026';
    } else if (item.id === 'ckp_20261028_2') {
      item.kuantitas = 11282;
      item.satuan = 'Record';
      item.capaian = '11282 Record';
      item.rincian = '[Ekstraksi Data OSS & SBR] Otomasi ekstraksi data NIK dan NIB (Nomor Induk Berusaha) dari Website OSS sebanyak 11.282 record perizinan berusaha untuk pengayaan direktori SBR & SE2026 Kab. PPU';
    }
  } else if (item.skpId === 3) {
    item.satuan = 'Dokumen';
    item.capaian = item.kuantitas + ' Dokumen';
  } else if (item.skpId === 7) {
    item.satuan = 'Laporan';
    item.capaian = item.kuantitas + ' Laporan';
    if (item.id === 'ckp_20261009_2') {
      item.rincian = 'Penyusunan laporan dan pemeriksaan kelengkapan berkas administrasi dan kepegawaian CPNS BPS Kabupaten Penajam Paser Utara';
    }
  } else if (item.skpId === 10) {
    item.satuan = 'Laporan';
    item.capaian = item.kuantitas + ' Laporan';
  } else if (item.skpId === 11) {
    item.satuan = 'Kegiatan';
    item.capaian = item.kuantitas + ' Kegiatan';
    if (item.id === 'ckp_20261016_1') {
      item.rincian = 'Kegiatan penyusunan draf Laporan Perjalanan Dinas supervisi lapangan Bukit Raya & Giri Mukti';
    }
  } else if (item.skpId === 16) {
    item.satuan = 'Bahan Ajar';
    item.capaian = item.kuantitas + ' Bahan Ajar';
  } else if (item.skpId === 17) {
    item.satuan = 'Dokumen';
    item.capaian = item.kuantitas + ' Dokumen';
  } else if (item.skpId === 18) {
    item.satuan = 'Dokumen';
    item.capaian = item.kuantitas + ' Dokumen';
  } else if (item.skpId === 20) {
    item.satuan = 'Kegiatan';
    item.capaian = item.kuantitas + ' Kegiatan';
  } else if (item.skpId === 21) {
    item.satuan = 'Dokumen';
    item.capaian = item.kuantitas + ' Dokumen';
  } else if (item.skpId === 22) {
    item.satuan = 'Dokumen';
    item.capaian = item.kuantitas + ' Dokumen';
  }
});

const fileHeader = `/**
 * Data Rekapitulasi Capaian Kinerja Pegawai (CKP) Bulan Oktober 2026
 * Satuan Kerja: BPS Kabupaten Penajam Paser Utara (Kab. 6409)
 * Periode: 1 Oktober 2026 - 31 Oktober 2026
 * Standar Satuan Terpadu per SKP (PermenPAN-RB No. 6/2022 & Perpres No. 21/2023)
 *
 * FITUR SUBSTANTIF:
 * 1. Penyederhanaan CKP-T & CKP-R: Satuan seragam per SKP (Modul, Dokumen, Laporan, Kegiatan, Bahan Ajar)
 * 2. Pelatihan Petugas SPDT-NTP 2026 (7 & 8 Oktober 2026) dengan 4 Bahan Ajar resmi
 * 3. Penyusunan RKBMN TA 2028 (9 Oktober 2026) SKP Pengelolaan BMN
 * 4. Ekstraksi 11.282 Record NIK & NIB dari Website OSS RBA untuk SBR BPS
 * 5. Reallokasi Penugasan SLS SE2026 & Skrip Otomasi Python (29 Oktober 2026)
 * 6. Beban kerja harian fleksibel dan realistis (>= 450 menit / 7,5 jam per hari kerja)
 */

export const ckpOktoberEntries = `;

const fileContent = fileHeader + JSON.stringify(updated, null, 2) + ';\n\nexport const CKP_OKTOBER_2026 = ckpOktoberEntries;\nexport default ckpOktoberEntries;\n';

fs.writeFileSync('src/data/ckpOktober2026.js', fileContent, 'utf8');
console.log('Successfully updated src/data/ckpOktober2026.js with 44 standardized items.');
