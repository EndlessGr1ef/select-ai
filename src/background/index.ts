// Background service worker for handling AI requests

console.log('[AI Search] Background service worker loaded');

// Provider configurations
type Provider = 'openai' | 'anthropic' | 'minimax';

interface ProviderConfig {
  defaultBaseUrl: string;
  defaultModel: string;
  storageKey: string;
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
};

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'queryAI') {
    handleAIQuery(request.payload)
      .then(result => {
        sendResponse({ data: result });
      })
      .catch(error => {
        console.error('[AI Search] Query error:', error);
        sendResponse({ error: error.message || String(error) });
      });

    return true;
  }

  return false;
});

// Maximum context length sent to API (in characters)
const MAX_CONTEXT_FOR_API = 2000;

async function handleAIQuery(payload: {
  selection: string;
  context: string;
  pageUrl?: string;
  pageTitle?: string;
  targetLang?: 'zh' | 'en';
}): Promise<string> {
  const settings = await chrome.storage.local.get(['selectedProvider']);

  const provider = (settings.selectedProvider as Provider) || 'minimax';
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
  const targetLang = (providerSettings.targetLanguage as string) || '中文';

  if (!apiKey) {
    throw new Error(payload.targetLang === 'en' ? 'Please configure API Key in settings' : '请先在设置页面配置 API Key');
  }

  // Prepare context (truncate if needed)
  const contextForApi = payload.context.length > MAX_CONTEXT_FOR_API
    ? payload.context.substring(0, MAX_CONTEXT_FOR_API) + '...'
    : payload.context;

  // Use UI language to determine system prompt language
  const isChineseUI = payload.targetLang !== 'en';

  const systemPrompt = isChineseUI
    ? `你是一个极简解释助手。用户在浏览网页时选中了一段文字进行查询。
请结合提供的页面信息和上下文内容，对选中的文字进行精准、简练的解释和翻译。
目标语言: ${targetLang}
注意：输出的结果要先解释其本身的意思，再解释选中内容在上下文中的意思。`
    : `You are a concise explanation assistant. The user has selected text while browsing a webpage.
Based on the page information and context provided, give a precise and concise explanation or translation of the selected text.
Target language: ${targetLang}

Note: For output content please first explain ortranslate its base meaning, then explain its meaning in the context.`;

  const userPrompt = `<page>
  <url>${payload.pageUrl || 'unknown'}</url>
  <title>${payload.pageTitle || 'unknown'}</title>
</page>
<context>${contextForApi}</context>
<selection>${payload.selection}</selection>

请解释上述选中内容。`;

  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: model,
      max_tokens: 1024,
      temperature: 0.1,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt }
      ],
      stream: false
    })
  });


  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.error?.message || errorData.message || JSON.stringify(errorData);
    } catch {
      errorMessage = await response.text() || errorMessage;
    }
    throw new Error(errorMessage);
  }

  const data = await response.json();
  
  // Try multiple response formats
  
  // Format 1: Anthropic/MiniMax format with content array
  if (data.content && Array.isArray(data.content)) {
    // Look for text field first (standard Anthropic)
    for (const item of data.content) {
      if (item.text) {
        return item.text;
      }
    }
    // If no text, check for thinking field (MiniMax extended thinking)
    for (const item of data.content) {
      if (item.thinking) {
        // If only thinking is present, use it as the response
        return item.thinking;
      }
    }
    // Try to get any string content
    if (data.content[0] && typeof data.content[0] === 'string') {
      return data.content[0];
    }
  }
  
  // Format 2: OpenAI format
  if (data.choices && data.choices[0] && data.choices[0].message) {
    return data.choices[0].message.content;
  }
  
  // Format 3: Direct text response
  if (data.text) {
    return data.text;
  }
  
  // Format 4: Message format
  if (data.message && typeof data.message === 'string') {
    return data.message;
  }

  // Format 5: Result format
  if (data.result) {
    return typeof data.result === 'string' ? data.result : JSON.stringify(data.result);
  }
  
  // Format 6: Output format
  if (data.output) {
    return typeof data.output === 'string' ? data.output : JSON.stringify(data.output);
  }

  // Log and throw with actual response for debugging
  const isChineseError = payload.targetLang !== 'en';
  throw new Error(
    (isChineseError ? 'API 返回格式异常: ' : 'API response format error: ') +
    JSON.stringify(data).substring(0, 300)
  );
}
