import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules/onnxruntime-web/dist');
const dest = join(root, 'public/ort');
mkdirSync(dest, { recursive: true });

for (const variant of ['', '.asyncify']) {
  for (const ext of ['mjs', 'wasm']) {
    const file = `ort-wasm-simd-threaded${variant}.${ext}`;
    copyFileSync(join(src, file), join(dest, file));
  }
}
console.log('Copied onnxruntime-web WASM files to public/ort');
