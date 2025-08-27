export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface DetailedMarketData {
  id: string;
  symbol: string;
  name: string;
  price: string;
  priceChange24h: string;
  priceChangePercent24h: string;
  volume24h: string;
  marketCap: string | null;
  high24h: string;
  low24h: string;
  candles: CandleData[];
  sentiment: "bullish" | "bearish" | "neutral";
  technicalIndicators: {
    rsi: number;
    sma20: number;
    ema50: number;
    macd: {
      value: number;
      signal: number;
      histogram: number;
    };
  };
  lastUpdated: Date;
}

export interface MarketStats {
  totalMarketCap: string;
  totalVolume24h: string;
  btcDominance: string;
  fearGreedIndex: number;
  globalSentiment: "bullish" | "bearish" | "neutral";
  trending: string[];
}

export interface MarketResponse {
  coins: DetailedMarketData[];
  stats: MarketStats;
}
