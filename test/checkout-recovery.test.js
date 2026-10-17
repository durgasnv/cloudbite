const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { formatPrice, saveMyOrderAccess } = require('../client/js/app');

function element() {
  return {
    value: '', textContent: '', style: {}, hidden: false, children: [],
    classList: { add() {}, remove() {} },
    set innerHTML(value) { assert.equal(value, '', 'Untrusted HTML must not be inserted'); },
    setAttribute() {}, focus() {}, addEventListener() {},
    querySelector() { return null; },
    appendChild(child) { this.children.push(child); },
    append(...children) { this.children.push(...children); }
  };
}

function browser(script, values = new Map()) {
  const nodes = new Map();
  const context = vm.createContext({
    console: { error() {}, warn() {} },
    localStorage: {
      getItem: key => values.get(key) || null,
      setItem: (key, value) => values.set(key, value),
      removeItem: key => values.delete(key)
    },
    document: {
      addEventListener() {}, querySelectorAll: () => [],
      getElementById(id) {
        if (!nodes.has(id)) nodes.set(id, element());
        return nodes.get(id);
      },
      createElement: element, createDocumentFragment: element
    }
  });
  for (const name of ['app', script]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, `../client/js/${name}.js`), 'utf8'), context);
  }
  return { context, node: id => context.document.getElementById(id) };
}

test('prices preserve paise in dishes, cart totals, and confirmation', () => {
  assert.equal(formatPrice(803.57), '₹803.57');
  assert.equal(formatPrice(16.07 * 3 + 50), '₹98.21');
  assert.equal(formatPrice(280), '₹280');
  assert.equal(formatPrice(Infinity), '₹0');
});

test('saving tracking access explicitly fails without storage', () => {
  assert.equal(saveMyOrderAccess('ORDTEST', 'a'.repeat(64)), false);
});

for (const failure of ['quota', 'silent-write', 'remove']) {
  test(`confirmed checkout remains recoverable after ${failure} storage failure`, async () => {
    const values = new Map([['cloudbite_cart', JSON.stringify([{ id: 1, name: 'Dish', price: 16.07, quantity: 1 }])]]);
    const { context, node } = browser('cart', values);
    if (failure === 'quota') context.localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
    if (failure === 'silent-write') context.localStorage.setItem = () => {};
    if (failure === 'remove') context.localStorage.removeItem = () => { throw new Error('Storage unavailable'); };
    node('customerName').value = 'Synthetic customer';
    let requests = 0;
    context.fetch = async () => {
      requests++;
      return { ok: true, json: async () => ({ success: true,
        data: { id: 'ORDTEST', status: 'CONFIRMED', totalAmount: 66.07 }, orderAccessToken: 'a'.repeat(64) }) };
    };
    await context.handlePlaceOrder({ preventDefault() {} });
    assert.equal(node('modalOrderId').textContent, 'ORDTEST');
    assert.equal(node('modalOrderTotal').textContent, '₹66.07');
    assert.equal(node('orderTrackingToken').value, 'a'.repeat(64));
    assert.equal(node('orderTrackingRecovery').hidden, false);
    assert.match(node('orderTrackingMessage').textContent,
      failure === 'remove' ? /saved in this browser/ : /could not be saved/);
    assert.equal(node('placeOrderBtn').disabled, true);
    await context.handlePlaceOrder({ preventDefault() {} });
    assert.equal(requests, 1, 'A confirmed order must not be duplicated');
  });
}

test('failed checkout preserves the cart and permits retry', async () => {
  const values = new Map([['cloudbite_cart', JSON.stringify([{ id: 1, price: 100, quantity: 1 }])]]);
  const { context, node } = browser('cart', values);
  node('customerName').value = 'Synthetic customer';
  context.fetch = async () => { throw new Error('Offline'); };
  context.showToast = () => {};
  await context.handlePlaceOrder({ preventDefault() {} });
  assert.equal(node('placeOrderBtn').disabled, false);
  assert.equal(JSON.parse(values.get('cloudbite_cart')).length, 1);
});

test('manual tracking sends the private token in a header and renders customer text safely', async () => {
  const { context, node } = browser('orders');
  context.localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
  node('orderLookupInput').value = 'ORDTEST';
  node('orderLookupToken').value = 'b'.repeat(64);
  const requests = [];
  context.fetch = async (url, options) => {
    requests.push({ url, options });
    return { ok: true, status: 200, json: async () => ({ success: true, isAdmin: false,
      data: { id: 'ORDTEST', customerName: '<img src=x onerror=alert(1)>', status: 'CONFIRMED', items: [], totalAmount: 66.07 } }) };
  };
  await context.handleOrderLookup();
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, '/api/orders/ORDTEST');
  assert.equal(requests[0].options.headers['x-order-token'], 'b'.repeat(64));
  assert.equal(node('ordersListContainer').children.length, 1);
  const texts = [];
  function visit(el) { texts.push(el.textContent); for (const child of el.children) visit(child); }
  visit(node('ordersListContainer'));
  assert.ok(texts.includes('<img src=x onerror=alert(1)>'));
});
