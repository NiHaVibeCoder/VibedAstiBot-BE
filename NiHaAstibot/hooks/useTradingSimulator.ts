import { useState, useEffect, useRef, useCallback } from 'react';
import type { TradingSettings, ChartDataPoint, Trade, Account, SimulationSummary, ConnectionStatus } from '../types';
import { TradeType } from '../types';
import { CHART_DATA_LIMIT, SIMULATION_TICK_MS } from '../constants';
import { sendTelegramMessage } from '../services/telegramService'; // Import Telegram service

// Helper to calculate Simple Moving Average (SMA)
const calculateSMA = (data: number[], period: number): number | undefined => {
  if (data.length < period) return undefined;
  const sum = data.slice(-period).reduce((acc, val) => acc + val, 0);
  return sum / period;
};

// Main hook for the trading simulation
export const useTradingSimulator = (initialSettings: TradingSettings, backtestData: ChartDataPoint[] | null) => {
  const [settings, setSettings] = useState<TradingSettings>(initialSettings);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [account, setAccount] = useState<Account>({
    base: 0,
    quote: settings.initialBalance,
  });
  const [currentPrice, setCurrentPrice] = useState<number>(1000);
  const [profit, setProfit] = useState<number>(0);
  const [simulationSummary, setSimulationSummary] = useState<SimulationSummary | null>(null);
  const [backtestProgress, setBacktestProgress] = useState<number>(0);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connected');

  const simulationIntervalRef = useRef<number | null>(null);
  const stopTimerRef = useRef<number | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const periodicTelegramTimerRef = useRef<number | null>(null); // New ref for periodic Telegram messages
  const tradeIdCounterRef = useRef<number>(0);
  const openPositionsRef = useRef<Trade[]>([]);
  const backtestIndexRef = useRef<number>(0);
  const lowestAccountValueRef = useRef<number>(settings.initialBalance);
  const highestAccountValueRef = useRef<number>(settings.initialBalance);
  const startPriceRef = useRef<number>(0);
  const isRunningRef = useRef(isRunning);
  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  // Ref to hold latest state for summary generation to avoid stale closures
  const summaryStateRef = useRef({ account, currentPrice, trades, chartData, settings });
  useEffect(() => {
    summaryStateRef.current = { account, currentPrice, trades, chartData, settings };
  }, [account, currentPrice, trades, chartData, settings]);

  // Function to send Telegram messages
  const sendTelegramMessageWrapper = useCallback((message: string) => {
    const { botToken, chatId } = settings.telegramSettings;
    if (botToken && chatId) {
      sendTelegramMessage(botToken, chatId, message).then(results => {
        const failed = results.filter(r => !r.success);
        if (failed.length > 0) {
          console.warn(`Telegram: Some messages failed to send. Failed chat IDs: ${failed.map(r => r.chatId).join(', ')}`);
        }
      }).catch(error => {
        console.error('Telegram: Error sending messages:', error);
      });
    } else {
      console.warn('Telegram bot not configured. Skipping message.');
    }
  }, [settings.telegramSettings]);

  // Reset simulation state
  const resetSimulation = useCallback(() => {
    if (backtestData && backtestData.length > 0) {
      backtestIndexRef.current = 0;
      const startPrice = backtestData[0].price;
      setCurrentPrice(startPrice);
      startPriceRef.current = startPrice;
      setChartData([]);
      setBacktestProgress(0);
    } else {
      const startingPrice = Math.random() * 800 + 400;
      setCurrentPrice(startingPrice);
      startPriceRef.current = startingPrice;
      setChartData([{ time: Date.now(), price: startingPrice }]);
    }
    setTrades([]);
    setAccount({ base: 0, quote: settings.initialBalance });
    setProfit(0);
    setSimulationSummary(null);
    openPositionsRef.current = [];
    tradeIdCounterRef.current = 0;
    lowestAccountValueRef.current = settings.initialBalance;
    highestAccountValueRef.current = settings.initialBalance;
  }, [settings.initialBalance, backtestData]);

  const disconnect = useCallback(() => {
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
    }
    if (!backtestData) {
      setConnectionStatus('disconnected');
      if (settings.telegramSettings.enableErrorNotifications) {
        sendTelegramMessageWrapper(`<b>🚨 Verbindung unterbrochen!</b> Astibot hat die Verbindung zu den Marktdaten verloren. Es wird versucht, die Verbindung wiederherzustellen.`);
      }
    }
  }, [backtestData, settings.telegramSettings.enableErrorNotifications, sendTelegramMessageWrapper]);

  // The core simulation tick logic
  const runSimulationTick = useCallback(() => {
    // This is the main fix: Check for the end of the backtest *before* updating state.
    // Calling setIsRunning inside the setChartData updater can cause race conditions.
    if (backtestData && backtestIndexRef.current >= backtestData.length) {
      setIsRunning(false);
      return; // Stop further execution of this tick
    }

    // Simulate a random connection drop for non-backtest mode
    if (!backtestData && Math.random() < 0.001) { // 0.1% chance of drop per tick
        console.warn('Simulating connection drop.');
        disconnect();
        return;
    }

    const fastPeriod = Math.round(5 + (100 - settings.dipsSensitivity) * 0.45);
    const slowPeriod = Math.round(15 + (100 - settings.dipsSensitivity) * 0.85);

    setChartData(prevData => {
      let newPrice: number;
      let newTime: number;

      if (backtestData) {
        // We know we are not at the end due to the check at the top of the function.
        const currentIndex = backtestIndexRef.current;
        const point = backtestData[currentIndex];
        newPrice = point.price;
        newTime = point.time;
        setCurrentPrice(newPrice);
        backtestIndexRef.current = currentIndex + 1;
        setBacktestProgress(((currentIndex + 1) / backtestData.length) * 100);
      } else {
        if (prevData.length === 0) return prevData;
        const lastPoint = prevData[prevData.length - 1];
        const volatility = 0.008;
        const drift = 0.00005;
        const change = (Math.random() - 0.5 + drift) * volatility * lastPoint.price;
        newPrice = Math.max(lastPoint.price + change, 1);
        newTime = Date.now();
        setCurrentPrice(newPrice);
      }

      const priceHistory = [...prevData.map(p => p.price), newPrice];
      const fastMA = calculateSMA(priceHistory, fastPeriod);
      const slowMA = calculateSMA(priceHistory, slowPeriod);

      const riskPeriod = Math.floor(slowPeriod * 1.5);
      const marketAverage = calculateSMA(priceHistory, riskPeriod);
      const riskLine = marketAverage ? marketAverage * (0.9 + (settings.riskLevel - 50) / 500) : undefined;

      const newPoint: ChartDataPoint = { time: newTime, price: newPrice, fastMA, slowMA, riskLine };
      const updatedData = [...prevData, newPoint].slice(-CHART_DATA_LIMIT);

      const prevFastMA = prevData.length > 1 ? updatedData[updatedData.length - 2].fastMA : undefined;
      const prevSlowMA = prevData.length > 1 ? updatedData[updatedData.length - 2].slowMA : undefined;

      if (!fastMA || !slowMA || !prevFastMA || !prevSlowMA) {
        return updatedData;
      }

      setAccount(currentAccount => {
        let newBase = currentAccount.base;
        let newQuote = currentAccount.quote;
        let tradeExecuted: Trade | null = null;
        
        let openPositions = [...openPositionsRef.current];
        let positionToSell: Trade | null = null;
        let reasonForSale = '';
        let positionIndex = -1;

        // --- SELL LOGIC ---
        // First, check for stop-loss or sell-trigger on any position
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

        // If no individual trigger, check for general MACD sell signal (FIFO)
        if (!positionToSell && fastMA < slowMA && prevFastMA >= prevSlowMA && openPositions.length > 0) {
            positionToSell = openPositions[0]; // Oldest is at the start
            reasonForSale = 'MACD Crossover';
            positionIndex = 0;
        }

        if (positionToSell) {
            const sellAmount = positionToSell.amount;
            newQuote += sellAmount * newPrice;
            newBase -= sellAmount;
            tradeExecuted = { id: tradeIdCounterRef.current++, type: TradeType.SELL, price: newPrice, time: newTime, amount: sellAmount, reason: reasonForSale };
            openPositions.splice(positionIndex, 1); // Remove sold position
            
            // Send Telegram Sell Notification
            if (settings.telegramSettings.enableSellNotifications) {
              const formattedProfit = ((newPrice - positionToSell.price) / positionToSell.price * 100).toFixed(2);
              sendTelegramMessageWrapper(
                `<b>📉 VERKAUF</b> ${settings.tradingPair}\n` +
                `Zeit: ${new Date(newTime).toLocaleString()}\n` +
                `Preis: ${newPrice.toFixed(2)} ${settings.tradingPair.split('-')[1]}\n` +
                `Menge: ${sellAmount.toFixed(6)} ${settings.tradingPair.split('-')[0]}\n` +
                `Grund: ${reasonForSale}\n` +
                `Gewinn/Verlust: ${formattedProfit}%`
              );
            }
        }
        // --- BUY LOGIC ---
        // Can only buy if we didn't sell this tick and have capacity
        else if (fastMA > slowMA && prevFastMA <= prevSlowMA && openPositions.length < settings.maxConcurrentPositions) {
            if (riskLine && newPrice < riskLine) {
                const tradeAmountQuote = currentAccount.quote * (settings.tradeAmountPercentage / 100);
                // Ensure we don't trade with dust
                if (currentAccount.quote >= tradeAmountQuote && tradeAmountQuote > 1) { 
                    const buyAmount = tradeAmountQuote / newPrice;
                    newBase += buyAmount;
                    newQuote -= tradeAmountQuote;
                    tradeExecuted = { id: tradeIdCounterRef.current++, type: TradeType.BUY, price: newPrice, time: newTime, amount: buyAmount, reason: 'MACD Crossover' };
                    openPositions.push(tradeExecuted);

                    // Send Telegram Buy Notification
                    if (settings.telegramSettings.enableBuyNotifications) {
                      sendTelegramMessageWrapper(
                        `<b>📈 KAUF</b> ${settings.tradingPair}\n` +
                        `Zeit: ${new Date(newTime).toLocaleString()}\n` +
                        `Preis: ${newPrice.toFixed(2)} ${settings.tradingPair.split('-')[1]}\n` +
                        `Menge: ${buyAmount.toFixed(6)} ${settings.tradingPair.split('-')[0]}\n` +
                        `Grund: MACD Crossover`
                      );
                    }
                }
            }
        }

        const newTotalValue = newQuote + newBase * newPrice;
        if (newTotalValue < lowestAccountValueRef.current) lowestAccountValueRef.current = newTotalValue;
        if (newTotalValue > highestAccountValueRef.current) highestAccountValueRef.current = newTotalValue;

        if (tradeExecuted) {
          openPositionsRef.current = openPositions;
          setTrades(prevTrades => [...prevTrades, tradeExecuted!]);
          return { base: newBase, quote: newQuote };
        }

        return currentAccount;
      });

      return updatedData;
    });
  }, [settings, backtestData, disconnect, sendTelegramMessageWrapper]);

  const connect = useCallback(() => {
    if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
    }

    if (backtestData) {
        if (simulationIntervalRef.current) clearInterval(simulationIntervalRef.current);
        simulationIntervalRef.current = window.setInterval(runSimulationTick, settings.backtestSpeed);
        setConnectionStatus('connected');
        return;
    }

    setConnectionStatus('connecting');
    console.log('Attempting to connect...');

    setTimeout(() => {
        if (!isRunningRef.current) {
            setConnectionStatus('connected'); // Reset to idle state
            return;
        }
        
        console.log('Connection established.');
        if (simulationIntervalRef.current) clearInterval(simulationIntervalRef.current);
        simulationIntervalRef.current = window.setInterval(runSimulationTick, SIMULATION_TICK_MS);
        setConnectionStatus('connected');

        // Send Telegram connection success notification if enabled and was previously disconnected
        if (connectionStatus === 'disconnected' && settings.telegramSettings.enableErrorNotifications) {
          sendTelegramMessageWrapper(`<b>✅ Verbindung wiederhergestellt!</b> Astibot ist wieder online und empfängt Marktdaten.`);
        }

    }, 1500);

  }, [backtestData, runSimulationTick, settings.backtestSpeed, settings.telegramSettings.enableErrorNotifications, sendTelegramMessageWrapper, connectionStatus]);

  // Effect for handling reconnection
  useEffect(() => {
    if (connectionStatus === 'disconnected' && isRunning) {
      reconnectTimerRef.current = window.setTimeout(() => {
        console.log('Connection lost. Attempting to reconnect...');
        connect();
      }, 1500);
    }
    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, [connectionStatus, isRunning, connect]);

  // Effect for handling Telegram periodic messages
  useEffect(() => {
    if (isRunning && !backtestData && settings.telegramSettings.enablePeriodicMessages) {
      const intervalMs = {
        '30m': 30 * 60 * 1000,
        '1h': 60 * 60 * 1000,
        '12h': 12 * 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '48h': 48 * 60 * 60 * 1000,
      }[settings.telegramSettings.periodicMessageInterval];

      if (periodicTelegramTimerRef.current) {
        clearInterval(periodicTelegramTimerRef.current);
      }

      periodicTelegramTimerRef.current = window.setInterval(() => {
        sendTelegramMessageWrapper(
          `<b>🟢 Astibot Status-Update (${settings.tradingPair})</b>\n` +
          `Der Bot ist aktiv und die Verbindung zur Börse ist stabil.\n` +
          `Aktueller Profit: ${profit.toFixed(2)} ${settings.tradingPair.split('-')[1]}`
        );
      }, intervalMs);

      return () => {
        if (periodicTelegramTimerRef.current) {
          clearInterval(periodicTelegramTimerRef.current);
          periodicTelegramTimerRef.current = null;
        }
      };
    } else {
      if (periodicTelegramTimerRef.current) {
        clearInterval(periodicTelegramTimerRef.current);
        periodicTelegramTimerRef.current = null;
      }
    }
  }, [isRunning, backtestData, settings.telegramSettings, sendTelegramMessageWrapper, profit, settings.tradingPair]);


  useEffect(() => {
    if (isRunning) {
      resetSimulation();
      connect();

      if (!backtestData && settings.simulationDuration > 0) {
        stopTimerRef.current = window.setTimeout(() => {
          setIsRunning(false);
          // Send Telegram message when simulation stops automatically
          if (settings.telegramSettings.enableErrorNotifications) {
            sendTelegramMessageWrapper(`<b>🛑 Astibot hat die Simulation für ${settings.tradingPair} beendet</b>, da die eingestellte Dauer von ${settings.simulationDuration} Minuten erreicht wurde.`);
          }
        }, settings.simulationDuration * 60 * 1000);
      }
    } else {
      // User-initiated stop or simulation ended
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
        simulationIntervalRef.current = null;
      }
      if (stopTimerRef.current) {
        clearTimeout(stopTimerRef.current);
        stopTimerRef.current = null;
      }
      if (periodicTelegramTimerRef.current) { // Clear periodic timer on stop
        clearInterval(periodicTelegramTimerRef.current);
        periodicTelegramTimerRef.current = null;
      }
      
      setConnectionStatus('connected');

      // The isRunningRef.current check ensures this only runs when transitioning from running to stopped.
      // chartData.length > 1 prevents creating a summary for an empty or freshly reset simulation.
      const { 
        account: latestAccount, 
        currentPrice: latestCurrentPrice,
        trades: latestTrades,
        chartData: latestChartData,
        settings: latestSettings,
      } = summaryStateRef.current;

      if (isRunningRef.current && latestChartData.length > 1) {
          const finalValue = latestAccount.quote + latestAccount.base * latestCurrentPrice;
          const totalProfit = finalValue - latestSettings.initialBalance;
          
          const startPrice = startPriceRef.current;
          const endPrice = latestCurrentPrice;
          let buyAndHoldProfit = 0;
          if (startPrice > 0) {
              const amountBought = latestSettings.initialBalance / startPrice;
              const finalValueHolding = amountBought * endPrice;
              buyAndHoldProfit = finalValueHolding - latestSettings.initialBalance;
          }

          setSimulationSummary({
              totalProfit: totalProfit,
              buyAndHoldProfit: buyAndHoldProfit,
              lowestAccountValue: lowestAccountValueRef.current,
              highestAccountValue: highestAccountValueRef.current,
              buyCount: latestTrades.filter(t => t.type === TradeType.BUY).length,
              sellCount: latestTrades.filter(t => t.type === TradeType.SELL).length,
              trades: latestTrades,
          });

          // Send Telegram summary on manual stop if configured
          if (settings.telegramSettings.enableErrorNotifications) { // Using error notification setting for general stop message
            sendTelegramMessageWrapper(
              `<b>🛑 Astibot Simulation beendet für ${settings.tradingPair}</b>\n` +
              `Gesamtgewinn (Bot): ${totalProfit.toFixed(2)} ${latestSettings.tradingPair.split('-')[1]}\n` +
              `Buy & Hold Gewinn: ${buyAndHoldProfit.toFixed(2)} ${latestSettings.tradingPair.split('-')[1]}\n` +
              `Käufe: ${latestTrades.filter(t => t.type === TradeType.BUY).length}, Verkäufe: ${latestTrades.filter(t => t.type === TradeType.SELL).length}`
            );
          }
      }
    }
    
    return () => {
      if (simulationIntervalRef.current) clearInterval(simulationIntervalRef.current);
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      if (periodicTelegramTimerRef.current) clearInterval(periodicTelegramTimerRef.current); // Cleanup
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning]);

  useEffect(() => {
    // This effect resets the simulation state if fundamental settings are changed while
    // the simulation is not running. It ensures a clean slate for the next run.
    if (!isRunning) {
      resetSimulation();
    }
    // NOTE: `isRunning` is intentionally omitted from the dependency array. We only want this
    // effect to trigger when settings/data change, NOT when the simulation stops.
    // This prevents the summary data from being wiped before it can be displayed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.initialBalance, settings.tradingPair, backtestData, resetSimulation, settings.telegramSettings]); // Added telegramSettings to ensure reset on changes

  useEffect(() => {
    const totalValue = account.quote + account.base * currentPrice;
    const currentProfit = totalValue - settings.initialBalance;
    setProfit(currentProfit);
  }, [account, currentPrice, settings.initialBalance]);

  const toggleSimulation = () => {
    setIsRunning(prev => !prev);
  };

  return { chartData, trades, account, isRunning, settings, setSettings, toggleSimulation, currentPrice, profit, simulationSummary, backtestProgress, connectionStatus };
};