import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MessageSquare,
  Send,
  Trash2,
  Brain,
  TrendingUp,
  Sparkles,
  Bot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import GlassCard from "@/components/ui/glass-card";
import { useAuth } from "@/contexts/auth-context";
import { ChatMessage } from "@shared/schema";
import ChatMessageComponent from "@/components/chat/chat-message";
import { cn } from "@/lib/utils";

export default function Chat() {
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [sessionId] = useState(
    () => `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  );
  const [isTyping, setIsTyping] = useState(false);
  const [aiStrategy, setAiStrategy] = useState<
    "balanced" | "confidence" | "speed"
  >("balanced");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, isTyping]);

  // Load chat history from localStorage on mount and focus input
  useEffect(() => {
    const savedHistory = localStorage.getItem(`tradeable_chat_${sessionId}`);
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        setChatHistory(parsed);
      } catch (error) {
        console.warn("Failed to load chat history:", error);
      }
    }
    inputRef.current?.focus();
  }, [sessionId]);

  // Save chat history to localStorage whenever it changes
  useEffect(() => {
    if (chatHistory.length > 0) {
      localStorage.setItem(
        `tradeable_chat_${sessionId}`,
        JSON.stringify(chatHistory)
      );
    }
  }, [chatHistory, sessionId]);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (userMessage: string) => {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          preferences: {
            weightingStrategy: aiStrategy,
            useGemini: true,
            useFinancialBert: aiStrategy !== "speed",
            useCryptoBert: true,
            useNewsAnalysis: aiStrategy !== "speed",
            minimumConfidence: aiStrategy === "confidence" ? 0.8 : 0.6,
            maxModels: aiStrategy === "speed" ? 2 : 4,
          },
          context: {
            type: "GENERAL",
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error?.message || `API request failed: ${response.status}`
        );
      }

      return response.json();
    },
    onMutate: async (userMessage) => {
      // Add user message immediately
      const userMsg: ChatMessage = {
        id: Date.now().toString(),
        role: "user",
        content: userMessage,
        timestamp: new Date().toISOString(),
        intent: "GENERAL",
      };
      setChatHistory((prev) => [...prev, userMsg]);
      setIsTyping(true);
      setMessage("");
    },
    onSuccess: (data) => {
      // Add AI response with ensemble details
      const message = data.data?.message;
      const ensembleDetails = data.data?.ensembleDetails;

      const aiMsg: ChatMessage = {
        id: message.id || (Date.now() + 1).toString(),
        role: "assistant",
        content: message.content,
        timestamp: message.timestamp || new Date().toISOString(),
        intent: message.intent || "GENERAL",
        metadata: {
          ...message.metadata,
          ensembleDetails: ensembleDetails
            ? {
                consensusScore: ensembleDetails.qualityMetrics.consensusScore,
                processingTime:
                  ensembleDetails.qualityMetrics.totalProcessingTime,
                modelsUsed: ensembleDetails.modelBreakdown.map((m: any) => ({
                  name: m.model,
                  confidence: m.confidence,
                  processingTime: m.processingTime,
                  strengths: m.strengths,
                })),
              }
            : undefined,
        },
      };
      setChatHistory((prev) => [...prev, aiMsg]);
      setIsTyping(false);
    },
    onError: (error) => {
      console.error("Chat error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      let userFriendlyMessage =
        "The AI service is currently experiencing issues.";

      if (errorMessage.includes("GEMINI_API_KEY")) {
        userFriendlyMessage =
          "The AI service configuration needs attention. Please contact support.";
      } else if (
        errorMessage.includes("quota exceeded") ||
        errorMessage.includes("429")
      ) {
        userFriendlyMessage =
          "The AI service is currently at capacity. Please try again in a few minutes.";
      } else if (
        errorMessage.includes("Failed to fetch") ||
        errorMessage.includes("NetworkError") ||
        errorMessage.includes("network")
      ) {
        userFriendlyMessage =
          "Unable to reach the AI service. Please check your internet connection.";
      } else if (
        errorMessage.includes("timeout") ||
        errorMessage.includes("ETIMEDOUT") ||
        errorMessage.includes("aborted")
      ) {
        userFriendlyMessage =
          "The request timed out. Our services might be experiencing high load.";
      }

      // Add error message with retry guidance
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `${userFriendlyMessage}\n\nTroubleshooting steps:\n1. Check your internet connection\n2. Clear your browser cache and refresh the page\n3. If the issue persists after 5 minutes, please contact support\n\nIn the meantime, you can try simpler queries or check the market data section for updates.`,
        timestamp: new Date().toISOString(),
        intent: "ERROR",
      };

      setChatHistory((prev) => [...prev, errorMsg]);
      setIsTyping(false);

      // Clear the message input to prevent multiple retries of the same message
      setMessage("");
    },
  });

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || sendMessageMutation.isPending) return;

    sendMessageMutation.mutate(message.trim());
  };

  const clearHistory = () => {
    if (confirm("Are you sure you want to clear all chat history?")) {
      setChatHistory([]);
    }
  };

  const suggestedQuestions = [
    "BTC market overview",
    "ETH technical analysis",
    "BTC support/resistance",
    "Crypto market sentiment",
    "RSI & SMA explained",
    "BTC trend prediction",
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-navy-900 via-navy-950 to-black pt-20 relative overflow-hidden">
      <div className="absolute inset-0 bg-grid-white/[0.02] -z-10" />
      <div className="absolute inset-0 flex items-center justify-center -z-10">
        <div className="w-[500px] h-[500px] bg-electric/10 rounded-full blur-[128px]" />
      </div>
      <div className="container max-w-[90rem] mx-auto px-4 sm:px-6 py-4 sm:py-8">
        <div className="flex justify-center">
          {/* Chat Section */}
          <div className="w-full max-w-4xl animate-fade-in duration-500">
            <GlassCard className="h-[85vh] flex flex-col backdrop-blur-xl border border-electric/10 shadow-2xl shadow-electric/5 overflow-hidden rounded-2xl">
              {/* Chat Header */}
              <div className="p-4 sm:p-6 border-b border-electric/10 bg-gradient-to-r from-electric/5 via-neon/5 to-transparent relative">
                <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-20" />
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative">
                  <div className="flex items-center gap-4">
                    <div className="relative flex-shrink-0 group">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-electric via-neon to-purple-500 rounded-xl flex items-center justify-center shadow-lg transform group-hover:scale-105 transition-transform duration-200">
                        <Bot className="text-white w-5 h-5 sm:w-6 sm:h-6 animate-pulse" />
                      </div>
                      <div className="absolute -top-1 -right-1 w-3 h-3 sm:w-4 sm:h-4 bg-emerald rounded-full">
                        <div className="w-full h-full bg-emerald rounded-full animate-ping opacity-75"></div>
                      </div>
                      <div className="absolute -inset-1 bg-gradient-to-r from-electric via-neon to-purple-500 rounded-xl opacity-30 group-hover:opacity-50 blur transition-opacity duration-200" />
                    </div>
                    <div>
                      <h2 className="font-grotesk font-bold text-xl sm:text-2xl bg-gradient-to-r from-electric to-neon bg-clip-text text-transparent">
                        AI Trading Assistant
                      </h2>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-cool-gray text-xs sm:text-sm mt-1">
                        <div className="flex items-center gap-1">
                          <Brain className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-electric" />
                          <span>Multi-Model AI</span>
                        </div>
                        <div className="hidden sm:block w-1 h-1 bg-cool-gray/50 rounded-full"></div>
                        <div className="flex items-center gap-1">
                          <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-neon" />
                          <span>Real-Time Data</span>
                        </div>
                        <div className="hidden sm:block w-1 h-1 bg-cool-gray/50 rounded-full"></div>
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-emerald rounded-full animate-pulse"></div>
                          <span className="text-emerald">Online</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 ml-14 sm:ml-0">
                    <div className="text-xs text-cool-gray px-3 py-1.5 bg-white/5 rounded-full">
                      {chatHistory.length} messages
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearHistory}
                      disabled={chatHistory.length === 0}
                      className="text-cool-gray hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
                      data-testid="button-clear-chat"
                    >
                      <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span className="ml-2 hidden sm:inline">Clear</span>
                    </Button>
                  </div>
                </div>
              </div>{" "}
              {/* Chat Messages Area */}
              <div
                className="flex-1 p-4 sm:p-6 space-y-4 overflow-y-auto scrollbar-thin scrollbar-track-white/5 scrollbar-thumb-electric/20"
                style={{ height: "calc(85vh - 220px)" }}
                data-testid="chat-messages-container"
              >
                {chatHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full space-y-8 text-center animate-fade-in">
                    <div className="space-y-8">
                      <div className="relative">
                        <div className="w-24 h-24 bg-gradient-to-br from-electric via-neon to-purple-500 rounded-3xl flex items-center justify-center mx-auto shadow-2xl transform hover:scale-105 transition-transform duration-200 group">
                          <MessageSquare
                            className="text-white transform group-hover:rotate-12 transition-transform"
                            size={40}
                          />
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-br from-electric via-neon to-purple-500 rounded-3xl blur-xl opacity-50 animate-pulse"></div>
                      </div>
                      <div className="space-y-4">
                        <h3 className="font-grotesk font-bold text-4xl bg-gradient-to-r from-electric via-neon to-purple-400 bg-clip-text text-transparent">
                          Start Your Trading Journey
                        </h3>
                        <p className="text-cool-gray/90 max-w-md mx-auto text-lg leading-relaxed">
                          Get real-time insights, market analysis, and trading
                          strategies powered by our advanced AI ensemble
                          technology.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 max-w-4xl w-full px-4">
                      {suggestedQuestions.map((q) => (
                        <Button
                          key={q}
                          variant="outline"
                          className={cn(
                            "text-left h-auto py-2.5 px-3",
                            "border-electric/20 hover:border-electric/40",
                            "bg-gradient-to-r from-electric/5 to-transparent",
                            "hover:from-electric/10 hover:to-neon/5",
                            "transition-all duration-200 transform hover:scale-[1.02]",
                            "relative group overflow-hidden whitespace-nowrap text-ellipsis"
                          )}
                          onClick={() => {
                            setMessage(q);
                            inputRef.current?.focus();
                          }}
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-electric/0 via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                          <div className="flex items-center gap-2">
                            <MessageSquare
                              size={14}
                              className="text-electric group-hover:scale-110 transition-transform"
                            />
                            <span className="text-sm text-cool-gray/90 group-hover:text-white transition-colors">
                              {q}
                            </span>
                          </div>
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-6">
                      {chatHistory.map((msg) => (
                        <ChatMessageComponent key={msg.id} message={msg} />
                      ))}
                      {isTyping && (
                        <div
                          className="flex items-start space-x-4 animate-fade-in"
                          data-testid="typing-indicator"
                        >
                          <div className="relative">
                            <div className="w-10 h-10 bg-gradient-to-br from-electric to-neon rounded-xl flex items-center justify-center shadow-lg">
                              <Bot size={18} className="text-white" />
                            </div>
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald rounded-full animate-pulse"></div>
                          </div>
                          <div className="bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-sm rounded-2xl rounded-tl-sm p-4 border border-electric/20 shadow-lg">
                            <div className="flex items-center space-x-3">
                              <div className="flex space-x-1">
                                <div className="w-2.5 h-2.5 bg-electric rounded-full animate-bounce"></div>
                                <div className="w-2.5 h-2.5 bg-neon rounded-full animate-bounce [animation-delay:0.15s]"></div>
                                <div className="w-2.5 h-2.5 bg-purple-400 rounded-full animate-bounce [animation-delay:0.3s]"></div>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-white text-sm font-medium">
                                  AI is analyzing...
                                </span>
                                <span className="text-cool-gray text-xs">
                                  Processing market data
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>
              {/* Chat Input Area */}
              <div className="p-4 sm:p-6 border-t border-electric/10 bg-gradient-to-t from-electric/5 via-neon/5 to-transparent relative">
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-30" />
                <form
                  onSubmit={handleSendMessage}
                  className="space-y-3 relative"
                >
                  <div className="flex gap-3">
                    <div className="flex-1 relative group">
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-electric via-neon to-purple-500 rounded-xl blur opacity-30 group-hover:opacity-50 transition duration-200" />
                      <Input
                        ref={inputRef}
                        type="text"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Ask about crypto markets, trading strategies, or technical analysis..."
                        disabled={sendMessageMutation.isPending}
                        className="relative w-full h-12 bg-black/20 border-electric/20 group-hover:border-electric/30 focus:border-electric text-base text-white placeholder:text-cool-gray/60 rounded-xl px-4 backdrop-blur-sm transition-all duration-200 focus:shadow-lg focus:shadow-electric/20"
                        data-testid="input-chat-message"
                      />
                      {message.trim() && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-cool-gray/70 bg-white/10 px-2 py-0.5 rounded-full">
                          {message.length}
                        </div>
                      )}
                    </div>
                    <Button
                      type="submit"
                      disabled={
                        !message.trim() || sendMessageMutation.isPending
                      }
                      className={cn(
                        "relative h-12 bg-gradient-to-r from-electric to-neon hover:from-electric/90 hover:to-neon/90 text-white px-4 sm:px-6 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 group overflow-hidden",
                        "before:absolute before:inset-0 before:bg-gradient-to-r before:from-electric/0 before:via-white/20 before:to-electric/0 before:translate-x-[-200%] hover:before:translate-x-[200%] before:transition-transform before:duration-700"
                      )}
                      data-testid="button-send-message"
                    >
                      {sendMessageMutation.isPending ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span className="hidden sm:inline text-sm font-medium">
                            Processing...
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Send className="w-4 h-4 group-hover:scale-110 transition-transform" />
                          <span className="hidden sm:inline text-sm font-medium">
                            Send
                          </span>
                        </div>
                      )}
                    </Button>
                  </div>

                  <div className="flex items-center justify-between text-xs text-cool-gray/70">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-3 h-3 text-electric" />
                      <span className="hidden sm:inline">
                        Try asking about market analysis or trading patterns
                      </span>
                      <span className="sm:hidden">Ask about crypto trends</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 px-2 py-1 bg-white/5 rounded-lg">
                        <Brain size={12} className="text-electric" />
                        <select
                          value={aiStrategy}
                          onChange={(e) =>
                            setAiStrategy(e.target.value as typeof aiStrategy)
                          }
                          className="text-xs bg-transparent border-none outline-none text-cool-gray/70 cursor-pointer"
                        >
                          <option value="balanced">Balanced</option>
                          <option value="confidence">High Confidence</option>
                          <option value="speed">Fast Response</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-emerald rounded-full animate-pulse"></div>
                        <span>AI Ready</span>
                      </div>
                    </div>
                  </div>
                </form>

                {sendMessageMutation.isPending && (
                  <div className="mt-4 p-4 bg-electric/5 rounded-2xl border border-electric/20">
                    <div className="flex items-center space-x-3">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-electric rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-neon rounded-full animate-bounce [animation-delay:0.15s]"></div>
                        <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce [animation-delay:0.3s]"></div>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-white font-medium">
                          Processing request with AI ensemble...
                        </span>
                        <div className="flex items-center space-x-2 text-xs text-cool-gray mt-1">
                          <Brain size={12} className="text-electric" />
                          <span className="animate-pulse">
                            Analyzing market data and trends
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </GlassCard>
          </div>
        </div>
      </div>
    </div>
  );
}
