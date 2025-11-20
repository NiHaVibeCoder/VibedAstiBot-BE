// hooks/useBackendTradingSimulator.ts - Hook für Backend-basierte Trading-Simulation
import { useState, useEffect, useCallback, useRef } from 'react';
import type { TradingSettings, ChartDataPoint, Trade, Account, ConnectionStatus } from '../types';
import { backendService, type BackendState } from '../services/backendService';

export const useBackendTradingSimulator = (
  initialSettings: TradingSettings,
  backtestData: ChartDataPoint[] | null
) => {
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
  const [backtestProgress, setBacktestProgress] = useState<number>(0);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [simulationSummary, setSimulationSummary] = useState<any>(null);

  // Connect to backend on mount
  useEffect(() => {
    backendService.connect();

    // Check if backend is available
    backendService.checkHealth().then(isHealthy => {
      if (isHealthy) {
        setConnectionStatus('connected');
        // Load current state from backend
        backendService.getState().then(state => {
          if (state) {
            setIsRunning(state.isRunning);
            setAccount(state.account || { base: 0, quote: settings.initialBalance });
            setCurrentPrice(state.currentPrice || 1000);
            setTrades(state.trades || []);
            setChartData(state.chartData || []);
            setBacktestProgress(state.backtestProgress || 0);
          }
        });
      } else {
        setConnectionStatus('disconnected');
      }
    });

    // Subscribe to state updates
    const unsubscribe = backendService.onStateUpdate((state: BackendState) => {
      setIsRunning(state.isRunning);
      setAccount(state.account || { base: 0, quote: initialSettings.initialBalance });
      setCurrentPrice(state.currentPrice);
      setTrades(state.trades || []);
      setChartData(state.chartData || []);
      setBacktestProgress(state.backtestProgress);
      setProfit(state.profit);
      setConnectionStatus(backendService.isConnected() ? 'connected' : 'disconnected');
    });

    return () => {
      unsubscribe();
      // Don't disconnect - let it run in background
    };
  }, []);

  // Update settings on backend when they change
  useEffect(() => {
    if (isRunning) {
      backendService.updateSettings(settings);
    }
  }, [settings, isRunning]);

  const toggleSimulation = useCallback(() => {
    if (isRunning) {
      backendService.stopTrading();
      setIsRunning(false);
    } else {
      backendService.startTrading(settings, backtestData ? { data: backtestData } : null);
      setIsRunning(true);
    }
  }, [isRunning, settings, backtestData]);

  // Update local settings and sync with backend
  const updateSettings = useCallback((newSettings: Partial<TradingSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      if (isRunning) {
        backendService.updateSettings(updated);
      }
      return updated;
    });
  }, [isRunning]);

  return {
    chartData,
    trades,
    account,
    isRunning,
    settings,
    setSettings: updateSettings,
    toggleSimulation,
    currentPrice,
    profit,
    simulationSummary,
    backtestProgress,
    connectionStatus,
  };
};

