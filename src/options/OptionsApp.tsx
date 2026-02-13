import { useState, useEffect, Fragment, type FC, type CSSProperties } from 'react';
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
  CheckCircle2,
  ShieldCheck,
  Zap,
  Loader2,
  HelpCircle
} from 'lucide-react';
import { icons } from '../resource';
import { type Provider, PROVIDER_CONFIGS, CONTEXT_MAX_TOKENS } from '../config';

function getDefaultTargetLanguage(): string {
  return isBrowserChinese() ? '中文' : 'English';
}

import OCRSettingsComponent from './OCRSettings';

type TabType = 'api' | 'translation' | 'ocr' | 'help';

const OptionsApp: FC = () => {
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
  const [contextMaxTokens, setContextMaxTokens] = useState<number>(CONTEXT_MAX_TOKENS.default);
  const [explanationDetailLevel, setExplanationDetailLevel] = useState<'concise' | 'standard' | 'detailed'>('standard');
  const [isTesting, setIsTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<{ type: 'success' | 'error' | 'idle', message: string }>({ type: 'idle', message: '' });

  const [ocrEnabled, setOcrEnabled] = useState(false);
  const [ocrLanguages, setOcrLanguages] = useState<string[]>(['jpn', 'eng']);

  useEffect(() => {
    setLang(getUILanguage());
    chrome.storage.local.get(['selectedProvider', 'targetLanguage', 'translationConcurrency', 'translationBlacklistEnabled', 'translationButtonEnabled', 'kanaRubyEnabled', 'contextMaxTokens', 'explanationDetailLevel', 'ocr_enabled', 'ocr_languages'], (result) => {
      if (result.selectedProvider) {
        setProvider(result.selectedProvider as Provider);
      }
      setTargetLang((result.targetLanguage as string) || getDefaultTargetLanguage());
      setConcurrency((result.translationConcurrency as number) || 10);
      setBlacklistEnabled(result.translationBlacklistEnabled !== false);
      setTranslationButtonEnabled(result.translationButtonEnabled !== false);
      setKanaRubyEnabled(result.kanaRubyEnabled !== false);
      setContextMaxTokens((result.contextMaxTokens as number) || CONTEXT_MAX_TOKENS.default);
      const rawDetailLevel = result.explanationDetailLevel as string | undefined;
      if (rawDetailLevel === 'concise' || rawDetailLevel === 'standard' || rawDetailLevel === 'detailed') {
        setExplanationDetailLevel(rawDetailLevel);
      }

      // Load OCR settings
      setOcrEnabled(result.ocr_enabled !== false);
      setOcrLanguages((result.ocr_languages as string[]) || ['jpn', 'eng']);

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
  const modelOptions = PROVIDER_CONFIGS[provider]?.modelOptions || [];

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
      contextMaxTokens,
      explanationDetailLevel,
      ocr_enabled: ocrEnabled,
      ocr_languages: ocrLanguages
    }, () => {
      setStatus({ type: 'success', message: t.saveSuccess[lang] });
      setTimeout(() => setStatus({ type: 'idle', message: '' }), 3000);
    });
  };

  const handleTestConnection = async () => {
    if (!apiKey) {
      setTestStatus({ type: 'error', message: t.apiKeyPlaceholder[lang] });
      return;
    }

    setIsTesting(true);
    setTestStatus({ type: 'idle', message: '' });

    try {
      // Create a temporary port to test connection
      const port = chrome.runtime.connect({ name: 'ai-test-connection' });

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), 10000);
      });

      const testPromise = new Promise((resolve, reject) => {
        port.onMessage.addListener((msg) => {
          if (msg.type === 'success') resolve(msg);
          else if (msg.type === 'error') reject(new Error(msg.error));
        });

        port.onDisconnect.addListener(() => {
          reject(new Error('Port disconnected'));
        });

        port.postMessage({
          action: 'testConnection',
          payload: {
            provider,
            apiKey,
            baseUrl,
            model,
            uiLang: lang
          }
        });
      });

      await Promise.race([testPromise, timeoutPromise]);
      setTestStatus({ type: 'success', message: t.testSuccess[lang] });
    } catch (error) {
      setTestStatus({ type: 'error', message: `${t.testFailed[lang]}: ${(error as Error).message}` });
    } finally {
      setIsTesting(false);
    }
  };

  const containerStyle: CSSProperties = {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #f1f5f9 0%, #e2e8f0 100%)',
    padding: '48px 24px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  };

  const cardStyle: CSSProperties = {
    maxWidth: 600,
    margin: '0 auto',
    backgroundColor: '#fff',
    borderRadius: 20,
    boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
    overflow: 'hidden',
  };

  const headerStyle: CSSProperties = {
    background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
    padding: '32px 32px 28px',
    color: '#fff',
  };

  const logoStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 18,
    marginBottom: 12,
  };

  const iconStyle: CSSProperties = {
    width: 56,
    height: 56,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const titleStyle: CSSProperties = {
    fontSize: 26,
    fontWeight: 700,
    margin: 0,
    letterSpacing: '-0.5px',
  };

  const subtitleStyle: CSSProperties = {
    fontSize: 14,
    opacity: 0.85,
    marginTop: 2,
  };

  const tabContainerStyle: CSSProperties = {
    display: 'flex',
    gap: 6,
    marginTop: 24,
  };

  const getTabStyle = (isActive: boolean): CSSProperties => ({
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

  const formStyle: CSSProperties = {
    padding: '32px 32px 28px',
  };

  const sectionStyle: CSSProperties = {
    marginBottom: 32,
  };

  const sectionTitleStyle: CSSProperties = {
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

  const labelStyle: CSSProperties = {
    display: 'block',
    fontSize: 14,
    fontWeight: 500,
    color: '#374151',
    marginBottom: 8,
  };

  const inputStyle: CSSProperties = {
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

  const selectStyle: CSSProperties = {
    ...inputStyle,
    cursor: 'pointer',
    appearance: 'none' as const,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 14px center',
    backgroundSize: 18,
    paddingRight: 48,
  };

  const modelInputWrapperStyle: CSSProperties = {
    position: 'relative',
  };

  const modelOptionsStyle: CSSProperties = {
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

  const modelOptionItemStyle: CSSProperties = {
    padding: '12px 16px',
    fontSize: 14,
    cursor: 'pointer',
  };

  const hintStyle: CSSProperties = {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 6,
  };

  const rowStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 16,
  };

  const buttonStyle: CSSProperties = {
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

  const statusStyle: CSSProperties = {
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

  const infoCardStyle: CSSProperties = {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: '22px',
    marginTop: 28,
    border: '1px solid #e2e8f0',
  };

  const infoTitleStyle: CSSProperties = {
    fontSize: 14,
    fontWeight: 600,
    color: '#334155',
    marginBottom: 14,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  };

  const infoListStyle: CSSProperties = {
    margin: 0,
    paddingLeft: 20,
    fontSize: 13,
    color: '#475569',
    lineHeight: 1.85,
  };

  const loadingOverlayStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 400,
    color: '#64748b',
  };

  const spinnerStyle: CSSProperties = {
    width: 36,
    height: 36,
    border: '3px solid #e2e8f0',
    borderTop: '3px solid #8b5cf6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  };

  const inputWrapperStyle: CSSProperties = {
    position: 'relative' as const,
  };

  const eyeButtonStyle: CSSProperties = {
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
            <button
              style={getTabStyle(activeTab === 'ocr')}
              onClick={() => setActiveTab('ocr')}
            >
              <span>📷</span>
              图片识别
            </button>
            <button
              style={getTabStyle(activeTab === 'help')}
              onClick={() => setActiveTab('help')}
            >
              <HelpCircle size={16} strokeWidth={2} />
              使用帮助
            </button>
          </div>
        </div>

        <div style={formStyle}>
          {activeTab === 'api' && (
            <Fragment>
              <div style={sectionStyle}>
                <div style={sectionTitleStyle}>
                  <Key size={14} strokeWidth={2} />
                  {t.apiSection[lang]}
                </div>

                <div style={{
                  backgroundColor: '#fff1f2',
                  border: '1px solid #fecdd3',
                  borderRadius: 12,
                  padding: '12px 16px',
                  marginBottom: 20,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                }}>
                  <ShieldCheck size={18} style={{ color: '#e11d48', marginTop: 2, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: '#9f1239', fontWeight: 500, lineHeight: 1.5 }}>
                    {t.securityPromise[lang]}
                  </span>
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
                  <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button
                      onClick={handleTestConnection}
                      disabled={isTesting}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '8px 16px',
                        fontSize: 13,
                        fontWeight: 500,
                        borderRadius: 8,
                        border: '1px solid #e2e8f0',
                        backgroundColor: '#fff',
                        color: '#475569',
                        cursor: isTesting ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                      }}
                      onMouseEnter={(e) => {
                        if (!isTesting) {
                          e.currentTarget.style.backgroundColor = '#f8fafc';
                          e.currentTarget.style.borderColor = '#cbd5e1';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isTesting) {
                          e.currentTarget.style.backgroundColor = '#fff';
                          e.currentTarget.style.borderColor = '#e2e8f0';
                        }
                      }}
                    >
                      {isTesting ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Zap size={16} />
                      )}
                      {isTesting ? t.testing[lang] : t.testBtn[lang]}
                    </button>

                    {testStatus.type !== 'idle' && (
                      <div style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: testStatus.type === 'success' ? '#059669' : '#dc2626',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}>
                        {testStatus.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                        {testStatus.message}
                      </div>
                    )}
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
                    type="text"
                    value={contextMaxTokens}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setContextMaxTokens(Math.max(CONTEXT_MAX_TOKENS.min, Math.min(CONTEXT_MAX_TOKENS.max, val)));
                    }}
                    onBlur={(e) => {
                      const val = parseInt(e.target.value) || CONTEXT_MAX_TOKENS.min;
                      setContextMaxTokens(Math.max(CONTEXT_MAX_TOKENS.min, Math.min(CONTEXT_MAX_TOKENS.max, val)));
                    }}
                    style={inputStyle}
                  />
                  <p style={hintStyle}>{t.contextMaxTokensHint[lang]}</p>
                </div>

                <div style={{ marginTop: 20 }}>
                  <label style={labelStyle}>{t.explanationDetailLabel[lang]}</label>
                  <select
                    value={explanationDetailLevel}
                    onChange={(e) => setExplanationDetailLevel(e.target.value as 'concise' | 'standard' | 'detailed')}
                    style={selectStyle}
                  >
                    <option value="concise">{t.explanationDetailConcise[lang]}</option>
                    <option value="standard">{t.explanationDetailStandard[lang]}</option>
                    <option value="detailed">{t.explanationDetailDetailed[lang]}</option>
                  </select>
                  <p style={hintStyle}>{t.explanationDetailHint[lang]}</p>
                </div>
              </div>
            </Fragment>
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

          {activeTab === 'ocr' && (
            <OCRSettingsComponent
              ocrEnabled={ocrEnabled}
              ocrLanguages={ocrLanguages}
              onSave={(settings) => {
                setOcrEnabled(settings.ocrEnabled);
                setOcrLanguages(settings.ocrLanguages);
                chrome.storage.local.set({
                  ocr_enabled: settings.ocrEnabled,
                  ocr_languages: settings.ocrLanguages
                });
              }}
            />
          )}

          {activeTab === 'help' && (
            <div style={sectionStyle}>
              <div style={sectionTitleStyle}>
                <HelpCircle size={14} strokeWidth={2} />
                Select AI 使用帮助
              </div>
              
              {/* 核心功能 */}
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: '#1f2937' }}>🎯 核心功能</h3>
                
                <div style={{ backgroundColor: '#f9fafb', borderRadius: 8, padding: 16, marginBottom: 12 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#374151' }}>智能划词解释</h4>
                  <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6, marginBottom: 8 }}>选中网页任意文字，点击出现的粉紫色悬浮按钮，AI会自动提取上下文并给出精准解释（不是简单翻译）。</p>
                  <p style={{ fontSize: 12, color: '#9ca3af' }}>适用：遇到生僻术语、阅读专业论文、学习外语</p>
                </div>

                <div style={{ backgroundColor: '#f9fafb', borderRadius: 8, padding: 16, marginBottom: 12 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#374151' }}>上下文感知</h4>
                  <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6, marginBottom: 8 }}>自动提取选中文字周围的上下文内容（默认5000字，最大50000字），帮助AI更准确理解含义。</p>
                  <p style={{ fontSize: 12, color: '#9ca3af' }}>在"翻译设置"中可调整上下文长度</p>
                </div>

                <div style={{ backgroundColor: '#f9fafb', borderRadius: 8, padding: 16 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#374151' }}>双语翻译</h4>
                  <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>原文+译文并排显示，支持整页翻译或选中翻译。输出语言可自定义（中文/英文/日文/韩文）。</p>
                </div>
              </div>

              {/* OCR功能 */}
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: '#1f2937' }}>🖼️ OCR 识别</h3>
                
                <div style={{ backgroundColor: '#f9fafb', borderRadius: 8, padding: 16, marginBottom: 12 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#374151' }}>图片文字识别</h4>
                  <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6, marginBottom: 8 }}>在网页图片上右键 → 选择 "Select AI" → "识别文字"或"解释图片"</p>
                  <p style={{ fontSize: 12, color: '#9ca3af' }}>支持：英语、日语、简体中文（需在设置中下载语言包）</p>
                </div>

                <div style={{ backgroundColor: '#f9fafb', borderRadius: 8, padding: 16 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#374151' }}>截图识别</h4>
                  <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>点击扩展图标 → "截图识别" → 框选屏幕区域 → 自动识别文字并解释</p>
                </div>
              </div>

              {/* 日语功能 */}
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: '#1f2937' }}>🇯🇵 日语学习</h3>
                
                <div style={{ backgroundColor: '#f9fafb', borderRadius: 8, padding: 16, marginBottom: 12 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#374151' }}>假名标注</h4>
                  <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6, marginBottom: 8 }}>在日语汉字上方显示假名注音（Ruby），如：日本語(にほんご)</p>
                  <p style={{ fontSize: 12, color: '#9ca3af' }}>在"翻译设置"中可开关</p>
                </div>

                <div style={{ backgroundColor: '#f9fafb', borderRadius: 8, padding: 16 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#374151' }}>朗读功能</h4>
                  <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>点击面板中的朗读按钮，可朗读原文或译文。支持日语假名+朗读组合。</p>
                </div>
              </div>

              {/* 面板操作 */}
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: '#1f2937' }}>🖱️ 面板操作</h3>
                <ul style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.8, paddingLeft: 20 }}>
                  <li>拖拽面板顶部移动位置</li>
                  <li>拖拽面板边缘调整大小</li>
                  <li>点击面板外区域或按 ESC 关闭</li>
                </ul>
              </div>

              {/* 隐私 */}
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: '#1f2937' }}>🔒 隐私安全</h3>
                <div style={{ backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 8, padding: 12 }}>
                  <p style={{ fontSize: 13, color: '#065f46', lineHeight: 1.6 }}>
                    ✅ API Key 仅存储在本地浏览器<br/>
                    ✅ 不上传任何用户数据<br/>
                    ✅ 不收集浏览记录
                  </p>
                </div>
              </div>

              {/* 快捷入门 */}
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: '#1f2937' }}>🚀 快速入门</h3>
                <ol style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.8, paddingLeft: 20 }}>
                  <li>在"API设置"中填写你的 API Key</li>
                  <li>点击"测试连接"确认配置正确</li>
                  <li>打开任意网页，选中文字试试</li>
                  <li>去"翻译设置"调整你喜欢的参数</li>
                </ol>
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
    </div >
  );
};

export default OptionsApp;
