/**
 * Coinbase Service
 * Handles communication with Coinbase API for price data and order execution
 */
import crypto from 'crypto';

const COINBASE_API_URL = 'https://api.coinbase.com/v2';
const COINBASE_EXCHANGE_API_URL = 'https://api.exchange.coinbase.com';

/**
 * Coinbase API Service Class
 */
class CoinbaseService {
    constructor() {
        this.apiKey = '';
        this.apiSecret = '';
    }

    /**
     * Set API credentials
     * @param {string} apiKey - Coinbase API key
     * @param {string} apiSecret - Coinbase API secret
     */
    setCredentials(apiKey, apiSecret) {
        this.apiKey = apiKey;
        this.apiSecret = apiSecret;
    }

    /**
     * Generate HMAC signature for authenticated requests
     * @param {string} timestamp - Request timestamp
     * @param {string} method - HTTP method
     * @param {string} requestPath - API endpoint path
     * @param {string} body - Request body
     * @returns {string} Base64 encoded signature
     */
    generateSignature(timestamp, method, requestPath, body = '') {
        const message = timestamp + method + requestPath + body;
        const key = Buffer.from(this.apiSecret, 'base64');
        const hmac = crypto.createHmac('sha256', key);
        return hmac.update(message).digest('base64');
    }

    /**
     * Make authenticated request to Coinbase API
     * @param {string} method - HTTP method
     * @param {string} path - API endpoint path
     * @param {Object|null} body - Request body
     * @returns {Promise<Object>} API response
     */
    async authenticatedRequest(method, path, body = null) {
        if (!this.apiKey || !this.apiSecret) {
            throw new Error('API credentials not set');
        }

        const timestamp = (Date.now() / 1000).toString();
        const requestPath = path;
        const bodyString = body ? JSON.stringify(body) : '';
        const signature = this.generateSignature(timestamp, method, requestPath, bodyString);

        const headers = {
            'Content-Type': 'application/json',
            'CB-ACCESS-KEY': this.apiKey,
            'CB-ACCESS-SIGN': signature,
            'CB-ACCESS-TIMESTAMP': timestamp,
            'CB-ACCESS-PASSPHRASE': this.apiSecret,
            'User-Agent': 'Astibot',
        };

        const url = `${COINBASE_EXCHANGE_API_URL}${path}`;
        const response = await fetch(url, {
            method,
            headers,
            body: body ? bodyString : undefined,
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Coinbase API Error: ${response.status} ${text}`);
        }

        return response.json();
    }

    /**
     * Get available trading products
     * @returns {Promise<Array>} List of trading products
     */
    async getProducts() {
        try {
            const response = await fetch(`${COINBASE_EXCHANGE_API_URL}/products`);
            if (!response.ok) throw new Error('Failed to fetch products');
            const products = await response.json();
            return products.filter((p) => p.quote_currency === 'USD' || p.quote_currency === 'USDC');
        } catch (error) {
            console.error('Error fetching products:', error);
            return [];
        }
    }

    /**
     * Get current spot price for a trading pair
     * @param {string} pair - Trading pair (e.g., 'BTC-USD')
     * @returns {Promise<number>} Current price
     */
    async getPrice(pair) {
        try {
            const response = await fetch(`${COINBASE_API_URL}/prices/${pair}/spot`);
            if (!response.ok) throw new Error('Failed to fetch price');
            const data = await response.json();
            return parseFloat(data.data.amount);
        } catch (error) {
            console.error(`Error fetching price for ${pair}:`, error);
            throw error;
        }
    }

    /**
     * Get historical candle data
     * Handles pagination automatically for ranges exceeding 300 candles
     * @param {string} pair - Trading pair
     * @param {string} start - Start time (ISO 8601)
     * @param {string} end - End time (ISO 8601)
     * @param {number} granularity - Candle granularity in seconds
     * @returns {Promise<Array>} Historical candle data
     */
    async getHistoricalData(pair, start, end, granularity) {
        try {
            const startDate = new Date(start);
            const endDate = new Date(end);
            const allCandles = [];

            // Coinbase limit is 300 candles per request
            const maxCandlesPerRequest = 300;
            const chunkDurationMs = maxCandlesPerRequest * granularity * 1000;

            let currentStart = startDate;

            while (currentStart < endDate) {
                const currentEnd = new Date(Math.min(endDate.getTime(), currentStart.getTime() + chunkDurationMs));

                const params = new URLSearchParams({
                    start: currentStart.toISOString(),
                    end: currentEnd.toISOString(),
                    granularity: granularity.toString(),
                });

                const response = await fetch(`${COINBASE_EXCHANGE_API_URL}/products/${pair}/candles?${params}`);

                if (!response.ok) {
                    const text = await response.text();
                    console.error(`Failed to fetch chunk: ${response.status} ${text}`);
                    // If we have some data, return what we have instead of failing completely? 
                    // Or throw? Let's log and continue if possible, or break.
                    // For now, let's throw to indicate failure.
                    throw new Error(`Failed to fetch candles: ${response.status} ${text}`);
                }

                const chunk = await response.json();
                if (Array.isArray(chunk)) {
                    allCandles.push(...chunk);
                }

                // Move to next chunk
                currentStart = new Date(currentEnd.getTime());

                // Rate limiting protection
                await new Promise(resolve => setTimeout(resolve, 200));
            }

            // Deduplicate and sort
            // Coinbase returns [time, low, high, open, close, volume]
            const uniqueCandles = [...new Map(allCandles.map(item => [item[0], item])).values()];

            return uniqueCandles.map((candle) => ({
                time: candle[0] * 1000,
                low: candle[1],
                high: candle[2],
                open: candle[3],
                close: candle[4],
                volume: candle[5],
            })).sort((a, b) => a.time - b.time);

        } catch (error) {
            console.error(`Error fetching historical data for ${pair}:`, error);
            return [];
        }
    }

    /**
     * Place a market order
     * @param {string} pair - Trading pair
     * @param {string} side - Order side ('buy' or 'sell')
     * @param {string} size - Order size
     * @returns {Promise<Object>} Order response
     */
    async placeOrder(pair, side, size) {
        return this.authenticatedRequest('POST', '/orders', {
            product_id: pair,
            side,
            type: 'market',
            size,
        });
    }
}

export const coinbaseService = new CoinbaseService();
