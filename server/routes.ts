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
  multiModelService,
} from "./api-clients";
import { MarketService } from "./services/market-service";
import type {
  DetailedMarketData,
  MarketStats,
} from "../shared/types/market-data";
import type { ModelContribution } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Market data routes
  const marketService = MarketService.getInstance();

  app.get("/api/market", async (req, res) => {
    try {
      const marketData = await marketService.getMarketData();
      res.json({
        success: true,
        data: marketData,
      });
    } catch (error) {
      console.error("Market data fetch failed:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch market data",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // News and sentiment routes
  app.get("/api/news", async (req, res) => {
    try {
      let articles, sentiment;

      try {
        console.log("Fetching real news data from News API...");
        const newsArticles = await newsClient.getCryptoNews();

        // Analyze sentiment for the news articles
        console.log("Analyzing sentiment with AI...");
        sentiment = await sentimentClient.calculateOverallSentiment(
          newsArticles
        );

        // Add sentiment to individual articles
        articles = await Promise.all(
          newsArticles.slice(0, 8).map(async (article) => {
            const articleSentiment = await sentimentClient.analyzeSentiment(
              article.title
            );
            return {
              id: randomUUID(),
              ...article,
              sentiment: articleSentiment,
              createdAt: new Date(),
            };
          })
        );

        console.log("Successfully fetched and analyzed real news data");
      } catch (apiError) {
        console.warn("News API failed, falling back to mock data:", apiError);
        articles = await storage.getNewsArticles();
        sentiment = await storage.getSentimentData();
      }

      res.json({
        success: true,
        data: {
          articles,
          sentiment,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to fetch news data",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Chat routes
  app.post("/api/chat", async (req, res) => {
    try {
      const { message, conversationId } = req.body;

      if (!message || typeof message !== "string") {
        return res.status(400).json({
          success: false,
          message: "Message is required",
        });
      }

      console.log("Generating AI response with market context...");

      // Fetch real-time data for market context
      let marketContext = {};
      try {
        const [marketData, marketStats] = await Promise.all([
          binanceClient.getTopCryptocurrencies(),
          binanceClient.getMarketStats(),
        ]);

        marketContext = {
          topCoin: marketData[0], // Bitcoin or top coin
          stats: marketStats,
          coins: marketData.slice(0, 3), // Top 3 coins for context
        };
      } catch (error) {
        console.warn(
          "Failed to fetch real-time market data for context:",
          error
        );
        // Use stored data as fallback
        const coins = await storage.getMarketData();
        const stats = await storage.getMarketStats();
        marketContext = {
          topCoin: coins[0],
          stats,
          coins: coins.slice(0, 3),
        };
      }

      // Generate AI response using multi-model service
      const ensembleResponse = await multiModelService.generateEnsembleResponse(
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
      const aiResponse = ensembleResponse.finalResponse;
      console.log("Successfully generated AI response");

      // Create chat message response with model contributions
      const response: ChatMessage = {
        id: randomUUID(),
        role: "assistant",
        content: aiResponse,
        timestamp: new Date().toISOString(),
        intent: "AI_RESPONSE",
        metadata: {
          ensembleDetails: {
            consensusScore: ensembleResponse.consensusScore,
            processingTime: ensembleResponse.totalProcessingTime,
            modelsUsed: ensembleResponse.modelContributions.map((m) => ({
              name: m.source,
              confidence: m.confidence,
              processingTime: m.processingTime,
              strengths: Array.isArray(m.data?.strengths)
                ? m.data.strengths
                : [],
            })),
          },
          modelContributions: ensembleResponse.modelContributions,
          methodology: ensembleResponse.methodology,
        },
      };

      res.json({
        success: true,
        data: { message: response },
      });
    } catch (error) {
      console.error("Chat error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to generate response",
        error: error instanceof Error ? error.message : "Unknown error",
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
      for (const chat of history) {
        await storage.deleteChatHistory(chat.id);
      }

      res.json({
        success: true,
        message: "Chat history cleared successfully",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to clear chat history",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
