// server.js - Backend Server für Trading-Simulation
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
import { coinbaseService } from './services/coinbaseService.js';

// Load env vars if not already loaded (e.g. via dotenv in dev, or system envs)
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

// Trading Engine State
let tradingState = {
  isRunning: false,
  settings: null,
  account: null,
  trades: [],
  openPositions: [],
  currentPrice: 0,
  chartData: [],
  backtestData: null,
  backtestIndex: 0,
  tradeIdCounter: 0,
  startPrice: 0,
  lowestAccountValue: 0,
  highestAccountValue: 0,
  isLive: false,
  isProcessingTick: false,
};

// Trading Logic (aus simulationService.ts)
const calculateSMA = (data, period) => {
  if (data.length < period) return undefined;
  const sum = data.slice(-period).reduce((acc, val) => acc + val, 0);
  return sum / period;
};

// Trading Tick Logic
const runTradingTick = async () => {
  if (!tradingState.isRunning || !tradingState.settings) return;

  const { settings, backtestData, backtestIndex } = tradingState;

  let newPrice, newTime;

  if (backtestData && backtestData.length > 0) {
    if (backtestIndex >= backtestData.length) {
      // Backtest beendet
      stopTrading();
      return;
    }
    const point = backtestData[backtestIndex];
    newPrice = point.price;
    newTime = point.time;
    tradingState.backtestIndex = backtestIndex + 1;
  } else {
    // Live Simulation / Trading
    if (tradingState.isProcessingTick) return;
    tradingState.isProcessingTick = true;

    try {
      newPrice = await coinbaseService.getPrice(settings.tradingPair);
      newTime = Date.now();
    } catch (error) {
      console.error('Error fetching price:', error);
      tradingState.isProcessingTick = false;
      return; // Skip this tick
    }
  }

  // Update chart data
  const priceHistory = [...tradingState.chartData.map(p => p.price), newPrice];
  const fastPeriod = Math.round(5 + (100 - settings.dipsSensitivity) * 0.45);
  const slowPeriod = Math.round(15 + (100 - settings.dipsSensitivity) * 0.85);
  const fastMA = calculateSMA(priceHistory, fastPeriod);
  const slowMA = calculateSMA(priceHistory, slowPeriod);

  const riskPeriod = Math.floor(slowPeriod * 1.5);
  const marketAverage = calculateSMA(priceHistory, riskPeriod);
  const riskLine = marketAverage ? marketAverage * (0.9 + (settings.riskLevel - 50) / 500) : undefined;

  const prevFastMA = tradingState.chartData.length > 1
    ? tradingState.chartData[tradingState.chartData.length - 2].fastMA
    : undefined;
  const prevSlowMA = tradingState.chartData.length > 1
    ? tradingState.chartData[tradingState.chartData.length - 2].slowMA
    : undefined;

  const newPoint = { time: newTime, price: newPrice, fastMA, slowMA, riskLine };
  // Keep only last 100 points to optimize memory on Raspberry Pi
  tradingState.chartData = [...tradingState.chartData, newPoint].slice(-100);
  tradingState.currentPrice = newPrice;

  if (!fastMA || !slowMA || !prevFastMA || !prevSlowMA) {
    broadcastUpdate();
    return;
  }

  // SELL LOGIC
  let positionToSell = null;
  let reasonForSale = '';
  let positionIndex = -1;

  for (let i = 0; i < tradingState.openPositions.length; i++) {
    const pos = tradingState.openPositions[i];
    const stopLossPrice = pos.price * (1 - settings.stopLossPercentage / 100);
    const sellTriggerPrice = pos.price * (1 + settings.sellTriggerPercentage / 100);

    if (newPrice <= stopLossPrice) {
      positionToSell = pos;
      reasonForSale = 'Stop Loss';
      positionIndex = i;
      break;
    }
    if (settings.sellTriggerPercentage > 0 && newPrice >= sellTriggerPrice) {
      positionToSell = pos;
      reasonForSale = 'Sell Trigger';
      positionIndex = i;
      break;
    }
  }

  if (!positionToSell && fastMA < slowMA && prevFastMA >= prevSlowMA && tradingState.openPositions.length > 0) {
    positionToSell = tradingState.openPositions[0];
    reasonForSale = 'MACD Crossover';
    positionIndex = 0;
  }

  if (positionToSell) {
    const sellAmount = positionToSell.amount;
    tradingState.account = {
      base: tradingState.account.base - sellAmount,
      quote: tradingState.account.quote + sellAmount * newPrice
    };

    const sellTrade = {
      id: tradingState.tradeIdCounter++,
      type: 'SELL',
      price: newPrice,
      time: newTime,
      amount: sellAmount,
      reason: reasonForSale
    };

    tradingState.trades.push(sellTrade);
    tradingState.openPositions.splice(positionIndex, 1);

    // Telegram Notification
    if (settings.telegramSettings?.enableSellNotifications && settings.telegramSettings?.isTested) {
      sendTelegramNotification(settings, `💸 <b>Verkauf ausgeführt</b>\n\nPreis: ${newPrice.toFixed(2)}\nMenge: ${sellAmount.toFixed(6)}\nGrund: ${reasonForSale}`);
    }

    // Real Trading Execution
    if (tradingState.isLive) {
      coinbaseService.placeOrder(settings.tradingPair, 'sell', sellAmount.toString())
        .catch(err => console.error('Real Sell Order Failed:', err));
    }
  }
  // BUY LOGIC
  else if (fastMA > slowMA && prevFastMA <= prevSlowMA && tradingState.openPositions.length < settings.maxConcurrentPositions) {
    if (riskLine && newPrice < riskLine) {
      const tradeAmountQuote = tradingState.account.quote * (settings.tradeAmountPercentage / 100);
      if (tradingState.account.quote >= tradeAmountQuote && tradeAmountQuote > 1) {
        const buyAmount = tradeAmountQuote / newPrice;
        tradingState.account = {
          base: tradingState.account.base + buyAmount,
          quote: tradingState.account.quote - tradeAmountQuote
        };

        const buyTrade = {
          id: tradingState.tradeIdCounter++,
          type: 'BUY',
          price: newPrice,
          time: newTime,
          amount: buyAmount,
          reason: 'MACD Crossover'
        };

        tradingState.openPositions.push(buyTrade);
        tradingState.trades.push(buyTrade);

        // Telegram Notification
        if (settings.telegramSettings?.enableBuyNotifications && settings.telegramSettings?.isTested) {
          sendTelegramNotification(settings, `💰 <b>Kauf ausgeführt</b>\n\nPreis: ${newPrice.toFixed(2)}\nMenge: ${buyAmount.toFixed(6)}\nGrund: MACD Crossover`);
        }

        // Real Trading Execution
        if (tradingState.isLive) {
          coinbaseService.placeOrder(settings.tradingPair, 'buy', buyAmount.toString()) // Note: 'buy' usually requires size in base currency or funds in quote currency depending on order type. Market buy often uses 'funds' (quote) or 'size' (base). coinbaseService uses 'size' (base).
            .catch(err => console.error('Real Buy Order Failed:', err));
        }
      }
    }
  }

  // Update account value tracking
  const accountValue = tradingState.account.quote + tradingState.account.base * newPrice;
  if (accountValue < tradingState.lowestAccountValue) {
    tradingState.lowestAccountValue = accountValue;
  }
  if (accountValue > tradingState.highestAccountValue) {
    tradingState.highestAccountValue = accountValue;
  }

  broadcastUpdate();

  if (!backtestData) {
    tradingState.isProcessingTick = false;
  }
};

// Telegram Notification
const sendTelegramNotification = async (settings, message) => {
  const { botToken, chatId } = settings.telegramSettings;
  if (!botToken || !chatId) return;

  const chatIds = chatId.split(',').map(id => id.trim()).filter(id => id);

  for (const id of chatIds) {
    try {
      const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
      const params = new URLSearchParams({
        chat_id: id,
        text: message,
        parse_mode: 'HTML',
      });

      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
    } catch (error) {
      console.error(`Error sending Telegram message to ${id}:`, error);
    }
  }
};

let tradingInterval = null;
let periodicTelegramInterval = null;

const startTrading = async (settings, backtestData = null, isLive = false) => {
  if (tradingState.isRunning) return;

  tradingState.settings = settings;
  tradingState.backtestData = backtestData;
  tradingState.backtestIndex = 0;
  tradingState.account = { base: 0, quote: settings.initialBalance };
  tradingState.trades = [];
  tradingState.openPositions = [];
  tradingState.tradeIdCounter = 0;
  tradingState.lowestAccountValue = settings.initialBalance;
  tradingState.highestAccountValue = settings.initialBalance;

  if (backtestData && backtestData.length > 0) {
    tradingState.currentPrice = backtestData[0].price;
    tradingState.startPrice = backtestData[0].price;
    tradingState.chartData = [];
  } else {
    // Live Mode - Fetch initial price
    try {
      const price = await coinbaseService.getPrice(settings.tradingPair);
      tradingState.currentPrice = price;
      tradingState.startPrice = price;
      tradingState.chartData = [{ time: Date.now(), price: price }];
    } catch (e) {
      console.error("Failed to start: Could not fetch initial price", e);
      return;
    }
  }

  tradingState.isRunning = true;
  tradingState.isLive = isLive;

  // Use granularity from settings for live simulation, backtestSpeed for backtesting
  const tickInterval = backtestData
    ? (settings.backtestSpeed || 50)
    : (settings.granularity ? settings.granularity * 1000 : 60000); // Default to 1 minute if not set

  tradingInterval = setInterval(runTradingTick, tickInterval);

  // Periodic Telegram Messages
  if (settings.telegramSettings?.enablePeriodicMessages && settings.telegramSettings?.isTested) {
    const intervalMap = { '30m': 30 * 60 * 1000, '1h': 60 * 60 * 1000, '12h': 12 * 60 * 60 * 1000, '24h': 24 * 60 * 60 * 1000, '48h': 48 * 60 * 60 * 1000 };
    const interval = intervalMap[settings.telegramSettings.periodicMessageInterval] || 60 * 60 * 1000;

    periodicTelegramInterval = setInterval(() => {
      const accountValue = tradingState.account.quote + tradingState.account.base * tradingState.currentPrice;
      const profit = accountValue - settings.initialBalance;
      const message = `<b>📊 Status-Update</b>\n\nAktueller Preis: ${tradingState.currentPrice.toFixed(2)}\nKontowert: ${accountValue.toFixed(2)}\nGewinn: ${profit >= 0 ? '+' : ''}${profit.toFixed(2)}\nOffene Positionen: ${tradingState.openPositions.length}`;
      sendTelegramNotification(settings, message);
    }, interval);
  }

  broadcastUpdate();
};

const stopTrading = () => {
  if (!tradingState.isRunning) return;

  tradingState.isRunning = false;
  if (tradingInterval) {
    clearInterval(tradingInterval);
    tradingInterval = null;
  }
  if (periodicTelegramInterval) {
    clearInterval(periodicTelegramInterval);
    periodicTelegramInterval = null;
  }

  broadcastUpdate();
};

const broadcastUpdate = () => {
  const update = {
    type: 'state',
    data: {
      isRunning: tradingState.isRunning,
      account: tradingState.account,
      currentPrice: tradingState.currentPrice,
      trades: tradingState.trades,
      chartData: tradingState.chartData,
      profit: tradingState.account ?
        (tradingState.account.quote + tradingState.account.base * tradingState.currentPrice - tradingState.settings?.initialBalance) : 0,
      backtestProgress: tradingState.backtestData && tradingState.backtestData.length > 0 ?
        (tradingState.backtestIndex / tradingState.backtestData.length) * 100 : 0,
    }
  };

  wss.clients.forEach(client => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(JSON.stringify(update));
    }
  });
};

// WebSocket Connection
wss.on('connection', (ws) => {
  // Limit connections to prevent resource exhaustion on Raspberry Pi
  if (wss.clients.size > 10) {
    console.warn('⚠️  Max WebSocket connections reached, rejecting new connection');
    ws.close(1008, 'Server at capacity');
    return;
  }

  console.log('✅ New WebSocket connection established');

  // Send current state immediately
  broadcastUpdate();

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());

      switch (data.type) {
        case 'start':
          startTrading(data.settings, data.backtestData, data.isLive);
          break;
        case 'stop':
          stopTrading();
          break;
        case 'updateSettings':
          if (tradingState.isRunning) {
            tradingState.settings = { ...tradingState.settings, ...data.settings };
          }
          break;
        case 'getState':
          broadcastUpdate();
          break;
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  });

  ws.on('close', () => {
  });
});

// REST API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', isRunning: tradingState.isRunning });
});

app.get('/api/state', (req, res) => {
  res.json({
    isRunning: tradingState.isRunning,
    account: tradingState.account,
    currentPrice: tradingState.currentPrice,
    trades: tradingState.trades,
    chartData: tradingState.chartData,
  });
});

app.post('/api/start', (req, res) => {
  const { settings, backtestData, isLive } = req.body;
  startTrading(settings, backtestData, isLive);
  res.json({ success: true });
});

app.get('/api/products', async (req, res) => {
  const products = await coinbaseService.getProducts();
  res.json(products);
});

app.get('/api/candles/:pair', async (req, res) => {
  const { pair } = req.params;
  const { start, end, granularity } = req.query;
  const candles = await coinbaseService.getHistoricalData(pair, start, end, parseInt(granularity) || 3600);
  res.json(candles);
});

app.post('/api/stop', (req, res) => {
  stopTrading();
  res.json({ success: true });
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

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

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
  console.log(`\n${signal} received. Closing server gracefully...`);

  // Stop trading if running
  if (tradingState.isRunning) {
    stopTrading();
  }

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

