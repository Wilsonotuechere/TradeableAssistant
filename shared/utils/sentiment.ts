import {
  SentimentResult,
  KeywordSentimentResult,
  type SentimentLabel,
} from "../types/sentiment";

// Enhanced keyword lists for crypto-specific sentiment analysis
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
];

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

  // Count positive keywords with escaped regex
  POSITIVE_KEYWORDS.forEach((keyword) => {
    const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matches = (
      lowerText.match(new RegExp(`\\b${escapedKeyword}\\b`, "g")) || []
    ).length;
    positiveScore += matches;
  });

  // Count negative keywords with escaped regex
  NEGATIVE_KEYWORDS.forEach((keyword) => {
    const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matches = (
      lowerText.match(new RegExp(`\\b${escapedKeyword}\\b`, "g")) || []
    ).length;
    negativeScore += matches;
  });

  const totalScore = positiveScore + negativeScore;

  if (totalScore === 0) {
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

  if (positiveRatio > 0.6) {
    sentiment = "positive";
    confidence = Math.min(0.8, positiveRatio + 0.2);
  } else if (negativeRatio > 0.6) {
    sentiment = "negative";
    confidence = Math.min(0.8, negativeRatio + 0.2);
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
  // For now, we'll use the keyword-based analysis
  // In a production environment, you might want to use ML models or external APIs
  return analyzeKeywordSentiment(text);
}

export async function analyzeMultipleTexts(
  texts: string[]
): Promise<Array<SentimentResult | KeywordSentimentResult>> {
  return Promise.all(texts.map((text) => analyzeSentiment(text)));
}
