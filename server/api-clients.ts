import fetch from 'node-fetch';
import type { MarketData, NewsArticle, SentimentData, MarketStats } from "@shared/schema";

const BINANCE_API_KEY = process.env.BINANCE_API_KEY;
const BINANCE_API_SECRET = process.env.BINANCE_API_SECRET;
const NEWS_API_KEY = process.env.NEWS_API_KEY;
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;
const TWITTER_BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN;

export class BinanceClient {
  private baseUrl = 'https://api.binance.com/api/v3';

  async getTopCryptocurrencies(): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseUrl}/ticker/24hr`);
      
      if (!response.ok) {
        throw new Error(`Binance API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!Array.isArray(data)) {
        console.error('Binance API returned non-array data:', typeof data);
        throw new Error('Invalid response format from Binance API');
      }
      
      // Get top cryptocurrencies by volume (USDT pairs)
      const usdtPairs = data.filter(coin => 
        coin.symbol && coin.symbol.endsWith('USDT') && 
        parseFloat(coin.volume) > 0
      );
      
      const topCryptos = usdtPairs
        .sort((a, b) => parseFloat(b.volume) - parseFloat(a.volume))
        .slice(0, 8)
        .map(coin => {
          const symbol = coin.symbol.replace('USDT', '');
          return {
            symbol,
            name: this.getSymbolName(symbol),
            price: parseFloat(coin.lastPrice).toFixed(2),
            priceChange24h: parseFloat(coin.priceChange).toFixed(2),
            priceChangePercent24h: parseFloat(coin.priceChangePercent).toFixed(2),
            volume24h: parseFloat(coin.volume).toFixed(0),
            marketCap: (parseFloat(coin.lastPrice) * parseFloat(coin.volume)).toFixed(0)
          };
        });

      console.log(`Successfully fetched ${topCryptos.length} cryptocurrencies from Binance`);
      return topCryptos;
    } catch (error) {
      console.error('Binance API error:', error);
      throw new Error('Failed to fetch market data from Binance');
    }
  }

  async getMarketStats(): Promise<MarketStats> {
    try {
      // Get BTC price
      const btcResponse = await fetch(`${this.baseUrl}/ticker/price?symbol=BTCUSDT`);
      if (!btcResponse.ok) {
        throw new Error(`BTC price API error: ${btcResponse.status}`);
      }
      const btcData = await btcResponse.json();
      
      // Get 24hr stats for major coins
      const statsResponse = await fetch(`${this.baseUrl}/ticker/24hr`);
      if (!statsResponse.ok) {
        throw new Error(`24hr stats API error: ${statsResponse.status}`);
      }
      const statsData = await statsResponse.json();
      
      if (!Array.isArray(statsData)) {
        throw new Error('Invalid stats data format');
      }
      
      // Calculate total volume for USDT pairs
      const usdtPairs = statsData.filter(coin => 
        coin.symbol && coin.symbol.endsWith('USDT')
      );
      
      const totalVolume = usdtPairs.reduce((sum, coin) => {
        const volume = parseFloat(coin.volume) || 0;
        const price = parseFloat(coin.lastPrice) || 0;
        return sum + (volume * price);
      }, 0);

      // Get Fear & Greed Index from alternative API
      let fearGreedIndex = 65; // Default
      try {
        const fearGreedResponse = await fetch('https://api.alternative.me/fng/');
        if (fearGreedResponse.ok) {
          const fearGreedData = await fearGreedResponse.json() as any;
          if (fearGreedData.data && fearGreedData.data[0]) {
            fearGreedIndex = parseInt(fearGreedData.data[0].value);
          }
        }
      } catch (fgError) {
        console.warn('Fear & Greed API unavailable, using default');
      }

      // Market cap estimation (simplified)
      const estimatedMarketCap = totalVolume * 45; // Conservative multiplier
      const btcPrice = parseFloat((btcData as any).price);
      const btcSupply = 19700000; // Approximate circulating supply
      const btcMarketCap = btcPrice * btcSupply;
      const btcDominance = ((btcMarketCap / estimatedMarketCap) * 100).toFixed(1);

      console.log('Successfully calculated market stats from Binance data');
      
      return {
        totalMarketCap: `$${(estimatedMarketCap / 1e12).toFixed(2)}T`,
        totalVolume24h: `$${(totalVolume / 1e9).toFixed(1)}B`,
        btcDominance: `${btcDominance}%`,
        fearGreedIndex
      };
    } catch (error) {
      console.error('Market stats error:', error);
      throw new Error('Failed to fetch market statistics');
    }
  }

  private getSymbolName(symbol: string): string {
    const names: Record<string, string> = {
      'BTC': 'Bitcoin',
      'ETH': 'Ethereum',
      'BNB': 'BNB',
      'XRP': 'XRP',
      'SOL': 'Solana',
      'ADA': 'Cardano',
      'DOGE': 'Dogecoin',
      'AVAX': 'Avalanche',
      'DOT': 'Polkadot',
      'MATIC': 'Polygon'
    };
    return names[symbol] || symbol;
  }
}

export class NewsClient {
  private baseUrl = 'https://newsapi.org/v2';

  async getCryptoNews(): Promise<any[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/everything?q=cryptocurrency OR bitcoin OR ethereum&language=en&sortBy=publishedAt&pageSize=20&apiKey=${NEWS_API_KEY}`
      );
      
      if (!response.ok) {
        throw new Error(`News API error: ${response.status}`);
      }
      
      const data = await response.json() as any;
      
      return data.articles.map((article: any) => ({
        title: article.title,
        content: article.description || article.content || '',
        source: article.source.name,
        imageUrl: article.urlToImage,
        publishedAt: new Date(article.publishedAt),
        url: article.url
      }));
    } catch (error) {
      console.error('News API error:', error);
      throw new Error('Failed to fetch news data');
    }
  }
}

export class SentimentClient {
  async analyzeSentiment(text: string): Promise<'positive' | 'neutral' | 'negative'> {
    try {
      const response = await fetch(
        'https://api-inference.huggingface.co/models/distilbert-base-uncased-finetuned-sst-2-english',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ inputs: text.slice(0, 500) }), // Limit text length
        }
      );

      if (!response.ok) {
        console.warn(`Sentiment API error: ${response.status}, falling back to basic analysis`);
        return this.basicSentimentAnalysis(text);
      }

      const result = await response.json() as any;
      
      if (Array.isArray(result) && result[0] && Array.isArray(result[0])) {
        const sentiments = result[0];
        const positive = sentiments.find((s: any) => s.label === 'POSITIVE');
        const negative = sentiments.find((s: any) => s.label === 'NEGATIVE');
        
        if (positive && negative) {
          return positive.score > negative.score ? 'positive' : 'negative';
        }
      }
      
      return this.basicSentimentAnalysis(text);
    } catch (error) {
      console.warn('Sentiment analysis error, using basic analysis:', error);
      return this.basicSentimentAnalysis(text);
    }
  }

  private basicSentimentAnalysis(text: string): 'positive' | 'neutral' | 'negative' {
    const positiveWords = ['rise', 'bull', 'gain', 'up', 'high', 'surge', 'pump', 'moon', 'rally', 'green', 'profit', 'buy'];
    const negativeWords = ['fall', 'bear', 'drop', 'down', 'low', 'crash', 'dump', 'red', 'loss', 'sell', 'decline'];
    
    const lowerText = text.toLowerCase();
    const positiveCount = positiveWords.filter(word => lowerText.includes(word)).length;
    const negativeCount = negativeWords.filter(word => lowerText.includes(word)).length;
    
    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  async calculateOverallSentiment(articles: any[]): Promise<SentimentData> {
    try {
      const sentiments = await Promise.all(
        articles.slice(0, 10).map(article => 
          this.analyzeSentiment(article.title + ' ' + article.content)
        )
      );

      const positive = sentiments.filter(s => s === 'positive').length;
      const neutral = sentiments.filter(s => s === 'neutral').length;
      const negative = sentiments.filter(s => s === 'negative').length;
      const total = sentiments.length;

      return {
        positive: Math.round((positive / total) * 100),
        neutral: Math.round((neutral / total) * 100),
        negative: Math.round((negative / total) * 100),
        mood: positive > negative ? 'bullish' : negative > positive ? 'bearish' : 'neutral'
      };
    } catch (error) {
      console.error('Overall sentiment calculation error:', error);
      // Return default sentiment on error
      return {
        positive: 60,
        neutral: 30,
        negative: 10,
        mood: 'bullish'
      };
    }
  }
}

export class TwitterClient {
  async getTrendingCryptoTopics(): Promise<any[]> {
    try {
      // Due to Twitter API v2 limitations, we'll return mock trending data
      // In production, you'd implement proper Twitter API v2 endpoints
      return [
        { topic: 'Bitcoin', mentions: 34200, sentiment: 'positive' },
        { topic: 'Ethereum', mentions: 18700, sentiment: 'positive' },
        { topic: 'DeFi', mentions: 9300, sentiment: 'neutral' }
      ];
    } catch (error) {
      console.error('Twitter API error:', error);
      return [];
    }
  }
}

// Initialize clients
export const binanceClient = new BinanceClient();
export const newsClient = new NewsClient();
export const sentimentClient = new SentimentClient();
export const twitterClient = new TwitterClient();