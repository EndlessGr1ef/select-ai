import { useState, useEffect, Fragment, type FC, type CSSProperties } from 'react';
import { getUILanguage, mapTargetToUILanguage, isBrowserChinese } from '../utils/language';
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
    // Get UI language from storage or fallback to browser language
    const initLang = async () => {
      const uiLang = await getUILanguage();
      setLang(uiLang);
    };
    initLang();

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
    const uiLang = mapTargetToUILanguage(targetLang);
    chrome.storage.local.set({
      selectedProvider: provider,
      [`${providerStorageKey}ApiKey`]: apiKey,
      [`${providerStorageKey}BaseUrl`]: baseUrl,
      [`${providerStorageKey}Model`]: model,
      targetLanguage: targetLang,
      uiLanguage: uiLang,
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
    gap: 8,
    flexWrap: 'wrap',
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
              {t.tabOCR[lang]}
            </button>
            <button
              style={getTabStyle(activeTab === 'help')}
              onClick={() => setActiveTab('help')}
            >
              <HelpCircle size={16} strokeWidth={2} />
              {t.tabHelp[lang]}
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
              uiLang={lang}
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
                {t.helpTitle[lang]}
              </div>

              {/* Quick Nav Buttons */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                <button
                  onClick={() => setActiveTab('api')}
                  style={{
                    padding: '6px 12px',
                    fontSize: 12,
                    backgroundColor: '#e0e7ff',
                    border: 'none',
                    borderRadius: 6,
                    color: '#3730a3',
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  {t.helpNavApiSettings[lang]}
                </button>
                <button
                  onClick={() => setActiveTab('translation')}
                  style={{
                    padding: '6px 12px',
                    fontSize: 12,
                    backgroundColor: '#dcfce7',
                    border: 'none',
                    borderRadius: 6,
                    color: '#166534',
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  {t.helpNavTranslationSettings[lang]}
                </button>
                <button
                  onClick={() => setActiveTab('ocr')}
                  style={{
                    padding: '6px 12px',
                    fontSize: 12,
                    backgroundColor: '#fef3c7',
                    border: 'none',
                    borderRadius: 6,
                    color: '#92400e',
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  {t.helpNavOCR[lang]}
                </button>
              </div>

              {/* Core Features */}
              <details style={{ marginBottom: 16 }}>
                <summary style={{ cursor: 'pointer', padding: '10px 12px', backgroundColor: '#f3f4f6', borderRadius: 8, fontWeight: 600, fontSize: 14, color: '#1f2937' }}>
                  🎯 {t.helpCoreFeatures[lang]}
                </summary>
                <div style={{ padding: '12px 0' }}>
                  <div style={{ backgroundColor: '#f9fafb', borderRadius: 8, padding: 16, marginBottom: 12 }}>
                    <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#374151' }}>{t.helpSmartSelection[lang]}</h4>
                    <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6, marginBottom: 8 }}>{t.helpSmartSelectionDesc[lang]}</p>
                    <p style={{ fontSize: 12, color: '#9ca3af' }}>{t.helpSmartSelection适用[lang]}</p>
                  </div>

                  <div style={{ backgroundColor: '#f9fafb', borderRadius: 8, padding: 16, marginBottom: 12 }}>
                    <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#374151' }}>{t.helpContextAware[lang]}</h4>
                    <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6, marginBottom: 8 }}>
                      {t.helpContextAwareDesc[lang].replace('{default}', '5000').replace('{max}', '50000')}
                    </p>
                    <p style={{ fontSize: 12, color: '#9ca3af' }}>{t.helpContextAwareHint[lang]}</p>
                  </div>

                  <div style={{ backgroundColor: '#f9fafb', borderRadius: 8, padding: 16 }}>
                    <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#374151' }}>{t.helpBilingual[lang]}</h4>
                    <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>{t.helpBilingualDesc[lang]}</p>
                  </div>
                </div>
              </details>

              {/* OCR */}
              <details style={{ marginBottom: 16 }}>
                <summary style={{ cursor: 'pointer', padding: '10px 12px', backgroundColor: '#f3f4f6', borderRadius: 8, fontWeight: 600, fontSize: 14, color: '#1f2937' }}>
                  🖼️ {t.helpOCR[lang]}
                </summary>
                <div style={{ padding: '12px 0' }}>
                  <div style={{ backgroundColor: '#f9fafb', borderRadius: 8, padding: 16, marginBottom: 12 }}>
                    <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#374151' }}>{t.helpOCRImage[lang]}</h4>
                    <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6, marginBottom: 8 }}>{t.helpOCRImageDesc[lang]}</p>
                    <p style={{ fontSize: 12, color: '#9ca3af' }}>{t.helpOCRImageHint[lang]}</p>
                  </div>

                  <div style={{ backgroundColor: '#f9fafb', borderRadius: 8, padding: 16 }}>
                    <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#374151' }}>{t.helpOCRScreenshot[lang]}</h4>
                    <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>{t.helpOCRScreenshotDesc[lang]}</p>
                  </div>
                </div>
              </details>

              {/* Japanese Learning */}
              <details style={{ marginBottom: 16 }}>
                <summary style={{ cursor: 'pointer', padding: '10px 12px', backgroundColor: '#f3f4f6', borderRadius: 8, fontWeight: 600, fontSize: 14, color: '#1f2937' }}>
                  🇯🇵 {t.helpJapanese[lang]}
                </summary>
                <div style={{ padding: '12px 0' }}>
                  <div style={{ backgroundColor: '#f9fafb', borderRadius: 8, padding: 16, marginBottom: 12 }}>
                    <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#374151' }}>{t.helpKanaRuby[lang]}</h4>
                    <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6, marginBottom: 8 }}>{t.helpKanaRubyDesc[lang]}</p>
                    <p style={{ fontSize: 12, color: '#9ca3af' }}>{t.helpKanaRubyHint[lang]}</p>
                  </div>

                  <div style={{ backgroundColor: '#f9fafb', borderRadius: 8, padding: 16 }}>
                    <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#374151' }}>{t.helpTTS[lang]}</h4>
                    <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>{t.helpTTSDesc[lang]}</p>
                  </div>
                </div>
              </details>

              {/* Panel Operations */}
              <details style={{ marginBottom: 16 }}>
                <summary style={{ cursor: 'pointer', padding: '10px 12px', backgroundColor: '#f3f4f6', borderRadius: 8, fontWeight: 600, fontSize: 14, color: '#1f2937' }}>
                  🖱️ {t.helpPanelOps[lang]}
                </summary>
                <div style={{ padding: '12px 0' }}>
                  <ul style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.8, paddingLeft: 20 }}>
                    <li>{t.helpPanelOp1[lang]}</li>
                    <li>{t.helpPanelOp2[lang]}</li>
                    <li>{t.helpPanelOp3[lang]}</li>
                  </ul>
                </div>
              </details>

              {/* Privacy */}
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: '#1f2937' }}>🔒 {t.helpPrivacy[lang]}</h3>
                <div style={{ backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 8, padding: 12 }}>
                  <p style={{ fontSize: 13, color: '#065f46', lineHeight: 1.6 }}>
                    ✅ {t.helpPrivacyLocal[lang]}<br/>
                    ✅ {t.helpPrivacyNoUpload[lang]}<br/>
                    ✅ {t.helpPrivacyNoCollect[lang]}
                  </p>
                </div>
              </div>

              {/* Quick Start */}
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: '#1f2937' }}>🚀 {t.helpQuickStart[lang]}</h3>
                <ol style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.8, paddingLeft: 20 }}>
                  <li>{t.helpQuickStart1[lang]}</li>
                  <li>{t.helpQuickStart2[lang]}</li>
                  <li>{t.helpQuickStart3[lang]}</li>
                  <li>{t.helpQuickStart4[lang]}</li>
                </ol>
              </div>

              {/* FAQ */}
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: '#1f2937' }}>❓ {t.helpFAQ[lang]}</h3>

                <details style={{ marginBottom: 12 }}>
                  <summary style={{ cursor: 'pointer', padding: '10px 12px', backgroundColor: '#fef3c7', borderRadius: 8, fontWeight: 500, fontSize: 13, color: '#92400e' }}>
                    {t.helpFAQApiKey[lang]}
                  </summary>
                  <div style={{ padding: '12px 0 12px 12px', fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>
                    {t.helpFAQApiKeyAns[lang]}
                  </div>
                </details>

                <details style={{ marginBottom: 12 }}>
                  <summary style={{ cursor: 'pointer', padding: '10px 12px', backgroundColor: '#fef3c7', borderRadius: 8, fontWeight: 500, fontSize: 13, color: '#92400e' }}>
                    {t.helpFAQEmpty[lang]}
                  </summary>
                  <div style={{ padding: '12px 0 12px 12px', fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>
                    {t.helpFAQEmptyAns[lang]}
                  </div>
                </details>

                <details style={{ marginBottom: 12 }}>
                  <summary style={{ cursor: 'pointer', padding: '10px 12px', backgroundColor: '#fef3c7', borderRadius: 8, fontWeight: 500, fontSize: 13, color: '#92400e' }}>
                    {t.helpFAQTimeout[lang]}
                  </summary>
                  <div style={{ padding: '12px 0 12px 12px', fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>
                    {t.helpFAQTimeoutAns[lang]}
                  </div>
                </details>

                <details style={{ marginBottom: 12 }}>
                  <summary style={{ cursor: 'pointer', padding: '10px 12px', backgroundColor: '#fef3c7', borderRadius: 8, fontWeight: 500, fontSize: 13, color: '#92400e' }}>
                    {t.helpFAQError[lang]}
                  </summary>
                  <div style={{ padding: '12px 0 12px 12px', fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>
                    {t.helpFAQErrorAns[lang]}
                  </div>
                </details>
              </div>
            </div>
          )}

          {activeTab !== 'help' && (
            <button
              style={buttonStyle}
              onClick={handleSave}
            >
              <Save size={18} strokeWidth={2} />
              {t.saveBtn[lang]}
            </button>
          )}

          {activeTab !== 'help' && status.type !== 'idle' && (
            <div style={statusStyle}>
              {status.type === 'success' ? (
                <CheckCircle2 size={18} strokeWidth={2} />
              ) : (
                <AlertCircle size={18} strokeWidth={2} />
              )}
              {status.message}
            </div>
          )}

          {activeTab !== 'help' && (
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
          )}
        </div>
      </div>
    </div >
  );
};

export default OptionsApp;
