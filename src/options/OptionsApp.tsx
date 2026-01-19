import React, { useState, useEffect, useRef } from 'react';
import { getUILanguage, isBrowserChinese } from '../utils/language';
import { translations } from '../utils/i18n';

// Provider configurations
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

// Get default output language from browser locale
function getDefaultTargetLanguage(): string {
  return isBrowserChinese() ? '中文' : 'English';
}

type TabType = 'api' | 'translation';

const OptionsApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('api');
  const [provider, setProvider] = useState<Provider>('openai');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState(PROVIDER_CONFIGS.openai.defaultBaseUrl);
  const [model, setModel] = useState(PROVIDER_CONFIGS.openai.defaultModel);
  const [targetLang, setTargetLang] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'idle', message: string }>({ type: 'idle', message: '' });
  const [lang, setLang] = useState<'zh' | 'en'>('zh');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showModelOptions, setShowModelOptions] = useState(false);
  const modelBlurTimeoutRef = useRef<number | null>(null);
  // Translation settings
  const [concurrency, setConcurrency] = useState(10);
  const [blacklistEnabled, setBlacklistEnabled] = useState(true);
  const [translationButtonEnabled, setTranslationButtonEnabled] = useState(true);

  // Initialize: load language and selected provider
  useEffect(() => {
    setLang(getUILanguage());
    chrome.storage.local.get(['selectedProvider', 'targetLanguage', 'translationConcurrency', 'translationBlacklistEnabled', 'translationButtonEnabled'], (result) => {
      if (result.selectedProvider) {
        setProvider(result.selectedProvider as Provider);
      }
      setTargetLang((result.targetLanguage as string) || getDefaultTargetLanguage());
      setConcurrency((result.translationConcurrency as number) || 10);
      setBlacklistEnabled(result.translationBlacklistEnabled !== false);
      setTranslationButtonEnabled(result.translationButtonEnabled !== false);

      setIsLoading(false);
    });
  }, []);

  // Load saved config when provider changes
  useEffect(() => {
    const providerStorageKey = PROVIDER_CONFIGS[provider].storageKey;
    chrome.storage.local.get([
      `${providerStorageKey}ApiKey`,
      `${providerStorageKey}BaseUrl`,
      `${providerStorageKey}Model`
    ], (result) => {
      // Load saved provider's config
      setApiKey((result[`${providerStorageKey}ApiKey`] as string) || '');
      setBaseUrl((result[`${providerStorageKey}BaseUrl`] as string) || PROVIDER_CONFIGS[provider].defaultBaseUrl);
      setModel((result[`${providerStorageKey}Model`] as string) || PROVIDER_CONFIGS[provider].defaultModel);
    });
  }, [provider]);

  const t = translations.options;
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
      translationButtonEnabled
    }, () => {
      setStatus({ type: 'success', message: t.saveSuccess[lang] });
      setTimeout(() => setStatus({ type: 'idle', message: '' }), 3000);
    });
  };

  // Styles
  const containerStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '40px 20px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  };

  const cardStyle: React.CSSProperties = {
    maxWidth: 560,
    margin: '0 auto',
    backgroundColor: '#fff',
    borderRadius: 24,
    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
    overflow: 'hidden',
  };

  const headerStyle: React.CSSProperties = {
    background: 'linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%)',
    padding: '32px 32px 28px',
    color: '#fff',
  };

  const logoStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    marginBottom: 8,
  };

  const iconStyle: React.CSSProperties = {
    width: 56,
    height: 56,
    background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
    borderRadius: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 24,
    boxShadow: '0 8px 16px rgba(236,72,153,0.3)',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: 28,
    fontWeight: 700,
    margin: 0,
  };

  const subtitleStyle: React.CSSProperties = {
    fontSize: 14,
    opacity: 0.8,
    marginTop: 4,
  };

  const tabContainerStyle: React.CSSProperties = {
    display: 'flex',
    gap: 8,
    marginTop: 20,
  };

  const getTabStyle = (isActive: boolean): React.CSSProperties => ({
    padding: '10px 20px',
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
    padding: 32,
  };

  const sectionStyle: React.CSSProperties = {
    marginBottom: 28,
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 600,
    color: '#6b7280',
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    marginBottom: 16,
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
    fontSize: 15,
    border: '2px solid #e5e7eb',
    borderRadius: 12,
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    backgroundColor: '#f9fafb',
    boxSizing: 'border-box' as const,
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    cursor: 'pointer',
    appearance: 'none' as const,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 12px center',
    backgroundSize: 20,
    paddingRight: 44,
  };

  const modelInputWrapperStyle: React.CSSProperties = {
    position: 'relative',
  };

  const modelOptionsStyle: React.CSSProperties = {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 8,
    backgroundColor: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    boxShadow: '0 12px 24px rgba(0,0,0,0.12)',
    maxHeight: 220,
    overflowY: 'auto',
    zIndex: 20,
  };

  const modelOptionItemStyle: React.CSSProperties = {
    padding: '10px 14px',
    fontSize: 14,
    cursor: 'pointer',
  };

  const hintStyle: React.CSSProperties = {
    fontSize: 12,
    color: '#9ca3af',
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
    fontSize: 16,
    fontWeight: 600,
    color: '#fff',
    background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
    border: 'none',
    borderRadius: 12,
    cursor: 'pointer',
    transition: 'transform 0.15s, box-shadow 0.15s',
    boxShadow: '0 4px 14px rgba(59,130,246,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  };

  const statusStyle: React.CSSProperties = {
    textAlign: 'center' as const,
    padding: '12px 16px',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 500,
    marginTop: 16,
    backgroundColor: status.type === 'success' ? '#dcfce7' : status.type === 'error' ? '#fee2e2' : 'transparent',
    color: status.type === 'success' ? '#166534' : status.type === 'error' ? '#dc2626' : 'transparent',
  };

  const infoCardStyle: React.CSSProperties = {
    backgroundColor: '#f0f9ff',
    borderRadius: 12,
    padding: 20,
    marginTop: 24,
    border: '1px solid #bae6fd',
  };

  const infoTitleStyle: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 600,
    color: '#0369a1',
    marginBottom: 12,
  };

  const infoListStyle: React.CSSProperties = {
    margin: 0,
    paddingLeft: 20,
    fontSize: 13,
    color: '#0c4a6e',
    lineHeight: 1.8,
  };

  const loadingOverlayStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 400,
    color: '#6b7280',
  };

  const spinnerStyle: React.CSSProperties = {
    width: 32,
    height: 32,
    border: '3px solid #e5e7eb',
    borderTop: '3px solid #3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  };

  const inputWrapperStyle: React.CSSProperties = {
    position: 'relative' as const,
  };

  const eyeButtonStyle: React.CSSProperties = {
    position: 'absolute' as const,
    right: 12,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#9ca3af',
    transition: 'color 0.2s',
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
      <div style={cardStyle}>
        <div style={headerStyle}>
          <div style={logoStyle}>
            <div style={iconStyle}>✨</div>
            <div>
              <h1 style={titleStyle}>{t.title[lang]}</h1>
              <p style={subtitleStyle}>{t.subtitle[lang]}</p>
            </div>
          </div>
          {/* Tab Navigation */}
          <div style={tabContainerStyle}>
            <button
              style={getTabStyle(activeTab === 'api')}
              onClick={() => setActiveTab('api')}
              onMouseOver={(e) => {
                if (activeTab !== 'api') {
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
                }
              }}
              onMouseOut={(e) => {
                if (activeTab !== 'api') {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <span>⚙️</span> {t.tabApiConfig[lang]}
            </button>
            <button
              style={getTabStyle(activeTab === 'translation')}
              onClick={() => setActiveTab('translation')}
              onMouseOver={(e) => {
                if (activeTab !== 'translation') {
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
                }
              }}
              onMouseOut={(e) => {
                if (activeTab !== 'translation') {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <span>📖</span> {t.tabTranslationSettings[lang]}
            </button>
          </div>
        </div>

        <div style={formStyle}>
          {/* API Config Tab */}
          {activeTab === 'api' && (
            <React.Fragment>
              <div style={sectionStyle}>
                <div style={sectionTitleStyle}>
                  <span>🔑</span> {t.apiSection[lang]}
                </div>

                {/* Provider Selection */}
                <div style={{ marginBottom: 20 }}>
                  <label style={labelStyle}>{t.providerLabel[lang]}</label>
                  <select
                    value={provider}
                    onChange={(e) => {
                      const newProvider = e.target.value as Provider;
                      setProvider(newProvider);
                      // Config will be loaded by useEffect
                    }}
                    style={selectStyle}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#3b82f6';
                      e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e5e7eb';
                      e.target.style.boxShadow = 'none';
                    }}
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
                        paddingRight: 44,
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#3b82f6';
                        e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#e5e7eb';
                        e.target.style.boxShadow = 'none';
                      }}
                    />
                    <button
                      type="button"
                      style={eyeButtonStyle}
                      onClick={() => setShowApiKey(!showApiKey)}
                      onMouseOver={(e) => e.currentTarget.style.color = '#6b7280'}
                      onMouseOut={(e) => e.currentTarget.style.color = '#9ca3af'}
                      title={showApiKey ? t.hideApiKey[lang] : t.showApiKey[lang]}
                    >
                      {showApiKey ? (
                        // Eye off icon
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                          <line x1="1" y1="1" x2="23" y2="23"></line>
                        </svg>
                      ) : (
                        // Eye icon
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                          <circle cx="12" cy="12" r="3"></circle>
                        </svg>
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
                    onFocus={(e) => {
                      e.target.style.borderColor = '#3b82f6';
                      e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e5e7eb';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                  <p style={hintStyle}>
                    {t.baseUrlHint[lang]}: {PROVIDER_CONFIGS[provider].defaultBaseUrl}
                  </p>
                  <p style={hintStyle}>{t.baseUrlCustomHint[lang]}</p>
                </div>
              </div>

              {/* Model Section */}
              <div style={sectionStyle}>
                <div style={sectionTitleStyle}>
                  <span>🤖</span> {t.modelSection[lang]}
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
                        onFocus={(e) => {
                          if (modelBlurTimeoutRef.current) {
                            window.clearTimeout(modelBlurTimeoutRef.current);
                            modelBlurTimeoutRef.current = null;
                          }
                          setShowModelOptions(true);
                          e.target.style.borderColor = '#3b82f6';
                          e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)';
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = '#e5e7eb';
                          e.target.style.boxShadow = 'none';
                          modelBlurTimeoutRef.current = window.setTimeout(() => {
                            setShowModelOptions(false);
                          }, 120);
                        }}
                      />
                      {showModelOptions && modelOptions.length > 0 && (
                        <div style={modelOptionsStyle}>
                          {modelOptions.map((modelOption) => (
                            <div
                              key={modelOption}
                              role="option"
                              aria-selected={modelOption === model}
                              style={modelOptionItemStyle}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setModel(modelOption);
                                setShowModelOptions(false);
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#f3f4f6';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = '#fff';
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
                      onFocus={(e) => {
                        e.target.style.borderColor = '#3b82f6';
                        e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#e5e7eb';
                        e.target.style.boxShadow = 'none';
                      }}
                    >
                      <option value="中文">🇨🇳 中文</option>
                      <option value="English">🇺🇸 English</option>
                      <option value="日本語">🇯🇵 日本語</option>
                      <option value="한국어">🇰🇷 한국어</option>
                    </select>
                  </div>
                </div>
              </div>
            </React.Fragment>
          )}

          {/* Translation Settings Tab */}
          {activeTab === 'translation' && (
            <div style={sectionStyle}>
              <div style={sectionTitleStyle}>
                <span>🌐</span> {t.translationSettingsTitle[lang]}
              </div>

              {/* Translation Button Toggle */}
              <div style={{ marginBottom: 24 }}>
                <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input
                    type="checkbox"
                    checked={translationButtonEnabled}
                    onChange={(e) => setTranslationButtonEnabled(e.target.checked)}
                    style={{ width: 20, height: 20, cursor: 'pointer' }}
                  />
                  {t.translationButtonToggleLabel[lang]}
                </label>
                <p style={{ ...hintStyle, marginLeft: 32 }}>{t.translationButtonToggleHint[lang]}</p>
              </div>

              {/* Concurrency Setting */}
              <div style={{ marginBottom: 24 }}>
                <label style={labelStyle}>{t.concurrencyLabel[lang]}</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={concurrency}
                  onChange={(e) => setConcurrency(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                  style={inputStyle}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#3b82f6';
                    e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                    e.target.style.boxShadow = 'none';
                  }}
                />
                <p style={hintStyle}>{t.concurrencyHint[lang]}</p>
              </div>

              {/* Blacklist Toggle */}
              <div>
                <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input
                    type="checkbox"
                    checked={blacklistEnabled}
                    onChange={(e) => setBlacklistEnabled(e.target.checked)}
                    style={{ width: 20, height: 20, cursor: 'pointer' }}
                  />
                  {t.blacklistToggleLabel[lang]}
                </label>
                <p style={{ ...hintStyle, marginLeft: 32 }}>{t.blacklistToggleHint[lang]}</p>
              </div>
            </div>
          )}

          {/* Save Button */}
          <button
            style={buttonStyle}
            onClick={handleSave}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(59,130,246,0.5)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 14px rgba(59,130,246,0.4)';
            }}
          >
            <span>💾</span> {t.saveBtn[lang]}
          </button>

          {status.type !== 'idle' && (
            <div style={statusStyle}>{status.message}</div>
          )}

          {/* Info Card */}
          <div style={infoCardStyle}>
            <div style={infoTitleStyle}>{t.guideTitle[lang]}</div>
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
