import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bot, PieChart, BarChart3, Thermometer } from "lucide-react";
import GlassCard from "@/components/ui/glass-card";
import PriceChart from "@/components/market/price-chart";
import MarketSummary from "@/components/market/market-summary";
import { useMarketData } from "@/hooks/use-market-data";
import { NoDataMessage } from "@/components/market/no-data-message";
import type {
  Coin,
  MarketData,
  MarketStats,
  Candle,
  ChartData,
} from "@/types/market";

// Market Stats Card Component

// Market Stats Card Component
const MarketStatCard = ({
  title,
  value,
  change,
  icon: Icon,
  iconClass = "text-electric",
}: {
  title: string;
  value: string;
  change?: string;
  icon: any;
  iconClass?: string;
}) => (
  <GlassCard className="p-6 transform hover:scale-[1.02] transition-transform">
    <div className="flex items-center justify-between mb-2">
      <span className="text-cool-gray text-sm font-medium">{title}</span>
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconClass}`}
      >
        <Icon size={18} />
      </div>
    </div>
    <div className="font-mono font-semibold text-2xl number-roll tracking-tight">
      {value}
    </div>
    {change && (
      <div
        className={`text-sm mt-1 ${
          change.startsWith("+") ? "text-emerald" : "text-red-400"
        }`}
      >
        {change}
      </div>
    )}
  </GlassCard>
);

// Coin List Item Component
const CoinListItem = ({
  coin,
  isSelected,
  onClick,
}: {
  coin: Coin;
  isSelected: boolean;
  onClick: () => void;
}) => (
  <div
    className={`flex items-center justify-between p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-all cursor-pointer border border-transparent ${
      isSelected ? "border-electric/50 bg-white/10" : ""
    }`}
    onClick={onClick}
  >
    <div className="flex items-center space-x-3 min-w-0">
      <div
        className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
          coin.symbol === "BTC"
            ? "bg-amber"
            : coin.symbol === "ETH"
            ? "bg-blue-500"
            : coin.symbol === "SOL"
            ? "bg-purple-500"
            : "bg-gradient-to-br from-electric to-neon"
        }`}
      >
        <span className="text-white text-sm font-bold">
          {coin.symbol.slice(0, 2)}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-medium truncate" title={coin.name}>
          {coin.name}
        </div>
        <div className="text-cool-gray text-sm flex items-center space-x-2">
          <span>{coin.symbol}</span>
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-cool-gray/30"></span>
          <span
            className={
              Number(coin.priceChangePercent24h || "0") >= 0
                ? "text-emerald"
                : "text-red-400"
            }
          >
            {Number(coin.priceChangePercent24h || "0") >= 0 ? "+" : ""}
            {Number(coin.priceChangePercent24h || "0").toFixed(2)}%
          </span>
        </div>
      </div>
    </div>
    <div className="text-right flex-shrink-0 ml-4">
      <div className="font-mono font-medium">
        ${Number(coin.price || "0").toLocaleString()}
      </div>
      <div className="text-sm text-cool-gray">
        Vol: ${(Number(coin.volume24h || "0") / 1e6).toFixed(2)}M
      </div>
    </div>
  </div>
);

export default function Market() {
  const { data, isLoading, error, isError, refetch } = useMarketData();
  const [selectedCoin, setSelectedCoin] = useState<Coin | null>(null);
  const [timeframe, setTimeframe] = useState<"24H" | "7D" | "30D">("24H");

  // Update selected coin when data changes if none is selected
  useEffect(() => {
    if (data?.data?.coins && data.data.coins.length > 0) {
      // If no coin is selected or the selected coin is not in the updated list

      if (
        !selectedCoin ||
        !data.data.coins.find((c: Coin) => c.symbol === selectedCoin.symbol)
      ) {
        setSelectedCoin(data.data.coins[0]);
      } else {
        // Update the selected coin's data
        const updatedCoin: Coin | undefined = data.data.coins.find(
          (c: Coin) => c.symbol === selectedCoin.symbol
        );
        if (
          updatedCoin &&
          JSON.stringify(updatedCoin) !== JSON.stringify(selectedCoin)
        ) {
          setSelectedCoin(updatedCoin);
        }
      }
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

  if (isError) {
    return (
      <div className="pt-20">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <GlassCard className="p-8 text-center">
            <p className="text-red-400">
              {error instanceof Error
                ? error.message
                : "Failed to load market data."}
            </p>
            <button
              onClick={() => refetch()}
              className="mt-4 px-4 py-2 bg-electric/20 hover:bg-electric/30 text-white rounded-lg transition-colors"
            >
              Try Again
            </button>
          </GlassCard>
        </div>
      </div>
    );
  }

  const marketStats = data?.data?.stats;
  const coins = data?.data?.coins || [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-navy-900 to-navy-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        {/* Header Section */}
        <div className="mb-8 space-y-2">
          <h1 className="font-grotesk font-bold text-4xl bg-gradient-to-r from-white to-cool-gray bg-clip-text text-transparent">
            Market Overview
          </h1>
          <p className="text-cool-gray/80 text-lg">
            Real-time cryptocurrency market data and analysis
          </p>
        </div>

        {/* Market Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
          <MarketStatCard
            title="Market Cap"
            value={marketStats?.totalMarketCap || "$1.73T"}
            change="+2.4% 24h"
            icon={PieChart}
            iconClass="text-electric bg-electric/10"
          />

          <MarketStatCard
            title="24h Volume"
            value={marketStats?.totalVolume24h || "$86.2B"}
            change="+12.1% 24h"
            icon={BarChart3}
            iconClass="text-neon bg-neon/10"
          />

          <MarketStatCard
            title="BTC Dominance"
            value={marketStats?.btcDominance || "52.4%"}
            change="-0.8% 24h"
            icon={({ size }: { size: number }) => (
              <div className="w-5 h-5 bg-amber rounded-full flex items-center justify-center">
                <span className="text-navy text-xs font-bold">₿</span>
              </div>
            )}
            iconClass=""
          />

          <MarketStatCard
            title="Fear & Greed"
            value={marketStats?.fearGreedIndex || "64"}
            change="Greed"
            icon={Thermometer}
            iconClass="text-amber bg-amber/10"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Price Chart Section */}
          <GlassCard className="p-6 h-[600px] flex flex-col backdrop-blur-lg">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center space-x-4">
                <h3 className="font-grotesk font-semibold text-2xl bg-gradient-to-r from-white to-cool-gray/90 bg-clip-text text-transparent">
                  Price Chart
                </h3>
                <select
                  className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-electric focus:ring-1 focus:ring-electric/50 transition-all"
                  value={selectedCoin?.symbol || "BTC"}
                  onChange={(e) => {
                    const coin: Coin | undefined = coins.find(
                      (c: Coin) =>
                        c.symbol === (e.target as HTMLSelectElement).value
                    );
                    if (coin) setSelectedCoin(coin);
                  }}
                >
                  {coins.map((coin: Coin) => (
                    <option key={coin.symbol} value={coin.symbol}>
                      {coin.name} ({coin.symbol})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex space-x-2 bg-white/5 rounded-lg p-1">
                {(["24H", "7D", "30D"] as const).map((period) => (
                  <button
                    key={period}
                    onClick={() => setTimeframe(period)}
                    className={`px-4 py-2 text-sm rounded-md transition-all ${
                      timeframe === period
                        ? "bg-electric text-white shadow-lg shadow-electric/20"
                        : "text-cool-gray hover:text-white"
                    }`}
                  >
                    {period}
                  </button>
                ))}
              </div>
            </div>

            {/* Market Details Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              {[
                {
                  label: "24h Volume",
                  value: `$${parseFloat(
                    selectedCoin?.volume24h || "0"
                  ).toLocaleString()}`,
                  bg: "bg-electric/5",
                },
                {
                  label: "24h High",
                  value: `$${(
                    parseFloat(selectedCoin?.price || "0") * 1.1
                  ).toLocaleString()}`,
                  bg: "bg-emerald/5",
                },
                {
                  label: "24h Low",
                  value: `$${(
                    parseFloat(selectedCoin?.price || "0") * 0.9
                  ).toLocaleString()}`,
                  bg: "bg-red-400/5",
                },
                {
                  label: "Sentiment",
                  value:
                    parseFloat(selectedCoin?.priceChangePercent24h || "0") >= 5
                      ? "Bullish"
                      : parseFloat(
                          selectedCoin?.priceChangePercent24h || "0"
                        ) <= -5
                      ? "Bearish"
                      : "Neutral",
                  className:
                    parseFloat(selectedCoin?.priceChangePercent24h || "0") >= 0
                      ? "text-emerald"
                      : "text-red-400",
                },
              ].map((item, index) => (
                <div
                  key={item.label}
                  className={`${
                    item.bg || "bg-white/5"
                  } rounded-xl p-4 backdrop-blur-sm border border-white/5`}
                >
                  <div className="text-cool-gray text-sm mb-2">
                    {item.label}
                  </div>
                  <div
                    className={`font-mono font-medium text-sm truncate ${
                      item.className || ""
                    }`}
                  >
                    {item.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Price Chart */}
            <div className="flex-1 min-h-0 relative group">
              <div className="absolute inset-0 bg-gradient-to-b from-electric/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
            </div>

            <div className="flex-1 min-h-0 relative group">
              <div className="absolute inset-0 bg-gradient-to-b from-electric/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
              <PriceChart
                isLoading={isLoading}
                error={error}
                data={{
                  symbol: selectedCoin?.symbol || coins[0]?.symbol || "BTC",
                  interval:
                    timeframe === "24H"
                      ? "1h"
                      : timeframe === "7D"
                      ? "4h"
                      : "1d",
                  candles: selectedCoin?.candles || [],
                  indicators: {
                    rsi: 50,
                    sma20: parseFloat(
                      selectedCoin?.price || coins[0]?.price || "0"
                    ),
                    priceChange24h: parseFloat(
                      selectedCoin?.priceChangePercent24h || "0"
                    ),
                    volumeChange24h: 0,
                  },
                  lastUpdated: new Date().toISOString(),
                }}
                onSelectCoin={(symbol: string) => {
                  const coin = coins.find((c: Coin) => c.symbol === symbol);
                  if (coin) setSelectedCoin(coin);
                }}
              />
            </div>
          </GlassCard>

          {/* Top Cryptocurrencies */}
          <div className="flex flex-col h-[600px]">
            <GlassCard className="flex-1 p-6 backdrop-blur-lg overflow-hidden">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-grotesk font-semibold text-2xl bg-gradient-to-r from-white to-cool-gray/90 bg-clip-text text-transparent">
                  Top Cryptocurrencies
                </h3>
                <div className="flex items-center space-x-2 text-sm text-cool-gray">
                  <span>24h Change</span>
                  <span className="inline-block w-2 h-2 rounded-full bg-cool-gray/30"></span>
                  <span>Volume</span>
                </div>
              </div>

              <div className="space-y-3 overflow-y-auto h-[calc(100%-4rem)] pr-2 scrollbar-thin scrollbar-thumb-electric/20 scrollbar-track-white/5">
                {coins.map((coin: Coin) => (
                  <CoinListItem
                    key={coin.symbol}
                    coin={coin}
                    isSelected={selectedCoin?.symbol === coin.symbol}
                    onClick={() => setSelectedCoin(coin)}
                  />
                ))}
              </div>
            </GlassCard>
          </div>
        </div>

        {/* AI Market Summary */}
        <div className="mt-8">
          <GlassCard className="p-6 backdrop-blur-lg border border-white/5">
            <div className="flex items-center space-x-4 mb-6">
              <div className="w-12 h-12 bg-gradient-to-r from-electric to-neon rounded-xl flex items-center justify-center pulse-glow shadow-lg shadow-electric/20">
                <Bot className="text-white" size={24} />
              </div>
              <div>
                <h3 className="font-grotesk font-semibold text-2xl bg-gradient-to-r from-white to-cool-gray/90 bg-clip-text text-transparent">
                  AI Market Analysis
                </h3>
                <p className="text-cool-gray text-sm">
                  Real-time insights powered by advanced AI
                </p>
              </div>
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
