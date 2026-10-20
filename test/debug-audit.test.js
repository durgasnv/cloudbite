const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { browser } = require('../scripts/debug/browser-harness');
process.env.NODE_ENV = 'test';
process.env.ADMIN_TOKEN = 'debug-only-staff';
delete process.env.DATABASE_URL;
delete process.env.PGHOST;
const app = require('../server/server');
const storage = require('../server/storage/orderStore');
const { createLocalOrderStore } = require('../server/storage/localOrderStore');
const restaurants = require('../server/data/restaurants.json');
const menu = require('../server/data/menu.json');
const { filterRestaurants } = require('../client/js/restaurants');
let directory, store, server, url;
const overrides = new Map();
const readFile = fs.readFile;
before(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'cloudbite-debug-'));
  store = createLocalOrderStore(path.join(directory, 'orders.json'));
  Object.assign(storage, store);
  fs.readFile = async (name, ...args) => {
    const key = String(name);
    return overrides.has(key) ? overrides.get(key) : readFile(name, ...args);
  };
  server = await new Promise((resolve, reject) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    listener.on('error', reject);
  });
  url = `http://127.0.0.1:${server.address().port}`;
});
beforeEach(async () => { overrides.clear(); await fs.writeFile(path.join(directory, 'orders.json'), '[]'); });
after(async () => {
  fs.readFile = readFile;
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  if (directory) await fs.rm(directory, { recursive: true, force: true });
});
async function request(endpoint, body) {
  const response = await fetch(url + endpoint, { method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, body: await response.json() };
}
const order = items => ({ customerName: 'Synthetic debug customer', items });

test('D01: duplicate item rows cannot bypass the aggregate 50-unit limit', async () => {
  const item = menu[0];
  const response = await request('/api/orders', order([
    { id: item.id, quantity: 50 }, { id: String(item.id), quantity: 50 }
  ]));
  assert.equal(response.status, 400);
  assert.deepEqual(await store.listOrders(), []);
  assert.equal((await request('/api/orders', order([{ id: item.id, quantity: 25 }, { id: item.id, quantity: 25 }]))).status, 201);
});

test('D02: checkout rejects different cities and preserves same-city multi-outlet orders', async () => {
  const first = menu[0];
  const outlet = restaurants.find(r => r.id === first.restaurantId);
  const otherCity = menu.find(item => restaurants.find(r => r.id === item.restaurantId).city !== outlet.city);
  assert.ok(otherCity);
  assert.equal((await request('/api/orders', order([first, otherCity].map(item => ({ id: item.id, quantity: 1 }))))).status, 400);
  assert.deepEqual(await store.listOrders(), []);
  const sameCity = menu.find(item => item.restaurantId !== first.restaurantId && restaurants.find(r => r.id === item.restaurantId).city === outlet.city);
  assert.ok(sameCity);
  assert.equal((await request('/api/orders', order([first, sameCity].map(item => ({ id: item.id, quantity: 1 }))))).status, 201);
});
