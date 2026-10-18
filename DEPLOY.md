# Deploy ModulMate ke Vercel

## 1. Siapkan repository

Upload folder proyek ini ke repository GitHub. Pastikan `.env.local`, `node_modules`, dan `.next` tidak ikut di-commit. `.gitignore` sudah disediakan.

Folder runtime di `public/onnx`, `public/pdf-fonts`, `public/pdf-cmaps`, `public/pdf-wasm`, dan `public/pdf.worker.min.mjs` dihasilkan otomatis saat `npm ci`/build. Tidak perlu di-commit.

## 2. Import di Vercel

1. Pilih **Add New → Project**, lalu import repository.
2. Framework preset: **Next.js**.
3. Root Directory: folder yang berisi `package.json` (root repository jika isi folder ini dijadikan repository).
4. Build command: `npm run build`. Install command: `npm ci`.
5. Pilih Node.js **22.x** atau versi lebih baru yang didukung Vercel.
6. Tambahkan environment variables berikut pada Production, dan Preview jika digunakan:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
GROQ_API_KEY
GROQ_MODEL
```

Ambil URL/publishable key dari proyek Supabase **modulmate**. Isi `GROQ_MODEL` dengan `openai/gpt-oss-20b`. Ambil Groq key dari akunmu. Kunci yang pernah dibagikan di chat sebaiknya diganti sebelum publikasi. Setelah perubahan environment variables, lakukan redeploy.

7. Klik **Deploy**.

## 3. Atur redirect Supabase Auth

Di Supabase → Authentication → URL Configuration:

- **Site URL:** URL produksi Vercel milikmu, misalnya `https://nama-proyek.vercel.app`.
- **Redirect URLs:** tambahkan URL produksi dan `http://localhost:3000`. Jika memakai preview, tambahkan URL preview yang diperlukan.

Konfirmasi email dan pemulihan kata sandi kembali ke halaman utama aplikasi. Pengguna memilih kata sandi baru setelah membuka tautan pemulihan. Untuk penggunaan publik, konfigurasi SMTP sendiri dan CAPTCHA pada Supabase Auth sesuai kebutuhan akun; layanan email bawaan memiliki batas pengiriman. Supabase Advisor mencatat Leaked Password Protection belum aktif; aktifkan jika tersedia pada paket yang dipakai: [pengaturan keamanan kata sandi](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## 4. Verifikasi setelah deploy

- Daftar dan konfirmasikan email.
- Unggah PDF kecil berbasis teks. Biarkan halaman terbuka sampai proses selesai.
- Tanyakan konsep yang memang ada di PDF, lalu buka sitasi dan periksa halamannya.
- Muat ulang halaman dan lanjutkan riwayat percakapan.
- Coba akun kedua: perpustakaannya harus kosong.
- Pastikan `GROQ_API_KEY` tidak berada dalam source frontend atau repository.

## Arsitektur deployment

Vercel menjalankan frontend Next.js dan `/api/chat`. PDF diunggah langsung dari browser pengguna ke Supabase Storage menggunakan sesi pengguna. Browser membaca teks dan menghitung embedding lalu menyimpannya di Supabase. Karena file tidak melewati endpoint chat Vercel, upload tidak menggunakan batas body endpoint tersebut.

API chat memverifikasi sesi Supabase, mengambil potongan materi yang diizinkan RLS, memanggil Groq, dan menyimpan hasil. API key Groq selalu berada di server Vercel.

Pemrosesan PDF besar, OCR, atau pekerjaan yang harus terus berjalan setelah tab ditutup perlu worker/queue server pada pengembangan berikutnya. Jangan menganggap pemrosesan browser sebagai background job yang tahan penutupan tab.
