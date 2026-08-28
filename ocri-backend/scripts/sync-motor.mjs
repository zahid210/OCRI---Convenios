// Copia el motor html-pdf-lite vendido (ocri-backend/vendor/html-pdf-lite,
// con la justificación de texto parcheada) sobre el paquete instalado en
// node_modules. Se ejecuta tras `npm install` (postinstall) y en desarrollo
// manual: `node scripts/sync-motor.mjs`.
import { cpSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'vendor', 'html-pdf-lite');
const dest = join(root, 'node_modules', 'html-pdf-lite');

if (!existsSync(src)) {
  console.error('No existe el motor vendido en', src);
  process.exit(1);
}
cpSync(src, dest, { recursive: true });
console.log('motor html-pdf-lite sincronizado ->', dest);