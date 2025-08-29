import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertChatHistorySchema } from "@shared/schema";
import type { ChatMessage } from "@shared/schema";
import { randomUUID } from "crypto";
import {
  binanceClient,
  newsClient,
  sentimentClient,
  twitterClient,
  aiClient,
} from "./api-clients";
import { MarketService } from "./services/market-service";
import { MultiModelService } from "./services/multi-model-service.js";
import type {
  DetailedMarketData,
  MarketStats,
} from "@shared/types/market-data";
interface ModelContribution {
  source: string;
  confidence: number;
  processingTime: number;
  data?: {
    strengths?: string[];
    response?: string;
  };
}
import type { ModelResponse, EnsembleResponse } from "./types/ai-response";

const multiModelService = new MultiModelService();

interface TextContent {
  content: string;
  metadata: {
    source: string;
    type: string;
  };
}

interface SentimentResponse {
  positive: number;
  negative: number;
  neutral: number;
  mood: string;
  score?: number;
  label?: "positive" | "negative" | "neutral";
}

interface NewsArticleResponse {
  title: string;
  description: string;
  content: string;
  source: string;
  url: string;
  publishedAt: Date;
}

interface TrendingTopic {
  topic_id: string;
  content: string;
  timestamp: Date | string;
  user_handle: string;
  engagement: {
    like_count: number;
    retweet_count: number;
    reply_count: number;
  };
}

interface Tweet {
  id: string;
  text: string;
  createdAt: Date;
  authorUsername: string;
  metrics: {
    likes: number;
    retweets: number;
    replies: number;
  };
}

interface NewsArticle {
  id: string;
  title: string;
  description: string;
  content: string;
  source: string;
  url: string;
  publishedAt: Date;
  sentiment?: {
    score: number;
    label: "positive" | "negative" | "neutral";
  };
  relatedTweets?: Tweet[];
}

interface EnrichedMarketData {
  symbol: string;
  name: string;
  price: string;
  priceChange24h: string;
  priceChangePercent24h: string;
  volume24h: string;
  marketCap: string;
  relatedTweets?: Tweet[];
  latestNews?: NewsArticle[];
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Market data routes

  app.get("/api/news", async (req, res) => {
    try {
      console.log("Fetching real-time news and social data...");

      // Fetch news and tweets in parallel
      const [newsArticles, trendingTopics] = await Promise.all([
        newsClient.getCryptoNews(),
        twitterClient.getTrendingCryptoTopics(),
      ]);

      if (!newsArticles || !Array.isArray(newsArticles)) {
        throw new Error("Failed to fetch news articles");
      }

      // Convert trending topics to tweets for sentiment analysis
      const tweets: Tweet[] = trendingTopics.map((topic) => ({
        id: topic.topic_id,
        text: topic.content,
        createdAt: new Date(topic.timestamp),
        authorUsername: topic.user_handle,
        metrics: {
          likes: topic.engagement.like_count,
          retweets: topic.engagement.retweet_count,
          replies: topic.engagement.reply_count,
        },
      }));

      // Analyze sentiment for news articles and tweets
      const [newsSentiment, tweetSentiment] = (await Promise.all([
        sentimentClient.calculateOverallSentiment(newsArticles),
        sentimentClient.analyzeBatchTexts(tweets.map((t) => t.text)),
      ])) as [SentimentResponse, SentimentResponse];

      // Process and enrich articles with sentiment
      const articles: NewsArticle[] = await Promise.all(
        newsArticles.slice(0, 8).map(async (article) => {
          const articleText = `${article.title} ${article.description || ""} ${
            article.content || ""
          }`;
          const sentimentResult = await sentimentClient.analyzeSentiment(
            articleText
          );
          const sentiment = {
            score: Array.isArray(sentimentResult.scores)
              ? Math.max(...sentimentResult.scores.map((s) => s.score))
              : 0,
            label: sentimentResult.sentiment as
              | "positive"
              | "negative"
              | "neutral",
          };

          return {
            ...article,
            id: randomUUID(),
            sentiment,
            relatedTweets: tweets
              .filter((tweet) =>
                tweet.text.toLowerCase().includes(article.title.toLowerCase())
              )
              .slice(0, 3),
          };
        })
      );

      // Combine sentiment analysis
      const sentiment = {
        news: newsSentiment,
        social: tweetSentiment,
        overall: {
          positive: (newsSentiment.positive + tweetSentiment.positive) / 2,
          negative: (newsSentiment.negative + tweetSentiment.negative) / 2,
          neutral: (newsSentiment.neutral + tweetSentiment.neutral) / 2,
          mood: newsSentiment.mood, // Prioritize news sentiment for overall mood
        },
      };

      res.json({
        success: true,
        data: {
          articles,
          sentiment,
          meta: {
            timestamp: new Date().toISOString(),
            articlesCount: articles.length,
            tweetsAnalyzed: tweets.length,
            lastUpdated: new Date().toISOString(),
            sources: {
              news: Array.from(new Set(articles.map((a) => a.source))),
              social: ["Twitter"],
            },
          },
        },
      });
    } catch (error) {
      console.error("News data fetch failed:", error);

      let errorCode = "UNKNOWN_ERROR";
      let userMessage = "Failed to fetch news data";
      let statusCode = 500;

      if (error instanceof Error) {
        if (error.message.includes("Failed to fetch")) {
          errorCode = "FETCH_ERROR";
          userMessage =
            "Unable to retrieve real-time news data. Please try again.";
          statusCode = 503;
        } else if (error.message.includes("rate limit")) {
          errorCode = "RATE_LIMIT";
          userMessage = "API rate limit reached. Please wait a moment.";
          statusCode = 429;
        } else if (error.message.includes("Invalid data")) {
          errorCode = "INVALID_DATA";
          userMessage = "Received invalid data from news sources.";
          statusCode = 422;
        }
      }

      res.status(statusCode).json({
        success: false,
        error: {
          code: errorCode,
          message: userMessage,
          details: error instanceof Error ? error.message : "Unknown error",
        },
        meta: {
          timestamp: new Date().toISOString(),
          retry: statusCode === 429 ? 60 : 5,
        },
      });
    }
  });

  app.get("/api/market", async (req, res) => {
    try {
      const marketData = await binanceClient.getTopCryptocurrencies();

      if (!marketData || !Array.isArray(marketData)) {
        throw new Error("Failed to fetch real-time market data");
      }

      // Ensure we have real data with proper validation
      const validatedData = marketData.map((item) => {
        if (!item.price || !item.priceChange24h || !item.volume24h) {
          throw new Error("Incomplete market data received");
        }
        return {
          ...item,
          price: item.price.toString(),
          priceChange24h: item.priceChange24h.toString(),
          priceChangePercent24h: item.priceChangePercent24h.toString(),
          volume24h: item.volume24h.toString(),
          marketCap: item.marketCap?.toString() || "0",
        };
      });

      // Get all trending topics first
      let allTrendingTopics: TrendingTopic[] = [];
      try {
        allTrendingTopics = await twitterClient.getTrendingCryptoTopics();
      } catch (error) {
        console.warn("Failed to fetch Twitter topics:", error);
        // Continue with empty topics list
      }

      // Get all news first
      let allNews: NewsArticleResponse[] = [];
      try {
        allNews = await newsClient.getCryptoNews();
      } catch (error) {
        console.warn("Failed to fetch news:", error);
        // Continue with empty news list
      }

      // Enrich market data with cached social data
      const enrichedData = await Promise.all(
        validatedData.map(async (coin) => {
          try {
            // Filter existing trending topics for this coin
            const tweets = allTrendingTopics
              .filter((topic) =>
                topic.content.toLowerCase().includes(coin.symbol.toLowerCase())
              )
              .slice(0, 5)
              .map((topic) => ({
                id: topic.topic_id,
                text: topic.content,
                createdAt: new Date(topic.timestamp),
                authorUsername: topic.user_handle,
                metrics: {
                  likes: topic.engagement.like_count,
                  retweets: topic.engagement.retweet_count,
                  replies: topic.engagement.reply_count,
                },
              }));

            // Filter existing news for this coin
            const news = allNews
              .filter(
                (article) =>
                  article.title
                    .toLowerCase()
                    .includes(coin.symbol.toLowerCase()) ||
                  article.content
                    .toLowerCase()
                    .includes(coin.symbol.toLowerCase())
              )
              .slice(0, 3)
              .map((article) => ({
                id: randomUUID(),
                ...article,
              }));

            const enriched: EnrichedMarketData = {
              ...coin,
              relatedTweets: tweets,
              latestNews: news,
            };
            return enriched;
          } catch (error) {
            console.warn(
              `Failed to fetch social data for ${coin.symbol}:`,
              error
            );
            return coin;
          }
        })
      );

      res.json({
        success: true,
        data: enrichedData,
        meta: {
          timestamp: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
          dataPoints: enrichedData.length,
          withSocialData: enrichedData.filter(
            (d): d is EnrichedMarketData =>
              (d as EnrichedMarketData).relatedTweets !== undefined ||
              (d as EnrichedMarketData).latestNews !== undefined
          ).length,
        },
      });
    } catch (error) {
      console.error("Market data fetch failed:", error);

      // Determine the specific error type for better client handling
      let errorCode = "UNKNOWN_ERROR";
      let userMessage = "Failed to fetch market data";
      let statusCode = 500;

      if (error instanceof Error) {
        if (
          error.message.includes("ENOTFOUND") ||
          error.message.includes("ConnectTimeout")
        ) {
          errorCode = "CONNECTION_ERROR";
          userMessage =
            "Unable to connect to market data provider. Please try again in a few moments.";
          statusCode = 503;
        } else if (error.message.includes("timeout")) {
          errorCode = "TIMEOUT_ERROR";
          userMessage =
            "Market data request timed out. Please refresh the page.";
          statusCode = 504;
        } else if (error.message.includes("429")) {
          errorCode = "RATE_LIMIT";
          userMessage =
            "API rate limit reached. Please wait a moment and try again.";
          statusCode = 429;
        } else if (error.message.includes("Incomplete")) {
          errorCode = "INCOMPLETE_DATA";
          userMessage =
            "Unable to fetch complete market data. Please try again.";
          statusCode = 422;
        } else if (error.message.includes("Failed to fetch")) {
          errorCode = "MARKET_DATA_ERROR";
          userMessage =
            "Cannot retrieve real-time market data. Please try again later.";
          statusCode = 503;
        }
      }

      res.status(statusCode).json({
        success: false,
        error: {
          code: errorCode,
          message: userMessage,
          details: error instanceof Error ? error.message : "Unknown error",
        },
        meta: {
          timestamp: new Date().toISOString(),
          retry: statusCode === 429 ? 30 : 5, // Retry after 30 seconds for rate limits, 5 seconds for other errors
        },
      });
    }
  });

  // Chat routes
  app.post("/api/chat", async (req, res) => {
    try {
      const { message, conversationId, context, preferences } = req.body;

      // Enhanced input validation
      if (
        !message ||
        typeof message !== "string" ||
        message.trim().length === 0
      ) {
        return res.status(400).json({
          success: false,
          error: {
            code: "INVALID_INPUT",
            message: "Message is required and must be a non-empty string",
          },
        });
      }

      // Validate conversation ID if provided
      if (conversationId && typeof conversationId !== "string") {
        return res.status(400).json({
          success: false,
          error: {
            code: "INVALID_INPUT",
            message: "If provided, conversationId must be a string",
          },
        });
      }

      // Validate context if provided
      if (
        context &&
        (!context.type ||
          (context.type !== "MARKET_ANALYSIS" && context.type !== "GENERAL"))
      ) {
        return res.status(400).json({
          success: false,
          error: {
            code: "INVALID_INPUT",
            message:
              "Invalid context type. Must be either 'MARKET_ANALYSIS' or 'GENERAL'",
          },
        });
      }

      console.log("Generating AI response with market context...");

      // Get context from request or fetch it
      interface MarketContext {
        type: "MARKET_ANALYSIS" | "GENERAL";
        topCoin?: any;
        stats?: any;
        coins?: any[];
        isFallback?: boolean;
        lastUpdated?: string;
      }

      let marketContext: MarketContext = {
        type: "GENERAL",
      };

      if (req.body.context?.type === "MARKET_ANALYSIS") {
        // Use provided market data for analysis
        marketContext = {
          ...req.body.context.data,
          type: "MARKET_ANALYSIS",
        };
      } else {
        // Fetch real-time data for general context
        try {
          const [marketData, marketStats] = await Promise.all([
            binanceClient.getTopCryptocurrencies().catch(async (error) => {
              console.warn("Failed to fetch cryptocurrency data:", error);
              return storage.getMarketData();
            }),
            binanceClient.getMarketStats().catch(async (error) => {
              console.warn("Failed to fetch market stats:", error);
              return storage.getMarketStats();
            }),
          ]);

          // Validate market data
          if (!Array.isArray(marketData) || marketData.length === 0) {
            throw new Error("Invalid market data format");
          }

          // Validate market stats
          if (!marketStats || typeof marketStats !== "object") {
            throw new Error("Invalid market stats format");
          }

          marketContext = {
            topCoin: marketData[0],
            stats: marketStats,
            coins: marketData.slice(0, 3),
            type: "GENERAL",
            isFallback:
              (marketData[0] as any)?.source === "fallback" ||
              (marketStats as any)?.source === "fallback",
          };
        } catch (error) {
          console.warn(
            "Failed to fetch real-time market data for context:",
            error
          );
          // Use cached data with timestamp check
          const maxCacheAge = 5 * 60 * 1000; // 5 minutes
          const coins = await storage.getMarketData();
          const stats = await storage.getMarketStats();

          if (
            !coins[0]?.lastUpdated ||
            new Date().getTime() - new Date(coins[0].lastUpdated).getTime() >
              maxCacheAge
          ) {
            console.warn("Cached market data is too old");
          }

          marketContext = {
            topCoin: coins[0],
            stats,
            coins: coins.slice(0, 3),
            type: "GENERAL",
            isFallback: true,
            lastUpdated:
              coins[0]?.lastUpdated?.toISOString() || new Date().toISOString(),
          };
        }
      }

      // Use provided preferences or default values
      const aiPreferences = {
        useGemini: true,
        useFinancialBert: true,
        useCryptoBert: true,
        useNewsAnalysis: true,
        weightingStrategy: "balanced" as const,
        minimumConfidence: 0.6,
        maxModels: 4,
        ...preferences, // Override defaults with any provided preferences
      };

      // Generate responses from all models independently
      interface AIResponse {
        response: string;
        confidence?: number;
        processingTime?: number;
        strengths?: string[];
        data?: {
          insights?: string[];
          contradictions?: string[];
          analysis?: string;
        };
      }

      interface ModelResponse {
        source: string;
        response: string;
        confidence?: number;
        processingTime?: number;
        strengths?: string[];
      }

      // Extend AIClient type
      type ExtendedAIClient = typeof aiClient & {
        getFinancialBertResponse(
          message: string,
          context: MarketContext
        ): Promise<AIResponse>;
        getCryptoBertResponse(
          message: string,
          context: MarketContext
        ): Promise<AIResponse>;
        getNewsAnalysisResponse(
          message: string,
          context: MarketContext
        ): Promise<AIResponse>;
        getGeminiResponse(
          prompt: string,
          context: MarketContext
        ): Promise<AIResponse>;
      };

      interface EnsembleResponse {
        finalResponse: string;
        consensusScore?: number;
        totalProcessingTime?: number;
        modelContributions?: Array<{
          source?: string;
          confidence?: number;
          processingTime?: number;
          data?: {
            strengths?: string[];
            response?: string;
          };
        }>;
        methodology?: string;
      }

      const RESPONSE_TIMEOUT = 45000; // 45 seconds timeout for all models

      // Use multiModelService to generate ensemble response
      const ensembleResult = await multiModelService.generateEnsembleResponse(
        message,
        marketContext,
        {
          useGemini: true,
          useFinancialBert: true,
          useCryptoBert: true,
          useNewsAnalysis: true,
          weightingStrategy: "confidence",
        }
      );

      // Convert responses to our expected format
      const validResponses =
        ensembleResult.modelContributions?.map((model) => ({
          source: model.source,
          response: model.data?.response || "",
          confidence: model.confidence,
          processingTime: model.processingTime,
          strengths: model.data?.strengths || [],
        })) || [];

      // Use the ensemble result from multiModelService
      const ensembleResponse: EnsembleResponse = {
        finalResponse: ensembleResult.finalResponse,
        consensusScore: ensembleResult.consensusScore,
        totalProcessingTime: ensembleResult.totalProcessingTime,
        modelContributions: ensembleResult.modelContributions,
        methodology: ensembleResult.methodology,
      };

      if (!ensembleResponse || !ensembleResponse.finalResponse) {
        throw new Error("Invalid AI response format");
      }

      const aiResponse = ensembleResponse.finalResponse;
      console.log("Successfully generated AI response");

      // Validate model contributions
      const validatedModelContributions: ModelContribution[] =
        ensembleResponse.modelContributions
          ?.filter((m) => m && typeof m === "object")
          ?.map((m) => ({
            source: m.source || "unknown",
            confidence: typeof m.confidence === "number" ? m.confidence : 0,
            processingTime:
              typeof m.processingTime === "number" ? m.processingTime : 0,
            data: {
              strengths: Array.isArray(m.data?.strengths)
                ? m.data.strengths
                : [],
            },
          })) || [];

      // Format model contributions for metadata
      const modelMetadata = validatedModelContributions.map((m) => ({
        name: m.source,
        confidence: m.confidence,
        processingTime: m.processingTime,
        strengths: m.data?.strengths || [],
      }));

      // Create chat message response with model contributions
      const response: ChatMessage = {
        id: randomUUID(),
        role: "assistant",
        content: aiResponse,
        timestamp: new Date().toISOString(),
        intent: "AI_RESPONSE",
        metadata: {
          ensembleDetails: {
            consensusScore: ensembleResponse.consensusScore ?? 0,
            processingTime: ensembleResponse.totalProcessingTime ?? 0,
            modelsUsed: modelMetadata,
          },
          modelContributions: validatedModelContributions.map(
            (contribution: ModelContribution) => ({
              source: contribution.source,
              confidence: contribution.confidence,
              processingTime: contribution.processingTime,
              data: {
                strengths: contribution.data?.strengths || [],
                response:
                  validResponses.find((r) => r.source === contribution.source)
                    ?.response || "",
              },
            })
          ),
          methodology: ensembleResponse.methodology || "standard",
        },
      };

      res.json({
        success: true,
        data: { message: response },
      });
    } catch (error) {
      console.error("Chat error:", error);

      let errorCode = "UNKNOWN_ERROR";
      let userMessage = "Failed to generate response";
      let statusCode = 500;
      let retryAfter = 5;

      if (error instanceof Error) {
        if (error.message.includes("timed out")) {
          errorCode = "TIMEOUT_ERROR";
          userMessage = "Response generation timed out. Please try again.";
          statusCode = 504;
          retryAfter = 10;
        } else if (error.message.includes("rate limit")) {
          errorCode = "RATE_LIMIT_ERROR";
          userMessage =
            "AI service rate limit reached. Please try again later.";
          statusCode = 429;
          retryAfter = 30;
        } else if (error.message.includes("Invalid AI response")) {
          errorCode = "AI_ERROR";
          userMessage =
            "Unable to generate a valid response. Please try rephrasing your question.";
          statusCode = 422;
        } else if (error.message.includes("market data")) {
          errorCode = "MARKET_DATA_ERROR";
          userMessage =
            "Unable to fetch required market data. Please try again.";
          statusCode = 503;
        }
      }

      res.status(statusCode).json({
        success: false,
        error: {
          code: errorCode,
          message: userMessage,
          details: error instanceof Error ? error.message : "Unknown error",
        },
        meta: {
          timestamp: new Date().toISOString(),
          retry: retryAfter,
          suggestion:
            statusCode === 422
              ? "Try asking a more specific question"
              : undefined,
        },
      });
    }
  });

  // Chat history routes
  app.get("/api/chat/history", async (req, res) => {
    try {
      const history = await storage.getChatHistory();
      res.json({
        success: true,
        data: history,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to fetch chat history",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.post("/api/chat/history", async (req, res) => {
    try {
      const validatedData = insertChatHistorySchema.parse(req.body);
      const chatHistory = await storage.createChatHistory(validatedData);

      res.json({
        success: true,
        data: chatHistory,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: "Failed to save chat history",
        error: error instanceof Error ? error.message : "Invalid data",
      });
    }
  });

  app.delete("/api/chat/history", async (req, res) => {
    try {
      // Clear all chat history (for the "Clear History" button)
      const history = await storage.getChatHistory();

      if (!Array.isArray(history)) {
        throw new Error("Invalid chat history format");
      }

      // Use Promise.allSettled to handle partial failures
      const results = await Promise.allSettled(
        history.map((chat) => storage.deleteChatHistory(chat.id))
      );

      // Check for any failures
      const failures = results.filter(
        (result): result is PromiseRejectedResult =>
          result.status === "rejected"
      );

      if (failures.length > 0) {
        console.warn(
          `Failed to delete ${failures.length} chat entries:`,
          failures.map((f) => f.reason).join(", ")
        );
      }

      res.json({
        success: true,
        message:
          failures.length === 0
            ? "Chat history cleared successfully"
            : `Chat history partially cleared (${
                history.length - failures.length
              }/${history.length} entries)`,
        meta: {
          totalEntries: history.length,
          deletedEntries: history.length - failures.length,
          failedEntries: failures.length,
        },
      });
    } catch (error) {
      console.error("Failed to clear chat history:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "CLEAR_HISTORY_ERROR",
          message: "Failed to clear chat history",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
