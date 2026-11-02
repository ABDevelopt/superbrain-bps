import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { aggregateCkpBySkpAndSatuan, getEntrySkpIds } from '../src/utils/ckpAggregation.js';
import { ckpOktoberEntries } from '../src/data/ckpOktober2026.js';
import { skpData } from '../src/data/skpData.js';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const targetEmpName = 'Yahya Abdurrohman, S.Tr.Stat.';
const targetEmpNip = '200211062026031003';
const targetPejName = 'Suko Haryono, SST, M.Si';
const targetPejNip = '198405062008011006';
const sigDate = '31 Oktober 2026';
const periodStr = 'Oktober';
const yearVal = '2026';

function buildCkptHtml() {
  const { aggregated, utamaKeys, tambahanKeys } = aggregateCkpBySkpAndSatuan(ckpOktoberEntries, skpData);

  let sumTarget = 0;
  let rowsList = [];

  // UTAMA Section
  rowsList.push(`
    <tr style="font-weight: bold; background-color: #f3f4f6;">
      <td class="center" style="font-size: 8.5pt;"></td>
      <td style="text-align: left; padding-left: 6px; font-size: 8.5pt;">UTAMA</td>
      <td class="center" style="font-size: 8.5pt;"></td>
      <td class="center" style="font-size: 8.5pt;"></td>
      <td class="center" style="font-size: 8.5pt;"></td>
      <td class="center" style="font-size: 8.5pt;"></td>
      <td style="font-size: 8.5pt;"></td>
    </tr>
  `);

  utamaKeys.forEach((key, idx) => {
    const item = aggregated[key];
    sumTarget += item.kuantitas;
    rowsList.push(`
      <tr>
        <td class="center" style="font-size: 8.5pt;">${idx + 1}</td>
        <td style="font-size: 8.5pt; text-align: left;">${item.nama}</td>
        <td class="center" style="font-size: 8.5pt;">${item.satuan}</td>
        <td class="center" style="font-size: 8.5pt;">${item.kuantitas}</td>
        <td class="center" style="font-size: 8.5pt;"></td>
        <td class="center" style="font-size: 8.5pt;"></td>
        <td style="font-size: 8.5pt;"></td>
      </tr>
    `);
  });

  // TAMBAHAN Section
  rowsList.push(`
    <tr style="font-weight: bold; background-color: #f3f4f6;">
      <td class="center" style="font-size: 8.5pt;"></td>
      <td style="text-align: left; padding-left: 6px; font-size: 8.5pt;">TAMBAHAN</td>
      <td class="center" style="font-size: 8.5pt;"></td>
      <td class="center" style="font-size: 8.5pt;"></td>
      <td class="center" style="font-size: 8.5pt;"></td>
      <td class="center" style="font-size: 8.5pt;"></td>
      <td style="font-size: 8.5pt;"></td>
    </tr>
  `);

  if (tambahanKeys.length > 0) {
    tambahanKeys.forEach((key, idx) => {
      const item = aggregated[key];
      sumTarget += item.kuantitas;
      rowsList.push(`
        <tr>
          <td class="center" style="font-size: 8.5pt;">${idx + 1}</td>
          <td style="font-size: 8.5pt; text-align: left;">${item.nama}</td>
          <td class="center" style="font-size: 8.5pt;">${item.satuan}</td>
          <td class="center" style="font-size: 8.5pt;">${item.kuantitas}</td>
          <td class="center" style="font-size: 8.5pt;"></td>
          <td class="center" style="font-size: 8.5pt;"></td>
          <td style="font-size: 8.5pt;"></td>
        </tr>
      `);
    });
  } else {
    rowsList.push(`
      <tr>
        <td class="center" style="font-size: 8.5pt;">1</td>
        <td style="font-size: 8.5pt; text-align: left;">&nbsp;</td>
        <td class="center" style="font-size: 8.5pt;">&nbsp;</td>
        <td class="center" style="font-size: 8.5pt;">&nbsp;</td>
        <td class="center" style="font-size: 8.5pt;">&nbsp;</td>
        <td class="center" style="font-size: 8.5pt;">&nbsp;</td>
        <td style="font-size: 8.5pt;">&nbsp;</td>
      </tr>
      <tr>
        <td class="center" style="font-size: 8.5pt;">2</td>
        <td style="font-size: 8.5pt; text-align: left;">&nbsp;</td>
        <td class="center" style="font-size: 8.5pt;">&nbsp;</td>
        <td class="center" style="font-size: 8.5pt;">&nbsp;</td>
        <td class="center" style="font-size: 8.5pt;">&nbsp;</td>
        <td class="center" style="font-size: 8.5pt;">&nbsp;</td>
        <td style="font-size: 8.5pt;">&nbsp;</td>
      </tr>
    `);
  }

  // Summary, Average, and CKP score rows
  rowsList.push(`
    <tr class="summary-row" style="font-weight: bold; background-color: #f9fafb;">
      <td colspan="3" class="center" style="font-size: 8.5pt;">JUMLAH</td>
      <td class="center" style="font-size: 8.5pt;">${sumTarget}</td>
      <td class="center" style="font-size: 8.5pt;"></td>
      <td class="center" style="font-size: 8.5pt;"></td>
      <td style="font-size: 8.5pt;"></td>
    </tr>
  `);

  const rowsHtml = rowsList.join('');

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <title>Cetak CKP-T - ${targetEmpName}</title>
    <style>
      @page {
        size: A4 landscape;
        margin: 10mm 10mm 10mm 10mm;
      }
      html, body {
        width: 100%;
        margin: 0;
        padding: 0;
        background: #fff;
        color: #000;
        font-family: 'Arial', sans-serif;
        font-size: 9.5pt;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .print-card {
        width: 100%;
        box-sizing: border-box;
      }
      .info-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 15px;
      }
      .info-table td {
        border: none;
        padding: 2px 0;
        font-size: 9pt;
      }
      .main-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 25px;
      }
      .main-table th, .main-table td {
        border: 1px solid #000;
        padding: 4px 6px;
        text-align: left;
        font-size: 8.5pt;
        word-break: break-word;
      }
      .main-table th {
        background-color: #e5e7eb;
        font-weight: bold;
        text-align: center;
      }
      .main-table td.center {
        text-align: center;
      }
      .header-indices td {
        background-color: #f3f4f6;
        font-size: 8pt;
        border: 1px solid #000;
        padding: 3px;
        font-weight: bold;
      }
      .summary-row td {
        background-color: #f9fafb;
      }
      .signature-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 15px;
      }
      .signature-table td {
        width: 50%;
        text-align: center;
        vertical-align: top;
        font-size: 9pt;
        padding: 2px 0;
      }
      .signature-space {
        height: 50px;
      }
    </style>
  </head>
  <body>
    <div class="print-card">
      <div style="width: 100%; display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
        <div style="width: 20%"></div>
        <div style="font-size: 11pt; font-weight: bold; text-transform: uppercase; text-align: center; margin-top: 15px; flex-grow: 1; letter-spacing: 0.5px;">
          TARGET KINERJA PEGAWAI TAHUN ${yearVal}
        </div>
        <div style="border: 1px solid #000; padding: 4px 10px; font-size: 9pt; font-weight: bold; min-width: 60px; text-align: center;">CKP-T</div>
      </div>

      <table class="info-table">
        <tr>
          <td style="width: 18%; vertical-align: top;">Satuan Organisasi</td>
          <td style="width: 82%;">: BPS Kabupaten Penajam Paser Utara</td>
        </tr>
        <tr>
          <td style="vertical-align: top;">Nama</td>
          <td>: ${targetEmpName}</td>
        </tr>
        <tr>
          <td style="vertical-align: top;">Jabatan</td>
          <td>: Staf</td>
        </tr>
        <tr>
          <td style="vertical-align: top;">Periode</td>
          <td>: ${periodStr} ${yearVal}</td>
        </tr>
      </table>

      <table class="main-table">
        <thead>
          <tr>
            <th style="width: 5%; font-size: 8.5pt;">No</th>
            <th style="width: 53%; font-size: 8.5pt;">Uraian Kegiatan</th>
            <th style="width: 12%; font-size: 8.5pt;">Satuan</th>
            <th style="width: 10%; font-size: 8.5pt;">Target Kuantitas</th>
            <th style="width: 10%; font-size: 8.5pt;">Kode Butir Kegiatan</th>
            <th style="width: 5%; font-size: 8.5pt;">Angka Kredit</th>
            <th style="width: 5%; font-size: 8.5pt;">Keterangan</th>
          </tr>
          <tr class="header-indices center">
            <td>(1)</td>
            <td>(2)</td>
            <td>(3)</td>
            <td>(4)</td>
            <td>(5)</td>
            <td>(6)</td>
            <td>(7)</td>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <table class="signature-table">
        <tr>
          <td>Pegawai Yang Dinilai</td>
          <td>Pejabat Penilai</td>
        </tr>
        <tr>
          <td>
            Penajam Paser Utara, ${sigDate}<br>
            <div class="signature-space"></div>
            <strong>( ${targetEmpName} )</strong><br>
            NIP. ${targetEmpNip}
          </td>
          <td>
            Penajam Paser Utara, ${sigDate}<br>
            <div class="signature-space"></div>
            <strong>( ${targetPejName} )</strong><br>
            NIP. ${targetPejNip}
          </td>
        </tr>
      </table>
    </div>
  </body>
  </html>
  `;
}

function buildCkprHtml() {
  const { aggregated, utamaKeys, tambahanKeys } = aggregateCkpBySkpAndSatuan(ckpOktoberEntries, skpData);

  let sumTarget = 0;
  let sumRealisasi = 0;
  let countItems = 0;
  let rowsList = [];

  // UTAMA Section
  rowsList.push(`
    <tr style="font-weight: bold; background-color: #f3f4f6;">
      <td class="center" style="font-size: 8pt;"></td>
      <td style="text-align: left; padding-left: 6px; font-size: 8pt;">UTAMA</td>
      <td class="center" style="font-size: 8pt;"></td>
      <td class="center" style="font-size: 8pt;"></td>
      <td class="center" style="font-size: 8pt;"></td>
      <td class="center" style="font-size: 8pt;"></td>
      <td class="center" style="font-size: 8pt;"></td>
      <td class="center" style="font-size: 8pt;"></td>
      <td class="center" style="font-size: 8pt;"></td>
      <td style="font-size: 8pt;"></td>
    </tr>
  `);

  utamaKeys.forEach((key, idx) => {
    const item = aggregated[key];
    sumTarget += item.kuantitas;
    sumRealisasi += item.kuantitas;
    countItems++;
    rowsList.push(`
      <tr>
        <td class="center" style="font-size: 8pt;">${idx + 1}</td>
        <td style="font-size: 8pt; text-align: left;">${item.nama}</td>
        <td class="center" style="font-size: 8pt;">${item.satuan}</td>
        <td class="center" style="font-size: 8pt;">${item.kuantitas}</td>
        <td class="center" style="font-size: 8pt;">${item.kuantitas}</td>
        <td class="center" style="font-size: 8pt;">100</td>
        <td class="center" style="font-size: 8pt;">100</td>
        <td class="center" style="font-size: 8pt;"></td>
        <td class="center" style="font-size: 8pt;"></td>
        <td style="font-size: 8pt;"></td>
      </tr>
    `);
  });

  // TAMBAHAN Section
  rowsList.push(`
    <tr style="font-weight: bold; background-color: #f3f4f6;">
      <td class="center" style="font-size: 8pt;"></td>
      <td style="text-align: left; padding-left: 6px; font-size: 8pt;">TAMBAHAN</td>
      <td class="center" style="font-size: 8pt;"></td>
      <td class="center" style="font-size: 8pt;"></td>
      <td class="center" style="font-size: 8pt;"></td>
      <td class="center" style="font-size: 8pt;"></td>
      <td class="center" style="font-size: 8pt;"></td>
      <td class="center" style="font-size: 8pt;"></td>
      <td class="center" style="font-size: 8pt;"></td>
      <td style="font-size: 8pt;"></td>
    </tr>
  `);

  if (tambahanKeys.length > 0) {
    tambahanKeys.forEach((key, idx) => {
      const item = aggregated[key];
      sumTarget += item.kuantitas;
      sumRealisasi += item.kuantitas;
      countItems++;
      rowsList.push(`
        <tr>
          <td class="center" style="font-size: 8pt;">${idx + 1}</td>
          <td style="font-size: 8pt; text-align: left;">${item.nama}</td>
          <td class="center" style="font-size: 8pt;">${item.satuan}</td>
          <td class="center" style="font-size: 8pt;">${item.kuantitas}</td>
          <td class="center" style="font-size: 8pt;">${item.kuantitas}</td>
          <td class="center" style="font-size: 8pt;">100</td>
          <td class="center" style="font-size: 8pt;">100</td>
          <td class="center" style="font-size: 8pt;"></td>
          <td class="center" style="font-size: 8pt;"></td>
          <td style="font-size: 8pt;"></td>
        </tr>
      `);
    });
  } else {
    rowsList.push(`
      <tr>
        <td class="center" style="font-size: 8pt;">1</td>
        <td style="font-size: 8pt; text-align: left;">&nbsp;</td>
        <td class="center" style="font-size: 8pt;">&nbsp;</td>
        <td class="center" style="font-size: 8pt;">&nbsp;</td>
        <td class="center" style="font-size: 8pt;">&nbsp;</td>
        <td class="center" style="font-size: 8pt;">&nbsp;</td>
        <td class="center" style="font-size: 8pt;">&nbsp;</td>
        <td class="center" style="font-size: 8pt;">&nbsp;</td>
        <td class="center" style="font-size: 8pt;">&nbsp;</td>
        <td style="font-size: 8pt;">&nbsp;</td>
      </tr>
    `);
  }

  // Summary, Average, and CKP score rows
  rowsList.push(`
    <tr class="summary-row" style="font-weight: bold; background-color: #f9fafb;">
      <td colspan="3" class="center" style="font-size: 8pt;">JUMLAH</td>
      <td class="center" style="font-size: 8pt;">${sumTarget}</td>
      <td class="center" style="font-size: 8pt;">${sumRealisasi}</td>
      <td class="center" style="font-size: 8pt;"></td>
      <td class="center" style="font-size: 8pt;"></td>
      <td class="center" style="font-size: 8pt;"></td>
      <td class="center" style="font-size: 8pt;"></td>
      <td style="font-size: 8pt;"></td>
    </tr>
    <tr class="summary-row" style="font-weight: bold; background-color: #f9fafb;">
      <td colspan="3" class="center" style="font-size: 8pt;">RATA-RATA</td>
      <td class="center" style="font-size: 8pt;"></td>
      <td class="center" style="font-size: 8pt;"></td>
      <td class="center" style="font-size: 8pt;">100</td>
      <td class="center" style="font-size: 8pt;">100</td>
      <td class="center" style="font-size: 8pt;"></td>
      <td class="center" style="font-size: 8pt;"></td>
      <td style="font-size: 8pt;"></td>
    </tr>
    <tr class="summary-row" style="font-weight: bold; background-color: #f9fafb;">
      <td colspan="5" class="center" style="font-size: 8pt;">CAPAIAN KINERJA PEGAWAI (CKP)</td>
      <td colspan="2" class="center" style="font-size: 8pt;">100.00</td>
      <td class="center" style="font-size: 8pt;"></td>
      <td class="center" style="font-size: 8pt;"></td>
      <td style="font-size: 8pt;"></td>
    </tr>
  `);

  const rowsHtml = rowsList.join('');

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <title>Cetak CKP-R - ${targetEmpName}</title>
    <style>
      @page {
        size: A4 landscape;
        margin: 10mm 10mm 10mm 10mm;
      }
      html, body {
        width: 100%;
        margin: 0;
        padding: 0;
        background: #fff;
        color: #000;
        font-family: 'Arial', sans-serif;
        font-size: 9pt;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .print-card {
        width: 100%;
        box-sizing: border-box;
      }
      .info-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 12px;
      }
      .info-table td {
        border: none;
        padding: 2px 0;
        font-size: 8.5pt;
      }
      .main-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 20px;
      }
      .main-table th, .main-table td {
        border: 1px solid #000;
        padding: 4px 5px;
        text-align: left;
        font-size: 8pt;
        word-break: break-word;
      }
      .main-table th {
        background-color: #e5e7eb;
        font-weight: bold;
        text-align: center;
      }
      .main-table td.center {
        text-align: center;
      }
      .header-indices td {
        background-color: #f3f4f6;
        font-size: 7.5pt;
        border: 1px solid #000;
        padding: 2px;
        font-weight: bold;
      }
      .summary-row td {
        background-color: #f9fafb;
      }
      .signature-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 10px;
      }
      .signature-table td {
        width: 50%;
        text-align: center;
        vertical-align: top;
        font-size: 8.5pt;
        padding: 2px 0;
      }
      .signature-space {
        height: 45px;
      }
    </style>
  </head>
  <body>
    <div class="print-card">
      <div style="width: 100%; display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
        <div style="width: 20%"></div>
        <div style="font-size: 11pt; font-weight: bold; text-transform: uppercase; text-align: center; margin-top: 10px; flex-grow: 1; letter-spacing: 0.5px;">
          CAPAIAN KINERJA PEGAWAI TAHUN ${yearVal}
        </div>
        <div style="border: 1px solid #000; padding: 4px 10px; font-size: 9pt; font-weight: bold; min-width: 60px; text-align: center;">CKP-R</div>
      </div>

      <table class="info-table">
        <tr>
          <td style="width: 18%; vertical-align: top;">Satuan Organisasi</td>
          <td style="width: 82%;">: BPS Kabupaten Penajam Paser Utara</td>
        </tr>
        <tr>
          <td style="vertical-align: top;">Nama</td>
          <td>: ${targetEmpName}</td>
        </tr>
        <tr>
          <td style="vertical-align: top;">Jabatan</td>
          <td>: Staf</td>
        </tr>
        <tr>
          <td style="vertical-align: top;">Periode</td>
          <td>: ${periodStr} ${yearVal}</td>
        </tr>
      </table>

      <table class="main-table">
        <thead>
          <tr>
            <th rowspan="2" style="width: 4%;">No</th>
            <th rowspan="2" style="width: 42%;">Uraian Kegiatan</th>
            <th rowspan="2" style="width: 8%;">Satuan</th>
            <th colspan="3" style="width: 18%;">Kuantitas</th>
            <th rowspan="2" style="width: 8%;">Tingkat Kualitas (%)</th>
            <th rowspan="2" style="width: 6%;">Kode Butir</th>
            <th rowspan="2" style="width: 6%;">Angka Kredit</th>
            <th rowspan="2" style="width: 8%;">Keterangan</th>
          </tr>
          <tr>
            <th style="width: 6%;">Target</th>
            <th style="width: 6%;">Realisasi</th>
            <th style="width: 6%;">%</th>
          </tr>
          <tr class="header-indices center">
            <td>(1)</td>
            <td>(2)</td>
            <td>(3)</td>
            <td>(4)</td>
            <td>(5)</td>
            <td>(6)</td>
            <td>(7)</td>
            <td>(8)</td>
            <td>(9)</td>
            <td>(10)</td>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <table class="signature-table">
        <tr>
          <td>Pegawai Yang Dinilai</td>
          <td>Pejabat Penilai</td>
        </tr>
        <tr>
          <td>
            Penajam Paser Utara, ${sigDate}<br>
            <div class="signature-space"></div>
            <strong>( ${targetEmpName} )</strong><br>
            NIP. ${targetEmpNip}
          </td>
          <td>
            Penajam Paser Utara, ${sigDate}<br>
            <div class="signature-space"></div>
            <strong>( ${targetPejName} )</strong><br>
            NIP. ${targetPejNip}
          </td>
        </tr>
      </table>
    </div>
  </body>
  </html>
  `;
}

function buildDailyHtml() {
  const sortedData = [...ckpOktoberEntries].sort((a, b) => {
    if (a.tanggal !== b.tanggal) return a.tanggal.localeCompare(b.tanggal);
    return (a.waktuMulai || '').localeCompare(b.waktuMulai || '');
  });

  const rowsHtml = sortedData.map((e, idx) => {
    const formattedDate = e.tanggal ? e.tanggal.split('-').reverse().join('/') : '';
    const eSkps = getEntrySkpIds(e);
    const skpItems = eSkps.map(sid => (skpData || []).find(s => String(s.id) === String(sid))).filter(Boolean);
    const categoryStr = skpItems.length > 0
      ? [...new Set(skpItems.map(s => s.kategori === 'utama' ? 'Utama' : 'Tambahan'))].join(', ')
      : ((skpData || []).find(s => String(s.id) === String(e.skpId))?.kategori === 'utama' ? 'Utama' : '');
    const buktiLinkText = e.buktiDukung ? `<a href="${e.buktiDukung}" target="_blank" style="color: #4f46e5; text-decoration: underline; word-break: break-all; font-size: 7.5pt;">${e.buktiDukung}</a>` : '';
    return `
      <tr>
        <td class="center">${idx + 1}</td>
        <td class="center">${formattedDate}</td>
        <td class="center">${e.waktuMulai || ''} - ${e.waktuSelesai || ''}</td>
        <td>${e.rincian || ''}</td>
        <td class="center">${e.kuantitas || 1}</td>
        <td class="center">${e.satuan || 'kegiatan'}</td>
        <td class="center">${categoryStr}</td>
        <td>${buktiLinkText}</td>
        <td></td>
      </tr>
    `;
  }).join('');

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <title>Cetak Daily - ${targetEmpName}</title>
    <style>
      @page {
        size: A4 landscape;
        margin: 10mm 10mm 10mm 10mm;
      }
      html, body {
        width: 100%;
        margin: 0;
        padding: 0;
        background: #fff;
        color: #000;
        font-family: 'Arial', sans-serif;
        font-size: 9pt;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .print-card {
        width: 100%;
        box-sizing: border-box;
      }
      .info-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 12px;
      }
      .info-table td {
        border: none;
        padding: 2px 0;
        font-size: 8.5pt;
      }
      .main-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 20px;
      }
      .main-table th, .main-table td {
        border: 1px solid #000;
        padding: 4px 5px;
        text-align: left;
        font-size: 8pt;
        word-break: break-word;
      }
      .main-table th {
        background-color: #e5e7eb;
        font-weight: bold;
        text-align: center;
      }
      .main-table td.center {
        text-align: center;
      }
      .signature-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 15px;
      }
      .signature-table td {
        width: 50%;
        text-align: center;
        vertical-align: top;
        font-size: 8.5pt;
        padding: 2px 0;
      }
      .signature-space {
        height: 45px;
      }
    </style>
  </head>
  <body>
    <div class="print-card">
      <div style="width: 100%; display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
        <div style="width: 20%"></div>
        <div style="font-size: 11pt; font-weight: bold; text-transform: uppercase; text-align: center; margin-top: 10px; flex-grow: 1; letter-spacing: 0.5px;">
          REKAPITULASI KEGIATAN BULANAN PEGAWAI TAHUN ${yearVal}
        </div>
        <div style="border: 1px solid #000; padding: 4px 10px; font-size: 9pt; font-weight: bold; min-width: 60px; text-align: center;">DAILY</div>
      </div>

      <table class="info-table">
        <tr>
          <td style="width: 18%; vertical-align: top;">Satuan Organisasi</td>
          <td style="width: 82%;">: BPS Kabupaten Penajam Paser Utara</td>
        </tr>
        <tr>
          <td style="vertical-align: top;">Nama</td>
          <td>: ${targetEmpName}</td>
        </tr>
        <tr>
          <td style="vertical-align: top;">Jabatan</td>
          <td>: Staf</td>
        </tr>
        <tr>
          <td style="vertical-align: top;">Periode</td>
          <td>: ${periodStr} ${yearVal}</td>
        </tr>
      </table>

      <table class="main-table">
        <thead>
          <tr>
            <th style="width: 4%">No</th>
            <th style="width: 9%">Tanggal</th>
            <th style="width: 9%">Waktu</th>
            <th style="width: 30%">Rincian Kegiatan</th>
            <th style="width: 6%">Kuantitas</th>
            <th style="width: 6%">Satuan</th>
            <th style="width: 8%">Kategori</th>
            <th style="width: 14%">Bukti Kegiatan</th>
            <th style="width: 14%">Keterangan</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <table class="signature-table">
        <tr>
          <td>Mengetahui,<br>Pejabat Penilai</td>
          <td>Penajam Paser Utara, ${sigDate}<br>Pegawai,</td>
        </tr>
        <tr>
          <td>
            <div class="signature-space"></div>
            <strong>( ${targetPejName} )</strong><br>
            NIP. ${targetPejNip}
          </td>
          <td>
            <div class="signature-space"></div>
            <strong>( ${targetEmpName} )</strong><br>
            NIP. ${targetEmpNip}
          </td>
        </tr>
      </table>
    </div>
  </body>
  </html>
  `;
}

function convertHtmlToPdf(htmlContent, outputPdfPath) {
  const tmpHtmlPath = path.join(process.cwd(), '.temp_print.html');
  fs.writeFileSync(tmpHtmlPath, htmlContent, 'utf8');

  const cmd = `"${chromePath}" --headless=new --disable-gpu --no-pdf-header-footer --print-to-pdf="${outputPdfPath}" "file:///${tmpHtmlPath.replace(/\\\\/g, '/')}"`;
  execSync(cmd, { stdio: 'pipe' });

  if (fs.existsSync(tmpHtmlPath)) fs.unlinkSync(tmpHtmlPath);
  console.log(`[SUCCESS] Generated PDF: ${outputPdfPath}`);
}

function main() {
  const downloadDir = 'C:/Users/ajian/Downloads';
  const kedinasanDir = 'D:/01_Kedinasan_BPS/Bukti_Dukung_CKP_Oktober_2026';

  const ckptHtml = buildCkptHtml();
  const ckprHtml = buildCkprHtml();
  const dailyHtml = buildDailyHtml();

  // Generate CKP-T PDFs
  convertHtmlToPdf(ckptHtml, path.join(downloadDir, 'CKP-T_Oktober_2026_Yahya_Abdurrohman.pdf'));
  convertHtmlToPdf(ckptHtml, path.join(kedinasanDir, 'CKP-T_Oktober_2026_Yahya_Abdurrohman.pdf'));

  // Generate CKP-R PDFs
  convertHtmlToPdf(ckprHtml, path.join(downloadDir, 'CKP-R_Oktober_2026_Yahya_Abdurrohman.pdf'));
  convertHtmlToPdf(ckprHtml, path.join(kedinasanDir, 'CKP-R_Oktober_2026_Yahya_Abdurrohman.pdf'));

  // Generate Daily PDFs
  convertHtmlToPdf(dailyHtml, path.join(downloadDir, 'CKP-Daily_Oktober_2026_Yahya_Abdurrohman.pdf'));
  convertHtmlToPdf(dailyHtml, path.join(kedinasanDir, 'CKP-Daily_Oktober_2026_Yahya_Abdurrohman.pdf'));
}

main();
