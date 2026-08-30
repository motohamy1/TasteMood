import { getAIProvider } from '../providers/provider.factory.js';
import { StructuredIntent, StructuredIntentSchema } from './intent.schema.js';
import { UserContext } from '../providers/ai-provider.interface.js';
import { logger } from '../../common/utils/logger.js';
import { MockAIProvider } from '../providers/mock.provider.js';

export class IntentService {
  private fallbackProvider = new MockAIProvider();

  async extractIntent(rawQuery: string, userContext?: UserContext): Promise<StructuredIntent> {
    const provider = getAIProvider();
    try {
      const intent = await provider.extractIntent(rawQuery, userContext);
      return StructuredIntentSchema.parse(intent);
    } catch (error) {
      logger.error(`Failed to parse AI intent with ${provider.name}. Invoking fallback:`, error);
      const fallback = await this.fallbackProvider.extractIntent(rawQuery, userContext);
      return StructuredIntentSchema.parse(fallback);
    }
  }
}

export const intentService = new IntentService();
