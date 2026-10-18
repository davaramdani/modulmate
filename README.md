# ModulMate

Asisten belajar berbasis website: unggah PDF, cari materi dengan RAG, dan berdiskusi dengan tutor AI yang menyertakan sumber halaman.

## Teknologi

- Next.js App Router + React + TypeScript, siap di-host di Vercel.
- Supabase Auth (email/kata sandi), Storage privat, PostgreSQL + pgvector.
- Groq Chat Completions, model default `openai/gpt-oss-20b`.
- Embedding multilingual `Xenova/multilingual-e5-small`, 384 dimensi, quantized q8 melalui Transformers.js di Web Worker browser.
- PDF.js membaca teks per halaman di browser.

Model embedding berjalan di perangkat pengguna. Tidak diperlukan API key embedding tambahan. Model diunduh dari Hugging Face saat pertama dipakai dan disimpan dalam cache browser. Pembacaan PDF dan embedding tetap memerlukan tab terbuka. Jika terganggu, klik **Lanjutkan pemrosesan** pada kartu modul; proses akan mengulang dari PDF tersimpan. Tidak ada worker server permanen pada versi ini.

## Menjalankan secara lokal

Gunakan Node.js 22 atau lebih baru.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Pada PowerShell, ganti baris `cp` dengan `Copy-Item .env.example .env.local`. Jangan menimpa `.env.local` yang sudah terisi. Buka http://localhost:3000.

Isi empat variabel berikut:

| Variabel | Isi |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL proyek Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key dari pengaturan API Supabase |
| `GROQ_API_KEY` | Groq API key, hanya untuk server |
| `GROQ_MODEL` | `openai/gpt-oss-20b` atau model chat yang tersedia di akun |

Proyek Supabase **modulmate** yang disiapkan untuk workspace ini beralamat `https://yhmcjypajwonewzpvvqw.supabase.co`. Skema dan bucket sudah diterapkan di sana. `.env.local` lokal sudah dikonfigurasi, diabaikan oleh Git, dan tidak disertakan dalam arsip source. Jangan tambahkan awalan `NEXT_PUBLIC_` pada kunci Groq. Aplikasi tidak memerlukan service-role key.

## Database baru

Untuk memakai proyek Supabase lain, jalankan `supabase/setup.sql` **sekali** melalui SQL Editor pada proyek kosong. Skrip membuat:

- `modules`: metadata dan status pemrosesan.
- `module_chunks`: teks, halaman, dan embedding 384 dimensi.
- `conversations` dan `messages`: percakapan serta sitasi.
- `private.chat_usage`: pembatasan pemakaian yang tidak dapat diubah pengguna.
- Bucket privat `modules` dengan batas 15 MB dan tipe PDF.

Semua tabel aplikasi menggunakan RLS berdasarkan `auth.uid()`. Relasi gabungan `(id,user_id)` mencegah menyisipkan potongan materi atau pesan ke dokumen pengguna lain. Pencarian vector menggunakan `SECURITY INVOKER` sehingga RLS tetap berlaku. Fungsi kuota khusus di schema privat memakai `SECURITY DEFINER`, memeriksa `auth.uid()`, mengunci transaksi per pengguna, dan hanya dapat mengubah kuota pemanggil.

Pencarian memakai cosine distance persis dalam satu modul. Dengan batas 450 potongan per modul, tidak diperlukan indeks vector aproksimasi. Model embedding dan dimensi harus tetap sama antara dokumen dan pertanyaan. Jika mengganti model, semua modul harus diindeks ulang.

## Cara memakai

1. Buka aplikasi dan daftar dengan email. Konfirmasikan email jika fitur konfirmasi aktif di Supabase.
2. Masuk, klik **Unggah modul**, pilih PDF, lalu isi judul dan mata pelajaran.
3. Tunggu sampai **Siap dipelajari**. Halaman menampilkan kemajuan upload dan pemrosesan.
4. Klik **Mulai belajar**, lalu ajukan pertanyaan spesifik.
5. Pilih **Tanya jawab**, **Lebih sederhana**, atau **Bimbing saya**.
6. Klik sumber `[n] Halaman x` untuk membaca kutipan dan membuka PDF asli.
7. Lanjutkan sesi dari **Riwayat belajar**. Sidebar menampilkan tiga percakapan terbaru; daftar lengkap memakai pagination 10 percakapan per halaman.
8. Klik ikon tempat sampah pada percakapan di **Riwayat belajar**, lalu konfirmasikan untuk menghapus percakapan beserta pesan-pesannya. Modul PDF tetap tersimpan. Menghapus modul akan menghapus seluruh percakapannya.

Sebelum login, website menampilkan data contoh yang diberi label **Pratinjau**. Data contoh tidak masuk ke database dan tidak menghasilkan jawaban AI palsu.

## Batas versi awal

- PDF berbasis teks, maksimal 15 MB, 150 halaman, dan 450 potongan. PDF scan/foto belum didukung. Tata letak kompleks seperti tabel dan banyak kolom dapat memengaruhi urutan hasil ekstraksi.
- Embedding memakai CPU/WASM pada browser. Unduhan model pertama cukup besar; koneksi ke Hugging Face dan perangkat dengan memori memadai diperlukan. Pemrosesan di ponsel dapat lebih lambat.
- Nomor halaman sitasi adalah urutan halaman PDF, bukan nomor cetak di dalam dokumen.
- Jawaban menggunakan hingga 6 potongan relevan dengan ambang cosine 0,65 dan riwayat 6 pesan. Ambang perlu dievaluasi lagi menggunakan materi pengguna. Ringkasan/kuis dari chat hanya meliputi potongan yang ditemukan, bukan jaminan seluruh modul tercakup.
- Sitasi diperiksa agar ID-nya merujuk ke potongan yang benar-benar diambil. Kebenaran setiap kalimat tetap perlu diperiksa; RAG tidak menghilangkan semua halusinasi.
- Maksimal 8 permintaan AI per menit dan 100 per 24 jam untuk setiap akun. Permintaan yang gagal setelah reservasi kuota tetap dihitung. Batas Groq dapat lebih rendah.
- Balasan muncul setelah AI selesai menjawab, belum streaming. Waktu tunggu Groq dibatasi 45 detik.
- Saat bertanya, kutipan modul dan riwayat singkat dikirim ke Groq. PDF tetap berada dalam bucket privat Supabase; embedding dihitung di perangkat.

## Pemeriksaan

```sh
npm test
npm run typecheck
npm run build
npm start
```

Tests mencakup cakupan pemotongan teks, sumber halaman, sitasi, dan aturan tutor. Pengujian integrasi juga telah dilakukan pada proyek Supabase dengan dua akun sementara: login, isolasi modul/vector/PDF/percakapan, penolakan data invalid, jawaban Groq, penyimpanan sitasi, respons tanpa sumber, dan pembatasan pemakaian. Akun serta data uji dibersihkan setelah pengujian.

Panduan deployment ada di [DEPLOY.md](./DEPLOY.md).
