// OCR Settings Tab - Options page for OCR configuration

import React, { useState, useEffect, type FC } from 'react';
import { ocrService, type OCRSettings } from '../../services/ocrService';

interface OCRSettingsProps {
  ocrEnabled: boolean;
  ocrLanguages: string[];
  onSave: (settings: OCRSettings) => void;
}

const OCRSettings: FC<OCRSettingsProps> = ({ ocrEnabled: initialEnabled, ocrLanguages: initialLanguages, onSave }) => {
  const [ocrEnabled, setOcrEnabled] = useState(initialEnabled);
  const [ocrLanguages, setOcrLanguages] = useState<string[]>(initialLanguages);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadedLangs, setDownloadedLangs] = useState<Record<string, boolean>>({});

  const languages = ocrService.getAvailableLanguages();

  // Load downloaded status
  useEffect(() => {
    const loadDownloadStatus = async () => {
      const status: Record<string, boolean> = {};
      for (const lang of languages) {
        status[lang.id] = await ocrService.isLanguageDownloaded(lang.id);
      }
      setDownloadedLangs(status);
    };
    loadDownloadStatus();
  }, []);

  // Toggle OCR enabled
  const handleToggleEnabled = async (enabled: boolean) => {
    setOcrEnabled(enabled);
    const newSettings: OCRSettings = {
      ocrEnabled: enabled,
      ocrLanguages,
    };
    onSave(newSettings);

    // Enable/disable context menu
    if (enabled) {
      const { contextMenuService } = await import('../../services/contextMenuService');
      await contextMenuService.createMenus();
    } else {
      const { contextMenuService } = await import('../../services/contextMenuService');
      contextMenuService.destroy();
    }
  };

  // Toggle language
  const handleLanguageToggle = async (langId: string, checked: boolean) => {
    const newLanguages = checked
      ? [...ocrLanguages, langId]
      : ocrLanguages.filter(id => id !== langId);
    setOcrLanguages(newLanguages);
    onSave({ ocrEnabled, ocrLanguages: newLanguages });
  };

  // Download language pack
  const handleDownload = async (langId: string) => {
    setDownloading(langId);
    try {
      await ocrService.downloadLanguage(langId);
      setDownloadedLangs(prev => ({ ...prev, [langId]: true }));
      setDownloading(null);
    } catch (error) {
      console.error(`Failed to download ${langId}:`, error);
      setDownloading(null);
    }
  };

  // Styles
  const containerStyle: React.CSSProperties = {
    padding: '24px 0',
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

  const toggleStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  };

  const toggleSwitchStyle: React.CSSProperties = {
    position: 'relative' as const,
    width: 48,
    height: 26,
    backgroundColor: ocrEnabled ? '#8b5cf6' : '#e2e8f0',
    borderRadius: 13,
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  };

  const toggleKnobStyle: React.CSSProperties = {
    position: 'absolute' as const,
    top: 3,
    left: ocrEnabled ? 25 : 3,
    width: 20,
    height: 20,
    backgroundColor: 'white',
    borderRadius: '50%',
    transition: 'left 0.2s',
    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 15,
    fontWeight: 600,
    color: '#1e293b',
  };

  const hintStyle: React.CSSProperties = {
    fontSize: 13,
    color: '#64748b',
    marginTop: 6,
    lineHeight: 1.6,
    marginLeft: 60,
  };

  const langListStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    marginTop: 16,
  };

  const langItemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    padding: '14px 16px',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    border: '1px solid #e2e8f0',
  };

  const langCheckboxStyle: React.CSSProperties = {
    width: 20,
    height: 20,
    cursor: 'pointer',
    accentColor: '#8b5cf6',
    marginRight: 12,
  };

  const langInfoStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
  };

  const langNameStyle: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 500,
    color: '#334155',
  };

  const langSizeStyle: React.CSSProperties = {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  };

  const badgeStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 10px',
    backgroundColor: '#ecfdf5',
    color: '#059669',
    fontSize: 12,
    fontWeight: 500,
    borderRadius: 20,
  };

  const downloadBtnStyle: React.CSSProperties = {
    padding: '6px 14px',
    fontSize: 13,
    fontWeight: 500,
    color: 'white',
    backgroundColor: '#8b5cf6',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'all 0.2s',
  };

  const infoCardStyle: React.CSSProperties = {
    backgroundColor: '#f0f9ff',
    borderRadius: 12,
    padding: '16px 20px',
    marginTop: 24,
    border: '1px solid #bae6fd',
  };

  const infoTitleStyle: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 600,
    color: '#0369a1',
    marginBottom: 10,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  };

  const infoListStyle: React.CSSProperties = {
    margin: 0,
    paddingLeft: 20,
    fontSize: 13,
    color: '#0c4a6e',
    lineHeight: 1.8,
  };

  return (
    <div style={containerStyle}>
      {/* Title */}
      <div style={sectionTitleStyle}>
        <span style={{ fontSize: 18 }}>📷</span>
        图片文字识别
      </div>

      {/* Enable Toggle */}
      <div style={sectionStyle}>
        <div style={toggleStyle}>
          <div
            style={toggleSwitchStyle}
            onClick={() => handleToggleEnabled(!ocrEnabled)}
          >
            <div style={toggleKnobStyle} />
          </div>
          <span style={labelStyle}>启用图片识别</span>
        </div>
        <p style={hintStyle}>
          开启后，选中图片中的文字将自动显示翻译按钮<br />
          同时支持右键菜单操作图片（识别/翻译/解释）
        </p>
      </div>

      {/* Language Selection */}
      {ocrEnabled && (
        <div style={sectionStyle}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#334155', marginBottom: 8 }}>
            语言包管理
          </div>
          <p style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
            勾选需要的语言，插件将自动下载并缓存
          </p>

          <div style={langListStyle}>
            {languages.map(lang => {
              const isDownloaded = downloadedLangs[lang.id];
              const isDownloading = downloading === lang.id;
              const isChecked = ocrLanguages.includes(lang.id);

              return (
                <label key={lang.id} style={langItemStyle}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => handleLanguageToggle(lang.id, e.target.checked)}
                    style={langCheckboxStyle}
                  />
                  <div style={langInfoStyle}>
                    <span style={langNameStyle}>{lang.name}</span>
                    <span style={langSizeStyle}>{lang.size}</span>
                  </div>
                  {isDownloaded && (
                    <span style={badgeStyle}>✓ 已缓存</span>
                  )}
                  {!isDownloaded && (
                    <button
                      style={{
                        ...downloadBtnStyle,
                        opacity: isDownloading ? 0.7 : 1,
                        cursor: isDownloading ? 'not-allowed' : 'pointer',
                      }}
                      onClick={() => handleDownload(lang.id)}
                      disabled={isDownloading}
                    >
                      {isDownloading ? '下载中...' : '下载'}
                    </button>
                  )}
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Info Card */}
      <div style={infoCardStyle}>
        <div style={infoTitleStyle}>
          <span>💡</span>
          使用说明
        </div>
        <ul style={infoListStyle}>
          <li><strong>方案一：</strong>选中图片中的文字 → 自动显示OCR按钮 → 点击翻译/解释</li>
          <li><strong>方案二：</strong>右键点击图片 → Select AI → 选择操作</li>
          <li>首次使用会自动下载语言包，后续无需重复下载</li>
        </ul>
      </div>
    </div>
  );
};

export default OCRSettings;
