import { GoogleGenerativeAI } from '@google/generative-ai';
import { AIProvider, RecommendationFact, UserContext } from './ai-provider.interface.js';
import { StructuredIntent, StructuredIntentSchema } from '../intent/intent.schema.js';
import { INTENT_EXTRACTION_SYSTEM_PROMPT, EXPLANATION_SYSTEM_PROMPT } from '../intent/prompts.js';
import { env } from '../../config/env.js';
import { logger } from '../../common/utils/logger.js';
import { MockAIProvider } from './mock.provider.js';

export class GeminiAIProvider implements AIProvider {
  public readonly name = 'GeminiAIProvider';
  private client: GoogleGenerativeAI | null = null;
  private fallbackProvider: MockAIProvider;

  constructor() {
    this.fallbackProvider = new MockAIProvider();
    if (env.GEMINI_API_KEY) {
      this.client = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    }
  }

  async extractIntent(rawQuery: string, userContext?: UserContext): Promise<StructuredIntent> {
    if (!this.client || !env.GEMINI_API_KEY) {
      logger.warn('Gemini API key missing. Falling back to heuristic extractor.');
      return this.fallbackProvider.extractIntent(rawQuery, userContext);
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
      logger.error('Gemini Intent Extraction error. Using fallback extractor:', error);
      return this.fallbackProvider.extractIntent(rawQuery, userContext);
    }
  }

  async generateExplanation(query: string, facts: RecommendationFact[]): Promise<string[]> {
    if (!this.client || !env.GEMINI_API_KEY || facts.length === 0) {
      return this.fallbackProvider.generateExplanation(query, facts);
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

      if (Array.isArray(explanations) && explanations.length === facts.length) {
        return explanations.map((e) => String(e));
      }
      return this.fallbackProvider.generateExplanation(query, facts);
    } catch (error) {
      logger.error('Gemini Explanation generation error. Using fallback generator:', error);
      return this.fallbackProvider.generateExplanation(query, facts);
    }
  }
}
