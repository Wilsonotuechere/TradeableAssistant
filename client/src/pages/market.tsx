import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, PieChart, BarChart3, Thermometer } from "lucide-react";
import GlassCard from "@/components/ui/glass-card";
import PriceChart from "@/components/market/price-chart";
import { Bot } from "lucide-react";

export default function Market() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/market'],
    refetchInterval: 60000 // Refetch every minute
  });

  if (isLoading) {
    return (
      <div className="pt-20">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-white/10 rounded mb-4"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-32 bg-white/10 rounded-2xl"></div>
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
        <div className="max-w-7xl mx-auto px-6 py-8">
          <GlassCard className="p-8 text-center">
            <p className="text-red-400">Failed to load market data. Please try again later.</p>
          </GlassCard>
        </div>
      </div>
    );
  }

  const marketStats = data?.data?.stats;
  const coins = data?.data?.coins || [];

  return (
    <div className="pt-20">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="font-grotesk font-bold text-3xl mb-2">Market Overview</h1>
          <p className="text-cool-gray">Real-time cryptocurrency market data and analysis</p>
        </div>

        {/* Market Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <GlassCard className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-cool-gray">Market Cap</span>
              <PieChart className="text-electric" size={20} />
            </div>
            <div className="font-mono font-semibold text-2xl number-roll">
              {marketStats?.totalMarketCap || '$1.73T'}
            </div>
            <div className="text-emerald text-sm">+2.4% 24h</div>
          </GlassCard>
          
          <GlassCard className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-cool-gray">24h Volume</span>
              <BarChart3 className="text-neon" size={20} />
            </div>
            <div className="font-mono font-semibold text-2xl number-roll">
              {marketStats?.totalVolume24h || '$86.2B'}
            </div>
            <div className="text-emerald text-sm">+12.1% 24h</div>
          </GlassCard>
          
          <GlassCard className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-cool-gray">BTC Dominance</span>
              <div className="w-5 h-5 bg-amber rounded-full flex items-center justify-center">
                <span className="text-navy text-xs font-bold">₿</span>
              </div>
            </div>
            <div className="font-mono font-semibold text-2xl number-roll">
              {marketStats?.btcDominance || '52.4%'}
            </div>
            <div className="text-red-400 text-sm">-0.8% 24h</div>
          </GlassCard>
          
          <GlassCard className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-cool-gray">Fear & Greed</span>
              <Thermometer className="text-amber" size={20} />
            </div>
            <div className="font-mono font-semibold text-2xl number-roll">
              {marketStats?.fearGreedIndex || '64'}
            </div>
            <div className="text-amber text-sm">Greed</div>
          </GlassCard>
        </div>

        {/* Charts and Top Cryptos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Price Chart */}
          <GlassCard className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-grotesk font-semibold text-xl">Bitcoin Price Chart</h3>
              <div className="flex space-x-2">
                <button className="px-3 py-1 text-sm bg-electric/20 text-electric rounded-lg">24H</button>
                <button className="px-3 py-1 text-sm text-cool-gray hover:text-electric">7D</button>
                <button className="px-3 py-1 text-sm text-cool-gray hover:text-electric">30D</button>
              </div>
            </div>
            <PriceChart />
          </GlassCard>

          {/* Top Cryptocurrencies */}
          <GlassCard className="p-6">
            <h3 className="font-grotesk font-semibold text-xl mb-6">Top Cryptocurrencies</h3>
            <div className="space-y-4">
              {coins.map((coin: any, index: number) => (
                <div
                  key={coin.symbol}
                  className="flex items-center justify-between p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      coin.symbol === 'BTC' ? 'bg-amber' : 
                      coin.symbol === 'ETH' ? 'bg-blue-500' :
                      coin.symbol === 'SOL' ? 'bg-purple-500' : 'bg-blue-400'
                    }`}>
                      <span className="text-white text-xs font-bold">
                        {coin.symbol === 'BTC' ? '₿' : 
                         coin.symbol === 'ETH' ? 'Ξ' : 
                         coin.symbol.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <div className="font-medium">{coin.name}</div>
                      <div className="text-cool-gray text-sm">{coin.symbol}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-medium">
                      ${parseFloat(coin.price).toLocaleString()}
                    </div>
                    <div className={`text-sm ${
                      parseFloat(coin.priceChangePercent24h) >= 0 ? 'text-emerald' : 'text-red-400'
                    }`}>
                      {parseFloat(coin.priceChangePercent24h) >= 0 ? '+' : ''}
                      {coin.priceChangePercent24h}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>

        {/* AI Market Summary */}
        <div className="mt-8">
          <GlassCard className="p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-r from-electric to-neon rounded-full flex items-center justify-center pulse-glow">
                <Bot className="text-white" size={20} />
              </div>
              <h3 className="font-grotesk font-semibold text-xl">AI Market Summary</h3>
            </div>
            <div className="space-y-3">
              <p>
                Today's crypto market is showing strong bullish momentum with Bitcoin leading the charge above $43,000. 
                This price action is supported by increased institutional interest and positive regulatory developments.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 bg-emerald/20 text-emerald rounded-full text-sm">Bullish Sentiment</span>
                <span className="px-3 py-1 bg-electric/20 text-electric rounded-full text-sm">High Volume</span>
                <span className="px-3 py-1 bg-neon/20 text-neon rounded-full text-sm">Institutional Interest</span>
              </div>
              <p className="text-sm text-cool-gray italic">This is information, not financial advice.</p>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
