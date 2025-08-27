import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp,
  TrendingDown,
  PieChart,
  BarChart3,
  Thermometer,
} from "lucide-react";
import GlassCard from "@/components/ui/glass-card";
import PriceChart from "@/components/market/price-chart";
import MarketSummary from "@/components/market/market-summary";
import { Bot } from "lucide-react";
import { useState, useEffect } from "react";

interface Coin {
  symbol: string;
  name: string;
  price: string;
  priceChangePercent24h: string;
  volume24h: string;
  marketCap: string;
  candles?: Array<{
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
}

interface MarketData {
  data: {
    coins: Coin[];
    stats: {
      totalMarketCap: string;
      totalVolume24h: string;
      btcDominance: string;
      fearGreedIndex: string;
    };
  };
}

import { useMarketData } from "@/hooks/use-market-data";

export default function Market() {
  const { data, isLoading, error } = useMarketData();

  const [selectedCoin, setSelectedCoin] = useState<Coin | null>(null);

  // Update selected coin when data changes if none is selected
  useEffect(() => {
    if (!selectedCoin && data?.data?.coins && data.data.coins.length > 0) {
      setSelectedCoin(data.data.coins[0]);
    }
  }, [data, selectedCoin]);

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
            <p className="text-red-400">
              Failed to load market data. Please try again later.
            </p>
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
          <h1 className="font-grotesk font-bold text-3xl mb-2">
            Market Overview
          </h1>
          <p className="text-cool-gray">
            Real-time cryptocurrency market data and analysis
          </p>
        </div>

        {/* Market Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <GlassCard className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-cool-gray">Market Cap</span>
              <PieChart className="text-electric" size={20} />
            </div>
            <div className="font-mono font-semibold text-2xl number-roll">
              {marketStats?.totalMarketCap || "$1.73T"}
            </div>
            <div className="text-emerald text-sm">+2.4% 24h</div>
          </GlassCard>

          <GlassCard className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-cool-gray">24h Volume</span>
              <BarChart3 className="text-neon" size={20} />
            </div>
            <div className="font-mono font-semibold text-2xl number-roll">
              {marketStats?.totalVolume24h || "$86.2B"}
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
              {marketStats?.btcDominance || "52.4%"}
            </div>
            <div className="text-red-400 text-sm">-0.8% 24h</div>
          </GlassCard>

          <GlassCard className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-cool-gray">Fear & Greed</span>
              <Thermometer className="text-amber" size={20} />
            </div>
            <div className="font-mono font-semibold text-2xl number-roll">
              {marketStats?.fearGreedIndex || "64"}
            </div>
            <div className="text-amber text-sm">Greed</div>
          </GlassCard>
        </div>

        {/* Charts and Top Cryptos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Price Chart */}
          <GlassCard className="p-6 h-[500px] flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-4">
                <h3 className="font-grotesk font-semibold text-xl">
                  Price Chart
                </h3>
                <select
                  className="bg-white/10 border border-white/20 rounded-lg px-3 py-1 text-sm focus:outline-none focus:border-electric"
                  value={selectedCoin?.symbol || "BTC"}
                  onChange={(e) => {
                    const coin: Coin | undefined = coins.find(
                      (c: Coin): boolean => c.symbol === e.target.value
                    );
                    if (coin) setSelectedCoin(coin);
                  }}
                >
                  {coins.map(
                    (coin: Coin): JSX.Element => (
                      <option key={coin.symbol} value={coin.symbol}>
                        {coin.name} ({coin.symbol})
                      </option>
                    )
                  )}
                </select>
              </div>
              <div className="flex space-x-2">
                <button className="px-3 py-1 text-sm bg-electric/20 text-electric rounded-lg">
                  24H
                </button>
                <button className="px-3 py-1 text-sm text-cool-gray hover:text-electric">
                  7D
                </button>
                <button className="px-3 py-1 text-sm text-cool-gray hover:text-electric">
                  30D
                </button>
              </div>
            </div>

            {/* Market Details */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-white/5 rounded-lg p-3">
                <div className="text-cool-gray text-sm mb-1">24h Volume</div>
                <div
                  className="font-mono font-medium text-sm truncate"
                  title={`$${parseFloat(
                    selectedCoin?.volume24h || "0"
                  ).toLocaleString()}`}
                >
                  ${parseFloat(selectedCoin?.volume24h || "0").toLocaleString()}
                </div>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <div className="text-cool-gray text-sm mb-1">24h High</div>
                <div
                  className="font-mono font-medium text-sm truncate"
                  title={`$${(
                    parseFloat(selectedCoin?.price || "0") * 1.1
                  ).toLocaleString()}`}
                >
                  $
                  {(
                    parseFloat(selectedCoin?.price || "0") * 1.1
                  ).toLocaleString()}
                </div>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <div className="text-cool-gray text-sm mb-1">24h Low</div>
                <div
                  className="font-mono font-medium text-sm truncate"
                  title={`$${(
                    parseFloat(selectedCoin?.price || "0") * 0.9
                  ).toLocaleString()}`}
                >
                  $
                  {(
                    parseFloat(selectedCoin?.price || "0") * 0.9
                  ).toLocaleString()}
                </div>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <div className="text-cool-gray text-sm mb-1">Sentiment</div>
                <div
                  className={`font-medium text-sm ${
                    parseFloat(selectedCoin?.priceChangePercent24h || "0") >= 0
                      ? "text-emerald"
                      : "text-red-400"
                  }`}
                >
                  {parseFloat(selectedCoin?.priceChangePercent24h || "0") >= 5
                    ? "Bullish"
                    : parseFloat(selectedCoin?.priceChangePercent24h || "0") <=
                      -5
                    ? "Bearish"
                    : "Neutral"}
                </div>
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <PriceChart
                data={{
                  symbol: selectedCoin?.symbol || coins[0]?.symbol || "BTC",
                  interval: "1d",
                  candles: Array.isArray(selectedCoin?.candles)
                    ? selectedCoin.candles
                    : Array.isArray(coins[0]?.candles)
                    ? coins[0].candles
                    : Array.from({ length: 24 }, (_, i) => ({
                        time: Date.now() - (23 - i) * 3600000,
                        open: parseFloat(
                          String(selectedCoin?.price || coins[0]?.price || 0)
                        ),
                        high:
                          parseFloat(
                            String(selectedCoin?.price || coins[0]?.price || 0)
                          ) *
                          (1 + Math.random() * 0.01),
                        low:
                          parseFloat(
                            String(selectedCoin?.price || coins[0]?.price || 0)
                          ) *
                          (1 - Math.random() * 0.01),
                        close: parseFloat(
                          String(selectedCoin?.price || coins[0]?.price || 0)
                        ),
                        volume:
                          parseFloat(
                            String(
                              selectedCoin?.volume24h ||
                                coins[0]?.volume24h ||
                                0
                            )
                          ) / 24,
                      })),
                  indicators: {
                    rsi: 50,
                    sma20: parseFloat(
                      String(selectedCoin?.price || coins[0]?.price || 0)
                    ),
                    priceChange24h: parseFloat(
                      String(selectedCoin?.priceChangePercent24h || 0)
                    ),
                    volumeChange24h: 0,
                  },
                  lastUpdated: new Date().toISOString(),
                }}
                isLoading={isLoading}
                error={error}
                onSelectCoin={(symbol) => {
                  const coin: Coin | undefined = coins.find(
                    (c: Coin): boolean => c.symbol === symbol
                  );
                  if (coin) {
                    setSelectedCoin(coin);
                  }
                }}
              />
            </div>
          </GlassCard>

          {/* Top Cryptocurrencies */}
          <GlassCard className="p-6">
            <h3 className="font-grotesk font-semibold text-xl mb-6">
              Top Cryptocurrencies
            </h3>
            <div className="space-y-4">
              {coins.map((coin: Coin) => (
                <div
                  key={coin.symbol}
                  className={`flex items-center justify-between p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer ${
                    selectedCoin?.symbol === coin.symbol ? "bg-white/10" : ""
                  }`}
                  onClick={() => setSelectedCoin(coin)}
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <div
                      className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                        coin.symbol === "BTC"
                          ? "bg-amber"
                          : coin.symbol === "ETH"
                          ? "bg-blue-500"
                          : coin.symbol === "SOL"
                          ? "bg-purple-500"
                          : "bg-blue-400"
                      }`}
                    >
                      <span className="text-white text-xs font-bold">
                        {coin.symbol === "BTC"
                          ? "₿"
                          : coin.symbol === "ETH"
                          ? "Ξ"
                          : coin.symbol.charAt(0)}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate" title={coin.name}>
                        {coin.name}
                      </div>
                      <div className="text-cool-gray text-sm">
                        {coin.symbol}
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    <div className="font-mono font-medium whitespace-nowrap">
                      ${Number(coin.price || "0").toLocaleString()}
                    </div>
                    <div
                      className={`text-sm whitespace-nowrap ${
                        Number(coin.priceChangePercent24h || "0") >= 0
                          ? "text-emerald"
                          : "text-red-400"
                      }`}
                    >
                      {Number(coin.priceChangePercent24h || "0") >= 0
                        ? "+"
                        : ""}
                      {Number(coin.priceChangePercent24h || "0").toFixed(2)}%
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
              <h3 className="font-grotesk font-semibold text-xl">
                AI Market Analysis
              </h3>
            </div>
            {isLoading ? (
              <div className="animate-pulse space-y-4">
                <div className="h-20 bg-white/10 rounded-xl"></div>
                <div className="h-32 bg-white/10 rounded-xl"></div>
              </div>
            ) : error ? (
              <div className="p-4 bg-white/5 rounded-xl">
                <p className="text-red-400">
                  Sorry, I'm having trouble connecting right now. Please try
                  again in a moment.
                </p>
              </div>
            ) : selectedCoin ? (
              <div className="space-y-4">
                <MarketSummary
                  symbol={selectedCoin.symbol}
                  price={Number(selectedCoin.price) || 0}
                  priceChange24h={
                    Number(selectedCoin.priceChangePercent24h) || 0
                  }
                  volume24h={Number(selectedCoin.volume24h) || 0}
                />
                <div className="mt-4 p-4 bg-white/5 rounded-xl">
                  <h4 className="text-lg font-medium mb-2">
                    Technical Analysis
                  </h4>
                  <p className="text-cool-gray">
                    {(() => {
                      try {
                        const priceChange =
                          Number(selectedCoin.priceChangePercent24h) || 0;
                        const volume = Number(selectedCoin.volume24h) || 0;
                        const sentiment =
                          priceChange >= 5
                            ? "bullish momentum"
                            : priceChange <= -5
                            ? "bearish pressure"
                            : "neutral movement";
                        const changeWord =
                          priceChange >= 0 ? "gain" : "decline";

                        return `${
                          selectedCoin.name
                        } shows ${sentiment} with a ${Math.abs(
                          priceChange
                        ).toFixed(
                          2
                        )}% ${changeWord} in the last 24 hours. Trading volume of $${volume.toLocaleString()} indicates ${
                          volume > 1000000000 ? "strong" : "moderate"
                        } market interest.`;
                      } catch (error) {
                        return "Analyzing market data...";
                      }
                    })()}
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-cool-gray text-sm">
                        Support Levels
                      </div>
                      <div
                        className="font-mono text-sm truncate"
                        title={`$${(
                          Number(selectedCoin.price) * 0.95
                        ).toLocaleString()} | $${(
                          Number(selectedCoin.price) * 0.9
                        ).toLocaleString()}`}
                      >
                        ${(Number(selectedCoin.price) * 0.95).toLocaleString()}{" "}
                        | ${(Number(selectedCoin.price) * 0.9).toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-cool-gray text-sm">
                        Resistance Levels
                      </div>
                      <div
                        className="font-mono text-sm truncate"
                        title={`$${(
                          Number(selectedCoin.price) * 1.05
                        ).toLocaleString()} | $${(
                          Number(selectedCoin.price) * 1.1
                        ).toLocaleString()}`}
                      >
                        ${(Number(selectedCoin.price) * 1.05).toLocaleString()}{" "}
                        | ${(Number(selectedCoin.price) * 1.1).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
