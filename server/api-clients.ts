import type {
  MarketData,
  NewsArticle,
  SentimentData,
  MarketStats,
} from "../shared/schema";
import { MarketAnalysis } from "../shared/types/market-analysis";
import {
  SentimentResult,
  KeywordSentimentResult,
  type SentimentLabel,
} from "../shared/types/sentiment";
import {
  analyzeSentiment,
  analyzeMultipleTexts,
} from "../shared/utils/sentiment";
import env from "./env";
import { MultiModelAIService } from "./services/multi-model-ai-service";

// Use global fetch API instead of node-fetch
const fetch = globalThis.fetch;

// Helper function for fetch with timeout and retry
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  retries = 3
) {
  const timeout = 15000; // Reduced to 15 seconds for faster feedback
  const maxTimeout = 30000; // Maximum timeout for later retries

  for (let i = 0; i < retries; i++) {
    const controller = new AbortController();
    // Increase timeout for each retry
    const currentTimeout = Math.min(timeout * (i + 1), maxTimeout);

    const timeoutId = setTimeout(() => {
      console.log(`Request timeout after ${currentTimeout}ms for ${url}`);
      controller.abort();
    }, currentTimeout);

    const fetchOptions = {
      ...options,
      signal: controller.signal,
      // Add cache control headers to prevent stale responses
      headers: {
        ...options.headers,
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    };

    try {
      console.log(`Fetch attempt ${i + 1}/${retries} for ${url}`);
      console.log("Request headers:", fetchOptions.headers);

      const response = (await Promise.race([
        fetch(url, fetchOptions),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Manual timeout")), currentTimeout)
        ),
      ])) as Response;

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Verify the response is valid JSON
      const contentType = response.headers.get("content-type");
      if (!contentType?.includes("application/json")) {
        throw new Error("Invalid response format: expected JSON");
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      console.error(`Attempt ${i + 1} failed for ${url}:`, error);

      if (i === retries - 1) {
        // On final retry, throw a more specific error
        if (error instanceof Error) {
          if (error.message.includes("timeout")) {
            throw new Error(
              `Service timeout: ${url} is not responding in time`
            );
          }
          throw new Error(`Service error: ${error.message}`);
        }
        throw error;
      }

      // Exponential backoff with jitter
      const baseWait = Math.min(Math.pow(2, i) * 2000, 10000); // 2s, 4s, 8s, max 10s
      const jitter = Math.random() * 1000; // Add up to 1s of random jitter
      const waitTime = baseWait + jitter;
      console.log(`Waiting ${waitTime}ms before retry...`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }

  throw new Error("All fetch attempts failed");
}

// Need to explicitly declare process for TypeScript in ESM
declare const process: {
  env: {
    [key: string]: string | undefined;
  };
};

const BINANCE_API_KEY = env.BINANCE_API_KEY;
const BINANCE_API_SECRET = env.BINANCE_API_SECRET;
const NEWS_API_KEY = env.NEWS_API_KEY;
const HUGGINGFACE_API_KEY = env.HUGGINGFACE_API_KEY;
const TWITTER_BEARER_TOKEN = env.TWITTER_BEARER_TOKEN;
const GEMINI_API_KEY = env.GEMINI_API_KEY;

// Individual API key validators (throw if missing or obviously invalid)
function assertApiKey(name: string, value: string | undefined) {
  if (!value || value === "your_session_secret_here" || value.length < 8) {
    throw new Error(`Environment variable ${name} is missing or invalid.`);
  }
}

// Validate all required API keys
console.log("Validating API keys...");

try {
  assertApiKey("BINANCE_API_KEY", BINANCE_API_KEY);
  assertApiKey("BINANCE_API_SECRET", BINANCE_API_SECRET);
  console.log("✓ Binance API keys validated successfully");
} catch (error) {
  console.error("❌ Binance API key validation failed:", error);
  throw error;
}

assertApiKey("NEWS_API_KEY", NEWS_API_KEY);
assertApiKey("HUGGINGFACE_API_KEY", HUGGINGFACE_API_KEY);
assertApiKey("TWITTER_BEARER_TOKEN", TWITTER_BEARER_TOKEN);
assertApiKey("GEMINI_API_KEY", GEMINI_API_KEY);

export interface CryptoMarketData {
  symbol: string;
  name: string;
  price: string;
  priceChange24h: string;
  priceChangePercent24h: string;
  volume24h: string;
  marketCap: string;
}

export class BinanceClient {
  private baseUrl = "https://api.binance.com/api/v3";
  private apiKey = BINANCE_API_KEY;
  private apiSecret = BINANCE_API_SECRET;

  public async fetchKlines(
    symbol: string,
    interval: string = "1h",
    limit: number = 24
  ): Promise<Response> {
    const fullSymbol = symbol.endsWith("USDT") ? symbol : `${symbol}USDT`;
    const options: RequestInit = {};
    if (this.apiKey) {
      options.headers = { "X-MBX-APIKEY": this.apiKey };
    }
    return fetchWithTimeout(
      `${this.baseUrl}/klines?symbol=${fullSymbol}&interval=${interval}&limit=${limit}`,
      options
    );
  }

  public hasApiKey(): boolean {
    return (
      Boolean(this.apiKey) &&
      typeof this.apiKey === "string" &&
      this.apiKey.length > 0
    );
  }

  private async fetchWithFallback<T>(
    fetchPromise: Promise<T>,
    fallbackData: T,
    context: string
  ): Promise<T> {
    try {
      return await Promise.race([
        fetchPromise,
        new Promise<T>((_, reject) =>
          setTimeout(() => reject(new Error("Operation timed out")), 20000)
        ),
      ]);
    } catch (error) {
      console.warn(`${context} - Using fallback data:`, error);
      return fallbackData;
    }
  }

  async getTopCryptocurrencies(): Promise<CryptoMarketData[]> {
    try {
      console.log("Binance Client: Fetching top cryptocurrencies...");
      // Get ticker data for all USDT pairs
      if (!this.apiKey) {
        console.error("Binance Client: API key is missing");
        throw new Error("Binance API key is required");
      }

      const headers: HeadersInit = {
        "X-MBX-APIKEY": this.apiKey,
        Accept: "application/json",
        "Content-Type": "application/json",
      };

      console.log("Using Binance API with valid API key");

      const [tickerResponse, priceResponse] = await Promise.all([
        fetchWithTimeout(`${this.baseUrl}/ticker/24hr`, {
          headers,
        }),
        fetchWithTimeout(`${this.baseUrl}/ticker/price`, {
          headers,
        }),
      ]);

      const tickerData = await tickerResponse.json();
      const priceData = await priceResponse.json();

      if (!Array.isArray(tickerData) || !Array.isArray(priceData)) {
        throw new Error("Invalid response format from Binance API");
      }

      // Filter for USDT pairs and combine data
      const usdtPairs = tickerData
        .filter((ticker: any) => ticker.symbol.endsWith("USDT"))
        .map((ticker: any) => {
          const priceTicker = priceData.find(
            (p: any) => p.symbol === ticker.symbol
          );
          const baseSymbol = ticker.symbol.replace("USDT", "");

          return {
            symbol: baseSymbol,
            name: this.getSymbolName(baseSymbol),
            price: parseFloat(ticker.lastPrice).toFixed(2),
            priceChange24h: parseFloat(ticker.priceChange).toFixed(2),
            priceChangePercent24h: parseFloat(
              ticker.priceChangePercent
            ).toFixed(2),
            volume24h: (
              parseFloat(ticker.volume) * parseFloat(ticker.lastPrice)
            ).toFixed(0),
            marketCap: "0", // Binance doesn't provide market cap directly
          };
        });

      // Sort by volume and get top 8
      const topCryptos = usdtPairs
        .sort((a, b) => parseFloat(b.volume24h) - parseFloat(a.volume24h))
        .slice(0, 8);

      console.log(
        `Successfully fetched ${topCryptos.length} cryptocurrencies from Binance`
      );
      return topCryptos;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        `Binance API error in getTopCryptocurrencies: ${errorMessage}`
      );
      console.error(
        "Stack trace:",
        error instanceof Error ? error.stack : "No stack trace"
      );

      console.warn("Using fallback market data due to Binance API error");
      return [
        {
          symbol: "BTC",
          name: "Bitcoin",
          price: "94250.00",
          priceChange24h: "1200.00",
          priceChangePercent24h: "1.29",
          volume24h: "28500000000",
          marketCap: "1850000000000",
        },
        // ... existing fallback data
      ];
    }
  }

  async getMarketStats(): Promise<MarketStats> {
    try {
      // Get 24h ticker data for all USDT pairs
      const response = await fetchWithTimeout(`${this.baseUrl}/ticker/24hr`, {
        headers: {
          "X-MBX-APIKEY": this.apiKey,
        },
      });

      const data = await response.json();

      if (!Array.isArray(data)) {
        throw new Error("Invalid response format from Binance API");
      }

      // Filter USDT pairs
      const usdtPairs = data.filter((ticker: any) =>
        ticker.symbol.endsWith("USDT")
      );

      // Calculate total volume
      const totalVolume = usdtPairs.reduce((sum: number, ticker: any) => {
        return sum + parseFloat(ticker.volume) * parseFloat(ticker.lastPrice);
      }, 0);

      // Calculate BTC dominance (volume-based since market cap isn't available)
      const btcData = usdtPairs.find(
        (ticker: any) => ticker.symbol === "BTCUSDT"
      );
      const btcVolume = btcData
        ? parseFloat(btcData.volume) * parseFloat(btcData.lastPrice)
        : 0;
      const btcDominanceValue = (btcVolume / totalVolume) * 100;

      // Format values
      const totalVolume24h = `$${(totalVolume / 1e9).toFixed(1)}B`;
      const btcDominance = `${btcDominanceValue.toFixed(1)}%`;

      // Calculate market sentiment based on price changes
      const positiveMoves = usdtPairs.filter(
        (t: any) => parseFloat(t.priceChangePercent) > 0
      ).length;
      const totalPairs = usdtPairs.length;
      const marketSentiment = (positiveMoves / totalPairs) * 100;
      const fearGreedIndex = Math.round(marketSentiment);

      // Estimate total market cap (rough approximation)
      const estimatedMarketCap = totalVolume * 3; // Using volume multiplier as estimation
      const totalMarketCap = `$${(estimatedMarketCap / 1e12).toFixed(2)}T`;

      console.log("Successfully calculated market stats from Binance data");

      return {
        totalMarketCap,
        totalVolume24h,
        btcDominance,
        fearGreedIndex,
      };
    } catch (error) {
      console.error("Binance market stats error:", error);

      return {
        totalMarketCap: "$3.4T",
        totalVolume24h: "$125.8B",
        btcDominance: "56.2%",
        fearGreedIndex: 65,
      };
    }
  }

  private getSymbolName(symbol: string): string {
    const names: Record<string, string> = {
      BTC: "Bitcoin",
      ETH: "Ethereum",
      BNB: "BNB",
      XRP: "XRP",
      SOL: "Solana",
      ADA: "Cardano",
      DOGE: "Dogecoin",
      AVAX: "Avalanche",
      DOT: "Polkadot",
      MATIC: "Polygon",
    };
    return names[symbol] || symbol;
  }
}

export interface NewsArticleResponse {
  title: string;
  content: string;
  source: string;
  imageUrl: string | null;
  publishedAt: Date;
  url: string;
}

export class NewsClient {
  private baseUrl = "https://newsapi.org/v2";

  async getCryptoNews(): Promise<NewsArticleResponse[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/everything?q=cryptocurrency OR bitcoin OR ethereum&language=en&sortBy=publishedAt&pageSize=20&apiKey=${NEWS_API_KEY}`
      );

      if (!response.ok) {
        throw new Error(`News API error: ${response.status}`);
      }

      const data = (await response.json()) as any;

      return data.articles.map((article: any) => ({
        title: article.title,
        content: article.description || article.content || "",
        source: article.source.name,
        imageUrl: article.urlToImage,
        publishedAt: new Date(article.publishedAt),
        url: article.url,
      }));
    } catch (error) {
      console.error("News API error:", error);
      throw new Error("Failed to fetch news data");
    }
  }
}

interface MarketContext {
  topCoins?: CryptoMarketData[];
  stats?: MarketStats;
  recentNews?: NewsArticleResponse[];
  marketSentiment?: SentimentData;
}

export class AIClient {
  async generateChatResponse(
    message: string,
    marketContext?: MarketContext
  ): Promise<string> {
    try {
      // 1. Gather enhanced market context
      const enhancedContext = await this.gatherEnhancedContext(
        message,
        marketContext
      );

      // 2. Get technical analysis from Hugging Face
      const technicalAnalysis = await this.getTechnicalAnalysis(
        message,
        enhancedContext
      );

      // 3. Generate main response using Gemini
      const geminiResponse = await this.generateGeminiResponse(
        message,
        enhancedContext,
        technicalAnalysis
      );

      // 4. If Gemini fails, use Hugging Face as backup
      if (!geminiResponse) {
        console.warn("Gemini response failed, falling back to Hugging Face");
        return this.generateHuggingFaceResponse(
          message,
          enhancedContext,
          technicalAnalysis
        );
      }

      return geminiResponse;
    } catch (error) {
      console.error("AI response generation error:", error);
      return this.generateFallbackResponse(message, marketContext);
    }
  }

  private async gatherEnhancedContext(
    message: string,
    baseContext?: MarketContext
  ): Promise<MarketContext> {
    const context: MarketContext = { ...(baseContext || {}) };

    try {
      // Get real-time market data if not provided
      if (!context.topCoins || !context.stats) {
        const [marketData, marketStats] = await Promise.all([
          binanceClient.getTopCryptocurrencies(),
          binanceClient.getMarketStats(),
        ]);
        context.topCoins = marketData.slice(0, 5); // Top 5 coins
        context.stats = marketStats;
      }

      // Get relevant news if the query is about current events or specific coins
      if (
        message.toLowerCase().includes("news") ||
        message.toLowerCase().includes("recent") ||
        message.toLowerCase().includes("latest")
      ) {
        const news = await newsClient.getCryptoNews();
        context.recentNews = news.slice(0, 3); // Top 3 news items
      }

      // Get market sentiment
      const sentiment = await sentimentClient.calculateOverallSentiment(
        context.recentNews || []
      );
      context.marketSentiment = sentiment;
    } catch (error) {
      console.warn("Error gathering enhanced context:", error);
    }

    return context;
  }

  private async getTechnicalAnalysis(
    message: string,
    context: any
  ): Promise<string> {
    try {
      // Use Hugging Face for technical pattern recognition
      const response = await fetch(
        "https://api-inference.huggingface.co/models/ProsusAI/finbert",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${HUGGINGFACE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputs: this.buildTechnicalPrompt(message, context),
          }),
        }
      );

      if (!response.ok) return "";

      const result = await response.json();
      return result[0]?.generated_text || "";
    } catch (error) {
      console.warn("Technical analysis error:", error);
      return "";
    }
  }

  private async generateGeminiResponse(
    message: string,
    context: any,
    technicalAnalysis: string
  ): Promise<string> {
    try {
      const response = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: this.buildGeminiPrompt(
                      message,
                      context,
                      technicalAnalysis
                    ),
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.7,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 1024,
            },
            safetySettings: [
              {
                category: "HARM_CATEGORY_HARASSMENT",
                threshold: "BLOCK_MEDIUM_AND_ABOVE",
              },
              {
                category: "HARM_CATEGORY_HATE_SPEECH",
                threshold: "BLOCK_MEDIUM_AND_ABOVE",
              },
              {
                category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                threshold: "BLOCK_MEDIUM_AND_ABOVE",
              },
              {
                category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                threshold: "BLOCK_MEDIUM_AND_ABOVE",
              },
            ],
          }),
        }
      );

      const result = await response.json();
      return result.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } catch (error) {
      console.warn("Gemini response error:", error);
      return "";
    }
  }

  private async generateHuggingFaceResponse(
    message: string,
    context: any,
    technicalAnalysis: string
  ): Promise<string> {
    try {
      const response = await fetch(
        "https://api-inference.huggingface.co/models/microsoft/DialoGPT-large",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${HUGGINGFACE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputs: this.buildHuggingFacePrompt(
              message,
              context,
              technicalAnalysis
            ),
            parameters: {
              max_length: 200,
              temperature: 0.7,
              do_sample: true,
            },
          }),
        }
      );

      if (!response.ok) {
        return this.generateFallbackResponse(message, context);
      }

      const result = await response.json();
      return (
        result[0]?.generated_text ||
        this.generateFallbackResponse(message, context)
      );
    } catch (error) {
      console.warn("Hugging Face response error:", error);
      return this.generateFallbackResponse(message, context);
    }
  }

  private buildTechnicalPrompt(
    message: string,
    context: MarketContext
  ): string {
    let prompt = `Analyze the following crypto market conditions and identify key technical patterns:\n\n`;

    if (context.topCoins) {
      context.topCoins.forEach((coin: any) => {
        prompt += `${coin.name}: $${coin.price} (${coin.priceChangePercent24h}% 24h)\n`;
      });
    }

    if (context.stats) {
      prompt += `\nMarket Stats:\n`;
      prompt += `- Total Market Cap: ${context.stats.totalMarketCap}\n`;
      prompt += `- 24h Volume: ${context.stats.totalVolume24h}\n`;
      prompt += `- BTC Dominance: ${context.stats.btcDominance}\n`;
    }

    return prompt;
  }

  private buildGeminiPrompt(
    message: string,
    context: MarketContext,
    technicalAnalysis: string
  ): string {
    let prompt = `You are an expert crypto trading assistant. Provide detailed, accurate information while avoiding direct investment advice. Include relevant market data and technical analysis in your response.

Current Market Context:
`;

    if (context.topCoins) {
      prompt += `\nTop Cryptocurrencies:`;
      context.topCoins.forEach((coin: any) => {
        prompt += `\n- ${coin.name} (${coin.symbol}): $${coin.price} (${coin.priceChangePercent24h}% 24h)`;
      });
    }

    if (context.stats) {
      prompt += `\n\nMarket Overview:`;
      prompt += `\n- Total Market Cap: ${context.stats.totalMarketCap}`;
      prompt += `\n- 24h Volume: ${context.stats.totalVolume24h}`;
      prompt += `\n- BTC Dominance: ${context.stats.btcDominance}`;
      prompt += `\n- Market Sentiment: ${
        context.marketSentiment?.mood || "neutral"
      }`;
    }

    if (context.recentNews) {
      prompt += `\n\nRecent News:`;
      context.recentNews.forEach((news: any) => {
        prompt += `\n- ${news.title}`;
      });
    }

    if (technicalAnalysis) {
      prompt += `\n\nTechnical Analysis:\n${technicalAnalysis}`;
    }

    prompt += `\n\nUser Question: ${message}\n\nResponse:`;
    return prompt;
  }

  private buildHuggingFacePrompt(
    message: string,
    context: MarketContext,
    technicalAnalysis: string
  ): string {
    // Similar to Gemini prompt but simplified for the model's capabilities
    let prompt = `You are a crypto expert. Provide helpful information about cryptocurrencies and market conditions.\n\n`;

    if (context.topCoins?.[0]) {
      prompt += `Current ${context.topCoins[0].name} price: $${context.topCoins[0].price}\n`;
    }

    if (context.stats) {
      prompt += `Market cap: ${context.stats.totalMarketCap}\n`;
      prompt += `BTC dominance: ${context.stats.btcDominance}\n`;
    }

    if (technicalAnalysis) {
      prompt += `Analysis: ${technicalAnalysis}\n`;
    }

    prompt += `\nQuestion: ${message}\nAnswer:`;
    return prompt;
  }

  private generateFallbackResponse(
    message: string,
    context?: MarketContext
  ): string {
    // Existing fallback logic remains the same
    const lowerMessage = message.toLowerCase();

    // Bitcoin price queries
    if (lowerMessage.includes("bitcoin") || lowerMessage.includes("btc")) {
      if (context?.topCoins?.[0]?.symbol === "BTC") {
        return `Bitcoin is currently trading at $${context.topCoins[0].price}, with a 24-hour change of ${context.topCoins[0].priceChangePercent24h}%. Bitcoin remains the dominant cryptocurrency and often sets the trend for the broader market.`;
      }
      return "Bitcoin is the world's first and most valuable cryptocurrency. It's often considered digital gold and a store of value.";
    }

    if (context?.stats) {
      return `The crypto market currently has a total market cap of ${
        context.stats.totalMarketCap
      } with Bitcoin dominance at ${
        context.stats.btcDominance
      }. Market sentiment is ${context.marketSentiment?.mood || "neutral"}.`;
    }

    return "I can help you understand cryptocurrency markets and provide current market data. What would you like to know about?";
  }
}

export class SentimentClient {
  async analyzeSentiment(
    text: string
  ): Promise<SentimentResult | KeywordSentimentResult> {
    try {
      return await analyzeSentiment(text);
    } catch (error) {
      console.error("Sentiment analysis error:", error);
      throw error;
    }
  }

  async calculateOverallSentiment(
    articles: NewsArticleResponse[]
  ): Promise<SentimentData> {
    try {
      // Combine title and content for each article
      const texts = articles
        .slice(0, 10)
        .map((article) => `${article.title} ${article.content}`.trim());

      // Use our enhanced sentiment analyzer
      const results = await analyzeMultipleTexts(texts);

      // Calculate statistics from results
      const total = results.length;
      const positive = results.filter(
        (r: SentimentResult | KeywordSentimentResult) =>
          r.sentiment === "positive"
      ).length;
      const neutral = results.filter(
        (r: SentimentResult | KeywordSentimentResult) =>
          r.sentiment === "neutral"
      ).length;
      const negative = results.filter(
        (r: SentimentResult | KeywordSentimentResult) =>
          r.sentiment === "negative"
      ).length;

      // Calculate average confidence
      const avgConfidence =
        results.reduce(
          (sum: number, r: SentimentResult | KeywordSentimentResult) =>
            sum + r.confidence,
          0
        ) / total;

      // Determine overall mood with confidence threshold
      let mood: "bullish" | "neutral" | "bearish" = "neutral";
      const positiveRatio = positive / total;
      const negativeRatio = negative / total;

      if (positiveRatio > 0.45 && avgConfidence > 0.6) {
        mood = "bullish";
      } else if (negativeRatio > 0.45 && avgConfidence > 0.6) {
        mood = "bearish";
      }

      return {
        positive: Math.round(positiveRatio * 100),
        neutral: Math.round((neutral / total) * 100),
        negative: Math.round(negativeRatio * 100),
        mood,
      };
    } catch (error) {
      console.error("Overall sentiment calculation error:", error);
      return {
        positive: 60,
        neutral: 30,
        negative: 10,
        mood: "neutral",
      };
    }
  }
}

interface TrendingTopic {
  topic: string;
  mentions: number;
  sentiment: string;
}

export class TwitterClient {
  async getTrendingCryptoTopics(): Promise<TrendingTopic[]> {
    try {
      // Due to Twitter API v2 limitations, we'll return mock trending data
      // In production, you'd implement proper Twitter API v2 endpoints
      return [
        { topic: "Bitcoin", mentions: 34200, sentiment: "positive" },
        { topic: "Ethereum", mentions: 18700, sentiment: "positive" },
        { topic: "DeFi", mentions: 9300, sentiment: "neutral" },
      ];
    } catch (error) {
      console.error("Twitter API error:", error);
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
export const multiModelService = new MultiModelAIService(
  HUGGINGFACE_API_KEY || ""
);
