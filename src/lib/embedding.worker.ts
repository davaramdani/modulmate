import { pipeline, env, type FeatureExtractionPipeline } from '@huggingface/transformers';
import { EMBEDDING_MODEL } from './rag';
env.allowLocalModels = false;
env.backends.onnx.wasm!.numThreads = 1;
env.backends.onnx.wasm!.wasmPaths = '/onnx/';
let extractor: Promise<FeatureExtractionPipeline> | undefined;
let queue = Promise.resolve();
self.onmessage = (event: MessageEvent<{ id: string; texts: string[]; kind: 'query' | 'passage' }>) => {
  queue = queue.then(async () => {
    const { id, texts, kind } = event.data;
    try {
      if (!extractor) {
        self.postMessage({ id, status: 'progress', text: 'Menyiapkan mesin pencarian. Unduhan pertama bisa memerlukan beberapa menit.' });
        extractor = pipeline('feature-extraction', EMBEDDING_MODEL, {
          dtype: 'q8', device: 'wasm',
          progress_callback: (progress) => {
            if (progress.status === 'progress') self.postMessage({ id, status: 'progress', text: `Mengunduh mesin pencarian: ${Math.round(progress.progress)}%` });
          }
        }) as Promise<FeatureExtractionPipeline>;
      }
      const model = await extractor;
      const result = await model(texts.map(text => `${kind}: ${text}`), { pooling: 'mean', normalize: true });
      self.postMessage({ id, status: 'done', vectors: result.tolist() });
    } catch {
      extractor = undefined;
      self.postMessage({ id, status: 'error', text: 'Mesin pencarian gagal dimuat. Periksa koneksi ke Hugging Face, lalu coba lagi.' });
    }
  });
};
