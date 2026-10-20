const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { conflict, verifyReplay } = require('./orderErrors');

// One store per file in a single server process. Use PostgreSQL across processes.
function createLocalOrderStore(filePath) {
  let pendingWrite = Promise.resolve();

  function unavailable(cause) {
    const error = new Error('Order storage unavailable', { cause });
    error.status = 503;
    return error;
  }

  async function listOrders() {
    try {
      const orders = JSON.parse(await fs.readFile(filePath, 'utf8'));
      const ids = new Set();
      if (!Array.isArray(orders) || orders.some(order => {
        if (!order || typeof order !== 'object' || Array.isArray(order) ||
            typeof order.id !== 'string' || !order.id || ids.has(order.id)) return true;
        ids.add(order.id);
        return false;
      })) throw new Error('Invalid order records');
      return orders;
    } catch (error) {
      // A new development installation can start with no orders file.
      if (error.code === 'ENOENT') return [];
      throw unavailable(error);
    }
  }

  async function temporaryFile(contents, commit) {
    const tempPath = path.join(path.dirname(filePath), `.cloudbite-orders-${crypto.randomUUID()}.tmp`);
    let handle;
    try {
      handle = await fs.open(tempPath, 'wx', 0o600);
      await handle.writeFile(contents, 'utf8');
      await handle.sync();
      await handle.close();
      handle = undefined;
      if (commit) await fs.rename(tempPath, filePath);
    } finally {
      if (handle) await handle.close();
      await fs.unlink(tempPath).catch(error => {
        if (error.code !== 'ENOENT') throw error;
      });
    }
  }

  function mutate(change) {
    const result = pendingWrite.then(async () => {
      try {
        const orders = await listOrders();
        const result = change(orders);
        if (result !== undefined) {
          await temporaryFile(JSON.stringify(orders, null, 2), true);
        }
        return result;
      } catch (error) {
        if (error.status === 409) throw error;
        throw unavailable(error);
      }
    });
    // A failed operation must not prevent later operations after storage recovers.
    pendingWrite = result.catch(() => {});
    return result;
  }

  return {
    listOrders,
    async findOrderByKey(hash) { return (await listOrders()).find(order => order.idempotencyHash === hash); },
    async findOrder(id) { return (await listOrders()).find(order => order.id === id); },
    createOrder(order) {
      return mutate(orders => {
        const replay = order.idempotencyHash && orders.find(existing => existing.idempotencyHash === order.idempotencyHash);
        if (replay) return verifyReplay(replay, order);
        if (orders.some(existing => existing.id === order.id)) throw new Error('Duplicate order ID');
        orders.push(order);
        return order;
      });
    },
    updateOrderStatus(id, status, expectedVersion) {
      return mutate(orders => {
        const order = orders.find(item => item.id === id);
        if (order) {
          if (expectedVersion !== undefined && (order.version || 0) !== expectedVersion) {
            throw conflict('Order changed. Refresh before updating its status.');
          }
          order.status = status;
          order.version = (order.version || 0) + 1;
        }
        return order;
      });
    },
    async checkStorage() {
      try {
        await listOrders();
        // Check write access without replacing or modifying order history.
        await temporaryFile('[]', false);
      } catch (error) {
        throw unavailable(error);
      }
    }
  };
}

module.exports = { createLocalOrderStore };
