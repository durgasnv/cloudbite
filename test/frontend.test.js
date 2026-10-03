const { test, before, after } = require('node:test');
const assert = require('node:assert');
process.env.ADMIN_TOKEN = 'test-only-configured-token';
const app = require('../server/server');
const { validateCartItem, sanitizeImageUrl, formatPrice, getMyOrderAccess, saveMyOrderAccess } = require('../client/js/app');
const { filterRestaurants, getAvailableCities } = require('../client/js/restaurants');
const { calculateOrderTotals } = require('../client/js/cart');
const { getStatusClass } = require('../client/js/orders');

const fs = require('node:fs').promises;
const path = require('node:path');

let server;
let baseUrl;
const ordersFilePath = path.join(__dirname, '../server/data/orders.json');
let initialOrdersContent = '[]';

before(async () => {
  try {
    initialOrdersContent = await fs.readFile(ordersFilePath, 'utf8');
  } catch (e) {
    initialOrdersContent = '[]';
  }

  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  baseUrl = `http://localhost:${server.address().port}`;
});

after(async () => {
  try {
    await fs.writeFile(ordersFilePath, initialOrdersContent, 'utf8');
  } catch (e) {
    console.error('Failed to restore orders.json:', e);
  }
  await new Promise((resolve) => server.close(resolve));
});

/* ==========================================================================
   1. Search & Filter Tests (Fulfilling Food + Restaurant Search Promise)
   ========================================================================== */

test('Search & Filter: matches restaurant by restaurant name, cuisine, and location', () => {
  const sampleRestaurants = [
    { id: 1, name: 'Spice Garden', cuisine: 'North Indian', location: 'Hyderabad' },
    { id: 2, name: 'Bella Italia', cuisine: 'Italian', location: 'Bangalore' },
    { id: 3, name: 'Dragon Wok', cuisine: 'Chinese & Asian', location: 'Mumbai' }
  ];
  const sampleMenu = [];

  // Match by restaurant name
  const nameResults = filterRestaurants(sampleRestaurants, sampleMenu, 'Bella', 'all');
  assert.strictEqual(nameResults.length, 1);
  assert.strictEqual(nameResults[0].id, 2);

  // Match by cuisine
  const cuisineResults = filterRestaurants(sampleRestaurants, sampleMenu, '', 'Italian');
  assert.strictEqual(cuisineResults.length, 1);
  assert.strictEqual(cuisineResults[0].name, 'Bella Italia');

  // Match by location
  const locResults = filterRestaurants(sampleRestaurants, sampleMenu, 'mumbai', 'all');
  assert.strictEqual(locResults.length, 1);
  assert.strictEqual(locResults[0].name, 'Dragon Wok');
});

test('Search & Filter: searches menu dishes and matches restaurants offering them', () => {
  const sampleRestaurants = [
    { id: 1, name: 'Spice Garden', cuisine: 'North Indian', location: 'Hyderabad' },
    { id: 2, name: 'Bella Italia', cuisine: 'Italian', location: 'Bangalore' }
  ];
  const sampleMenu = [
    { id: 101, restaurantId: 1, name: 'Hyderabadi Chicken Dum Biryani', category: 'Main Course' },
    { id: 102, restaurantId: 2, name: 'Wood-fired Margherita Pizza', category: 'Pizza' }
  ];

  // Searching "biryani" must match "Spice Garden" because it serves Biryani
  const biryaniResults = filterRestaurants(sampleRestaurants, sampleMenu, 'biryani', 'all');
  assert.strictEqual(biryaniResults.length, 1);
  assert.strictEqual(biryaniResults[0].name, 'Spice Garden');
  assert.ok(biryaniResults[0]._matchingDishes);
  assert.strictEqual(biryaniResults[0]._matchingDishes[0].name, 'Hyderabadi Chicken Dum Biryani');

  // Searching "pizza" must match "Bella Italia"
  const pizzaResults = filterRestaurants(sampleRestaurants, sampleMenu, 'pizza', 'all');
  assert.strictEqual(pizzaResults.length, 1);
  assert.strictEqual(pizzaResults[0].name, 'Bella Italia');

  // Searching something unavailable returns empty array
  const emptyResults = filterRestaurants(sampleRestaurants, sampleMenu, 'sushi rolls', 'all');
  assert.strictEqual(emptyResults.length, 0);
});

test('City filter combines with dish search and matches only the selected city', () => {
  const restaurants = [
    { id: 1, name: 'Spice Garden', cuisine: 'North Indian', location: 'Jubilee Hills, Hyderabad' },
    { id: 2, name: 'Other Biryani', cuisine: 'North Indian', location: 'Central, Mumbai' },
    { id: 3, name: 'City Cafe', cuisine: 'Cafe', city: 'Hyderabad', location: 'Jubilee Hills' }
  ];
  const menu = [
    { restaurantId: 1, name: 'Biryani' },
    { restaurantId: 2, name: 'Biryani' }
  ];
  assert.deepStrictEqual(
    filterRestaurants(restaurants, menu, 'biryani', 'Indian', 'hyderabad').map(r => r.id),
    [1]
  );
  assert.deepStrictEqual(
    filterRestaurants(restaurants, menu, '', 'all', 'Hyderabad').map(r => r.id),
    [1, 3]
  );
});

test('City choices come from restaurant data and filtering works for every available city', () => {
  const restaurants = [
    { id: 1, city: 'Hyderabad', location: 'Jubilee Hills' },
    { id: 2, city: 'Bangalore', location: 'Indiranagar' },
    { id: 3, location: 'Bandra West, Mumbai' },
    { id: 4, city: 'mumbai', location: 'Andheri' },
    { id: 5, city: 'Pune', location: 'Kothrud' }
  ];
  const cities = getAvailableCities(restaurants);
  assert.deepStrictEqual(cities.map(city => city.toLowerCase()), ['bangalore', 'hyderabad', 'mumbai', 'pune']);
  for (const city of cities) {
    const results = filterRestaurants(restaurants, [], '', 'all', city);
    assert.ok(results.length > 0);
    assert.ok(results.every(restaurant =>
      (restaurant.city || restaurant.location.split(',').pop().trim()).toLowerCase() === city.toLowerCase()
    ));
  }
});

test('API GET /api/restaurants: backend endpoint supports food search', async () => {
  const res = await fetch(`${baseUrl}/api/restaurants?search=biryani`);
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.success, true);
  assert.ok(body.data.length > 0);
  assert.strictEqual(body.data[0].name, 'Spice Garden');
  assert.ok(Array.isArray(body.data[0].matchedDishes));
});

test('API GET /api/restaurants filters by exact city with search', async () => {
  const res = await fetch(`${baseUrl}/api/restaurants?city=hyderabad&search=biryani`);
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.deepStrictEqual(body.data.map(r => r.name), ['Spice Garden']);

  const missing = await fetch(`${baseUrl}/api/restaurants?city=Hyder`);
  assert.deepStrictEqual((await missing.json()).data, []);

  for (const [city, expectedCount] of [['Bangalore', 2], ['Mumbai', 1], ['New Delhi', 1]]) {
    const response = await fetch(`${baseUrl}/api/restaurants?city=${encodeURIComponent(city)}`);
    const data = (await response.json()).data;
    assert.strictEqual(data.length, expectedCount);
    assert.ok(data.every(restaurant => restaurant.location.endsWith(city)));
  }
});

/* ==========================================================================
   2. Cart Validation, Sanitization & Pricing Logic
   ========================================================================== */

test('Cart Validation: validateCartItem sanitizes and validates cart entries', () => {
  // Valid item
  const valid = validateCartItem({
    id: 1,
    name: 'Butter Chicken',
    price: 320,
    quantity: 2,
    image: 'https://images.unsplash.com/photo-1'
  });
  assert.strictEqual(valid.id, 1);
  assert.strictEqual(valid.name, 'Butter Chicken');
  assert.strictEqual(valid.price, 320);
  assert.strictEqual(valid.quantity, 2);

  // Negative or NaN price rejected
  assert.strictEqual(validateCartItem({ id: 1, name: 'Item', price: -10, quantity: 1 }), null);
  assert.strictEqual(validateCartItem({ id: 1, name: 'Item', price: 'invalid', quantity: 1 }), null);

  // Negative or zero quantity capped to minimum 1
  const minQty = validateCartItem({ id: 1, name: 'Item', price: 100, quantity: -5 });
  assert.strictEqual(minQty.quantity, 1);

  // Excessive quantity capped to maximum 50
  const maxQty = validateCartItem({ id: 1, name: 'Item', price: 100, quantity: 999 });
  assert.strictEqual(maxQty.quantity, 50);

  // Malformed non-object rejected
  assert.strictEqual(validateCartItem(null), null);
  assert.strictEqual(validateCartItem(undefined), null);
  assert.strictEqual(validateCartItem('string'), null);
});

test('Cart Totals: calculateOrderTotals enforces delivery fee tiers and platform fee', () => {
  // Empty cart
  const emptyTotals = calculateOrderTotals([]);
  assert.strictEqual(emptyTotals.subtotal, 0);
  assert.strictEqual(emptyTotals.deliveryFee, 0);
  assert.strictEqual(emptyTotals.platformFee, 0);
  assert.strictEqual(emptyTotals.grandTotal, 0);

  // Cart below ₹500 has ₹40 delivery fee + ₹10 platform fee
  const smallCart = [{ id: 1, price: 200, quantity: 1 }];
  const smallTotals = calculateOrderTotals(smallCart);
  assert.strictEqual(smallTotals.subtotal, 200);
  assert.strictEqual(smallTotals.deliveryFee, 40);
  assert.strictEqual(smallTotals.platformFee, 10);
  assert.strictEqual(smallTotals.grandTotal, 250);

  // Cart >= ₹500 has FREE delivery (₹0) + ₹10 platform fee
  const largeCart = [{ id: 1, price: 280, quantity: 2 }]; // subtotal = 560
  const largeTotals = calculateOrderTotals(largeCart);
  assert.strictEqual(largeTotals.subtotal, 560);
  assert.strictEqual(largeTotals.deliveryFee, 0);
  assert.strictEqual(largeTotals.platformFee, 10);
  assert.strictEqual(largeTotals.grandTotal, 570);
});

/* ==========================================================================
   3. Checkout Validation & Authoritative Server Pricing
   ========================================================================== */

test('Checkout: Server rejects tampered item prices with clear priceChanged error', async () => {
  // Item 1 in menu.json costs ₹280. Client tampers price to ₹1.
  const tamperedPayload = {
    customerName: 'Attacker Tamper',
    customerPhone: '9876543210',
    customerAddress: 'Secret St',
    items: [{ id: 1, name: 'Hyderabadi Chicken Dum Biryani', price: 1, quantity: 1 }],
    totalAmount: 51
  };

  const res = await fetch(`${baseUrl}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tamperedPayload)
  });

  assert.strictEqual(res.status, 400);
  const body = await res.json();
  assert.strictEqual(body.success, false);
  assert.strictEqual(body.priceChanged, true);
  assert.ok(body.message.includes('Price mismatch'));
});

test('Checkout: Server rejects non-existent or unavailable item IDs', async () => {
  const invalidItemPayload = {
    customerName: 'Test Customer',
    items: [{ id: 99999, name: 'Ghost Item', quantity: 1, price: 100 }],
    totalAmount: 150
  };

  const res = await fetch(`${baseUrl}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(invalidItemPayload)
  });

  assert.strictEqual(res.status, 400);
  const body = await res.json();
  assert.strictEqual(body.success, false);
  assert.strictEqual(body.unavailableItemId, 99999);
});

test('Checkout: Server authoritatively confirms valid orders and computes verified total', async () => {
  // Item 1 = 280, quantity = 2 -> subtotal = 560 -> delivery = 0 -> platform = 10 -> grandTotal = 570
  const validPayload = {
    customerName: 'Aarav Patel',
    customerPhone: '9876543210',
    customerAddress: '42 Baker Street, Bangalore',
    items: [{ id: 1, quantity: 2, price: 280 }],
    totalAmount: 570
  };

  const res = await fetch(`${baseUrl}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validPayload)
  });

  assert.strictEqual(res.status, 201);
  const body = await res.json();
  assert.strictEqual(body.success, true);
  assert.strictEqual(body.data.totalAmount, 570);
  assert.strictEqual(body.data.status, 'CONFIRMED');
  assert.ok(body.data.id.startsWith('ORD'));
});

/* ==========================================================================
   4. Order History Visibility & Access Control Enforcement
   ========================================================================== */

test('Access Control: GET /api/orders without credentials or orderIds blocks listing all customer details', async () => {
  const res = await fetch(`${baseUrl}/api/orders`);
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.success, true);
  assert.strictEqual(body.count, 0);
  assert.strictEqual(body.isAdmin, false);
  assert.deepStrictEqual(body.data, []);
});

test('Access Control: order details require the private tracking token', async () => {
  // First place an order
  const orderRes = await fetch(`${baseUrl}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerName: 'Rohan Sharma',
      customerPhone: '9876543210',
      customerAddress: 'Jubilee Hills',
      items: [{ id: 4, quantity: 1, price: 60 }], // Garlic Naan = 60 + 40 + 10 = 110
      totalAmount: 110
    })
  });
  const orderJson = await orderRes.json();
  const createdId = orderJson.data.id;
  const accessToken = orderJson.orderAccessToken;
  assert.match(accessToken, /^[a-f0-9]{64}$/);

  // A sequential order ID alone must not expose customer details.
  const custRes = await fetch(`${baseUrl}/api/orders?orderIds=${createdId}`);
  assert.strictEqual(custRes.status, 200);
  const custBody = await custRes.json();
  assert.deepStrictEqual(custBody.data, []);

  const withoutToken = await fetch(`${baseUrl}/api/orders/${createdId}`);
  assert.strictEqual(withoutToken.status, 403);

  const wrongToken = await fetch(`${baseUrl}/api/orders/${createdId}`, {
    headers: { 'x-order-token': '0'.repeat(64) }
  });
  assert.strictEqual(wrongToken.status, 403);

  const withToken = await fetch(`${baseUrl}/api/orders/${createdId}`, {
    headers: { 'x-order-token': accessToken }
  });
  assert.strictEqual(withToken.status, 200);
  const order = (await withToken.json()).data;
  assert.strictEqual(order.id, createdId);
  assert.strictEqual(order.customerAddress, undefined);
  assert.strictEqual(order.customerPhone, undefined);
  assert.strictEqual(order.accessTokenHash, undefined);
});

test('Customer tracking stores only orders with a valid private token', () => {
  const values = new Map();
  global.localStorage = {
    getItem: key => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key)
  };
  try {
    values.set('cloudbite_my_orders', JSON.stringify(['ORD1025']));
    assert.deepStrictEqual(getMyOrderAccess(), []);
    saveMyOrderAccess('ORDTEST', 'a'.repeat(64));
    assert.deepStrictEqual(getMyOrderAccess(), [{ id: 'ORDTEST', token: 'a'.repeat(64) }]);
    saveMyOrderAccess('ORDINVALID', 'short');
    assert.strictEqual(getMyOrderAccess().length, 1);
  } finally {
    delete global.localStorage;
  }
});

test('Access Control: PATCH /api/orders/:id/status rejected with 403 Forbidden without admin credentials', async () => {
  const res = await fetch(`${baseUrl}/api/orders/ORD1025/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'COMPLETED' })
  });

  assert.strictEqual(res.status, 403);
  const body = await res.json();
  assert.strictEqual(body.success, false);
  assert.ok(body.message.includes('Admin authorization required'));
});

test('Access Control: PATCH /api/orders/:id/status succeeds with x-admin-token', async () => {
  // Create an order first
  const orderRes = await fetch(`${baseUrl}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerName: 'Admin Order Test',
      items: [{ id: 4, quantity: 1, price: 60 }],
      totalAmount: 110
    })
  });
  const orderJson = await orderRes.json();
  const orderId = orderJson.data.id;

  // Update status as admin
  const patchRes = await fetch(`${baseUrl}/api/orders/${orderId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-token': 'test-only-configured-token'
    },
    body: JSON.stringify({ status: 'PREPARING' })
  });

  assert.strictEqual(patchRes.status, 200);
  const patchBody = await patchRes.json();
  assert.strictEqual(patchBody.success, true);
  assert.strictEqual(patchBody.data.status, 'PREPARING');
});

/* ==========================================================================
   5. Safe Text Rendering & Injection Defense
   ========================================================================== */

test('Security: sanitizeImageUrl disallows dangerous URI schemes', () => {
  const fallback = 'https://default.image.jpg';

  // Dangerous schemes must be replaced with fallback
  assert.strictEqual(sanitizeImageUrl('javascript:alert(1)', fallback), fallback);
  assert.strictEqual(sanitizeImageUrl('data:text/html,<script>alert(1)</script>', fallback), fallback);
  assert.strictEqual(sanitizeImageUrl('vbscript:msgbox(1)', fallback), fallback);

  // Safe HTTP/HTTPS and relative URLs allowed
  assert.strictEqual(
    sanitizeImageUrl('https://images.unsplash.com/photo-1', fallback),
    'https://images.unsplash.com/photo-1'
  );
  assert.strictEqual(
    sanitizeImageUrl('/assets/food.png', fallback),
    '/assets/food.png'
  );
});

test('Security: getStatusClass safely handles untrusted or unknown status input', () => {
  assert.strictEqual(getStatusClass('COMPLETED'), 'status-completed');
  assert.strictEqual(getStatusClass('READY'), 'status-ready');
  assert.strictEqual(getStatusClass('PREPARING'), 'status-preparing');
  assert.strictEqual(getStatusClass('CANCELLED'), 'status-cancelled');
  assert.strictEqual(getStatusClass('CONFIRMED'), 'status-confirmed');
  assert.strictEqual(getStatusClass('<script>alert(1)</script>'), 'status-confirmed');
  assert.strictEqual(getStatusClass(null), 'status-confirmed');
});
