import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertChatHistorySchema } from "@shared/schema";
import type { ChatMessage } from "@shared/schema";
import { randomUUID } from "crypto";
import { binanceClient, newsClient, sentimentClient, twitterClient } from "./api-clients";

export async function registerRoutes(app: Express): Promise<Server> {
  // Market data routes
  app.get("/api/market", async (req, res) => {
    try {
      // Try to fetch real data from Binance API first
      let marketData, marketStats;
      
      try {
        console.log('Fetching real market data from Binance...');
        marketData = await binanceClient.getTopCryptocurrencies();
        marketStats = await binanceClient.getMarketStats();
        console.log('Successfully fetched real market data');
      } catch (apiError) {
        console.warn('Binance API failed, falling back to mock data:', apiError);
        // Fallback to stored mock data
        marketData = await storage.getMarketData();
        marketStats = await storage.getMarketStats();
      }
      
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

      // AI response with real-time market context
      let aiResponse = "";
      const lowerMessage = message.toLowerCase();
      
      // Fetch real-time data for context
      let marketData, marketStats, sentiment;
      try {
        marketData = await binanceClient.getTopCryptocurrencies();
        marketStats = await binanceClient.getMarketStats();
        
        const newsArticles = await newsClient.getCryptoNews();
        sentiment = await sentimentClient.calculateOverallSentiment(newsArticles);
      } catch (error) {
        // Fallback to stored data
        marketData = await storage.getMarketData();
        marketStats = await storage.getMarketStats();
        sentiment = await storage.getSentimentData();
      }
      
      if (lowerMessage.includes('bitcoin') || lowerMessage.includes('btc')) {
        const btcData = marketData.find((coin: any) => coin.symbol === 'BTC');
        
        aiResponse = `Bitcoin is currently trading at $${btcData?.price} with a ${btcData?.priceChangePercent24h}% change in the last 24 hours. `;
        
        const priceChange = parseFloat(btcData?.priceChangePercent24h || "0");
        if (priceChange > 2) {
          aiResponse += "This strong upward movement often indicates renewed institutional interest and positive market sentiment. ";
        } else if (priceChange < -2) {
          aiResponse += "The decline might be temporary consolidation after recent gains, which is normal in volatile markets. ";
        } else {
          aiResponse += "The price is showing relatively stable movement, suggesting market equilibrium. ";
        }
        
        aiResponse += `With Bitcoin dominance at ${marketStats.btcDominance}, it continues to lead the cryptocurrency market and influence overall sentiment.`;
      } else if (lowerMessage.includes('ethereum') || lowerMessage.includes('eth')) {
        const ethData = marketData.find((coin: any) => coin.symbol === 'ETH');
        
        aiResponse = `Ethereum is trading at $${ethData?.price} with a ${ethData?.priceChangePercent24h}% change today. `;
        
        const priceChange = parseFloat(ethData?.priceChangePercent24h || "0");
        if (priceChange > 0) {
          aiResponse += "The positive movement reflects continued adoption of DeFi applications and smart contracts on the Ethereum network. ";
        } else {
          aiResponse += "Despite any short-term price fluctuations, Ethereum's ecosystem continues to show strong development activity. ";
        }
        
        aiResponse += "The network processes high transaction volumes daily, indicating robust usage across decentralized applications.";
      } else if (lowerMessage.includes('market') || lowerMessage.includes('overview')) {
        aiResponse = `The crypto market shows a total market cap of ${marketStats.totalMarketCap} with ${marketStats.totalVolume24h} in daily trading volume. `;
        aiResponse += `Bitcoin maintains ${marketStats.btcDominance} market dominance. `;
        
        if (sentiment.mood === 'bullish') {
          aiResponse += `Current news sentiment is ${sentiment.mood} with ${sentiment.positive}% positive coverage, suggesting optimistic market conditions.`;
        } else if (sentiment.mood === 'bearish') {
          aiResponse += `News sentiment appears ${sentiment.mood} with ${sentiment.negative}% negative coverage, indicating cautious market conditions.`;
        } else {
          aiResponse += `Market sentiment is ${sentiment.mood} with balanced news coverage, suggesting stable market conditions.`;
        }
      } else if (lowerMessage.includes('news') || lowerMessage.includes('sentiment')) {
        aiResponse = `Current market sentiment analysis shows ${sentiment.positive}% positive, ${sentiment.neutral}% neutral, and ${sentiment.negative}% negative news coverage. `;
        aiResponse += `The overall market mood is ${sentiment.mood}. `;
        
        if (sentiment.mood === 'bullish') {
          aiResponse += "Recent headlines focus on institutional adoption, regulatory clarity, and technological developments driving optimism.";
        } else if (sentiment.mood === 'bearish') {
          aiResponse += "Recent news includes concerns about market volatility, regulatory challenges, or technical issues affecting sentiment.";
        } else {
          aiResponse += "News coverage shows balanced perspectives on market developments, regulatory updates, and technological progress.";
        }
      } else if (lowerMessage.includes('price') || lowerMessage.includes('how much')) {
        // Extract potential crypto symbols from the message
        const cryptoMentions = marketData.filter((coin: any) => 
          lowerMessage.includes(coin.symbol.toLowerCase()) || lowerMessage.includes(coin.name.toLowerCase())
        );
        
        if (cryptoMentions.length > 0) {
          const coin = cryptoMentions[0];
          aiResponse = `${coin.name} (${coin.symbol}) is currently priced at $${coin.price} with a ${coin.priceChangePercent24h}% change in the last 24 hours. `;
          
          const priceChange = parseFloat(coin.priceChangePercent24h);
          if (priceChange > 0) {
            aiResponse += "The positive momentum suggests active buying interest and market confidence in this cryptocurrency.";
          } else {
            aiResponse += "The price movement reflects normal market fluctuations, which are common in the cryptocurrency space.";
          }
        } else {
          aiResponse = `I can provide current prices for major cryptocurrencies. Try asking about specific coins like Bitcoin, Ethereum, Solana, or others from the top market cap rankings.`;
        }
      } else if (lowerMessage.includes('defi') || lowerMessage.includes('yield')) {
        aiResponse = "DeFi (Decentralized Finance) represents a growing ecosystem of financial applications built on blockchain networks, primarily Ethereum. ";
        aiResponse += "Current yield farming strategies offer various APY rates, though they come with smart contract risks and impermanent loss considerations. ";
        aiResponse += "Popular DeFi protocols continue to innovate with new lending mechanisms, automated market makers, and liquidity mining opportunities.";
      } else if (lowerMessage.includes('trading') || lowerMessage.includes('strategy')) {
        aiResponse = "Successful crypto trading requires understanding market analysis, risk management, and emotional discipline. ";
        aiResponse += "Key strategies include dollar-cost averaging for long-term positions, setting stop-losses for risk management, and never investing more than you can afford to lose. ";
        aiResponse += "Consider starting with established cryptocurrencies and gradually learning about technical analysis, market cycles, and portfolio diversification.";
      } else {
        aiResponse = "I can help you understand cryptocurrency markets, analyze current price movements, and explain trading concepts in simple terms. ";
        aiResponse += "You can ask me about specific cryptocurrencies, market sentiment, news analysis, trading strategies, or general education about blockchain technology. ";
        aiResponse += "What specific aspect of crypto markets interests you most?";
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
