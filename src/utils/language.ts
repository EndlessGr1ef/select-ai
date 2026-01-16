// Detect whether the browser language is Chinese
export function isBrowserChinese(): boolean {
  const lang = navigator.language?.toLowerCase() || '';
  return lang.startsWith('zh');
}

// Get current UI language (Chinese or English)
export function getUILanguage(): 'zh' | 'en' {
  return isBrowserChinese() ? 'zh' : 'en';
}
