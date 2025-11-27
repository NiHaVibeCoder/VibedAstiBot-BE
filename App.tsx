import React, { useState, useEffect } from 'react';
import ControlPanel from './components/ControlPanel';
import InfoPanel from './components/InfoPanel';
import TradingChart from './components/TradingChart';
import { useBackendTradingSimulator } from './hooks/useBackendTradingSimulator';
import { DEFAULT_SETTINGS } from './constants';
import type { TradingSettings, ChartDataPoint, SimulationSummary, BacktestData } from './types';
import SettingsModal from './components/SettingsModal';
import LoadDataModal from './components/LoadDataModal';
import OptimizationResultModal from './components/OptimizationResultModal';
import { runHeadlessSimulation } from './services/simulationService';
import TradesModal from './components/TradesModal';
import SimulationSummaryModal from './components/SimulationSummaryModal';
import ConfirmationModal from './components/ConfirmationModal';
import { loadSettings, saveSettings, resetSettings, loadLiveTradingCredentials } from './services/settingsService';

interface OptimizationResult {
  bestProfit: number;
  optimalSettings: {
    riskLevel: number;
    dipsSensitivity: number;
    stopLossPercentage: number;
    sellTriggerPercentage: number;
  };
  buyAndHoldProfit: number;
}


export default function App(): React.ReactElement {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTradesModalOpen, setIsTradesModalOpen] = useState(false);
  const [backtestData, setBacktestData] = useState<BacktestData | null>(null);
  const [isLoadDataModalOpen, setIsLoadDataModalOpen] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationProgress, setOptimizationProgress] = useState(0);
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null);
  const [isOptimizationResultModalOpen, setIsOptimizationResultModalOpen] = useState(false);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [tradingMode, setTradingMode] = useState<'simulation' | 'live'>('simulation');
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [hasOptimized, setHasOptimized] = useState(false);
  const [confirmationState, setConfirmationState] = useState({
    isOpen: false,
    title: '',
    message: '' as React.ReactNode,
    onConfirm: () => { },
    confirmText: 'Confirm',
    confirmButtonClass: 'bg-blue-600 hover:bg-blue-700',
    hideCancelButton: false,
  });

  // Load settings from localStorage on mount
  const [initialSettings] = useState(() => loadSettings());

  const {
    chartData,
    trades,
    account,
    isRunning,
    settings,
    setSettings,
    toggleSimulation,
    currentPrice,
    profit,
    simulationSummary,
    backtestProgress,
    connectionStatus,
  } = useBackendTradingSimulator(initialSettings, backtestData?.data ?? null);

  // Load live trading credentials on mount
  useEffect(() => {
    const credentials = loadLiveTradingCredentials();
    if (credentials && credentials.apiKey && credentials.apiSecret) {
      // Auto-verify credentials if they exist
      setIsLiveConnected(true);
    }
  }, []);

  // Save settings whenever they change
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (simulationSummary) {
      setIsSummaryModalOpen(true);
    }
  }, [simulationSummary]);

  const handleSettingsChange = (newSettings: Partial<TradingSettings>) => {
    if (newSettings.tradingPair && newSettings.tradingPair !== settings.tradingPair) {
      setBacktestData(null);
      setHasOptimized(false);
    }
    const updatedSettings = { ...settings, ...newSettings };
    setSettings(updatedSettings);
    saveSettings(updatedSettings);
  };

  const handleResetSettings = () => {
    setConfirmationState({
      isOpen: true,
      title: 'Einstellungen zurücksetzen?',
      message: 'Möchten Sie wirklich alle Einstellungen auf die Standardwerte zurücksetzen? Dies kann nicht rückgängig gemacht werden.',
      onConfirm: () => {
        const reset = resetSettings();
        setSettings(reset);
        setIsLiveConnected(false);
        setConfirmationState(prev => ({ ...prev, isOpen: false }));
      },
      confirmText: 'Ja, zurücksetzen',
      confirmButtonClass: 'bg-red-600 hover:bg-red-700',
      hideCancelButton: false,
    });
  };

  const handleModeChange = (mode: 'simulation' | 'live') => {
    if (isRunning) {
      toggleSimulation();
    }
    setTradingMode(mode);
  };

  const handleHistoricalDataLoaded = (data: ChartDataPoint[], start: string, end: string) => {
    setBacktestData({ data, start, end });
    setHasOptimized(false);
    if (isRunning) {
      toggleSimulation();
    }
    setIsLoadDataModalOpen(false);
  };

  const handleClearBacktestData = () => {
    setBacktestData(null);
    setHasOptimized(false);
  };

  const findOptimalSettings = async () => {
    if (!backtestData || backtestData.data.length < 2) return;

    setIsOptimizing(true);
    setOptimizationProgress(0);

    await new Promise(resolve => setTimeout(resolve, 50));

    // Ensure data is sorted by time to prevent implausible results
    const sortedData = [...backtestData.data].sort((a, b) => a.time - b.time);

    const startPrice = sortedData[0].price;
    const endPrice = sortedData[sortedData.length - 1].price;
    const amountBought = settings.initialBalance / startPrice;
    const finalValue = amountBought * endPrice;
    const buyAndHoldProfit = finalValue - settings.initialBalance;

    const riskLevels = [10, 20, 30, 40, 50, 60, 70, 80, 90];
    const sensitivities = [10, 20, 30, 40, 50, 60, 70, 80, 90];
    const stopLosses = [2, 5, 10, 15]; // Percentages
    const sellTriggers = [0, 2, 5, 10, 15]; // Percentages (0 for MACD-based sell)

    const totalSimulations = riskLevels.length * sensitivities.length * stopLosses.length * sellTriggers.length;
    let completedSimulations = 0;

    let bestProfit = -Infinity;
    let optimalSettings = {
      riskLevel: settings.riskLevel,
      dipsSensitivity: settings.dipsSensitivity,
      stopLossPercentage: settings.stopLossPercentage,
      sellTriggerPercentage: settings.sellTriggerPercentage,
    };

    for (const riskLevel of riskLevels) {
      for (const dipsSensitivity of sensitivities) {
        for (const stopLossPercentage of stopLosses) {
          for (const sellTriggerPercentage of sellTriggers) {
            const tempSettings = { ...settings, riskLevel, dipsSensitivity, stopLossPercentage, sellTriggerPercentage };
            const profit = runHeadlessSimulation(tempSettings, sortedData);

            if (profit > bestProfit) {
              bestProfit = profit;
              optimalSettings = { riskLevel, dipsSensitivity, stopLossPercentage, sellTriggerPercentage };
            }

            completedSimulations++;
            await new Promise(resolve => requestAnimationFrame(() => {
              setOptimizationProgress((completedSimulations / totalSimulations) * 100);
              resolve(null);
            }));
          }
        }
      }
    }

    setOptimizationResult({ bestProfit, optimalSettings, buyAndHoldProfit });
    setHasOptimized(true);
    setIsOptimizationResultModalOpen(true);

    setIsOptimizing(false);
    setOptimizationProgress(0);
  };

  const handleCloseOptimizationResultModal = () => {
    if (optimizationResult) {
      handleSettingsChange({
        riskLevel: optimizationResult.optimalSettings.riskLevel,
        dipsSensitivity: optimizationResult.optimalSettings.dipsSensitivity,
        stopLossPercentage: optimizationResult.optimalSettings.stopLossPercentage,
        sellTriggerPercentage: optimizationResult.optimalSettings.sellTriggerPercentage,
      });
    }
    setIsOptimizationResultModalOpen(false);
    setOptimizationResult(null);
  };

  const handleFindOptimalClick = () => {
    if (isRunning) return;
    if (!backtestData) {
      setIsLoadDataModalOpen(true);
    } else {
      findOptimalSettings();
    }
  };

  const handleToggleSimulationClick = () => {
    if (tradingMode === 'simulation') {
      toggleSimulation();
      return;
    }

    // Real trading mode logic
    if (isRunning) {
      // Stop confirmation
      setConfirmationState({
        isOpen: true,
        title: 'Stop Real Trading?',
        message: 'Sind Sie sicher, dass Sie den Trading Bot stoppen möchten? Alle realen Handelsaktivitäten werden eingestellt.',
        onConfirm: () => {
          toggleSimulation();
          setConfirmationState(prev => ({ ...prev, isOpen: false }));
        },
        confirmText: 'Ja, Handel stoppen',
        confirmButtonClass: 'bg-red-600 hover:bg-red-700',
        hideCancelButton: false,
      });
    } else {
      // Start confirmation
      if (!hasOptimized) {
        setConfirmationState({
          isOpen: true,
          title: 'Optimierung erforderlich',
          message: 'Sie müssen zuerst den "Find Optimal"-Prozess mit historischen Daten durchführen, bevor Sie den realen Handel starten, um sicherzustellen, dass der Bot die beste Strategie verwendet.',
          onConfirm: () => setConfirmationState(prev => ({ ...prev, isOpen: false })),
          confirmText: 'OK',
          confirmButtonClass: 'bg-blue-600 hover:bg-blue-700',
          hideCancelButton: true,
        });
      } else {
        setConfirmationState({
          isOpen: true,
          title: 'Echthandel bestätigen',
          message: (
            <div className="space-y-2">
              <p className="font-bold text-red-400">WARNUNG: Sie sind dabei, den Handel mit echtem Geld zu beginnen.</p>
              <p>Bitte stellen Sie sicher, dass Ihre Einstellungen korrekt sind. Astibot ist nicht für finanzielle Verluste verantwortlich.</p>
            </div>
          ),
          onConfirm: () => {
            toggleSimulation();
            setConfirmationState(prev => ({ ...prev, isOpen: false }));
          },
          confirmText: 'Ich verstehe, Handel starten',
          confirmButtonClass: 'bg-green-600 hover:bg-green-700',
          hideCancelButton: false,
        });
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-300 font-sans p-2 sm:p-4">
      <header className="relative flex justify-between items-center mb-4 px-2">
        <h1 className="text-3xl font-bold text-white">Astibot</h1>

        {tradingMode === 'live' && isRunning && (
          <div className="absolute left-1/2 -translate-x-1/2 text-center">
            <span className="px-4 py-1 bg-red-900/50 border border-red-700 text-red-300 rounded-md font-bold animate-pulse text-lg" role="status" aria-live="assertive">
              Echthandel aktiv
            </span>
          </div>
        )}

        <nav className="flex items-center gap-2">
          <button
            onClick={() => setIsTradesModalOpen(true)}
            className="px-4 py-2 bg-slate-700/50 hover:bg-slate-700 rounded-md text-sm font-semibold border border-slate-600 transition">
            Trades
          </button>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="px-4 py-2 bg-slate-700/50 hover:bg-slate-700 rounded-md text-sm font-semibold border border-slate-600 transition">
            Settings
          </button>
        </nav>
      </header>

      <main className="bg-[#1E293B] rounded-lg p-3 sm:p-6 border border-slate-700 shadow-2xl shadow-slate-900/50">
        {connectionStatus !== 'connected' && !backtestData && (
          <div className="bg-yellow-900/50 border border-yellow-700 text-yellow-300 text-sm rounded-md p-4 mb-4" role="alert">
            <h4 className="font-bold mb-1">
              {connectionStatus === 'connecting' ? 'Stelle Verbindung wieder her...' : 'Verbindung unterbrochen'}
            </h4>
            <p>
              {connectionStatus === 'connecting'
                ? 'Die Live-Datenverbindung wird wiederhergestellt. Bitte warten.'
                : 'Die Live-Datenverbindung ist unterbrochen. Ein Wiederverbindungsversuch wird gestartet.'
              }
            </p>
          </div>
        )}
        {tradingMode === 'live' && !isLiveConnected && (
          <div className="bg-red-900/50 border border-red-700 text-red-300 text-sm rounded-md p-4 mb-4" role="alert">
            <h4 className="font-bold mb-1">Echthandel deaktiviert</h4>
            <p>
              Der Echthandelsmodus ist nicht aktiv, da die Verbindung zur Börse nicht hergestellt werden konnte.
              Bitte geben Sie einen gültigen API-Schlüssel und ein Secret in den Einstellungen ein, um diese Funktion zu aktivieren.
            </p>
          </div>
        )}
        <InfoPanel
          account={account}
          currentPrice={currentPrice}
          profit={profit}
          tradingPair={settings.tradingPair}
          backtestData={backtestData}
          tradingMode={tradingMode}
        />
        <ControlPanel
          settings={settings}
          onSettingsChange={handleSettingsChange}
          isRunning={isRunning}
          onToggleSimulation={handleToggleSimulationClick}
          onFindOptimal={handleFindOptimalClick}
          isOptimizing={isOptimizing}
          optimizationProgress={optimizationProgress}
          isBacktesting={backtestData !== null}
          backtestProgress={backtestProgress}
          tradingMode={tradingMode}
          onModeChange={handleModeChange}
          isLiveConnected={isLiveConnected}
        />
        <div className="mt-4 border-t border-slate-700 pt-4 h-[55vh] min-h-[400px]">
          <h2 className="text-lg font-semibold text-slate-400 mb-2 px-2">
            {settings.tradingPair} GDAX Market Price ({settings.tradingPair.split('-')[1]})
          </h2>
          <TradingChart data={chartData} trades={trades} />
        </div>
      </main>

      {isSettingsOpen && (
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          settings={settings}
          onSettingsChange={handleSettingsChange}
          onHistoricalDataLoaded={handleHistoricalDataLoaded}
          backtestData={backtestData}
          onClearBacktestData={handleClearBacktestData}
          onLiveConnectionChange={setIsLiveConnected}
          onResetSettings={handleResetSettings}
        />
      )}
      {isLoadDataModalOpen && (
        <LoadDataModal
          isOpen={isLoadDataModalOpen}
          onClose={() => setIsLoadDataModalOpen(false)}
          settings={settings}
          onHistoricalDataLoaded={handleHistoricalDataLoaded}
        />
      )}
      {isOptimizationResultModalOpen && optimizationResult && (
        <OptimizationResultModal
          isOpen={isOptimizationResultModalOpen}
          onClose={handleCloseOptimizationResultModal}
          result={optimizationResult}
          tradingPair={settings.tradingPair}
          backtestData={backtestData}
        />
      )}
      {isTradesModalOpen && (
        <TradesModal
          isOpen={isTradesModalOpen}
          onClose={() => setIsTradesModalOpen(false)}
          trades={trades}
        />
      )}
      {isSummaryModalOpen && simulationSummary && (
        <SimulationSummaryModal
          isOpen={isSummaryModalOpen}
          onClose={() => setIsSummaryModalOpen(false)}
          summary={simulationSummary}
          tradingPair={settings.tradingPair}
        />
      )}
      {confirmationState.isOpen && (
        <ConfirmationModal
          isOpen={confirmationState.isOpen}
          title={confirmationState.title}
          message={confirmationState.message}
          onConfirm={confirmationState.onConfirm}
          onClose={() => setConfirmationState(prev => ({ ...prev, isOpen: false }))}
          confirmText={confirmationState.confirmText}
          confirmButtonClass={confirmationState.confirmButtonClass}
          hideCancelButton={confirmationState.hideCancelButton}
        />
      )}
    </div>
  );
}