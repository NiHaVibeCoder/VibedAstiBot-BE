import type { TradingSettings, ChartDataPoint, Trade, Account } from '../types';
import { TradeType } from '../types';

const calculateSMA = (data: number[], period: number, minPoints: number = period): number | undefined => {
  if (data.length < minPoints) return undefined;
  const slice = data.slice(-period);
  const sum = slice.reduce((acc, val) => acc + val, 0);
  return sum / slice.length;
};

export const runHeadlessSimulation = (
  settings: TradingSettings,
  backtestData: ChartDataPoint[]
): number => {
  if (!backtestData || backtestData.length === 0) {
    return 0;
  }

  let account: Account = { base: 0, quote: settings.initialBalance };
  let openPositions: Trade[] = [];
  let tradeIdCounter = 0;

  const priceHistory: number[] = [];
  const fastMAHistory: (number | undefined)[] = [];
  const slowMAHistory: (number | undefined)[] = [];

  const fastPeriod = Math.round(5 + (100 - settings.dipsSensitivity) * 0.45);
  const slowPeriod = Math.round(15 + (100 - settings.dipsSensitivity) * 0.85);
  const riskPeriod = 50; // Fixed trend period

  for (const point of backtestData) {
    const newPrice = point.price;
    priceHistory.push(newPrice);
    if (priceHistory.length > riskPeriod + 500) {
      priceHistory.shift();
    }

    const fastMA = calculateSMA(priceHistory, fastPeriod);
    const slowMA = calculateSMA(priceHistory, slowPeriod);

    const prevFastMA = fastMAHistory.length > 0 ? fastMAHistory[fastMAHistory.length - 1] : undefined;
    const prevSlowMA = slowMAHistory.length > 0 ? slowMAHistory[slowMAHistory.length - 1] : undefined;

    fastMAHistory.push(fastMA);
    slowMAHistory.push(slowMA);
    if (fastMAHistory.length > 1) {
      fastMAHistory.shift();
      slowMAHistory.shift();
    }

    const marketAverage = calculateSMA(priceHistory, riskPeriod, 10); // Allow calculation with just 10 points
    // Relaxed risk formula:
    // Risk 10: 0.8 * MA (Very safe, buys only deep dips)
    // Risk 50: 1.0 * MA (Neutral, buys at average)
    // Risk 90: 1.2 * MA (Aggressive, buys even above average)
    const riskLine = marketAverage ? marketAverage * (1 + (settings.riskLevel - 50) / 200) : undefined;

    if (!fastMA || !slowMA || !prevFastMA || !prevSlowMA) {
      continue;
    }

    let positionToSell: Trade | null = null;
    let reasonForSale = '';
    let positionIndex = -1;

    // --- SELL LOGIC ---
    for (let i = 0; i < openPositions.length; i++) {
      const pos = openPositions[i];
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

    if (!positionToSell && fastMA < slowMA && prevFastMA >= prevSlowMA && openPositions.length > 0) {
      positionToSell = openPositions[0]; // FIFO
      reasonForSale = 'MACD Crossover';
      positionIndex = 0;
    }

    if (positionToSell) {
      const sellAmount = positionToSell.amount;
      account = { base: account.base - sellAmount, quote: account.quote + sellAmount * newPrice };
      openPositions.splice(positionIndex, 1);
    }
    // --- BUY LOGIC ---
    else if (fastMA > slowMA && prevFastMA <= prevSlowMA && openPositions.length < settings.maxConcurrentPositions) {
      if (riskLine && newPrice < riskLine) {
        const tradeAmountQuote = account.quote * (settings.tradeAmountPercentage / 100);
        if (account.quote >= tradeAmountQuote && tradeAmountQuote > 1) {
          const buyAmount = tradeAmountQuote / newPrice;
          account = { base: account.base + buyAmount, quote: account.quote - tradeAmountQuote };
          const buyTrade: Trade = { id: tradeIdCounter++, type: TradeType.BUY, price: newPrice, time: point.time, amount: buyAmount, reason: 'MACD Crossover' };
          openPositions.push(buyTrade);
        }
      }
    }
  }

  const finalValue = account.quote + account.base * (backtestData[backtestData.length - 1]?.price || 0);
  const profit = finalValue - settings.initialBalance;
  return profit;
};