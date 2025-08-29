import { useEffect, useState } from "react";
import { Bot } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface MarketAnalysis {
  sentiment: {
    sentiment: string;
    confidence: number;
    method: string;
    scores: Array<{ label: string; score: number }>;
  };
  scores: {
    technical: number;
    fundamental: number;
    market: number;
  };
  analysis: string;
  supportLevels: number[];
  resistanceLevels: number[];
}

interface MarketSummaryProps {
  symbol: string;
  price: number;
  priceChange24h: number;
  volume24h: number;
}

export default function MarketSummary({
  symbol,
  price,
  priceChange24h,
  volume24h,
}: MarketSummaryProps) {
  const { data, isLoading, error } = useQuery<MarketAnalysis>({
    queryKey: ["marketAnalysis", symbol],
    queryFn: async () => {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: `Analyze ${symbol} cryptocurrency with current price ${price}, 24h change ${priceChange24h}%, and 24h volume ${volume24h}. Consider technical indicators like RSI and provide a concise market analysis with potential support/resistance levels and market sentiment.`,
          context: {
            type: "MARKET_ANALYSIS",
            data: {
              symbol,
              price,
              priceChange24h,
              volume24h,
            },
          },
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch analysis");
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || "Failed to get market analysis");
      }

      const aiResponse = result.data.message;

      // Extract technical analysis data from AI response
      const analysis: MarketAnalysis = {
        sentiment: aiResponse.metadata?.ensembleDetails?.modelsUsed?.find(
          (m: any) => m.name === "FinancialBert"
        )?.data || {
          sentiment: "neutral",
          confidence: 0.5,
          method: "ensemble",
          scores: [],
        },
        scores: {
          technical:
            aiResponse.metadata?.ensembleDetails?.consensusScore || 0.5,
          fundamental: 0.5,
          market: 0.5,
        },
        analysis: aiResponse.content,
        supportLevels: [price * 0.95, price * 0.9, price * 0.85],
        resistanceLevels: [price * 1.05, price * 1.1, price * 1.15],
      };

      return analysis;
    },
    refetchInterval: 300000, // Refetch every 5 minutes
  });

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-4 bg-white/10 rounded w-3/4"></div>
        <div className="h-4 bg-white/10 rounded w-1/2"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-400">
        Failed to load market analysis. Please try again later.
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="space-y-4">
      <p className="text-lg">{data.analysis}</p>
      <div className="flex flex-wrap gap-2">
        <span
          className={`px-3 py-1 rounded-full text-sm ${
            data.sentiment?.sentiment === "positive"
              ? "bg-emerald/20 text-emerald"
              : data.sentiment?.sentiment === "negative"
              ? "bg-red-400/20 text-red-400"
              : "bg-amber/20 text-amber"
          }`}
        >
          {data.sentiment?.sentiment ? (
            <>
              {data.sentiment.sentiment.charAt(0).toUpperCase() +
                data.sentiment.sentiment.slice(1)}{" "}
              {data.sentiment.confidence && (
                <span>
                  ({Math.round(data.sentiment.confidence * 100)}% Confidence)
                </span>
              )}
            </>
          ) : (
            "Neutral"
          )}
        </span>
        <span className="px-3 py-1 bg-neon/20 text-neon rounded-full text-sm">
          Technical Score: {data.scores?.technical ?? 0}
        </span>
        <span
          className={`px-3 py-1 bg-electric/20 text-electric rounded-full text-sm ${
            Math.abs(priceChange24h) > 5 ? "animate-pulse" : ""
          }`}
        >
          {Math.abs(priceChange24h)}% {priceChange24h >= 0 ? "Gain" : "Loss"}{" "}
          24h
        </span>
      </div>
      {((data.supportLevels?.length ?? 0) > 0 ||
        (data.resistanceLevels?.length ?? 0) > 0) && (
        <div className="grid grid-cols-2 gap-4 bg-white/5 rounded-lg p-4">
          {(data.supportLevels?.length ?? 0) > 0 && (
            <div>
              <div className="text-cool-gray text-sm mb-2">Support Levels</div>
              <div className="space-y-1">
                {data.supportLevels?.map((level, i) => (
                  <div key={i} className="font-mono">
                    ${(typeof level === "number" ? level : 0).toLocaleString()}
                  </div>
                ))}
              </div>
            </div>
          )}
          {(data.resistanceLevels?.length ?? 0) > 0 && (
            <div>
              <div className="text-cool-gray text-sm mb-2">
                Resistance Levels
              </div>
              <div className="space-y-1">
                {data.resistanceLevels?.map((level, i) => (
                  <div key={i} className="font-mono">
                    ${(typeof level === "number" ? level : 0).toLocaleString()}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
