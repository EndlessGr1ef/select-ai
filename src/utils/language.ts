// Detect whether the browser language is Chinese
export function isBrowserChinese(): boolean {
  const lang = navigator.language?.toLowerCase() || '';
  return lang.startsWith('zh');
}

// Map target language to UI language
// Chinese -> zh, others (English/Japanese/Korean) -> en
export function mapTargetToUILanguage(targetLang: string): 'zh' | 'en' {
  return targetLang === '中文' ? 'zh' : 'en';
}

// Get stored UI language from chrome.storage.local
// Returns the stored language if available, otherwise null
export async function getStoredUILanguage(): Promise<'zh' | 'en' | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get(['uiLanguage'], (result) => {
      if (result.uiLanguage === 'zh' || result.uiLanguage === 'en') {
        resolve(result.uiLanguage);
      } else {
        resolve(null);
      }
    });
  });
}

// Get current UI language (Chinese or English)
// Priority: 1. User's stored preference (if they ever customized target language)
//           2. Browser language detection
export async function getUILanguage(): Promise<'zh' | 'en'> {
  const storedLang = await getStoredUILanguage();
  if (storedLang) {
    return storedLang;
  }
  return isBrowserChinese() ? 'zh' : 'en';
}

// Synchronous version for components that can't use async
// Falls back to browser language, actual stored preference will be applied on next render
export function getUILanguageSync(): 'zh' | 'en' {
  return isBrowserChinese() ? 'zh' : 'en';
}

// Detect text language based on character analysis
export function detectTextLanguage(text: string): 'zh' | 'en' | 'ja' {
  if (!text) return 'en';

  // High-priority detection: Japanese (Hiragana/Katakana)
  if (containsHiraganaOrKatakana(text)) return 'ja';

  const chineseChars = text.match(/[\u4e00-\u9fa5]/g);
  const chineseCount = chineseChars ? chineseChars.length : 0;
  const totalChars = text.length;

  // If text is very short (e.g., < 4 chars), and has ANY Chinese char, it's likely Chinese
  if (totalChars < 4 && chineseCount > 0) return 'zh';

  // For longer text, keep the 20% threshold
  return (chineseCount / totalChars) > 0.2 ? 'zh' : 'en';
}

export function containsHiraganaOrKatakana(text: string): boolean {
  return /[\u3040-\u30ff]/.test(text);
}

export function containsKanji(text: string): boolean {
  return /[\u3400-\u4dbf\u4e00-\u9fff]/.test(text);
}

export function isLikelyJapanese(text: string): boolean {
  return containsHiraganaOrKatakana(text);
}
