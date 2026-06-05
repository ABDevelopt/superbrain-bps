const XLSX = require('xlsx');
const path = require('path');

const filePath = 'd:/superbrain/src/import_templates/SKP 1777466836557.xlsx';
const workbook = XLSX.readFile(filePath);
const sheet = workbook.Sheets['Penetapan'];

// Let's print rows 10 to 20 with their cell address keys (e.g. A11, B11, etc.)
console.log('Cell inspection for rows 10 to 25:');
for (let r = 9; r <= 25; r++) {
  const rowNum = r + 1;
  const rowCells = {};
  let hasData = false;
  
  // Check columns A to H
  ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].forEach(col => {
    const addr = col + rowNum;
    const cell = sheet[addr];
    if (cell && cell.v !== undefined) {
      rowCells[col] = cell.v;
      hasData = true;
    }
  });
  
  if (hasData) {
    console.log(`Row ${rowNum}:`, rowCells);
  }
}
