export interface ModelResponse {
  source: string;
  confidence: number;
  data: any;
  processingTime: number;
}

export interface EnsembleResponse {
  finalResponse: string;
  modelContributions: ModelResponse[];
  consensusScore: number;
  totalProcessingTime: number;
  methodology: string;
}

export interface AIServiceOptions {
  useGemini?: boolean;
  useFinancialBert?: boolean;
  useCryptoBert?: boolean;
  useNewsAnalysis?: boolean;
  weightingStrategy?: "confidence" | "equal";
}

// Model configurations
export const HF_MODELS = {
  FINANCIAL_BERT: "cardiffnlp/twitter-roberta-base-sentiment-latest",
  CRYPTO_SENTIMENT: "nlptown/bert-base-multilingual-uncased-sentiment",
  MARKET_ANALYSIS: "microsoft/DialoGPT-medium",
  TECHNICAL_ANALYSIS: "facebook/blenderbot-400M-distill",
  NEWS_CLASSIFICATION: "cardiffnlp/twitter-roberta-base-sentiment-latest",
} as const;
