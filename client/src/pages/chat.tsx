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
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, isTyping]);

  // Focus input on component mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (userMessage: string) => {
      const response = await fetch("/api/chat/enhanced", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          preferences: {
            aiStrategy: "confidence",
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
    "What's the current Bitcoin price?",
    "Explain what RSI means in trading",
    "Show me the latest crypto news sentiment",
    "What's happening in the DeFi market?",
    "Analyze Solana's recent performance",
  ];

  return (
    <div className="pt-20">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <GlassCard className="min-h-[80vh] flex flex-col">
          {/* Chat Header */}
          <div className="p-6 border-b border-electric/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-electric to-neon rounded-full flex items-center justify-center pulse-glow">
                  <Sparkles className="text-white" size={20} />
                </div>
                <div>
                  <h2 className="font-grotesk font-semibold text-xl">
                    AI Trading Assistant
                  </h2>
                  <div className="flex items-center space-x-2 text-cool-gray text-sm">
                    <Brain size={14} />
                    <span>Multi-Model AI | </span>
                    <TrendingUp size={14} />
                    <span>Real-Time Market Data</span>
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearHistory}
                disabled={chatHistory.length === 0}
                className="text-cool-gray hover:text-white"
              >
                <Trash2 size={16} className="mr-2" />
                Clear Chat
              </Button>
            </div>
          </div>

          {/* Chat Messages */}
          <div
            className="flex-1 p-6 space-y-6 overflow-y-auto"
            style={{ maxHeight: "calc(80vh - 140px)" }}
          >
            {chatHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full space-y-6 text-center">
                <div className="space-y-4">
                  <div className="w-16 h-16 bg-gradient-to-r from-electric to-neon rounded-full flex items-center justify-center mx-auto pulse-glow">
                    <MessageSquare className="text-white" size={32} />
                  </div>
                  <h3 className="font-grotesk font-semibold text-2xl">
                    Start Your Trading Journey
                  </h3>
                  <p className="text-cool-gray max-w-md mx-auto">
                    Get real-time insights, market analysis, and trading
                    strategies powered by our advanced AI ensemble technology.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl w-full">
                  {suggestedQuestions.map((q) => (
                    <Button
                      key={q}
                      variant="outline"
                      className="text-left h-auto py-3 border-electric/30 hover:bg-electric/10"
                      onClick={() => {
                        setMessage(q);
                        inputRef.current?.focus();
                      }}
                    >
                      <MessageSquare size={14} className="mr-2 text-electric" />
                      {q}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {chatHistory.map((msg) => (
                  <ChatMessageComponent key={msg.id} message={msg} />
                ))}
                {isTyping && (
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-r from-electric to-neon rounded-full flex items-center justify-center pulse-glow">
                      <Sparkles className="text-white" size={16} />
                    </div>
                    <div className="bg-white/10 backdrop-blur rounded-2xl rounded-tl-sm p-4">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-electric rounded-full animate-pulse"></div>
                        <div
                          className="w-2 h-2 bg-electric rounded-full animate-pulse"
                          style={{ animationDelay: "0.2s" }}
                        ></div>
                        <div
                          className="w-2 h-2 bg-electric rounded-full animate-pulse"
                          style={{ animationDelay: "0.4s" }}
                        ></div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Chat Input */}
          <div className="p-6 border-t border-electric/20">
            <form onSubmit={handleSendMessage} className="flex space-x-4">
              <div className="relative flex-1">
                <Input
                  ref={inputRef}
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Ask about crypto markets, trading strategies, or news..."
                  disabled={sendMessageMutation.isPending}
                  className="bg-white/5 border-electric/30 focus:border-electric pr-12"
                />
                {message.trim() && (
                  <Button
                    type="submit"
                    size="sm"
                    variant="ghost"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-electric hover:text-white"
                    disabled={sendMessageMutation.isPending}
                  >
                    <Send size={16} />
                  </Button>
                )}
              </div>
            </form>

            {sendMessageMutation.isPending && (
              <div className="mt-2 flex items-center justify-between text-xs text-cool-gray">
                <span>Processing request with AI ensemble...</span>
                <div className="flex items-center space-x-1">
                  <Brain size={12} className="text-electric" />
                  <span className="animate-pulse">Analyzing market data</span>
                </div>
              </div>
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
