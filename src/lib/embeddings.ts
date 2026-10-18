let worker: Worker | undefined;
export function embed(texts: string[], kind: 'query' | 'passage', onProgress?: (text: string) => void): Promise<number[][]> {
  if (!worker) worker = new Worker(new URL('./embedding.worker.ts', import.meta.url), { type: 'module' });
  const currentWorker = worker;
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); currentWorker.removeEventListener('message', listener); currentWorker.removeEventListener('error', errorListener); };
    const timer = setTimeout(() => { cleanup(); reject(new Error('Pemrosesan terlalu lama. Periksa koneksi dan coba lagi.')); }, 600_000);
    const errorListener = () => { cleanup(); currentWorker.terminate(); worker = undefined; reject(new Error('Mesin pencarian berhenti. Muat ulang halaman dan coba lagi.')); };
    const listener = (event: MessageEvent) => {
      const data = event.data;
      if (data.id !== id) return;
      if (data.status === 'progress') { onProgress?.(data.text); return; }
      cleanup();
      if (data.status === 'done') resolve(data.vectors);
      else reject(new Error(data.text));
    };
    currentWorker.addEventListener('message', listener);
    currentWorker.addEventListener('error', errorListener);
    currentWorker.postMessage({ id, texts, kind });
  });
}
