import { mkdir, copyFile, readdir, cp } from 'node:fs/promises';
import { join } from 'node:path';
await mkdir('public/onnx', { recursive: true });
await copyFile('node_modules/pdfjs-dist/build/pdf.worker.min.mjs', 'public/pdf.worker.min.mjs');
for (const [source,target] of [['standard_fonts','pdf-fonts'],['cmaps','pdf-cmaps'],['wasm','pdf-wasm']]) {
  await cp(`node_modules/pdfjs-dist/${source}`, `public/${target}`, {recursive:true});
}
// Serve WASM from the same origin, with exactly the runtime's installed version.
const dir = 'node_modules/onnxruntime-web/dist';
for (const name of await readdir(dir)) {
  if (name.endsWith('.wasm') || name.startsWith('ort-wasm') && name.endsWith('.mjs'))
    await copyFile(join(dir, name), join('public/onnx', name));
}
