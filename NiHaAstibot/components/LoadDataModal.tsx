import React from 'react';
import type { TradingSettings, ChartDataPoint } from '../types';
import HistoricalDataSelector from './HistoricalDataSelector';

interface LoadDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: TradingSettings;
  onHistoricalDataLoaded: (data: ChartDataPoint[], start: string, end: string) => void;
}

export default function LoadDataModal({ isOpen, onClose, settings, onHistoricalDataLoaded }: LoadDataModalProps): React.ReactElement | null {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose} role="dialog" aria-modal="true">
      <div 
        className="bg-[#1E293B] rounded-lg border border-slate-700 shadow-2xl w-full max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex justify-between items-center p-4 border-b border-slate-700">
          <h2 className="text-xl font-bold text-white">Load Historical Data</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition text-2xl leading-none" aria-label="Close">&times;</button>
        </header>
        <main className="p-6">
            <p className="text-sm text-slate-400 mb-4">To find the optimal settings, you first need to load historical market data for backtesting.</p>
            <HistoricalDataSelector
                tradingPair={settings.tradingPair}
                onHistoricalDataLoaded={onHistoricalDataLoaded}
                onClose={onClose}
            />
        </main>
      </div>
    </div>
  );
}