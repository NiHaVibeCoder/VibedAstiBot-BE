import React from 'react';
import type { BacktestData } from '../types';

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

interface OptimizationResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: OptimizationResult | null;
  tradingPair: string;
  backtestData: BacktestData | null;
}

export default function OptimizationResultModal({ isOpen, onClose, result, tradingPair, backtestData }: OptimizationResultModalProps): React.ReactElement | null {
  if (!isOpen || !result) return null;

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString();
  const [, quoteCurrency] = tradingPair.split('-');
  const buyAndHoldProfitClass = result.buyAndHoldProfit >= 0 ? 'text-green-400' : 'text-red-400';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true">
      <div 
        className="bg-[#1E293B] rounded-lg border border-slate-700 shadow-2xl w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex justify-between items-center p-4 border-b border-slate-700">
          <h2 className="text-xl font-bold text-white">Optimization Complete</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition text-2xl leading-none" aria-label="Close">&times;</button>
        </header>
        <main className="p-6 text-slate-300">
            <div className="bg-slate-900/50 rounded-md p-4 mb-6 border border-slate-700">
                <p className="text-sm text-slate-400">The optimal settings were found based on the historical data for:</p>
                <p className="font-semibold text-white">{tradingPair}</p>
                {backtestData && (
                    <p className="text-xs text-slate-500">{formatDate(backtestData.start)} - {formatDate(backtestData.end)}</p>
                )}
            </div>
            
            <div className="space-y-4">
                <div className="flex justify-between items-baseline p-3 bg-slate-800 rounded-md">
                    <span className="text-slate-400">Maximum Profit Found (Bot):</span>
                    <span className={`font-mono text-2xl font-bold ${result.bestProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {result.bestProfit.toFixed(2)} {quoteCurrency}
                    </span>
                </div>
                 <div className="flex justify-between items-baseline p-3 bg-slate-800 rounded-md">
                    <span className="text-slate-400">"Buy and Hold" Profit:</span>
                    <span className={`font-mono text-xl font-bold ${buyAndHoldProfitClass}`}>
                        {result.buyAndHoldProfit.toFixed(2)} {quoteCurrency}
                    </span>
                </div>
                 <div className="flex justify-between items-center p-3 bg-slate-800 rounded-md">
                    <span className="text-slate-400">Optimal Risk Level:</span>
                    <span className="font-mono text-lg text-white">{result.optimalSettings.riskLevel}</span>
                </div>
                 <div className="flex justify-between items-center p-3 bg-slate-800 rounded-md">
                    <span className="text-slate-400">Optimal Dips Sensitivity:</span>
                    <span className="font-mono text-lg text-white">{result.optimalSettings.dipsSensitivity}</span>
                </div>
                 <div className="flex justify-between items-center p-3 bg-slate-800 rounded-md">
                    <span className="text-slate-400">Optimal Stop Loss (%):</span>
                    <span className="font-mono text-lg text-white">{result.optimalSettings.stopLossPercentage}</span>
                </div>
                 <div className="flex justify-between items-center p-3 bg-slate-800 rounded-md">
                    <span className="text-slate-400">Optimal Take Profit (%):</span>
                    <span className="font-mono text-lg text-white">{result.optimalSettings.sellTriggerPercentage}</span>
                </div>
            </div>

            <div className="mt-6 text-center">
                <button 
                    onClick={onClose}
                    className="px-8 py-2 bg-blue-600 hover:bg-blue-700 rounded-md font-semibold transition"
                >
                    Apply Settings and Close
                </button>
            </div>
        </main>
      </div>
    </div>
  );
}