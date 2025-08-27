import { binanceClient, sentimentClient } from "../api-clients";
import type {
  DetailedMarketData,
  MarketStats,
  CandleData,
} from "../../shared/types/market-data";
import { storage } from "../storage";

export class MarketService {
  private static instance: MarketService;
  private updateInterval: ReturnType<typeof setInterval> | null = null;
  private lastUpdate: number = 0;
  private readonly UPDATE_INTERVAL = 5000; // 5 seconds

  private constructor() {
    this.startUpdates();
  }

  public static getInstance(): MarketService {
    if (!MarketService.instance) {
      MarketService.instance = new MarketService();
    }
    return MarketService.instance;
  }

  private async fetchCandleData(symbol: string): Promise<CandleData[]> {
    try {
      const response = await binanceClient.fetchKlines(symbol, "1h", 24);

      if (!response.ok) {
        throw new Error(`Failed to fetch candles for ${symbol}`);
      }

      const data = await response.json();
      return data.map((candle: any[]) => ({
        time: candle[0],
        open: parseFloat(candle[1]),
        high: parseFloat(candle[2]),
        low: parseFloat(candle[3]),
        close: parseFloat(candle[4]),
        volume: parseFloat(candle[5]),
      }));
    } catch (error) {
      console.error(`Error fetching candles for ${symbol}:`, error);
      return [];
    }
  }

  private calculateTechnicalIndicators(candles: CandleData[]) {
    if (candles.length === 0) {
      return {
        rsi: 50,
        sma20: 0,
        ema50: 0,
        macd: { value: 0, signal: 0, histogram: 0 },
      };
    }

    // Simple calculations for demo - in production use a technical analysis library
    const closes = candles.map((c) => c.close);
    const sma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const ema50 = closes.slice(-50).reduce((a, b) => a + b, 0) / 50;

    // Simplified RSI calculation
    const gains = closes
      .slice(1)
      .map((close, i) => Math.max(close - closes[i], 0));
    const losses = closes
      .slice(1)
      .map((close, i) => Math.max(closes[i] - close, 0));
    const avgGain = gains.reduce((a, b) => a + b, 0) / gains.length;
    const avgLoss = losses.reduce((a, b) => a + b, 0) / losses.length;
    const rs = avgGain / (avgLoss || 1);
    const rsi = 100 - 100 / (1 + rs);

    return {
      rsi,
      sma20,
      ema50,
      macd: {
        value: sma20 - ema50,
        signal: (sma20 - ema50) * 0.9,
        histogram: (sma20 - ema50) * 0.1,
      },
    };
  }

  private async updateMarketData() {
    try {
      const now = Date.now();
      if (now - this.lastUpdate < this.UPDATE_INTERVAL) {
        return;
      }
      this.lastUpdate = now;

      const [marketData, marketStats] = await Promise.all([
        binanceClient.getTopCryptocurrencies(),
        binanceClient.getMarketStats(),
      ]);

      // Enhance market data with additional information
      const enhancedData: DetailedMarketData[] = await Promise.all(
        marketData.map(async (coin) => {
          const candles = await this.fetchCandleData(coin.symbol);
          const technicalIndicators =
            this.calculateTechnicalIndicators(candles);
          const priceChangePercent = parseFloat(coin.priceChangePercent24h);

          const sentiment =
            priceChangePercent >= 5
              ? "bullish"
              : priceChangePercent <= -5
              ? "bearish"
              : "neutral";

          return {
            id: crypto.randomUUID(),
            ...coin,
            high24h: (parseFloat(coin.price) * 1.1).toFixed(2), // Example - replace with actual 24h high
            low24h: (parseFloat(coin.price) * 0.9).toFixed(2), // Example - replace with actual 24h low
            candles,
            sentiment,
            technicalIndicators,
            lastUpdated: new Date(),
          };
        })
      );

      // Cache the enhanced data
      await storage.setCachedMarketData(enhancedData);
      await storage.setMarketStats(marketStats);

      return {
        coins: enhancedData,
        stats: {
          ...marketStats,
          globalSentiment: this.calculateGlobalSentiment(enhancedData),
          trending: this.getTrendingSymbols(enhancedData),
        },
      };
    } catch (error) {
      console.error("Error updating market data:", error);
      throw error;
    }
  }

  private calculateGlobalSentiment(
    coins: DetailedMarketData[]
  ): "bullish" | "bearish" | "neutral" {
    const sentimentScore =
      coins.reduce((acc, coin) => {
        return acc + (parseFloat(coin.priceChangePercent24h) || 0);
      }, 0) / coins.length;

    return sentimentScore >= 3
      ? "bullish"
      : sentimentScore <= -3
      ? "bearish"
      : "neutral";
  }

  private getTrendingSymbols(coins: DetailedMarketData[]): string[] {
    return coins
      .sort(
        (a, b) =>
          Math.abs(parseFloat(b.priceChangePercent24h)) -
          Math.abs(parseFloat(a.priceChangePercent24h))
      )
      .slice(0, 3)
      .map((coin) => coin.symbol);
  }

  public async getMarketData() {
    try {
      // Try to get cached data first
      const cachedData = await storage.getCachedMarketData();
      const stats = await storage.getMarketStats();

      if (
        cachedData &&
        stats &&
        Date.now() - this.lastUpdate < this.UPDATE_INTERVAL
      ) {
        return { coins: cachedData, stats };
      }

      // If no cached data or cache is old, fetch new data
      return await this.updateMarketData();
    } catch (error) {
      console.error("Error getting market data:", error);
      throw error;
    }
  }

  private startUpdates() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    this.updateInterval = setInterval(async () => {
      try {
        await this.updateMarketData();
      } catch (error) {
        console.error("Error in market data update interval:", error);
      }
    }, this.UPDATE_INTERVAL);
  }

  public stopUpdates() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
}
