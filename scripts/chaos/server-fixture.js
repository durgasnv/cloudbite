// Test-only fault injection. Never mounted by server/server.js.
const path = require('node:path');
const root = process.env.CHAOS_SERVER_ROOT || path.resolve(__dirname, '../../server');
const { createLocalOrderStore } = require(path.join(root, 'storage/localOrderStore'));
const app = require(path.join(root, 'server'));
const storage = require(path.join(root, 'storage/orderStore'));
let fault;
let release;
if (process.env.CHAOS_STORAGE !== 'postgres') {
  Object.assign(storage, createLocalOrderStore(process.env.ORDER_FILE_PATH));
}
const originalCreate = storage.createOrder;
storage.createOrder = async (...args) => {
  const mode = fault;
  fault = undefined;
  if (mode === 'before-write') await pause(mode);
  const result = await originalCreate(...args);
  if (mode === 'after-write') await pause(mode);
  return result;
};
function pause(point) {
  return new Promise(resolve => {
    release = resolve;
    process.send({ point });
  });
}
process.on('message', message => {
  if (message.release) release?.();
  else { fault = message.fault; process.send({ armed: fault }); }
});
const server = app.listen(0, '127.0.0.1', () => process.send({ port: server.address().port }));
process.on('SIGTERM', () => {
  server.closeAllConnections();
  server.close(() => process.exit(0));
});
