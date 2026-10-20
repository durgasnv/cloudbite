// Reproduce original defects without reverting or modifying the working tree.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { environment, payload, request } = require('./harness');

test('original HEAD baseline: duplicate checkout, expired credential, and competing updates', async t => {
  const env = await environment(t);
  const snapshot = path.join(env.directory, 'baseline');
  await fs.mkdir(path.join(snapshot, 'storage'), { recursive: true });
  await fs.mkdir(path.join(snapshot, 'routes'), { recursive: true });
  await fs.mkdir(path.join(snapshot, 'utils'), { recursive: true });
  await fs.mkdir(path.join(snapshot, 'data'), { recursive: true });
  const repository = path.resolve(__dirname, '../..');
  const reference = process.env.CHAOS_BASELINE_REF || 'HEAD';
  for (const file of ['server.js', 'storage/orderStore.js', 'storage/localOrderStore.js',
    'routes/orderRoutes.js', 'routes/menuRoutes.js', 'routes/restaurantRoutes.js', 'utils/validation.js']) {
    const original = execFileSync('git', ['show', `${reference}:server/${file}`], { cwd: repository });
    await fs.writeFile(path.join(snapshot, file), original);
  }
  for (const file of ['menu.json', 'restaurants.json']) {
    await fs.copyFile(path.join(repository, 'server/data', file), path.join(snapshot, 'data', file));
  }
  await fs.symlink(path.join(repository, 'node_modules'), path.join(snapshot, 'node_modules'), 'dir');
  const app = await env.start({ CHAOS_SERVER_ROOT: snapshot, ADMIN_TOKEN_EXPIRES_AT: '2000-01-01T00:00:00Z' });
  const headers = { 'Idempotency-Key': 'original-baseline-checkout-key' };
  const first = await request(app.url + '/api/orders', payload, headers);
  const retried = await request(app.url + '/api/orders', payload, headers);
  assert.notEqual(first.body.data.id, retried.body.data.id);
  assert.equal((await env.orders()).length, 2);
  t.diagnostic('Original: identical checkout + identical key persisted 2 distinct orders.');
  const admin = { 'x-admin-token': 'chaos-test-only' };
  const listing = await request(app.url + '/api/orders', undefined, admin);
  assert.equal(listing.body.isAdmin, true);
  t.diagnostic('Original: staff token remained authorized despite past ADMIN_TOKEN_EXPIRES_AT.');
  const updates = await Promise.all(['READY', 'CANCELLED'].map(status => request(
    app.url + '/api/orders/' + first.body.data.id + '/status', { status, expectedVersion: 0 }, admin, 'PATCH')));
  assert.deepEqual(updates.map(result => result.status), [200, 200]);
  t.diagnostic('Original: competing expectedVersion=0 writes both returned 200; later status replaced earlier status.');
});
