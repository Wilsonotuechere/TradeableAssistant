import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Trash2, Search, ChevronRight, BarChart3, Newspaper, GraduationCap, HelpCircle } from "lucide-react";
import GlassCard from "@/components/ui/glass-card";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const categoryIcons = {
  "Market Analysis": BarChart3,
  "News & Sentiment": Newspaper,
  "Educational": GraduationCap,
  "Trading Questions": HelpCircle,
};

const categoryColors = {
  "Market Analysis": "bg-emerald/20 text-emerald",
  "News & Sentiment": "bg-neon/20 text-neon",
  "Educational": "bg-amber/20 text-amber",
  "Trading Questions": "bg-electric/20 text-electric",
};

export default function History() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All Topics");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/chat/history']
  });

  const clearHistoryMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('DELETE', '/api/chat/history');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/chat/history'] });
      toast({
        title: "Success",
        description: "Chat history cleared successfully"
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to clear chat history",
        variant: "destructive"
      });
    }
  });

  const filteredHistory = (data?.data || []).filter((chat: any) => {
    const matchesSearch = chat.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "All Topics" || chat.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (isLoading) {
    return (
      <div className="pt-20">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-white/10 rounded"></div>
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-white/10 rounded-2xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pt-20">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <GlassCard className="p-8 text-center">
            <p className="text-red-400">Failed to load chat history. Please try again later.</p>
          </GlassCard>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-20">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-grotesk font-bold text-3xl mb-2">Chat History</h1>
            <p className="text-cool-gray">Your previous conversations with the AI assistant</p>
          </div>
          <button
            onClick={() => clearHistoryMutation.mutate()}
            disabled={clearHistoryMutation.isPending}
            className="px-4 py-2 bg-red-500/20 text-red-400 rounded-xl hover:bg-red-500/30 transition-colors disabled:opacity-50"
          >
            <Trash2 className="mr-2 inline" size={16} />
            Clear History
          </button>
        </div>

        {/* Search and Filter */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-cool-gray" size={20} />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white/5 border border-electric/30 rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-electric transition-colors"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-white/5 border border-electric/30 rounded-xl px-4 py-3 focus:outline-none focus:border-electric text-off-white"
            >
              <option value="All Topics">All Topics</option>
              <option value="Market Analysis">Market Analysis</option>
              <option value="News & Sentiment">News & Sentiment</option>
              <option value="Trading Questions">Trading Questions</option>
              <option value="Educational">Educational</option>
            </select>
          </div>
        </div>

        {/* Conversation History */}
        {filteredHistory.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <p className="text-cool-gray">No conversations found. Start chatting to build your history!</p>
          </GlassCard>
        ) : (
          <div className="space-y-6">
            {filteredHistory.map((chat: any) => {
              const IconComponent = categoryIcons[chat.category as keyof typeof categoryIcons] || HelpCircle;
              const categoryColor = categoryColors[chat.category as keyof typeof categoryColors] || "bg-electric/20 text-electric";
              const messageCount = Array.isArray(chat.messages) ? chat.messages.length : 0;
              const timeAgo = new Date(chat.createdAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
              });
              
              return (
                <GlassCard key={chat.id} hover className="p-6 cursor-pointer">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${categoryColor}`}>
                        <IconComponent size={16} />
                      </div>
                      <div>
                        <h3 className="font-medium">{chat.title}</h3>
                        <p className="text-cool-gray text-sm">{timeAgo}</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm ${categoryColor}`}>
                      {chat.category}
                    </span>
                  </div>
                  <p className="text-cool-gray mb-3 line-clamp-2">
                    {Array.isArray(chat.messages) && chat.messages.length > 0
                      ? chat.messages[0].content
                      : "Conversation about cryptocurrency markets and trading strategies."
                    }
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-cool-gray text-sm">{messageCount} messages</span>
                    <ChevronRight className="text-electric" size={16} />
                  </div>
                </GlassCard>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
