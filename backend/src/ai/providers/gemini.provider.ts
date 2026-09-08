import { GoogleGenerativeAI } from '@google/generative-ai';
import { AIProvider, RecommendationFact, UserContext } from './ai-provider.interface.js';
import { StructuredIntent, StructuredIntentSchema } from '../intent/intent.schema.js';
import { INTENT_EXTRACTION_SYSTEM_PROMPT, EXPLANATION_SYSTEM_PROMPT } from '../intent/prompts.js';
import { env } from '../../config/env.js';
import { logger } from '../../common/utils/logger.js';

/**
 * Gemini adapter. Failure policy is single-sourced: this adapter throws on any
 * problem (missing key, network, unparseable response) and the intent /
 * explanation services — the seam callers cross — decide whether to degrade to
 * the heuristic mock. Previously each adapter carried its own private mock
 * fallback on top of the service fallback, triplicating the policy.
 */
export class GeminiAIProvider implements AIProvider {
  public readonly name = 'GeminiAIProvider';
  private client: GoogleGenerativeAI | null = null;

  constructor() {
    if (env.GEMINI_API_KEY) {
      this.client = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    }
  }

  async extractIntent(rawQuery: string, userContext?: UserContext): Promise<StructuredIntent> {
    if (!this.client) {
      throw new Error('Gemini API key is not configured');
    }

    try {
      const model = this.client.getGenerativeModel({
        model: env.GEMINI_MODEL,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      });

      const userContextStr = userContext ? `User profile context: ${JSON.stringify(userContext)}` : '';
      const prompt = `${INTENT_EXTRACTION_SYSTEM_PROMPT}\n${userContextStr}\nUser Request: "${rawQuery}"`;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const parsedJson = JSON.parse(text);

      parsedJson.rawQuery = rawQuery;
      return StructuredIntentSchema.parse(parsedJson);
    } catch (error) {
      logger.error('Gemini Intent Extraction error:', error);
      throw error;
    }
  }

  async generateExplanation(query: string, facts: RecommendationFact[]): Promise<string[]> {
    if (!this.client || facts.length === 0) {
      throw new Error('Gemini API key is not configured');
    }

    try {
      const model = this.client.getGenerativeModel({
        model: env.GEMINI_MODEL,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });

      const prompt = `${EXPLANATION_SYSTEM_PROMPT}\nUser Request: "${query}"\nCandidate Facts:\n${JSON.stringify(facts, null, 2)}`;
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const explanations = JSON.parse(text);

      if (!Array.isArray(explanations) || explanations.length !== facts.length) {
        throw new Error('Gemini explanation count does not match fact count');
      }
      return explanations.map((e) => String(e));
    } catch (error) {
      logger.error('Gemini Explanation generation error:', error);
      throw error;
    }
  }
}
