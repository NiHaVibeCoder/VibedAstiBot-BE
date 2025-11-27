// tradingEngine.js - Trading Logic Module
import { coinbaseService } from './coinbaseService.js';

/**
 * Calculate Simple Moving Average
 * @param {number[]} data - Array of price data
 * @param {number} period - Period for SMA calculation
 * @returns {number|undefined} SMA value or undefined if insufficient data
 */
export const calculateSMA = (data, period, minPoints = period) => {
    if (data.length < minPoints) return undefined;
    const slice = data.slice(-period);
    const sum = slice.reduce((acc, val) => acc + val, 0);
    return sum / slice.length;
};

/**
 * Trading Engine Class
 */
export class TradingEngine {
    constructor() {
        this.state = {
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

        this.tradingInterval = null;
        this.periodicTelegramInterval = null;
        this.updateCallback = null;
    }

    /**
     * Set callback for state updates
     * @param {Function} callback - Function to call when state updates
     */
    setUpdateCallback(callback) {
        this.updateCallback = callback;
    }

    /**
     * Get current trading state
     * @returns {Object} Current state
     */
    getState() {
        return this.state;
    }

    /**
     * Execute a single trading tick
     */
    async executeTick() {
        if (!this.state.isRunning || !this.state.settings) return;

        const { settings, backtestData, backtestIndex } = this.state;
        let newPrice, newTime;

        // Get price data (backtest or live)
        if (backtestData && backtestData.length > 0) {
            if (backtestIndex >= backtestData.length) {
                this.stop();
                return;
            }
            const point = backtestData[backtestIndex];
            newPrice = point.price;
            newTime = point.time;
            this.state.backtestIndex = backtestIndex + 1;
        } else {
            // Live mode
            if (this.state.isProcessingTick) return;
            this.state.isProcessingTick = true;

            try {
                newPrice = await coinbaseService.getPrice(settings.tradingPair);
                newTime = Date.now();
            } catch (error) {
                console.error('Error fetching price:', error);
                this.state.isProcessingTick = false;
                return;
            }
        }

        // Calculate indicators
        const priceHistory = [...this.state.chartData.map(p => p.price), newPrice];
        const fastPeriod = Math.round(5 + (100 - settings.dipsSensitivity) * 0.45);
        const slowPeriod = Math.round(15 + (100 - settings.dipsSensitivity) * 0.85);
        const fastMA = calculateSMA(priceHistory, fastPeriod);
        const slowMA = calculateSMA(priceHistory, slowPeriod);

        const riskPeriod = 50; // Fixed trend period
        const marketAverage = calculateSMA(priceHistory, riskPeriod, 10); // Allow calculation with just 10 points
        // Relaxed risk formula:
        // Risk 10: 0.8 * MA (Very safe, buys only deep dips)
        // Risk 50: 1.0 * MA (Neutral, buys at average)
        // Risk 90: 1.2 * MA (Aggressive, buys even above average)
        const riskLine = marketAverage ? marketAverage * (1 + (settings.riskLevel - 50) / 200) : undefined;

        const prevFastMA = this.state.chartData.length > 1
            ? this.state.chartData[this.state.chartData.length - 2].fastMA
            : undefined;
        const prevSlowMA = this.state.chartData.length > 1
            ? this.state.chartData[this.state.chartData.length - 2].slowMA
            : undefined;

        // Update chart data (keep last 500 points to ensure enough history for risk calculation)
        const newPoint = { time: newTime, price: newPrice, fastMA, slowMA, riskLine };
        this.state.chartData = [...this.state.chartData, newPoint].slice(-500);
        this.state.currentPrice = newPrice;

        if (!fastMA || !slowMA || !prevFastMA || !prevSlowMA) {
            this._notifyUpdate();
            return;
        }

        // Execute trading logic
        await this._executeSellLogic(newPrice, newTime, fastMA, slowMA, prevFastMA, prevSlowMA);
        await this._executeBuyLogic(newPrice, newTime, fastMA, slowMA, prevFastMA, prevSlowMA, riskLine);

        // Update account value tracking
        const accountValue = this.state.account.quote + this.state.account.base * newPrice;
        if (accountValue < this.state.lowestAccountValue) {
            this.state.lowestAccountValue = accountValue;
        }
        if (accountValue > this.state.highestAccountValue) {
            this.state.highestAccountValue = accountValue;
        }

        this._notifyUpdate();

        if (!backtestData) {
            this.state.isProcessingTick = false;
        }
    }

    /**
     * Execute sell logic
     * @private
     */
    async _executeSellLogic(newPrice, newTime, fastMA, slowMA, prevFastMA, prevSlowMA) {
        const { settings } = this.state;
        let positionToSell = null;
        let reasonForSale = '';
        let positionIndex = -1;

        // Check stop loss and sell triggers
        for (let i = 0; i < this.state.openPositions.length; i++) {
            const pos = this.state.openPositions[i];
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

        // Check MACD crossover
        if (!positionToSell && fastMA < slowMA && prevFastMA >= prevSlowMA && this.state.openPositions.length > 0) {
            positionToSell = this.state.openPositions[0];
            reasonForSale = 'MACD Crossover';
            positionIndex = 0;
        }

        // Execute sell
        if (positionToSell) {
            const sellAmount = positionToSell.amount;
            this.state.account = {
                base: this.state.account.base - sellAmount,
                quote: this.state.account.quote + sellAmount * newPrice
            };

            const sellTrade = {
                id: this.state.tradeIdCounter++,
                type: 'SELL',
                price: newPrice,
                time: newTime,
                amount: sellAmount,
                reason: reasonForSale
            };

            this.state.trades.push(sellTrade);
            this.state.openPositions.splice(positionIndex, 1);

            // Telegram notification
            if (settings.telegramSettings?.enableSellNotifications && settings.telegramSettings?.isTested) {
                await this._sendTelegramNotification(
                    settings,
                    `💸 <b>Verkauf ausgeführt</b>\n\nPreis: ${newPrice.toFixed(2)}\nMenge: ${sellAmount.toFixed(6)}\nGrund: ${reasonForSale}`
                );
            }

            // Real trading execution
            if (this.state.isLive) {
                coinbaseService.placeOrder(settings.tradingPair, 'sell', sellAmount.toString())
                    .catch(err => console.error('Real Sell Order Failed:', err));
            }
        }
    }

    /**
     * Execute buy logic
     * @private
     */
    async _executeBuyLogic(newPrice, newTime, fastMA, slowMA, prevFastMA, prevSlowMA, riskLine) {
        const { settings } = this.state;

        // Check MACD crossover and risk conditions
        if (fastMA > slowMA && prevFastMA <= prevSlowMA &&
            this.state.openPositions.length < settings.maxConcurrentPositions) {
            if (riskLine && newPrice < riskLine) {
                const tradeAmountQuote = this.state.account.quote * (settings.tradeAmountPercentage / 100);

                if (this.state.account.quote >= tradeAmountQuote && tradeAmountQuote > 1) {
                    const buyAmount = tradeAmountQuote / newPrice;
                    this.state.account = {
                        base: this.state.account.base + buyAmount,
                        quote: this.state.account.quote - tradeAmountQuote
                    };

                    const buyTrade = {
                        id: this.state.tradeIdCounter++,
                        type: 'BUY',
                        price: newPrice,
                        time: newTime,
                        amount: buyAmount,
                        reason: 'MACD Crossover'
                    };

                    this.state.openPositions.push(buyTrade);
                    this.state.trades.push(buyTrade);

                    // Telegram notification
                    if (settings.telegramSettings?.enableBuyNotifications && settings.telegramSettings?.isTested) {
                        await this._sendTelegramNotification(
                            settings,
                            `💰 <b>Kauf ausgeführt</b>\n\nPreis: ${newPrice.toFixed(2)}\nMenge: ${buyAmount.toFixed(6)}\nGrund: MACD Crossover`
                        );
                    }

                    // Real trading execution
                    if (this.state.isLive) {
                        coinbaseService.placeOrder(settings.tradingPair, 'buy', buyAmount.toString())
                            .catch(err => console.error('Real Buy Order Failed:', err));
                    }
                }
            }
        }
    }

    /**
     * Send Telegram notification
     * @private
     */
    async _sendTelegramNotification(settings, message) {
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
    }

    /**
     * Notify update callback
     * @private
     */
    _notifyUpdate() {
        if (this.updateCallback) {
            this.updateCallback(this.state);
        }
    }

    /**
     * Start trading
     * @param {Object} settings - Trading settings
     * @param {Array} backtestData - Optional backtest data
     * @param {boolean} isLive - Whether to execute real trades
     */
    async start(settings, backtestData = null, isLive = false) {
        if (this.state.isRunning) return;

        this.state.settings = settings;
        this.state.backtestData = backtestData;
        this.state.backtestIndex = 0;
        this.state.account = { base: 0, quote: settings.initialBalance };
        this.state.trades = [];
        this.state.openPositions = [];
        this.state.tradeIdCounter = 0;
        this.state.lowestAccountValue = settings.initialBalance;
        this.state.highestAccountValue = settings.initialBalance;

        // Initialize price
        if (backtestData && backtestData.length > 0) {
            this.state.currentPrice = backtestData[0].price;
            this.state.startPrice = backtestData[0].price;
            this.state.chartData = [];
        } else {
            try {
                const price = await coinbaseService.getPrice(settings.tradingPair);
                this.state.currentPrice = price;
                this.state.startPrice = price;
                this.state.chartData = [{ time: Date.now(), price: price }];
            } catch (e) {
                console.error("Failed to start: Could not fetch initial price", e);
                return;
            }
        }

        this.state.isRunning = true;
        this.state.isLive = isLive;

        // Start trading interval
        const tickInterval = backtestData
            ? (settings.backtestSpeed || 50)
            : (settings.granularity ? settings.granularity * 1000 : 60000);

        this.tradingInterval = setInterval(() => this.executeTick(), tickInterval);

        // Setup periodic Telegram messages
        if (settings.telegramSettings?.enablePeriodicMessages && settings.telegramSettings?.isTested) {
            const intervalMap = {
                '30m': 30 * 60 * 1000,
                '1h': 60 * 60 * 1000,
                '12h': 12 * 60 * 60 * 1000,
                '24h': 24 * 60 * 60 * 1000,
                '48h': 48 * 60 * 60 * 1000
            };
            const interval = intervalMap[settings.telegramSettings.periodicMessageInterval] || 60 * 60 * 1000;

            this.periodicTelegramInterval = setInterval(() => {
                const accountValue = this.state.account.quote + this.state.account.base * this.state.currentPrice;
                const profit = accountValue - settings.initialBalance;
                const message = `<b>📊 Status-Update</b>\n\nAktueller Preis: ${this.state.currentPrice.toFixed(2)}\nKontowert: ${accountValue.toFixed(2)}\nGewinn: ${profit >= 0 ? '+' : ''}${profit.toFixed(2)}\nOffene Positionen: ${this.state.openPositions.length}`;
                this._sendTelegramNotification(settings, message);
            }, interval);
        }

        this._notifyUpdate();
    }

    /**
     * Stop trading
     */
    stop() {
        if (!this.state.isRunning) return;

        this.state.isRunning = false;

        if (this.tradingInterval) {
            clearInterval(this.tradingInterval);
            this.tradingInterval = null;
        }

        if (this.periodicTelegramInterval) {
            clearInterval(this.periodicTelegramInterval);
            this.periodicTelegramInterval = null;
        }

        this._notifyUpdate();
    }

    /**
     * Update settings while running
     * @param {Object} newSettings - New settings to apply
     */
    updateSettings(newSettings) {
        if (this.state.isRunning) {
            this.state.settings = { ...this.state.settings, ...newSettings };
        }
    }
}
