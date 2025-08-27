// server/config/env.ts
import { config } from "dotenv";
import { z } from "zod";

// Load environment variables
config();

// Define the schema for environment variables
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.string().transform(Number).default("3000"),

  // API Keys
  BINANCE_API_KEY: z.string().optional(),
  BINANCE_API_SECRET: z.string().optional(),
  NEWS_API_KEY: z.string().optional(),
  TWITTER_BEARER_TOKEN: z.string().optional(),
  HUGGINGFACE_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),

  // Database
  VITE_SUPABASE_URL: z.string().optional(),
  VITE_SUPABASE_ANON_KEY: z.string().optional(),

  // Security
  SESSION_SECRET: z.string().default("your_session_secret_here"),
  ALLOWED_ORIGINS: z.string().default("http://localhost:3000"),
});

// Parse and validate environment variables
let env: z.infer<typeof envSchema>;

try {
  env = envSchema.parse(process.env);
  console.log("Environment configuration loaded successfully");

  // Log which API keys are available (without exposing the actual keys)
  const apiKeys = {
    BINANCE: !!env.BINANCE_API_KEY,
    NEWS_API: !!env.NEWS_API_KEY,
    TWITTER: !!env.TWITTER_BEARER_TOKEN,
    HUGGINGFACE: !!env.HUGGINGFACE_API_KEY,
    GEMINI: !!env.GEMINI_API_KEY,
  };
  console.log("API Keys available:", apiKeys);

  // Warn about missing critical API keys
  if (!env.GEMINI_API_KEY) {
    console.warn(
      "⚠️  GEMINI_API_KEY is not set - AI chat functionality will be limited"
    );
  }
  if (!env.HUGGINGFACE_API_KEY) {
    console.warn(
      "⚠️  HUGGINGFACE_API_KEY is not set - sentiment analysis will use keyword fallback"
    );
  }
  if (!env.NEWS_API_KEY) {
    console.warn("⚠️  NEWS_API_KEY is not set - using mock news data");
  }
  if (!env.BINANCE_API_KEY) {
    console.warn("⚠️  BINANCE_API_KEY is not set - using mock market data");
  }
} catch (error) {
  console.error("Environment validation failed:", error);
  throw new Error("Invalid environment configuration");
}

export default env;
