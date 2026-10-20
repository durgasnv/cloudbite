const fs = require('node:fs/promises');
const path = require('node:path');
const { isRecord } = require('./validation');

// A broken catalog must not masquerade as an empty successful response.
async function readCatalog(filePath) {
  try {
    const records = JSON.parse(await fs.readFile(filePath, 'utf8'));
    const menu = path.basename(filePath) === 'menu.json';
    const ids = new Set();
    if (!Array.isArray(records) || records.some(record => {
      if (!isRecord(record) || !Number.isSafeInteger(record.id) || record.id < 1 ||
          ids.has(record.id) || typeof record.name !== 'string' || !record.name.trim()) return true;
      ids.add(record.id);
      if (menu) {
        return !Number.isSafeInteger(record.restaurantId) || record.restaurantId < 1 ||
          typeof record.price !== 'number' || !Number.isFinite(record.price) || record.price < 0 ||
          (record.category !== undefined && typeof record.category !== 'string') ||
          (record.description !== undefined && typeof record.description !== 'string') ||
          (record.isAvailable !== undefined && typeof record.isAvailable !== 'boolean');
      }
      return typeof record.cuisine !== 'string' || typeof record.location !== 'string';
    })) throw new Error('Invalid catalog structure');
    return records;
  } catch (cause) {
    const error = new Error('Catalog unavailable', { cause });
    error.status = 503;
    throw error;
  }
}
module.exports = { readCatalog };
