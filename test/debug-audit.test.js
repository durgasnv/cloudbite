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

test('D03: American / Fast Food chip and API include both advertised cuisines', async () => {
  const html = await readFile(path.resolve(__dirname, '../client/restaurants.html'), 'utf8');
  const chip = html.match(/data-cuisine="([^"]+)">American \/ Fast Food/)[1];
  const expected = restaurants.filter(r => /american|fast\s*food/i.test(r.cuisine));
  assert.ok(expected.length > 0);
  assert.deepEqual(filterRestaurants(structuredClone(restaurants), [], '', chip).map(r => r.id), expected.map(r => r.id));
  const response = await request('/api/restaurants?cuisine=' + encodeURIComponent(chip));
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data.map(r => r.id), expected.map(r => r.id));
});

test('D04: unknown city selection never silently resets to all restaurants', () => {
  const ui = browser('restaurants');
  ui.context.records = restaurants;
  ui.run("currentCityFilter = 'Unknown-City-For-Reproduction'; populateCityOptions(records);");
  assert.equal(ui.run('filterRestaurants(records, [], "", "all", currentCityFilter).length'), 0);
  assert.equal(ui.node('restaurantCitySelect').value, 'Unknown-City-For-Reproduction');
  ui.run("currentCityFilter = 'hyderabad'; populateCityOptions(records);");
  assert.equal(ui.node('restaurantCitySelect').value, 'Hyderabad');
});

test('D05: superseded order lookups cannot overwrite a newer error or save tokens under the wrong ID', async () => {
  const ui = browser('orders');
  const pending = [];
  ui.context.fetch = () => new Promise(resolve => pending.push(resolve));
  ui.node('orderLookupToken').value = 'a'.repeat(64);
  ui.node('orderLookupInput').value = 'ORDOLD';
  const old = ui.context.handleOrderLookup();
  ui.node('orderLookupToken').value = 'b'.repeat(64);
  ui.node('orderLookupInput').value = 'ORDNEW';
  const recent = ui.context.handleOrderLookup();
  pending[1]({ ok: false, status: 403, json: async () => ({ success: false }) });
  await recent;
  pending[0]({ ok: true, status: 200, json: async () => ({ success: true, data: { id: 'ORDOLD', items: [], totalAmount: 100 } }) });
  await old;
  assert.equal(ui.node('ordersListContainer').children.length, 0);
  assert.equal(ui.node('emptyOrdersState').style.display, 'block');
  assert.equal(ui.values.has('cloudbite_my_orders'), false);
});

test('D06: blocked sessionStorage does not crash Orders initialization or staff access entry', async () => {
  const ui = browser('orders');
  ui.context.sessionStorage = { getItem() { throw new Error('SecurityError'); },
    setItem() { throw new Error('SecurityError'); }, removeItem() { throw new Error('SecurityError'); } };
  assert.doesNotThrow(() => ui.context.initOrdersPage());
  assert.equal(ui.context.getAdminToken(), '');
  assert.doesNotThrow(() => ui.context.setAdminToken('debug-only-token'));
  ui.context.window.prompt = () => 'debug-only-token';
  assert.doesNotThrow(() => ui.context.promptAdminMode());
  assert.equal(ui.run('isAdminMode'), false);
});

test('D07: unavailable menu dishes cannot be added through controls or programmatic cart calls', async () => {
  const ui = browser('menu');
  ui.run("currentMenu = [{id: 1, restaurantId: 1, name: 'Unavailable', price: 100, isAvailable: false}]; renderMenuItems();");
  const button = ui.all(ui.node('menuGrid')).find(node => node.className === 'food-add-btn');
  assert.equal(button.disabled, true);
  button.fire('click');
  ui.context.addToCart({ id: 1, name: 'Unavailable', price: 100, isAvailable: false });
  assert.equal(ui.context.getCart().length, 0);
  ui.context.addToCart({ id: 2, name: 'Available', price: 100, isAvailable: true });
  assert.equal(ui.context.getCart().length, 1);
});

test('D08: missing menu data must not silently turn a complete dish search into partial success', async () => {
  overrides.set(path.resolve(__dirname, '../server/data/menu.json'), '{broken');
  assert.equal((await request('/api/restaurants?search=biryani')).status, 503);
});

test('D08: frontend dish-search failure is visible instead of partial success', async () => {
  const ui = browser('restaurants');
  ui.run("currentSearchQuery = 'biryani';");
  ui.context.fetch = async target => ({ ok: !target.endsWith('/menu'), status: target.endsWith('/menu') ? 503 : 200,
    json: async () => target.endsWith('/menu') ? { success: false } : { success: true, data: restaurants } });
  await ui.context.fetchRestaurants();
  assert.match(ui.all(ui.node('restaurantsGrid')).map(node => node.textContent).join(' '), /unavailable|unable/i);
  assert.doesNotMatch(ui.node('restaurantCountLabel').textContent, /^Showing \d+ restaurants$/);
});

test('D09: malformed catalog structures fail closed on listing, filtering, details, and checkout', async () => {
  for (const raw of ['{}', 'null', '[null]', '[{"id":1}]']) {
    overrides.set(path.resolve(__dirname, '../server/data/menu.json'), raw);
    for (const endpoint of ['/api/menu', '/api/menu?search=rice', '/api/menu/1', '/api/restaurants/1/menu']) {
      const result = await request(endpoint);
      assert.equal(result.status, 503, `${endpoint} with ${raw}`);
      assert.equal(result.body.success, false);
    }
    assert.equal((await request('/api/orders', order([{ id: 1, quantity: 1 }]))).status, 503);
    assert.deepEqual(await store.listOrders(), []);
  }
  overrides.clear();
  overrides.set(path.resolve(__dirname, '../server/data/restaurants.json'), '[{"id":1}]');
  assert.equal((await request('/api/restaurants')).status, 503);
  overrides.clear();
  assert.equal((await request('/api/menu')).status, 200);
});

test('D10: branch jobs sharing BUILD_NUMBER cannot publish identical image tags', async () => {
  const pipeline = await readFile(path.resolve(__dirname, '../Jenkinsfile'), 'utf8');
  function references(job, build, commit = 'a'.repeat(40)) {
    if (pipeline.includes('node scripts/image-tags.js')) {
      return execFileSync(process.execPath, [path.resolve(__dirname, '../scripts/image-tags.js')], {
        env: { PATH: process.env.PATH, JOB_NAME: job, BUILD_NUMBER: String(build), GIT_COMMIT: commit }
      }).toString().trim().split('\n');
    }
    return [...pipeline.matchAll(/env\.(?:BACKEND|FRONTEND)_IMAGE = "([^"]+)"/g)].map(match =>
      match[1].replace('${env.BUILD_NUMBER}', String(build)));
  }
  const main = references('cloudbite/main', 42);
  const feature = references('cloudbite/feature/api', 42);
  assert.equal(main.length, 2);
  assert.notDeepEqual(main, feature);
  assert.notDeepEqual(main, references('cloudbite/main', 43));
  for (const ref of [...main, ...feature]) assert.match(ref, /^cloudbite-(backend|frontend):[a-zA-Z0-9_][a-zA-Z0-9_.-]{0,127}$/);
});
