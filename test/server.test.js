const { test, before, after } = require('node:test');
const assert = require('node:assert');
const app = require('../server/server');

let server;
let baseUrl;

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  baseUrl = `http://localhost:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test('GET /api/restaurants returns the list of restaurants', async () => {
  const res = await fetch(`${baseUrl}/api/restaurants`);
  assert.strictEqual(res.status, 200);

  const body = await res.json();
  assert.strictEqual(body.success, true);
  assert.ok(Array.isArray(body.data));
  assert.strictEqual(body.count, body.data.length);
});
