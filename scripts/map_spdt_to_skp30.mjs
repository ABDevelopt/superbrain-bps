import fs from 'fs';
import { ckpOktoberEntries } from '../src/data/ckpOktober2026.js';

const spdtDates = ['2026-10-07', '2026-10-08', '2026-10-20', '2026-10-26', '2026-10-27'];
const updated = JSON.parse(JSON.stringify(ckpOktoberEntries));

let count = 0;
updated.forEach(item => {
  if (spdtDates.includes(item.tanggal)) {
    // 7 and 8 Okt (all items), 20, 26, 27 Okt (all items)
    item.skpId = 30;
    item.skpIds = [30];
    item.rkId = 30;
    item.rkNama = 'Terlaksananya Pelaksanaan Survei Penyusunan Diagram Timbang Nilai Tukar Petani (SPDT-NTP) Tahun 2026 sesuai SOP';
    item.ikiKuantitas = 'Tingkat kuantitas pelaksanaan survei penyusunan diagram timbang nilai tukar petani (spdt-ntp) tahun 2026 sesuai sop';
    item.ikiKualitas = 'Tingkat kualitas pelaksanaan survei penyusunan diagram timbang nilai tukar petani (spdt-ntp) tahun 2026 sesuai sop';
    item.satuan = 'Kegiatan';
    item.kuantitas = 1;
    item.capaian = '1 Kegiatan';
    item.timKerja = 'Tim Statistik Distribusi';
    count++;
  }
});

console.log('Updated', count, 'activities to SKP #30 (SPDT-NTP).');

const fileHeader = `/**
 * Data Rekapitulasi Capaian Kinerja Pegawai (CKP) Bulan Oktober 2026
 * Satuan Kerja: BPS Kabupaten Penajam Paser Utara (Kab. 6409)
 * Periode: 1 Oktober 2026 - 31 Oktober 2026
 * Standar Satuan Terpadu per SKP (PermenPAN-RB No. 6/2022 & Perpres No. 21/2023)
 *
 * FITUR SUBSTANTIF:
 * 1. Butir Khusus SKP #30: Survei Penyusunan Diagram Timbang Nilai Tukar Petani (SPDT-NTP) 2026 (10 Kegiatan)
 * 2. Pelatihan Petugas SPDT-NTP 2026 (7 & 8 Oktober 2026) dan Lapangan (20, 26, 27 Oktober 2026)
 * 3. Penyusunan RKBMN TA 2028 (9 Oktober 2026) SKP Pengelolaan BMN
 * 4. Ekstraksi 11.282 Record NIK & NIB dari Website OSS RBA untuk SBR BPS
 * 5. Pemeriksaan Peta Wilkerstat SLS PPU (29 Oktober 2026)
 * 6. Beban kerja harian fleksibel dan realistis (>= 450 menit / 7,5 jam per hari kerja)
 */

export const ckpOktoberEntries = `;

const fileContent = fileHeader + JSON.stringify(updated, null, 2) + ';\n\nexport const CKP_OKTOBER_2026 = ckpOktoberEntries;\nexport default ckpOktoberEntries;\n';

fs.writeFileSync('src/data/ckpOktober2026.js', fileContent, 'utf8');
console.log('Successfully written src/data/ckpOktober2026.js');
