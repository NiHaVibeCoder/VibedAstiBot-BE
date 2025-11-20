import React from 'react';
import type { InfoPanelProps } from '../types';

function InfoPanelComponent({ account, currentPrice, profit, tradingPair, backtestData, tradingMode }: InfoPanelProps): React.ReactElement {
  const [baseCurrency, quoteCurrency] = tradingPair.split('-');
  const profitClass = profit >= 0 ? 'text-green-400' : 'text-red-400';

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString();

  const modeLabel = tradingMode === 'live' ? '(Echthandel)' : '(Simulation)';

  const modeDisplay = backtestData ? (
    <p className="text-xs text-green-400" title={`Historische Daten von ${backtestData.start} bis ${backtestData.end}`}>
      Backtest-Modus: {formatDate(backtestData.start)} - {formatDate(backtestData.end)}
    </p>
  ) : (
    <p className="text-xs text-slate-500">Modus: {tradingMode === 'live' ? 'Echthandel (Simuliert)' : 'Live-Simulation'}</p>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center text-sm">
      <div>
        <p>{quoteCurrency} Kontostand: <span className="font-mono text-white">{account.quote.toFixed(2)} {quoteCurrency} {modeLabel}</span></p>
        <p>{baseCurrency} Kontostand: <span className="font-mono text-white">{account.base.toFixed(6)} {baseCurrency} {modeLabel}</span></p>
        <p className={`font-bold ${profitClass}`}>Gesamtgewinn: {profit.toFixed(2)} {quoteCurrency} {modeLabel}</p>
      </div>
      <div className="text-left md:text-right">
        {modeDisplay}
        <p className="text-slate-400">{baseCurrency} MiddleMarket Preis: <span className="font-mono text-white text-lg">{currentPrice.toFixed(2)} {quoteCurrency}</span></p>
      </div>
    </div>
  );
}

export default React.memo(InfoPanelComponent);