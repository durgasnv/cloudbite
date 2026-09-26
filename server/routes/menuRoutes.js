const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

const menuFilePath = path.join(__dirname, '../data/menu.json');

// Helper to read JSON files safely
async function readJsonFile(filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    const trimmed = (data || '').trim();
    if (!trimmed) return [];
    return JSON.parse(trimmed);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    console.error(`Error reading file from ${filePath}:`, err.message);
    throw new Error('Failed to read data file');
  }
}

// GET /api/menu - Get all menu items (FR-03)
router.get('/', async (req, res, next) => {
  try {
    const { category, restaurantId, search } = req.query;
    let menuItems = await readJsonFile(menuFilePath);

    if (category) {
      menuItems = menuItems.filter(
        item => item.category.toLowerCase() === category.toLowerCase()
      );
    }

    if (restaurantId) {
      const parsedId = parseInt(restaurantId, 10);
      if (!isNaN(parsedId)) {
        menuItems = menuItems.filter(item => item.restaurantId === parsedId);
      }
    }

    if (search) {
      const query = search.toLowerCase();
      menuItems = menuItems.filter(
        item =>
          item.name.toLowerCase().includes(query) ||
          item.description.toLowerCase().includes(query)
      );
    }

    res.status(200).json({
      success: true,
      count: menuItems.length,
      data: menuItems
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/menu/:id - Get a specific menu item
router.get('/:id', async (req, res, next) => {
  try {
    const itemId = parseInt(req.params.id, 10);
    if (isNaN(itemId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid menu item ID. Must be a valid number.'
      });
    }

    const menuItems = await readJsonFile(menuFilePath);
    const item = menuItems.find(i => i.id === itemId);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: `Menu item with ID ${itemId} not found.`
      });
    }

    res.status(200).json({
      success: true,
      data: item
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
