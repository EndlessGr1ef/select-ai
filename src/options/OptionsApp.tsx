import React, { useState, useEffect } from 'react';
import { getUILanguage, isBrowserChinese } from '../utils/language';
import { translations } from '../utils/i18n';
import {
  Settings,
  Key,
  Bot,
  Globe,
  Save,
  Eye,
  EyeOff,
  AlertCircle,
  Globe2,
  CheckCircle2
} from 'lucide-react';
import { icons } from '../resource';

type Provider = 'openai' | 'anthropic' | 'minimax' | 'deepseek' | 'glm';

interface ProviderConfig {
  name: Record<'zh' | 'en', string>;
  defaultBaseUrl: string;
  defaultModel: string;
  storageKey: string;
}

const PROVIDER_CONFIGS: Record<Provider, ProviderConfig> = {
  openai: {
    name: { zh: 'OpenAI', en: 'OpenAI' },
    defaultBaseUrl: 'https://api.openai.com/v1/chat/completions',
    defaultModel: 'gpt-4o',
    storageKey: 'openai',
  },
  anthropic: {
    name: { zh: 'Anthropic', en: 'Anthropic' },
    defaultBaseUrl: 'https://api.anthropic.com/v1/messages',
    defaultModel: 'claude-sonnet-4-5',
    storageKey: 'anthropic',
  },
  minimax: {
    name: { zh: 'MiniMax', en: 'MiniMax' },
    defaultBaseUrl: 'https://api.minimaxi.com/anthropic',
    defaultModel: 'MiniMax-M2.1',
    storageKey: 'minimax',
  },
  deepseek: {
    name: { zh: 'DeepSeek', en: 'DeepSeek' },
    defaultBaseUrl: 'https://api.deepseek.com',
    defaultModel: 'deepseek-chat',
    storageKey: 'deepseek',
  },
  glm: {
    name: { zh: '智谱 AI', en: 'Zhipu AI' },
    defaultBaseUrl: 'https://open.bigmodel.cn/api/anthropic',
    defaultModel: 'glm-4.7',
    storageKey: 'glm',
  },
};

const PROVIDER_MODEL_OPTIONS: Record<Provider, string[]> = {
  openai: [
    'gpt-4o',
    'gpt-4-turbo',
    'gpt-4',
  ],
  anthropic: [
    'claude-sonnet-4-5',
    'claude-haiku-4-5',
    'claude-opus-4-5',
  ],
  deepseek: [
    'deepseek-chat',
    'deepseek-reasoner',
  ],
  minimax: [
    'MiniMax-M2.1',
  ],
  glm: [
    'glm-4.7',
  ],
};

function getDefaultTargetLanguage(): string {
  return isBrowserChinese() ? '中文' : 'English';
}

type TabType = 'api' | 'translation';

const OptionsApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('api');
  const [provider, setProvider] = useState<Provider>('deepseek');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState(PROVIDER_CONFIGS.deepseek.defaultBaseUrl);
  const [model, setModel] = useState(PROVIDER_CONFIGS.deepseek.defaultModel);
  const [targetLang, setTargetLang] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'idle', message: string }>({ type: 'idle', message: '' });
  const [lang, setLang] = useState<'zh' | 'en'>('zh');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showModelOptions, setShowModelOptions] = useState(false);
  const [concurrency, setConcurrency] = useState(10);
  const [blacklistEnabled, setBlacklistEnabled] = useState(true);
  const [translationButtonEnabled, setTranslationButtonEnabled] = useState(true);
  const [kanaRubyEnabled, setKanaRubyEnabled] = useState(true);
  const [contextMaxTokens, setContextMaxTokens] = useState(1000);

  useEffect(() => {
    setLang(getUILanguage());
    chrome.storage.local.get(['selectedProvider', 'targetLanguage', 'translationConcurrency', 'translationBlacklistEnabled', 'translationButtonEnabled', 'kanaRubyEnabled', 'contextMaxTokens'], (result) => {
      if (result.selectedProvider) {
        setProvider(result.selectedProvider as Provider);
      }
      setTargetLang((result.targetLanguage as string) || getDefaultTargetLanguage());
      setConcurrency((result.translationConcurrency as number) || 10);
      setBlacklistEnabled(result.translationBlacklistEnabled !== false);
      setTranslationButtonEnabled(result.translationButtonEnabled !== false);
      setKanaRubyEnabled(result.kanaRubyEnabled !== false);
      setContextMaxTokens((result.contextMaxTokens as number) || 1000);

      setIsLoading(false);
    });
  }, []);

  useEffect(() => {
    const providerStorageKey = PROVIDER_CONFIGS[provider].storageKey;
    chrome.storage.local.get([
      `${providerStorageKey}ApiKey`,
      `${providerStorageKey}BaseUrl`,
      `${providerStorageKey}Model`
    ], (result) => {
      setApiKey((result[`${providerStorageKey}ApiKey`] as string) || '');
      setBaseUrl((result[`${providerStorageKey}BaseUrl`] as string) || PROVIDER_CONFIGS[provider].defaultBaseUrl);
      setModel((result[`${providerStorageKey}Model`] as string) || PROVIDER_CONFIGS[provider].defaultModel);
    });
  }, [provider]);

  const t = translations.options as typeof translations.options;
  const modelOptions = PROVIDER_MODEL_OPTIONS[provider] || [];

  const handleSave = () => {
    const providerStorageKey = PROVIDER_CONFIGS[provider].storageKey;
    chrome.storage.local.set({
      selectedProvider: provider,
      [`${providerStorageKey}ApiKey`]: apiKey,
      [`${providerStorageKey}BaseUrl`]: baseUrl,
      [`${providerStorageKey}Model`]: model,
      targetLanguage: targetLang,
      translationConcurrency: concurrency,
      translationBlacklistEnabled: blacklistEnabled,
      translationButtonEnabled,
      kanaRubyEnabled,
      contextMaxTokens
    }, () => {
      setStatus({ type: 'success', message: t.saveSuccess[lang] });
      setTimeout(() => setStatus({ type: 'idle', message: '' }), 3000);
    });
  };

  const containerStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #f1f5f9 0%, #e2e8f0 100%)',
    padding: '48px 24px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  };

  const cardStyle: React.CSSProperties = {
    maxWidth: 600,
    margin: '0 auto',
    backgroundColor: '#fff',
    borderRadius: 20,
    boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
    overflow: 'hidden',
  };

  const headerStyle: React.CSSProperties = {
    background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
    padding: '32px 32px 28px',
    color: '#fff',
  };

  const logoStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 18,
    marginBottom: 12,
  };

  const iconStyle: React.CSSProperties = {
    width: 56,
    height: 56,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: 26,
    fontWeight: 700,
    margin: 0,
    letterSpacing: '-0.5px',
  };

  const subtitleStyle: React.CSSProperties = {
    fontSize: 14,
    opacity: 0.85,
    marginTop: 2,
  };

  const tabContainerStyle: React.CSSProperties = {
    display: 'flex',
    gap: 6,
    marginTop: 24,
  };

  const getTabStyle = (isActive: boolean): React.CSSProperties => ({
    padding: '10px 18px',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    border: 'none',
    backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : 'transparent',
    color: '#fff',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  });

  const formStyle: React.CSSProperties = {
    padding: '32px 32px 28px',
  };

  const sectionStyle: React.CSSProperties = {
    marginBottom: 32,
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: '#64748b',
    textTransform: 'uppercase' as const,
    letterSpacing: '1.2px',
    marginBottom: 18,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 14,
    fontWeight: 500,
    color: '#374151',
    marginBottom: 8,
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '14px 16px',
    fontSize: 14,
    border: '1.5px solid #e2e8f0',
    borderRadius: 12,
    outline: 'none',
    transition: 'all 0.2s',
    backgroundColor: '#f8fafc',
    boxSizing: 'border-box' as const,
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    cursor: 'pointer',
    appearance: 'none' as const,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 14px center',
    backgroundSize: 18,
    paddingRight: 48,
  };

  const modelInputWrapperStyle: React.CSSProperties = {
    position: 'relative',
  };

  const modelOptionsStyle: React.CSSProperties = {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 6,
    backgroundColor: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 12,
    boxShadow: '0 12px 24px rgba(0,0,0,0.1)',
    maxHeight: 200,
    overflowY: 'auto',
    zIndex: 20,
  };

  const modelOptionItemStyle: React.CSSProperties = {
    padding: '12px 16px',
    fontSize: 14,
    cursor: 'pointer',
  };

  const hintStyle: React.CSSProperties = {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 6,
  };

  const rowStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 16,
  };

  const buttonStyle: React.CSSProperties = {
    width: '100%',
    padding: '16px 24px',
    fontSize: 15,
    fontWeight: 600,
    color: '#fff',
    background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
    border: 'none',
    borderRadius: 12,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  };

  const statusStyle: React.CSSProperties = {
    textAlign: 'center' as const,
    padding: '14px 18px',
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 500,
    marginTop: 20,
    backgroundColor: status.type === 'success' ? '#ecfdf5' : status.type === 'error' ? '#fef2f2' : 'transparent',
    color: status.type === 'success' ? '#059669' : status.type === 'error' ? '#dc2626' : 'transparent',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  };

  const infoCardStyle: React.CSSProperties = {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: '22px',
    marginTop: 28,
    border: '1px solid #e2e8f0',
  };

  const infoTitleStyle: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 600,
    color: '#334155',
    marginBottom: 14,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  };

  const infoListStyle: React.CSSProperties = {
    margin: 0,
    paddingLeft: 20,
    fontSize: 13,
    color: '#475569',
    lineHeight: 1.85,
  };

  const loadingOverlayStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 400,
    color: '#64748b',
  };

  const spinnerStyle: React.CSSProperties = {
    width: 36,
    height: 36,
    border: '3px solid #e2e8f0',
    borderTop: '3px solid #8b5cf6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  };

  const inputWrapperStyle: React.CSSProperties = {
    position: 'relative' as const,
  };

  const eyeButtonStyle: React.CSSProperties = {
    position: 'absolute' as const,
    right: 14,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 6,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#94a3b8',
    transition: 'color 0.2s',
    borderRadius: 6,
  };

  if (isLoading) {
    return (
      <div style={containerStyle}>
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
        <div style={cardStyle}>
          <div style={loadingOverlayStyle}>
            <div style={spinnerStyle} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div style={cardStyle}>
        <div style={headerStyle}>
          <div style={logoStyle}>
            <div style={iconStyle}>
              <img
                src={icons.main}
                alt="Select AI"
                style={{
                  width: 56,
                  height: 56,
                  objectFit: 'contain'
                }}
              />
            </div>
            <div>
              <h1 style={titleStyle}>{t.title[lang]}</h1>
              <p style={subtitleStyle}>{t.subtitle[lang]}</p>
            </div>
          </div>
          <div style={tabContainerStyle}>
            <button
              style={getTabStyle(activeTab === 'api')}
              onClick={() => setActiveTab('api')}
            >
              <Settings size={16} strokeWidth={2} />
              {t.tabApiConfig[lang]}
            </button>
            <button
              style={getTabStyle(activeTab === 'translation')}
              onClick={() => setActiveTab('translation')}
            >
              <Globe2 size={16} strokeWidth={2} />
              {t.tabTranslationSettings[lang]}
            </button>
          </div>
        </div>

        <div style={formStyle}>
          {activeTab === 'api' && (
            <React.Fragment>
              <div style={sectionStyle}>
                <div style={sectionTitleStyle}>
                  <Key size={14} strokeWidth={2} />
                  {t.apiSection[lang]}
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={labelStyle}>{t.providerLabel[lang]}</label>
                  <select
                    value={provider}
                    onChange={(e) => {
                      const newProvider = e.target.value as Provider;
                      setProvider(newProvider);
                    }}
                    style={selectStyle}
                  >
                    <option value="openai">{t.openaiName[lang]}</option>
                    <option value="anthropic">{t.anthropicName[lang]}</option>
                    <option value="minimax">{t.minimaxName[lang]}</option>
                    <option value="deepseek">{t.deepseekName[lang]}</option>
                    <option value="glm">{t.glmName[lang]}</option>
                  </select>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={labelStyle}>{t.apiKeyLabel[lang]}</label>
                  <div style={inputWrapperStyle}>
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={t.apiKeyPlaceholder[lang]}
                      style={{
                        ...inputStyle,
                        paddingRight: 48,
                      }}
                    />
                    <button
                      type="button"
                      style={eyeButtonStyle}
                      onClick={() => setShowApiKey(!showApiKey)}
                    >
                      {showApiKey ? (
                        <EyeOff size={18} strokeWidth={2} />
                      ) : (
                        <Eye size={18} strokeWidth={2} />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>{t.baseUrlLabel[lang]}</label>
                  <input
                    type="text"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    style={inputStyle}
                  />
                  <p style={hintStyle}>
                    {t.baseUrlHint[lang]}: {PROVIDER_CONFIGS[provider].defaultBaseUrl}
                  </p>
                </div>
              </div>

              <div style={sectionStyle}>
                <div style={sectionTitleStyle}>
                  <Bot size={14} strokeWidth={2} />
                  {t.modelSection[lang]}
                </div>

                <div style={rowStyle}>
                  <div>
                    <label style={labelStyle}>{t.modelLabel[lang]}</label>
                    <div style={modelInputWrapperStyle}>
                      <input
                        type="text"
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        style={inputStyle}
                      />
                      {showModelOptions && modelOptions.length > 0 && (
                        <div style={modelOptionsStyle}>
                          {modelOptions.map((modelOption) => (
                            <div
                              key={modelOption}
                              style={modelOptionItemStyle}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setModel(modelOption);
                                setShowModelOptions(false);
                              }}
                            >
                              {modelOption}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <p style={hintStyle}>{t.modelCustomHint[lang]}</p>
                  </div>

                  <div>
                    <label style={labelStyle}>{t.targetLangLabel[lang]}</label>
                    <select
                      value={targetLang}
                      onChange={(e) => setTargetLang(e.target.value)}
                      style={selectStyle}
                    >
                      <option value="中文">🇨🇳 中文</option>
                      <option value="English">🇺🇸 English</option>
                      <option value="日本語">🇯🇵 日本語</option>
                      <option value="한국어">🇰🇷 한국어</option>
                    </select>
                  </div>
                </div>

                <div style={{ marginTop: 20 }}>
                  <label style={labelStyle}>{t.contextMaxTokensLabel[lang]}</label>
                  <input
                    type="number"
                    min={200}
                    max={6000}
                    value={contextMaxTokens}
                    onChange={(e) => setContextMaxTokens(Math.max(200, Math.min(6000, parseInt(e.target.value) || 200)))}
                    style={inputStyle}
                  />
                  <p style={hintStyle}>{t.contextMaxTokensHint[lang]}</p>
                </div>
              </div>
            </React.Fragment>
          )}

          {activeTab === 'translation' && (
            <div style={sectionStyle}>
              <div style={sectionTitleStyle}>
                <Globe size={14} strokeWidth={2} />
                {t.translationSettingsTitle[lang]}
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input
                    type="checkbox"
                    checked={translationButtonEnabled}
                    onChange={(e) => setTranslationButtonEnabled(e.target.checked)}
                    style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#8b5cf6' }}
                  />
                  {t.translationButtonToggleLabel[lang]}
                </label>
                <p style={{ ...hintStyle, marginLeft: 30 }}>{t.translationButtonToggleHint[lang]}</p>
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input
                    type="checkbox"
                    checked={kanaRubyEnabled}
                    onChange={(e) => setKanaRubyEnabled(e.target.checked)}
                    style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#8b5cf6' }}
                  />
                  {t.kanaRubyToggleLabel[lang]}
                </label>
                <p style={{ ...hintStyle, marginLeft: 30 }}>{t.kanaRubyToggleHint[lang]}</p>
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={labelStyle}>{t.concurrencyLabel[lang]}</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={concurrency}
                  onChange={(e) => setConcurrency(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                  style={inputStyle}
                />
                <p style={hintStyle}>{t.concurrencyHint[lang]}</p>
              </div>

              <div>
                <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input
                    type="checkbox"
                    checked={blacklistEnabled}
                    onChange={(e) => setBlacklistEnabled(e.target.checked)}
                    style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#8b5cf6' }}
                  />
                  {t.blacklistToggleLabel[lang]}
                </label>
                <p style={{ ...hintStyle, marginLeft: 30 }}>{t.blacklistToggleHint[lang]}</p>
              </div>
            </div>
          )}

          <button
            style={buttonStyle}
            onClick={handleSave}
          >
            <Save size={18} strokeWidth={2} />
            {t.saveBtn[lang]}
          </button>

          {status.type !== 'idle' && (
            <div style={statusStyle}>
              {status.type === 'success' ? (
                <CheckCircle2 size={18} strokeWidth={2} />
              ) : (
                <AlertCircle size={18} strokeWidth={2} />
              )}
              {status.message}
            </div>
          )}

          <div style={infoCardStyle}>
            <div style={infoTitleStyle}>
              {t.guideTitle[lang]}
            </div>
            <ul style={infoListStyle}>
              {activeTab === 'api' ? (
                (t.guideSteps as Record<string, string[]>)[lang].map((step, i) => (
                  <li key={i}>{step}</li>
                ))
              ) : (
                (t.translationGuideSteps as Record<string, string[]>)[lang].map((step, i) => (
                  <li key={i}>{step}</li>
                ))
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OptionsApp;
