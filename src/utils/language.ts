// Detect whether the browser language is Chinese
export function isBrowserChinese(): boolean {
  const lang = navigator.language?.toLowerCase() || '';
  return lang.startsWith('zh');
}

// Get current UI language (Chinese or English)
export function getUILanguage(): 'zh' | 'en' {
  return isBrowserChinese() ? 'zh' : 'en';
}

// Detect text language based on Chinese character ratio
export function detectTextLanguage(text: string): 'zh' | 'en' {
  const chineseChars = text.match(/[\u4e00-\u9fa5]/g);
  const chineseCount = chineseChars ? chineseChars.length : 0;
  const totalChars = text.length;
  // If Chinese characters exceed 20%, consider it Chinese
  return (chineseCount / totalChars) > 0.2 ? 'zh' : 'en';
}
