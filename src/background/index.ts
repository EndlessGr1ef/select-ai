// Background service worker for handling AI requests

console.log('[AI Search] Background service worker loaded');

import {
  type Provider,
  PROVIDER_CONFIGS,
  DEFAULT_PROVIDER,
  CONTEXT_MAX_TOKENS,
  REQUEST_TIMEOUT,
  clampContextMaxTokens,
  clampTranslationConcurrency,
} from '../config';

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['selectedProvider'], (result) => {
    if (!result.selectedProvider) {
      chrome.storage.local.set({ selectedProvider: DEFAULT_PROVIDER });
    }
  });
});

function normalizeOpenAIEndpoint(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, '');
  if (/\/chat\/completions$/i.test(trimmed)) {
    return trimmed;
  }
  if (trimmed.includes('/v1')) {
    return `${trimmed}/chat/completions`;
  }
  return `${trimmed}/v1/chat/completions`;
}

import { type DetailLevel, buildExplanationPrompt, getMaxTokensForDetailLevel } from '../utils/explanationPrompt';

// Optimization 1: Config cache - avoid reading storage on every request
let cachedProviderConfig: {
  provider: Provider;
  apiKey: string;
  baseUrl: string;
  model: string;
  targetLang: string;
  contextMaxTokens: number;
  explanationDetailLevel: DetailLevel;
} | null = null;

let cachedTranslationConcurrency: number | null = null;

// Sanitize string for HTTP headers (remove non-ASCII characters)
function sanitizeForHeader(value: string): string {
  if (!value) return '';
  // Remove any character outside printable ASCII range (0x20-0x7E)
  return value.replace(/[^\x20-\x7E]/g, '').trim();
}

async function getCachedProviderConfig() {
  if (cachedProviderConfig) return cachedProviderConfig;

  const settings = await chrome.storage.local.get(['selectedProvider']);

  const provider = (settings.selectedProvider as Provider) || DEFAULT_PROVIDER;
  const config = PROVIDER_CONFIGS[provider];
  const storageKey = config.storageKey;

  const allKeys = [
    `${storageKey}ApiKey`,
    `${storageKey}BaseUrl`,
    `${storageKey}Model`,
    'targetLanguage',
    'contextMaxTokens',
    'explanationDetailLevel'
  ];
  const providerSettings = await chrome.storage.local.get(allKeys);

  const rawContextMaxTokens = providerSettings.contextMaxTokens as number | undefined;
  const contextMaxTokens = clampContextMaxTokens(Number(rawContextMaxTokens));

  const rawDetailLevel = providerSettings.explanationDetailLevel as string | undefined;
  const explanationDetailLevel: DetailLevel =
    (rawDetailLevel === 'concise' || rawDetailLevel === 'standard' || rawDetailLevel === 'detailed')
      ? rawDetailLevel
      : 'concise';

  cachedProviderConfig = {
    provider,
    apiKey: sanitizeForHeader(providerSettings[`${storageKey}ApiKey`] as string),
    baseUrl: (providerSettings[`${storageKey}BaseUrl`] as string) || config.defaultBaseUrl,
    model: (providerSettings[`${storageKey}Model`] as string) || config.defaultModel,
    targetLang: (providerSettings.targetLanguage as string) || (isBrowserChinese() ? '中文' : 'English'),
    contextMaxTokens,
    explanationDetailLevel
  };

  return cachedProviderConfig;
}

// Listen for config changes, update cache
chrome.storage.onChanged.addListener((changes) => {
  const relevantKeys = ['selectedProvider', 'openaiApiKey', 'openaiBaseUrl', 'openaiModel',
    'anthropicApiKey', 'anthropicBaseUrl', 'anthropicModel',
    'minimaxApiKey', 'minimaxBaseUrl', 'minimaxModel',
    'deepseekApiKey', 'deepseekBaseUrl', 'deepseekModel',
    'glmApiKey', 'glmBaseUrl', 'glmModel',
    'targetLanguage', 'contextMaxTokens', 'explanationDetailLevel'];

  for (const key of relevantKeys) {
    if (changes[key]) {
      cachedProviderConfig = null;
      break;
    }
  }

  if (changes.translationConcurrency) {
    cachedTranslationConcurrency = null;
  }
});

import { isBrowserChinese } from '../utils/language';

type QueryPayload = {
  selection: string;
  context: string;
  pageUrl?: string;
  pageTitle?: string;
  targetLang?: string;
  uiLang?: 'zh' | 'en';
};

type KanaPayload = {
  text: string;
  uiLang?: 'zh' | 'en';
};

type RequestConfig = {
  provider: Provider;
  streamFormat: StreamFormat;
  endpoint: string;
  headers: Record<string, string>;
  requestBody: Record<string, unknown>;
  isChineseUI: boolean;
};

type StreamFormat = 'openai' | 'anthropic';

function getStreamFormat(provider: Provider): StreamFormat {
  return provider === 'openai' || provider === 'deepseek'
    ? 'openai'
    : 'anthropic';
}

async function buildRequestConfig(payload: QueryPayload): Promise<RequestConfig> {
  // Optimization 1: Use cached config
  const cachedConfig = await getCachedProviderConfig();

  const provider = cachedConfig.provider;

  const apiKey = cachedConfig.apiKey;
  const baseUrl = cachedConfig.baseUrl;
  const model = cachedConfig.model;
  const targetLang = cachedConfig.targetLang || payload.targetLang || '中文';
  const contextMaxTokens = cachedConfig.contextMaxTokens || CONTEXT_MAX_TOKENS.default;
  const detailLevel = cachedConfig.explanationDetailLevel || 'concise';

  const isChineseUI = payload.uiLang ? payload.uiLang === 'zh' : payload.targetLang !== 'en';

  if (!apiKey) {
    throw new Error(isChineseUI ? '请先在设置页面配置 API Key' : 'Please configure API Key in settings');
  }

  // Prepare context (truncate if needed)
  const contextForApi = payload.context.length > contextMaxTokens
    ? payload.context.substring(0, contextMaxTokens) + '...'
    : payload.context;

  const isChineseTarget = targetLang.startsWith('中文') || targetLang.toLowerCase().startsWith('zh');

  // Build system prompt based on detail level
  const systemPrompt = buildExplanationPrompt(isChineseTarget, targetLang, detailLevel);
  const maxTokens = getMaxTokensForDetailLevel(detailLevel);

  const userPrompt = `
<url>${payload.pageUrl || 'unknown'}</url>
<title>${payload.pageTitle || 'unknown'}</title>
<context>${contextForApi}</context>
<selection>${payload.selection}</selection>`;

  const apiConfig = PROVIDER_CONFIGS[provider];
  const endpoint = provider === 'openai'
    ? normalizeOpenAIEndpoint(baseUrl)
    : `${baseUrl}${apiConfig.endpointPath}`;
  const authHeader = apiConfig.authHeader === 'Bearer'
    ? `Bearer ${apiKey}`
    : apiKey;

  // OpenAI-compatible providers require system inside messages
  const streamFormat = getStreamFormat(provider);
  const requestBody = streamFormat === 'openai'
    ? {
      model: model,
      max_tokens: maxTokens,
      temperature: 0.1,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      stream: true
    }
    : {
      model: model,
      max_tokens: maxTokens,
      temperature: 0.1,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt }
      ],
      stream: true
    };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    [apiConfig.authHeader === 'Bearer' ? 'Authorization' : 'x-api-key']: authHeader,
    ...apiConfig.extraHeaders,
  };

  return {
    provider,
    streamFormat,
    endpoint,
    headers,
    requestBody,
    isChineseUI
  };
}

type KanaRequestConfig = {
  provider: Provider;
  streamFormat: StreamFormat;
  endpoint: string;
  headers: Record<string, string>;
  requestBody: Record<string, unknown>;
  isChineseUI: boolean;
};

async function buildKanaRequestConfig(payload: KanaPayload): Promise<KanaRequestConfig> {
  const cachedConfig = await getCachedProviderConfig();

  const provider = cachedConfig.provider;
  const apiKey = cachedConfig.apiKey;
  const baseUrl = cachedConfig.baseUrl;
  const model = cachedConfig.model;
  const isChineseUI = payload.uiLang ? payload.uiLang === 'zh' : true;

  if (!apiKey) {
    throw new Error(isChineseUI ? '请先在设置页面配置 API Key' : 'Please configure API Key in settings');
  }

  const systemPrompt = `You are a Japanese reading assistant. Add ruby annotations to Japanese text.

【Rules】
1. Output ONLY the annotated text in HTML using <ruby> and <rt>;
2. Keep the original text content intact (including kanji, kana, punctuation, spacing, and line breaks);
3. Annotate ONLY kanji with hiragana in <rt>;
4. Do NOT add ruby to non-kanji text (Latin letters, numbers, kana, symbols);
5. Do NOT include any other HTML tags, markdown, or explanations.`;

  const userPrompt = `Annotate this Japanese text with ruby (hiragana in <rt>):

${payload.text}`;

  const apiConfig = PROVIDER_CONFIGS[provider];
  const endpoint = provider === 'openai'
    ? normalizeOpenAIEndpoint(baseUrl)
    : `${baseUrl}${apiConfig.endpointPath}`;
  const authHeader = apiConfig.authHeader === 'Bearer'
    ? `Bearer ${apiKey}`
    : apiKey;

  const streamFormat = getStreamFormat(provider);
  const requestBody = streamFormat === 'openai'
    ? {
      model: model,
      max_tokens: 1024,
      temperature: 0.1,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      stream: true
    }
    : {
      model: model,
      max_tokens: 1024,
      temperature: 0.1,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt }
      ],
      stream: true
    };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    [apiConfig.authHeader === 'Bearer' ? 'Authorization' : 'x-api-key']: authHeader,
    ...apiConfig.extraHeaders,
  };

  return {
    provider,
    streamFormat,
    endpoint,
    headers,
    requestBody,
    isChineseUI
  };
}

async function readErrorMessage(response: Response): Promise<string> {
  let errorMessage = `HTTP ${response.status}`;
  try {
    const errorData = await response.json();
    errorMessage = errorData.error?.message || errorData.message || JSON.stringify(errorData);
  } catch {
    errorMessage = await response.text() || errorMessage;
  }
  return errorMessage;
}

type StreamParseResult = {
  delta?: string;
  done?: boolean;
};

function parseOpenAIStreamPayload(data: unknown): StreamParseResult {
  const parsed = data as { choices?: Array<{ delta?: { content?: string }, finish_reason?: string | null }> };
  const delta = parsed?.choices?.[0]?.delta?.content;
  const finishReason = parsed?.choices?.[0]?.finish_reason;
  return {
    delta: typeof delta === 'string' && delta.length > 0 ? delta : undefined,
    done: typeof finishReason === 'string' && finishReason.length > 0 ? true : undefined
  };
}

function parseAnthropicStreamPayload(data: unknown): StreamParseResult {
  const parsed = data as {
    type?: string;
    delta?: { text?: string; stop_reason?: string | null };
    content_block?: { text?: string };
    content?: Array<{ text?: string }>;
    text?: string;
  };
  if (parsed?.type === 'content_block_delta') {
    const deltaText = parsed?.delta?.text;
    return { delta: typeof deltaText === 'string' && deltaText.length > 0 ? deltaText : undefined };
  }
  if (parsed?.type === 'content_block_start') {
    const blockText = parsed?.content_block?.text;
    return { delta: typeof blockText === 'string' && blockText.length > 0 ? blockText : undefined };
  }
  if (parsed?.type === 'message_delta' && parsed?.delta?.stop_reason) {
    return { done: true };
  }
  if (parsed?.type === 'message_stop') {
    return { done: true };
  }
  if (typeof parsed?.text === 'string' && parsed.text.length > 0) {
    return { delta: parsed.text };
  }
  if (parsed?.content?.[0]?.text && typeof parsed.content[0].text === 'string') {
    return { delta: parsed.content[0].text };
  }
  return {};
}

async function handleAIStream(payload: QueryPayload, port: chrome.runtime.Port): Promise<void> {
  const { streamFormat, endpoint, headers, requestBody, isChineseUI } = await buildRequestConfig(payload);

  const controller = new AbortController();
  let timeoutId: number;

  let isDisconnected = false;
  const safePostMessage = (msg: any) => {
    if (!isDisconnected) {
      try {
        port.postMessage(msg);
      } catch (e) {
        console.warn('[AI Search] Safe postMessage failed:', e);
      }
    }
  };

  // Cleanup when port disconnects
  const onDisconnect = () => {
    isDisconnected = true;
    if (timeoutId) clearTimeout(timeoutId);
    controller.abort();
  };
  port.onDisconnect.addListener(onDisconnect);

  // Timeout control
  timeoutId = setTimeout(() => {
    controller.abort();
    safePostMessage({ type: 'error', error: isChineseUI ? '请求超时（30秒）' : 'Request timeout (30s)' });
  }, REQUEST_TIMEOUT) as any;

  let doneSent = false;

  try {
    console.log('[AI Search] requestBody (stream):', JSON.stringify(requestBody, null, 2));

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error(isChineseUI ? '无法读取流式响应' : 'Unable to read streaming response');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;

        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') {
          doneSent = true;
          safePostMessage({ type: 'done' });
          return;
        }

        try {
          const parsed = JSON.parse(data);
          const result = streamFormat === 'openai'
            ? parseOpenAIStreamPayload(parsed)
            : parseAnthropicStreamPayload(parsed);
          if (result.delta) {
            safePostMessage({ type: 'delta', data: result.delta });
          }
          if (result.done) {
            doneSent = true;
            safePostMessage({ type: 'done' });
            return;
          }
        } catch (error) {
          console.warn('[AI Search] Stream chunk parse error:', error);
        }
      }
    }

    const remaining = buffer.trim();
    if (remaining.startsWith('data:')) {
      const data = remaining.slice(5).trim();
      if (data === '[DONE]') {
        doneSent = true;
        safePostMessage({ type: 'done' });
        return;
      }
      try {
        const parsed = JSON.parse(data);
        const result = streamFormat === 'openai'
          ? parseOpenAIStreamPayload(parsed)
          : parseAnthropicStreamPayload(parsed);
        if (result.delta) {
          safePostMessage({ type: 'delta', data: result.delta });
        }
        if (result.done) {
          doneSent = true;
          safePostMessage({ type: 'done' });
          return;
        }
      } catch (error) {
        console.warn('[AI Search] Stream tail parse error:', error);
      }
    }
  } catch (error) {
    if ((error as Error).name !== 'AbortError') {
      safePostMessage({ type: 'error', error: (error as Error).message || String(error) });
    }
  } finally {
    clearTimeout(timeoutId);
    port.onDisconnect.removeListener(onDisconnect);
    if (!doneSent) {
      safePostMessage({ type: 'done' });
    }
  }
}

async function handleKanaStream(payload: KanaPayload, port: chrome.runtime.Port): Promise<void> {
  const { streamFormat, endpoint, headers, requestBody, isChineseUI } = await buildKanaRequestConfig(payload);

  const controller = new AbortController();
  let timeoutId: number;

  let isDisconnected = false;
  const safePostMessage = (msg: any) => {
    if (!isDisconnected) {
      try {
        port.postMessage(msg);
      } catch (e) {
        console.warn('[AI Search] Kana safe postMessage failed:', e);
      }
    }
  };

  const onDisconnect = () => {
    isDisconnected = true;
    if (timeoutId) clearTimeout(timeoutId);
    controller.abort();
  };
  port.onDisconnect.addListener(onDisconnect);

  timeoutId = setTimeout(() => {
    controller.abort();
    safePostMessage({ type: 'error', error: isChineseUI ? '请求超时（30秒）' : 'Request timeout (30s)' });
  }, REQUEST_TIMEOUT) as any;

  let doneSent = false;

  try {
    console.log('[AI Search] kana requestBody (stream):', JSON.stringify(requestBody, null, 2));

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error(isChineseUI ? '无法读取流式响应' : 'Unable to read streaming response');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;

        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') {
          doneSent = true;
          safePostMessage({ type: 'done' });
          return;
        }

        try {
          const parsed = JSON.parse(data);
          const result = streamFormat === 'openai'
            ? parseOpenAIStreamPayload(parsed)
            : parseAnthropicStreamPayload(parsed);
          if (result.delta) {
            safePostMessage({ type: 'delta', data: result.delta });
          }
          if (result.done) {
            doneSent = true;
            safePostMessage({ type: 'done' });
            return;
          }
        } catch (error) {
          console.warn('[AI Search] Kana stream chunk parse error:', error);
        }
      }
    }

    const remaining = buffer.trim();
    if (remaining.startsWith('data:')) {
      const data = remaining.slice(5).trim();
      if (data === '[DONE]') {
        doneSent = true;
        safePostMessage({ type: 'done' });
        return;
      }
      try {
        const parsed = JSON.parse(data);
        const result = streamFormat === 'openai'
          ? parseOpenAIStreamPayload(parsed)
          : parseAnthropicStreamPayload(parsed);
        if (result.delta) {
          safePostMessage({ type: 'delta', data: result.delta });
        }
        if (result.done) {
          doneSent = true;
          safePostMessage({ type: 'done' });
          return;
        }
      } catch (error) {
        console.warn('[AI Search] Kana stream tail parse error:', error);
      }
    }
  } catch (error) {
    if ((error as Error).name !== 'AbortError') {
      safePostMessage({ type: 'error', error: (error as Error).message || String(error) });
    }
  } finally {
    clearTimeout(timeoutId);
    port.onDisconnect.removeListener(onDisconnect);
    if (!doneSent) {
      safePostMessage({ type: 'done' });
    }
  }
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'ai-stream' && port.name !== 'ai-translate-stream' && port.name !== 'ai-kana-stream' && port.name !== 'ai-test-connection') return;

  port.onMessage.addListener((message) => {
    if (message?.action === 'testConnection') {
      handleTestConnection(message.payload, port).catch((error) => {
        port.postMessage({ type: 'error', error: error.message || String(error) });
      });
    } else if (message?.action === 'queryAIStream') {
      handleAIStream(message.payload as QueryPayload, port).catch((error) => {
        port.postMessage({ type: 'error', error: error.message || String(error) });
      });

    } else if (message?.action === 'queryKana') {
      handleKanaStream(message.payload as KanaPayload, port).catch((error) => {
        port.postMessage({ type: 'error', error: error.message || String(error) });
      });

    } else if (message?.action === 'inlineTranslate') {
      enqueueInlineTranslate(message.payload as InlineTranslatePayload, port);
    } else if (message?.action === 'inlineTranslateBatch') {
      handleInlineTranslateBatch(message.payload as InlineTranslateBatchPayload, port).catch((error) => {
        port.postMessage({ type: 'error', error: error.message || String(error) });
      });
    }
  });
});

type InlineTranslatePayload = {
  selection: string;
  targetLang?: string;
  uiLang?: 'zh' | 'en';
};

type InlineTranslateBatchPayload = {
  selections: string[];
  targetLang?: string;
  uiLang?: 'zh' | 'en';
};

type InlineTranslateTask = {
  payload: InlineTranslatePayload;
  port: chrome.runtime.Port;
  started: boolean;
  canceled: boolean;
  onDisconnect: () => void;
};

const inlineTranslateQueue: InlineTranslateTask[] = [];
let inlineTranslateActiveCount = 0;

function removeInlineTranslateTask(task: InlineTranslateTask) {
  const index = inlineTranslateQueue.indexOf(task);
  if (index >= 0) {
    inlineTranslateQueue.splice(index, 1);
  }
}

async function getTranslationConcurrency(): Promise<number> {
  if (cachedTranslationConcurrency !== null) return cachedTranslationConcurrency;

  const settings = await chrome.storage.local.get(['translationConcurrency']);
  const rawValue = settings.translationConcurrency as number | undefined;
  const clamped = clampTranslationConcurrency(Number(rawValue));
  cachedTranslationConcurrency = clamped;
  return clamped;
}

async function processInlineTranslateQueue(): Promise<void> {
  const limit = await getTranslationConcurrency();

  while (inlineTranslateActiveCount < limit && inlineTranslateQueue.length > 0) {
    const task = inlineTranslateQueue.shift()!;
    if (task.canceled) continue;

    task.started = true;
    try {
      task.port.onDisconnect.removeListener(task.onDisconnect);
    } catch {
    }

    inlineTranslateActiveCount += 1;
    handleInlineTranslate(task.payload, task.port)
      .catch((error) => {
        task.port.postMessage({ type: 'error', error: error?.message || String(error) });
      })
      .finally(() => {
        inlineTranslateActiveCount -= 1;
        processInlineTranslateQueue().catch((error) => {
          console.warn('[Inline Translate] Queue process error:', error);
        });
      });
  }
}

function enqueueInlineTranslate(payload: InlineTranslatePayload, port: chrome.runtime.Port) {
  const task: InlineTranslateTask = {
    payload,
    port,
    started: false,
    canceled: false,
    onDisconnect: () => {
      if (task.started) return;
      task.canceled = true;
      removeInlineTranslateTask(task);
    }
  };

  port.onDisconnect.addListener(task.onDisconnect);
  inlineTranslateQueue.push(task);
  processInlineTranslateQueue().catch((error) => {
    console.warn('[Inline Translate] Queue process error:', error);
  });
}

type InlineTranslateRequestConfig = {
  provider: Provider;
  streamFormat: StreamFormat;
  endpoint: string;
  headers: Record<string, string>;
  requestBody: Record<string, unknown>;
};

async function buildInlineTranslateRequestConfig(payload: InlineTranslatePayload): Promise<InlineTranslateRequestConfig> {
  // Optimization 1: Use cached config
  const cachedConfig = await getCachedProviderConfig();

  const provider = cachedConfig.provider;
  const apiKey = cachedConfig.apiKey;
  const baseUrl = cachedConfig.baseUrl;
  const model = cachedConfig.model;
  const targetLang = cachedConfig.targetLang || payload.targetLang || 'English';

  const isChineseUI = payload.uiLang ? payload.uiLang === 'zh' : targetLang !== 'en';

  if (!apiKey) {
    throw new Error(isChineseUI ? '请先在设置页面配置 API Key' : 'Please configure API Key in settings');
  }

  const systemPrompt = `You are a professional translator. Your task is to translate text to ${targetLang}.

【Rules】
1. Output ONLY the translation, nothing else (no original text, no explanations);
2. Keep the translation accurate and natural;
3. Preserve the original meaning and tone;
4. Use Markdown format for better readability;
5. Do NOT use code blocks, inline code, or HTML tags;
6. Preserve any placeholder tokens like [[[T0]]] exactly and keep them in the same order;`;

  const userPrompt = `Translate this text to ${targetLang}:

${payload.selection}`;

  const apiConfig = PROVIDER_CONFIGS[provider];
  const endpoint = provider === 'openai'
    ? normalizeOpenAIEndpoint(baseUrl)
    : `${baseUrl}${apiConfig.endpointPath}`;
  const authHeader = apiConfig.authHeader === 'Bearer'
    ? `Bearer ${apiKey}`
    : apiKey;

  const streamFormat = getStreamFormat(provider);
  const requestBody = streamFormat === 'openai'
    ? {
      model: model,
      max_tokens: 1024,
      temperature: 0.1,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      stream: true
    }
    : {
      model: model,
      max_tokens: 1024,
      temperature: 0.1,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt }
      ],
      stream: true
    };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    [apiConfig.authHeader === 'Bearer' ? 'Authorization' : 'x-api-key']: authHeader,
    ...apiConfig.extraHeaders,
  };

  return {
    provider,
    streamFormat,
    endpoint,
    headers,
    requestBody,
  };
}

async function buildInlineTranslateBatchRequestConfig(payload: InlineTranslateBatchPayload): Promise<InlineTranslateRequestConfig> {
  const cachedConfig = await getCachedProviderConfig();

  const provider = cachedConfig.provider;
  const apiKey = cachedConfig.apiKey;
  const baseUrl = cachedConfig.baseUrl;
  const model = cachedConfig.model;
  const targetLang = cachedConfig.targetLang || payload.targetLang || 'English';

  const isChineseUI = payload.uiLang ? payload.uiLang === 'zh' : targetLang !== 'en';

  if (!apiKey) {
    throw new Error(isChineseUI ? '请先在设置页面配置 API Key' : 'Please configure API Key in settings');
  }

  const systemPrompt = `You are a professional translator. Your task is to translate a JSON array of texts to ${targetLang}.

【Rules】
1. You will receive a JSON array of strings.
2. You must return a valid JSON array of strings containing the translations.
3. The order of translations MUST match the original array.
4. Output ONLY the JSON array, nothing else (no code blocks, no explanations).
5. Ensure the JSON is valid (properly escaped).`;

  const userPrompt = JSON.stringify(payload.selections);

  const apiConfig = PROVIDER_CONFIGS[provider];
  const endpoint = provider === 'openai'
    ? normalizeOpenAIEndpoint(baseUrl)
    : `${baseUrl}${apiConfig.endpointPath}`;
  const authHeader = apiConfig.authHeader === 'Bearer'
    ? `Bearer ${apiKey}`
    : apiKey;

  const streamFormat = getStreamFormat(provider);
  const requestBody = streamFormat === 'openai'
    ? {
      model: model,
      max_tokens: 4096,
      temperature: 0.1,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      stream: true
    }
    : {
      model: model,
      max_tokens: 4096,
      temperature: 0.1,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt }
      ],
      stream: true
    };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    [apiConfig.authHeader === 'Bearer' ? 'Authorization' : 'x-api-key']: authHeader,
    ...apiConfig.extraHeaders,
  };

  return {
    provider,
    streamFormat,
    endpoint,
    headers,
    requestBody,
  };
}

async function handleInlineTranslate(payload: InlineTranslatePayload, port: chrome.runtime.Port): Promise<void> {
  const { streamFormat, endpoint, headers, requestBody } = await buildInlineTranslateRequestConfig(payload);

  const controller = new AbortController();
  let timeoutId: number;

  let isDisconnected = false;
  const safePostMessage = (msg: any) => {
    if (!isDisconnected) {
      try {
        port.postMessage(msg);
      } catch (e) {
        console.warn('[Inline Translate] Safe postMessage failed:', e);
      }
    }
  };

  const onDisconnect = () => {
    isDisconnected = true;
    if (timeoutId) clearTimeout(timeoutId);
    controller.abort();
  };
  port.onDisconnect.addListener(onDisconnect);

  // Timeout control
  timeoutId = setTimeout(() => {
    controller.abort();
    safePostMessage({ type: 'error', error: 'Request timeout (30s)' });
  }, REQUEST_TIMEOUT) as any;

  let doneSent = false;

  try {
    console.log('[Inline Translate] requestBody:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Unable to read streaming response');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;

        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') {
          doneSent = true;
          safePostMessage({ type: 'done' });
          return;
        }

        try {
          const parsed = JSON.parse(data);
          const result = streamFormat === 'openai'
            ? parseOpenAIStreamPayload(parsed)
            : parseAnthropicStreamPayload(parsed);
          if (result.delta) {
            safePostMessage({ type: 'delta', data: result.delta });
          }
          if (result.done) {
            doneSent = true;
            safePostMessage({ type: 'done' });
            return;
          }
        } catch (error) {
          console.warn('[Inline Translate] Stream chunk parse error:', error);
        }
      }
    }

    const remaining = buffer.trim();
    if (remaining.startsWith('data:')) {
      const data = remaining.slice(5).trim();
      if (data === '[DONE]') {
        doneSent = true;
        safePostMessage({ type: 'done' });
        return;
      }
      try {
        const parsed = JSON.parse(data);
        const result = streamFormat === 'openai'
          ? parseOpenAIStreamPayload(parsed)
          : parseAnthropicStreamPayload(parsed);
        if (result.delta) {
          safePostMessage({ type: 'delta', data: result.delta });
        }
        if (result.done) {
          doneSent = true;
          safePostMessage({ type: 'done' });
          return;
        }
      } catch (error) {
        console.warn('[Inline Translate] Stream tail parse error:', error);
      }
    }
  } catch (error) {
    if ((error as Error).name !== 'AbortError') {
      safePostMessage({ type: 'error', error: (error as Error).message || String(error) });
    }
  } finally {
    clearTimeout(timeoutId);
    port.onDisconnect.removeListener(onDisconnect);
    if (!doneSent) {
      safePostMessage({ type: 'done' });
    }
  }
}

async function handleInlineTranslateBatch(payload: InlineTranslateBatchPayload, port: chrome.runtime.Port): Promise<void> {
  const { streamFormat, endpoint, headers, requestBody } = await buildInlineTranslateBatchRequestConfig(payload);

  const controller = new AbortController();
  let timeoutId: number;

  let isDisconnected = false;
  const safePostMessage = (msg: any) => {
    if (!isDisconnected) {
      try {
        port.postMessage(msg);
      } catch (e) {
        console.warn('[Inline Translate Batch] Safe postMessage failed:', e);
      }
    }
  };

  const onDisconnect = () => {
    isDisconnected = true;
    if (timeoutId) clearTimeout(timeoutId);
    controller.abort();
  };
  port.onDisconnect.addListener(onDisconnect);

  timeoutId = setTimeout(() => {
    controller.abort();
    safePostMessage({ type: 'error', error: 'Request timeout (45s)' });
  }, 45000) as any; // Longer timeout for batch

  let doneSent = false;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    if (!response.ok) throw new Error(await readErrorMessage(response));

    const reader = response.body?.getReader();
    if (!reader) throw new Error('Unable to read streaming response');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') {
          doneSent = true;
          safePostMessage({ type: 'done' });
          return;
        }
        try {
          const parsed = JSON.parse(data);
          const result = streamFormat === 'openai'
            ? parseOpenAIStreamPayload(parsed)
            : parseAnthropicStreamPayload(parsed);
          if (result.delta) safePostMessage({ type: 'delta', data: result.delta });
          if (result.done) {
            doneSent = true;
            safePostMessage({ type: 'done' });
            return;
          }
        } catch { }
      }
    }
    // Handle remaining buffer same as above (omitted for brevity, assume stream ends cleanly usually)
    const remaining = buffer.trim();
    if (remaining.startsWith('data:')) {
      const data = remaining.slice(5).trim();
      if (data === '[DONE]') {
        doneSent = true;
        safePostMessage({ type: 'done' });
        return;
      }
      try {
        const parsed = JSON.parse(data);
        const result = streamFormat === 'openai'
          ? parseOpenAIStreamPayload(parsed)
          : parseAnthropicStreamPayload(parsed);
        if (result.delta) safePostMessage({ type: 'delta', data: result.delta });
        if (result.done) {
          doneSent = true;
          safePostMessage({ type: 'done' });
          return;
        }
      } catch { }
    }
  } catch (error) {
    if ((error as Error).name !== 'AbortError') {
      safePostMessage({ type: 'error', error: (error as Error).message || String(error) });
    }
  } finally {
    clearTimeout(timeoutId);
    port.onDisconnect.removeListener(onDisconnect);
    if (!doneSent) safePostMessage({ type: 'done' });
  }
}

async function handleTestConnection(payload: any, port: chrome.runtime.Port): Promise<void> {
  const { provider, apiKey, baseUrl, model, uiLang } = payload;
  const isChineseUI = uiLang === 'zh';

  if (!apiKey) {
    throw new Error(isChineseUI ? '请先在设置页面配置 API Key' : 'Please configure API Key in settings');
  }

  // Sanitize API key to remove any non-ASCII characters (e.g., invisible Unicode from copy-paste)
  const cleanApiKey = sanitizeForHeader(apiKey);

  const apiConfig = PROVIDER_CONFIGS[provider as Provider];
  const endpoint = provider === 'openai'
    ? normalizeOpenAIEndpoint(baseUrl)
    : `${baseUrl}${apiConfig.endpointPath}`;

  const authHeader = apiConfig.authHeader === 'Bearer'
    ? `Bearer ${cleanApiKey}`
    : cleanApiKey;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    [apiConfig.authHeader === 'Bearer' ? 'Authorization' : 'x-api-key']: authHeader,
    ...apiConfig.extraHeaders,
  };

  const streamFormat = getStreamFormat(provider as Provider);
  const testPrompt = "Ping";

  const requestBody = streamFormat === 'openai'
    ? {
      model: model,
      max_tokens: 5,
      messages: [{ role: 'user', content: testPrompt }],
      stream: false
    }
    : {
      model: model,
      max_tokens: 5,
      system: "Respond only with OK",
      messages: [{ role: 'user', content: testPrompt }],
      stream: false
    };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }

    port.postMessage({ type: 'success' });
  } catch (error) {
    port.postMessage({ type: 'error', error: (error as Error).message || String(error) });
  }
}

// OCR Context Menu Management
import { contextMenuService } from '../services/contextMenuService';

chrome.runtime.onInstalled.addListener(async () => {
  // Create context menus after loading settings
  const settings = await chrome.storage.local.get(['ocr_enabled']);
  if (settings.ocr_enabled !== false) {
    await contextMenuService.createMenus();
  }
});

// Listen for OCR settings changes
chrome.storage.onChanged.addListener(async (changes) => {
  if (changes.ocr_enabled) {
    if (changes.ocr_enabled.newValue) {
      await contextMenuService.createMenus();
    } else {
      contextMenuService.destroy();
    }
  }
});

// Handle messages for context menu control
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'create-context-menu') {
    contextMenuService.createMenus().then(() => sendResponse({ success: true })).catch(err => sendResponse({ error: err.message }));
    return true;
  } else if (message.action === 'clear-context-menu') {
    contextMenuService.destroy();
    sendResponse({ success: true });
  }
});
