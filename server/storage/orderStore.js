const path = require('path');
const { Pool } = require('pg');
const { createLocalOrderStore } = require('./localOrderStore');

const ordersFilePath = process.env.ORDER_FILE_PATH || path.join(__dirname, '../data/orders.json');
const localStore = createLocalOrderStore(ordersFilePath);
const databaseConfigured = Boolean(process.env.DATABASE_URL || process.env.PGHOST);
const pool = databaseConfigured ? new Pool(process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL }
  : {}) : null;
let schemaReady;

async function ensureSchema() {
  if (!pool) return;
  if (!schemaReady) {
    schemaReady = pool.query(`
      CREATE TABLE IF NOT EXISTS cloudbite_orders (
        id TEXT PRIMARY KEY,
        data JSONB NOT NULL
      )
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

async function createOrder(order) {
  if (pool) {
    await ensureSchema();
    await pool.query('INSERT INTO cloudbite_orders (id, data) VALUES ($1, $2)', [order.id, order]);
    return;
  }
  await localStore.createOrder(order);
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

module.exports = { listOrders, findOrder, createOrder, updateOrderStatus, checkStorage };
