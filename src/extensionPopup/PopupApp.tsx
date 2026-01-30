import { useState, useEffect } from 'react'
import './PopupApp.css'
import { getUILanguage } from '../utils/language'
import { translations } from '../utils/i18n'
import {
  Settings,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'
import { icons } from '../resource'
import { type Provider, PROVIDER_CONFIGS, DEFAULT_PROVIDER } from '../config'

function PopupApp() {
  const [isConfigured, setIsConfigured] = useState(false);
  const [providerName, setProviderName] = useState('');
  const [modelName, setModelName] = useState('');
  const [lang, setLang] = useState<'zh' | 'en'>('zh');

  const getProviderDisplayName = (provider: Provider, language: 'zh' | 'en'): string => {
    const config = PROVIDER_CONFIGS[provider];
    return config?.name?.[language] || provider;
  };

  useEffect(() => {
    setLang(getUILanguage());
  }, []);

  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(['selectedProvider'], async (result) => {
        const selectedProvider = (result.selectedProvider as Provider) || DEFAULT_PROVIDER;
        const config = PROVIDER_CONFIGS[selectedProvider];
        if (!config) return;
        const storageKey = config.storageKey;

        const settings = await chrome.storage.local.get([
          `${storageKey}ApiKey`,
          `${storageKey}Model`
        ]);
        const apiKey = settings[`${storageKey}ApiKey`] as string | undefined;
        const model = settings[`${storageKey}Model`] as string | undefined;

        if (apiKey) {
          setIsConfigured(true);
          setProviderName(getProviderDisplayName(selectedProvider, lang));
          setModelName(model || config.defaultModel);
        }
      });
    }
  }, [lang]);

  const t = translations.popup;

  const openOptions = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open('options.html', '_blank');
    }
  };

  const containerStyle: React.CSSProperties = {
    width: 340,
    background: 'linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: '#fff',
    borderRadius: 16,
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    overflow: 'hidden',
  };

  const headerStyle: React.CSSProperties = {
    background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
    padding: '24px 24px 20px',
    color: '#fff',
  };

  const logoStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  };

  const iconStyle: React.CSSProperties = {
    width: 48,
    height: 48,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: 20,
    fontWeight: 700,
    margin: 0,
    letterSpacing: '-0.5px',
  };

  const subtitleStyle: React.CSSProperties = {
    fontSize: 13,
    opacity: 0.85,
    marginTop: 2,
    fontWeight: 400,
  };

  const contentStyle: React.CSSProperties = {
    padding: '24px 24px 20px',
  };

  const statusCardStyle: React.CSSProperties = {
    background: isConfigured
      ? 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)'
      : 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
    borderRadius: 14,
    padding: '18px 18px 16px',
    marginBottom: 20,
    border: isConfigured ? '1px solid #a7f3d0' : '1px solid #fcd34d',
  };

  const statusIconStyle: React.CSSProperties = {
    width: 36,
    height: 36,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    backgroundColor: isConfigured ? '#10b981' : '#f59e0b',
    color: '#fff',
  };

  const statusTitleStyle: React.CSSProperties = {
    fontSize: 15,
    fontWeight: 600,
    color: isConfigured ? '#065f46' : '#92400e',
    marginBottom: 4,
  };

  const statusTextStyle: React.CSSProperties = {
    fontSize: 13,
    color: isConfigured ? '#047857' : '#a16207',
  };

  const infoCardStyle: React.CSSProperties = {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: '18px',
    marginBottom: 20,
    border: '1px solid #e2e8f0',
  };

  const infoTitleStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 600,
    color: '#334155',
    marginBottom: 12,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  };

  const infoListStyle: React.CSSProperties = {
    margin: 0,
    paddingLeft: 20,
    fontSize: 12,
    color: '#475569',
    lineHeight: 1.75,
  };

  const buttonStyle: React.CSSProperties = {
    width: '100%',
    padding: '14px 20px',
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
    gap: 8,
  };

  const footerStyle: React.CSSProperties = {
    borderTop: '1px solid #e2e8f0',
    padding: '14px 24px',
    backgroundColor: '#f8fafc',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  };

  const versionStyle: React.CSSProperties = {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: 500,
  };

  return (
    <div style={containerStyle}>
      <style>{`
        @keyframes pulse-gentle {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
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
                  width: 48,
                  height: 48,
                  objectFit: 'contain'
                }}
              />
            </div>
            <div>
              <h1 style={titleStyle}>{t.title[lang]}</h1>
              <p style={subtitleStyle}>{t.subtitle[lang]}</p>
            </div>
          </div>
        </div>

        <div style={contentStyle}>
          <div style={statusCardStyle}>
            <div style={statusIconStyle}>
              {isConfigured ? (
                <CheckCircle2 size={20} strokeWidth={2.5} />
              ) : (
                <AlertCircle size={20} strokeWidth={2.5} />
              )}
            </div>
            <div style={statusTitleStyle}>
              {isConfigured ? t.statusReady[lang] : t.statusNeedConfig[lang]}
            </div>
            <div style={statusTextStyle}>
              {isConfigured
                ? `${providerName} · ${modelName}`
                : t.needApiKey[lang]}
            </div>
          </div>

          <div style={infoCardStyle}>
            <div style={infoTitleStyle}>

              {t.usageTitle[lang]}
            </div>
            <ol style={infoListStyle}>
              {(t.usageSteps as Record<string, string[]>)[lang].map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </div>

          <button
            style={buttonStyle}
            onClick={openOptions}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(99, 102, 241, 0.45)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 14px rgba(99, 102, 241, 0.35)';
            }}
          >
            <Settings size={18} strokeWidth={2} />
            {t.settingsBtn[lang]}
          </button>
        </div>

        <div style={footerStyle}>
          <span style={versionStyle}>{t.version[lang]}</span>
        </div>
      </div>
    </div>
  );
}

export default PopupApp
