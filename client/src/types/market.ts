// Time intervals for chart data
export type TimeInterval = "1h" | "4h" | "1d";
export type TimeframeOption = "24H" | "7D" | "30D";

// Base market types
export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Indicators {
  rsi: number;
  sma20: number;
  priceChange24h: number;
  volumeChange24h: number;
}

export interface ChartData {
  symbol: string;
  interval: TimeInterval;
  candles: Candle[];
  indicators: Indicators;
  lastUpdated: string;
}

// Cryptocurrency types
export interface Coin {
  symbol: string;
  name: string;
  price: string;
  priceChangePercent24h: string;
  volume24h: string;
  marketCap: string;
  candles?: Candle[];
}

export interface MarketStats {
  totalMarketCap: string;
  totalVolume24h: string;
  btcDominance: string;
  fearGreedIndex: string;
}

export interface MarketData {
  data: {
    coins: Coin[];
    stats: MarketStats;
  };
}

// API response types
export interface MarketAPIResponse {
  success: boolean;
  data: MarketData;
  error?: string;
}

// Component prop types
export interface PriceChartProps {
  data: ChartData;
  isLoading?: boolean;
  error?: Error | null;
  onSelectCoin?: (symbol: string) => void;
}

export interface MarketSummaryProps {
  symbol: string;
  price: number;
  priceChange24h: number;
  volume24h: number;
}
