import { getAIProvider } from '../providers/provider.factory.js';
import { RecommendationFact } from '../providers/ai-provider.interface.js';
import { logger } from '../../common/utils/logger.js';
import { MockAIProvider } from '../providers/mock.provider.js';

export class ExplanationService {
  private fallbackProvider = new MockAIProvider();

  async generateExplanations(query: string, facts: RecommendationFact[]): Promise<string[]> {
    if (facts.length === 0) return [];
    const provider = getAIProvider();

    try {
      return await provider.generateExplanation(query, facts);
    } catch (error) {
      logger.error(`Failed to generate explanation with ${provider.name}. Falling back:`, error);
      return this.fallbackProvider.generateExplanation(query, facts);
    }
  }
}

export const explanationService = new ExplanationService();
