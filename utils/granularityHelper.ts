// Coinbase API supported granularities in seconds
export const COINBASE_GRANULARITIES = {
    ONE_MINUTE: 60,
    FIVE_MINUTES: 300,
    FIFTEEN_MINUTES: 900,
    ONE_HOUR: 3600,
    SIX_HOURS: 21600,
    ONE_DAY: 86400,
} as const;

export type GranularityValue = typeof COINBASE_GRANULARITIES[keyof typeof COINBASE_GRANULARITIES];

export interface GranularityOption {
    value: number;
    label: string;
    maxDurationDays: number; // Recommended max duration for this granularity
}

// Get human-readable label for granularity
export function getGranularityLabel(seconds: number): string {
    switch (seconds) {
        case COINBASE_GRANULARITIES.ONE_MINUTE:
            return '1 Minute';
        case COINBASE_GRANULARITIES.FIVE_MINUTES:
            return '5 Minuten';
        case COINBASE_GRANULARITIES.FIFTEEN_MINUTES:
            return '15 Minuten';
        case COINBASE_GRANULARITIES.ONE_HOUR:
            return '1 Stunde';
        case COINBASE_GRANULARITIES.SIX_HOURS:
            return '6 Stunden';
        case COINBASE_GRANULARITIES.ONE_DAY:
            return '1 Tag';
        default:
            return `${seconds}s`;
    }
}

// Get all available granularities with metadata
export function getAllGranularities(): GranularityOption[] {
    return [
        { value: COINBASE_GRANULARITIES.ONE_MINUTE, label: getGranularityLabel(COINBASE_GRANULARITIES.ONE_MINUTE), maxDurationDays: 1 },
        { value: COINBASE_GRANULARITIES.FIVE_MINUTES, label: getGranularityLabel(COINBASE_GRANULARITIES.FIVE_MINUTES), maxDurationDays: 5 },
        { value: COINBASE_GRANULARITIES.FIFTEEN_MINUTES, label: getGranularityLabel(COINBASE_GRANULARITIES.FIFTEEN_MINUTES), maxDurationDays: 15 },
        { value: COINBASE_GRANULARITIES.ONE_HOUR, label: getGranularityLabel(COINBASE_GRANULARITIES.ONE_HOUR), maxDurationDays: 60 },
        { value: COINBASE_GRANULARITIES.SIX_HOURS, label: getGranularityLabel(COINBASE_GRANULARITIES.SIX_HOURS), maxDurationDays: 180 },
        { value: COINBASE_GRANULARITIES.ONE_DAY, label: getGranularityLabel(COINBASE_GRANULARITIES.ONE_DAY), maxDurationDays: 365 },
    ];
}

// Get suitable granularities for a given time range
export function getAvailableGranularities(startDate: Date, endDate: Date): GranularityOption[] {
    const durationMs = endDate.getTime() - startDate.getTime();
    const durationDays = durationMs / (1000 * 60 * 60 * 24);

    const allGranularities = getAllGranularities();

    // Filter granularities that are suitable for this duration
    // We want to avoid too many data points (>300 per request is Coinbase limit)
    return allGranularities.filter(g => {
        const totalCandles = calculateTotalCandles(startDate, endDate, g.value);
        // Allow granularities that result in reasonable number of candles
        // and are within recommended duration
        return totalCandles <= 10000 && durationDays <= g.maxDurationDays * 1.5;
    });
}

// Get recommended granularity for a time range
export function getRecommendedGranularity(startDate: Date, endDate: Date): number {
    const durationMs = endDate.getTime() - startDate.getTime();
    const durationDays = durationMs / (1000 * 60 * 60 * 24);

    // Recommend granularity based on duration
    if (durationDays <= 1) {
        return COINBASE_GRANULARITIES.ONE_MINUTE;
    } else if (durationDays <= 7) {
        return COINBASE_GRANULARITIES.FIVE_MINUTES;
    } else if (durationDays <= 30) {
        return COINBASE_GRANULARITIES.FIFTEEN_MINUTES;
    } else if (durationDays <= 90) {
        return COINBASE_GRANULARITIES.ONE_HOUR;
    } else if (durationDays <= 180) {
        return COINBASE_GRANULARITIES.SIX_HOURS;
    } else {
        return COINBASE_GRANULARITIES.ONE_DAY;
    }
}

// Calculate total number of candles for a time range
export function calculateTotalCandles(startDate: Date, endDate: Date, granularity: number): number {
    const durationMs = endDate.getTime() - startDate.getTime();
    const granularityMs = granularity * 1000;
    return Math.ceil(durationMs / granularityMs);
}

// Calculate number of requests needed (Coinbase limit is 300 candles per request)
export function calculateRequiredRequests(startDate: Date, endDate: Date, granularity: number): number {
    const totalCandles = calculateTotalCandles(startDate, endDate, granularity);
    return Math.ceil(totalCandles / 300);
}
