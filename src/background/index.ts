// Background service worker for handling AI requests

console.log('[AI Search] Background service worker loaded');

// Provider configurations
type Provider = 'openai' | 'anthropic' | 'minimax' | 'deepseek' | 'glm';

interface ProviderConfig {
  defaultBaseUrl: string;
  defaultModel: string;
  storageKey: string;
}

interface ProviderApiConfig {
  endpointPath: string;  // API endpoint path
  authHeader: 'Bearer' | 'x-api-key';  // Authentication scheme
  extraHeaders: Record<string, string>;  // Additional headers
}

const PROVIDER_CONFIGS: Record<Provider, ProviderConfig> = {
  openai: {
    defaultBaseUrl: 'https://api.openai.com/v1/chat/completions',
    defaultModel: 'gpt-4o',
    storageKey: 'openai',
  },
  anthropic: {
    defaultBaseUrl: 'https://api.anthropic.com/v1/messages',
    defaultModel: 'claude-sonnet-4-5',
    storageKey: 'anthropic',
  },
  minimax: {
    defaultBaseUrl: 'https://api.minimaxi.com/anthropic',
    defaultModel: 'MiniMax-M2.1',
    storageKey: 'minimax',
  },
  deepseek: {
    defaultBaseUrl: 'https://api.deepseek.com',
    defaultModel: 'deepseek-chat',
    storageKey: 'deepseek',
  },
  glm: {
    defaultBaseUrl: 'https://open.bigmodel.cn/api/anthropic',
    defaultModel: 'glm-4.7',
    storageKey: 'glm',
  },
};

// API request configuration (adjusted per provider)
const API_CONFIGS: Record<Provider, ProviderApiConfig> = {
  openai: {
    endpointPath: '',  // Full path is already included in baseUrl
    authHeader: 'Bearer',
    extraHeaders: {},
  },
  anthropic: {
    endpointPath: '',
    authHeader: 'x-api-key',
    extraHeaders: { 'anthropic-version': '2023-06-01' },
  },
  minimax: {
    endpointPath: '/v1/messages',
    authHeader: 'Bearer',
    extraHeaders: { 'anthropic-version': '2023-06-01' },
  },
  deepseek: {
    endpointPath: '/v1/chat/completions',
    authHeader: 'Bearer',
    extraHeaders: {},
  },
  glm: {
    endpointPath: '',
    authHeader: 'Bearer',
    extraHeaders: {},
  },
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['selectedProvider'], (result) => {
    if (!result.selectedProvider) {
      chrome.storage.local.set({ selectedProvider: 'deepseek' });
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

// Maximum context length sent to API (in characters)
const DEFAULT_CONTEXT_MAX_TOKENS = 2000;
const MIN_CONTEXT_MAX_TOKENS = 200;
const MAX_CONTEXT_MAX_TOKENS = 10000;

// Optimization 1: Config cache - avoid reading storage on every request
let cachedProviderConfig: {
  provider: Provider;
  apiKey: string;
  baseUrl: string;
  model: string;
  targetLang: string;
  contextMaxTokens: number;
} | null = null;

const DEFAULT_TRANSLATION_CONCURRENCY = 10;
const MIN_TRANSLATION_CONCURRENCY = 1;
const MAX_TRANSLATION_CONCURRENCY = 20;
let cachedTranslationConcurrency: number | null = null;

function clampContextMaxTokens(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_CONTEXT_MAX_TOKENS;
  return Math.max(MIN_CONTEXT_MAX_TOKENS, Math.min(MAX_CONTEXT_MAX_TOKENS, value));
}

async function getCachedProviderConfig() {
  if (cachedProviderConfig) return cachedProviderConfig;

  const settings = await chrome.storage.local.get(['selectedProvider']);

  const provider = (settings.selectedProvider as Provider) || 'deepseek';
  const config = PROVIDER_CONFIGS[provider];
  const storageKey = config.storageKey;

  const allKeys = [
    `${storageKey}ApiKey`,
    `${storageKey}BaseUrl`,
    `${storageKey}Model`,
    'targetLanguage',
    'contextMaxTokens'
  ];
  const providerSettings = await chrome.storage.local.get(allKeys);

  const rawContextMaxTokens = providerSettings.contextMaxTokens as number | undefined;
  const contextMaxTokens = clampContextMaxTokens(Number(rawContextMaxTokens));

  cachedProviderConfig = {
    provider,
    apiKey: providerSettings[`${storageKey}ApiKey`] as string,
    baseUrl: (providerSettings[`${storageKey}BaseUrl`] as string) || config.defaultBaseUrl,
    model: (providerSettings[`${storageKey}Model`] as string) || config.defaultModel,
    targetLang: (providerSettings.targetLanguage as string) || (isBrowserChinese() ? '中文' : 'English'),
    contextMaxTokens
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
    'targetLanguage', 'contextMaxTokens'];

  for (const key of relevantKeys) {
    if (changes[key]) {
      cachedProviderConfig = null;
      break;
    }
  }

  if (changes.translationConcurrency) {
    cachedTranslationConcurrency = null;
  }
  if (changes.contextMaxTokens) {
    cachedProviderConfig = null;
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
  const contextMaxTokens = cachedConfig.contextMaxTokens || DEFAULT_CONTEXT_MAX_TOKENS;

  const isChineseUI = payload.uiLang ? payload.uiLang === 'zh' : payload.targetLang !== 'en';

  if (!apiKey) {
    throw new Error(isChineseUI ? '请先在设置页面配置 API Key' : 'Please configure API Key in settings');
  }

  // Prepare context (truncate if needed)
  const contextForApi = payload.context.length > contextMaxTokens
    ? payload.context.substring(0, contextMaxTokens) + '...'
    : payload.context;

  const isChineseTarget = targetLang.startsWith('中文') || targetLang.toLowerCase().startsWith('zh');

  const systemPrompt = isChineseTarget
    ? `你是一个浏览器划词解释助手。请根据用户选中的内容，结合上下文,对选中的文字进行精准、简练的解释和翻译。

【必须遵守的规则】
1. 直接给出解释内容，不要重复或引用原文;
2. 保持回答内容精炼,不要冗长啰嗦;
3. 必须严格按以下格式输出回答内容;
   基础含义:xxx
   上下文中的含义:xxx
4. 请以陈述句回答, 回答内容尽量限制在1000字符以内;
5. 用中文回答,按markdown格式美化输出;
6. 禁止使用代码块、内联代码或HTML标签(例如: \`\`\`、\`code\`、<tag>)`
    : 
    `You are a browser selection explanation assistant. Please explain the selected text based on the context, give a precise and concise explanation.

【Must follow rules】
1. Provide the explanation directly without repeating or quoting the original text;
2. Keep your response content concise, avoid verbosity;
3. You MUST output in the following format only, nothing else:
   Base meaning: xxx;
   Contextual meaning: xxx;
4. Answer in a declarative sentence, the response content should be less than 1000 characters;
5. Respond in ${targetLang}, beautify the output in markdown format;
6. Do not use code blocks, inline code, or HTML tags (e.g., \`\`\` or \`code\` or <tag>)`;

  const userPrompt = `
<url>${payload.pageUrl || 'unknown'}</url>
<title>${payload.pageTitle || 'unknown'}</title>
<context>${contextForApi}</context>
<selection>${payload.selection}</selection>`;

  const apiConfig = API_CONFIGS[provider];
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

  const apiConfig = API_CONFIGS[provider];
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

// Optimization 2: API timeout control
const REQUEST_TIMEOUT = 30000; // 30 seconds

async function handleAIStream(payload: QueryPayload, port: chrome.runtime.Port): Promise<void> {
  const { streamFormat, endpoint, headers, requestBody, isChineseUI } = await buildRequestConfig(payload);

  const controller = new AbortController();

  // Timeout control
  const timeoutId = setTimeout(() => {
    controller.abort();
    port.postMessage({ type: 'error', error: isChineseUI ? '请求超时（30秒）' : 'Request timeout (30s)' });
  }, REQUEST_TIMEOUT);

  // Cleanup when port disconnects
  const onDisconnect = () => {
    clearTimeout(timeoutId);
    controller.abort();
  };
  port.onDisconnect.addListener(onDisconnect);

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
          port.postMessage({ type: 'done' });
          return;
        }

        try {
          const parsed = JSON.parse(data);
          const result = streamFormat === 'openai'
            ? parseOpenAIStreamPayload(parsed)
            : parseAnthropicStreamPayload(parsed);
          if (result.delta) {
            port.postMessage({ type: 'delta', data: result.delta });
          }
          if (result.done) {
            doneSent = true;
            port.postMessage({ type: 'done' });
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
        port.postMessage({ type: 'done' });
        return;
      }
      try {
        const parsed = JSON.parse(data);
        const result = streamFormat === 'openai'
          ? parseOpenAIStreamPayload(parsed)
          : parseAnthropicStreamPayload(parsed);
        if (result.delta) {
          port.postMessage({ type: 'delta', data: result.delta });
        }
        if (result.done) {
          doneSent = true;
          port.postMessage({ type: 'done' });
          return;
        }
      } catch (error) {
        console.warn('[AI Search] Stream tail parse error:', error);
      }
    }
  } catch (error) {
    if ((error as Error).name !== 'AbortError') {
      port.postMessage({ type: 'error', error: (error as Error).message || String(error) });
    }
  } finally {
    clearTimeout(timeoutId);
    port.onDisconnect.removeListener(onDisconnect);
    if (!doneSent) {
      port.postMessage({ type: 'done' });
    }
  }
}

async function handleKanaStream(payload: KanaPayload, port: chrome.runtime.Port): Promise<void> {
  const { streamFormat, endpoint, headers, requestBody, isChineseUI } = await buildKanaRequestConfig(payload);

  const controller = new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort();
    port.postMessage({ type: 'error', error: isChineseUI ? '请求超时（30秒）' : 'Request timeout (30s)' });
  }, REQUEST_TIMEOUT);

  const onDisconnect = () => {
    clearTimeout(timeoutId);
    controller.abort();
  };
  port.onDisconnect.addListener(onDisconnect);

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
          port.postMessage({ type: 'done' });
          return;
        }

        try {
          const parsed = JSON.parse(data);
          const result = streamFormat === 'openai'
            ? parseOpenAIStreamPayload(parsed)
            : parseAnthropicStreamPayload(parsed);
          if (result.delta) {
            port.postMessage({ type: 'delta', data: result.delta });
          }
          if (result.done) {
            doneSent = true;
            port.postMessage({ type: 'done' });
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
        port.postMessage({ type: 'done' });
        return;
      }
      try {
        const parsed = JSON.parse(data);
        const result = streamFormat === 'openai'
          ? parseOpenAIStreamPayload(parsed)
          : parseAnthropicStreamPayload(parsed);
        if (result.delta) {
          port.postMessage({ type: 'delta', data: result.delta });
        }
        if (result.done) {
          doneSent = true;
          port.postMessage({ type: 'done' });
          return;
        }
      } catch (error) {
        console.warn('[AI Search] Kana stream tail parse error:', error);
      }
    }
  } catch (error) {
    if ((error as Error).name !== 'AbortError') {
      port.postMessage({ type: 'error', error: (error as Error).message || String(error) });
    }
  } finally {
    clearTimeout(timeoutId);
    port.onDisconnect.removeListener(onDisconnect);
    if (!doneSent) {
      port.postMessage({ type: 'done' });
    }
  }
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'ai-stream' && port.name !== 'ai-translate-stream' && port.name !== 'ai-kana-stream') return;

  port.onMessage.addListener((message) => {
    if (message?.action === 'queryAIStream') {
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
  const parsed = Number(rawValue);
  const value = Number.isFinite(parsed) ? parsed : DEFAULT_TRANSLATION_CONCURRENCY;
  const clamped = Math.max(MIN_TRANSLATION_CONCURRENCY, Math.min(MAX_TRANSLATION_CONCURRENCY, value));
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

  const apiConfig = API_CONFIGS[provider];
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

  const apiConfig = API_CONFIGS[provider];
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

  // Timeout control
  const timeoutId = setTimeout(() => {
    controller.abort();
    port.postMessage({ type: 'error', error: 'Request timeout (30s)' });
  }, REQUEST_TIMEOUT);

  // Cleanup when port disconnects
  const onDisconnect = () => {
    clearTimeout(timeoutId);
    controller.abort();
  };
  port.onDisconnect.addListener(onDisconnect);

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
          port.postMessage({ type: 'done' });
          return;
        }

        try {
          const parsed = JSON.parse(data);
          const result = streamFormat === 'openai'
            ? parseOpenAIStreamPayload(parsed)
            : parseAnthropicStreamPayload(parsed);
          if (result.delta) {
            port.postMessage({ type: 'delta', data: result.delta });
          }
          if (result.done) {
            doneSent = true;
            port.postMessage({ type: 'done' });
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
        port.postMessage({ type: 'done' });
        return;
      }
      try {
        const parsed = JSON.parse(data);
        const result = streamFormat === 'openai'
          ? parseOpenAIStreamPayload(parsed)
          : parseAnthropicStreamPayload(parsed);
        if (result.delta) {
          port.postMessage({ type: 'delta', data: result.delta });
        }
        if (result.done) {
          doneSent = true;
          port.postMessage({ type: 'done' });
          return;
        }
      } catch (error) {
        console.warn('[Inline Translate] Stream tail parse error:', error);
      }
    }
  } catch (error) {
    if ((error as Error).name !== 'AbortError') {
      port.postMessage({ type: 'error', error: (error as Error).message || String(error) });
    }
  } finally {
    clearTimeout(timeoutId);
    port.onDisconnect.removeListener(onDisconnect);
    if (!doneSent) {
      port.postMessage({ type: 'done' });
    }
  }
}

async function handleInlineTranslateBatch(payload: InlineTranslateBatchPayload, port: chrome.runtime.Port): Promise<void> {
  const { streamFormat, endpoint, headers, requestBody } = await buildInlineTranslateBatchRequestConfig(payload);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
    port.postMessage({ type: 'error', error: 'Request timeout (45s)' });
  }, 45000); // Longer timeout for batch

  const onDisconnect = () => {
    clearTimeout(timeoutId);
    controller.abort();
  };
  port.onDisconnect.addListener(onDisconnect);

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
          port.postMessage({ type: 'done' });
          return;
        }
        try {
          const parsed = JSON.parse(data);
          const result = streamFormat === 'openai'
            ? parseOpenAIStreamPayload(parsed)
            : parseAnthropicStreamPayload(parsed);
          if (result.delta) port.postMessage({ type: 'delta', data: result.delta });
          if (result.done) {
            doneSent = true;
            port.postMessage({ type: 'done' });
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
        port.postMessage({ type: 'done' });
        return;
      }
      try {
        const parsed = JSON.parse(data);
        const result = streamFormat === 'openai'
          ? parseOpenAIStreamPayload(parsed)
          : parseAnthropicStreamPayload(parsed);
        if (result.delta) port.postMessage({ type: 'delta', data: result.delta });
        if (result.done) {
          doneSent = true;
          port.postMessage({ type: 'done' });
          return;
        }
      } catch { }
    }
  } catch (error) {
    if ((error as Error).name !== 'AbortError') {
      port.postMessage({ type: 'error', error: (error as Error).message || String(error) });
    }
  } finally {
    clearTimeout(timeoutId);
    port.onDisconnect.removeListener(onDisconnect);
    if (!doneSent) port.postMessage({ type: 'done' });
  }
}
