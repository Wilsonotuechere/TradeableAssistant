import env from "../config/env";
import { HF_MODELS } from "../types/ai-service";
import { fetchWithTimeout } from "../utils/fetch.js";

interface ModelResponse {
  source: string;
  response: string;
  confidence: number;
  processingTime: number;
  data?: {
    strengths?: string[];
  };
}

interface EnsembleResponse {
  finalResponse: string;
  consensusScore: number;
  totalProcessingTime: number;
  modelContributions: Array<{
    source: string;
    confidence: number;
    processingTime: number;
    data?: {
      strengths?: string[];
      response?: string;
    };
  }>;
  methodology: string;
}

export class MultiModelService {
  private readonly GEMINI_API_KEY = env.GEMINI_API_KEY;
  private readonly HF_API_KEY = env.HUGGINGFACE_API_KEY;

  private async generateGeminiResponse(
    prompt: string,
    context: any
  ): Promise<ModelResponse> {
    const startTime = Date.now();

    try {
      const response = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${this.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: this.buildGeminiPrompt(prompt, context),
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.7,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 1024,
            },
          }),
        }
      );

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

      return {
        source: "Gemini",
        response: text,
        confidence: 0.9,
        processingTime: Date.now() - startTime,
        data: {
          strengths: [
            "Context understanding",
            "Natural language",
            "Market knowledge",
          ],
        },
      };
    } catch (error) {
      console.error("Gemini response error:", error);
      throw error;
    }
  }

  private async generateFinancialBertResponse(
    prompt: string,
    context: any
  ): Promise<ModelResponse> {
    const startTime = Date.now();

    try {
      const response = await fetchWithTimeout(
        `https://api-inference.huggingface.co/models/${HF_MODELS.FINANCIAL_BERT}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.HF_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputs: this.buildFinancialPrompt(prompt, context),
          }),
        }
      );

      const result = await response.json();
      const text = result[0]?.generated_text || "";

      return {
        source: "FinancialBERT",
        response: text,
        confidence: 0.85,
        processingTime: Date.now() - startTime,
        data: {
          strengths: [
            "Financial analysis",
            "Technical patterns",
            "Risk assessment",
          ],
        },
      };
    } catch (error) {
      console.error("FinancialBERT response error:", error);
      throw error;
    }
  }

  private async generateCryptoBertResponse(
    prompt: string,
    context: any
  ): Promise<ModelResponse> {
    const startTime = Date.now();

    try {
      const response = await fetchWithTimeout(
        `https://api-inference.huggingface.co/models/${HF_MODELS.CRYPTO_SENTIMENT}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.HF_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputs: this.buildCryptoPrompt(prompt, context),
          }),
        }
      );

      const result = await response.json();
      const text = result[0]?.generated_text || "";

      return {
        source: "CryptoBERT",
        response: text,
        confidence: 0.88,
        processingTime: Date.now() - startTime,
        data: {
          strengths: ["Crypto expertise", "Market sentiment", "Trend analysis"],
        },
      };
    } catch (error) {
      console.error("CryptoBERT response error:", error);
      throw error;
    }
  }

  private async generateNewsAnalysisResponse(
    prompt: string,
    context: any
  ): Promise<ModelResponse> {
    const startTime = Date.now();

    try {
      const response = await fetchWithTimeout(
        `https://api-inference.huggingface.co/models/${HF_MODELS.NEWS_CLASSIFICATION}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.HF_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputs: this.buildNewsPrompt(prompt, context),
          }),
        }
      );

      const result = await response.json();
      const text = result[0]?.generated_text || "";

      return {
        source: "NewsAnalysis",
        response: text,
        confidence: 0.82,
        processingTime: Date.now() - startTime,
        data: {
          strengths: [
            "News comprehension",
            "Impact analysis",
            "Event correlation",
          ],
        },
      };
    } catch (error) {
      console.error("NewsAnalysis response error:", error);
      throw error;
    }
  }

  private buildGeminiPrompt(message: string, context: any): string {
    let prompt = `You are an expert crypto trading assistant. Analyze this query with market context:

Question: ${message}

`;

    if (context.topCoin) {
      prompt += `\nTop Cryptocurrency:
- ${context.topCoin.name} (${context.topCoin.symbol})
- Price: $${context.topCoin.price}
- 24h Change: ${context.topCoin.priceChangePercent24h}%
`;
    }

    if (context.stats) {
      prompt += `\nMarket Overview:
- Total Market Cap: ${context.stats.totalMarketCap}
- 24h Volume: ${context.stats.totalVolume24h}
- BTC Dominance: ${context.stats.btcDominance}
- Market Sentiment: ${context.stats.fearGreedIndex}/100
`;
    }

    prompt +=
      "\nProvide a clear, beginner-friendly analysis focusing on key insights and risks.";
    return prompt;
  }

  private buildFinancialPrompt(message: string, context: any): string {
    return `Analyze this cryptocurrency market query with technical and fundamental analysis:
    
Query: ${message}

Market Context:
${JSON.stringify(context, null, 2)}

Focus on financial metrics, technical patterns, and risk assessment.`;
  }

  private buildCryptoPrompt(message: string, context: any): string {
    return `As a crypto expert, analyze this market query:
    
Query: ${message}

Market Data:
${JSON.stringify(context, null, 2)}

Focus on cryptocurrency-specific factors, market sentiment, and trend analysis.`;
  }

  private buildNewsPrompt(message: string, context: any): string {
    return `Analyze this crypto market query in the context of recent news and events:
    
Query: ${message}

Market Context:
${JSON.stringify(context, null, 2)}

Focus on news impact, market reactions, and correlated events.`;
  }

  async generateEnsembleResponse(
    message: string,
    context: any,
    options: {
      useGemini: boolean;
      useFinancialBert: boolean;
      useCryptoBert: boolean;
      useNewsAnalysis: boolean;
      weightingStrategy: string;
    }
  ): Promise<EnsembleResponse> {
    const startTime = Date.now();
    const modelPromises: Promise<ModelResponse>[] = [];

    // Collect responses from enabled models
    if (options.useGemini) {
      modelPromises.push(this.generateGeminiResponse(message, context));
    }
    if (options.useFinancialBert) {
      modelPromises.push(this.generateFinancialBertResponse(message, context));
    }
    if (options.useCryptoBert) {
      modelPromises.push(this.generateCryptoBertResponse(message, context));
    }
    if (options.useNewsAnalysis) {
      modelPromises.push(this.generateNewsAnalysisResponse(message, context));
    }

    // Wait for all responses
    const responses = await Promise.allSettled(modelPromises);

    // Filter successful responses
    const successfulResponses = responses
      .filter(
        (result): result is PromiseFulfilledResult<ModelResponse> =>
          result.status === "fulfilled"
      )
      .map((result) => result.value);

    if (successfulResponses.length === 0) {
      throw new Error("No models were able to generate a response");
    }

    // Calculate consensus score
    const consensusScore =
      successfulResponses.reduce(
        (acc, response) => acc + response.confidence,
        0
      ) / successfulResponses.length;

    // Choose primary response based on weighting strategy
    let primaryResponse: ModelResponse;
    if (options.weightingStrategy === "confidence") {
      primaryResponse = successfulResponses.reduce((best, current) =>
        current.confidence > best.confidence ? current : best
      );
    } else {
      // Default to Gemini if available, otherwise highest confidence
      primaryResponse =
        successfulResponses.find((r) => r.source === "Gemini") ||
        successfulResponses.reduce((best, current) =>
          current.confidence > best.confidence ? current : best
        );
    }

    const finalResponse = this.combineResponses(
      primaryResponse,
      successfulResponses
    );
    const totalProcessingTime = Date.now() - startTime;

    return {
      finalResponse,
      consensusScore,
      totalProcessingTime,
      modelContributions: successfulResponses.map((response) => ({
        source: response.source,
        confidence: response.confidence,
        processingTime: response.processingTime,
        data: {
          strengths: response.data?.strengths,
          response: response.response,
        },
      })),
      methodology:
        options.weightingStrategy === "confidence"
          ? "confidence-weighted-ensemble"
          : "primary-with-support",
    };
  }

  private combineResponses(
    primary: ModelResponse,
    all: ModelResponse[]
  ): string {
    // Start with the primary response
    let combined = primary.response;

    // Add unique insights from other models
    const otherInsights = all
      .filter((r) => r.source !== primary.source)
      .map((r) => r.response)
      .join("\n\n");

    if (otherInsights) {
      combined += "\n\nAdditional Insights:\n" + otherInsights;
    }

    // Add disclaimer
    combined += "\n\nThis is information, not financial advice.";

    return combined;
  }
}
