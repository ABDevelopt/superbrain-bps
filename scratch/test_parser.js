const fs = require('fs');

// Read API key from .env.local
const envFile = fs.readFileSync('.env.local', 'utf8');
const match = envFile.match(/GEMINI_API_KEY=(.*)/);
const apiKey = match ? match[1].trim() : '';

const skpData = [
  { id: 1, nama: "Terkelolanya perangkat IT dan Aplikasi BPS" },
  { id: 2, nama: "Terkelolanya data SBR Sesuai SOP dan tepat waktu" },
  { id: 3, nama: "Terkelolanya Peta, Muatan Wilkerstat, dan Master File Desa Sesuai SOP dan tepat waktu" },
  { id: 4, nama: "Terlaksananya kegiatan Pelayanan Statistik Terpadu (PST) sesuai SOP dan akuntabel" },
  { id: 5, nama: "Terlaksananya Pengelolaan Konten Media Sosial, Website, dan Kehumasan yang sesuai SOP" },
  { id: 6, nama: "Terlaksananya penyusunan Publikasi Kecamatan Dalam Angka (KDA) yang sesuai standar dan tepat waktu" },
  { id: 7, nama: "Terlaksananya pelaporan Kinerja Pegawai (ASN/PPPK) yang menyeluruh dan tepat waktu" },
  { id: 8, nama: "Terlaksananya Pembinaan Statistik Sektoral dan Rekomendasi Statistik yang sesuai SOP" },
  { id: 9, nama: "Terlaksananya Survei Kebutuhan Data (SKD) yang sesuai standar dan tepat waktu" },
  { id: 10, nama: "Tersedianya kompilasi data administratif yang lengkap dan up to date" },
  { id: 11, nama: "Terlaksananya koordinasi dan sosialisasi kegiatan kepada institusi atau lembaga yang kondusif dan solutif" },
  { id: 12, nama: "Terlaksananya Pelatihan Petugas SAKERNAS Tahun 2026 sesuai SOP" },
  { id: 13, nama: "Terlaksananya Kegiatan Lapangan SAKERNAS Tahun 2026 sesuai SOP" },
  { id: 14, nama: "Terlaksananya Pemeriksaan, Editing, dan Validasi SAKERNAS Tahun 2026 sesuai SOP" },
  { id: 15, nama: "Terlaksananya pemeriksaan anomali dan tindak lanjut SAKERNAS Tahun 2026 sesuai SOP" },
  { id: 16, nama: "Terlaksananya pelatihan petugas Susenas dan Seruti Tahun 2026 secara tepat waktu dan sesuai SOP" },
  { id: 17, nama: "Terlaksananya Sensus Ekonomi 2026 sesuai SOP dan tepat waktu" },
  { id: 18, nama: "Terlaksananya Administrasi BMN sesuai SOP dan tepat waktu" },
  { id: 19, nama: "Terlaksananya Implementasi Zona Integritas yang sesuai SOP dan Tepat Waktu" },
  { id: 20, nama: "Terlaksananya pemeriksaan lapangan susenas berbasis rumahtangga yang tepat waktu dan sesuai SOP" },
  { id: 21, nama: "Terlaksananya pemeriksaan, editing, dan coding susenas berbasis ruta yang menyeluruh dan sesuai SOP" },
  { id: 22, nama: "Terlaksananya pemeriksaan anomali data Survei Sosial Ekonomi Nasional (susenas) tahun 2026 yang menyeluruh dan sesuai SOP" },
  { id: 23, nama: "Terlaksananya Pelatihan Ground Check Data Penerima Bantuan Iuran (PBI) yang tepat waktu dan sesuai SOP" },
  { id: 24, nama: "Terlaksananya Pelaporan SPT Tahunan Pajak Penghasilan yang Lengkap dan Tepat Waktu" },
  { id: 25, nama: "Terlaksananya pengembangan dan pengelolaan aplikasi Halo BPS PPU" },
  { id: 26, nama: "Terlaksananya penyusunan Laporan PDRB Lapangan Usaha 2021-2025 sesuai SOP dan tepat waktu" },
  { id: 27, nama: "Tersusunnya Laporan PDRB Pengeluaran 2021–2025 (Penyesuaian Template Dokumen)" },
  { id: 28, nama: "Terlaksananya Pencetakan Surat Pemberitahuan Ground Check PLN dan Kartu Petugas" },
  { id: 29, nama: "Terlaksananya Kepanitiaan Pelatihan Survei SKLNPRT" }
];

const skpContext = skpData
  .map((item) => `ID: ${item.id}, Nama: "${item.nama}"`)
  .join('\n');

function getSystemPrompt(contextData = null) {
  let contextString = 'Tidak ada data konteks saat ini.';
  if (contextData) {
    contextString = JSON.stringify(contextData, null, 2);
  }

  return `
Anda adalah asisten kecerdasan buatan untuk Badan Pusat Statistik (BPS).
Tugas Anda adalah membaca dan menganalisis berkas/teks yang diberikan (seperti foto/PDF surat undangan atau perintah tugas), mengekstrak informasinya secara cermat, dan memetakannya ke aksi CRUD pada database pengguna, atau sekadar membalas percakapan.

Pertama, pahami data pengguna yang ada saat ini di sistem:
${contextString}

Berikut adalah daftar 29 SKP BPS sebagai referensi pencocokan kegiatan:
${skpContext}

TUGAS UTAMA EKSTRAKSI & COCOKKAN SKP:
1. **Ekstraksi Tempat/Lokasi**: Cari keterangan tempat/lokasi acara (misalnya nama aula, nama hotel, ruang rapat BPS, link Zoom/online meeting, platform virtual, kota, dsb) di dalam berkas/teks, dan isi ke dalam field "lokasi" pada data Jadwal.
2. **Saran SKP Otomatis**: Analisis konteks kegiatan (judul surat, isi acara, tim kerja yang bersangkutan) dan pilih butir SKP BPS yang paling cocok dari daftar 29 SKP di atas. Masukkan nomor ID SKP tersebut (1 sampai 29) ke dalam field "skpId".
   - Contoh: Jika tentang SAKERNAS, pilih SKP yang berkaitan dengan SAKERNAS. Jika tentang IT/Aplikasi/Website, pilih SKP IT. Jika tentang administrasi BMN/Pajak/ZI, pilih SKP Administrasi yang sesuai.

Tentukan APAKAH instruksi/dokumen ini bertujuan untuk:
1. "CREATE_JADWAL", "UPDATE_JADWAL", "DELETE_JADWAL": Untuk menambah/mengedit/menghapus jadwal acara (misal: Surat Undangan, Rapat).
2. "CREATE_CKP", "UPDATE_CKP", "DELETE_CKP": Untuk menambah/mengedit/menghapus laporan hasil kerja harian (CKP).
3. "CREATE_TASK", "UPDATE_TASK", "DELETE_TASK": Untuk menambah/mengedit/menghapus tugas di Papan Kanban.
4. "REPLY_TEXT": Jika pengguna hanya bertanya atau mengobrol biasa tanpa instruksi modifikasi data.

Ekstrak data ke dalam format JSON dengan spesifikasi detail:
- Jika type "CREATE_JADWAL", objek "data" WAJIB memiliki field:
  - "judul" (string)
  - "tanggal" (string)
  - "waktu" (string)
  - "lokasi" (string, WAJIB diisi dengan tempat/alamat/zoom meeting yang ada di dokumen. Jangan kosongkan!)
  - "skpId" (integer, WAJIB diisi dengan rekomendasi ID SKP 1-29 yang paling relevan dari referensi di atas!)
  - "kategori" (string)
  - "urgensi" (string)
  - "deskripsi" (string)

- Jika type "CREATE_TASK", objek "data" WAJIB memiliki field:
  - "judul" (string)
  - "deskripsi" (string)
  - "skpId" (integer, WAJIB diisi dengan rekomendasi ID SKP 1-29 yang paling relevan dari referensi di atas!)
  - "urgensi" (string)
  - "peran" (string)
  - "status" (string)

- Jika type "CREATE_CKP", objek "data" WAJIB memiliki field:
  - "tanggal" (string)
  - "waktuMulai" (string)
  - "waktuSelesai" (string)
  - "skpId" (integer, WAJIB diisi dengan rekomendasi ID SKP 1-29 yang paling relevan dari referensi di atas!)
  - "rincian" (string)
  - "kuantitas" (integer)
  - "satuan" (string)
  - "timKerja" (string)

Jika type berawalan "UPDATE_" atau "DELETE_", field dalam "data" WAJIB mencantumkan:
- id: ID unik record yang akan diedit/dihapus (string)

Jika type "REPLY_TEXT", field dalam "data" WAJIB mencantumkan:
- replyMessage: Teks balasan Anda untuk pengguna (string)

PENTING:
- Pastikan respon HANYA berupa JSON valid sesuai schema bersarang di atas.
- Jangan tambahkan markdown \`\`\`json.
- Jangan gunakan emoji.
`;
}

const responseSchema = {
  type: 'OBJECT',
  properties: {
    type: { type: 'STRING', enum: ['CREATE_JADWAL', 'UPDATE_JADWAL', 'DELETE_JADWAL', 'CREATE_CKP', 'UPDATE_CKP', 'DELETE_CKP', 'CREATE_TASK', 'UPDATE_TASK', 'DELETE_TASK', 'REPLY_TEXT'] },
    data: {
      type: 'OBJECT',
      properties: {
        id: { type: 'STRING' },
        replyMessage: { type: 'STRING' },
        judul: { type: 'STRING' },
        tanggal: { type: 'STRING' },
        waktu: { type: 'STRING' },
        waktuSelesai: { type: 'STRING' },
        waktuMulai: { type: 'STRING' },
        lokasi: { type: 'STRING' },
        deskripsi: { type: 'STRING' },
        rincian: { type: 'STRING' },
        kuantitas: { type: 'INTEGER' },
        satuan: { type: 'STRING' },
        timKerja: { type: 'STRING' },
        skpId: { type: 'INTEGER' },
        kategori: { type: 'STRING' },
        urgensi: { type: 'STRING' },
        peran: { type: 'STRING' },
        status: { type: 'STRING' },
      },
      required: ['lokasi', 'skpId']
    }
  },
  required: ['type', 'data']
};

async function callGemini(contents) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const requestBody = {
    contents,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema,
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(`Gemini API Error: ${response.status} ${response.statusText}`);
  }

  const responseData = await response.json();
  const rawText = responseData.candidates?.[0]?.content?.parts?.[0]?.text;
  return JSON.parse(rawText.trim());
}

async function run() {
  const textContent = "Surat Undangan: Briefing Petugas Task Force Sensus Ekonomi (SE) Tahun 2026. Tempat: Aula BPS Kabupaten Penajam Paser Utara. Waktu: Rabu, 3 Juni 2026 pukul 08:30 WITA.";
  console.log("Testing with mock text:", textContent);

  const parsed = await callGemini([
    {
      parts: [
        { text: getSystemPrompt() + '\n\nBerikut teksnya:\n"' + textContent + '"' }
      ]
    }
  ]);

  console.log("Parsed result:", JSON.stringify(parsed, null, 2));
}

run().catch(console.error);
