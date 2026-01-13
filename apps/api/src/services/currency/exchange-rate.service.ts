import { redis } from '../../lib/redis';
import axios from 'axios';

/**
 * Exchange Rate Service
 *
 * Fetches and caches currency exchange rates from a free API.
 * Supports 160+ currencies including AUD, MNT, USD, EUR, GBP, JPY.
 *
 * Free API: https://open.exchangerate-api.com (1500 requests/month)
 * Data source: European Central Bank (ECB)
 */
export class ExchangeRateService {
  private readonly API_BASE_URL = 'https://open.exchangerate-api.com/v6';
  private readonly CACHE_TTL = 24 * 60 * 60; // 24 hours in seconds
  private readonly CACHE_PREFIX = 'exchange_rates';

  /**
   * Get exchange rate from one currency to another
   * @param from - Source currency code (e.g., "MNT")
   * @param to - Target currency code (e.g., "AUD")
   * @returns Exchange rate (e.g., 0.000416 for MNT to AUD)
   */
  async getRate(from: string, to: string): Promise<number> {
    // If same currency, rate is 1
    if (from === to) {
      return 1.0;
    }

    // Get all rates for the source currency
    const rates = await this.getRates(from);

    // Return the rate for the target currency
    const rate = rates[to];
    if (!rate) {
      throw new Error(`Exchange rate not available for ${from} to ${to}`);
    }

    return rate;
  }

  /**
   * Convert an amount from one currency to another
   * @param amount - Amount to convert
   * @param from - Source currency code
   * @param to - Target currency code
   * @returns Converted amount
   */
  async convert(amount: number, from: string, to: string): Promise<number> {
    const rate = await this.getRate(from, to);
    return amount * rate;
  }

  /**
   * Get all exchange rates for a base currency
   * Caches results in Redis for 24 hours
   *
   * @param baseCurrency - Base currency code (e.g., "AUD")
   * @returns Object with currency codes as keys and rates as values
   */
  async getRates(baseCurrency: string): Promise<Record<string, number>> {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const cacheKey = `${this.CACHE_PREFIX}:${baseCurrency}:${today}`;

    try {
      // Try to get from cache first
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // If not in cache, fetch from API
      const rates = await this.fetchRatesFromAPI(baseCurrency);

      // Cache the result
      await redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(rates));

      return rates;
    } catch (error) {
      console.error(`Error fetching exchange rates for ${baseCurrency}:`, error);

      // Try to get yesterday's rates as fallback
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayCacheKey = `${this.CACHE_PREFIX}:${baseCurrency}:${yesterday.toISOString().split('T')[0]}`;

      const fallbackCached = await redis.get(yesterdayCacheKey);
      if (fallbackCached) {
        console.warn(`Using yesterday's exchange rates for ${baseCurrency} as fallback`);
        return JSON.parse(fallbackCached);
      }

      throw new Error(`Failed to fetch exchange rates for ${baseCurrency} and no cached rates available`);
    }
  }

  /**
   * Fetch exchange rates from the API
   * @private
   */
  private async fetchRatesFromAPI(baseCurrency: string): Promise<Record<string, number>> {
    const response = await axios.get(`${this.API_BASE_URL}/latest/${baseCurrency}`, {
      timeout: 5000, // 5 second timeout
    });

    if (!response.data || !response.data.rates) {
      throw new Error('Invalid response from exchange rate API');
    }

    return response.data.rates;
  }

  /**
   * Refresh exchange rates for all supported currencies
   * This can be called by a cron job
   */
  async refreshRates(): Promise<void> {
    const supportedCurrencies = ['AUD', 'MNT', 'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'KRW', 'THB', 'VND'];

    console.log('Starting exchange rate refresh...');

    for (const currency of supportedCurrencies) {
      try {
        // This will fetch and cache the rates
        await this.getRates(currency);
        console.log(`✓ Refreshed rates for ${currency}`);
      } catch (error) {
        console.error(`✗ Failed to refresh rates for ${currency}:`, error);
      }
    }

    console.log('Exchange rate refresh complete');
  }

  /**
   * Get cached rates info (for debugging)
   * @param baseCurrency - Base currency code
   * @returns Cache info including age and data
   */
  async getCacheInfo(baseCurrency: string): Promise<{ cached: boolean; age?: string; rates?: Record<string, number> }> {
    const today = new Date().toISOString().split('T')[0];
    const cacheKey = `${this.CACHE_PREFIX}:${baseCurrency}:${today}`;

    const cached = await redis.get(cacheKey);
    if (!cached) {
      return { cached: false };
    }

    const ttl = await redis.ttl(cacheKey);
    const ageHours = Math.floor((this.CACHE_TTL - ttl) / 3600);

    return {
      cached: true,
      age: `${ageHours} hours ago`,
      rates: JSON.parse(cached),
    };
  }

  /**
   * Convert multiple amounts with different currencies to a single target currency
   * Useful for budget totals
   *
   * @param amounts - Array of { amount, currency } objects
   * @param targetCurrency - Target currency to convert to
   * @returns Total amount in target currency
   */
  async convertMultiple(
    amounts: Array<{ amount: number; currency: string }>,
    targetCurrency: string
  ): Promise<number> {
    let total = 0;

    for (const item of amounts) {
      const converted = await this.convert(item.amount, item.currency, targetCurrency);
      total += converted;
    }

    return total;
  }

  /**
   * Get conversion details for display purposes
   * Returns both the converted amount and the exchange rate used
   *
   * @param amount - Amount to convert
   * @param from - Source currency
   * @param to - Target currency
   * @returns Object with convertedAmount and exchangeRate
   */
  async getConversionDetails(
    amount: number,
    from: string,
    to: string
  ): Promise<{ convertedAmount: number; exchangeRate: number }> {
    const exchangeRate = await this.getRate(from, to);
    const convertedAmount = amount * exchangeRate;

    return {
      convertedAmount,
      exchangeRate,
    };
  }
}

// Export a singleton instance
export const exchangeRateService = new ExchangeRateService();
