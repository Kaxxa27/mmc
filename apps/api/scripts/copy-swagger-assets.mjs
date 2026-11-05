// Copies the Swagger UI static files into public/api/docs so Vercel serves them as static assets.
// On Vercel the API runs as a single function that does not include swagger-ui-dist's files, so
// /api/docs/swagger-ui-bundle.js etc. would return 404 and the docs page would stay blank.
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const source = dirname(require.resolve('swagger-ui-dist/package.json'));
const target = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'api', 'docs');

const files = [
  'swagger-ui.css',
  'swagger-ui-bundle.js',
  'swagger-ui-standalone-preset.js',
  'favicon-16x16.png',
  'favicon-32x32.png',
];

mkdirSync(target, { recursive: true });
for (const file of files) copyFileSync(join(source, file), join(target, file));
console.log(`Copied ${files.length} Swagger UI assets to ${target}`);
