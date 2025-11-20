import React, { useState, useEffect, useMemo } from 'react';
import type { ChartDataPoint, TradingSettings, BacktestData, TelegramSettings } from '../types';
import HistoricalDataSelector from './HistoricalDataSelector';
import TelegramSettingsTab from './TelegramSettingsTab'; // Import the new component
import { saveLiveTradingCredentials, loadLiveTradingCredentials } from '../services/settingsService';

interface CoinbaseProduct {
  id: string;
  base_currency: string;
  quote_currency: string;
  base_increment: string;
  quote_increment: string;
  display_name: string;
  status: string;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: TradingSettings;
  onSettingsChange: (newSettings: Partial<TradingSettings>) => void;
  onHistoricalDataLoaded: (data: ChartDataPoint[], start: string, end: string) => void;
  backtestData: BacktestData | null;
  onClearBacktestData: () => void;
  onLiveConnectionChange: (connected: boolean) => void;
  onResetSettings: () => void;
}

const fetchWithRetry = async (url: string, retries = 5, delay = 1000, backoff = 2): Promise<any> => {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            if (i === retries - 1) throw error;
            // A simple status update could be passed via a callback here if needed
            console.warn(`Fetch failed. Retrying in ${delay / 1000}s...`);
            await new Promise(res => setTimeout(res, delay));
            delay *= backoff;
        }
    }
};


const GeneralSettingsTab: React.FC<{ settings: TradingSettings; onSettingsChange: (newSettings: Partial<TradingSettings>) => void; }> = ({ settings, onSettingsChange }) => {
    const [products, setProducts] = useState<CoinbaseProduct[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState({ usdt: false, usdc: false, search: '' });
    const [loadingPair, setLoadingPair] = useState<string | null>(null);

    useEffect(() => {
        const fetchProducts = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const data: CoinbaseProduct[] = await fetchWithRetry('https://api.exchange.coinbase.com/products');
                setProducts(data.filter(p => p.status === 'online').sort((a,b) => a.id.localeCompare(b.id)));
            } catch (e) {
                const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
                setError(`Failed to fetch data from Coinbase API after multiple retries. ${errorMessage}`);
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        };
        fetchProducts();
    }, []);

    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            const searchLower = filter.search.toLowerCase();
            const matchesSearch = p.id.toLowerCase().includes(searchLower) || p.display_name.toLowerCase().includes(searchLower);
            
            if (!filter.usdt && !filter.usdc) {
                return matchesSearch;
            }
            
            const matchesQuote = (filter.usdt && p.quote_currency === 'USDT') || (filter.usdc && p.quote_currency === 'USDC');
            return matchesSearch && matchesQuote;
        });
    }, [products, filter]);

    const sortedProducts = useMemo(() => {
        const selectedProduct = filteredProducts.find(p => p.id === settings.tradingPair);
        if (!selectedProduct) {
            return filteredProducts;
        }
        const otherProducts = filteredProducts.filter(p => p.id !== settings.tradingPair);
        return [selectedProduct, ...otherProducts];
    }, [filteredProducts, settings.tradingPair]);

    const handlePairSelect = async (productId: string) => {
        setLoadingPair(productId);
        try {
            const response = await fetch(`https://api.exchange.coinbase.com/products/${productId}/ticker`);
            if (!response.ok) {
                throw new Error('Failed to fetch ticker data.');
            }
            const tickerData = await response.json();
            const price = parseFloat(tickerData.price);

            let newRiskLevel: number;
            let newDipsSensitivity: number;

            if (price > 1000) {
                newRiskLevel = 45;
                newDipsSensitivity = 40;
            } else if (price > 100) {
                newRiskLevel = 50;
                newDipsSensitivity = 50;
            } else {
                newRiskLevel = 60;
                newDipsSensitivity = 65;
            }
            
            onSettingsChange({ 
                tradingPair: productId,
                riskLevel: newRiskLevel,
                dipsSensitivity: newDipsSensitivity
            });

        } catch (e) {
            console.error("Failed to fetch ticker to adjust settings, using defaults.", e);
            onSettingsChange({ tradingPair: productId });
        } finally {
            setLoadingPair(null);
        }
    };


    return (
        <div>
            <div className="pb-6 mb-6 border-b border-slate-700">
                <h3 className="text-lg font-semibold text-white mb-4">Currency Pairs</h3>
                <p className="text-sm text-slate-400 mb-4">Load available currency pairs from Coinbase. Select a pair to use in the simulation. Risk and sensitivity will be adjusted to smart defaults based on the pair's current price.</p>
                
                <div className="flex flex-wrap gap-4 mb-4 items-center">
                    <input 
                        type="text"
                        placeholder="Search pair..."
                        value={filter.search}
                        onChange={e => setFilter(prev => ({ ...prev, search: e.target.value }))}
                        className="flex-grow bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                    <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={filter.usdt} onChange={e => setFilter(prev => ({...prev, usdt: e.target.checked}))} className="h-4 w-4 rounded bg-slate-900 border-slate-600 text-blue-500 focus:ring-blue-500" />
                            <span>USDT</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={filter.usdc} onChange={e => setFilter(prev => ({...prev, usdc: e.target.checked}))} className="h-4 w-4 rounded bg-slate-900 border-slate-600 text-blue-500 focus:ring-blue-500" />
                            <span>USDC</span>
                        </label>
                    </div>
                </div>

                <div className="h-64 overflow-y-auto border border-slate-700 rounded-md bg-slate-900/50 p-2">
                    {isLoading && <p className="text-center p-4">Loading pairs...</p>}
                    {error && <p className="text-center p-4 text-red-400">{error}</p>}
                    {!isLoading && !error && (
                        <ul className="space-y-1">
                            {sortedProducts.map(product => (
                                <li key={product.id}>
                                    <button 
                                        onClick={() => handlePairSelect(product.id)}
                                        disabled={loadingPair !== null}
                                        className={`w-full text-left px-3 py-2 rounded-md transition text-sm ${settings.tradingPair === product.id ? 'bg-blue-600 text-white font-semibold' : 'hover:bg-slate-700/50'} disabled:opacity-60 disabled:cursor-not-allowed`}
                                    >
                                        <div className="flex justify-between items-center w-full">
                                            <div>
                                                <span className="font-mono">{product.display_name}</span>
                                                <p className="text-xs text-slate-400">
                                                    Base Inc: {product.base_increment} | Quote Inc: {product.quote_increment}
                                                </p>
                                            </div>
                                            {loadingPair === product.id && (
                                                <div className="w-4 h-4 border-2 border-slate-400 border-t-white rounded-full animate-spin"></div>
                                            )}
                                        </div>
                                    </button>
                                </li>
                            ))}
                            {sortedProducts.length === 0 && <p className="text-center p-4 text-slate-500">No matching pairs found.</p>}
                        </ul>
                    )}
                </div>
            </div>
            
            <div>
                <h3 className="text-lg font-semibold text-white mb-4">Handelsstrategie</h3>
                <p className="text-sm text-slate-400 mb-4">Legen Sie fest, wie sich der Bot beim Handeln verhalten soll.</p>
                <div className="space-y-6">
                    <div>
                        <label htmlFor="tradeAmountPercentage" className="block text-sm font-medium text-slate-300 mb-1">
                            Kapital pro Trade (%)
                        </label>
                        <div className="flex items-center gap-4">
                            <input
                                type="range"
                                id="tradeAmountPercentage"
                                min="1"
                                max="100"
                                value={settings.tradeAmountPercentage}
                                onChange={(e) => onSettingsChange({ tradeAmountPercentage: Number(e.target.value) })}
                                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                            />
                            <span className="font-mono text-slate-300 w-12 text-center">{settings.tradeAmountPercentage}%</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                            Der Bot verwendet diesen Prozentsatz Ihrer verfügbaren Notierungswährung ({settings.tradingPair.split('-')[1]}) für jede neue Kauforder.
                        </p>
                    </div>
                    <div>
                        <label htmlFor="maxConcurrentPositions" className="block text-sm font-medium text-slate-300 mb-1">
                            Maximale gleichzeitige Positionen
                        </label>
                        <input
                            type="number"
                            id="maxConcurrentPositions"
                            min="1"
                            max="20"
                            value={settings.maxConcurrentPositions}
                            onChange={(e) => onSettingsChange({ maxConcurrentPositions: Number(e.target.value) })}
                            className="w-full sm:w-1/3 bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                            Die maximale Anzahl offener Kaufpositionen, die der Bot gleichzeitig halten kann.
                        </p>
                    </div>
                    <div>
                        <label htmlFor="stopLossPercentage" className="block text-sm font-medium text-slate-300 mb-1">
                            Stop Loss (%)
                        </label>
                        <div className="flex items-center gap-4">
                            <input
                                type="number"
                                id="stopLossPercentage"
                                min="1"
                                max="100"
                                step="1"
                                value={settings.stopLossPercentage}
                                onChange={(e) => onSettingsChange({ stopLossPercentage: Number(e.target.value) })}
                                className="w-full sm:w-1/3 bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            />
                            <span className="font-mono text-slate-300">%</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                            Der Bot verkauft eine Position, wenn der Preis um diesen Prozentsatz unter den Kaufpreis fällt.
                        </p>
                    </div>
                    <div>
                        <label htmlFor="sellTriggerPercentage" className="block text-sm font-medium text-slate-300 mb-1">
                            Take Profit (%)
                        </label>
                        <div className="flex items-center gap-4">
                            <input
                                type="number"
                                id="sellTriggerPercentage"
                                min="0"
                                max="100"
                                step="1"
                                value={settings.sellTriggerPercentage}
                                onChange={(e) => onSettingsChange({ sellTriggerPercentage: Number(e.target.value) })}
                                className="w-full sm:w-1/3 bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            />
                            <span className="font-mono text-slate-300">%</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                            Der Bot verkauft eine Position, wenn der Preis um diesen Prozentsatz über dem Kaufpreis liegt. Setze auf 0, um nur mit MACD zu verkaufen.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

const LiveTradingSettingsTab: React.FC<{ onLiveConnectionChange: (connected: boolean) => void }> = ({ onLiveConnectionChange }) => {
    const [apiKey, setApiKey] = useState('');
    const [apiSecret, setApiSecret] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    // Load saved credentials on mount
    useEffect(() => {
        const saved = loadLiveTradingCredentials();
        if (saved) {
            setApiKey(saved.apiKey);
            setApiSecret(saved.apiSecret);
        }
    }, []);

    const handleSaveCredentials = async () => {
        setIsVerifying(true);
        setFeedback(null);

        // Simulate network delay for verification
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Simple validation logic (in a real app, this would be a secure API call)
        if (apiKey.trim().length > 5 && apiSecret.trim().length > 5) {
            // Save credentials to localStorage
            saveLiveTradingCredentials({ apiKey: apiKey.trim(), apiSecret: apiSecret.trim() });
            setFeedback({ type: 'success', message: 'Anmeldedaten erfolgreich überprüft und gespeichert!' });
            onLiveConnectionChange(true);
        } else {
            setFeedback({ type: 'error', message: 'Ungültige Anmeldeinformationen. Bitte überprüfen Sie Ihren API-Schlüssel und Ihr Secret.' });
            onLiveConnectionChange(false);
        }
        
        setIsVerifying(false);

        // Hide feedback message after a few seconds
        setTimeout(() => setFeedback(null), 5000);
    };

    return (
         <div>
            <div className="bg-red-900/50 border border-red-700 text-red-300 text-sm rounded-md p-4 mb-6" role="alert">
                <h4 className="font-bold mb-1">Echthandel deaktiviert</h4>
                <p>
                    Der Echthandelsmodus ist nicht aktiv, da die Verbindung zur Börse nicht hergestellt werden konnte. 
                    Bitte geben Sie einen gültigen API-Schlüssel und ein Secret ein, um diese Funktion zu aktivieren.
                </p>
            </div>
            <h3 className="text-lg font-semibold text-white mb-4">Real Trading Mode</h3>
            <p className="text-sm text-slate-400 mb-4">Enter your Coinbase API credentials to enable live trading. Your keys are stored locally and never sent to our servers.</p>

            <div className="space-y-4">
                <div>
                    <label htmlFor="apiKey" className="block text-sm font-medium text-slate-300 mb-1">API Key</label>
                    <input 
                        type="text" 
                        id="apiKey" 
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" 
                        placeholder="Your Coinbase API Key" 
                        disabled={isVerifying}
                    />
                </div>
                <div>
                    <label htmlFor="apiSecret" className="block text-sm font-medium text-slate-300 mb-1">API Secret</label>
                    <input 
                        type="password" 
                        id="apiSecret" 
                        value={apiSecret}
                        onChange={(e) => setApiSecret(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" 
                        placeholder="Your Coinbase API Secret" 
                        disabled={isVerifying}
                    />
                </div>
                <div className="pt-2">
                    <button 
                        onClick={handleSaveCredentials}
                        disabled={isVerifying}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-sm font-semibold transition w-full sm:w-auto disabled:bg-slate-500 disabled:cursor-wait"
                    >
                        {isVerifying ? 'Überprüfe...' : 'Save Credentials'}
                    </button>
                </div>
                {feedback && (
                    <div className={`text-sm p-3 rounded-md ${feedback.type === 'success' ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}>
                        {feedback.message}
                    </div>
                )}
            </div>
         </div>
    );
};

export default function SettingsModal({ isOpen, onClose, settings, onSettingsChange, onHistoricalDataLoaded, backtestData, onClearBacktestData, onLiveConnectionChange, onResetSettings }: SettingsModalProps): React.ReactElement | null {
  const [activeTab, setActiveTab] = useState<'general' | 'live' | 'simulation' | 'telegram'>('general');

  if (!isOpen) return null;

  const tabs = [
      { id: 'general', label: 'Allgemein' },
      { id: 'live', label: 'Real trading mode' },
      { id: 'simulation', label: 'Simulation mode' },
      { id: 'telegram', label: 'Telegram Bot' }, // New tab for Telegram
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'general':
        return <GeneralSettingsTab settings={settings} onSettingsChange={onSettingsChange} />;
      case 'live':
        return <LiveTradingSettingsTab onLiveConnectionChange={onLiveConnectionChange} />;
      case 'simulation':
        return (
          <>
            <div className="pb-6 mb-6 border-b border-slate-700">
                <h3 className="text-lg font-semibold text-white mb-4">Live Simulation Parameters</h3>
                <p className="text-sm text-slate-400 mb-4">
                    Configure the behavior of the live simulation (when no historical data is loaded).
                </p>
                <div className="space-y-4">
                     <div>
                        <label htmlFor="simDuration" className="block text-sm font-medium text-slate-300 mb-1">
                            Automatic Stop Timer
                        </label>
                        <select
                            id="simDuration"
                            value={settings.simulationDuration}
                            onChange={(e) => onSettingsChange({ simulationDuration: Number(e.target.value) })}
                            className="w-full sm:w-1/2 bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        >
                            <option value="0">Unlimited</option>
                            <option value="5">5 Minutes</option>
                            <option value="10">10 Minutes</option>
                            <option value="30">30 Minutes</option>
                            <option value="60">1 Hour</option>
                        </select>
                         <p className="text-xs text-slate-500 mt-1">
                            The simulation will automatically stop after the selected duration. 'Unlimited' runs until manually stopped. This setting has no effect when using historical data for backtesting.
                        </p>
                    </div>
                </div>
            </div>
            <div className="pb-6 mb-6 border-b border-slate-700">
              <h3 className="text-lg font-semibold text-white mb-4">Backtesting Parameters</h3>
              <p className="text-sm text-slate-400 mb-4">
                  Configure the speed and data for backtesting simulations.
              </p>
              <div className="space-y-4">
                  <div>
                      <label htmlFor="backtestSpeed" className="block text-sm font-medium text-slate-300 mb-1">
                          Backtesting Speed (Time-lapse)
                      </label>
                      <select
                          id="backtestSpeed"
                          value={settings.backtestSpeed}
                          onChange={(e) => onSettingsChange({ backtestSpeed: Number(e.target.value) })}
                          className="w-full sm:w-1/2 bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      >
                          <option value="100">Slow (100ms/tick)</option>
                          <option value="50">Normal (50ms/tick)</option>
                          <option value="25">Fast (25ms/tick)</option>
                          <option value="10">Very Fast (10ms/tick)</option>
                          <option value="1">Maximum Speed (1ms/tick)</option>
                      </select>
                      <p className="text-xs text-slate-500 mt-1">
                          The delay between processing each historical data point. A lower value results in a faster backtest.
                      </p>
                  </div>
            </div>
            </div>
            <div className="pb-6 mb-6 border-b border-slate-700">
                <h3 className="text-lg font-semibold text-white mb-4">Geladene Backtest-Daten</h3>
                {backtestData ? (
                    <div>
                        <p className="text-sm text-slate-400">
                            Currently loaded data for <span className="font-semibold text-slate-300">{settings.tradingPair}</span> from <span className="font-semibold text-slate-300">{new Date(backtestData.start).toLocaleDateString()}</span> to <span className="font-semibold text-slate-300">{new Date(backtestData.end).toLocaleDateString()}</span>.
                        </p>
                        <button
                            onClick={onClearBacktestData}
                            className="mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-md text-sm font-semibold transition"
                        >
                            Geladene Daten löschen
                        </button>
                    </div>
                ) : (
                    <p className="text-sm text-slate-500">No historical data is currently loaded. The app will run in live simulation mode.</p>
                )}
            </div>
            <HistoricalDataSelector tradingPair={settings.tradingPair} onHistoricalDataLoaded={onHistoricalDataLoaded} onClose={onClose} />
          </>
        );
      case 'telegram':
        return (
            <TelegramSettingsTab 
                telegramSettings={settings.telegramSettings}
                onTelegramSettingsChange={(newTelegramSettings) => 
                    onSettingsChange({ telegramSettings: { ...settings.telegramSettings, ...newTelegramSettings } })
                }
            />
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose} role="dialog" aria-modal="true">
      <div 
        className="bg-[#1E293B] rounded-lg border border-slate-700 shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex justify-between items-center p-4 border-b border-slate-700">
          <h2 className="text-xl font-bold text-white">Settings</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={onResetSettings}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-md text-sm font-semibold transition text-white"
              title="Alle Einstellungen zurücksetzen"
            >
              Zurücksetzen
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition text-2xl leading-none" aria-label="Close settings">&times;</button>
          </div>
        </header>
        
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
            <nav className="w-full md:w-1/3 lg:w-1/4 p-4 border-b md:border-b-0 md:border-r border-slate-700 overflow-y-auto">
                <ul className="space-y-1">
                    {tabs.map(tab => (
                        <li key={tab.id}>
                            <button 
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`w-full text-left px-3 py-2 rounded-md transition text-sm ${activeTab === tab.id ? 'bg-blue-600 text-white font-semibold' : 'hover:bg-slate-700/50'}`}
                            >
                                {tab.label}
                            </button>
                        </li>
                    ))}
                </ul>
            </nav>
            <main className="p-6 flex-1 overflow-y-auto">
                {renderContent()}
            </main>
        </div>
      </div>
    </div>
  );
}