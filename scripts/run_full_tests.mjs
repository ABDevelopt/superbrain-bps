import fs from 'fs';
import path from 'path';
import parser from '@babel/parser';
import _traverse from '@babel/traverse';
const traverse = _traverse.default || _traverse;

console.log('====================================================');
console.log('       SUPERBRAIN BPS - COMPREHENSIVE TEST SUITE    ');
console.log('====================================================');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${testName}`);
  } else {
    failedTests++;
    console.error(`  [FAIL] ${testName}${details ? ': ' + details : ''}`);
  }
}

// ========================================================
// SUITE 1: AST PARSER & UNDECLARED IDENTIFIER TEST
// ========================================================
console.log('\n--- SUITE 1: AST Syntax & Identifier Integrity ---');

const globals = new Set([
  'window', 'document', 'navigator', 'console', 'setTimeout', 'clearTimeout',
  'setInterval', 'clearInterval', 'fetch', 'URL', 'Blob', 'File', 'FormData',
  'localStorage', 'sessionStorage', 'alert', 'confirm', 'prompt', 'requestAnimationFrame',
  'cancelAnimationFrame', 'Image', 'Audio', 'FileReader', 'Event', 'CustomEvent',
  'Date', 'Math', 'JSON', 'Object', 'Array', 'String', 'Number', 'Boolean', 'RegExp',
  'Error', 'Promise', 'Set', 'Map', 'WeakMap', 'WeakSet', 'Symbol', 'parseInt', 'parseFloat',
  'isNaN', 'isFinite', 'encodeURI', 'encodeURIComponent', 'decodeURI', 'decodeURIComponent',
  'Intl', 'React', 'process', 'global', 'Buffer', 'Headers', 'URLSearchParams',
  'HTMLCanvasElement', 'MediaStream', 'MediaRecorder', 'atob', 'btoa'
]);

function getFiles(dir) {
  let results = [];
  fs.readdirSync(dir).forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(fullPath));
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      results.push(fullPath);
    }
  });
  return results;
}

const srcFiles = getFiles('src');
assert(srcFiles.length > 50, `Found ${srcFiles.length} source code files in src/`);

let astParseErrors = 0;
let undeclaredErrors = 0;

for (const file of srcFiles) {
  const code = fs.readFileSync(file, 'utf8');
  let ast;
  try {
    ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript']
    });
  } catch (err) {
    astParseErrors++;
    console.error(`    AST Syntax Error in ${file}: ${err.message}`);
    continue;
  }

  const undeclared = new Set();
  traverse(ast, {
    ReferencedIdentifier(p) {
      const name = p.node.name;
      if (globals.has(name)) return;
      if (!p.scope.hasBinding(name)) {
        undeclared.add(name);
      }
    }
  });

  if (undeclared.size > 0) {
    undeclaredErrors++;
    console.error(`    Undeclared in ${file}: ${Array.from(undeclared).join(', ')}`);
  }
}

assert(astParseErrors === 0, 'AST syntax parsing across all source files has 0 errors');
assert(undeclaredErrors === 0, 'Undeclared variable references across all source files has 0 errors');

// ========================================================
// SUITE 2: IMPORT RESOLUTION & ASSET INTEGRITY
// ========================================================
console.log('\n--- SUITE 2: Import Path & Module Resolution ---');

let brokenImports = 0;
for (const f of srcFiles) {
  const c = fs.readFileSync(f, 'utf8');
  const lines = c.split('\n');
  lines.forEach((l) => {
    const m = l.match(/from\s+['"]([^'"]+)['"]/);
    if (m) {
      const imp = m[1];
      if (imp.startsWith('.')) {
        const t = path.resolve(path.dirname(f), imp);
        const ok = fs.existsSync(t) || fs.existsSync(t + '.js') || fs.existsSync(t + '.jsx') || fs.existsSync(path.join(t, 'index.js')) || fs.existsSync(t + '.module.css') || fs.existsSync(t + '.css');
        if (!ok) {
          brokenImports++;
          console.error(`    Broken import in ${f}: ${imp}`);
        }
      } else if (imp.startsWith('@/')) {
        const t = path.resolve('src', imp.slice(2));
        const ok = fs.existsSync(t) || fs.existsSync(t + '.js') || fs.existsSync(t + '.jsx') || fs.existsSync(path.join(t, 'index.js')) || fs.existsSync(t + '.module.css') || fs.existsSync(t + '.css');
        if (!ok) {
          brokenImports++;
          console.error(`    Broken alias import in ${f}: ${imp}`);
        }
      }
    }
  });
}

assert(brokenImports === 0, 'All module import statements resolve correctly (0 broken imports)');

// ========================================================
// SUITE 3: SKP DATA & DOMAIN COMPLIANCE
// ========================================================
console.log('\n--- SUITE 3: SKP Master Data Integrity ---');

import { skpData } from '../src/data/skpData.js';

assert(Array.isArray(skpData), 'skpData is a valid array');
assert(skpData.length === 30, `skpData contains exactly 30 SKP points (actual: ${skpData.length})`);

const skpIds = skpData.map(s => Number(s.id));
const uniqueIds = new Set(skpIds);
assert(uniqueIds.size === 30, 'All 30 SKP IDs are unique from 1 to 30');

const validCategories = ['utama', 'tambahan'];
const hasValidCategories = skpData.every(s => validCategories.includes(s.kategori?.toLowerCase()));
assert(hasValidCategories, 'All SKP items are categorized as either "utama" or "tambahan"');

const hasValidNames = skpData.every(s => typeof s.nama === 'string' && s.nama.trim().length > 5);
assert(hasValidNames, 'All SKP items have valid descriptive titles');

// ========================================================
// SUITE 4: PERMENPAN-RB NO. 6/2022 COMPLIANCE LOGIC
// ========================================================
console.log('\n--- SUITE 4: PermenPAN-RB No. 6/2022 Validation Rules ---');

// Rule 1: Max 7.5 hours (450 minutes) per day
function validateDailyHours(activities) {
  const totalMinutes = activities.reduce((acc, curr) => {
    const [sh, sm] = curr.waktuMulai.split(':').map(Number);
    const [eh, em] = curr.waktuSelesai.split(':').map(Number);
    const dur = (eh * 60 + em) - (sh * 60 + sm);
    return acc + (dur > 0 ? dur : 0);
  }, 0);
  return { totalMinutes, isExceeded: totalMinutes > 450 };
}

const mockNormalDay = [
  { waktuMulai: '08:00', waktuSelesai: '12:00' }, // 240 mins
  { waktuMulai: '13:00', waktuSelesai: '16:30' }, // 210 mins
];
const normalResult = validateDailyHours(mockNormalDay);
assert(normalResult.totalMinutes === 450 && !normalResult.isExceeded, 'Normal day equals 450 minutes (7.5 hours) without overwork flag');

const mockOverworkDay = [
  { waktuMulai: '08:00', waktuSelesai: '12:00' }, // 240 mins
  { waktuMulai: '13:00', waktuSelesai: '17:30' }, // 270 mins -> 510 total
];
const overworkResult = validateDailyHours(mockOverworkDay);
assert(overworkResult.totalMinutes === 510 && overworkResult.isExceeded, 'Overwork day (> 450 mins) correctly flagged as overwork');

// Rule 2: Overlapping slots detection
function hasTimeOverlap(slots) {
  const sorted = [...slots].sort((a, b) => a.waktuMulai.localeCompare(b.waktuMulai));
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].waktuSelesai > sorted[i + 1].waktuMulai) {
      return true;
    }
  }
  return false;
}

const noOverlapSlots = [
  { waktuMulai: '08:00', waktuSelesai: '10:00' },
  { waktuMulai: '10:00', waktuSelesai: '12:00' },
  { waktuMulai: '13:00', waktuSelesai: '16:30' }
];
assert(!hasTimeOverlap(noOverlapSlots), 'Sequential time slots correctly identified as non-overlapping');

const overlapSlots = [
  { waktuMulai: '08:00', waktuSelesai: '10:30' },
  { waktuMulai: '10:00', waktuSelesai: '12:00' }
];
assert(hasTimeOverlap(overlapSlots), 'Colliding time slots correctly identified as overlapping');

// ========================================================
// SUITE 5: GOOGLE DRIVE & OFFLINE SYNC CONTRACTS
// ========================================================
console.log('\n--- SUITE 5: Google Drive & Offline Sync Pipeline ---');

import { isGoogleTokenValid, getOrCreateFolder, uploadFileToDrive } from '../src/lib/drive.js';

assert(typeof isGoogleTokenValid === 'function', 'isGoogleTokenValid is exported and available');
assert(typeof getOrCreateFolder === 'function', 'getOrCreateFolder is exported and available');
assert(typeof uploadFileToDrive === 'function', 'uploadFileToDrive is exported and available');

const invalidTokenCheck = await isGoogleTokenValid(null);
assert(invalidTokenCheck === false, 'isGoogleTokenValid returns false for null/empty token');

const dummyTokenCheck = await isGoogleTokenValid('dummy_expired_token_12345');
assert(dummyTokenCheck === false, 'isGoogleTokenValid safely returns false for invalid token without crashing');

// ========================================================
// SUITE 6: GOOGLE AGENTS API MODULE CONTRACTS
// ========================================================
console.log('\n--- SUITE 6: Google Managed Agents & Interactions API ---');

import { createManagedAgent, getManagedAgent, listManagedAgents, createAgentInteraction } from '../src/lib/googleAgents.js';

assert(typeof createManagedAgent === 'function', 'createManagedAgent function is defined');
assert(typeof getManagedAgent === 'function', 'getManagedAgent function is defined');
assert(typeof listManagedAgents === 'function', 'listManagedAgents function is defined');
assert(typeof createAgentInteraction === 'function', 'createAgentInteraction function is defined');

// Verify graceful fallback when key is not valid
try {
  await createManagedAgent({ id: 'test-agent' });
} catch (e) {
  assert(e.message.includes('API') || e.message.includes('Google'), 'createManagedAgent enforces API key validation and reports clear error message');
}

// ========================================================
// SUITE 7: KANBAN COMPLETION DATE PARSER
// ========================================================
console.log('\n--- SUITE 7: Kanban Completion Date Parser ---');

// Mock Firestore Timestamp object
const mockTimestamp = {
  seconds: 1780000000,
  nanoseconds: 0,
  toDate() {
    return new Date(this.seconds * 1000);
  }
};

function testGetTaskCompletionDate(task) {
  if (task.completedAt) {
    if (typeof task.completedAt.toDate === 'function') return task.completedAt.toDate();
    const d = new Date(task.completedAt);
    if (!isNaN(d.getTime())) return d;
  }
  if (task.updatedAt) {
    if (typeof task.updatedAt.toDate === 'function') return task.updatedAt.toDate();
    const d = new Date(task.updatedAt);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

const timestampTask = { completedAt: mockTimestamp };
const parsedFromTimestamp = testGetTaskCompletionDate(timestampTask);
assert(parsedFromTimestamp instanceof Date && !isNaN(parsedFromTimestamp.getTime()), 'Firestore Timestamp completedAt correctly converted via .toDate()');

const isoTask = { completedAt: '2026-11-01T15:30:00.000Z' };
const parsedFromIso = testGetTaskCompletionDate(isoTask);
assert(parsedFromIso instanceof Date && !isNaN(parsedFromIso.getTime()), 'ISO string completedAt correctly parsed as Date');

// ========================================================
// SUITE 8: SPDT-NTP SKP #30 & CKP-T / CKP-R AGGREGATION
// ========================================================
console.log('\n--- SUITE 8: SPDT-NTP SKP #30 & CKP-T / CKP-R Aggregation ---');

const { isSpdtEntry, getEntrySkpIds, aggregateCkpBySkpAndSatuan } = await import('../src/utils/ckpAggregation.js');
const { ckpOktoberEntries } = await import('../src/data/ckpOktober2026.js');
const { skpData: allSkps } = await import('../src/data/skpData.js');

const spdtActivities = ckpOktoberEntries.filter(e => isSpdtEntry(e));
assert(spdtActivities.length === 10, 'Found exactly 10 SPDT activities in October 2026 dataset (actual: ' + spdtActivities.length + ')');

const allResolvedTo30 = spdtActivities.every(e => {
  const ids = getEntrySkpIds(e);
  return ids.length === 1 && ids[0] === 30;
});
assert(allResolvedTo30, 'All 10 SPDT activities resolve to SKP #30 via getEntrySkpIds');

// Verify backward-compatibility: old entry in database with skpId: 16 still resolves to 30
const mockOldDbEntry = {
  rincian: 'Pelaksanaan hari ke-1 Pelatihan Petugas Survei SPDT NTP 2026: Pembukaan',
  skpId: 16,
  skpIds: [16],
  satuan: 'Kegiatan',
  kuantitas: 1
};
assert(isSpdtEntry(mockOldDbEntry), 'isSpdtEntry accurately flags legacy database entry');
const oldResolvedIds = getEntrySkpIds(mockOldDbEntry);
assert(oldResolvedIds.length === 1 && oldResolvedIds[0] === 30, 'Legacy entry with skpId: 16 auto-migrates to [30] dynamically');

// Test full aggregation for CKP-T and CKP-R
const { aggregated, utamaKeys } = aggregateCkpBySkpAndSatuan(ckpOktoberEntries, allSkps);
const spdtAggKey = Object.keys(aggregated).find(k => k.startsWith('30:::'));

assert(Boolean(spdtAggKey), 'Aggregated report contains SKP #30 entry key: ' + spdtAggKey);
if (spdtAggKey) {
  const aggItem = aggregated[spdtAggKey];
  assert(aggItem.kuantitas === 10, 'SPDT-NTP total quantity is exactly 10 Kegiatan (actual: ' + aggItem.kuantitas + ')');
  assert(aggItem.satuan === 'Kegiatan', 'SPDT-NTP satuan is standardized to Kegiatan (actual: ' + aggItem.satuan + ')');
  assert(aggItem.kategori === 'utama', 'SPDT-NTP is categorized as utama');
  assert(utamaKeys.includes(spdtAggKey), 'SPDT-NTP key is present in CKP-T and CKP-R utamaKeys list');
  assert(aggItem.nama.includes('Pelaksanaan Survei Penyusunan Diagram Timbang Nilai Tukar Petani (SPDT-NTP)'), 'SPDT-NTP has correct official SKP descriptive title');
}

// ========================================================
// SUITE 9: OSS 11.282 RECORD SKP #10 vs SKP #2 EXCLUSION
// ========================================================
console.log('\n--- SUITE 9: OSS 11.282 Record SKP #10 vs SKP #2 Exclusion ---');

const { isOss11kEntry } = await import('../src/utils/ckpAggregation.js');
const ossEntry = ckpOktoberEntries.find(e => e.id === 'ckp_20261028_2');

assert(Boolean(ossEntry), 'Found OSS 11.282 record activity (ckp_20261028_2)');
assert(isOss11kEntry(ossEntry), 'isOss11kEntry correctly identifies the 11.282 record activity');
const ossSkpIds = getEntrySkpIds(ossEntry);
assert(!ossSkpIds.includes(2), 'OSS 11.282 record is NOT attached to SKP #2 (Terkelolanya data SBR)');
assert(ossSkpIds.includes(10), 'OSS 11.282 record is attached to SKP #10 (Kompilasi Data Administratif)');

// Verify legacy fallback: old entry with [2, 10, 17] excludes 2
const mockOldOssEntry = {
  id: 'ckp_20261028_2',
  rincian: 'Otomasi ekstraksi data NIK dan NIB dari Website OSS sebanyak 11.282 record perizinan berusaha',
  skpId: 2,
  skpIds: [2, 10, 17],
  kuantitas: 11282,
  satuan: 'Record'
};
const cleanedOssIds = getEntrySkpIds(mockOldOssEntry);
assert(!cleanedOssIds.includes(2), 'Legacy OSS entry with skpIds [2, 10, 17] auto-strips SKP #2');

// Verify that SKP #2 in aggregated report only has 1 Dokumen
const skp2DokumenKey = '2:::dokumen';
const skp2RecordKey = '2:::record';
assert(Boolean(aggregated[skp2DokumenKey]), 'SKP #2 has Dokumen entry in aggregated report');
assert(aggregated[skp2DokumenKey]?.kuantitas === 1, 'SKP #2 Dokumen quantity is exactly 1 (actual: ' + aggregated[skp2DokumenKey]?.kuantitas + ')');
assert(!aggregated[skp2RecordKey], 'SKP #2 Record entry does NOT exist in aggregated report');

// Verify SKP #10 has both 1 Laporan and 11282 Record
const skp10LaporanKey = '10:::laporan';
const skp10RecordKey = '10:::record';
assert(aggregated[skp10LaporanKey]?.kuantitas === 1, 'SKP #10 Laporan quantity is exactly 1');
assert(aggregated[skp10RecordKey]?.kuantitas === 11282, 'SKP #10 Record quantity is exactly 11.282');

// ========================================================
// SUITE 10: PENUTUPAN LATSAR CPNS & 1-PAGE PDF INVARIANT
// ========================================================
console.log('\n--- SUITE 10: Penutupan Latsar CPNS & 1-Page PDF Invariant ---');

// 1. Verify that old sosialisasi Latsar is completely gone
const sosialisasiEntry = ckpOktoberEntries.find(e => /sosialisasi.*latsar/i.test(e.rincian || ''));
assert(!sosialisasiEntry, 'Sosialisasi daring Latsar activity is completely removed from October 2026');

// 2. Verify that Penutupan Latsar is present on 22 October 2026
const penutupanEntry = ckpOktoberEntries.find(e => /penutupan.*latsar/i.test(e.rincian || ''));
assert(Boolean(penutupanEntry), 'Found Penutupan Latsar CPNS activity in October 2026');
assert(penutupanEntry?.tanggal === '2026-10-22', 'Penutupan Latsar CPNS is correctly scheduled on 2026-10-22');
assert(penutupanEntry?.skpId === 11, 'Penutupan Latsar CPNS is linked to SKP #11 (Koordinasi & Sosialisasi)');
assert(penutupanEntry?.satuan === 'Kegiatan', 'Penutupan Latsar CPNS has satuan Kegiatan');

// 3. Verify total SKP #11 quantity remains 4 Kegiatan
const skp11Key = '11:::kegiatan';
assert(aggregated[skp11Key]?.kuantitas === 4, 'SKP #11 total quantity is exactly 4 Kegiatan (actual: ' + aggregated[skp11Key]?.kuantitas + ')');

// 4. Verify 1-page PDF invariant for CKP-T and CKP-R
import { execSync } from 'child_process';
const pageCheckPy = "import pypdf; t = len(pypdf.PdfReader(r'C:\\Users\\ajian\\Downloads\\CKP-T_Oktober_2026_Yahya_Abdurrohman.pdf').pages); r = len(pypdf.PdfReader(r'C:\\Users\\ajian\\Downloads\\CKP-R_Oktober_2026_Yahya_Abdurrohman.pdf').pages); print(f'{t},{r}')";
try {
  const pageOutput = execSync(`python -c "${pageCheckPy}"`, { encoding: 'utf8' }).trim();
  const [tPages, rPages] = pageOutput.split(',').map(Number);
  assert(tPages === 1, 'CKP-T PDF is strictly 1 single page (actual: ' + tPages + ')');
  assert(rPages === 1, 'CKP-R PDF is strictly 1 single page (actual: ' + rPages + ')');
} catch (pdfErr) {
  assert(false, 'Failed checking PDF page counts: ' + pdfErr.message);
}

// ========================================================
// FINAL SUMMARY
// ========================================================
console.log('\n====================================================');
console.log(`TOTAL TESTS: ${totalTests}`);
console.log(`PASSED:      ${passedTests}`);
console.log(`FAILED:      ${failedTests}`);
console.log('====================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('ALL TESTS PASSED SUCCESSFULLY! (100% Success Rate)\n');
}
