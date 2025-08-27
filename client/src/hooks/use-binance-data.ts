import { useEffect, useState } from "react";

export interface KlineData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ChartData {
  prices: number[];
  labels: string[];
  volumes: number[];
}

const BINANCE_WS_URL = "wss://stream.binance.com:9443/ws";
const KLINE_INTERVAL = "1h"; // 1 hour intervals

export function useBinanceData(symbol: string = "BTCUSDT") {
  const [chartData, setChartData] = useState<ChartData>({
    prices: [],
    labels: [],
    volumes: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ws: WebSocket | null = null;
    setIsLoading(true);

    // Fetch historical data first
    const fetchHistoricalData = async () => {
      try {
        const response = await fetch(
          `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${KLINE_INTERVAL}&limit=24`
        );

        if (!response.ok) {
          throw new Error("Failed to fetch historical data");
        }

        const data = await response.json();
        const processedData = processKlineData(data);
        setChartData(processedData);
        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch data");
        setIsLoading(false);
      }
    };

    // Start WebSocket connection for real-time updates
    const connectWebSocket = () => {
      ws = new WebSocket(BINANCE_WS_URL);

      ws.onopen = () => {
        ws?.send(
          JSON.stringify({
            method: "SUBSCRIBE",
            params: [`${symbol.toLowerCase()}@kline_${KLINE_INTERVAL}`],
            id: 1,
          })
        );
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.k) {
          // Kline data
          const kline = data.k;
          updateChartData(kline);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setError("WebSocket connection error");
      };
    };

    fetchHistoricalData();
    connectWebSocket();

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [symbol]);

  const processKlineData = (data: any[]): ChartData => {
    const prices: number[] = [];
    const labels: string[] = [];
    const volumes: number[] = [];

    data.forEach((kline: any[]) => {
      const [timestamp, , , , close, volume] = kline;
      prices.push(parseFloat(close));
      labels.push(new Date(timestamp).toLocaleTimeString());
      volumes.push(parseFloat(volume));
    });

    return { prices, labels, volumes };
  };

  const updateChartData = (kline: any) => {
    setChartData((prevData) => {
      const prices = [...prevData.prices];
      const labels = [...prevData.labels];
      const volumes = [...prevData.volumes];

      const timestamp = new Date(kline.t).toLocaleTimeString();
      const price = parseFloat(kline.c);
      const volume = parseFloat(kline.v);

      // Update last entry if it's the same timestamp, otherwise add new entry
      const lastIndex = labels.length - 1;
      if (labels[lastIndex] === timestamp) {
        prices[lastIndex] = price;
        volumes[lastIndex] = volume;
      } else {
        prices.push(price);
        labels.push(timestamp);
        volumes.push(volume);

        // Keep only last 24 data points
        if (prices.length > 24) {
          prices.shift();
          labels.shift();
          volumes.shift();
        }
      }

      return { prices, labels, volumes };
    });
  };

  return { chartData, isLoading, error };
}
