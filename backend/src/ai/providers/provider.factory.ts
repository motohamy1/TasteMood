import { AIProvider } from './ai-provider.interface.js';
import { MockAIProvider } from './mock.provider.js';
import { GeminiAIProvider } from './gemini.provider.js';
import { OpenAIProvider } from './openai.provider.js';
import { env } from '../../config/env.js';

/**
 * Single selection point for the AI-provider seam. Every declared provider
 * value has a real adapter; an unknown value is a hard error instead of a
 * silent fall-through to the mock.
 */
class AIProviderFactory {
  private static instance: AIProvider;

  public static getProvider(): AIProvider {
    if (!AIProviderFactory.instance) {
      switch (env.AI_PROVIDER) {
        case 'gemini':
          AIProviderFactory.instance = new GeminiAIProvider();
          break;
        case 'openai':
          AIProviderFactory.instance = new OpenAIProvider();
          break;
        case 'mock':
          AIProviderFactory.instance = new MockAIProvider();
          break;
        default:
          throw new Error(`Unknown AI provider: ${env.AI_PROVIDER}`);
      }
    }
    return AIProviderFactory.instance;
  }
}

export const getAIProvider = (): AIProvider => AIProviderFactory.getProvider();
