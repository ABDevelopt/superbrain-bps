import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';

function copySheet(srcWs, destWs) {
  if (srcWs.pageSetup) destWs.pageSetup = JSON.parse(JSON.stringify(srcWs.pageSetup));
  if (srcWs.views) destWs.views = JSON.parse(JSON.stringify(srcWs.views));
  if (srcWs.properties) destWs.properties = JSON.parse(JSON.stringify(srcWs.properties));

  if (srcWs.columns) {
    destWs.columns = srcWs.columns.map(col => ({
      header: col.header,
      key: col.key,
      width: col.width,
      hidden: col.hidden,
      style: col.style
    }));
  }

  srcWs.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const newRow = destWs.getRow(rowNumber);
    if (row.height) newRow.height = row.height;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const newCell = newRow.getCell(colNumber);
      if (cell.type === ExcelJS.ValueType.Formula) {
        newCell.value = {
          formula: cell.formula,
          result: cell.result
        };
      } else {
        newCell.value = cell.value;
      }
      if (cell.style) {
        newCell.style = JSON.parse(JSON.stringify(cell.style));
      }
      if (cell.numFmt) newCell.numFmt = cell.numFmt;
    });
  });

  for (const merge of Object.values(srcWs._merges)) {
    try {
      destWs.mergeCells(merge.model.top, merge.model.left, merge.model.bottom, merge.model.right);
    } catch (e) {}
  }
}

async function populateWorksheet(templateName, startRow = 10, placeholderCount = 1, rows = [], cellUpdates = {}, isCkpr = false, customSigDate = null) {
  let templatePath = path.join(process.cwd(), 'public', 'export_templates', templateName);
  if (!fs.existsSync(templatePath)) {
    templatePath = path.join(process.cwd(), 'src', 'export_templates', templateName);
  }

  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template ${templateName} not found`);
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(templatePath);
  const worksheet = workbook.worksheets[0];

  Object.keys(cellUpdates).forEach(cellRef => {
    const cell = worksheet.getCell(cellRef);
    if (cell) cell.value = cellUpdates[cellRef];
  });

  const netShift = rows.length - placeholderCount;
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

    worksheet.spliceRows(startRow + rows.length, placeholderCount);
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

  const today = new Date();
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const formattedDate = customSigDate || `Penajam Paser Utara, ${today.getDate()} ${months[today.getMonth()]} ${today.getFullYear()}`;

  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      if (cell.type === ExcelJS.ValueType.String && typeof cell.value === 'string') {
        if (cell.value.includes('Penajam Paser Utara,')) {
          cell.value = formattedDate;
        }
      }
    });
  });

  if (isCkpr) {
    const lastDataRow = startRow + rows.length - 1;
    const rataRataRow = startRow + rows.length + 1;
    const avgCell = worksheet.getCell(`F${rataRataRow}`);
    avgCell.value = { formula: `AVERAGE(F12:F${lastDataRow})`, result: 100 };
  }

  return { workbook, worksheet };
}

export async function POST(request) {
  try {
    const body = await request.json();

    if (body.isCombined) {
      const { sheets = [], exportFileName = 'CKP_Combined.xlsx' } = body;
      const combinedWorkbook = new ExcelJS.Workbook();

      for (const s of sheets) {
        const placeholderCount = s.placeholderCount !== undefined
          ? s.placeholderCount
          : (s.templateName.includes('daily') ? 1 : 2);

        const { worksheet } = await populateWorksheet(
          s.templateName,
          s.startRow,
          placeholderCount,
          s.rows,
          s.cellUpdates,
          s.isCkpr,
          s.customSigDate
        );
        copySheet(worksheet, combinedWorkbook.addWorksheet(s.sheetName));
      }

      const buffer = await combinedWorkbook.xlsx.writeBuffer();
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${exportFileName}"`
        }
      });
    }

    const { templateName, startRow = 10, placeholderCount = 1, rows = [], cellUpdates = {}, isCkpr = false, customSigDate = null } = body;

    if (!templateName) {
      return NextResponse.json({ error: 'templateName is required' }, { status: 400 });
    }

    const effectivePlaceholderCount = placeholderCount !== undefined
      ? placeholderCount
      : (templateName.includes('daily') ? 1 : 2);

    const { workbook } = await populateWorksheet(
      templateName,
      startRow,
      effectivePlaceholderCount,
      rows,
      cellUpdates,
      isCkpr,
      customSigDate
    );

    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Export_${templateName}"`
      }
    });

  } catch (error) {
    console.error('Export Excel Error Stack:', error.stack);
    return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
}
