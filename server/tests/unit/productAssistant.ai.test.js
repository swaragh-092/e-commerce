import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { buildAiConfig } = require('../../src/modules/productAssistant/productAssistant.ai');
const { buildFeatures } = require('../../src/config/modes');

describe('product assistant AI configuration', () => {
  it('is enabled by default in both store modes so the UI can be controlled by the admin toggle', () => {
    expect(buildFeatures({}, 'ecommerce').productAssistant).toBe(true);
    expect(buildFeatures({}, 'catalog').productAssistant).toBe(true);
    expect(buildFeatures({ productAssistant: false }, 'ecommerce').productAssistant).toBe(false);
  });

  it('uses environment configuration when no database override is present', () => {
    const config = buildAiConfig({
      settings: {},
      credentials: {},
      env: {
        AI_ENABLED: 'true',
        AI_BASE_URL: 'https://env.example/v1',
        AI_API_KEY: 'env-key',
        AI_MODEL: 'env-model',
      },
    });

    expect(config).toMatchObject({
      enabled: true,
      baseUrl: 'https://env.example/v1',
      apiKey: 'env-key',
      model: 'env-model',
    });
  });

  it('prefers database settings and credentials over environment values', () => {
    const config = buildAiConfig({
      settings: {
        baseUrl: 'https://db.example/v1',
        model: 'db-model',
        chatCompletionsPath: '/custom/completions',
        timeoutMs: 12000,
      },
      credentials: { apiKey: 'db-key' },
      env: {
        AI_ENABLED: 'false',
        AI_BASE_URL: 'https://env.example/v1',
        AI_API_KEY: 'env-key',
        AI_MODEL: 'env-model',
      },
    });

    expect(config).toMatchObject({
      enabled: true,
      baseUrl: 'https://db.example/v1',
      apiKey: 'db-key',
      model: 'db-model',
      path: '/custom/completions',
      timeoutMs: 12000,
    });
  });
});
