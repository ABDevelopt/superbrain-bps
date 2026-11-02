import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import { aggregateCkpBySkpAndSatuan, getEntrySkpIds } from '../src/utils/ckpAggregation.js';
import { ckpOktoberEntries } from '../src/data/ckpOktober2026.js';
import { skpData } from '../src/data/skpData.js';

async function generateCkpExcel(type, outputPath) {
  const isCkpt = type === 'ckpt';
  const templateName = isCkpt ? 'template_ckp_t.xlsx' : 'template_ckp_r.xlsx';
  const startRow = 12;
  const templatePath = path.join(process.cwd(), 'public', 'export_templates', templateName);

  const { aggregated, allSortedKeys } = aggregateCkpBySkpAndSatuan(ckpOktoberEntries, skpData);

  const rows = allSortedKeys.map((key, idx) => {
    const item = aggregated[key];
    const displayNama = item.skpKey === 'none' ? 'Non-SKP' : item.nama;
    if (isCkpt) {
      return [
        idx + 1,
        displayNama,
        item.satuan,
        item.kuantitas,
        '',
        '',
        ''
      ];
    } else {
      return [
        idx + 1,
        displayNama,
        item.satuan,
        item.kuantitas,
        item.kuantitas,
        100,
        100,
        '',
        '',
        ''
      ];
    }
  });

  const cellUpdates = {
    'C7': ': Oktober 2026'
  };

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(templatePath);
  const worksheet = workbook.worksheets[0];

  Object.keys(cellUpdates).forEach(cellRef => {
    const cell = worksheet.getCell(cellRef);
    if (cell) cell.value = cellUpdates[cellRef];
  });

  const netShift = (rows && rows.length > 0) ? rows.length - 1 : 0;
  const mergesToShift = [];

  if (netShift !== 0) {
    Object.keys(worksheet._merges).forEach(key => {
      const merge = worksheet._merges[key];
      if (merge.model.top > startRow) {
        mergesToShift.push(merge.model);
      }
    });
    mergesToShift.forEach(m => {
      const tl = worksheet.getCell(m.top, m.left).address;
      worksheet.unMergeCells(tl);
    });
  }

  if (rows && rows.length > 0) {
    const templateRow = worksheet.getRow(startRow);

    rows.forEach((rowData, index) => {
      const insertedRow = worksheet.insertRow(startRow + index, rowData);
      insertedRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const templateCell = templateRow.getCell(colNumber);
        if (templateCell) {
          cell.style = templateCell.style;
        } else {
          cell.style = {};
        }
        if (colNumber <= rowData.length) {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        }
      });
      insertedRow.commit();
    });

    worksheet.spliceRows(startRow + rows.length, 1);
  }

  if (netShift !== 0) {
    mergesToShift.forEach(m => {
      const tl = worksheet.getCell(m.top + netShift, m.left).address;
      const br = worksheet.getCell(m.bottom + netShift, m.right).address;
      worksheet.mergeCells(`${tl}:${br}`);
    });
  }

  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      if (cell.type === ExcelJS.ValueType.Formula && cell.formulaType === ExcelJS.FormulaType.Shared) {
        try {
          const formulaStr = cell.formula;
          if (formulaStr) {
            cell.value = { formula: formulaStr, result: cell.result };
          } else {
            cell.value = cell.result;
          }
        } catch (e) {
          cell.value = cell.result;
        }
      }
    });
  });

  await workbook.xlsx.writeFile(outputPath);
  console.log(`[SUCCESS] Generated ${outputPath}`);
}

async function generateDailyExcel(outputPath) {
  const templateName = 'template_ckp_daily.xlsx';
  const startRow = 9;
  const templatePath = path.join(process.cwd(), 'public', 'export_templates', templateName);

  const sortedData = [...ckpOktoberEntries].sort((a, b) => {
    if (a.tanggal !== b.tanggal) return a.tanggal.localeCompare(b.tanggal);
    return (a.waktuMulai || '').localeCompare(b.waktuMulai || '');
  });

  const rows = sortedData.map((e, idx) => {
    const eSkps = getEntrySkpIds(e);
    const skpItems = eSkps.map(sid => (skpData || []).find(s => String(s.id) === String(sid))).filter(Boolean);
    const kategoriStr = skpItems.length > 0 
      ? [...new Set(skpItems.map(s => s.kategori === 'utama' ? 'Utama' : 'Tambahan'))].join(', ')
      : (((skpData || []).find(s => String(s.id) === String(e.skpId)))?.kategori === 'utama' ? 'Utama' : '');

    return [
      '',
      idx + 1,
      e.tanggal,
      `${e.waktuMulai || ''} - ${e.waktuSelesai || ''}`,
      e.rincian || '',
      e.kuantitas || 1,
      e.satuan || 'kegiatan',
      kategoriStr,
      e.buktiDukung || '',
      e.buktiPresensi || ''
    ];
  });

  const cellUpdates = {
    'D6': ': Oktober 2026'
  };

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(templatePath);
  const worksheet = workbook.worksheets[0];

  Object.keys(cellUpdates).forEach(cellRef => {
    const cell = worksheet.getCell(cellRef);
    if (cell) cell.value = cellUpdates[cellRef];
  });

  const netShift = (rows && rows.length > 0) ? rows.length - 1 : 0;
  const mergesToShift = [];

  if (netShift !== 0) {
    Object.keys(worksheet._merges).forEach(key => {
      const merge = worksheet._merges[key];
      if (merge.model.top > startRow) {
        mergesToShift.push(merge.model);
      }
    });
    mergesToShift.forEach(m => {
      const tl = worksheet.getCell(m.top, m.left).address;
      worksheet.unMergeCells(tl);
    });
  }

  if (rows && rows.length > 0) {
    const templateRow = worksheet.getRow(startRow);

    rows.forEach((rowData, index) => {
      const insertedRow = worksheet.insertRow(startRow + index, rowData);
      insertedRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const templateCell = templateRow.getCell(colNumber);
        if (templateCell) {
          cell.style = templateCell.style;
        } else {
          cell.style = {};
        }
        if (colNumber <= rowData.length) {
          if (!(colNumber === 1 && rowData[0] === '')) {
            cell.border = {
              top: { style: 'thin' },
              left: { style: 'thin' },
              bottom: { style: 'thin' },
              right: { style: 'thin' }
            };
          }
        }
      });
      insertedRow.commit();
    });

    worksheet.spliceRows(startRow + rows.length, 1);
  }

  if (netShift !== 0) {
    mergesToShift.forEach(m => {
      const tl = worksheet.getCell(m.top + netShift, m.left).address;
      const br = worksheet.getCell(m.bottom + netShift, m.right).address;
      worksheet.mergeCells(`${tl}:${br}`);
    });
  }

  const formattedDate = 'Penajam Paser Utara, 31 Oktober 2026';
  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      if (cell.type === ExcelJS.ValueType.String && typeof cell.value === 'string') {
        if (cell.value.includes('Penajam Paser Utara,')) {
          cell.value = formattedDate;
        }
      }
    });
  });

  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      if (cell.type === ExcelJS.ValueType.Formula && cell.formulaType === ExcelJS.FormulaType.Shared) {
        try {
          const formulaStr = cell.formula;
          if (formulaStr) {
            cell.value = { formula: formulaStr, result: cell.result };
          } else {
            cell.value = cell.result;
          }
        } catch (e) {
          cell.value = cell.result;
        }
      }
    });
  });

  await workbook.xlsx.writeFile(outputPath);
  console.log(`[SUCCESS] Generated ${outputPath}`);
}

async function main() {
  const downloadDir = 'C:/Users/ajian/Downloads';
  const kedinasanDir = 'D:/01_Kedinasan_BPS/Bukti_Dukung_CKP_Oktober_2026';

  const ckptFiles = [
    path.join(downloadDir, 'CKP-T_Oktober_2026_Yahya_Abdurrohman (3).xlsx'),
    path.join(downloadDir, 'CKP-T_Oktober_2026_Yahya_Abdurrohman (4).xlsx'),
    path.join(downloadDir, 'CKP-T_Oktober_2026_Yahya_Abdurrohman (5).xlsx'),
    path.join(downloadDir, 'CKP-T_Oktober_2026_Yahya_Abdurrohman.xlsx'),
    path.join(kedinasanDir, 'CKP-T_Oktober_2026_Yahya_Abdurrohman.xlsx'),
  ];

  const ckprFiles = [
    path.join(downloadDir, 'CKP-R_Oktober_2026_Yahya_Abdurrohman (3).xlsx'),
    path.join(downloadDir, 'CKP-R_Oktober_2026_Yahya_Abdurrohman (4).xlsx'),
    path.join(downloadDir, 'CKP-R_Oktober_2026_Yahya_Abdurrohman (5).xlsx'),
    path.join(downloadDir, 'CKP-R_Oktober_2026_Yahya_Abdurrohman.xlsx'),
    path.join(kedinasanDir, 'CKP-R_Oktober_2026_Yahya_Abdurrohman.xlsx'),
  ];

  const dailyFiles = [
    path.join(downloadDir, 'CKP-Daily_Oktober_2026_Yahya_Abdurrohman (1).xlsx'),
    path.join(downloadDir, 'CKP-Daily_Oktober_2026_Yahya_Abdurrohman (2).xlsx'),
    path.join(downloadDir, 'CKP-Daily_Oktober_2026_Yahya_Abdurrohman.xlsx'),
    path.join(kedinasanDir, 'CKP-Daily_Oktober_2026_Yahya_Abdurrohman.xlsx'),
  ];

  for (const f of ckptFiles) {
    try {
      await generateCkpExcel('ckpt', f);
    } catch (err) {
      console.error('Failed to generate', f, err);
    }
  }

  for (const f of ckprFiles) {
    try {
      await generateCkpExcel('ckpr', f);
    } catch (err) {
      console.error('Failed to generate', f, err);
    }
  }

  for (const f of dailyFiles) {
    try {
      await generateDailyExcel(f);
    } catch (err) {
      console.error('Failed to generate', f, err);
    }
  }
}

main();
