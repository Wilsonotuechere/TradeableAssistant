import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import type { ChatMessage } from "@shared/schema";

interface MarketContext {
  symbol: string;
  price: number;
  change24h: number;
  volume: number;
  marketCap: number;
}

interface ChatContextType {
  messages: ChatMessage[];
  marketContext: MarketContext | null;
  addMessage: (message: ChatMessage) => void;
  updateMarketContext: (context: MarketContext) => void;
  clearMessages: () => void;
}

export const ChatContext = createContext<ChatContextType | undefined>(
  undefined
);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `Hi! I'm your advanced crypto trading assistant powered by multiple AI models including Gemini and specialized financial models. I can:

• Analyze market trends and sentiment
• Provide technical analysis
• Explain trading concepts
• Track real-time price movements
• Assess news impact on markets

What would you like to know about the crypto market?`,
      timestamp: new Date().toISOString(),
      intent: "GENERAL",
    },
  ]);

  const [marketContext, setMarketContext] = useState<MarketContext | null>(
    null
  );

  // Fetch market data periodically
  interface MarketResponse {
    data: {
      coins: Array<{
        symbol: string;
        price: number;
        priceChangePercent24h: number;
        volume24h: number;
        marketCap: number;
      }>;
    };
  }

  const { data: marketData } = useQuery<MarketResponse>({
    queryKey: ["/api/market"],
    refetchInterval: 60000, // Refetch every minute
  });

  useEffect(() => {
    if (marketData?.data?.coins?.[0]) {
      const btc = marketData.data.coins[0];
      setMarketContext({
        symbol: btc.symbol,
        price: btc.price,
        change24h: btc.priceChangePercent24h,
        volume: btc.volume24h,
        marketCap: btc.marketCap,
      });
    }
  }, [marketData]);

  const addMessage = (message: ChatMessage) => {
    setMessages((prev) => [...prev, message]);
  };

  const updateMarketContext = (context: MarketContext) => {
    setMarketContext(context);
  };

  const clearMessages = () => {
    setMessages([messages[0]]); // Keep the welcome message
  };

  return (
    <ChatContext.Provider
      value={{
        messages,
        marketContext,
        addMessage,
        updateMarketContext,
        clearMessages,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}
