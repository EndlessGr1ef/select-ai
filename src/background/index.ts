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
    defaultModel: 'claude-sonnet-4-20250514',
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
    authHeader: 'x-api-key',
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
const MAX_CONTEXT_FOR_API = 2000;

import { isBrowserChinese } from '../utils/language';

type QueryPayload = {
  selection: string;
  context: string;
  pageUrl?: string;
  pageTitle?: string;
  targetLang?: string;
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
  return provider === 'openai' || provider === 'deepseek' ? 'openai' : 'anthropic';
}

async function buildRequestConfig(payload: QueryPayload): Promise<RequestConfig> {
  const settings = await chrome.storage.local.get(['selectedProvider']);

  const provider = (settings.selectedProvider as Provider) || 'openai';
  const config = PROVIDER_CONFIGS[provider];
  const storageKey = config.storageKey;

  // Get provider-specific settings
  const allKeys = [
    `${storageKey}ApiKey`,
    `${storageKey}BaseUrl`,
    `${storageKey}Model`,
    'targetLanguage'
  ];
  const providerSettings = await chrome.storage.local.get(allKeys);

  const apiKey = providerSettings[`${storageKey}ApiKey`] as string | undefined;
  const baseUrl = (providerSettings[`${storageKey}BaseUrl`] as string) || config.defaultBaseUrl;
  const model = (providerSettings[`${storageKey}Model`] as string) || config.defaultModel;
  const targetLang = (providerSettings.targetLanguage as string)
    || payload.targetLang
    || (isBrowserChinese() ? '中文' : 'English');

  const isChineseUI = payload.uiLang ? payload.uiLang === 'zh' : payload.targetLang !== 'en';

  if (!apiKey) {
    throw new Error(isChineseUI ? '请先在设置页面配置 API Key' : 'Please configure API Key in settings');
  }

  // Prepare context (truncate if needed)
  const contextForApi = payload.context.length > MAX_CONTEXT_FOR_API
    ? payload.context.substring(0, MAX_CONTEXT_FOR_API) + '...'
    : payload.context;

  const isChineseTarget = targetLang.startsWith('中文') || targetLang.toLowerCase().startsWith('zh');

  const systemPrompt = isChineseTarget
    ? `你是一个极简解释助手。用户在浏览网页时选中了一段文字进行查询。请结合提供的页面信息和上下文内容，对选中的文字进行精准、简练的解释和翻译。

【必须遵守的规则】
1. 直接给出解释内容，不要重复或引用原文;
2. 保持回答简洁，不要冗长;
3. 必须严格按以下格式输出回复;
   基础含义:xxx
   上下文中的含义:xxx
4. 请以陈述句回答, 回答内容限制在1000tokens以内;
5. 用中文回答,按markdown格式美化输出`
    : `You are a concise explanation assistant. The user has selected text while browsing a webpage. Based on the page information and context provided, give a precise and concise explanation or translation of the selected text.

【Must follow rules】
1. Provide the explanation directly without repeating or quoting the original text;
2. Keep your response concise, avoid verbosity;
3. You MUST output in the following format only, nothing else:
   Base meaning: xxx;
   Contextual meaning: xxx;
4. Answer in a declarative sentence, the response content should be less than 1000 tokens;
5. Respond in ${targetLang}, beautify the output in markdown format`;

  const userPrompt = `<page>
<url>${payload.pageUrl || 'unknown'}</url>
<title>${payload.pageTitle || 'unknown'}</title>
</page>
<context>${contextForApi}</context>
<selection>${payload.selection}</selection>

${isChineseTarget ? '请解释上面选中的内容。' : 'Please explain the selected text above.'}`;

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
  const onDisconnect = () => controller.abort();
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
    port.onDisconnect.removeListener(onDisconnect);
    if (!doneSent) {
      port.postMessage({ type: 'done' });
    }
  }
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'ai-stream') return;

  port.onMessage.addListener((message) => {
    if (message?.action === 'queryAIStream') {
      handleAIStream(message.payload as QueryPayload, port).catch((error) => {
        port.postMessage({ type: 'error', error: error.message || String(error) });
      });
    }
  });
});
