import crypto from 'crypto';

const COINBASE_API_URL = 'https://api.coinbase.com/v2';
const COINBASE_EXCHANGE_API_URL = 'https://api.exchange.coinbase.com';

class CoinbaseService {
    constructor() {
        this.apiKey = '';
        this.apiSecret = '';
    }

    setCredentials(apiKey, apiSecret) {
        this.apiKey = apiKey;
        this.apiSecret = apiSecret;
    }

    generateSignature(timestamp, method, requestPath, body = '') {
        const message = timestamp + method + requestPath + body;
        const key = Buffer.from(this.apiSecret, 'base64');
        const hmac = crypto.createHmac('sha256', key);
        return hmac.update(message).digest('base64');
    }

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

    async getHistoricalData(pair, start, end, granularity) {
        try {
            const params = new URLSearchParams({
                start,
                end,
                granularity: granularity.toString(),
            });

            const response = await fetch(`${COINBASE_EXCHANGE_API_URL}/products/${pair}/candles?${params}`);
            if (!response.ok) throw new Error('Failed to fetch candles');
            const data = await response.json();

            return data.map((candle) => ({
                time: candle[0] * 1000,
                low: candle[1],
                high: candle[2],
                open: candle[3],
                close: candle[4],
                volume: candle[5],
            })).reverse();
        } catch (error) {
            console.error(`Error fetching historical data for ${pair}:`, error);
            return [];
        }
    }

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
