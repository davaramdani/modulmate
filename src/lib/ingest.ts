import { getSupabase } from './supabase';
import { chunkPages, MAX_CHUNKS, MAX_FILE_SIZE, MAX_PAGES } from './rag';
import { embed } from './embeddings';
import type { Module } from './types';

export async function processModule(module: Module, file: Blob, progress: (text: string, percent: number) => void) {
  const db = getSupabase();
  try {
    progress('Membaca halaman PDF…', 15);
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), standardFontDataUrl:'/pdf-fonts/',cMapUrl:'/pdf-cmaps/',cMapPacked:true,wasmUrl:'/pdf-wasm/' });
    const pdf = await task.promise;
    let pages: {page: number; text: string}[] = [];
    try {
      if (pdf.numPages > MAX_PAGES) throw new Error(`Maksimal ${MAX_PAGES} halaman per modul.`);
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        pages.push({page: i, text: content.items.map(item => 'str' in item ? item.str + ('hasEOL' in item && item.hasEOL ? '\n' : ' ') : '').join('')});
      }
    } finally { await task.destroy(); }
    const chunks = chunkPages(pages);
    if (!chunks.length) throw new Error('Teks tidak ditemukan. Gunakan PDF yang teksnya bisa diseleksi; PDF hasil pindai memerlukan OCR.');
    if (chunks.length > MAX_CHUNKS) throw new Error('Materi terlalu panjang. Pisahkan PDF menjadi beberapa bab.');
    const { error: clearError } = await db.from('module_chunks').delete().eq('module_id', module.id);
    if (clearError) throw clearError;
    for (let i = 0; i < chunks.length; i += 4) {
      const batch = chunks.slice(i, i + 4);
      const percent = 25 + Math.round(i / chunks.length * 65);
      progress(`Menyiapkan materi ${i + 1}–${Math.min(i + 4, chunks.length)} dari ${chunks.length}…`, percent);
      const vectors = await embed(batch.map(chunk => chunk.content), 'passage', text => progress(text, percent));
      const { error } = await db.from('module_chunks').upsert(batch.map((chunk, index) => ({...chunk, module_id: module.id, user_id: module.user_id, embedding: vectors[index]})), {onConflict: 'module_id,chunk_index'});
      if (error) throw error;
    }
    const { error } = await db.from('modules').update({status: 'ready', page_count: pages.length, chunk_count: chunks.length, error_message: null}).eq('id', module.id);
    if (error) throw error;
    progress('Modul siap dipelajari!', 100);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Pemrosesan gagal. Silakan coba lagi.';
    await db.from('modules').update({status: 'error', error_message: message}).eq('id', module.id);
    throw new Error(message);
  }
}

export async function uploadModule(file: File, title: string, subject: string, userId: string, progress: (text: string, percent: number) => void) {
  if (!file.name.toLowerCase().endsWith('.pdf')) throw new Error('Pilih file PDF.');
  if (file.size > MAX_FILE_SIZE) throw new Error('Ukuran PDF maksimal 15 MB.');
  if (!file.size) throw new Error('File PDF kosong.');
  const signature = new TextDecoder().decode(await file.slice(0, 5).arrayBuffer());
  if (signature !== '%PDF-') throw new Error('File ini tidak memiliki format PDF yang valid.');
  const id = crypto.randomUUID();
  const db = getSupabase();
  const path = `${userId}/${id}/modul.pdf`;
  const {data, error} = await db.from('modules').insert({id, user_id: userId, title: title.trim(), file_name: file.name, subject: subject.trim() || 'Umum', storage_path: path}).select().single();
  if (error) throw new Error('Modul gagal dibuat. Periksa konfigurasi database.');
  progress('Mengunggah PDF…', 5);
  const {error: uploadError} = await db.storage.from('modules').upload(path, file, {contentType: 'application/pdf', upsert: false});
  if (uploadError) {
    await db.from('modules').delete().eq('id', id);
    throw new Error('Upload gagal. Periksa koneksi dan coba lagi.');
  }
  await processModule(data as Module, file, progress);
  return id;
}
