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
      // Use CoinGecko as primary source due to Binance regional restrictions
      const response = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=8&page=1&sparkline=false');
      
      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!Array.isArray(data)) {
        throw new Error('Invalid response format from CoinGecko API');
      }
      
      const topCryptos = data.map(coin => ({
        symbol: coin.symbol.toUpperCase(),
        name: coin.name,
        price: coin.current_price.toFixed(2),
        priceChange24h: coin.price_change_24h?.toFixed(2) || '0.00',
        priceChangePercent24h: coin.price_change_percentage_24h?.toFixed(2) || '0.00',
        volume24h: coin.total_volume?.toFixed(0) || '0',
        marketCap: coin.market_cap?.toFixed(0) || '0'
      }));

      console.log(`Successfully fetched ${topCryptos.length} cryptocurrencies from CoinGecko`);
      return topCryptos;
    } catch (error) {
      console.error('CoinGecko API error:', error);
      throw new Error('Failed to fetch market data from CoinGecko');
    }
  }

  async getMarketStats(): Promise<MarketStats> {
    try {
      // Use CoinGecko global data API for accurate market statistics
      const globalResponse = await fetch('https://api.coingecko.com/api/v3/global');
      
      if (!globalResponse.ok) {
        throw new Error(`CoinGecko global API error: ${globalResponse.status}`);
      }
      
      const globalData = await globalResponse.json() as any;
      const data = globalData.data;
      
      // Get Fear & Greed Index
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

      console.log('Successfully fetched market stats from CoinGecko');
      
      return {
        totalMarketCap: `$${(data.total_market_cap.usd / 1e12).toFixed(2)}T`,
        totalVolume24h: `$${(data.total_volume.usd / 1e9).toFixed(1)}B`,
        btcDominance: `${data.market_cap_percentage.btc.toFixed(1)}%`,
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

export class AIClient {
  async generateChatResponse(message: string, marketContext?: any): Promise<string> {
    try {
      // Use Hugging Face Inference API for text generation
      const response = await fetch(
        'https://api-inference.huggingface.co/models/microsoft/DialoGPT-large',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            inputs: this.buildPrompt(message, marketContext),
            parameters: {
              max_length: 200,
              temperature: 0.7,
              do_sample: true
            }
          }),
        }
      );

      if (!response.ok) {
        console.warn(`AI API error: ${response.status}, using fallback response`);
        return this.generateFallbackResponse(message, marketContext);
      }

      const result = await response.json() as any;
      
      if (Array.isArray(result) && result[0] && result[0].generated_text) {
        let aiResponse = result[0].generated_text.replace(message, '').trim();
        return aiResponse || this.generateFallbackResponse(message, marketContext);
      }
      
      return this.generateFallbackResponse(message, marketContext);
    } catch (error) {
      console.warn('AI generation error, using fallback:', error);
      return this.generateFallbackResponse(message, marketContext);
    }
  }

  private buildPrompt(message: string, marketContext?: any): string {
    let prompt = `You are a friendly crypto trading assistant. Answer crypto questions in simple terms.\n\n`;
    
    if (marketContext) {
      prompt += `Current market data:\n`;
      if (marketContext.topCoin) {
        prompt += `- ${marketContext.topCoin.name} (${marketContext.topCoin.symbol}): $${marketContext.topCoin.price} (${marketContext.topCoin.priceChangePercent24h}%)\n`;
      }
      if (marketContext.stats) {
        prompt += `- Total market cap: ${marketContext.stats.totalMarketCap}\n`;
        prompt += `- BTC dominance: ${marketContext.stats.btcDominance}\n`;
      }
      prompt += `\n`;
    }
    
    prompt += `Human: ${message}\nAssistant:`;
    return prompt;
  }

  private generateFallbackResponse(message: string, marketContext?: any): string {
    const lowerMessage = message.toLowerCase();
    
    // Bitcoin price queries
    if (lowerMessage.includes('bitcoin') || lowerMessage.includes('btc')) {
      if (marketContext?.topCoin && marketContext.topCoin.symbol === 'BTC') {
        return `Bitcoin is currently trading at $${marketContext.topCoin.price}, with a 24-hour change of ${marketContext.topCoin.priceChangePercent24h}%. Bitcoin remains the dominant cryptocurrency and often sets the trend for the broader market.`;
      }
      return "Bitcoin is the world's first and most valuable cryptocurrency. It's often considered digital gold and a store of value. Current prices can be found on the Market page.";
    }
    
    // Ethereum queries
    if (lowerMessage.includes('ethereum') || lowerMessage.includes('eth')) {
      return "Ethereum is a blockchain platform that enables smart contracts and decentralized applications (dApps). ETH is used to pay for transactions and computational services on the network.";
    }
    
    // General market queries
    if (lowerMessage.includes('market') || lowerMessage.includes('price')) {
      if (marketContext?.stats) {
        return `The crypto market is showing a total market cap of ${marketContext.stats.totalMarketCap} with Bitcoin maintaining ${marketContext.stats.btcDominance} dominance. Check the Market page for detailed price information.`;
      }
      return "The cryptocurrency market operates 24/7 and is known for its volatility. You can check current prices and market trends on the Market page.";
    }
    
    // Investment advice (avoid giving financial advice)
    if (lowerMessage.includes('invest') || lowerMessage.includes('buy') || lowerMessage.includes('sell')) {
      return "I can't provide investment advice, but I can help you understand how cryptocurrencies work. Always do your own research and never invest more than you can afford to lose.";
    }
    
    // General crypto education
    if (lowerMessage.includes('what') || lowerMessage.includes('how') || lowerMessage.includes('explain')) {
      return "Cryptocurrency is digital money secured by cryptography and blockchain technology. Each crypto has unique features and use cases. Would you like to know about a specific cryptocurrency?";
    }
    
    return "I'm here to help you understand cryptocurrency markets in simple terms. You can ask me about specific coins, market trends, or how crypto technology works!";
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
export const aiClient = new AIClient();