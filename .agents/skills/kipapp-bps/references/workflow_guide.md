# Panduan Alur Kerja Bisnis KIPAPP BPS

## 1. Kerangka Cascading Kinerja ASN BPS
Sesuai PermenPAN-RB No. 6 Tahun 2022, alur penyusunan kinerja berjenjang:
```
Renstra BPS (5 Tahunan)
       ↓
Perjanjian Kinerja (PK) Pimpinan Satker
       ↓
Rencana Kinerja (RK) Ketua Tim Kerja
       ↓
Matriks Pembagian Peran dan Hasil (MPH)
       ↓
Rencana Kinerja (RK) & IKI Anggota Tim (SKP)
       ↓
Pelaksanaan Harian (Logbook Kegiatan Berpasangan & Bukti Dukung)
       ↓
Evaluasi & Umpan Balik Berkelanjutan (Feedback & Rating Kuadran)
```

---

## 2. Siklus Kerja Periodik & Triwulanan

### A. Awal Periode / Triwulan:
1. Pastikan SKP periode sebelumnya telah **selesai dinilai dan disetujui atasan**.
2. Buat SKP Triwulan baru dengan memilih **"Rujuk SKP Tahunan"** agar seluruh RK master tersalin otomatis.
3. Cek apakah ada penugasan baru dari Tim Kerja (misalnya: *Latsar CPNS*, *Survei Seruti*, dll.) yang belum ada di daftar RK.
4. Tambahkan butir RK baru sebagai Kinerja Tambahan jika diperlukan, dan **wajib pasang sepasang IKI (Kuantitas & Kualitas)**.

### B. Sepanjang Periode (Harian / Bulanan):
1. Mengacu pada laporan kinerja harian / CKP bulanan.
2. Setiap kegiatan dicatat **berpasangan (2 entri)**:
   - 1 entri aspek Kuantitas.
   - 1 entri aspek Kualitas.
3. Sertakan tautan Google Drive / Google Docs / Spreadsheet untuk setiap kegiatan tanpa ada yang kosong.
4. Pastikan progres diisi 100%.
5. Lakukan pengiriman kegiatan (`POST /api/v1/kegiatan/kirim`) secara berkala agar kegiatan memiliki tanggal kirim (`tanggalkirim`).

### C. Akhir Periode / Triwulan (Sebelum Pengiriman SKP):
1. **Verifikasi Bukti Dukung:** Pastikan 100% kegiatan memiliki link bukti dukung valid.
2. **Verifikasi IKI:** Pastikan seluruh butir RK memiliki minimal 2 IKI (Kuantitas & Kualitas). Tidak boleh ada RK tanpa IKI.
3. **Tandai Selesai:** Eksekusi penandaan selesai (`isselesai: 1` via `PUT /api/v1/skp/rk`) untuk seluruh RK agar kolom status pelaksanaan berubah menjadi centang hijau "Selesai".
4. **Kirim SKP Periodik:** Masuk ke menu SKP Periodik dan klik tombol **"Kirim SKP untuk dinilai"**.

---

## 3. Kebijakan Rencana Kinerja (RK) Lintas Triwulan

Dalam pelaksanaan tugas sehari-hari:
1. **Kegiatan Musiman / Terjadwal:**
   - Beberapa butir RK dari SKP Tahunan hanya dilaksanakan pada triwulan tertentu (misalnya *Sakernas* di Februari/Agustus, *PDRB Lapangan Usaha* di Mei, *Susenas* di Maret/September, atau *SPT Pajak* di Triwulan I).
2. **Praktik Terbaik di BPS:**
   - RK yang sudah selesai di triwulan sebelumnya **tidak perlu dihapus dari triwulan berikutnya**.
   - Biarkan RK tersebut tetap tercantum di SKP Periodik dengan saldo realisasi kegiatan 0.
   - Tetap pasang IKI dan tandai selesai.
   - Sistem KIPAPP BPS dan atasan penilai menerima hal ini secara sah karena evaluasi tahunan akan mengompilasi seluruh triwulan secara utuh.
