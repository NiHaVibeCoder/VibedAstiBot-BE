// server.js - Backend Server für Trading-Simulation
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { coinbaseService } from './services/coinbaseService.js';
import { TradingEngine } from './services/tradingEngine.js';

// Load environment variables
const API_KEY = process.env.COINBASE_API_KEY || '';
const API_SECRET = process.env.COINBASE_API_SECRET || '';
if (API_KEY && API_SECRET) {
  coinbaseService.setCredentials(API_KEY, API_SECRET);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Middleware
app.use(express.json());
app.use(express.static(join(__dirname, 'dist')));

// Initialize Trading Engine
const tradingEngine = new TradingEngine();

/**
 * Broadcast state update to all connected WebSocket clients
 */
const broadcastUpdate = (state) => {
  const update = {
    type: 'state',
    data: {
      isRunning: state.isRunning,
      account: state.account,
      currentPrice: state.currentPrice,
      trades: state.trades,
      chartData: state.chartData,
      profit: state.account
        ? (state.account.quote + state.account.base * state.currentPrice - state.settings?.initialBalance)
        : 0,
      backtestProgress: state.backtestData && state.backtestData.length > 0
        ? (state.backtestIndex / state.backtestData.length) * 100
        : 0,
    }
  };

  wss.clients.forEach(client => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(JSON.stringify(update));
    }
  });
};

// Set update callback for trading engine
tradingEngine.setUpdateCallback(broadcastUpdate);

// WebSocket Connection Handler
wss.on('connection', (ws) => {
  // Limit connections to prevent resource exhaustion on Raspberry Pi
  if (wss.clients.size > 10) {
    console.warn('⚠️  Max WebSocket connections reached, rejecting new connection');
    ws.close(1008, 'Server at capacity');
    return;
  }

  // Send current state immediately
  broadcastUpdate(tradingEngine.getState());

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());

      switch (data.type) {
        case 'start':
          tradingEngine.start(data.settings, data.backtestData, data.isLive);
          break;
        case 'stop':
          tradingEngine.stop();
          break;
        case 'updateSettings':
          tradingEngine.updateSettings(data.settings);
          break;
        case 'getState':
          broadcastUpdate(tradingEngine.getState());
          break;
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  });

  ws.on('close', () => {
    // Connection closed
  });
});

// REST API Routes

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  const state = tradingEngine.getState();
  res.json({ status: 'ok', isRunning: state.isRunning });
});

/**
 * Get current trading state
 */
app.get('/api/state', (req, res) => {
  const state = tradingEngine.getState();
  res.json({
    isRunning: state.isRunning,
    account: state.account,
    currentPrice: state.currentPrice,
    trades: state.trades,
    chartData: state.chartData,
  });
});

/**
 * Start trading
 */
app.post('/api/start', (req, res) => {
  const { settings, backtestData, isLive } = req.body;
  tradingEngine.start(settings, backtestData, isLive);
  res.json({ success: true });
});

/**
 * Stop trading
 */
app.post('/api/stop', (req, res) => {
  tradingEngine.stop();
  res.json({ success: true });
});

/**
 * Get available trading products
 */
app.get('/api/products', async (req, res) => {
  try {
    const products = await coinbaseService.getProducts();
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

/**
 * Get historical candle data
 */
app.get('/api/candles/:pair', async (req, res) => {
  try {
    const { pair } = req.params;
    const { start, end, granularity } = req.query;
    const candles = await coinbaseService.getHistoricalData(
      pair,
      start,
      end,
      parseInt(granularity) || 3600
    );
    res.json(candles);
  } catch (error) {
    console.error('Error fetching candles:', error);
    res.status(500).json({ error: 'Failed to fetch candle data' });
  }
});

/**
 * Serve frontend for all other routes
 */
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

// Start Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Astibot server running on port ${PORT}`);
  console.log(`📡 Local: http://localhost:${PORT}`);
  console.log(`🌐 Network: http://0.0.0.0:${PORT}`);

  // Signal PM2 that the app is ready
  if (process.send) {
    process.send('ready');
  }
});

// Graceful Shutdown Handler
const gracefulShutdown = (signal) => {
  console.log(`\n${signal} received. Closing server gracefully...`);

  // Stop trading if running
  tradingEngine.stop();

  // Close WebSocket connections
  wss.clients.forEach(client => {
    client.close(1000, 'Server shutting down');
  });

  // Close HTTP server
  server.close(() => {
    console.log('✅ Server closed successfully');
    process.exit(0);
  });

  // Force close after 10 seconds
  setTimeout(() => {
    console.error('⚠️  Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});
