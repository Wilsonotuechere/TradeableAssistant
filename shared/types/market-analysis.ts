export interface MarketAnalysis {
  coin: {
    name: string;
    symbol: string;
    price: number;
    priceChange24h: number;
    volume24h: number;
    marketCap: number;
  };
  technicalAnalysis: {
    rsi: number;
    macd: {
      value: number;
      signal: number;
      histogram: number;
    };
    movingAverages: {
      sma20: number;
      sma50: number;
      sma200: number;
    };
  };
}

export interface NewsAnalysis {
  overallSentiment: {
    label: string;
    confidence: number;
  };
  articles: Array<{
    title: string;
    sentiment: string;
    impact: number;
  }>;
}

export interface SocialAnalysis {
  overallSentiment: {
    label: string;
    confidence: number;
  };
  trending: Array<{
    topic: string;
    mentions: number;
    sentiment: string;
  }>;
}
