'use strict';

const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');

const getAiConfig = () => {
  const enabled = `${process.env.AI_ENABLED || 'false'}`.toLowerCase() === 'true';
  const baseUrl = (process.env.AI_BASE_URL || '').trim().replace(/\/$/, '');
  const apiKey = (process.env.AI_API_KEY || '').trim();
  const model = (process.env.AI_MODEL || '').trim();
  const path = (process.env.AI_CHAT_COMPLETIONS_PATH || '/chat/completions').trim();
  const timeoutMs = Number(process.env.AI_TIMEOUT_MS || 30000);
  // Some providers (e.g. OpenRouter free tier) require site metadata headers.
  const siteUrl = (process.env.AI_SITE_URL || process.env.CLIENT_URL || 'http://localhost:3000').trim();
  const siteTitle = (process.env.AI_SITE_TITLE || 'E-Commerce Admin').trim();

  return { enabled, baseUrl, apiKey, model, path, timeoutMs, siteUrl, siteTitle };
};

const getMessageContent = (content) => {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === 'string' ? part : part?.text || ''))
      .join('\n')
      .trim();
  }
  return '';
};

const parseJsonResponse = (content) => {
  const trimmed = (content || '').trim();
  if (!trimmed) {
    throw new AppError('AI_INVALID_RESPONSE', 502, 'AI provider returned an empty response.');
  }

  // Strip markdown fences the model may have added despite the prompt instruction
  const stripped = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();

  try {
    return JSON.parse(stripped);
  } catch (_) {
    // Last-resort: find outermost { … } block
    const firstBrace = stripped.indexOf('{');
    const lastBrace = stripped.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return JSON.parse(stripped.slice(firstBrace, lastBrace + 1));
      } catch (_inner) { /* fall through */ }
    }
    throw new AppError('AI_INVALID_RESPONSE', 502, 'AI provider returned invalid JSON. Try a different model.');
  }
};

const completeJson = async ({ system, user, temperature = 0.3 }) => {
  const config = getAiConfig();

  if (!config.enabled) {
    throw new AppError('AI_DISABLED', 503, 'AI assistant is disabled. Set AI_ENABLED=true to use this feature.');
  }

  if (!config.baseUrl || !config.model) {
    throw new AppError(
      'AI_MISCONFIGURED',
      503,
      'AI assistant is not configured. Add AI_BASE_URL and AI_MODEL in the server environment.'
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (config.apiKey) {
      headers.Authorization = `Bearer ${config.apiKey}`;
    }
    // OpenRouter (and some other providers) use these headers for routing &
    // rate-limit exemptions on the free tier. They are ignored by other providers.
    headers['HTTP-Referer'] = config.siteUrl;
    headers['X-Title'] = config.siteTitle;

    const body = {
      model: config.model,
      temperature,
      // NOTE: `response_format: { type: 'json_object' }` is intentionally omitted.
      // Many open-source and free-tier models do not support this parameter and will
      // return an empty content field when it is present. The system prompt already
      // instructs the model to return valid JSON only, which is sufficient.
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    };

    const response = await fetch(`${config.baseUrl}${config.path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      // Log the raw provider error without leaking the API key
      logger.warn('AI provider returned non-OK status', {
        status: response.status,
        model: config.model,
        errorCode: payload?.error?.code,
        errorMessage: payload?.error?.message,
      });
      throw new AppError(
        'AI_PROVIDER_ERROR',
        502,
        payload?.error?.message || `AI provider returned HTTP ${response.status}.`
      );
    }

    const finishReason = payload?.choices?.[0]?.finish_reason;
    const content = getMessageContent(payload?.choices?.[0]?.message?.content);

    // Surface the finish reason so empty-content failures are diagnosable
    if (!content) {
      logger.warn('AI provider returned empty content', {
        model: config.model,
        finishReason,
        hasChoices: Array.isArray(payload?.choices),
        choiceCount: payload?.choices?.length ?? 0,
      });

      const hint =
        finishReason === 'content_filter'
          ? 'The model refused to generate content for this prompt.'
          : finishReason === 'length'
            ? 'The response was cut off — try a shorter prompt or a model with a larger context window.'
            : `Model: ${config.model} — try a model that supports JSON output (e.g. mistralai/mistral-7b-instruct:free).`;

      throw new AppError('AI_INVALID_RESPONSE', 502, `AI provider returned an empty response. ${hint}`);
    }

    return parseJsonResponse(content);
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new AppError('AI_TIMEOUT', 504, 'AI provider timed out. Try a faster model or increase AI_TIMEOUT_MS.');
    }
    if (err instanceof AppError) throw err;
    throw new AppError('AI_PROVIDER_ERROR', 502, err.message || 'AI provider request failed.');
  } finally {
    clearTimeout(timeout);
  }
};

module.exports = {
  completeJson,
  getAiConfig,
};
