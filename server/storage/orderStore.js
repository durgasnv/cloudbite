const fs = require('fs').promises;
const path = require('path');
const { Pool } = require('pg');

const ordersFilePath = path.join(__dirname, '../data/orders.json');
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

async function readLocalOrders() {
  try {
    const contents = await fs.readFile(ordersFilePath, 'utf8');
    const parsed = JSON.parse(contents || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function listOrders() {
  if (!pool) return readLocalOrders();
  await ensureSchema();
  const result = await pool.query('SELECT data FROM cloudbite_orders ORDER BY data->>\'createdAt\'');
  return result.rows.map(row => row.data);
}

async function findOrder(id) {
  if (!pool) return (await readLocalOrders()).find(order => order.id === id);
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
  const orders = await readLocalOrders();
  orders.push(order);
  await fs.writeFile(ordersFilePath, JSON.stringify(orders, null, 2), 'utf8');
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
  const orders = await readLocalOrders();
  const order = orders.find(item => item.id === id);
  if (!order) return undefined;
  order.status = status;
  await fs.writeFile(ordersFilePath, JSON.stringify(orders, null, 2), 'utf8');
  return order;
}

async function checkStorage() {
  if (!pool) return;
  await ensureSchema();
  await pool.query('SELECT 1');
}

module.exports = { listOrders, findOrder, createOrder, updateOrderStatus, checkStorage };
