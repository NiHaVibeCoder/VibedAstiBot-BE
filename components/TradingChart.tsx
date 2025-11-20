import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceDot,
} from 'recharts';
import type { ChartDataPoint, Trade } from '../types';
import { TradeType } from '../types';

interface TradingChartProps {
  data: ChartDataPoint[];
  trades: Trade[];
}

const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const dataPoint = payload[0].payload;
    return (
      <div className="bg-slate-800/80 p-3 rounded-md border border-slate-600 text-sm backdrop-blur-sm">
        <p className="label text-slate-400">{`Time: ${new Date(label).toLocaleTimeString()}`}</p>
        <p className="text-slate-200">{`Price: ${dataPoint.price?.toFixed(2)}`}</p>
        {dataPoint.fastMA && <p className="text-blue-400">{`Fast MA: ${dataPoint.fastMA.toFixed(2)}`}</p>}
        {dataPoint.slowMA && <p className="text-orange-500">{`Slow MA: ${dataPoint.slowMA.toFixed(2)}`}</p>}
        {dataPoint.riskLine && <p className="text-red-400">{`Risk Line: ${dataPoint.riskLine.toFixed(2)}`}</p>}
      </div>
    );
  }
  return null;
};

function TradingChartComponent({ data, trades }: TradingChartProps): React.ReactElement {
  const safeData = Array.isArray(data) ? data : [];
  const safeTrades = Array.isArray(trades) ? trades : [];

  const yDomain = safeData.length > 0
    ? [Math.min(...safeData.map(p => p.price || 0)) * 0.98, Math.max(...safeData.map(p => p.price || 0)) * 1.02]
    : [0, 100];

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={safeData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis
          dataKey="time"
          tickFormatter={(time) => new Date(time).toLocaleTimeString()}
          stroke="#94A3B8"
          tick={{ fontSize: 12 }}
        />
        <YAxis
          stroke="#94A3B8"
          tick={{ fontSize: 12 }}
          domain={yDomain}
          allowDataOverflow={true}
          tickFormatter={(value) => typeof value === 'number' ? value.toFixed(2) : ''}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: "14px", bottom: -10 }} />
        <Line type="monotone" dataKey="price" stroke="#E2E8F0" dot={false} strokeWidth={2} name="Price" isAnimationActive={false} />
        <Line type="monotone" dataKey="fastMA" stroke="#60A5FA" dot={false} strokeWidth={1.5} name="Fast MA (Blue)" isAnimationActive={false} />
        <Line type="monotone" dataKey="slowMA" stroke="#F97316" dot={false} strokeWidth={1.5} name="Slow MA (Orange)" isAnimationActive={false} />
        <Line type="monotone" dataKey="riskLine" stroke="#F87171" dot={false} strokeDasharray="5 5" name="Risk Line" isAnimationActive={false} />
        {safeTrades.map((trade) => (
          <ReferenceDot
            key={trade.id}
            x={trade.time}
            y={trade.price}
            r={6}
            fill={trade.type === TradeType.BUY ? '#22C55E' : '#EF4444'}
            stroke="#1E293B"
            strokeWidth={2}
            isFront={true}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export default React.memo(TradingChartComponent);