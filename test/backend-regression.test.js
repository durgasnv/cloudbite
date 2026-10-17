const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

process.env.ADMIN_TOKEN = 'backend-regression-token';
delete process.env.DATABASE_URL;
delete process.env.PGHOST;
const app = require('../server/server');
const orderStore = require('../server/storage/orderStore');
const { createLocalOrderStore } = require('../server/storage/localOrderStore');
const menuItem = require('../server/data/menu.json')[0];
const adminHeaders = { 'x-admin-token': process.env.ADMIN_TOKEN };
let directory;
let ordersFile;
let store;
let server;
let baseUrl;

before(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'cloudbite-backend-test-'));
  ordersFile = path.join(directory, 'orders.json');
  store = createLocalOrderStore(ordersFile);
  // Isolate API regression tests from real development orders and other test files.
  Object.assign(orderStore, store);
  server = await new Promise((resolve, reject) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    listener.on('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(async () => {
  Object.assign(orderStore, store);
  await fs.writeFile(ordersFile, '[]');
});

after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  if (directory) await fs.rm(directory, { recursive: true, force: true });
});

function checkout(overrides = {}) {
  return {
    customerName: 'Synthetic regression customer',
    items: [{ id: menuItem.id, price: menuItem.price, quantity: 1 }],
    ...overrides
  };
}

async function request(endpoint, body, headers = {}, method = 'POST') {
  const response = await fetch(baseUrl + endpoint, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  return { status: response.status, body: await response.json() };
}

test('concurrent checkouts and status updates retain every accepted order with unique IDs', async () => {
  const first = await request('/api/orders', checkout());
  assert.equal(first.status, 201);
  const results = await Promise.all([
    ...Array.from({ length: 30 }, () => request('/api/orders', checkout())),
    request(`/api/orders/${first.body.data.id}/status`, { status: 'READY' }, adminHeaders, 'PATCH')
  ]);
  assert.ok(results.slice(0, 30).every(result => result.status === 201));
  assert.equal(results[30].status, 200);
  const persisted = JSON.parse(await fs.readFile(ordersFile, 'utf8'));
  assert.equal(persisted.length, 31);
  assert.equal(new Set(persisted.map(order => order.id)).size, 31);
  assert.equal(persisted.find(order => order.id === first.body.data.id).status, 'READY');
  for (const result of [first, ...results.slice(0, 30)]) {
    assert.ok(persisted.some(order => order.id === result.body.data.id));
  }
});

test('readers see valid JSON throughout concurrent writes', async () => {
  const writes = Array.from({ length: 20 }, (_, index) => store.createOrder({ id: `ORD${index}` }));
  for (let index = 0; index < 40; index++) assert.ok(Array.isArray(await store.listOrders()));
  await Promise.all(writes);
  assert.equal((await store.listOrders()).length, 20);
  assert.deepEqual((await fs.readdir(directory)).sort(), ['orders.json']);
});

test('corrupt, empty, malformed, and duplicate records fail closed without overwriting history', async () => {
  for (const invalid of ['{broken', '', '  ', '{}', '[null]', '[{}]', '[{"id":"ORD1"},{"id":"ORD1"}]']) {
    await fs.writeFile(ordersFile, invalid);
    assert.equal((await request('/api/health', undefined, {}, 'GET')).status, 503);
    assert.equal((await request('/api/orders', undefined, adminHeaders, 'GET')).status, 503);
    assert.equal((await request('/api/orders', checkout())).status, 503);
    assert.equal(await fs.readFile(ordersFile, 'utf8'), invalid);
  }
  await fs.writeFile(ordersFile, '[]');
  assert.equal((await request('/api/orders', checkout())).status, 201, 'Queue recovers after storage repair');
  assert.equal((await request('/api/health', undefined, {}, 'GET')).status, 200);
});

test('new JSON installations initialize safely and missing storage directories are unhealthy', async () => {
  await fs.unlink(ordersFile);
  assert.equal((await request('/api/health', undefined, {}, 'GET')).status, 200);
  assert.equal((await request('/api/orders', checkout())).status, 201);
  Object.assign(orderStore, createLocalOrderStore(path.join(directory, 'missing', 'orders.json')));
  assert.equal((await request('/api/health', undefined, {}, 'GET')).status, 503);
  assert.equal((await request('/api/orders', checkout())).status, 503);
});

test('failed atomic replacement retains history, cleans temporary files, and allows retry', async () => {
  await store.createOrder({ id: 'ORD1' });
  const original = await fs.readFile(ordersFile, 'utf8');
  const rename = fs.rename;
  try {
    fs.rename = async () => { throw new Error('Simulated disk failure'); };
    await assert.rejects(store.createOrder({ id: 'ORD2' }), { status: 503 });
  } finally {
    fs.rename = rename;
  }
  assert.equal(await fs.readFile(ordersFile, 'utf8'), original);
  assert.deepEqual(await fs.readdir(directory), ['orders.json']);
  await store.createOrder({ id: 'ORD2' });
  await assert.rejects(store.createOrder({ id: 'ORD2' }), { status: 503 });
  assert.equal((await store.listOrders()).length, 2);
});

test('repeated and structured catalog query parameters return clear 400 responses', async () => {
  for (const [endpoint, fields] of [
    ['/api/menu', ['search', 'category', 'restaurantId']],
    ['/api/restaurants', ['search', 'cuisine', 'city']]
  ]) {
    for (const field of fields) {
      for (const query of [`${field}=x&${field}=y`, `${field}[value]=x`]) {
        const response = await request(`${endpoint}?${query}`, undefined, {}, 'GET');
        assert.equal(response.status, 400, `${endpoint}?${query}`);
        assert.match(response.body.message, /single text value/);
      }
    }
  }
});

test('catalog identifiers reject partial numbers, fractions, zero, and unsafe integers', async () => {
  for (const id of ['1junk', '1.5', '-1', '0', 'Infinity', '9007199254740992', '']) {
    for (const endpoint of [
      `/api/menu?restaurantId=${id}`,
      ...(id ? [`/api/menu/${id}`, `/api/restaurants/${id}`, `/api/restaurants/${id}/menu`] : [])
    ]) assert.equal((await request(endpoint, undefined, {}, 'GET')).status, 400, endpoint);
  }
  assert.equal((await request(`/api/menu/${menuItem.id}`, undefined, {}, 'GET')).status, 200);
});

test('malformed checkout bodies and non-object cart entries return 400', async () => {
  for (const body of [null, [], 'invalid', {}, checkout({ items: [null] }),
    checkout({ items: [1] }), checkout({ items: [[]] }), checkout({ customerPhone: {} }),
    checkout({ customerAddress: [] })]) {
    assert.equal((await request('/api/orders', body)).status, 400, JSON.stringify(body));
  }
  assert.deepEqual(await store.listOrders(), []);
});

test('checkout validates integer quantities and IDs without coercing arrays or booleans', async () => {
  for (const quantity of ['1.9junk', '2junk', 1.9, 0, -1, 51, true, [1], {}, null, 'Infinity']) {
    const result = await request('/api/orders', checkout({ items: [{ id: menuItem.id, quantity }] }));
    assert.equal(result.status, 400, `quantity=${JSON.stringify(quantity)}`);
  }
  for (const id of [true, [menuItem.id], {}, null, `${menuItem.id}junk`, 1.5]) {
    assert.equal((await request('/api/orders', checkout({ items: [{ id, quantity: 1 }] }))).status, 400);
  }
  assert.deepEqual(await store.listOrders(), []);
  assert.equal((await request('/api/orders', checkout({ items: [{ id: String(menuItem.id), quantity: '2' }] }))).status, 201);
});

test('nonfinite and malformed prices and totals are rejected while catalog pricing remains authoritative', async () => {
  for (const invalid of ['oops', 'NaN', 'Infinity', '1e309', null, true, [], {}, '', -1]) {
    const result = await request('/api/orders', checkout({ items: [{ id: menuItem.id, quantity: 1, price: invalid }] }));
    assert.equal(result.status, 400, `price=${JSON.stringify(invalid)}`);
    assert.equal((await request('/api/orders', checkout({ totalAmount: invalid }))).status, 400);
  }
  const mismatch = await request('/api/orders', checkout({ items: [{ id: menuItem.id, quantity: 1, price: menuItem.price + 1 }] }));
  assert.equal(mismatch.status, 400);
  assert.equal(mismatch.body.priceChanged, true);
  assert.deepEqual(await store.listOrders(), []);
});

test('invalid status values return 400 for staff while unauthenticated updates stay forbidden', async () => {
  for (const status of [123, true, [], {}, null, 'unknown']) {
    assert.equal((await request('/api/orders/ORD1025/status', { status }, adminHeaders, 'PATCH')).status, 400);
    assert.equal((await request('/api/orders/ORD1025/status', { status }, {}, 'PATCH')).status, 403);
  }
  assert.equal((await request('/api/orders/ORD1025/status', [], adminHeaders, 'PATCH')).status, 400);
});

test('customer and staff tokens remain required and hashes never appear in API responses', async () => {
  const created = await request('/api/orders', checkout({ customerPhone: '0000000000', customerAddress: 'Synthetic address' }));
  const id = created.body.data.id;
  assert.equal(created.status, 201);
  assert.equal(created.body.data.accessTokenHash, undefined);
  for (const headers of [{}, { 'x-order-token': 'wrong' }]) {
    assert.equal((await request(`/api/orders/${id}`, undefined, headers, 'GET')).status, 403);
  }
  const customer = await request(`/api/orders/${id}`, undefined, { 'x-order-token': created.body.orderAccessToken }, 'GET');
  assert.equal(customer.status, 200);
  assert.equal(customer.body.data.customerPhone, undefined);
  assert.equal(customer.body.data.customerAddress, undefined);
  assert.equal(customer.body.data.accessTokenHash, undefined);
  const staff = await request('/api/orders', undefined, adminHeaders, 'GET');
  assert.equal(staff.body.count, 1);
  assert.equal(staff.body.data[0].accessTokenHash, undefined);
  const bearer = await request(`/api/orders/${id}`, undefined, { Authorization: `Bearer ${process.env.ADMIN_TOKEN}` }, 'GET');
  assert.equal(bearer.body.isAdmin, true);
  for (const token of ['admin123', 'admin-secret-key']) {
    const anonymous = await request('/api/orders', undefined, { 'x-admin-token': token }, 'GET');
    assert.deepEqual(anonymous.body.data, []);
    assert.equal(anonymous.body.isAdmin, false);
  }
});

test('cross-origin preflight permits customer and staff token headers', async () => {
  const response = await fetch(`${baseUrl}/api/orders/ORD1025`, { method: 'OPTIONS', headers: {
    Origin: 'https://frontend.example.test',
    'Access-Control-Request-Method': 'GET',
    'Access-Control-Request-Headers': 'x-admin-token,x-order-token'
  } });
  assert.equal(response.status, 204);
  const allowed = response.headers.get('access-control-allow-headers').toLowerCase().split(',').map(header => header.trim());
  assert.ok(allowed.includes('x-admin-token'));
  assert.ok(allowed.includes('x-order-token'));
});
