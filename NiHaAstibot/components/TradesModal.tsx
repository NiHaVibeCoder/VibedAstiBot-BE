import React from 'react';
import type { Trade } from '../types';
import { TradeType } from '../types';

interface TradesModalProps {
  isOpen: boolean;
  onClose: () => void;
  trades: Trade[];
  tradingPair: string;
}

export default function TradesModal({ isOpen, onClose, trades, tradingPair }: TradesModalProps): React.ReactElement | null {
  if (!isOpen) return null;

  const [baseCurrency, quoteCurrency] = tradingPair.split('-');

  const calculateProfit = (sellTrade: Trade, sellIndex: number): number | null => {
      // Find the most recent, "unclosed" buy trade before this sell trade.
      // This is a simplified logic assuming FIFO and that each sell closes a corresponding buy.
      const buysBeforeSell = trades.slice(0, sellIndex).filter(t => t.type === TradeType.BUY);
      const sellsBeforeSell = trades.slice(0, sellIndex).filter(t => t.type === TradeType.SELL);
      
      // Find a buy that hasn't been matched by a previous sell
      if (buysBeforeSell.length > sellsBeforeSell.length) {
        const lastUnmatchedBuy = buysBeforeSell[sellsBeforeSell.length];
        if (lastUnmatchedBuy) {
            // Simple profit calc: assumes the sell amount corresponds to the buy amount
            const cost = lastUnmatchedBuy.amount * lastUnmatchedBuy.price;
            const revenue = sellTrade.amount * sellTrade.price;
            // This is an approximation if sell amount != buy amount.
            // A more complex implementation would handle partial sells.
            // For this simulator, we assume full position sells.
            return revenue - cost;
        }
      }

      return null;
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="bg-[#1E293B] rounded-lg border border-slate-700 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex justify-between items-center p-4 border-b border-slate-700">
          <h2 className="text-xl font-bold text-white">Trade History ({tradingPair})</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition text-2xl leading-none" aria-label="Close">&times;</button>
        </header>
        <main className="p-6 flex-1 overflow-y-auto">
          {trades.length === 0 ? (
            <div className="text-center text-slate-400 py-10">
              <p>No trades have been executed yet.</p>
              <p className="text-sm mt-2">Start the simulation to see trades appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-slate-300">
                <thead className="text-xs text-slate-400 uppercase bg-slate-800">
                  <tr>
                    <th scope="col" className="px-4 py-3">Time</th>
                    <th scope="col" className="px-4 py-3">Type</th>
                    <th scope="col" className="px-4 py-3 text-right">Price ({quoteCurrency})</th>
                    <th scope="col" className="px-4 py-3 text-right">Amount ({baseCurrency})</th>
                    <th scope="col" className="px-4 py-3 text-right">Total ({quoteCurrency})</th>
                    <th scope="col" className="px-4 py-3 text-right">Profit/Loss ({quoteCurrency})</th>
                    <th scope="col" className="px-4 py-3">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {[...trades].reverse().map((trade, index) => {
                    const originalIndex = trades.length - 1 - index;
                    const isBuy = trade.type === TradeType.BUY;
                    const profit = isBuy ? null : calculateProfit(trade, originalIndex);
                    const profitClass = profit === null ? '' : profit >= 0 ? 'text-green-400' : 'text-red-400';
                    const total = trade.price * trade.amount;

                    return (
                      <tr key={trade.id} className="border-b border-slate-700 hover:bg-slate-800/50">
                        <td className="px-4 py-3 font-mono">{new Date(trade.time).toLocaleString()}</td>
                        <td className={`px-4 py-3 font-semibold ${isBuy ? 'text-green-400' : 'text-red-400'}`}>
                          {trade.type}
                        </td>
                        <td className="px-4 py-3 font-mono text-right">{trade.price.toFixed(2)}</td>
                        <td className="px-4 py-3 font-mono text-right">{trade.amount.toFixed(6)}</td>
                        <td className="px-4 py-3 font-mono text-right">{total.toFixed(2)}</td>
                        <td className={`px-4 py-3 font-mono text-right font-bold ${profitClass}`}>
                          {profit !== null ? profit.toFixed(2) : '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-400">{trade.reason}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}