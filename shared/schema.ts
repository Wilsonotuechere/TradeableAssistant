import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  integer,
  decimal,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const chatHistory = pgTable("chat_history", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),
  title: text("title").notNull(),
  category: text("category").notNull(),
  messages: jsonb("messages").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const marketData = pgTable("market_data", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  symbol: text("symbol").notNull(),
  name: text("name").notNull(),
  price: decimal("price", { precision: 18, scale: 8 }).notNull(),
  priceChange24h: decimal("price_change_24h", {
    precision: 18,
    scale: 8,
  }).notNull(),
  priceChangePercent24h: decimal("price_change_percent_24h", {
    precision: 5,
    scale: 2,
  }).notNull(),
  volume24h: decimal("volume_24h", { precision: 18, scale: 8 }).notNull(),
  marketCap: decimal("market_cap", { precision: 18, scale: 8 }),
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
});

export const newsArticles = pgTable("news_articles", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  content: text("content").notNull(),
  source: text("source").notNull(),
  sentiment: text("sentiment").notNull(),
  imageUrl: text("image_url"),
  publishedAt: timestamp("published_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertChatHistorySchema = createInsertSchema(chatHistory).omit({
  id: true,
  createdAt: true,
});

export const insertMarketDataSchema = createInsertSchema(marketData).omit({
  id: true,
  lastUpdated: true,
});

export const insertNewsArticleSchema = createInsertSchema(newsArticles).omit({
  id: true,
  createdAt: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertChatHistory = z.infer<typeof insertChatHistorySchema>;
export type ChatHistory = typeof chatHistory.$inferSelect;

export type InsertMarketData = z.infer<typeof insertMarketDataSchema>;
export type MarketData = typeof marketData.$inferSelect;

export type InsertNewsArticle = z.infer<typeof insertNewsArticleSchema>;
export type NewsArticle = typeof newsArticles.$inferSelect;

// Additional types
export interface ModelContribution {
  source: string;
  confidence: number;
  data: any;
  processingTime: number;
}

export interface EnsembleDetails {
  consensusScore: number;
  processingTime: number;
  modelsUsed: Array<{
    name: string;
    confidence: number;
    processingTime: number;
    strengths: string[];
  }>;
}

export interface ChatMetadata {
  ensembleDetails?: EnsembleDetails;
  modelContributions?: ModelContribution[];
  methodology?: string;
}

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  intent: "AI_RESPONSE" | "USER_QUERY" | "SYSTEM" | "ERROR" | "GENERAL";
  metadata?: ChatMetadata;
};

export type MarketStats = {
  totalMarketCap: string;
  totalVolume24h: string;
  btcDominance: string;
  fearGreedIndex: number;
};

export type SentimentData = {
  positive: number;
  neutral: number;
  negative: number;
  mood: "bullish" | "neutral" | "bearish";
};
