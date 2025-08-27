import { FC, useState } from "react";
import { BarChart3, RefreshCw, Bot } from "lucide-react";
import { Button } from "../ui/button";
import MarketSummary from "./market-summary";
import { ChartComponent } from "./chart-component";
import PriceChart from "./price-chart";
import GlassCard from "../ui/glass-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Badge } from "../ui/badge";

interface ChartSectionProps {
  data: {
    symbol: string;
    interval: string;
    candles: Array<{
      time: number;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    }>;
    indicators: {
      rsi: number;
      sma20: number;
      priceChange24h: number;
      volumeChange24h: number;
    };
    lastUpdated: string;
  };
  isLoading: boolean;
  error: Error | null;
  onIntervalChange: (interval: string) => void;
  onRefresh: () => void;
  selectedInterval: string;
  availableCoins: Array<{
    symbol: string;
    name: string;
    price: number;
    priceChangePercent24h: number;
  }>;
  onCoinSelect: (symbol: string) => void;
  selectedCoin: {
    symbol: string;
    name: string;
    price: number;
    priceChangePercent24h: number;
  } | null;
}

export const ChartSection: FC<ChartSectionProps> = ({
  data,
  isLoading,
  error,
  onIntervalChange,
  onRefresh,
  selectedInterval,
  availableCoins,
  onCoinSelect,
  selectedCoin,
}) => {
  const [chartType, setChartType] = useState<"candlestick" | "area">("area");

  if (error) {
    return (
      <GlassCard className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-grotesk font-semibold text-xl">Price Chart</h2>
          <Button onClick={onRefresh} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
        <div className="flex items-center justify-center h-[400px] text-red-400">
          <BarChart3 className="h-5 w-5 mr-2" />
          {error.message}
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-grotesk font-semibold text-xl mb-1">
            {data.symbol}USDT Price Chart
          </h2>
          <div className="text-cool-gray text-sm">
            Last updated: {new Date(data.lastUpdated).toLocaleString()}
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex gap-2">
            {["1h", "4h", "1d"].map((interval) => (
              <Button
                key={interval}
                variant={selectedInterval === interval ? "default" : "outline"}
                size="sm"
                onClick={() => onIntervalChange(interval)}
              >
                {interval}
              </Button>
            ))}
          </div>
          <Select
            value={selectedCoin?.symbol || ""}
            onValueChange={onCoinSelect}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select coin" />
            </SelectTrigger>
            <SelectContent>
              {availableCoins.map((coin) => (
                <SelectItem key={coin.symbol} value={coin.symbol}>
                  <div className="flex items-center">
                    <span>{coin.name}</span>
                    <span className="ml-2 text-cool-gray">{coin.symbol}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={chartType}
            onValueChange={(v) => setChartType(v as "candlestick" | "area")}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Chart type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="area">Area Chart</SelectItem>
              <SelectItem value="candlestick">Candlestick</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={onRefresh}
            variant="outline"
            size="sm"
            disabled={isLoading}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      <div className="bg-navy-darker rounded-xl p-4 mb-4">
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <div className="text-cool-gray text-sm mb-1">
              Price Change (24h)
            </div>
            <Badge
              variant={
                data.indicators.priceChange24h >= 0 ? "default" : "destructive"
              }
              className="text-lg"
            >
              {data.indicators.priceChange24h >= 0 ? "+" : ""}
              {data.indicators.priceChange24h.toFixed(2)}%
            </Badge>
          </div>
          <div>
            <div className="text-cool-gray text-sm mb-1">RSI (14)</div>
            <div className="font-mono text-lg">
              {data.indicators.rsi.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-cool-gray text-sm mb-1">
              Volume Change (24h)
            </div>
            <Badge
              variant={
                data.indicators.volumeChange24h >= 0 ? "default" : "destructive"
              }
              className="text-lg"
            >
              {data.indicators.volumeChange24h >= 0 ? "+" : ""}
              {data.indicators.volumeChange24h.toFixed(2)}%
            </Badge>
          </div>
        </div>

        <div className="h-[400px]">
          {chartType === "area" ? (
            <ChartComponent data={data} isLoading={isLoading} error={error} />
          ) : (
            <PriceChart
              data={data}
              isLoading={isLoading}
              error={error}
              onSelectCoin={onCoinSelect}
            />
          )}
        </div>
      </div>

      {selectedCoin && (
        <div className="mt-6 bg-navy-darker rounded-xl p-4">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-r from-electric to-neon rounded-full flex items-center justify-center pulse-glow">
              <Bot className="text-white" size={20} />
            </div>
            <h3 className="font-grotesk font-semibold text-xl">
              AI Market Analysis
            </h3>
          </div>
          <MarketSummary
            symbol={selectedCoin.symbol}
            price={selectedCoin.price}
            priceChange24h={selectedCoin.priceChangePercent24h}
            volume24h={data.candles[data.candles.length - 1].volume}
          />
        </div>
      )}
    </GlassCard>
  );
};
