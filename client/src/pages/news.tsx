import { useQuery } from "@tanstack/react-query";
import GlassCard from "@/components/ui/glass-card";
import NewsCard from "@/components/news/news-card";
import { Hash, TrendingUp } from "lucide-react";

export default function News() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/news'],
    refetchInterval: 5 * 60 * 1000 // Refetch every 5 minutes
  });

  if (isLoading) {
    return (
      <div className="pt-20">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-white/10 rounded mb-4"></div>
            <div className="h-40 bg-white/10 rounded-2xl mb-8"></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-96 bg-white/10 rounded-2xl"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pt-20">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <GlassCard className="p-8 text-center">
            <p className="text-red-400">Failed to load news data. Please try again later.</p>
          </GlassCard>
        </div>
      </div>
    );
  }

  const sentiment = data?.data?.sentiment;
  const articles = data?.data?.articles || [];

  return (
    <div className="pt-20">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="font-grotesk font-bold text-3xl mb-2">News & Sentiment</h1>
          <p className="text-cool-gray">Latest crypto news with AI-powered sentiment analysis</p>
        </div>

        {/* Market Mood Indicator */}
        <div className="mb-8">
          <GlassCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-grotesk font-semibold text-xl">Market Mood</h3>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-emerald rounded-full animate-pulse"></div>
                <span className="text-emerald text-sm capitalize">{sentiment?.mood || 'Bullish'}</span>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-emerald/20 rounded-xl">
                <div className="text-2xl mb-2">😊</div>
                <div className="text-emerald font-semibold">Positive</div>
                <div className="text-emerald text-sm">{sentiment?.positive || 64}%</div>
              </div>
              <div className="text-center p-4 bg-amber/20 rounded-xl">
                <div className="text-2xl mb-2">😐</div>
                <div className="text-amber font-semibold">Neutral</div>
                <div className="text-amber text-sm">{sentiment?.neutral || 28}%</div>
              </div>
              <div className="text-center p-4 bg-red-500/20 rounded-xl">
                <div className="text-2xl mb-2">😟</div>
                <div className="text-red-400 font-semibold">Negative</div>
                <div className="text-red-400 text-sm">{sentiment?.negative || 8}%</div>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* News Articles */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {articles.map((article: any) => (
            <NewsCard key={article.id} article={article} />
          ))}
        </div>

        {/* Social Sentiment */}
        <GlassCard className="p-6">
          <h3 className="font-grotesk font-semibold text-xl mb-6">Social Media Sentiment</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="font-medium text-electric">Top Trending Topics</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <span className="flex items-center"><Hash className="mr-1" size={16} />Bitcoin</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-emerald rounded-full"></div>
                    <span className="text-emerald text-sm">+34.2K</span>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <span className="flex items-center"><Hash className="mr-1" size={16} />Ethereum</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-emerald rounded-full"></div>
                    <span className="text-emerald text-sm">+18.7K</span>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <span className="flex items-center"><Hash className="mr-1" size={16} />DeFi</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-amber rounded-full"></div>
                    <span className="text-amber text-sm">+9.3K</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <h4 className="font-medium text-electric">Recent Mentions</h4>
              <div className="space-y-3">
                <div className="p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-cool-gray text-sm">@CryptoAnalyst</span>
                    <span className="px-2 py-1 bg-emerald/20 text-emerald text-xs rounded">Positive</span>
                  </div>
                  <p className="text-sm">
                    "Bitcoin's technical indicators are looking incredibly strong right now. This could be the start of another major bull run! 🚀"
                  </p>
                </div>
                <div className="p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-cool-gray text-sm">@DeFiTrader</span>
                    <span className="px-2 py-1 bg-emerald/20 text-emerald text-xs rounded">Positive</span>
                  </div>
                  <p className="text-sm">
                    "Ethereum's network activity is through the roof. The ecosystem is thriving! 💎"
                  </p>
                </div>
              </div>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
