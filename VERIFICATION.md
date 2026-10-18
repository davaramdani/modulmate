# Hasil verifikasi

Proyek disiapkan pada 18 Oktober 2026.

## Berhasil diperiksa

- Build produksi Next.js dan pemeriksaan TypeScript.
- Empat pengujian RAG otomatis: pemotongan teks mempertahankan seluruh materi dan nomor halaman, halaman kosong tidak menghasilkan konten palsu, tampilan sitasi hanya merujuk sumber yang ada, serta aturan tutor mempertahankan batas sumber.
- Login dua akun Supabase sementara, RLS untuk modul dan vector search, penolakan penyisipan chunk lintas akun, serta akses privat untuk download PDF dan pembuatan signed URL.
- API chat menolak sesi kosong (401), input embedding tidak valid (400), dan modul pengguna lain (404).
- Pemanggilan Groq nyata, penyimpanan pesan serta sumber, dan penolakan pertanyaan saat tidak ada konteks yang memadai.
- Batas pemakaian per akun diuji: permintaan setelah kuota per menit tercapai ditolak.
- Browser: login, unggah PDF dua halaman, ekstraksi teks, embedding multilingual nyata, status siap, chat, pemuatan ulang percakapan, tampilan sumber, serta render dan navigasi PDF dengan PDF.js.
- Tampilan desktop dan viewport sempit diperiksa di browser aplikasi.
- Permintaan lama tidak boleh mengisi kembali state setelah berganti akun/percakapan; pembacaan data dan penyelesaian chat dibatasi dengan generasi sesi.
- Pengujian tambahan riwayat: tiga test otomatis untuk rentang pagination, penghapusan item terakhir pada halaman terakhir, dan pager untuk riwayat besar. Browser diuji dengan 21 percakapan sementara: sidebar tepat tiga item, logout berada di dalam viewport, konfirmasi bisa dibatalkan, penghapusan menyisakan PDF, halaman kosong otomatis kembali, serta percakapan terbaru berikutnya mengisi sidebar.
- Pemindaian build frontend memastikan Groq secret tidak terdapat pada asset JavaScript client.

Akun dan dokumen sementara untuk pengujian dihapus. Contoh modul yang terlihat sebelum login hanya data pratinjau lokal.

## Batas verifikasi

- Pengiriman email konfirmasi serta reset password belum diuji dengan alamat email nyata. Atur URL redirect dan SMTP saat deployment.
- Belum ada deployment publik Vercel. Konfigurasi dan langkah deployment tersedia di DEPLOY.md.
- Dokumen hasil pindai/OCR, PDF terenkripsi, formula kompleks, dan tabel banyak kolom belum menjadi target versi awal.
- Evaluasi kualitas RAG baru menggunakan dokumen contoh. Siapkan kumpulan soal dan jawaban rujukan dari modul sebenarnya untuk mengukur ketepatan pencarian dan jawaban.
- Supabase Advisor masih mencatat pengaturan **Leaked Password Protection** belum aktif. Ini pengaturan Auth proyek; aktifkan bila tersedia pada paket Supabase yang digunakan. Lihat https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.
