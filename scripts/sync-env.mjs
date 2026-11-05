#!/usr/bin/env node
// Writes apps/api/.env from the running local Supabase stack (`supabase status`).
//
// - Creates the file from apps/api/.env.example when it does not exist yet.
// - Only updates the Supabase-managed keys; everything else you set (TMDB token, ports, ...) is kept.
//
// Usage: npm run env:sync   (the local stack must be running: npm run supabase:start)

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const apiDir = resolve(root, 'apps/api');
const envFile = resolve(apiDir, '.env');
const exampleFile = resolve(apiDir, '.env.example');

function readStatus() {
  let output;
  try {
    output = execFileSync('npx', ['--no-install', 'supabase', 'status', '-o', 'json'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    const stderr = error?.stderr?.toString() ?? '';
    console.error('Could not read `supabase status`. Is the local stack running?');
    console.error('Start it with: npm run supabase:start');
    if (stderr) console.error(stderr.trim());
    process.exit(1);
  }
  const json = output.slice(output.indexOf('{'), output.lastIndexOf('}') + 1);
  return JSON.parse(json);
}

const status = readStatus();
const managed = {
  DATABASE_URL: status.DB_URL,
  SUPABASE_URL: status.API_URL,
  SUPABASE_ANON_KEY: status.PUBLISHABLE_KEY ?? status.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: status.SECRET_KEY ?? status.SERVICE_ROLE_KEY,
  SUPABASE_JWT_SECRET: status.JWT_SECRET ?? '',
  MAILPIT_URL: status.MAILPIT_URL ?? status.INBUCKET_URL ?? 'http://127.0.0.1:54324',
};

for (const [key, value] of Object.entries(managed)) {
  if (value === undefined) {
    console.error(`supabase status did not report a value for ${key}.`);
    process.exit(1);
  }
}

const template = existsSync(envFile)
  ? readFileSync(envFile, 'utf8')
  : readFileSync(exampleFile, 'utf8');

const seen = new Set();
const lines = template.split('\n').map((line) => {
  const match = /^([A-Z0-9_]+)=/.exec(line);
  if (!match) return line;
  const key = match[1];
  if (!(key in managed)) return line;
  seen.add(key);
  return `${key}=${managed[key]}`;
});
for (const [key, value] of Object.entries(managed)) {
  if (!seen.has(key)) lines.push(`${key}=${value}`);
}

writeFileSync(envFile, lines.join('\n'));
console.log(`Wrote ${envFile}`);
console.log(`  Studio:        ${status.STUDIO_URL}`);
console.log(`  Mailpit inbox: ${status.MAILPIT_URL ?? status.INBUCKET_URL}`);
console.log(`  API URL:       ${status.API_URL}`);
