import type { TradingSettings } from './types';

export const TRADING_PAIRS: string[] = [
  'BTC-USD',
  'ETH-USD',
  'SOL-USD',
  'BCH-EUR',
  'LTC-USD',
  'ADA-USD',
];

export const DEFAULT_SETTINGS: TradingSettings = {
  tradingPair: 'BCH-EUR',
  dipsSensitivity: 50, // 0-100 scale
  riskLevel: 50, // 0-100 scale
  stopLossPercentage: 5, // 5%
  sellTriggerPercentage: 0, // 0 disables this, bot will use MACD to sell
  initialBalance: 1000, // in quote currency (e.g., EUR)
  tradeAmountPercentage: 20, // in percent
  maxConcurrentPositions: 5,
  simulationDuration: 10, // in minutes, 0 for unlimited
  backtestSpeed: 50, // ms per tick for backtesting
  telegramSettings: {
    botToken: '',
    chatId: '',
    isTested: false,
    enablePeriodicMessages: false,
    periodicMessageInterval: '1h',
    enableErrorNotifications: false,
    enableBuyNotifications: false,
    enableSellNotifications: false,
  },
};

export const CHART_DATA_LIMIT = 200; // Max number of data points on the chart
export const SIMULATION_TICK_MS = 1000; // 1 second per tick