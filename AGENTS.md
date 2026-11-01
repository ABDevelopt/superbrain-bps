# SuperBrain BPS & Antigravity Developer Guide

Dokumen ini adalah panduan arsitektur, standar teknis, dan arahan pengembang bagi seluruh AI Agent Antigravity yang bekerja pada repositori **SuperBrain BPS** (`D:\superbrain`).

---

## 1. Ikhtisar Arsitektur Aplikasi

**SuperBrain BPS** adalah aplikasi manajemen kinerja, produktivitas, dan otomasi administrasi terpadu bagi aparatur Badan Pusat Statistik (BPS) Kabupaten Penajam Paser Utara (dan unit kerja BPS lainnya).

- **Framework:** Next.js 16 (App Router, Turbopack, React 19).
- **Database:** Google Cloud Firestore (koleksi multi-tenant berbasis `userId`).
- **Cloud Storage & Sync:** Google Drive API v3 (OAuth2 Client-Side Picker & Direct Upload), Google Calendar API.
- **Offline Storage:** IndexedDB (`idb` v8) untuk media geotag kamera, antrean berkas offline (`pending_uploads`), dan local caching.
- **AI Engine:** Google Gemini API (`v1beta`) dengan *resilient multi-tier fallback*:
  `gemini-2.5-flash` $\rightarrow$ `gemini-2.0-flash` $\rightarrow$ `gemini-2.0-flash-lite` $\rightarrow$ `gemini-1.5-flash` $\rightarrow$ `gemini-2.5-pro` $\rightarrow$ `gemini-1.5-pro`.

---

## 2. Peta Modul & Koleksi Firestore

| Modul | Rute Halaman | Koleksi Firestore | Deskripsi Utama |
|---|---|---|---|
| **Dashboard** | `/` | Agregat semua koleksi | Ringkasan KPI harian/bulanan, kalender mini, status tugas, dan quick actions. |
| **CKP (Kinerja)** | `/ckp` | `ckp`, `dinas_lapangan` | Pencatatan kegiatan harian (7,5 jam/hari, anti-overlap), tautan SKP, bukti dukung GDrive, ekspor resmi Excel (CKP-R & CKP-T). |
| **SKP** | `/skp` | `skp` | Matriks 29 butir SKP BPS berbasis PermenPAN-RB No. 6 Tahun 2022 (RHK & IKI). |
| **Kalender** | `/schedule` | `schedule` | Jadwal kerja, rapat, tenggat waktu, pengingat cron Telegram, AI invitation parser. |
| **Papan Kanban** | `/tasks` | `tasks` | Manajemen kartu tugas, subtask checklist, filter waktu selesai (Hari Ini, 7 Hari, Bulan Ini), Pomodoro focus mode. |
| **Dinas Lapangan** | `/dinas-lapangan` | `perjalanan_dinas`, `dinas_lapangan` | Manajemen Surat Tugas, template alur perjalanan standar, ekspor laporan Word (.doc/docx), cetak lembar foto dokumentasi A4, sinkronisasi offline. |
| **Kamera Geotag** | `/camera` | `ckp`, `schedule` | Pengambilan foto & video dengan watermark GPS latitude/longitude, tanggal, waktu WITA, dan nama kegiatan. |
| **Kompresi File** | `/compress` | - | Kompresi citra dan PDF client-side 60–80% hemat kuota Google Drive. |
| **Pemendek Link** | `/short-links`, `/s/[slug]` | `short_links` | Pemendek URL kedinasan custom slug. |

---

## 3. Sistem Aksi AI Antigravity (`ChatActionContext`)

SuperBrain mengintegrasikan asisten AI global (`AIChatbot`) dengan event bus terpadu:

```mermaid
flowchart LR
    User["Pegawai BPS (Prompt / Dokumen)"] --> AIChatbot["AIChatbot (src/components/AIChatbot.js)"]
    AIChatbot --> GeminiAPI["Google Gemini API (2.5-Flash / 2.0-Flash)"]
    GeminiAPI -->|Function Call| Bus["ChatActionContext Event Bus"]
    Bus -->|Jika Halaman Terbuka| PageListener["Page Listener (CKP / Tasks / Schedule / DL)"]
    Bus -->|Fallback (Halaman Lain / Dashboard)| GlobalExec["Firestore Direct Executor"]
    GlobalExec --> Firestore[("Firestore Database")]
```

### Daftar Aksi yang Didukung:
- `CREATE_TASK`, `UPDATE_TASK`, `DELETE_TASK` (Papan Kanban)
- `CREATE_SCHEDULE`, `UPDATE_SCHEDULE`, `DELETE_SCHEDULE` (Kalender)
- `CREATE_CKP`, `UPDATE_CKP`, `DELETE_CKP` (Log Kinerja)
- `CREATE_DINAS_LAPANGAN` (Surat Tugas & Perjalanan Dinas)

---

## 4. Kaidah Mutlak Pengembang (Rules of Engagement)

1. **Kepatuhan Zero PII & Zero Data Egress:**
   - Dilarang mengirim data pribadi pegawai (NIK, nomor telepon pribadi, email pribadi, password) atau data mikro sensus/survei responden BPS ke prompt LLM atau cloud publik.
2. **Integritas Baris & Karakter (Line Endings):**
   - Gunakan format **LF (`\n`)** pada berkas JavaScript/CSS untuk konsistensi linting dan git.
3. **Preservasi Dokumentasi:**
   - Pertahankan seluruh komentar arsitektural dan docstrings yang sudah ada.
4. **Verifikasi Build:**
   - Setiap modifikasi kode **WAJIB** diverifikasi dengan perintah `npm run build` sebelum di-commit dan di-push ke branch utama.
5. **Skor AI & Fallback:**
   - Jangan pernah melakukan *hardcoding* model tunggal pada endpoint AI. Selalu gunakan *fallback loop* ke model aktif Google Gemini.
