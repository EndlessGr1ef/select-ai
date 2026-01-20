import { useState, useEffect } from 'react'
import './App.css'
import { getUILanguage } from './utils/language'
import { translations } from './utils/i18n'

// Provider configurations
type Provider = 'openai' | 'anthropic' | 'minimax' | 'deepseek' | 'glm';

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

function App() {
  const [isConfigured, setIsConfigured] = useState(false);
  const [providerName, setProviderName] = useState('');
  const [modelName, setModelName] = useState('');
  const [lang, setLang] = useState<'zh' | 'en'>('zh');

  // Provider display names
  const providerNames: Record<Provider, { zh: string; en: string }> = {
    openai: { zh: 'OpenAI', en: 'OpenAI' },
    anthropic: { zh: 'Anthropic', en: 'Anthropic' },
    minimax: { zh: 'MiniMax', en: 'MiniMax' },
    deepseek: { zh: 'DeepSeek', en: 'DeepSeek' },
    glm: { zh: '智谱 AI', en: 'Zhipu AI' },
  };

  useEffect(() => {
    setLang(getUILanguage());
  }, []);

  useEffect(() => {
    // Check if chrome API is available (running in extension context)
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(['selectedProvider'], async (result) => {
        const selectedProvider = (result.selectedProvider as Provider) || 'deepseek';
        const config = PROVIDER_CONFIGS[selectedProvider];
        const storageKey = config.storageKey;

        // Get the provider-specific API key
        const settings = await chrome.storage.local.get([
          `${storageKey}ApiKey`,
          `${storageKey}Model`
        ]);
        const apiKey = settings[`${storageKey}ApiKey`] as string | undefined;
        const model = settings[`${storageKey}Model`] as string | undefined;

        if (apiKey) {
          setIsConfigured(true);
          setProviderName(providerNames[selectedProvider][lang]);
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
      // Fallback for non-extension context
      window.open('options.html', '_blank');
    }
  };

  // Styles matching OptionsApp
  const containerStyle: React.CSSProperties = {
    width: 320,
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: '#fff',
    borderRadius: 0,
  };

  const headerStyle: React.CSSProperties = {
    background: 'linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%)',
    padding: '20px 20px 16px',
    color: '#fff',
  };

  const logoStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  };

  const iconStyle: React.CSSProperties = {
    width: 44,
    height: 44,
    background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 20,
    boxShadow: '0 4px 12px rgba(236,72,153,0.3)',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: 18,
    fontWeight: 700,
    margin: 0,
  };

  const subtitleStyle: React.CSSProperties = {
    fontSize: 12,
    opacity: 0.8,
    marginTop: 2,
  };

  const contentStyle: React.CSSProperties = {
    padding: 20,
  };

  const statusCardStyle: React.CSSProperties = {
    background: isConfigured
      ? 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)'
      : 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    border: isConfigured ? '1px solid #86efac' : '1px solid #fcd34d',
  };

  const statusIconStyle: React.CSSProperties = {
    width: 32,
    height: 32,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 16,
    backgroundColor: isConfigured ? '#22c55e' : '#f59e0b',
    color: '#fff',
    marginBottom: 8,
  };

  const statusTitleStyle: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 600,
    color: isConfigured ? '#166534' : '#92400e',
    marginBottom: 4,
  };

  const statusTextStyle: React.CSSProperties = {
    fontSize: 12,
    color: isConfigured ? '#15803d' : '#a16207',
  };

  const infoCardStyle: React.CSSProperties = {
    backgroundColor: '#f0f9ff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    border: '1px solid #bae6fd',
  };

  const infoTitleStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 600,
    color: '#0369a1',
    marginBottom: 10,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  };

  const infoListStyle: React.CSSProperties = {
    margin: 0,
    paddingLeft: 18,
    fontSize: 12,
    color: '#0c4a6e',
    lineHeight: 1.7,
  };

  const buttonStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 16px',
    fontSize: 14,
    fontWeight: 600,
    color: '#fff',
    background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
    border: 'none',
    borderRadius: 10,
    cursor: 'pointer',
    transition: 'transform 0.15s, box-shadow 0.15s',
    boxShadow: '0 4px 12px rgba(59,130,246,0.35)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  };

  const footerStyle: React.CSSProperties = {
    borderTop: '1px solid #e5e7eb',
    padding: '12px 20px',
    backgroundColor: '#f9fafb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  };

  const versionStyle: React.CSSProperties = {
    fontSize: 11,
    color: '#9ca3af',
  };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <div style={logoStyle}>
            <div style={iconStyle}>✨</div>
            <div>
              <h1 style={titleStyle}>{t.title[lang]}</h1>
              <p style={subtitleStyle}>{t.subtitle[lang]}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={contentStyle}>
          {/* Status Card */}
          <div style={statusCardStyle}>
            <div style={statusIconStyle}>
              {isConfigured ? '✓' : '!'}
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

          {/* Usage Guide */}
          <div style={infoCardStyle}>
            <div style={infoTitleStyle}>
              <span>📖</span> {t.usageTitle[lang]}
            </div>
            <ol style={infoListStyle}>
              {(t.usageSteps as Record<string, string[]>)[lang].map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </div>

          {/* Settings Button */}
          <button
            style={buttonStyle}
            onClick={openOptions}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(59,130,246,0.45)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(59,130,246,0.35)';
            }}
          >
            <span>⚙️</span> {t.settingsBtn[lang]}
          </button>
        </div>

        {/* Footer */}
        <div style={footerStyle}>
          <span style={versionStyle}>{t.version[lang]}</span>
        </div>
      </div>
    </div>
  );
}

export default App
