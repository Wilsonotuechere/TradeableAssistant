import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Bot, Send } from "lucide-react";
import GlassCard from "@/components/ui/glass-card";
import ChatMessageComponent from "@/components/chat/chat-message";
import { apiRequest } from "@/lib/queryClient";
import type { ChatMessage } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: "Hi! I'm your crypto trading assistant. I can help you understand market trends, analyze news sentiment, and explain complex trading concepts in simple terms.\n\nThis is information, not financial advice.",
      timestamp: new Date().toISOString()
    }
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const { toast } = useToast();

  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiRequest('POST', '/api/chat', { message });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setMessages(prev => [...prev, data.data.userMessage, data.data.assistantMessage]);
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to send message",
          variant: "destructive"
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleSendMessage = () => {
    if (!inputMessage.trim() || sendMessageMutation.isPending) return;
    
    sendMessageMutation.mutate(inputMessage);
    setInputMessage("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="pt-20">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <GlassCard className="min-h-[80vh] flex flex-col">
          {/* Chat Header */}
          <div className="p-6 border-b border-electric/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-electric to-neon rounded-full flex items-center justify-center pulse-glow">
                  <Bot className="text-white" size={20} />
                </div>
                <div>
                  <h2 className="font-grotesk font-semibold text-xl">AI Trading Assistant</h2>
                  <p className="text-cool-gray text-sm">Ask me anything about crypto markets</p>
                </div>
              </div>
              <div className="text-emerald text-sm flex items-center">
                <div className="w-2 h-2 bg-emerald rounded-full mr-2"></div>
                Online
              </div>
            </div>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 p-6 space-y-6 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 140px)' }}>
            {messages.map((message) => (
              <ChatMessageComponent key={message.id} message={message} />
            ))}
            
            {sendMessageMutation.isPending && (
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-electric to-neon rounded-full flex items-center justify-center pulse-glow">
                  <Bot className="text-white" size={16} />
                </div>
                <div className="bg-white/10 backdrop-blur rounded-2xl rounded-tl-sm p-4">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-electric rounded-full animate-pulse"></div>
                    <div className="w-2 h-2 bg-electric rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 bg-electric rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Chat Input */}
          <div className="p-6 border-t border-electric/20">
            <div className="flex space-x-4">
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me about crypto markets, news, or trading concepts..."
                className="flex-1 bg-white/5 border border-electric/30 rounded-xl px-4 py-3 focus:outline-none focus:border-electric transition-colors resize-none"
                rows={1}
                disabled={sendMessageMutation.isPending}
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || sendMessageMutation.isPending}
                className="px-6 py-3 bg-gradient-to-r from-electric to-neon rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send size={20} />
              </button>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
