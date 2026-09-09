import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(5000),
  API_PREFIX: z.string().default('/api/v1'),
  CORS_ORIGIN: z.string().default('*'),

  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/tastemood?schema=public'),
  DIRECT_URL: z.string().optional(),

  SUPABASE_URL: z.string().default('https://dummy.supabase.co'),
  SUPABASE_ANON_KEY: z.string().default('dummy-anon-key'),
  SUPABASE_JWT_SECRET: z.string().default('super-secret-jwt-key-for-local-dev-and-testing-12345'),

  AI_PROVIDER: z.enum(['mock', 'gemini', 'openai']).default('mock'),
  GEMINI_API_KEY: z.string().optional().default(''),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
  OPENAI_API_KEY: z.string().optional().default(''),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),

  // Free-tier fallback chain used by the menu enrichment pipeline:
  // Gemini → Groq → OpenRouter (all optional; missing keys drop out of the chain).
  FSQ_API_KEY: z.string().optional().default(''),
  GROQ_API_KEY: z.string().optional().default(''),
  GROQ_MODEL: z.string().default('llama-3.3-70b-versatile'),
  OPENROUTER_API_KEY: z.string().optional().default(''),
  OPENROUTER_MODEL: z.string().default('meta-llama/llama-3.3-70b-instruct:free'),

  DEFAULT_CURRENCY: z.string().default('EGP'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000), // 15 mins
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  AI_RATE_LIMIT_MAX: z.coerce.number().default(20),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('Invalid environment configuration:', parsedEnv.error.format());
  throw new Error('Invalid environment configuration');
}

export const env = parsedEnv.data;
