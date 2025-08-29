export interface ModelContribution {
  source: string;
  confidence: number;
  processingTime: number;
  data: {
    insights?: string[];
    strengths?: string[];
    response?: string;
    analysis?: string;
  };
}

export interface EnsembleResponse {
  finalResponse: string;
  consensusScore: number;
  totalProcessingTime: number;
  modelContributions: ModelContribution[];
  methodology: string;
}

export interface ModelResponse {
  source: string;
  response: string;
  confidence: number;
  processingTime: number;
  data?: {
    strengths?: string[];
    insights?: string[];
  };
}
