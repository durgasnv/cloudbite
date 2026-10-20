const { test } = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const { environment, payload, request, proxy, browser } = require('../scripts/chaos/harness');
const key = { 'Idempotency-Key': 'chaos-checkout-attempt-0001' };
const admin = { 'x-admin-token': 'chaos-test-only' };

test('chaos 1: real 5, 15, and 30 second API delays and bounded client recovery', { timeout: 120000 }, async t => {
  const env = await environment(t);
  const app = await env.start();
  await Promise.all([5000, 15000, 30000].map(async delay => {
    const wire = await proxy(t, app.url);
    wire.mode({ delay });
    const started = Date.now();
    const response = await fetch(wire.url + '/api/menu', { signal: AbortSignal.timeout(35000) });
    assert.equal(response.status, 200);
    assert.ok(Array.isArray((await response.json()).data));
    assert.ok(Date.now() - started >= delay - 100);
    t.diagnostic(`Actual loopback response delay ${delay}ms: ${Date.now() - started}ms`);
    wire.mode({});
    assert.equal((await request(wire.url + '/api/menu')).status, 200);
  }));
  // Run the real client deadline code with an abort-aware hanging dependency.
  const { context, event, node, values } = browser();
  context.setTimeout = callback => setTimeout(callback, 25);
  context.fetch = (url, options) => new Promise((resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new Error('Timed out')), { once: true });
  });
  await context.handlePlaceOrder(event);
  assert.equal(node('placeOrderBtn').disabled, false);
  assert.equal(JSON.parse(values.get('cloudbite_cart')).length, 1);
  assert.equal(node('checkoutErrorContainer').style.display, 'block');
  context.fetch = async () => ({ ok: true, json: async () => ({ success: true,
    data: { id: 'ORDRECOVERED', status: 'CONFIRMED', totalAmount: 100 }, orderAccessToken: 'a'.repeat(64) }) });
  await context.handlePlaceOrder(event);
  assert.equal(node('modalOrderId').textContent, 'ORDRECOVERED');
  assert.deepEqual(await env.orders(), []);
});

test('chaos 2: socket disconnect after commit retains one order on retry', async t => {
  const env = await environment(t);
  const app = await env.start();
  const wire = await proxy(t, app.url);
  wire.mode({ disconnect: true });
  await assert.rejects(request(wire.url + '/api/orders', payload, key));
  assert.equal((await env.orders()).length, 1, 'Disconnected response is an ambiguous committed write');
  wire.mode({});
  const recovered = await request(wire.url + '/api/orders', payload, key);
  assert.ok([200, 201].includes(recovered.status));
  assert.equal((await env.orders()).length, 1);
  assert.equal((await request(app.url + '/api/orders/' + recovered.body.data.id, undefined,
    { 'x-order-token': recovered.body.orderAccessToken })).status, 200);
});

test('chaos 3: refused and hanging PostgreSQL connections fail bounded, liveness survives', { timeout: 90000 }, async t => {
  const env = await environment(t);
  const sockets = new Set();
  const blackhole = net.createServer(socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
  await new Promise(resolve => blackhole.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    for (const socket of sockets) socket.destroy();
    if (blackhole.listening) await new Promise(resolve => blackhole.close(resolve));
  });
  const port = blackhole.address().port;
  const app = await env.start({ CHAOS_STORAGE: 'postgres', PGHOST: '127.0.0.1', PGPORT: String(port),
    PGUSER: 'chaos', PGPASSWORD: 'test-only', PGDATABASE: 'chaos', DB_TIMEOUT_MS: '300' });
  const started = Date.now();
  assert.equal((await request(app.url + '/api/orders', payload, key)).status, 503);
  assert.ok(Date.now() - started < 3000);
  assert.equal((await request(app.url + '/api/health')).status, 503);
  assert.equal((await request(app.url + '/api/live')).status, 200);
  for (const socket of sockets) socket.destroy();
  await new Promise(resolve => blackhole.close(resolve));
  assert.equal((await request(app.url + '/api/orders', payload, key)).status, 503);
  assert.deepEqual(await env.orders(), [], 'Database failure must not silently fall back to JSON');
  // JSON recovery here is a separate mode; actual same-backend PostgreSQL recovery is tested below.
  await app.stop();
  const recovered = await env.start();
  assert.equal((await request(recovered.url + '/api/orders', payload, key)).status, 201);
  assert.equal((await request(recovered.url + '/api/health')).status, 200);
  assert.equal((await env.orders()).length, 1);
});

test('chaos 4: twenty duplicate requests persist one order; changed payload conflicts', async t => {
  const env = await environment(t);
  const app = await env.start();
  const responses = await Promise.all(Array.from({ length: 20 }, () => request(app.url + '/api/orders', payload, key)));
  assert.ok(responses.every(response => [200, 201].includes(response.status)));
  assert.equal(new Set(responses.map(response => response.body.data.id)).size, 1);
  assert.equal(new Set(responses.map(response => response.body.orderAccessToken)).size, 1);
  assert.equal((await env.orders()).length, 1);
  assert.equal((await request(app.url + '/api/orders', { ...payload, customerName: 'Changed customer' }, key)).status, 409);
  assert.equal((await env.orders()).length, 1);
  assert.equal((await request(app.url + '/api/orders', payload, { 'Idempotency-Key': 'new-independent-checkout-key' })).status, 201);
});

test('chaos 5: twenty rapid submit events and offline retry use one in-flight request and stable key', async () => {
  const { context, event, node, values } = browser();
  let requests = 0;
  let reject;
  const keys = [];
  context.fetch = (url, options) => {
    requests++;
    keys.push(options.headers['Idempotency-Key']);
    return new Promise((resolve, fail) => { reject = fail; });
  };
  const attempts = Array.from({ length: 20 }, () => context.handlePlaceOrder(event));
  const observed = requests;
  reject(new Error('Offline'));
  // Prior broken implementations leave multiple promises; compare before awaiting.
  assert.equal(observed, 1);
  await Promise.all(attempts);
  assert.equal(node('placeOrderBtn').disabled, false);
  assert.equal(JSON.parse(values.get('cloudbite_cart')).length, 1);
  context.fetch = async (url, options) => {
    keys.push(options.headers['Idempotency-Key']);
    return { ok: true, json: async () => ({ success: true, data: { id: 'ORDRECOVERED', totalAmount: 100 }, orderAccessToken: 'a'.repeat(64) }) };
  };
  await context.handlePlaceOrder(event);
  assert.ok(keys[0]);
  assert.equal(keys[0], keys[1]);
  assert.equal(node('placeOrderBtn').disabled, true);
});

test('chaos 6: expired staff credentials cannot read or mutate; fresh credentials recover', async t => {
  const env = await environment(t);
  const active = await env.start();
  const created = await request(active.url + '/api/orders', payload, key);
  await active.stop();
  const expired = await env.start({ ADMIN_TOKEN_EXPIRES_AT: '2000-01-01T00:00:00.000Z' });
  const listed = await request(expired.url + '/api/orders', undefined, admin);
  assert.equal(listed.body.isAdmin, false);
  assert.equal(listed.body.count, 0);
  assert.equal((await request(expired.url + '/api/orders/' + created.body.data.id + '/status',
    { status: 'READY', expectedVersion: 0 }, admin, 'PATCH')).status, 403);
  assert.equal((await env.orders())[0].status, 'CONFIRMED');
  await expired.stop();
  const fresh = await env.start({ ADMIN_TOKEN: 'rotated-chaos-token', ADMIN_TOKEN_EXPIRES_AT: '2999-01-01T00:00:00Z' });
  assert.equal((await request(fresh.url + '/api/orders', undefined, { 'x-admin-token': 'rotated-chaos-token' })).body.count, 1);
});

test('chaos 7: malformed API JSON and success shapes preserve cart, then recover', async () => {
  for (const data of [null, {}, { success: true }, { success: true, data: {} },
    { success: true, data: { id: 'ORDINVALID' }, orderAccessToken: 'broken' }, 'broken-json']) {
    const { context, event, values, node } = browser();
    context.fetch = async () => ({ ok: true, json: async () => {
      if (data === 'broken-json') throw new SyntaxError('Invalid JSON');
      return data;
    } });
    await context.handlePlaceOrder(event);
    assert.equal(JSON.parse(values.get('cloudbite_cart')).length, 1);
    assert.equal(node('placeOrderBtn').disabled, false);
    assert.equal(node('checkoutErrorContainer').style.display, 'block');
    context.fetch = async () => ({ ok: true, json: async () => ({ success: true,
      data: { id: 'ORDRECOVERED', status: 'CONFIRMED', totalAmount: 100 }, orderAccessToken: 'a'.repeat(64) }) });
    await context.handlePlaceOrder(event);
    assert.equal(node('modalOrderId').textContent, 'ORDRECOVERED');
  }
});

test('chaos 8: missing production database fails startup; missing staff token fails closed', async t => {
  const env = await environment(t);
  const production = await env.start({ NODE_ENV: 'production' });
  assert.equal(production.failed, true);
  assert.match(production.logs, /database configuration/i);
  assert.deepEqual(await env.orders(), []);
  const app = await env.start({ ADMIN_TOKEN: '' });
  assert.equal((await request(app.url + '/api/orders', undefined, admin)).body.isAdmin, false);
  assert.equal((await request(app.url + '/api/orders', payload, key)).status, 201);
  assert.equal((await request(app.url + '/api/health')).status, 200);
});

test('chaos 9: concurrent compare-and-set updates reject stale writes and permit refresh/retry', async t => {
  const env = await environment(t);
  const app = await env.start();
  const created = await request(app.url + '/api/orders', payload, key);
  const url = app.url + '/api/orders/' + created.body.data.id + '/status';
  const updates = await Promise.all(['PREPARING', 'CANCELLED'].map(status => request(url,
    { status, expectedVersion: 0 }, admin, 'PATCH')));
  assert.deepEqual(updates.map(result => result.status).sort(), [200, 409]);
  let records = await env.orders();
  assert.equal(records.length, 1);
  assert.equal(records[0].version, 1);
  assert.equal(records[0].status, updates.find(result => result.status === 200).body.data.status);
  assert.equal((await request(url, { status: 'READY', expectedVersion: 1 }, admin, 'PATCH')).status, 200);
  records = await env.orders();
  assert.equal(records[0].version, 2);
  assert.equal(records[0].status, 'READY');
});

for (const point of ['before-write', 'after-write']) {
  test(`chaos 10: SIGKILL ${point} recovers committed history and retries exactly once`, async t => {
    const env = await environment(t);
    const app = await env.start();
    const seed = await request(app.url + '/api/orders', payload, { 'Idempotency-Key': 'seed-checkout-before-restart' });
    await app.arm(point);
    const pending = request(app.url + '/api/orders', payload, key).then(value => ({ value }), error => ({ error }));
    await app.wait(message => message.point === point);
    await app.stop('SIGKILL');
    assert.ok((await pending).error, 'Active client connection must fail');
    assert.equal((await env.orders()).length, point === 'before-write' ? 1 : 2);
    const recovered = await env.start();
    const retried = await request(recovered.url + '/api/orders', payload, key);
    assert.ok([200, 201].includes(retried.status));
    assert.equal((await env.orders()).length, 2);
    assert.equal((await request(recovered.url + '/api/orders/' + seed.body.data.id, undefined,
      { 'x-order-token': seed.body.orderAccessToken })).status, 200);
    assert.equal((await request(recovered.url + '/api/orders/' + retried.body.data.id, undefined,
      { 'x-order-token': retried.body.orderAccessToken })).status, 200);
  });
}

test('chaos PostgreSQL: outage/recovery, replica retries, and atomic competing updates', { timeout: 180000 }, async t => {
  const pgBin = process.env.CHAOS_PG_BIN || '/usr/lib/postgresql/16/bin';
  if (!require('node:fs').existsSync(require('node:path').join(pgBin, 'initdb'))) {
    t.skip('Local PostgreSQL binaries unavailable; set CHAOS_PG_BIN to run real database recovery tests.');
    return;
  }
  const { postgres } = require('../scripts/chaos/postgres');
  const env = await environment(t);
  const db = await postgres(env.directory);
  env.cleanup.push(db.stop);
  const app = await env.start(db.env);
  assert.equal((await request(app.url + '/api/health')).status, 200);
  const seed = await request(app.url + '/api/orders', payload, key);
  assert.equal(seed.status, 201);
  await db.stop();
  assert.equal((await request(app.url + '/api/health')).status, 503);
  assert.equal((await request(app.url + '/api/live')).status, 200);
  const outageKey = { 'Idempotency-Key': 'chaos-checkout-during-db-outage' };
  assert.equal((await request(app.url + '/api/orders', payload, outageKey)).status, 503);
  await db.start();
  assert.equal((await request(app.url + '/api/health')).status, 200, 'Same backend recovers after DB restart');
  assert.equal((await request(app.url + '/api/orders/' + seed.body.data.id, undefined,
    { 'x-order-token': seed.body.orderAccessToken })).status, 200, 'Acknowledged order survives DB crash');
  const replica = await env.start(db.env);
  assert.equal((await request(replica.url + '/api/health')).status, 200);
  const retried = await Promise.all(Array.from({ length: 12 }, (_, index) =>
    request((index % 2 ? app : replica).url + '/api/orders', payload, outageKey)));
  assert.ok(retried.every(result => [200, 201].includes(result.status)));
  assert.equal(new Set(retried.map(result => result.body.data.id)).size, 1);
  const id = retried[0].body.data.id;
  const updates = await Promise.all([app, replica].map((backend, index) => request(backend.url + '/api/orders/' + id + '/status',
    { status: index ? 'READY' : 'PREPARING', expectedVersion: 0 }, admin, 'PATCH')));
  assert.deepEqual(updates.map(result => result.status).sort(), [200, 409]);
  const listed = await request(app.url + '/api/orders', undefined, admin);
  assert.equal(listed.body.count, 2);
  assert.equal(listed.body.data.find(order => order.id === id).version, 1);
  assert.deepEqual(await env.orders(), [], 'Postgres mode must never spill orders into JSON');
  await replica.stop();
  await app.arm('after-write');
  const restartKey = { 'Idempotency-Key': 'postgres-restart-committed-order' };
  const pending = request(app.url + '/api/orders', payload, restartKey).catch(error => ({ error }));
  await app.wait(message => message.point === 'after-write');
  await app.stop('SIGKILL');
  assert.ok((await pending).error);
  const restarted = await env.start(db.env);
  assert.ok([200, 201].includes((await request(restarted.url + '/api/orders', payload, restartKey)).status));
  assert.equal((await request(restarted.url + '/api/orders', undefined, admin)).body.count, 3);
});
