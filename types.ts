export interface BacktestData {
  data: ChartDataPoint[];
  start: string;
  end: string;
}

export interface TelegramSettings {
  botToken: string;
  chatId: string;
  isTested: boolean; // Whether the connection has been successfully tested
  enablePeriodicMessages: boolean;
  periodicMessageInterval: '30m' | '1h' | '12h' | '24h' | '48h';
  enableErrorNotifications: boolean;
  enableBuyNotifications: boolean;
  enableSellNotifications: boolean;
}

export interface TradingSettings {
  tradingPair: string;
  dipsSensitivity: number;
  riskLevel: number;
  stopLossPercentage: number;
  sellTriggerPercentage: number;
  initialBalance: number;
  tradeAmountPercentage: number;
  maxConcurrentPositions: number;
  simulationDuration: number; // in minutes, 0 for unlimited
  backtestSpeed: number; // in milliseconds per tick
  telegramSettings: TelegramSettings;
}

export interface ChartDataPoint {
  time: number;
  price: number;
  fastMA?: number;
  slowMA?: number;
  riskLine?: number;
}

export enum TradeType {
  BUY = 'BUY',
  SELL = 'SELL',
}

export interface Trade {
  id: number;
  type: TradeType;
  price: number;
  time: number;
  amount: number; // Amount of base currency (e.g., BTC)
  reason: string;
}

export interface Account {
  base: number; // e.g., BTC
  quote: number; // e.g., USD
}

export interface InfoPanelProps {
  account: Account;
  currentPrice: number;
  profit: number;
  tradingPair: string;
  backtestData: BacktestData | null;
  tradingMode: 'simulation' | 'live';
}

export interface SimulationSummary {
  totalProfit: number;
  buyAndHoldProfit: number;
  lowestAccountValue: number;
  highestAccountValue: number;
  buyCount: number;
  sellCount: number;
  trades: Trade[];
}

export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting';