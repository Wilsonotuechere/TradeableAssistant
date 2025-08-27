import { pipeline } from "@xenova/transformers";
import fetch from "node-fetch";
import config from "../config/env";

export type SentimentLabel = "positive" | "negative" | "neutral";

export interface SentimentResult {
  sentiment: SentimentLabel;
  confidence: number;
  scores: Array<{ label: string; score: number }>;
}

export interface KeywordSentimentResult extends SentimentResult {
  method: "keyword";
}

interface ModelPrediction {
  label: string;
  score: number;
}

export class SentimentAnalysisError extends Error {
  constructor(message: string, public code: string, public details?: any) {
    super(message);
    this.name = "SentimentAnalysisError";
  }
}

// Enhanced keyword lists for better financial sentiment analysis
const POSITIVE_KEYWORDS = [
  "bullish",
  "rally",
  "surge",
  "moon",
  "pump",
  "breakout",
  "profit",
  "gain",
  "rise",
  "up",
  "green",
  "buy",
  "support",
  "strong",
  "growth",
  "positive",
  "optimistic",
  "confident",
  "milestone",
  "partnership",
  "adoption",
  "upgrade",
  "bull",
  "long",
  "hodl",
  "diamond",
  "rocket",
  "lambo",
  "accumulate",
  "bullrun",
  "ath",
  "breakthrough",
  "uptrend",
  "momentum",
  "catalyst",
  "institutional",
  "mainstream",
  "innovation",
];

const NEGATIVE_KEYWORDS = [
  "bearish",
  "crash",
  "dump",
  "sell",
  "drop",
  "fall",
  "down",
  "red",
  "resistance",
  "weak",
  "decline",
  "loss",
  "negative",
  "concern",
  "risk",
  "volatile",
  "uncertainty",
  "regulation",
  "ban",
  "hack",
  "scam",
  "bubble",
  "bear",
  "short",
  "panic",
  "fear",
  "liquidation",
  "rekt",
  "capitulation",
  "correction",
  "selloff",
  "fud",
  "manipulation",
  "whales",
  "downtrend",
  "rejection",
  "warning",
  "alert",
];

class SentimentAnalyzer {
  private static instance: SentimentAnalyzer;
  private model: any = null;
  private isInitializing = false;
  private initPromise: Promise<void> | null = null;
  private modelName = "cardiffnlp/twitter-roberta-base-sentiment-latest";
  private fallbackModels = [
    "Xenova/distilbert-base-uncased-finetuned-sst-2-english",
    "nlptown/bert-base-multilingual-uncased-sentiment",
  ];

  private constructor() {}

  static getInstance(): SentimentAnalyzer {
    if (!SentimentAnalyzer.instance) {
      SentimentAnalyzer.instance = new SentimentAnalyzer();
    }
    return SentimentAnalyzer.instance;
  }

  async initialize(): Promise<void> {
    if (this.model) return;
    if (this.isInitializing) {
      return this.initPromise!;
    }

    this.isInitializing = true;
    this.initPromise = this.tryLoadModel();
    return this.initPromise;
  }

  private async tryLoadModel(): Promise<void> {
    const modelsToTry = [this.modelName, ...this.fallbackModels];

    for (const modelName of modelsToTry) {
      try {
        console.log(`Attempting to load sentiment model: ${modelName}...`);

        this.model = await pipeline("sentiment-analysis", modelName, {
          revision: "main",
          quantized: false, // Disable quantization to avoid ONNX issues
        });

        this.modelName = modelName;
        console.log(`Successfully loaded sentiment model: ${modelName}`);
        return;
      } catch (error) {
        console.warn(
          `Failed to load ${modelName}:`,
          error instanceof Error ? error.message : error
        );
        continue;
      }
    }

    console.error(
      "All sentiment models failed to load, will use keyword analysis"
    );
    this.model = null;
    this.isInitializing = false;
  }

  async analyzeSentiment(text: string): Promise<SentimentResult> {
    await this.initialize();

    if (!this.model) {
      console.warn("No ML model available, using keyword analysis");
      return analyzeKeywordSentiment(text);
    }

    try {
      // Clean and prepare text for analysis
      const cleanText = text.trim().substring(0, 512); // Limit length to avoid issues
      if (!cleanText) {
        return analyzeKeywordSentiment(text);
      }

      const result = await this.model(cleanText);
      const prediction = result[0] as ModelPrediction;

      // Normalize labels to our standard format with improved mapping
      let sentiment: SentimentLabel;
      const label = prediction.label.toLowerCase();

      if (label.includes("pos") || label.includes("label_2")) {
        sentiment = "positive";
      } else if (label.includes("neg") || label.includes("label_0")) {
        sentiment = "negative";
      } else {
        sentiment = "neutral";
      }

      // Adjust confidence based on model performance
      let adjustedConfidence = prediction.score;
      if (this.modelName.includes("distilbert")) {
        // DistilBERT tends to be overconfident, so we adjust
        adjustedConfidence = Math.min(prediction.score * 0.9, 0.95);
      }

      return {
        sentiment,
        confidence: adjustedConfidence,
        scores: [
          { label: sentiment, score: adjustedConfidence },
          ...["positive", "negative", "neutral"]
            .filter((label) => label !== sentiment)
            .map((label) => ({
              label,
              score:
                label === "neutral"
                  ? Math.max(0, 1 - adjustedConfidence)
                  : Math.random() * 0.3,
            })),
        ],
      };
    } catch (error) {
      console.error("Local sentiment analysis failed:", error);
      return analyzeKeywordSentiment(text);
    }
  }

  async analyzeWithAPI(text: string): Promise<SentimentResult> {
    if (!config.HUGGINGFACE_API_KEY) {
      throw new SentimentAnalysisError(
        "HuggingFace API key not configured",
        "NO_API_KEY"
      );
    }

    // Use a more reliable model for API calls
    const apiModel = "cardiffnlp/twitter-roberta-base-sentiment-latest";
    const url = `https://api-inference.huggingface.co/models/${apiModel}`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.HUGGINGFACE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: text.trim().substring(0, 512),
          options: {
            wait_for_model: true,
            use_cache: false,
          },
        }),
      });

      if (!response.ok) {
        if (response.status === 503) {
          throw new Error("Model is loading, please try again in a moment");
        }
        throw new Error(
          `API request failed: ${response.status} ${response.statusText}`
        );
      }

      const results = await response.json();

      // Handle different response formats
      const predictions = Array.isArray(results) ? results[0] : results;

      if (!predictions || (!Array.isArray(predictions) && !predictions.label)) {
        throw new Error("Invalid API response format");
      }

      // Handle single prediction vs array of predictions
      const predictionArray = Array.isArray(predictions)
        ? predictions
        : [predictions];

      if (predictionArray.length === 0) {
        throw new Error("No predictions returned from API");
      }

      // Find the highest confidence prediction
      const bestPrediction = predictionArray.reduce((best, current) =>
        current.score > best.score ? current : best
      );

      let sentiment: SentimentLabel;
      const label = bestPrediction.label.toLowerCase();

      if (label.includes("positive") || label.includes("pos")) {
        sentiment = "positive";
      } else if (label.includes("negative") || label.includes("neg")) {
        sentiment = "negative";
      } else {
        sentiment = "neutral";
      }

      return {
        sentiment,
        confidence: bestPrediction.score,
        scores: predictionArray.map((p) => ({
          label:
            p.label.includes("POSITIVE") || p.label.includes("pos")
              ? "positive"
              : p.label.includes("NEGATIVE") || p.label.includes("neg")
              ? "negative"
              : "neutral",
          score: p.score,
        })),
      };
    } catch (error) {
      console.error("HuggingFace API sentiment analysis failed:", error);
      throw new SentimentAnalysisError(
        "API sentiment analysis failed",
        "API_ERROR",
        error
      );
    }
  }
}

function analyzeKeywordSentiment(text: string): KeywordSentimentResult {
  if (!text?.trim()) {
    return {
      sentiment: "neutral",
      confidence: 0.5,
      method: "keyword",
      scores: [
        { label: "positive", score: 0 },
        { label: "negative", score: 0 },
        { label: "neutral", score: 1 },
      ],
    };
  }

  const lowerText = text.toLowerCase();
  let positiveScore = 0;
  let negativeScore = 0;

  // Enhanced keyword matching with word boundaries and context
  POSITIVE_KEYWORDS.forEach((keyword) => {
    const regex = new RegExp(
      `\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
      "gi"
    );
    const matches = lowerText.match(regex);
    if (matches) {
      positiveScore += matches.length;
    }
  });

  NEGATIVE_KEYWORDS.forEach((keyword) => {
    const regex = new RegExp(
      `\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
      "gi"
    );
    const matches = lowerText.match(regex);
    if (matches) {
      negativeScore += matches.length;
    }
  });

  const totalScore = positiveScore + negativeScore;

  if (totalScore === 0) {
    // Check for price movements and numbers for neutral analysis
    const priceUpRegex =
      /(\+|\d+%\s*(up|gain|rise)|\d+\.\d+%\s*(increase|growth))/gi;
    const priceDownRegex =
      /(\-|\d+%\s*(down|loss|drop)|\d+\.\d+%\s*(decrease|decline))/gi;

    const upMatches = lowerText.match(priceUpRegex);
    const downMatches = lowerText.match(priceDownRegex);

    if (upMatches && upMatches.length > 0) {
      return {
        sentiment: "positive",
        confidence: 0.6,
        method: "keyword",
        scores: [
          { label: "positive", score: 0.6 },
          { label: "negative", score: 0.1 },
          { label: "neutral", score: 0.3 },
        ],
      };
    } else if (downMatches && downMatches.length > 0) {
      return {
        sentiment: "negative",
        confidence: 0.6,
        method: "keyword",
        scores: [
          { label: "positive", score: 0.1 },
          { label: "negative", score: 0.6 },
          { label: "neutral", score: 0.3 },
        ],
      };
    }

    return {
      sentiment: "neutral",
      confidence: 0.5,
      method: "keyword",
      scores: [
        { label: "positive", score: 0 },
        { label: "negative", score: 0 },
        { label: "neutral", score: 1 },
      ],
    };
  }

  const positiveRatio = positiveScore / totalScore;
  const negativeRatio = negativeScore / totalScore;

  let sentiment: SentimentLabel = "neutral";
  let confidence = 0.5;

  // Improved threshold logic
  if (positiveRatio > 0.65) {
    sentiment = "positive";
    confidence = Math.min(0.85, 0.5 + positiveRatio * 0.4);
  } else if (negativeRatio > 0.65) {
    sentiment = "negative";
    confidence = Math.min(0.85, 0.5 + negativeRatio * 0.4);
  } else if (Math.abs(positiveRatio - negativeRatio) < 0.2) {
    sentiment = "neutral";
    confidence = 0.7; // Higher confidence for truly neutral content
  } else {
    sentiment = positiveRatio > negativeRatio ? "positive" : "negative";
    confidence = Math.min(
      0.75,
      0.5 + Math.abs(positiveRatio - negativeRatio) * 0.3
    );
  }

  return {
    sentiment,
    confidence,
    method: "keyword",
    scores: [
      { label: "positive", score: positiveRatio },
      { label: "negative", score: negativeRatio },
      {
        label: "neutral",
        score: Math.max(0, 1 - (positiveRatio + negativeRatio)),
      },
    ],
  };
}

export async function analyzeSentiment(
  text: string
): Promise<SentimentResult | KeywordSentimentResult> {
  if (!text || text.trim().length === 0) {
    return analyzeKeywordSentiment("");
  }

  try {
    const analyzer = SentimentAnalyzer.getInstance();
    const result = await analyzer.analyzeSentiment(text);

    // If keyword analysis was used and we have API access, try API as backup
    if ("method" in result && config.HUGGINGFACE_API_KEY) {
      try {
        console.log("Attempting API-based sentiment analysis...");
        const apiResult = await analyzer.analyzeWithAPI(text);
        console.log("API sentiment analysis successful");
        return apiResult;
      } catch (apiError) {
        console.warn(
          "API sentiment analysis failed, using keyword result:",
          apiError instanceof Error ? apiError.message : apiError
        );
        return result;
      }
    }

    return result;
  } catch (error) {
    console.warn(
      "All sentiment analysis methods failed, using basic keyword analysis:",
      error instanceof Error ? error.message : error
    );
    return analyzeKeywordSentiment(text);
  }
}

export async function analyzeMultipleTexts(
  texts: string[],
  maxConcurrency: number = 2 // Reduced to avoid overwhelming APIs
): Promise<Array<SentimentResult | KeywordSentimentResult>> {
  if (!Array.isArray(texts) || texts.length === 0) {
    return [];
  }

  const startTime = Date.now();
  console.log(
    `Starting analysis of ${texts.length} texts with max concurrency: ${maxConcurrency}...`
  );

  const results: Array<SentimentResult | KeywordSentimentResult> = [];

  for (let i = 0; i < texts.length; i += maxConcurrency) {
    const batch = texts.slice(i, i + maxConcurrency);
    console.log(
      `Processing batch ${Math.floor(i / maxConcurrency) + 1}/${Math.ceil(
        texts.length / maxConcurrency
      )}`
    );

    const batchPromises = batch.map(async (text, index) => {
      try {
        return await analyzeSentiment(text);
      } catch (error) {
        console.error(`Error analyzing text ${i + index}:`, error);
        return analyzeKeywordSentiment(text);
      }
    });

    const batchResults = await Promise.allSettled(batchPromises);

    batchResults.forEach((result, index) => {
      if (result.status === "fulfilled") {
        results.push(result.value);
      } else {
        console.error(`Failed to analyze text ${i + index}:`, result.reason);
        results.push(analyzeKeywordSentiment(texts[i + index]));
      }
    });

    // Add delay between batches to avoid rate limiting
    if (i + maxConcurrency < texts.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  const totalTime = Date.now() - startTime;
  const successfulAnalyses = results.filter((r) => !("method" in r)).length;
  const fallbackAnalyses = results.filter((r) => "method" in r).length;

  console.log(`Analysis complete in ${totalTime}ms:`);
  console.log(`- Total texts: ${texts.length}`);
  console.log(`- Successful ML: ${successfulAnalyses}`);
  console.log(`- Keyword fallback: ${fallbackAnalyses}`);
  console.log(
    `- Average time per text: ${Math.round(totalTime / texts.length)}ms`
  );

  return results;
}

export function calculateOverallSentiment(
  results: Array<SentimentResult | KeywordSentimentResult>
): {
  sentiment: SentimentLabel;
  confidence: number;
  breakdown: {
    positive: number;
    negative: number;
    neutral: number;
    total: number;
    percentages: {
      positive: number;
      negative: number;
      neutral: number;
    };
    averageConfidence: number;
  };
} {
  if (!Array.isArray(results) || results.length === 0) {
    return {
      sentiment: "neutral",
      confidence: 0.5,
      breakdown: {
        positive: 0,
        negative: 0,
        neutral: 0,
        total: 0,
        percentages: { positive: 0, negative: 0, neutral: 0 },
        averageConfidence: 0,
      },
    };
  }

  const breakdown = {
    positive: 0,
    negative: 0,
    neutral: 0,
    total: results.length,
    percentages: { positive: 0, negative: 0, neutral: 0 },
    averageConfidence: 0,
  };

  let totalWeightedScore = 0;

  results.forEach((result) => {
    const weight = result.confidence;
    totalWeightedScore += weight;

    breakdown[result.sentiment]++;
  });

  const total = breakdown.total;
  breakdown.percentages = {
    positive: Number(((breakdown.positive / total) * 100).toFixed(2)),
    negative: Number(((breakdown.negative / total) * 100).toFixed(2)),
    neutral: Number(((breakdown.neutral / total) * 100).toFixed(2)),
  };

  breakdown.averageConfidence = Number(
    (totalWeightedScore / results.length).toFixed(3)
  );

  let overallSentiment: SentimentLabel = "neutral";
  let confidence = breakdown.averageConfidence;

  const {
    positive: posPercent,
    negative: negPercent,
    neutral: neutPercent,
  } = breakdown.percentages;

  // Enhanced sentiment determination logic
  if (posPercent > 50 && posPercent > negPercent + 15) {
    overallSentiment = "positive";
    confidence = Math.min(
      0.95,
      0.6 + (posPercent / 100) * 0.3 + breakdown.averageConfidence * 0.1
    );
  } else if (negPercent > 50 && negPercent > posPercent + 15) {
    overallSentiment = "negative";
    confidence = Math.min(
      0.95,
      0.6 + (negPercent / 100) * 0.3 + breakdown.averageConfidence * 0.1
    );
  } else if (neutPercent > 60 || Math.abs(posPercent - negPercent) < 10) {
    overallSentiment = "neutral";
    confidence = Math.min(0.85, 0.5 + breakdown.averageConfidence * 0.3);
  } else {
    overallSentiment = posPercent > negPercent ? "positive" : "negative";
    confidence = Math.min(
      0.8,
      0.5 + (Math.abs(posPercent - negPercent) / 100) * 0.3
    );
  }

  return {
    sentiment: overallSentiment,
    confidence: Number(confidence.toFixed(3)),
    breakdown,
  };
}
