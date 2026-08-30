import { AIProvider } from './ai-provider.interface.js';
import { MockAIProvider } from './mock.provider.js';
import { GeminiAIProvider } from './gemini.provider.js';
import { env } from '../../config/env.js';

class AIProviderFactory {
  private static instance: AIProvider;

  public static getProvider(): AIProvider {
    if (!AIProviderFactory.instance) {
      switch (env.AI_PROVIDER) {
        case 'gemini':
          AIProviderFactory.instance = new GeminiAIProvider();
          break;
        case 'mock':
        default:
          AIProviderFactory.instance = new MockAIProvider();
          break;
      }
    }
    return AIProviderFactory.instance;
  }
}

export const getAIProvider = (): AIProvider => AIProviderFactory.getProvider();
