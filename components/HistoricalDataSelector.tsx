import React, { useState } from 'react';
import type { ChartDataPoint } from '../types';

interface HistoricalDataSelectorProps {
    tradingPair: string;
    onHistoricalDataLoaded: (data: ChartDataPoint[], start: string, end: string) => void;
    onClose: () => void;
}

export default function HistoricalDataSelector({ tradingPair, onHistoricalDataLoaded, onClose }: HistoricalDataSelectorProps): React.ReactElement {
    const formatDate = (date: Date) => date.toISOString().split('T')[0];

    const getInitialStartDate = () => {
        const date = new Date();
        date.setDate(date.getDate() - 7);
        return formatDate(date);
    };

    const [startDate, setStartDate] = useState(getInitialStartDate);
    const [endDate, setEndDate] = useState(formatDate(new Date()));
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [activePreset, setActivePreset] = useState<string | null>('1 Woche');

    const setDateRange = (unit: 'week' | 'month' | 'year', amount: number, label: string) => {
        const newEndDate = new Date();
        const newStartDate = new Date();

        switch (unit) {
            case 'week':
                newStartDate.setDate(newEndDate.getDate() - (amount * 7));
                break;
            case 'month':
                newStartDate.setMonth(newEndDate.getMonth() - amount);
                break;
            case 'year':
                newStartDate.setFullYear(newEndDate.getFullYear() - amount);
                break;
        }

        setStartDate(formatDate(newStartDate));
        setEndDate(formatDate(newEndDate));
        setActivePreset(label);
    };

    const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setStartDate(e.target.value);
        setActivePreset(null);
    };

    const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setEndDate(e.target.value);
        setActivePreset(null);
    };

    const handleLoadData = async () => {
        setIsLoadingData(true);
        setProgress(0);
        setError(null);

        try {
            // Use backend proxy to avoid CORS and ensure consistent data fetching
            const url = `/api/candles/${tradingPair}?granularity=3600&start=${new Date(startDate).toISOString()}&end=${new Date(endDate).toISOString()}`;

            const response = await fetch(url);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Server Error: ${response.status} ${errorText}`);
            }

            const candles = await response.json();

            if (!Array.isArray(candles) || candles.length === 0) {
                setError("No historical data found for the selected range.");
            } else {
                // Backend returns data in correct format: { time, low, high, open, close, volume }
                // We need to map it to ChartDataPoint format
                const formattedData: ChartDataPoint[] = candles.map((c: any) => ({
                    time: c.time,
                    price: c.close,
                }));

                onHistoricalDataLoaded(formattedData, startDate, endDate);
                onClose();
            }

        } catch (e) {
            const finalError = e instanceof Error ? e.message : 'An unknown error occurred.';
            setError(`Failed to load data: ${finalError}`);
            console.error(e);
        } finally {
            setIsLoadingData(false);
        }
    };

    const presetButtons = [
        { label: '1 Woche', onClick: () => setDateRange('week', 1, '1 Woche') },
        { label: '1 Monat', onClick: () => setDateRange('month', 1, '1 Monat') },
        { label: '3 Monate', onClick: () => setDateRange('month', 3, '3 Monate') },
        { label: '6 Monate', onClick: () => setDateRange('month', 6, '6 Monate') },
        { label: '1 Jahr', onClick: () => setDateRange('year', 1, '1 Jahr') },
    ];

    return (
        <div>
            <h3 className="text-lg font-semibold text-white mb-4">Historical Data Range</h3>
            <p className="text-sm text-slate-400 mb-4">Select a time range to fetch 1-hour historical data for backtesting your strategy.</p>

            <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                    {presetButtons.map(({ label, onClick }) => (
                        <button
                            key={label}
                            onClick={onClick}
                            className={`px-3 py-1 rounded-md text-sm font-semibold transition ${activePreset === label
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-700 hover:bg-slate-600'
                                }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                        <label htmlFor="startDate" className="block text-sm font-medium text-slate-300 mb-1">Start Date</label>
                        <input
                            type="date"
                            id="startDate"
                            value={startDate}
                            onChange={handleStartDateChange}
                            className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                    </div>
                    <div className="flex-1">
                        <label htmlFor="endDate" className="block text-sm font-medium text-slate-300 mb-1">End Date</label>
                        <input
                            type="date"
                            id="endDate"
                            value={endDate}
                            onChange={handleEndDateChange}
                            className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                    </div>
                </div>
                <div className="pt-2 flex items-center gap-4">
                    <button
                        onClick={handleLoadData}
                        disabled={isLoadingData}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-sm font-semibold transition w-full sm:w-auto disabled:bg-slate-500 disabled:cursor-not-allowed"
                    >
                        {isLoadingData ? 'Loading...' : 'Load Historical Data'}
                    </button>
                    {isLoadingData && (
                        <div className="flex-grow flex items-center gap-2">
                            <div className="w-full bg-slate-700 rounded-full h-2.5 overflow-hidden">
                                <div className="bg-blue-500 h-2.5 rounded-full transition-all duration-150 ease-linear" style={{ width: `${Math.min(progress, 100)}%` }}></div>
                            </div>
                            <span className="text-sm font-mono text-slate-400 w-12 text-right">{Math.min(Math.floor(progress), 100)}%</span>
                        </div>
                    )}
                </div>
                {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
            </div>
        </div>
    );
};