import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertChatHistorySchema } from "@shared/schema";
import type { ChatMessage } from "@shared/schema";
import { randomUUID } from "crypto";

export async function registerRoutes(app: Express): Promise<Server> {
  // Market data routes
  app.get("/api/market", async (req, res) => {
    try {
      const marketData = await storage.getMarketData();
      const marketStats = await storage.getMarketStats();
      
      res.json({
        success: true,
        data: {
          coins: marketData,
          stats: marketStats
        }
      });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: "Failed to fetch market data",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // News and sentiment routes
  app.get("/api/news", async (req, res) => {
    try {
      const articles = await storage.getNewsArticles();
      const sentiment = await storage.getSentimentData();
      
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

      // Simulate AI response with context about crypto markets
      let aiResponse = "";
      const lowerMessage = message.toLowerCase();
      
      if (lowerMessage.includes('bitcoin') || lowerMessage.includes('btc')) {
        const marketData = await storage.getMarketData();
        const btcData = marketData.find(coin => coin.symbol === 'BTC');
        
        aiResponse = `Based on current market data, Bitcoin is trading at $${btcData?.price} with a ${btcData?.priceChangePercent24h}% change in the last 24 hours. `;
        
        if (parseFloat(btcData?.priceChangePercent24h || "0") > 0) {
          aiResponse += "The positive momentum suggests increased institutional interest and market confidence. ";
        } else {
          aiResponse += "The current price action shows some consolidation, which is normal after recent gains. ";
        }
        
        aiResponse += "Bitcoin continues to be the leading cryptocurrency by market cap and often drives overall market sentiment.";
      } else if (lowerMessage.includes('ethereum') || lowerMessage.includes('eth')) {
        const marketData = await storage.getMarketData();
        const ethData = marketData.find(coin => coin.symbol === 'ETH');
        
        aiResponse = `Ethereum is currently priced at $${ethData?.price} with a ${ethData?.priceChangePercent24h}% change today. The Ethereum network continues to process high transaction volumes, indicating strong adoption of DeFi and smart contract applications.`;
      } else if (lowerMessage.includes('market') || lowerMessage.includes('overview')) {
        const marketStats = await storage.getMarketStats();
        aiResponse = `The overall crypto market cap is ${marketStats.totalMarketCap} with ${marketStats.totalVolume24h} in 24-hour volume. Bitcoin dominance stands at ${marketStats.btcDominance}. The Fear & Greed Index is at ${marketStats.fearGreedIndex}, indicating ${marketStats.fearGreedIndex > 50 ? 'greed' : 'fear'} in the market sentiment.`;
      } else if (lowerMessage.includes('news') || lowerMessage.includes('sentiment')) {
        const sentiment = await storage.getSentimentData();
        aiResponse = `Current market sentiment analysis shows ${sentiment.positive}% positive, ${sentiment.neutral}% neutral, and ${sentiment.negative}% negative news coverage. The overall market mood is ${sentiment.mood}. Recent news highlights institutional adoption and regulatory developments.`;
      } else if (lowerMessage.includes('defi') || lowerMessage.includes('yield')) {
        aiResponse = "DeFi (Decentralized Finance) continues to innovate with new yield farming strategies and lending protocols. Recent developments show increased efficiency in earning passive income while maintaining security standards. Popular DeFi tokens have shown strong performance alongside growing total value locked (TVL) in protocols.";
      } else if (lowerMessage.includes('trading') || lowerMessage.includes('strategy')) {
        aiResponse = "For beginner traders, it's essential to understand key concepts like dollar-cost averaging, risk management, and market analysis. Never invest more than you can afford to lose, and always do your own research. Consider starting with well-established cryptocurrencies like Bitcoin and Ethereum before exploring altcoins.";
      } else {
        aiResponse = "I'm here to help you understand cryptocurrency markets, analyze trends, and explain trading concepts in simple terms. You can ask me about specific cryptocurrencies, market sentiment, news analysis, or general trading education. What would you like to know?";
      }



      const userMessage: ChatMessage = {
        id: randomUUID(),
        role: 'user',
        content: message,
        timestamp: new Date().toISOString()
      };

      const assistantMessage: ChatMessage = {
        id: randomUUID(),
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date().toISOString()
      };

      res.json({
        success: true,
        data: {
          userMessage,
          assistantMessage,
          conversationId: conversationId || randomUUID()
        }
      });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: "Failed to process chat message",
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
