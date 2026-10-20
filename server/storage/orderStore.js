const path = require('path');
const { Pool } = require('pg');
const { createLocalOrderStore } = require('./localOrderStore');
const { conflict, verifyReplay } = require('./orderErrors');

const ordersFilePath = process.env.ORDER_FILE_PATH || path.join(__dirname, '../data/orders.json');
const localStore = createLocalOrderStore(ordersFilePath);
const databaseConfigured = Boolean(process.env.DATABASE_URL || process.env.PGHOST);
if (process.env.NODE_ENV === 'production' && !databaseConfigured) {
  throw new Error('Production database configuration is required (DATABASE_URL or PGHOST).');
}
const timeout = Number(process.env.DB_TIMEOUT_MS || 3000);
if (!Number.isInteger(timeout) || timeout < 100 || timeout > 30000) {
  throw new Error('DB_TIMEOUT_MS must be an integer between 100 and 30000.');
}
const pool = databaseConfigured ? new Pool({
  ...(process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL } : {}),
  connectionTimeoutMillis: timeout, query_timeout: timeout, statement_timeout: timeout
}) : null;
// Idle connections can fail outside a request; pg otherwise emits an unhandled error.
if (pool) pool.on('error', () => console.error('Idle order database connection failed'));
let schemaReady;

async function ensureSchema() {
  if (!pool) return;
  if (!schemaReady) {
    schemaReady = pool.query(`
      CREATE TABLE IF NOT EXISTS cloudbite_orders (
        id TEXT PRIMARY KEY,
        data JSONB NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS cloudbite_order_checkout_key
        ON cloudbite_orders ((data->>'idempotencyHash'))
        WHERE data->>'idempotencyHash' IS NOT NULL
    `).catch(error => {
      schemaReady = null;
      throw error;
    });
  }
  await schemaReady;
}

async function listOrders() {
  if (!pool) return localStore.listOrders();
  await ensureSchema();
  const result = await pool.query('SELECT data FROM cloudbite_orders ORDER BY data->>\'createdAt\'');
  return result.rows.map(row => row.data);
}

async function findOrder(id) {
  if (!pool) return localStore.findOrder(id);
  await ensureSchema();
  const result = await pool.query('SELECT data FROM cloudbite_orders WHERE id = $1', [id]);
  return result.rows[0]?.data;
}

async function findOrderByKey(hash) {
  if (!pool) return localStore.findOrderByKey(hash);
  await ensureSchema();
  const result = await pool.query("SELECT data FROM cloudbite_orders WHERE data->>'idempotencyHash' = $1", [hash]);
  return result.rows[0]?.data;
}

async function createOrder(order) {
  if (pool) {
    await ensureSchema();
    const inserted = await pool.query('INSERT INTO cloudbite_orders (id, data) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING data', [order.id, order]);
    if (inserted.rows[0]) return inserted.rows[0].data;
    if (order.idempotencyHash) {
      const existing = await pool.query("SELECT data FROM cloudbite_orders WHERE data->>'idempotencyHash' = $1", [order.idempotencyHash]);
      if (existing.rows[0]) return verifyReplay(existing.rows[0].data, order);
    }
    throw conflict('Duplicate order ID');
  }
  return localStore.createOrder(order);
}

async function updateOrderStatus(id, status) {
  if (pool) {
    await ensureSchema();
    const result = await pool.query(
      "UPDATE cloudbite_orders SET data = jsonb_set(data, '{status}', to_jsonb($2::text)) WHERE id = $1 RETURNING data",
      [id, status]
    );
    return result.rows[0]?.data;
  }
  return localStore.updateOrderStatus(id, status);
}

async function checkStorage() {
  if (!pool) return localStore.checkStorage();
  await ensureSchema();
  await pool.query('SELECT 1');
}

// Keep storage outages bounded and do not expose database internals to clients.
const safe = operation => async (...args) => {
  try { return await operation(...args); }
  catch (cause) {
    if (cause.status === 409 || cause.status === 503) throw cause;
    const error = new Error('Order storage unavailable', { cause });
    error.status = 503;
    throw error;
  }
};
module.exports = Object.fromEntries(Object.entries({ listOrders, findOrder, findOrderByKey, createOrder, updateOrderStatus, checkStorage })
  .map(([name, operation]) => [name, safe(operation)]));
