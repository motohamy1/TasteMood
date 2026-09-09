import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ZodType, z } from 'zod';
import { env } from '../../config/env.js';
import { logger } from '../../common/utils/logger.js';

/**
 * JSON generation with a free-tier fallback chain: Gemini → Groq → OpenRouter.
 * Groq and OpenRouter both speak the OpenAI Chat Completions wire format, so
 * they share one helper. Each provider is tried in order; the first one whose
 * response parses AND validates against the zod schema wins.
 */

interface CompletionRequest {
  system: string;
  user: string;
  temperature: number;
}

const GEMINI = 'gemini';
const GROQ = 'groq';
const OPENROUTER = 'openrouter';

function activeProviders(): string[] {
  const providers: string[] = [];
  if (env.GEMINI_API_KEY) providers.push(GEMINI);
  if (env.GROQ_API_KEY) providers.push(GROQ);
  if (env.OPENROUTER_API_KEY) providers.push(OPENROUTER);
  return providers;
}

async function completeGemini(request: CompletionRequest): Promise<string> {
  const client = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  const model = client.getGenerativeModel({
    model: env.GEMINI_MODEL,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: request.temperature,
    },
  });
  const result = await model.generateContent(`${request.system}\n\n${request.user}`);
  return result.response.text();
}

async function completeOpenAiCompatible(
  provider: string,
  baseUrl: string,
  apiKey: string,
  model: string,
  request: CompletionRequest
): Promise<string> {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: request.temperature,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: request.system },
        { role: 'user', content: request.user },
      ],
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) {
    throw new Error(`${provider} responded ${response.status} ${response.statusText}`);
  }
  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error(`${provider} returned an empty completion`);
  return content;
}

async function completeWith(provider: string, request: CompletionRequest): Promise<string> {
  switch (provider) {
    case GEMINI:
      return completeGemini(request);
    case GROQ:
      return completeOpenAiCompatible(GROQ, 'https://api.groq.com/openai/v1', env.GROQ_API_KEY, env.GROQ_MODEL, request);
    case OPENROUTER:
      return completeOpenAiCompatible(
        OPENROUTER,
        'https://openrouter.ai/api/v1',
        env.OPENROUTER_API_KEY,
        env.OPENROUTER_MODEL,
        request
      );
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

function stripFences(raw: string): string {
  return raw
    .replace(/^\s*```(?:json)?/i, '')
    .replace(/```\s*$/, '')
    .trim();
}

/**
 * Generate strict JSON via the provider fallback chain.
 * Throws with every provider's error when all of them fail.
 */
export async function generateJson<S extends ZodType<unknown, z.ZodTypeDef, unknown>>(
  request: CompletionRequest,
  schema: S
): Promise<z.output<S>> {
  const providers = activeProviders();
  if (providers.length === 0) {
    throw new Error(
      'No AI provider configured: set GEMINI_API_KEY, GROQ_API_KEY, or OPENROUTER_API_KEY (all have free tiers).'
    );
  }

  const errors: string[] = [];
  for (const provider of providers) {
    try {
      const raw = await completeWith(provider, request);
      const parsed = JSON.parse(stripFences(raw));
      return schema.parse(parsed) as z.output<S>;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(`[enrichment] provider ${provider} failed: ${message}`);
      errors.push(`${provider}: ${message}`);
    }
  }
  throw new Error(`All AI providers failed → ${errors.join(' | ')}`);
}
