// React imports
import { useEffect, useRef } from "react";
import {
  Chart,
  ChartType,
  ChartConfiguration,
  ChartOptions,
  ChartEvent,
  ActiveElement,
} from "chart.js";

// Chart.js components and elements
import {
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Legend,
  Title,
  Tooltip,
  TimeScale,
  LineController,
  BarController,
} from "chart.js";

// Chart.js types
import type {
  Scale,
  CoreScaleOptions,
  TooltipItem,
  ChartDataset,
  ScriptableContext,
} from "chart.js";

import type { DeepPartial } from "utility-types";

// Financial chart extension
import {
  CandlestickController,
  CandlestickElement,
} from "chartjs-chart-financial";

// Date adapter for time scale
import "chartjs-adapter-date-fns";

Chart.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Legend,
  Title,
  Tooltip,
  TimeScale,
  LineController,
  BarController,
  CandlestickController,
  CandlestickElement
);

interface CandleData {
  x: number;
  o: number;
  h: number;
  l: number;
  c: number;
}

interface TimeValueData {
  x: number;
  y: number;
}

type ChartTypes = "candlestick" | "line" | "bar";
type DataTypes = CandleData[] | TimeValueData[];

interface CustomDataset
  extends Omit<
    ChartDataset<ChartTypes, DataTypes>,
    "borderColor" | "backgroundColor"
  > {
  borderColor?: string | ((ctx: ScriptableContext<ChartTypes>) => string);
  backgroundColor?: string | ((ctx: ScriptableContext<ChartTypes>) => string);
  yAxisID?: string;
}

interface CustomChartConfig
  extends ChartConfiguration<ChartType, CandleData[] | TimeValueData[]> {
  options: ChartOptions<ChartType>;
}

interface PriceChartProps {
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
  onSelectCoin?: (symbol: string) => void;
}

export default function PriceChart({
  data,
  isLoading,
  error,
  onSelectCoin,
}: PriceChartProps) {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);

  useEffect(() => {
    if (!chartRef.current || isLoading) return;

    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    // Initialize with empty data if no candles provided
    const lastPrice = data?.candles?.[data.candles.length - 1]?.close || 0;
    const initialCandles =
      data?.candles ||
      Array.from({ length: 24 }, (_, i) => ({
        time: Date.now() - (23 - i) * 3600000,
        open: lastPrice,
        high: lastPrice * 1.001,
        low: lastPrice * 0.999,
        close: lastPrice,
        volume: 0,
      }));

    const canvas = chartRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const chartConfig: CustomChartConfig = {
      type: "candlestick",
      data: {
        datasets: [
          {
            type: "candlestick" as const,
            label: "Price",
            data: data.candles.map((d) => ({
              x: new Date(d.time).getTime(),
              o: d.open,
              h: d.high,
              l: d.low,
              c: d.close,
            })) as CandleData[],
            borderColor: (ctx: ScriptableContext<ChartType>) => {
              if (!ctx.raw) return "#000000";
              const candleData = ctx.raw as CandleData;
              return candleData.o <= candleData.c ? "#22c55e" : "#ef4444";
            },
            backgroundColor: (ctx: ScriptableContext<ChartType>) => {
              if (!ctx.raw) return "#000000";
              const candleData = ctx.raw as CandleData;
              return candleData.o <= candleData.c
                ? "rgba(34, 197, 94, 0.2)"
                : "rgba(239, 68, 68, 0.2)";
            },
          },
          {
            type: "line" as const,
            label: "SMA20",
            data: data.candles.map(
              (d): TimeValueData => ({
                x: new Date(d.time).getTime(),
                y: data.indicators.sma20,
              })
            ),
            borderColor: "#60a5fa",
            borderWidth: 1.5,
            borderDash: [3, 3],
            fill: false,
            yAxisID: "price",
          },
          {
            type: "bar" as const,
            label: "Volume",
            data: data.candles.map(
              (d): TimeValueData => ({
                x: new Date(d.time).getTime(),
                y: d.volume,
              })
            ),
            backgroundColor: "rgba(155, 93, 229, 0.2)",
            borderColor: "rgba(155, 93, 229, 0.8)",
            borderWidth: 1,
            yAxisID: "volume",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        onClick(this: Chart, event: ChartEvent, elements: ActiveElement[]) {
          if (elements.length && onSelectCoin) {
            onSelectCoin(data.symbol);
          }
        },
        interaction: {
          mode: "index",
          intersect: false,
        },
        scales: {
          x: {
            type: "time",
            time: {
              parser: "timestamp",
              unit: data.interval === "1h" ? "minute" : "hour",
              displayFormats: {
                millisecond: "HH:mm:ss.SSS",
                second: "HH:mm:ss",
                minute: "HH:mm",
                hour: "MM/dd HH:mm",
                day: "MM/dd",
                week: "MM/dd",
                month: "yyyy/MM", // Fixed: changed from YYYY to yyyy
                quarter: "yyyy [Q]Q", // Fixed: changed from YYYY to yyyy
                year: "yyyy", // Fixed: changed from YYYY to yyyy
              },
              tooltipFormat: "MM/dd/yyyy HH:mm", // This was already correct
            },
            grid: {
              color: "rgba(156, 163, 175, 0.1)",
            },
            ticks: {
              color: "#9ca3af",
              maxRotation: 0,
              source: "auto",
              autoSkip: true,
              maxTicksLimit: 10,
            },
          },
          price: {
            type: "linear",
            position: "right",
            grid: {
              color: "rgba(156, 163, 175, 0.1)",
            },
            ticks: {
              color: "#9ca3af",
              callback: function (value: string | number) {
                return "$" + Number(value).toLocaleString();
              },
            },
          },
          volume: {
            type: "linear",
            position: "left",
            grid: {
              display: false,
            },
            ticks: {
              color: "#9ca3af",
              callback: function (value: string | number) {
                return `${(Number(value) / 1e6).toFixed(2)}M`;
              },
            },
          },
        },
        plugins: {
          legend: {
            display: true,
            position: "top" as const,
            labels: {
              color: "#9ca3af",
              filter: (item: { text: string }) => item.text !== "Price",
            },
          },
          tooltip: {
            mode: "index" as const,
            intersect: false,
            callbacks: {
              label(context: TooltipItem<ChartType>) {
                const raw = context.raw as CandleData | TimeValueData;
                if (context.dataset.label === "Volume" && "y" in raw) {
                  return `Volume: ${(raw.y / 1e6).toFixed(2)}M`;
                }
                if (context.dataset.label === "SMA20") {
                  return `SMA20: $${("y" in raw ? raw.y : 0).toLocaleString()}`;
                }
                if ("c" in raw && "o" in raw && "h" in raw && "l" in raw) {
                  return [
                    `Open: $${raw.o.toLocaleString()}`,
                    `High: $${raw.h.toLocaleString()}`,
                    `Low: $${raw.l.toLocaleString()}`,
                    `Close: $${raw.c.toLocaleString()}`,
                  ];
                }
                return "";
              },
            },
          },
        },
      },
    };

    try {
      chartInstance.current = new Chart(ctx, chartConfig);
    } catch (chartError) {
      console.error("Failed to create chart:", chartError);
    }

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [
    data?.candles,
    data?.indicators?.sma20,
    data?.interval,
    data?.symbol,
    isLoading,
    onSelectCoin,
  ]);

  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-red-500">
        <div className="text-center">
          <p className="font-medium">Error loading chart data</p>
          <p className="text-sm mt-1">{error.message}</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
          <span className="text-sm text-muted-foreground">
            Loading chart data...
          </span>
        </div>
      </div>
    );
  }

  if (!data?.candles?.length) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            No chart data available
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {data?.symbol ? `for ${data.symbol}` : ""}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <canvas ref={chartRef} />
    </div>
  );
}
