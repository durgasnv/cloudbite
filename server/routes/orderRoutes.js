const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

const ordersFilePath = path.join(__dirname, '../data/orders.json');

// Helper to read JSON files safely with auto-recovery
async function readJsonFile(filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    const trimmed = (data || '').trim();
    if (!trimmed) return [];
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    console.error(`Error reading/parsing file from ${filePath}:`, err.message);
    return [];
  }
}

// Helper to write JSON files safely
async function writeJsonFile(filePath, data) {
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error(`Error writing file to ${filePath}:`, err);
    throw new Error('Failed to save data');
  }
}

// GET /api/orders - Get all orders (FR-08)
router.get('/', async (req, res, next) => {
  try {
    const orders = await readJsonFile(ordersFilePath);
    const sortedOrders = [...orders].reverse();
    res.status(200).json({
      success: true,
      count: sortedOrders.length,
      data: sortedOrders
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/orders/:id - Get a specific order by ID (FR-08)
router.get('/:id', async (req, res, next) => {
  try {
    const orderId = req.params.id;
    const orders = await readJsonFile(ordersFilePath);
    const order = orders.find(o => String(o.id) === String(orderId));

    if (!order) {
      return res.status(404).json({
        success: false,
        message: `Order with ID ${orderId} not found.`
      });
    }

    res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/orders - Simulated Order Placement (FR-07)
router.post('/', async (req, res, next) => {
  try {
    const { customerName, customerPhone, customerAddress, items, totalAmount } = req.body;

    // Validate customer name
    if (!customerName || typeof customerName !== 'string' || customerName.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Validation failed: customerName is required and must be a valid string.'
      });
    }

    // Validate cart items
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed: items must be a non-empty array of food items.'
      });
    }

    for (const item of items) {
      if (!item.name || !item.price || !item.quantity || item.quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed: each item must contain name, price, and a positive quantity.'
        });
      }
    }

    const numericTotal = Number(totalAmount);
    if (isNaN(numericTotal) || numericTotal <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed: totalAmount must be a positive number.'
      });
    }

    const orders = await readJsonFile(ordersFilePath);

    // FR-07: Generate sequential Order ID: ORD1025, ORD1026...
    let maxNum = 1024;
    for (const o of orders) {
      const match = String(o.id).match(/^ORD(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
    const orderId = `ORD${maxNum + 1}`;

    const newOrder = {
      id: orderId,
      customerName: customerName.trim(),
      customerPhone: customerPhone ? String(customerPhone).trim() : 'Not provided',
      customerAddress: customerAddress ? String(customerAddress).trim() : 'Standard Delivery',
      items: items.map(item => ({
        id: item.id || null,
        name: item.name,
        price: Number(item.price),
        quantity: Number(item.quantity),
        itemTotal: Number(item.price) * Number(item.quantity)
      })),
      totalAmount: numericTotal,
      status: 'CONFIRMED', // FR-07 & FR-08: 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'
      createdAt: new Date().toISOString(),
      formattedDate: new Date().toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short'
      })
    };

    orders.push(newOrder);
    await writeJsonFile(ordersFilePath, orders);

    res.status(201).json({
      success: true,
      message: 'Order placed successfully!',
      data: newOrder
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/orders/:id/status - Update simulated order status (FR-08)
router.patch('/:id/status', async (req, res, next) => {
  try {
    const orderId = req.params.id;
    const { status } = req.body;
    const validStatuses = ['CONFIRMED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED', 'Placed', 'Delivered'];

    if (!status || !validStatuses.map(s => s.toUpperCase()).includes(status.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be one of: CONFIRMED, PREPARING, READY, COMPLETED, CANCELLED.'
      });
    }

    const orders = await readJsonFile(ordersFilePath);
    const orderIndex = orders.findIndex(o => String(o.id) === String(orderId));

    if (orderIndex === -1) {
      return res.status(404).json({
        success: false,
        message: `Order with ID ${orderId} not found.`
      });
    }

    orders[orderIndex].status = status.toUpperCase();
    await writeJsonFile(ordersFilePath, orders);

    res.status(200).json({
      success: true,
      message: `Order status updated to ${status.toUpperCase()}`,
      data: orders[orderIndex]
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
