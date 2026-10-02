const { test } = require('node:test');
const assert = require('node:assert/strict');
process.env.ADMIN_TOKEN = 'test-only-configured-token';
const app = require('../server/server');

test('public demo and fallback keys cannot grant staff access', async () => {
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, () => resolve(listener));
  });

  try {
    for (const token of ['admin123', 'admin-secret-key']) {
      const response = await fetch(`http://localhost:${server.address().port}/api/orders`, {
        headers: { 'x-admin-token': token }
      });
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.isAdmin, false, 'A public or fallback key must never grant staff access');
      assert.deepEqual(body.data, [], 'A public or fallback key must not list customer orders');
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
