// Detect whether the browser language is Chinese
export function isBrowserChinese(): boolean {
  const lang = navigator.language?.toLowerCase() || '';
  return lang.startsWith('zh');
}

// Get current UI language (Chinese or English)
export function getUILanguage(): 'zh' | 'en' {
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
