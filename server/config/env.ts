import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file from project root
export function loadEnv() {
  dotenv.config({ path: path.resolve(__dirname, "../.env") });
}

// Load environment variables immediately
loadEnv();

// Export environment variables with proper typing
const env = {
  // Crypto Market Data APIs
  BINANCE_API_KEY: process.env.BINANCE_API_KEY || "",
  BINANCE_API_SECRET: process.env.BINANCE_API_SECRET || "",

  // News APIs
  NEWS_API_KEY: process.env.NEWS_API_KEY || "",

  // Social Media APIs
  TWITTER_BEARER_TOKEN: process.env.TWITTER_BEARER_TOKEN || "",

  // AI/ML APIs
  HUGGINGFACE_API_KEY: process.env.HUGGINGFACE_API_KEY || "",
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || "", // Fixed: This was the missing export

  // Server Configuration
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: parseInt(process.env.PORT || "3000"),

  // Supabase
  VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || "",
  VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || "",

  // Security
  SESSION_SECRET: process.env.SESSION_SECRET || "",

  // CORS
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || "http://localhost:3000",
} as const;

// Validators for required API keys and secrets
export function validateEnvVars() {
  const requiredVars = [
    "BINANCE_API_KEY",
    "BINANCE_API_SECRET",
    "NEWS_API_KEY",
    "TWITTER_BEARER_TOKEN",
    "HUGGINGFACE_API_KEY",
    "GEMINI_API_KEY",
    "SESSION_SECRET",
    "VITE_SUPABASE_URL",
    "VITE_SUPABASE_ANON_KEY",
  ];

  const missing = requiredVars.filter((key) => !env[key as keyof typeof env]);

  if (missing.length > 0) {
    console.error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
    console.error(
      "Please check your .env file and ensure all required variables are set."
    );
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
}

// Export the env object as default
export default env;
