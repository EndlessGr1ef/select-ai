// 检测浏览器语言是否是中文
export function isBrowserChinese(): boolean {
  const lang = navigator.language?.toLowerCase() || '';
  return lang.startsWith('zh');
}

// 获取当前界面语言（中文或英文）
export function getUILanguage(): 'zh' | 'en' {
  return isBrowserChinese() ? 'zh' : 'en';
}
