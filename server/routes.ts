import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertChatHistorySchema } from "@shared/schema";
import type { ChatMessage } from "@shared/schema";
import { randomUUID } from "crypto";
import { binanceClient, newsClient, sentimentClient, twitterClient, aiClient } from "./api-clients";

export async function registerRoutes(app: Express): Promise<Server> {
  // Market data routes
  app.get("/api/market", async (req, res) => {
    try {
      // Check cache first
      const cachedData = await storage.getCachedMarketData();
      if (cachedData && cachedData.length > 0) {
        const stats = await storage.getMarketStats();
        return res.json({ success: true, data: { coins: cachedData, stats } });
      }

      console.log('Fetching real market data from Binance...');
      
      // Fetch real data from Binance API
      const [realMarketData, realMarketStats] = await Promise.all([
        binanceClient.getTopCryptocurrencies(),
        binanceClient.getMarketStats()
      ]);
      
      if (realMarketData && realMarketData.length > 0) {
        // Update storage with real data
        await storage.updateMarketData(realMarketData.map(coin => ({
          symbol: coin.symbol,
          name: coin.name,
          price: coin.price,
          priceChange24h: coin.priceChange24h,
          priceChangePercent24h: coin.priceChangePercent24h,
          volume24h: coin.volume24h,
          marketCap: coin.marketCap
        })));
        
        const coins = await storage.getMarketData();
        await storage.setCachedMarketData(coins);
        
        res.json({
          success: true,
          data: {
            coins,
            stats: realMarketStats
          }
        });
      } else {
        throw new Error('No data received from Binance API');
      }
      
    } catch (error) {
      console.error('Binance API failed:', error);
      
      // Fallback to stored data only if absolutely necessary
      const coins = await storage.getMarketData();
      const stats = await storage.getMarketStats();
      
      res.json({ 
        success: true, 
        data: { coins, stats },
        note: 'Using fallback data due to API unavailability'
      });
    }
  });

  // News and sentiment routes
  app.get("/api/news", async (req, res) => {
    try {
      let articles, sentiment;
      
      try {
        console.log('Fetching real news data from News API...');
        const newsArticles = await newsClient.getCryptoNews();
        
        // Analyze sentiment for the news articles
        console.log('Analyzing sentiment with AI...');
        sentiment = await sentimentClient.calculateOverallSentiment(newsArticles);
        
        // Add sentiment to individual articles
        articles = await Promise.all(
          newsArticles.slice(0, 8).map(async (article) => {
            const articleSentiment = await sentimentClient.analyzeSentiment(article.title);
            return {
              id: randomUUID(),
              ...article,
              sentiment: articleSentiment,
              createdAt: new Date()
            };
          })
        );
        
        console.log('Successfully fetched and analyzed real news data');
      } catch (apiError) {
        console.warn('News API failed, falling back to mock data:', apiError);
        articles = await storage.getNewsArticles();
        sentiment = await storage.getSentimentData();
      }
      
      res.json({
        success: true,
        data: {
          articles,
          sentiment
        }
      });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: "Failed to fetch news data",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Chat routes
  app.post("/api/chat", async (req, res) => {
    try {
      const { message, conversationId } = req.body;
      
      if (!message || typeof message !== 'string') {
        return res.status(400).json({
          success: false,
          message: "Message is required"
        });
      }

      console.log('Generating AI response with market context...');
      
      // Fetch real-time data for market context
      let marketContext = {};
      try {
        const [marketData, marketStats] = await Promise.all([
          binanceClient.getTopCryptocurrencies(),
          binanceClient.getMarketStats()
        ]);
        
        marketContext = {
          topCoin: marketData[0], // Bitcoin or top coin
          stats: marketStats,
          coins: marketData.slice(0, 3) // Top 3 coins for context
        };
      } catch (error) {
        console.warn('Failed to fetch real-time market data for context:', error);
        // Use stored data as fallback
        const coins = await storage.getMarketData();
        const stats = await storage.getMarketStats();
        marketContext = {
          topCoin: coins[0],
          stats,
          coins: coins.slice(0, 3)
        };
      }
      
      // Generate AI response with market context
      const aiResponse = await aiClient.generateChatResponse(message, marketContext);
      console.log('Successfully generated AI response');

      // Create chat message response
      const response: ChatMessage = {
        id: randomUUID(),
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date().toISOString()
      };

      res.json({
        success: true,
        data: { message: response }
      });
    } catch (error) {
      console.error('Chat error:', error);
      res.status(500).json({
        success: false,
        message: "Failed to generate response",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Chat history routes
  app.get("/api/chat/history", async (req, res) => {
    try {
      const history = await storage.getChatHistory();
      res.json({
        success: true,
        data: history
      });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: "Failed to fetch chat history",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.post("/api/chat/history", async (req, res) => {
    try {
      const validatedData = insertChatHistorySchema.parse(req.body);
      const chatHistory = await storage.createChatHistory(validatedData);
      
      res.json({
        success: true,
        data: chatHistory
      });
    } catch (error) {
      res.status(400).json({ 
        success: false, 
        message: "Failed to save chat history",
        error: error instanceof Error ? error.message : "Invalid data"
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
        message: "Chat history cleared successfully"
      });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: "Failed to clear chat history",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
