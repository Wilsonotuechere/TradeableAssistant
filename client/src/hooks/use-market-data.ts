import { useQuery, useQueryClient, QueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useEffect } from "react";

const BINANCE_WS_URL = "wss://stream.binance.com:9443/ws";

const MARKET_STREAMS = [
  "btcusdt@miniTicker",
  "ethusdt@miniTicker",
  "bnbusdt@miniTicker",
  "solusdt@miniTicker",
  "adausdt@miniTicker",
  "dogeusdt@miniTicker",
  "maticusdt@miniTicker",
  "dotusdt@miniTicker",
] as const;

export function useMarketData(refetchInterval = 60000) {
  const queryClient = useQueryClient();

  useEffect(() => {
    let wsCleanupTimeout: NodeJS.Timeout;
    let ws: WebSocket | null = null;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    const reconnectDelay = 2000;
    let isConnecting = false;

    const connectWebSocket = () => {
      if (isConnecting || reconnectAttempts >= maxReconnectAttempts) {
        console.error(
          "WebSocket connection blocked: " +
            (isConnecting
              ? "Already connecting"
              : "Max reconnection attempts reached")
        );
        return;
      }

      // Clear existing connection if any
      if (ws) {
        try {
          ws.close();
        } catch (err) {
          console.warn("Error closing existing WebSocket:", err);
        }
      }

      isConnecting = true;
      ws = new WebSocket(BINANCE_WS_URL);

      ws.onopen = () => {
        console.log("WebSocket connected");
        isConnecting = false;
        reconnectAttempts = 0;

        // Clear any pending reconnection timeout
        if (wsCleanupTimeout) {
          clearTimeout(wsCleanupTimeout);
        }

        try {
          ws?.send(
            JSON.stringify({
              method: "SUBSCRIBE",
              params: MARKET_STREAMS,
              id: 1,
            })
          );
        } catch (err) {
          console.error("Error subscribing to streams:", err);
          ws?.close();
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        isConnecting = false;
      };

      ws.onclose = () => {
        console.log("WebSocket disconnected, attempting to reconnect...");
        isConnecting = false;
        reconnectAttempts++;

        // Set up reconnection with exponential backoff
        const delay = Math.min(
          reconnectDelay * Math.pow(2, reconnectAttempts - 1),
          30000
        );
        wsCleanupTimeout = setTimeout(connectWebSocket, delay);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.e === "24hrMiniTicker") {
            // Update the cached market data with the new price
            queryClient.setQueryData(["/api/market"], (oldData: any) => {
              if (!oldData?.data?.coins) return oldData;

              const updatedCoins = oldData.data.coins.map((coin: any) => {
                if (coin.symbol + "USDT" === data.s) {
                  return {
                    ...coin,
                    price: parseFloat(data.c) || coin.price,
                    priceChangePercent24h:
                      parseFloat(data.P) || coin.priceChangePercent24h,
                    volume24h:
                      parseFloat(data.v) * parseFloat(data.c) || coin.volume24h,
                    lastUpdate: new Date().toISOString(),
                  };
                }
                return coin;
              });

              return {
                ...oldData,
                data: {
                  ...oldData.data,
                  coins: updatedCoins,
                },
              };
            });
          }
        } catch (err) {
          console.error("Error processing WebSocket message:", err);
        }
      };
    };

    // Initial connection
    connectWebSocket();

    // Cleanup function
    return () => {
      // Clear any pending reconnection attempts
      if (wsCleanupTimeout) {
        clearTimeout(wsCleanupTimeout);
      }

      // Close WebSocket connection if open
      if (ws) {
        try {
          // Remove all listeners to prevent memory leaks
          ws.onopen = null;
          ws.onclose = null;
          ws.onerror = null;
          ws.onmessage = null;

          if (
            ws.readyState === WebSocket.OPEN ||
            ws.readyState === WebSocket.CONNECTING
          ) {
            ws.close();
          }
        } catch (err) {
          console.warn("Error during WebSocket cleanup:", err);
        }
      }

      // Reset connection state
      isConnecting = false;
      reconnectAttempts = 0;
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ["/api/market"],
    queryFn: async () => {
      try {
        const response = await api.getMarketData();
        console.log("Market data response:", response); // Debug log
        return {
          success: true,
          data: {
            coins: response.data || [],
            stats: response.stats || {
              totalMarketCap: "$3.4T",
              totalVolume24h: "$125.8B",
              btcDominance: "56.2%",
              fearGreedIndex: 65,
            },
          },
        };
      } catch (error) {
        console.error("Failed to fetch market data:", error);
        throw new Error("Failed to load market data. Please try again later.");
      }
    },
    refetchInterval,
    staleTime: 30000, // Consider data stale after 30 seconds
    retry: (failureCount, error) => {
      // Stop retrying after 3 attempts or if we get a clear error response
      if (failureCount >= 3) return false;
      if (
        error instanceof Error &&
        error.message.includes("Invalid market data")
      )
        return false;
      return true;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000), // Exponential backoff
  });
}
