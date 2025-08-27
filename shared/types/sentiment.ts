export type SentimentLabel = "positive" | "negative" | "neutral";

export interface SentimentResult {
  sentiment: SentimentLabel;
  confidence: number;
  scores: Array<{ label: string; score: number }>;
}

export interface KeywordSentimentResult extends SentimentResult {
  method: "keyword";
}
