import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { getUILanguage, isBrowserChinese } from '../../utils/language';

export type UILang = 'zh' | 'en';

interface PlaceholderTemplate {
  templateHTML: string;
  tokens: string[];
  originals: string[];
  plainText: string;
  translationInput: string;
}

interface TranslationCacheEntry {
  text: string;
  originalHTML?: string;
  placeholder?: PlaceholderTemplate;
}

interface TranslationContextType {
  targetLang: string;
  uiLang: UILang;
  isTranslating: boolean;
  isTranslated: boolean;
  translationButtonEnabled: boolean;
  translatedIds: Set<string>;
  translationCache: Map<string, TranslationCacheEntry>;
  abortRef: React.MutableRefObject<boolean>;

  setTargetLang: (lang: string) => void;
  setIsTranslating: (value: boolean) => void;
  setIsTranslated: (value: boolean) => void;
  setTranslationButtonEnabled: (value: boolean) => void;
  clearAllTranslations: () => void;
  abortTranslation: () => void;
}

const TranslationContext = createContext<TranslationContextType | null>(null);

export const useTranslation = () => {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error('useTranslation must be used within TranslationProvider');
  }
  return context;
};

interface TranslationProviderProps {
  children: React.ReactNode;
}

export const TranslationProvider: React.FC<TranslationProviderProps> = ({ children }) => {
  const [uiLang, setUiLang] = useState<UILang>('zh');
  const defaultTargetLang = isBrowserChinese() ? '中文' : 'English';
  const [targetLang, setTargetLang] = useState(defaultTargetLang);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isTranslated, setIsTranslated] = useState(false);
  const [translationButtonEnabled, setTranslationButtonEnabled] = useState(true);

  const translatedIdsRef = useRef(new Set<string>());
  const translationCacheRef = useRef(new Map<string, TranslationCacheEntry>());
  const abortRef = useRef(false);

  useEffect(() => {
    setUiLang(getUILanguage());
  }, []);

  useEffect(() => {
    const getTargetLang = async () => {
      const result = await chrome.storage.local.get(['targetLanguage', 'translationButtonEnabled']);
      setTargetLang((result.targetLanguage as string) || defaultTargetLang);
      setTranslationButtonEnabled(result.translationButtonEnabled !== false);
    };
    getTargetLang();

    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.targetLanguage) {
        setTargetLang((changes.targetLanguage.newValue as string) || defaultTargetLang);
      }
      if (changes.translationButtonEnabled) {
        setTranslationButtonEnabled(changes.translationButtonEnabled.newValue !== false);
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  const clearAllTranslations = useCallback(() => {
    translatedIdsRef.current.forEach(id => {
      const container = document.getElementById(id);
      if (container) {
        const parent = container.parentElement;
        if (parent) {
          parent.removeAttribute('data-select-ai-translated');
          parent.removeAttribute('data-select-ai-inline-mode');
        }
        container.remove();
      }
    });
    translatedIdsRef.current.clear();
    translationCacheRef.current.clear();
  }, []);

  const abortTranslation = useCallback(() => {
    abortRef.current = true;
    setIsTranslating(false);
  }, []);

  const value: TranslationContextType = {
    targetLang,
    uiLang,
    isTranslating,
    isTranslated,
    translationButtonEnabled,
    translatedIds: translatedIdsRef.current,
    translationCache: translationCacheRef.current,
    abortRef,

    setTargetLang,
    setIsTranslating,
    setIsTranslated,
    setTranslationButtonEnabled,
    clearAllTranslations,
    abortTranslation,
  };

  return (
    <TranslationContext.Provider value={value}>
      {children}
    </TranslationContext.Provider>
  );
};
