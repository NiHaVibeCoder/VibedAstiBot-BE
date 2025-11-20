import React from 'react';
import type { SimulationSummary, Trade } from '../types';
import { TradeType } from '../types';

interface SimulationSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: SimulationSummary;
  tradingPair: string;
}

const StatCard: React.FC<{ label: React.ReactNode; value: string; className?: string; isPrimary?: boolean }> = ({ label, value, className, isPrimary = false }) => (
    <div className={`p-4 rounded-lg text-center ${isPrimary ? 'bg-slate-900/50 border border-slate-700' : 'bg-slate-800'}`}>
        <p className="text-sm text-slate-400 flex items-center justify-center gap-1">{label}</p>
        <p className={`font-bold font-mono ${isPrimary ? 'text-2xl' : 'text-xl'} ${className}`}>{value}</p>
    </div>
);


const calculateProfit = (sellTrade: Trade, sellIndex: number, allTrades: Trade[]): number | null => {
    const buysBeforeSell = allTrades.slice(0, sellIndex).filter(t => t.type === TradeType.BUY);
    const sellsBeforeSell = allTrades.slice(0, sellIndex).filter(t => t.type === TradeType.SELL);
    
    if (buysBeforeSell.length > sellsBeforeSell.length) {
      const lastUnmatchedBuy = buysBeforeSell[sellsBeforeSell.length];
      if (lastUnmatchedBuy) {
          const cost = lastUnmatchedBuy.amount * lastUnmatchedBuy.price;
          const revenue = sellTrade.amount * sellTrade.price;
          return revenue - cost;
      }
    }
    return null;
};

export default function SimulationSummaryModal({ isOpen, onClose, summary, tradingPair }: SimulationSummaryModalProps): React.ReactElement | null {
  if (!isOpen) return null;

  const [, quoteCurrency] = tradingPair.split('-');
  const profitClass = summary.totalProfit >= 0 ? 'text-green-400' : 'text-red-400';
  const buyAndHoldProfitClass = summary.buyAndHoldProfit >= 0 ? 'text-green-400' : 'text-red-400';
  const botOutperformed = summary.totalProfit > summary.buyAndHoldProfit;
  
  const performanceIndicator = (
    <span title={botOutperformed ? 'Outperformed Buy & Hold' : 'Underperformed Buy & Hold'} className={`font-sans ${botOutperformed ? 'text-green-500' : 'text-red-500'}`}>
        {botOutperformed ? '▲' : '▼'}
    </span>
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="bg-[#1E293B] rounded-lg border border-slate-700 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex justify-between items-center p-4 border-b border-slate-700">
          <h2 className="text-xl font-bold text-white">Simulation Summary</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition text-2xl leading-none" aria-label="Close">&times;</button>
        </header>

        <main className="p-6 flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="col-span-2">
                <StatCard 
                    label={<><span>Totaler Gewinn (Bot)</span> {performanceIndicator}</>} 
                    value={`${summary.totalProfit.toFixed(2)} ${quoteCurrency}`} 
                    className={profitClass} 
                    isPrimary 
                />
              </div>
              <div className="col-span-2">
                <StatCard 
                    label="Gewinn (Buy & Hold)" 
                    value={`${summary.buyAndHoldProfit.toFixed(2)} ${quoteCurrency}`} 
                    className={buyAndHoldProfitClass} 
                    isPrimary
                />
              </div>
              <StatCard label="Höchster Kontostand" value={`${summary.highestAccountValue.toFixed(2)} ${quoteCurrency}`} className="text-sky-400" />
              <StatCard label="Tiefster Kontostand" value={`${summary.lowestAccountValue.toFixed(2)} ${quoteCurrency}`} className="text-orange-400" />
              <StatCard label="Anzahl Käufe" value={`${summary.buyCount}`} className="text-slate-300" />
              <StatCard label="Anzahl Verkäufe" value={`${summary.sellCount}`} className="text-slate-300" />
          </div>

          <h3 className="text-lg font-semibold text-white mb-3">Trade History</h3>
          {summary.trades.length === 0 ? (
            <div className="text-center text-slate-400 py-10">
              <p>No trades were executed during this simulation.</p>
            </div>
          ) : (
            <div className="overflow-y-auto max-h-80 border border-slate-700 rounded-md">
              <table className="w-full text-sm text-left text-slate-300">
                <thead className="text-xs text-slate-400 uppercase bg-slate-800 sticky top-0 z-10">
                  <tr>
                    <th scope="col" className="px-4 py-3">Time</th>
                    <th scope="col" className="px-4 py-3">Type</th>
                    <th scope="col" className="px-4 py-3 text-right">Kurs</th>
                    <th scope="col" className="px-4 py-3 text-right">Betrag</th>
                    <th scope="col" className="px-4 py-3 text-right">Total ({quoteCurrency})</th>
                    <th scope="col" className="px-4 py-3 text-right">Gewinn/Verlust ({quoteCurrency})</th>
                    <th scope="col" className="px-4 py-3">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {summary.trades.map((trade, index) => {
                    const isBuy = trade.type === TradeType.BUY;
                    const profit = isBuy ? null : calculateProfit(trade, index, summary.trades);
                    const profitClass = profit === null ? '' : profit >= 0 ? 'text-green-400' : 'text-red-400';
                    const total = trade.price * trade.amount;

                    return (
                        <tr key={trade.id} className="hover:bg-slate-800/50">
                        <td className="px-4 py-2 font-mono">{new Date(trade.time).toLocaleString()}</td>
                        <td className={`px-4 py-2 font-semibold ${isBuy ? 'text-green-400' : 'text-red-400'}`}>
                            {trade.type}
                        </td>
                        <td className="px-4 py-2 font-mono text-right">{trade.price.toFixed(2)}</td>
                        <td className="px-4 py-2 font-mono text-right">{trade.amount.toFixed(6)}</td>
                        <td className="px-4 py-2 font-mono text-right">{total.toFixed(2)}</td>
                        <td className={`px-4 py-2 font-mono text-right font-bold ${profitClass}`}>
                          {profit !== null ? profit.toFixed(2) : '—'}
                        </td>
                        <td className="px-4 py-2 text-slate-400">{trade.reason}</td>
                        </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </main>

        <footer className="p-4 border-t border-slate-700 text-right">
            <button
                onClick={onClose}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-sm font-semibold transition"
            >
                Close
            </button>
        </footer>
      </div>
    </div>
  );
}