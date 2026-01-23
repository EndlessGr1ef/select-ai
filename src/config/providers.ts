// Provider type definition
export type Provider = 'openai' | 'anthropic' | 'minimax' | 'deepseek' | 'glm';

// Provider configuration interface
export interface ProviderConfig {
  name: { zh: string; en: string };
  defaultBaseUrl: string;
  defaultModel: string;
  storageKey: string;
  endpointPath: string;
  authHeader: 'Bearer' | 'x-api-key';
  extraHeaders: Record<string, string>;
  modelOptions: string[];
}

// Unified provider configurations
export const PROVIDER_CONFIGS: Record<Provider, ProviderConfig> = {
  openai: {
    name: { zh: 'OpenAI', en: 'OpenAI' },
    defaultBaseUrl: 'https://api.openai.com/v1/chat/completions',
    defaultModel: 'gpt-4o',
    storageKey: 'openai',
    endpointPath: '',
    authHeader: 'Bearer',
    extraHeaders: {},
    modelOptions: ['gpt-4o', 'gpt-4-turbo', 'gpt-4'],
  },
  anthropic: {
    name: { zh: 'Anthropic', en: 'Anthropic' },
    defaultBaseUrl: 'https://api.anthropic.com/v1/messages',
    defaultModel: 'claude-sonnet-4-5',
    storageKey: 'anthropic',
    endpointPath: '',
    authHeader: 'x-api-key',
    extraHeaders: { 'anthropic-version': '2023-06-01' },
    modelOptions: ['claude-sonnet-4-5', 'claude-haiku-4-5', 'claude-opus-4-5'],
  },
  minimax: {
    name: { zh: 'MiniMax', en: 'MiniMax' },
    defaultBaseUrl: 'https://api.minimaxi.com/anthropic',
    defaultModel: 'MiniMax-M2.1',
    storageKey: 'minimax',
    endpointPath: '/v1/messages',
    authHeader: 'Bearer',
    extraHeaders: { 'anthropic-version': '2023-06-01' },
    modelOptions: ['MiniMax-M2.1'],
  },
  deepseek: {
    name: { zh: 'DeepSeek', en: 'DeepSeek' },
    defaultBaseUrl: 'https://api.deepseek.com',
    defaultModel: 'deepseek-chat',
    storageKey: 'deepseek',
    endpointPath: '/v1/chat/completions',
    authHeader: 'Bearer',
    extraHeaders: {},
    modelOptions: ['deepseek-chat', 'deepseek-reasoner'],
  },
  glm: {
    name: { zh: '智谱 AI', en: 'Zhipu AI' },
    defaultBaseUrl: 'https://open.bigmodel.cn/api/anthropic',
    defaultModel: 'glm-4.7',
    storageKey: 'glm',
    endpointPath: '',
    authHeader: 'Bearer',
    extraHeaders: {},
    modelOptions: ['glm-4.7'],
  },
};

// Default provider
export const DEFAULT_PROVIDER: Provider = 'deepseek';
