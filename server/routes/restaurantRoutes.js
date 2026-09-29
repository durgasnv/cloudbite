const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

const restaurantsFilePath = path.join(__dirname, '../data/restaurants.json');
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

// GET /api/restaurants - Get all restaurants (FR-01)
router.get('/', async (req, res, next) => {
  try {
    const restaurants = await readJsonFile(restaurantsFilePath);
    res.status(200).json({
      success: true,
      count: restaurants.length,
      data: restaurants
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/restaurants/:id - Get a specific restaurant (FR-02)
router.get('/:id', async (req, res, next) => {
  try {
    const restaurantId = parseInt(req.params.id, 10);
    if (isNaN(restaurantId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid restaurant ID. Must be a valid number.'
      });
    }

    const restaurants = await readJsonFile(restaurantsFilePath);
    const restaurant = restaurants.find(r => r.id === restaurantId);

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: `Restaurant with ID ${restaurantId} not found.`
      });
    }

    res.status(200).json({
      success: true,
      data: restaurant
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/restaurants/:id/menu - Get menu items for a specific restaurant (FR-03)
router.get('/:id/menu', async (req, res, next) => {
  try {
    const restaurantId = parseInt(req.params.id, 10);
    if (isNaN(restaurantId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid restaurant ID. Must be a valid number.'
      });
    }

    const restaurants = await readJsonFile(restaurantsFilePath);
    const restaurantExists = restaurants.some(r => r.id === restaurantId);

    if (!restaurantExists) {
      return res.status(404).json({
        success: false,
        message: `Restaurant with ID ${restaurantId} not found.`
      });
    }

    const menuItems = await readJsonFile(menuFilePath);
    const restaurantMenu = menuItems.filter(item => item.restaurantId === restaurantId);

    res.status(200).json({
      success: true,
      restaurantId: restaurantId,
      count: restaurantMenu.length,
      data: restaurantMenu
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
