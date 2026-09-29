const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables if .env exists
dotenv.config();

const restaurantRoutes = require('./routes/restaurantRoutes');
const menuRoutes = require('./routes/menuRoutes');
const orderRoutes = require('./routes/orderRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Security & Parsing Middlewares
app.use(cors({
  origin: '*', // Allow requests from any frontend port/origin
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files from client directory
const clientPath = path.join(__dirname, '../client');
app.use(express.static(clientPath));

// API Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    app: 'CloudBite Food Delivery API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Mount API Routes
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/orders', orderRoutes);

// Fallback for API 404 routes
app.all('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `API endpoint ${req.method} ${req.originalUrl} not found.`
  });
});

// Centralized Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

// Start Server only when run directly (not when imported by tests)
if (require.main === module) {
  const server = app.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`🚀 CloudBite Server is running!`);
    console.log(`📍 URL: http://localhost:${PORT}`);
    console.log(`📡 API Endpoints:`);
    console.log(`   - GET   http://localhost:${PORT}/api/restaurants`);
    console.log(`   - GET   http://localhost:${PORT}/api/menu`);
    console.log(`   - GET   http://localhost:${PORT}/api/orders`);
    console.log(`   - POST  http://localhost:${PORT}/api/orders`);
    console.log(`   - PATCH http://localhost:${PORT}/api/orders/:id/status`);
    console.log(`🌐 Frontend UI: http://localhost:${PORT}/index.html`);
    console.log(`=========================================`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n⚠️  Port ${PORT} is already in use!`);
      console.error(`👉 Please close the existing process on port ${PORT} or start with another port:\n   $env:PORT=5001; npm start\n`);
      process.exit(1);
    } else {
      console.error('Server error:', err);
    }
  });
}

module.exports = app;
