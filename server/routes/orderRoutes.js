const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const orderStore = require('../storage/orderStore');

const menuFilePath = path.join(__dirname, '../data/menu.json');

const ADMIN_TOKEN = ['admin123', 'admin-secret-key'].includes(process.env.ADMIN_TOKEN)
  ? undefined : process.env.ADMIN_TOKEN;

function tokenMatches(provided, expected) {
  if (typeof provided !== 'string' || typeof expected !== 'string' || !expected) return false;
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function publicOrder(order) {
  const { accessTokenHash, ...details } = order;
  return details;
}

function customerOrder(order) {
  const { customerPhone, customerAddress, ...details } = publicOrder(order);
  return details;
}

// Helper to verify admin credentials
function isAdmin(req) {
  const tokenHeader = req.headers['x-admin-token'];
  const authHeader = req.headers['authorization'];
  if (tokenMatches(tokenHeader, ADMIN_TOKEN)) return true;
  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer' && tokenMatches(parts[1], ADMIN_TOKEN)) return true;
  }
  return false;
}

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

// GET /api/orders - Get orders with access control (FR-08)
// Only authenticated staff can list orders.
router.get('/', async (req, res, next) => {
  try {
    const orders = await orderStore.listOrders();
    const sortedOrders = [...orders].reverse();

    if (isAdmin(req)) {
      return res.status(200).json({
        success: true,
        count: sortedOrders.length,
        isAdmin: true,
        data: sortedOrders.map(publicOrder)
      });
    }

    return res.status(200).json({
      success: true,
      count: 0,
      isAdmin: false,
      data: [],
      message: 'Staff authorization is required to list orders.'
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/orders/:id - Get a specific order by ID (FR-08)
router.get('/:id', async (req, res, next) => {
  try {
    const orderId = String(req.params.id).trim().toUpperCase();
    const order = await orderStore.findOrder(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: `Order with ID ${orderId} not found.`
      });
    }

    const staff = isAdmin(req);
    if (!staff) {
      const token = req.headers['x-order-token'];
      const tokenHash = typeof token === 'string' ? crypto.createHash('sha256').update(token).digest('hex') : '';
      if (!tokenMatches(tokenHash, order.accessTokenHash)) {
        return res.status(403).json({ success: false, message: 'Order access token required.' });
      }
    }

    res.status(200).json({
      success: true,
      isAdmin: staff,
      data: staff ? publicOrder(order) : customerOrder(order)
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/orders - Simulated Order Placement with Authoritative Pricing (FR-07)
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

    // Authoritative pricing check against menu.json
    const menuItems = await readJsonFile(menuFilePath);
    let authoritativeSubtotal = 0;
    const verifiedItems = [];

    for (const item of items) {
      const quantity = parseInt(item.quantity, 10);
      if (isNaN(quantity) || quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed: each item must contain a positive integer quantity.'
        });
      }
      if (quantity > 50) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed: maximum allowed quantity per item is 50.'
        });
      }

      // Look up authoritative menu item
      const itemId = Number(item.id);
      const menuItem = menuItems.find(m => m.id === itemId);

      if (!menuItem) {
        return res.status(400).json({
          success: false,
          message: `Validation failed: item with ID "${item.id}" was not found in the menu.`,
          unavailableItemId: item.id
        });
      }

      if (menuItem.isAvailable === false) {
        return res.status(400).json({
          success: false,
          message: `Validation failed: item "${menuItem.name}" is currently unavailable.`,
          unavailableItemId: item.id
        });
      }

      const authoritativePrice = Number(menuItem.price);

      // Check if client provided price mismatch
      if (item.price !== undefined && Math.abs(Number(item.price) - authoritativePrice) > 0.01) {
        return res.status(400).json({
          success: false,
          priceChanged: true,
          message: `Price mismatch for "${menuItem.name}". Current price is ₹${authoritativePrice}. Please refresh your cart.`,
          expectedPrice: authoritativePrice,
          receivedPrice: item.price
        });
      }

      const itemTotal = authoritativePrice * quantity;
      authoritativeSubtotal += itemTotal;

      verifiedItems.push({
        id: menuItem.id,
        name: menuItem.name,
        price: authoritativePrice,
        quantity: quantity,
        itemTotal: itemTotal
      });
    }

    // Authoritative total calculation
    const deliveryFee = (authoritativeSubtotal >= 500 || authoritativeSubtotal === 0) ? 0 : 40;
    const platformFee = authoritativeSubtotal > 0 ? 10 : 0;
    const authoritativeTotal = authoritativeSubtotal + deliveryFee + platformFee;

    if (totalAmount !== undefined) {
      const numericClientTotal = Number(totalAmount);
      if (isNaN(numericClientTotal) || Math.abs(numericClientTotal - authoritativeTotal) > 0.01) {
        return res.status(400).json({
          success: false,
          priceChanged: true,
          message: `Order total mismatch. Authoritative total is ₹${authoritativeTotal}. Please review your cart.`,
          authoritativeTotal: authoritativeTotal
        });
      }
    }

    const orderId = `ORD${crypto.randomBytes(12).toString('hex').toUpperCase()}`;

    const orderAccessToken = crypto.randomBytes(32).toString('hex');
    const newOrder = {
      id: orderId,
      accessTokenHash: crypto.createHash('sha256').update(orderAccessToken).digest('hex'),
      customerName: customerName.trim(),
      customerPhone: customerPhone ? String(customerPhone).trim() : 'Not provided',
      customerAddress: customerAddress ? String(customerAddress).trim() : 'Standard Delivery',
      items: verifiedItems,
      subtotal: authoritativeSubtotal,
      deliveryFee,
      platformFee,
      totalAmount: authoritativeTotal,
      status: 'CONFIRMED',
      createdAt: new Date().toISOString(),
      formattedDate: new Date().toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short'
      })
    };

    await orderStore.createOrder(newOrder);

    res.status(201).json({
      success: true,
      message: 'Order placed successfully!',
      data: customerOrder(newOrder),
      orderAccessToken
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/orders/:id/status - Update order status (Admin Access Required) (FR-08)
router.patch('/:id/status', async (req, res, next) => {
  try {
    // Enforce administrative access control
    if (!isAdmin(req)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Admin authorization required to update order status.'
      });
    }

    const orderId = String(req.params.id).trim().toUpperCase();
    const { status } = req.body;
    const validStatuses = ['CONFIRMED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'];

    if (!status || !validStatuses.includes(status.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}.`
      });
    }

    const updatedOrder = await orderStore.updateOrderStatus(orderId, status.toUpperCase());
    if (!updatedOrder) {
      return res.status(404).json({
        success: false,
        message: `Order with ID ${orderId} not found.`
      });
    }

    res.status(200).json({
      success: true,
      message: `Order status updated to ${status.toUpperCase()}`,
      data: publicOrder(updatedOrder)
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
