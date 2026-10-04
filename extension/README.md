# 🧠 SuperBrain KIPAPP BPS Companion (Extension)

Ekstensi peramban resmi untuk menghubungkan **SuperBrain** dengan portal kinerja resmi **KIPAPP BPS** (`https://kipapp.bps.go.id`).

---

## 🚀 Cara Memasang Ekstensi (Google Chrome / Microsoft Edge)

1. Buka halaman ekstensi di browser Anda:
   - **Chrome**: Ketik `chrome://extensions/` di bilah alamat (*address bar*).
   - **Edge**: Ketik `edge://extensions/` di bilah alamat.
2. Aktifkan **Developer mode** (Mode pengembang) di sudut kanan atas layar.
3. Klik tombol **Load unpacked** (Muat yang belum dibongkar).
4. Pilih folder ini:
   ```
   D:\superbrain\extension
   ```
5. Ekstensi **SuperBrain KIPAPP BPS Companion** akan langsung aktif dan muncul di bilah ekstensi browser Anda! 🎉

---

## ⚡ Cara Kerja & Penggunaan

1. **Autentikasi Otomatis**:
   - Buka portal [KIPAPP BPS](https://kipapp.bps.go.id) dan login seperti biasa menggunakan akun SSO BPS Anda.
   - Ekstensi secara otomatis menangkap token sesi yang aman tanpa Anda perlu menyalin token apa pun secara manual.
2. **Sinkronisasi 1-Klik**:
   - Buka aplikasi [SuperBrain CKP](https://superbrain-bps.vercel.app/ckp).
   - Klik tombol **"🚀 Sinkronisasi KIPAPP"** pada kartu toolbar CKP.
   - Periksa ringkasan kegiatan bulan berjalan, lalu klik **"Kirim ke KIPAPP"**.
   - Seluruh kegiatan akan dikirimkan otomatis ke endpoint KIPAPP dengan jeda aman (*rate limiting*) untuk menghindari penolakan server.

---

## 🔒 Keamanan & Privasi

- Token SSO BPS hanya disimpan di penyimpanan lokal browser Anda (`chrome.storage.local`).
- Tidak ada data kredensial atau password yang dikirim ke server pihak ketiga mana pun.
- Komunikasi dilakukan secara langsung dari browser Anda ke endpoint resmi `https://kipapp.bps.go.id/api/v1/...`.
