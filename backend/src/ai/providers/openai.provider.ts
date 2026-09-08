import { AIProvider, RecommendationFact, UserContext } from './ai-provider.interface.js';
import { StructuredIntent, StructuredIntentSchema } from '../intent/intent.schema.js';
import { INTENT_EXTRACTION_SYSTEM_PROMPT, EXPLANATION_SYSTEM_PROMPT } from '../intent/prompts.js';
import { env } from '../../config/env.js';
import { logger } from '../../common/utils/logger.js';

/**
 * OpenAI adapter (Chat Completions via fetch — no extra SDK dependency).
 *
 * Same single-sourced failure policy as the Gemini adapter: throw on any
 * problem; the intent / explanation service seams own the degrade decision.
 */
export class OpenAIProvider implements AIProvider {
  public readonly name = 'OpenAIProvider';
  private readonly baseUrl = 'https://api.openai.com/v1';

  async #complete(prompt: string, temperature: number): Promise<string> {
    if (!env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key is not configured');
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL,
        temperature,
        messages: [
          {
            role: 'system',
            content: 'You respond with valid JSON only, no markdown fences.',
          },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI request failed: ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('OpenAI returned an empty completion');
    }
    return content.trim();
  }

  async extractIntent(rawQuery: string, userContext?: UserContext): Promise<StructuredIntent> {
    try {
      const userContextStr = userContext ? `User profile context: ${JSON.stringify(userContext)}` : '';
      const prompt = `${INTENT_EXTRACTION_SYSTEM_PROMPT}\n${userContextStr}\nUser Request: "${rawQuery}"`;
      const content = await this.#complete(prompt, 0.1);

      const parsedJson = JSON.parse(content);
      parsedJson.rawQuery = rawQuery;
      return StructuredIntentSchema.parse(parsedJson);
    } catch (error) {
      logger.error('OpenAI Intent Extraction error:', error);
      throw error;
    }
  }

  async generateExplanation(query: string, facts: RecommendationFact[]): Promise<string[]> {
    try {
      const prompt = `${EXPLANATION_SYSTEM_PROMPT}\nUser Request: "${query}"\nCandidate Facts:\n${JSON.stringify(facts, null, 2)}`;
      const content = await this.#complete(prompt, 0.2);
      const explanations = JSON.parse(content);

      if (!Array.isArray(explanations) || explanations.length !== facts.length) {
        throw new Error('OpenAI explanation count does not match fact count');
      }
      return explanations.map((e) => String(e));
    } catch (error) {
      logger.error('OpenAI Explanation generation error:', error);
      throw error;
    }
  }
}
