import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    value = value.trim().replace(/^['"]|['"]$/g, '');
    env[match[1]] = value;
  }
});

const apiKey = env.NEXT_PUBLIC_FIREBASE_API_KEY;
const projectId = env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const refreshToken = fs.readFileSync('scripts/refreshToken.txt', 'utf8').trim();

async function getIdToken() {
  const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    })
  });
  const data = await res.json();
  if (data.error) throw new Error(JSON.stringify(data.error));
  return { idToken: data.id_token, userId: data.user_id };
}

const entriesToCreate = [
  // --- SEBELUM 12 SEPTEMBER 2026 ---
  // 2026-09-02 (Rabu)
  {
    tanggal: '2026-09-02',
    waktuMulai: '07:30',
    waktuSelesai: '11:00',
    durasi: 210,
    rincian: 'Mengurus administrasi petugas sensus ekonomi 2026',
    skpId: 17,
    skpIds: [17],
    timKerja: 'Tim Statistik Harga & Sensus Ekonomi',
    kuantitas: 1,
    satuan: 'Dokumen'
  },
  {
    tanggal: '2026-09-02',
    waktuMulai: '11:00',
    waktuSelesai: '14:00',
    durasi: 180,
    rincian: 'Pengembangan aplikasi monitoring sensus dan survei',
    skpId: 1,
    skpIds: [1],
    timKerja: 'Subbagian Umum',
    kuantitas: 1,
    satuan: 'Kegiatan'
  },

  // 2026-09-04 (Jumat)
  {
    tanggal: '2026-09-04',
    waktuMulai: '11:00',
    waktuSelesai: '13:30',
    durasi: 150,
    rincian: 'Mengurus administrasi petugas sensus ekonomi 2026',
    skpId: 17,
    skpIds: [17],
    timKerja: 'Tim Statistik Harga & Sensus Ekonomi',
    kuantitas: 1,
    satuan: 'Dokumen'
  },
  {
    tanggal: '2026-09-04',
    waktuMulai: '13:30',
    waktuSelesai: '16:30',
    durasi: 180,
    rincian: 'Pengembangan aplikasi monitoring sensus dan survei',
    skpId: 1,
    skpIds: [1],
    timKerja: 'Subbagian Umum',
    kuantitas: 1,
    satuan: 'Kegiatan'
  },

  // 2026-09-08 (Selasa)
  {
    tanggal: '2026-09-08',
    waktuMulai: '07:30',
    waktuSelesai: '08:00',
    durasi: 30,
    rincian: 'Mengurus administrasi petugas sensus ekonomi 2026',
    skpId: 17,
    skpIds: [17],
    timKerja: 'Tim Statistik Harga & Sensus Ekonomi',
    kuantitas: 1,
    satuan: 'Dokumen'
  },
  {
    tanggal: '2026-09-08',
    waktuMulai: '12:00',
    waktuSelesai: '16:00',
    durasi: 240,
    rincian: 'Pengembangan aplikasi monitoring sensus dan survei',
    skpId: 1,
    skpIds: [1],
    timKerja: 'Subbagian Umum',
    kuantitas: 1,
    satuan: 'Kegiatan'
  },

  // 2026-09-09 (Rabu)
  {
    tanggal: '2026-09-09',
    waktuMulai: '07:30',
    waktuSelesai: '09:00',
    durasi: 90,
    rincian: 'Pengembangan aplikasi monitoring sensus dan survei',
    skpId: 1,
    skpIds: [1],
    timKerja: 'Subbagian Umum',
    kuantitas: 1,
    satuan: 'Kegiatan'
  },
  {
    tanggal: '2026-09-09',
    waktuMulai: '15:00',
    waktuSelesai: '16:00',
    durasi: 60,
    rincian: 'Mengurus administrasi petugas sensus ekonomi 2026',
    skpId: 17,
    skpIds: [17],
    timKerja: 'Tim Statistik Harga & Sensus Ekonomi',
    kuantitas: 1,
    satuan: 'Dokumen'
  },

  // 2026-09-11 (Jumat)
  {
    tanggal: '2026-09-11',
    waktuMulai: '11:00',
    waktuSelesai: '13:30',
    durasi: 150,
    rincian: 'Mengurus administrasi petugas sensus ekonomi 2026',
    skpId: 17,
    skpIds: [17],
    timKerja: 'Tim Statistik Harga & Sensus Ekonomi',
    kuantitas: 1,
    satuan: 'Dokumen'
  },
  {
    tanggal: '2026-09-11',
    waktuMulai: '13:30',
    waktuSelesai: '16:30',
    durasi: 180,
    rincian: 'Pengembangan aplikasi monitoring sensus dan survei',
    skpId: 1,
    skpIds: [1],
    timKerja: 'Subbagian Umum',
    kuantitas: 1,
    satuan: 'Kegiatan'
  },

  // --- SESUDAH 21 SEPTEMBER 2026 ---
  // 2026-09-22 (Selasa)
  {
    tanggal: '2026-09-22',
    waktuMulai: '07:30',
    waktuSelesai: '09:00',
    durasi: 90,
    rincian: 'Mengurus administrasi petugas sensus ekonomi 2026',
    skpId: 17,
    skpIds: [17],
    timKerja: 'Tim Statistik Harga & Sensus Ekonomi',
    kuantitas: 1,
    satuan: 'Dokumen'
  },
  {
    tanggal: '2026-09-22',
    waktuMulai: '14:00',
    waktuSelesai: '16:00',
    durasi: 120,
    rincian: 'Penanganan anomali sensus ekonomi 2026',
    skpId: 17,
    skpIds: [17],
    timKerja: 'Tim Statistik Harga & Sensus Ekonomi',
    kuantitas: 1,
    satuan: 'Dokumen'
  },

  // 2026-09-23 (Rabu)
  {
    tanggal: '2026-09-23',
    waktuMulai: '07:30',
    waktuSelesai: '09:00',
    durasi: 90,
    rincian: 'Pemeriksaan isian kuesioner susenas 2026',
    skpId: 21,
    skpIds: [21],
    timKerja: 'Tim Statistik Sosial',
    kuantitas: 5,
    satuan: 'Dokumen'
  },
  {
    tanggal: '2026-09-23',
    waktuMulai: '14:00',
    waktuSelesai: '16:00',
    durasi: 120,
    rincian: 'Pemeriksaan isian seruti triwulan III 2026 (september 2026)',
    skpId: 31,
    skpIds: [31],
    timKerja: 'Tim Statistik Sosial',
    kuantitas: 5,
    satuan: 'Dokumen'
  },

  // 2026-09-29 (Selasa)
  {
    tanggal: '2026-09-29',
    waktuMulai: '07:30',
    waktuSelesai: '09:00',
    durasi: 90,
    rincian: 'Pengembangan desain ulang frontend fasih-sm',
    skpId: 1,
    skpIds: [1],
    timKerja: 'Subbagian Umum',
    kuantitas: 1,
    satuan: 'Kegiatan'
  },
  {
    tanggal: '2026-09-29',
    waktuMulai: '14:00',
    waktuSelesai: '16:00',
    durasi: 120,
    rincian: 'Penanganan anomali sensus ekonomi 2026',
    skpId: 17,
    skpIds: [17],
    timKerja: 'Tim Statistik Harga & Sensus Ekonomi',
    kuantitas: 1,
    satuan: 'Dokumen'
  }
];

async function main() {
  const { idToken, userId } = await getIdToken();
  console.log(`Authenticated as user ${userId}`);

  // 1. Create all new CKP entries
  console.log(`\nAdding ${entriesToCreate.length} new CKP entries...`);
  for (const entry of entriesToCreate) {
    const firestoreDoc = {
      fields: {
        userId: { stringValue: userId },
        tanggal: { stringValue: entry.tanggal },
        waktuMulai: { stringValue: entry.waktuMulai },
        waktuSelesai: { stringValue: entry.waktuSelesai },
        durasi: { integerValue: String(entry.durasi) },
        rincian: { stringValue: entry.rincian },
        kuantitas: { integerValue: String(entry.kuantitas) },
        satuan: { stringValue: entry.satuan },
        skpId: { integerValue: String(entry.skpId) },
        skpIds: {
          arrayValue: {
            values: entry.skpIds.map(id => ({ integerValue: String(id) }))
          }
        },
        timKerja: { stringValue: entry.timKerja },
        buktiDukung: { stringValue: '' },
        buktiDukungStatus: { stringValue: 'kosong' },
        buktiPresensi: { nullValue: null },
        fromScheduleEventId: { nullValue: null },
        sourceScheduleId: { nullValue: null },
        sourceTaskId: { nullValue: null },
        sumber: { stringValue: 'manual' },
        createdAt: { timestampValue: new Date().toISOString() }
      }
    };

    const res = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/ckp`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(firestoreDoc)
    });

    const data = await res.json();
    if (!res.ok) {
      console.error(`Failed to create entry for ${entry.tanggal}:`, JSON.stringify(data));
    } else {
      const docId = data.name.split('/').pop();
      console.log(`✓ Created: [${entry.tanggal}] ${entry.waktuMulai} - ${entry.waktuSelesai} | ${entry.rincian} (Doc ID: ${docId})`);
    }
  }

  // 2. Patch 2026-09-25 entry (id: bRGxzAn44u1GpfBdBwpf) to stretch to 16:30
  console.log('\nStretching Friday 2026-09-25 entry to 16:30...');
  const patchDocId = 'bRGxzAn44u1GpfBdBwpf';
  const patchRes = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/ckp/${patchDocId}?updateMask.fieldPaths=waktuSelesai&updateMask.fieldPaths=durasi`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fields: {
          waktuSelesai: { stringValue: '16:30' },
          durasi: { integerValue: '455' }
        }
      })
    }
  );
  const patchData = await patchRes.json();
  if (!patchRes.ok) {
    console.error('Failed to stretch Friday entry:', JSON.stringify(patchData));
  } else {
    console.log('✓ Friday 2026-09-25 entry stretched to 16:30 successfully.');
  }

  console.log('\nAll operations completed successfully!');
}

main().catch(console.error);
