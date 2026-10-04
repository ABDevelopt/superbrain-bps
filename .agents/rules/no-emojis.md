# Aturan Larangan Penggunaan Emoticon dan Emoji

Dilarang keras menyisipkan atau menggunakan emoticon karakter teks maupun karakter emoji grafis Unicode (seperti 🧠, 💡, ⚠️, 🏖️, 📅, 🗑️, ✅, 🟢, 🔴, dsb.) di seluruh bagian aplikasi SuperBrain.

### Ketentuan Penerapan:
1. **Komponen UI & Halaman Web**:
   - Seluruh label tombol, judul halaman, kartu ringkasan, modal dialog, tooltip, dan pesan status dilarang menggunakan emoji.
   - Branding dan logo: Jangan menggunakan `🧠 SuperBrain`. Gunakan tipografi murni `SuperBrain` atau ikon SVG kustom/Lucide.
2. **Ikonografi & Pengganti Visual**:
   - Selalu gunakan ikon SVG resmi dari paket `lucide-react` (misalnya `<AlertTriangle />`, `<CheckCircle2 />`, `<Calendar />`, `<Lightbulb />`, `<Trash2 />`, `<Folder />`, `<Palmtree />`, `<Repeat />`, `<BarChart3 />`).
   - Untuk status warna (seperti indikator koneksi online/offline), gunakan elemen CSS bullet/dot (misalnya bulatan warna via CSS: `width: 8px; height: 8px; border-radius: 50%; display: inline-block`) alih-alih karakter emoji `🟢` atau `🔴`.
3. **Pesan Dialog & Toast/Notifikasi**:
   - Pesan keberhasilan, peringatan, atau kesalahan disajikan dengan teks profesional yang jelas dan dipadukan dengan ikon Lucide yang relevan.
4. **Ekstensi Browser & Modul Eksternal**:
   - Terapkan standar yang sama untuk antarmuka ekstensi (`extension/`) dan integrasi pengingat lainnya.
