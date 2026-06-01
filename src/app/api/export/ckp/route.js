import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';

export async function POST(request) {
  try {
    const { templateName, startRow = 10, rows = [], cellUpdates = {} } = await request.json();

    if (!templateName) {
      return NextResponse.json({ error: 'templateName is required' }, { status: 400 });
    }

    // Path to the template
    const templatePath = path.join(process.cwd(), 'src', 'export_templates', templateName);

    if (!fs.existsSync(templatePath)) {
      return NextResponse.json({ error: `Template ${templateName} not found` }, { status: 404 });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);

    const worksheet = workbook.worksheets[0]; // Assuming data goes to the first sheet

    // Update specific cells (e.g. employee info, period)
    Object.keys(cellUpdates).forEach(cellRef => {
      const cell = worksheet.getCell(cellRef);
      if (cell) {
        cell.value = cellUpdates[cellRef];
      }
    });

    // Calculate net shift for merges (we insert N rows, delete 1 placeholder)
    const netShift = (rows && rows.length > 0) ? rows.length - 1 : 0;
    const mergesToShift = [];

    if (netShift !== 0) {
      Object.keys(worksheet._merges).forEach(key => {
        const merge = worksheet._merges[key];
        // Shift merges that are below the placeholder row (e.g., signature block, summary rows)
        if (merge.model.top > startRow) {
          mergesToShift.push(merge.model);
        }
      });
      // Unmerge them first so ExcelJS doesn't corrupt them during insertRow
      mergesToShift.forEach(m => {
        const tl = worksheet.getCell(m.top, m.left).address;
        worksheet.unMergeCells(tl);
      });
    }

    // Insert rows
    if (rows && rows.length > 0) {
      // Get the style of the first row to be inserted
      const templateRow = worksheet.getRow(startRow);
      
      rows.forEach((rowData, index) => {
        // insertRow inserts a new row at the specified position and shifts remaining rows down
        const insertedRow = worksheet.insertRow(startRow + index, rowData);
        
        // Copy styles from the template row and enforce borders
        insertedRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          const templateCell = templateRow.getCell(colNumber);
          if (templateCell) {
            // Assign style directly (ExcelJS handles style object assignment)
            cell.style = templateCell.style;
          } else {
            cell.style = {};
          }
          
          // Enforce thin borders for all populated columns
          // rowData array length gives us the number of data columns
          if (colNumber <= rowData.length) {
            // For Daily CKP, rowData has 10 elements (index 0 is empty for Col A)
            // Skip borders for completely empty placeholder columns (like Col A in Daily)
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
      
      // Delete the original placeholder row which has now been pushed down
      worksheet.spliceRows(startRow + rows.length, 1);
    }

    if (netShift !== 0) {
      // Re-merge at shifted positions
      mergesToShift.forEach(m => {
        const tl = worksheet.getCell(m.top + netShift, m.left).address;
        const br = worksheet.getCell(m.bottom + netShift, m.right).address;
        worksheet.mergeCells(`${tl}:${br}`);
      });
    }

    // Fix ExcelJS Shared Formula issue when inserting rows
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        if (cell.type === ExcelJS.ValueType.Formula && cell.formulaType === ExcelJS.FormulaType.Shared) {
          try {
            const formulaStr = cell.formula;
            if (formulaStr) {
              // Convert shared formula to normal formula to avoid breaking refs when shifting rows
              cell.value = {
                formula: formulaStr,
                result: cell.result
              };
            } else {
              // If exceljs failed to translate the shared formula (undefined), fallback to static result
              cell.value = cell.result;
            }
          } catch (e) {
            // If reading cell.formula crashes (known exceljs bug), fallback to static result
            cell.value = cell.result;
          }
        }
      });
    });

    // Dynamically update the signature date to match the download date
    const today = new Date();
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const formattedDate = `Penajam Paser Utara, ${today.getDate()} ${months[today.getMonth()]} ${today.getFullYear()}`;

    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        if (cell.type === ExcelJS.ValueType.String && typeof cell.value === 'string') {
          if (cell.value.includes('Penajam Paser Utara,')) {
            cell.value = formattedDate;
          }
        }
      });
    });

    // Write to buffer
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
