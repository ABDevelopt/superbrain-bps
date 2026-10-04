# Referensi REST API KIPAPP BPS

## Konfigurasi Permintaan (Request Setup)
- **Base URL:** `https://kipapp.bps.go.id`
- **Wajib Header:**
  - `Authorization`: `Bearer <JWT_TOKEN>` (atau `x-auth: Bearer <JWT_TOKEN>`)
  - `Accept`: `application/json, text/plain, */*`

---

## 1. Modul Pengguna & Sesi

| Endpoint | Method | Header / Param | Deskripsi |
|---|---|---|---|
| `/api/app/status` | `GET` | - | Memeriksa ketersediaan server KIPAPP (maintenance/active) |
| `/api/v1/user` | `GET` | - | Mengambil data ASN: NIP, nama, jabatan, unit kerja, satker, status PLT/PLH |
| `/api/v1/switch` | `GET` | `niplama={nip}` | Berpindah konteks role aktif (Pelaksana/Ketua Tim/PLT) |
| `/api/v1/notifikasi` | `GET` | `niplama={nip}` | Mengambil notifikasi kegiatan belum dinilai / belum dikirim |

---

## 2. Modul Dashboard & Ringkasan

| Endpoint | Method | Parameter | Deskripsi |
|---|---|---|---|
| `/api/v1/dashboard/rkpegawai` | `GET` | `niplama={nip}` | Rekap status rencana kinerja pegawai |
| `/api/v1/dashboard/rkpegawai/tanpakegiatan` | `GET` | `niplama={nip}` | Rencana Kinerja (RK) yang belum memiliki log kegiatan |
| `/api/v1/dashboard/kegiatanpegawai/belumkirim` | `GET` | `niplama={nip}` | Jumlah kegiatan yang masih berstatus draf (belum dikirim) |
| `/api/v1/dashboard/skpbulanini` | `GET` | `niplama={nip}` | Status dokumen SKP aktif bulan berjalan |

---

## 3. Modul Perencanaan: SKP, RK, & IKI

| Endpoint | Method | Format Body | Deskripsi |
|---|---|---|---|
| `/api/v1/tahun` | `GET` | Query `jenis=2` | Daftar tahun perencanaan kinerja |
| `/api/v1/skp` | `GET` | Query `periodeid={id}&pegawaiid={id}&jenis={1\|2}` | Mengambil daftar SKP pegawai (1 = Tahunan, 2 = Periodik) |
| `/api/v1/skp` | `POST` | JSON | Membuat dokumen SKP Tahunan atau Periodik baru |
| `/api/v1/skp/rk` | `GET` | Query `skpid={id}&direct=1` | Mengambil seluruh butir RK pada suatu SKP lengkap dengan `tglselesai` dan `jmliki` |
| `/api/v1/skp/rk` | `POST` | JSON | Menambahkan butir Rencana Kinerja (RK) baru |
| `/api/v1/skp/rk` | `PUT` | `x-www-form-urlencoded` | **Tandai Selesai RK** atau update data RK |
| `/api/v1/skp/iki` | `GET` | Query `skpid={id}` | Mengambil seluruh butir IKI di bawah SKP |
| `/api/v1/skp/iki` | `POST` | JSON | Menambahkan IKI baru ke dalam butir RK |

### A. Payload Pembuatan SKP Periodik (`POST /api/v1/skp`):
```json
{
  "pegawaiid": "180503",
  "periodeid": 8,
  "periodepenilaianid": 3,
  "jenis": 2,
  "isrujukskp": 1,
  "skpid": 1203239
}
```
*Catatan:* `periodepenilaianid`: `1` (TW I), `2` (TW II), `3` (TW III), `4` (TW IV).

### B. Payload Tambah RK Baru (`POST /api/v1/skp/rk`):
```json
{
  "skpid": 1439745,
  "jenis": 2,
  "rencanakinerja": "Terlaksananya kegiatan orientasi, penempatan, dan Pelatihan Dasar (Latsar) CPNS BPS Tahun 2026",
  "lingkupid": null
}
```

### C. Payload Tambah IKI Baru (`POST /api/v1/skp/iki`):
```json
{
  "rkid": 14622434,
  "skpid": 1439745,
  "aspek": "Kuantitas",
  "indikator": "Tingkat kuantitas orientasi dan Latsar CPNS",
  "target": "100",
  "satuan": "persen"
}
```

### D. Payload Menandai Selesai RK (`PUT /api/v1/skp/rk`):
> **PENTING:** Wajib menggunakan `Content-Type: application/x-www-form-urlencoded`!
```
id=14622309&skpid=1439745&jenis=1&rencanakinerja=Terkelolanya perangkat IT dan Aplikasi BPS&lingkupid=&isselesai=1
```

---

## 4. Modul Pelaksanaan Kinerja: Log Kegiatan Harian

| Endpoint | Method | Format Body | Deskripsi |
|---|---|---|---|
| `/api/v1/kegiatan` | `GET` | Query `skpid={id}` | Mengambil seluruh log kegiatan pada periode SKP |
| `/api/v1/kegiatan` | `POST` | JSON | Menambahkan catatan kegiatan harian (Kuantitas / Kualitas) |
| `/api/v1/kegiatan/{id}` | `PUT` | JSON | Memperbarui catatan kegiatan harian yang belum dikirim |
| `/api/v1/kegiatan/{id}` | `DELETE`| - | Menghapus catatan kegiatan harian |
| `/api/v1/kegiatan/kirim` | `POST` | JSON | Mengirim kegiatan terpilih ke atasan penilai |

### Format Payload Tambah Kegiatan Berpasangan:
```json
{
  "skpid": 1439745,
  "rkid": 14622326,
  "kegiatan": "Pengambilan data progres Sensus Ekonomi 2026",
  "tanggal": "2026-07-02",
  "tanggalselesai": "2026-07-02",
  "progres": 100,
  "capaian": "Tingkat kuantitas pengambilan data progres Sensus Ekonomi 2026 100 persen",
  "datadukung": "https://drive.google.com/drive/folders/...",
  "iscapaianskp": 1
}
```

### Format Payload Kirim Kegiatan ke Atasan (`POST /api/v1/kegiatan/kirim`):
```json
{
  "kegiatanids": ["15789123", "15789124", "15789125"]
}
```

---

## 5. Modul FWA (Flexible Work Arrangement)

| Endpoint | Method | Format Body | Deskripsi |
|---|---|---|---|
| `/api/v2/fwa/pengajuan/data` | `POST` | JSON Jadwal Bulanan | Mengambil / menyimpan pengajuan jadwal kerja WFO/WFH/WFA |
