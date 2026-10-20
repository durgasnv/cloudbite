const { fork } = require('node:child_process');
const { once } = require('node:events');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const vm = require('node:vm');
const { readFileSync } = require('node:fs');

async function start(directory, overrides = {}) {
  // Whitelist environment: do not inherit real database credentials or .env files.
  const child = fork(path.join(__dirname, 'server-fixture.js'), [], {
    cwd: directory,
    env: { PATH: process.env.PATH, NODE_ENV: 'test', ADMIN_TOKEN: 'chaos-test-only',
      ORDER_FILE_PATH: path.join(directory, 'orders.json'), ...overrides },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc']
  });
  let logs = '';
  child.stderr.on('data', chunk => { logs += chunk; });
  child.stdout.on('data', chunk => { logs += chunk; });
  const messages = [];
  const waiters = [];
  child.on('message', message => {
    const index = waiters.findIndex(waiter => waiter.predicate(message));
    if (index < 0) messages.push(message);
    else waiters.splice(index, 1)[0].resolve(message);
  });
  const wait = predicate => {
    const index = messages.findIndex(predicate);
    if (index >= 0) return Promise.resolve(messages.splice(index, 1)[0]);
    return new Promise((resolve, reject) => {
      const waiter = { predicate, resolve: value => { clearTimeout(timer); resolve(value); } };
      const timer = setTimeout(() => {
        const index = waiters.indexOf(waiter);
        if (index >= 0) waiters.splice(index, 1);
        reject(new Error(`Fixture IPC timed out: ${logs}`));
      }, 60000);
      waiters.push(waiter);
    });
  };
  const exit = once(child, 'exit');
  let startupTimer;
  const ready = await Promise.race([
    new Promise((resolve, reject) => {
      startupTimer = setTimeout(() => reject(new Error(`Fixture startup timed out: ${logs}`)), 60000);
      const onMessage = message => { if (message.port) { child.off('message', onMessage); resolve(message); } };
      child.on('message', onMessage);
    }), exit.then(() => ({ failed: true }))
  ]).finally(() => clearTimeout(startupTimer));
  const stop = async (signal = 'SIGTERM') => {
    if (child.exitCode === null && child.signalCode === null) child.kill(signal);
    await exit;
  };
  if (ready.failed) return { failed: true, logs, stop };
  return { child, wait, stop, url: `http://127.0.0.1:${ready.port}`, logs: () => logs,
    async arm(fault) { child.send({ fault }); await wait(message => message.armed === fault); } };
}
async function environment(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'cloudbite-chaos-'));
  const children = [];
  const cleanup = [];
  t.after(async () => {
    await Promise.all(children.map(child => child.stop()));
    for (const action of cleanup) await action();
    await fs.rm(directory, { recursive: true, force: true });
  });
  return { directory, cleanup, async start(overrides) { const child = await start(directory, overrides); children.push(child); return child; },
    async orders() { try { return JSON.parse(await fs.readFile(path.join(directory, 'orders.json'), 'utf8')); }
      catch (error) { if (error.code === 'ENOENT') return []; throw error; } } };
}
const menu = require('../../server/data/menu.json')[0];
const payload = { customerName: 'Synthetic chaos customer', items: [{ id: menu.id, price: menu.price, quantity: 1 }] };
async function request(url, body, headers = {}, method = body === undefined ? 'GET' : 'POST') {
  const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json', ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(8000) });
  return { status: response.status, body: await response.json() };
}
async function proxy(t, target) {
  let mode = {};
  const timers = new Set();
  const server = http.createServer((req, res) => {
    const selected = { ...mode };
    const upstream = http.request(new URL(req.url, target), { method: req.method, headers: req.headers }, incoming => {
      const chunks = [];
      incoming.on('data', chunk => chunks.push(chunk));
      incoming.on('end', () => {
        if (selected.disconnect) { res.destroy(); return; }
        const send = () => {
          if (res.destroyed) return;
          res.writeHead(incoming.statusCode, { 'Content-Type': 'application/json' });
          res.end(Buffer.concat(chunks));
        };
        if (selected.delay) {
          const timer = setTimeout(() => { timers.delete(timer); send(); }, selected.delay);
          timers.add(timer);
        } else send();
      });
    });
    upstream.on('error', () => res.destroy());
    req.pipe(upstream);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    for (const timer of timers) clearTimeout(timer);
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  });
  return { url: `http://127.0.0.1:${server.address().port}`, mode(value) { mode = value; } };
}
function browser() {
  const values = new Map([['cloudbite_cart', JSON.stringify([{ id: menu.id, name: menu.name, price: menu.price, quantity: 1 }])]]);
  const nodes = new Map();
  function element() {
    return { value: '', style: {}, children: [], textContent: '', classList: { add() {}, remove() {} },
      set innerHTML(value) { this.children = []; }, setAttribute() {}, focus() {}, addEventListener() {},
      querySelector() { return null; }, appendChild(child) { this.children.push(child); } };
  }
  const context = vm.createContext({ console: { error() {}, warn() {} }, setTimeout, clearTimeout, AbortController,
    crypto: require('node:crypto').webcrypto,
    localStorage: { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) },
    document: { addEventListener() {}, querySelectorAll: () => [], createElement: element,
      getElementById(id) { if (!nodes.has(id)) nodes.set(id, element()); return nodes.get(id); } } });
  for (const script of ['app', 'cart']) vm.runInContext(readFileSync(path.join(__dirname, `../../client/js/${script}.js`), 'utf8'), context);
  context.renderCart = () => {};
  context.showToast = () => {};
  const node = id => context.document.getElementById(id);
  node('customerName').value = 'Synthetic chaos customer';
  return { context, node, values, event: { preventDefault() {} } };
}
module.exports = { environment, payload, request, proxy, browser };
