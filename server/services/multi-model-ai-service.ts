import { analyzeSentiment } from "./huggingface-service";
import env from "../config/env";

interface ModelResponse {
  source: string;
  confidence: number;
  data: any;
  processingTime: number;
}

interface EnsembleResponse {
  finalResponse: string;
  modelContributions: ModelResponse[];
  consensusScore: number;
  totalProcessingTime: number;
  methodology: string;
}

// Hugging Face model configurations - using more reliable models
const HF_MODELS = {
  FINANCIAL_BERT: "cardiffnlp/twitter-roberta-base-sentiment-latest", // More reliable than ProsusAI/finbert
  CRYPTO_SENTIMENT: "nlptown/bert-base-multilingual-uncased-sentiment",
  MARKET_ANALYSIS: "microsoft/DialoGPT-medium",
  TECHNICAL_ANALYSIS: "facebook/blenderbot-400M-distill",
  NEWS_CLASSIFICATION: "cardiffnlp/twitter-roberta-base-sentiment-latest",
} as const;

export class MultiModelAIService {
  private readonly hfApiKey: string;
  private readonly baseUrl = "https://api-inference.huggingface.co/models";

  constructor(hfApiKey: string) {
    this.hfApiKey = hfApiKey;

    if (!env.GEMINI_API_KEY?.trim()) {
      console.warn(
        "GEMINI_API_KEY not found or empty in environment variables"
      );
    }
  }

  private async generateGeminiResponse(prompt: string): Promise<ModelResponse> {
    const startTime = Date.now();

    if (!env.GEMINI_API_KEY?.trim()) {
      throw new Error("Gemini API key is not properly configured");
    }

    const instructions = [
      "You are a crypto trading assistant. Analyze this query in the context of cryptocurrency markets and trading:",
      "",
      prompt,
      "",
      "Provide a concise, actionable response focusing on:",
      "- Market analysis if relevant",
      "- Trading insights",
      "- Risk considerations",
      "- Current market sentiment",
      "",
      "Keep response under 200 words",
    ];

    const enhancedPrompt = instructions.join("\n");

    // Add retry logic with exponential backoff
    const maxRetries = 3;
    let lastError: Error = new Error("No attempts made yet");

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Gemini API attempt ${attempt}/${maxRetries}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

        const response = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=" +
            env.GEMINI_API_KEY,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "User-Agent": "TradeableAssistant/1.0",
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: enhancedPrompt,
                    },
                  ],
                },
              ],
              generationConfig: {
                temperature: 0.7,
                topP: 0.8,
                topK: 40,
                maxOutputTokens: 1024, // Reduced from 2048
              },
            }),
            signal: controller.signal,
          }
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          const errorMessage = `HTTP ${response.status}: ${errorText}`;

          // Don't retry on authentication errors
          if (response.status === 403 || response.status === 401) {
            throw new Error(
              `Gemini API authentication failed: ${errorMessage}`
            );
          }

          // Don't retry on quota exceeded
          if (response.status === 429) {
            throw new Error(`Gemini API quota exceeded: ${errorMessage}`);
          }

          throw new Error(errorMessage);
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
          throw new Error("No text generated from Gemini API");
        }

        const processingTime = Date.now() - startTime;

        return {
          source: "Gemini",
          confidence: 0.9,
          data: text,
          processingTime,
        };
      } catch (error) {
        lastError = error as Error;
        console.error(`Gemini API attempt ${attempt} failed:`, error);

        // Don't retry on authentication or quota errors
        if (error instanceof Error) {
          if (
            error.message.includes("403") ||
            error.message.includes("401") ||
            error.message.includes("authentication") ||
            error.message.includes("quota") ||
            error.message.includes("429")
          ) {
            break;
          }
        }

        // Wait before retrying (exponential backoff)
        if (attempt < maxRetries) {
          const waitTime = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
          console.log(`Waiting ${waitTime}ms before retry...`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      }
    }

    // All attempts failed
    console.error("All Gemini API attempts failed:", lastError);
    throw new Error(
      `Gemini API failed after ${maxRetries} attempts: ${
        lastError?.message || "Unknown error"
      }`
    );
  }

  private async generateHuggingFaceResponse(
    prompt: string,
    model: string
  ): Promise<ModelResponse> {
    const startTime = Date.now();

    try {
      // Use our improved sentiment analysis
      const result = await analyzeSentiment(prompt);
      const processingTime = Date.now() - startTime;

      // Convert sentiment to more descriptive analysis
      const confidence = (result.confidence * 100).toFixed(1);

      const sentimentResponses = {
        positive:
          "Market sentiment appears bullish. Confidence: " +
          confidence +
          "%. This suggests favorable market conditions and potential upward price movement.",
        negative:
          "Market sentiment appears bearish. Confidence: " +
          confidence +
          "%. This indicates caution and potential downward pressure on prices.",
        neutral:
          "Market sentiment is neutral. Confidence: " +
          confidence +
          "%. Mixed signals suggest a wait-and-see approach may be prudent.",
      };

      const analysis =
        sentimentResponses[result.sentiment] || sentimentResponses.neutral;

      return {
        source: "HF-" + (model.split("/").pop() || ""),
        confidence: result.confidence || 0.7,
        data: analysis,
        processingTime,
      };
    } catch (error) {
      console.error("HuggingFace model " + model + " error:", error);
      throw new Error(
        "HuggingFace model " +
          model +
          " failed: " +
          (error instanceof Error ? error.message : "Unknown error")
      );
    }
  }

  public async generateEnsembleResponse(
    prompt: string,
    context: any,
    options: {
      useGemini?: boolean;
      useFinancialBert?: boolean;
      useCryptoBert?: boolean;
      useNewsAnalysis?: boolean;
      weightingStrategy?: "confidence" | "equal";
    }
  ): Promise<EnsembleResponse> {
    const startTime = Date.now();
    const responses: ModelResponse[] = [];

    // Add market context to prompt
    const contextualPrompt =
      context && Object.keys(context).length > 0
        ? prompt + "\n\nMarket Context: " + JSON.stringify(context, null, 2)
        : prompt; // Collect responses from all enabled models with better error handling
    const promises = [];

    if (options.useGemini) {
      promises.push(
        this.generateGeminiResponse(contextualPrompt).catch((error) => {
          const message =
            error instanceof Error ? error.message : "Unknown error";
          console.warn("Gemini failed, skipping:", message);
          return null;
        })
      );
    }

    if (options.useFinancialBert) {
      promises.push(
        this.generateHuggingFaceResponse(
          contextualPrompt,
          HF_MODELS.FINANCIAL_BERT
        ).catch((error) => {
          console.warn("FinancialBert failed, skipping:", error.message);
          return null;
        })
      );
    }

    if (options.useCryptoBert) {
      promises.push(
        this.generateHuggingFaceResponse(
          contextualPrompt,
          HF_MODELS.CRYPTO_SENTIMENT
        ).catch((error) => {
          console.warn("CryptoBert failed, skipping:", error.message);
          return null;
        })
      );
    }

    if (options.useNewsAnalysis) {
      promises.push(
        this.generateHuggingFaceResponse(
          contextualPrompt,
          HF_MODELS.NEWS_CLASSIFICATION
        ).catch((error) => {
          console.warn("NewsAnalysis failed, skipping:", error.message);
          return null;
        })
      );
    }

    const results = await Promise.all(promises);

    // Filter out null results (failed requests)
    const validResults = results.filter(
      (result): result is ModelResponse => result !== null
    );
    responses.push(...validResults);

    if (responses.length === 0) {
      // Provide a fallback response
      const fallbackResponse: ModelResponse = {
        source: "Fallback",
        confidence: 0.5,
        data: "I'm having trouble connecting to the AI models right now. Please check your API keys and try again. In the meantime, consider checking market data directly from exchanges or financial news sources.",
        processingTime: Date.now() - startTime,
      };
      responses.push(fallbackResponse);
    }

    // Calculate consensus and create final response
    let finalResponse = "";
    let consensusScore = 0;

    if (responses.length === 1) {
      finalResponse = responses[0].data;
      consensusScore = responses[0].confidence;
    } else if (options.weightingStrategy === "confidence") {
      // Weight responses by confidence
      const totalConfidence = responses.reduce(
        (sum, resp) => sum + resp.confidence,
        0
      );

      if (totalConfidence > 0) {
        // Create a weighted ensemble response
        const primaryResponse = responses.reduce((best, current) =>
          current.confidence > best.confidence ? current : best
        );

        finalResponse =
          primaryResponse.data + "\n\n--- Additional Analysis ---\n";

        responses
          .filter((resp) => resp !== primaryResponse)
          .forEach((resp) => {
            finalResponse += "\n" + resp.source + ": " + resp.data;
          });

        consensusScore = totalConfidence / responses.length;
      } else {
        finalResponse = responses
          .map((resp) => resp.source + ": " + resp.data)
          .join("\n\n");
        consensusScore = 0.5;
      }
    } else {
      // Equal weighting
      finalResponse = responses
        .map((resp) => resp.source + ": " + resp.data)
        .join("\n\n");
      consensusScore =
        responses.length > 0
          ? Math.min(
              responses.reduce((sum, resp) => sum + resp.confidence, 0) /
                responses.length,
              1
            )
          : 0;
    }

    return {
      finalResponse,
      modelContributions: responses,
      consensusScore,
      totalProcessingTime: Date.now() - startTime,
      methodology: options.weightingStrategy || "equal",
    };
  }

  public async generateAnalysis(prompt: string): Promise<string> {
    try {
      const response = await this.generateEnsembleResponse(
        prompt,
        {},
        {
          useGemini: true,
          useFinancialBert: true,
          useCryptoBert: false, // Keep disabled to avoid overloading
          useNewsAnalysis: true,
          weightingStrategy: "confidence",
        }
      );
      return response.finalResponse;
    } catch (error: unknown) {
      console.error("Multi-model analysis failed:", error);

      // Enhanced fallback with more context
      try {
        const { analyzeSentiment } = await import("./huggingface-service");
        const sentiment = await analyzeSentiment(prompt);

        let fallbackAnalysis =
          "Based on sentiment analysis: " +
          sentiment.sentiment +
          " (confidence: " +
          (sentiment.confidence * 100).toFixed(1) +
          "%)";

        // Add contextual advice based on sentiment
        if (sentiment.sentiment === "positive") {
          fallbackAnalysis +=
            "\n\nThis suggests a bullish outlook, but always verify with multiple sources and consider your risk tolerance before making trading decisions.";
        } else if (sentiment.sentiment === "negative") {
          fallbackAnalysis +=
            "\n\nThis suggests a bearish outlook. Consider waiting for better market conditions or implementing risk management strategies.";
        } else {
          fallbackAnalysis +=
            "\n\nNeutral sentiment suggests mixed market signals. Consider a balanced approach and monitor for clearer trends.";
        }

        return fallbackAnalysis;
      } catch (fallbackError) {
        console.error(
          "Fallback sentiment analysis also failed:",
          fallbackError
        );
        return "I'm experiencing technical difficulties with the AI models. Please check the system configuration and API keys. In the meantime, I recommend consulting multiple financial sources for market analysis.";
      }
    }
  }
}
