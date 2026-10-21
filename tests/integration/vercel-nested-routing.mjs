import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

const dbUrl = process.env.DATABASE_URL ?? '';
assert.match(dbUrl, /(?:127\.0\.0\.1|localhost)/, 'Test needs disposable local PostgreSQL');
const { Pool } = createRequire(new URL('../../lib/db/package.json', import.meta.url))('pg');
const pool = new Pool({ connectionString: dbUrl });
const config = JSON.parse(await readFile(new URL('../../vercel.json', import.meta.url), 'utf8'));
const rules = [
  { source: '/api/follow-up/:followUpPath*', destination: '/api/follow-up/_router?__followUpPath=:followUpPath*' },
  { source: '/api/integrations/google-forms/review/:reviewPath*', destination: '/api/integrations/google-forms/review/_router?__reviewPath=:reviewPath*' },
];
for (const rule of rules) {
  assert.ok(config.rewrites.some(r => r.source === rule.source && r.destination === rule.destination),
    'Missing Vercel rewrite: ' + rule.source);
}
assert.ok(config.crons.some(x => x.path === '/api/internal/follow-up-sync' && x.schedule === '0 9 * * *'),
  'The existing cron must stay unchanged');

const id = '11111111-1111-4111-8111-111111111111';
const token = 'isolated-routing-token';
const auth = createServer((req, res) => {
  if (req.url === '/auth/v1/user' && req.headers.authorization === 'Bearer ' + token) {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ id: '22222222-2222-4222-8222-222222222222', email: 'routing@example.invalid' }));
  } else { res.writeHead(401); res.end(); }
});
await new Promise(resolve => auth.listen(0, '127.0.0.1', resolve));
process.env.SUPABASE_URL = 'http://127.0.0.1:' + auth.address().port;
process.env.SUPABASE_ANON_KEY = 'isolated';
// Writable only on disposable CI PostgreSQL; otherwise PATCH is intentionally 503.
process.env.FOLLOW_UP_WRITES_ENABLED = 'true';
process.env.VERCEL_ENV = 'development';
process.env.GOOGLE_FORMS_INTEGRATION_SECRET = '';

// These imports are the production-built Express adapters, not fake API handlers.
const followUp = (await import('../../api/follow-up/_router.mjs')).default;
const review = (await import('../../api/integrations/google-forms/review/_router.mjs')).default;
const formSubmission = (await import('../../api/integrations/google-forms/venue-event.mjs')).default;

// Mimics Vercel rewriting a wildcard into a physical function path and query.
function resolveRequest(raw) {
  const incoming = new URL(raw, 'http://localhost');
  for (const item of [
    { root: '/api/follow-up', key: 'followUpPath', dest: '/api/follow-up/_router', handler: followUp },
    { root: '/api/integrations/google-forms/review', key: 'reviewPath',
      dest: '/api/integrations/google-forms/review/_router', handler: review },
  ]) {
    if (incoming.pathname !== item.root && !incoming.pathname.startsWith(item.root + '/')) continue;
    const suffix = incoming.pathname.slice(item.root.length).replace(/^\/+/, '');
    const destination = new URL(item.dest, 'http://localhost');
    destination.searchParams.set('__' + item.key, suffix);
    incoming.searchParams.forEach((value, name) => destination.searchParams.append(name, value));
    return { handler: item.handler, rewritten: destination.pathname + destination.search };
  }
  if (incoming.pathname === '/api/integrations/google-forms/venue-event')
    return { handler: formSubmission, rewritten: incoming.pathname + incoming.search };
  return { handler: null, rewritten: incoming.pathname + incoming.search };
}
for (const p of ['/api/follow-up', '/api/follow-up/preparation/' + id,
  '/api/follow-up/reactivation/' + id, '/api/follow-up/campaign'])
  assert.equal(resolveRequest(p).handler, followUp);
for (const p of ['/api/integrations/google-forms/review',
  '/api/integrations/google-forms/review/' + id + '/resolve'])
  assert.equal(resolveRequest(p).handler, review);
assert.equal(resolveRequest('/api/integrations/google-forms/venue-event').handler, formSubmission,
  'Existing webhook adapter must not be shadowed');
assert.ok(resolveRequest('/api/integrations/google-forms/review?cursor=abc%2Bdef').rewritten.includes('cursor=abc%2Bdef'));

const proxy = createServer((req, res) => {
  const { handler, rewritten } = resolveRequest(req.url ?? '/');
  if (!handler) { res.writeHead(404); res.end('Missing Vercel function'); return; }
  req.url = rewritten;
  handler(req, res);
});
await new Promise(resolve => proxy.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + proxy.address().port;
async function request(path, method = 'GET', body, bearer = true) {
  const response = await fetch(origin + path, {
    method,
    headers: {
      ...(bearer ? { authorization: 'Bearer ' + token } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await response.json(); } catch {}
  return { status: response.status, data };
}

try {
  await pool.query('create table if not exists public.google_form_imports (' +
    'id uuid primary key, submitted_at timestamptz not null, status text not null,' +
    'error_message text, venue_event_id uuid, payload jsonb, needs_review boolean not null default true)');
  for (let i = 1; i <= 5; i++) {
    const importId = '11111111-1111-4111-8111-' + String(i).padStart(12, '0');
    await pool.query('insert into public.google_form_imports ' +
      '(id, submitted_at, status, error_message, payload, needs_review) ' +
      'values ($1, now(), $2, $3, $4::jsonb, true) on conflict (id) do nothing',
      [importId, 'needs_review', 'requested extras require review', JSON.stringify({ fields: { customerName: 'Test' } })]);
  }

  const root = await request('/api/follow-up');
  assert.equal(root.status, 200, 'GET follow-up must reach Express: ' + JSON.stringify(root));
  const prep = await request('/api/follow-up/preparation/' + id, 'PATCH', { field: 'invalid', done: true });
  assert.equal(prep.status, 400, 'PATCH preparation must reach Express validation, not Vercel 404');
  assert.equal(prep.data?.error, 'Pedido inválido');
  const react = await request('/api/follow-up/reactivation/' + id, 'PATCH', { action: 'invalid' }, false);
  assert.equal(react.status, 401, 'PATCH reactivation must reach Express bearer gate');
  const campaign = await request('/api/follow-up/campaign', 'PATCH', {}, false);
  assert.equal(campaign.status, 401, 'PATCH campaign must reach Express bearer gate');

  const list = await request('/api/integrations/google-forms/review');
  assert.equal(list.status, 200, 'GET review must reach Express: ' + JSON.stringify(list));
  assert.equal(list.data?.items?.length, 5, 'Five disposable pending reviews should load');
  const cursor = await request('/api/integrations/google-forms/review?cursor=invalid%2Bcursor');
  assert.equal(cursor.status, 400, 'Invalid cursor must survive rewrite to Express');
  assert.equal(cursor.data?.error, 'Página inválida');
  const resolve = await request('/api/integrations/google-forms/review/' + id + '/resolve', 'POST', { action: 'invalid' });
  assert.equal(resolve.status, 400, 'POST resolve must reach Express validation, not 404');
  assert.equal(resolve.data?.error, 'Decisão inválida');

  const webhook = await request('/api/integrations/google-forms/venue-event', 'POST', { fields: {} });
  assert.equal(webhook.status, 503, 'Existing webhook adapter must still reach Express');
  assert.equal(webhook.data?.reason, 'integration unavailable');
  console.log('VERCEL_NESTED_ROUTING PASS: actual Express handlers, original webhook, cursor query, HTTP methods');
} finally {
  await new Promise(resolve => proxy.close(resolve));
  await new Promise(resolve => auth.close(resolve));
  await pool.end();
}
