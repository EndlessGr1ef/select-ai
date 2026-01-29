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

export interface TranslationCacheEntry {
  text: string;
  originalHTML?: string;
  placeholder?: PlaceholderTemplate;
}

// Single selection translation cache entry
interface SelectionCacheEntry {
  cache: Map<string, TranslationCacheEntry>;
  ids: Set<string>;
  timestamp: number;
}

// Translation mode
export type TranslationMode = 'none' | 'fullPage' | 'selection';

// Maximum number of selection caches to keep
const MAX_SELECTION_CACHES = 5;

interface TranslationContextType {
  targetLang: string;
  uiLang: UILang;
  isTranslating: boolean;
  translationButtonEnabled: boolean;
  abortRef: React.MutableRefObject<boolean>;

  // Current display state
  activeMode: TranslationMode;
  isShowingTranslation: boolean;

  // Full page translation
  fullPageCache: Map<string, TranslationCacheEntry>;
  fullPageIds: Set<string>;
  fullPageContentHash: string;

  // Selection translation (last 5)
  selectionCacheList: SelectionCacheEntry[];
  currentSelectionIndex: number;

  // Actions
  setTargetLang: (lang: string) => void;
  setIsTranslating: (value: boolean) => void;
  setTranslationButtonEnabled: (value: boolean) => void;
  abortTranslation: () => void;

  // Full page actions
  setFullPageContentHash: (hash: string) => void;
  clearFullPageTranslations: () => void;
  hideFullPageTranslations: () => void;
  showFullPageTranslations: () => void;

  // Selection actions
  addSelectionCache: () => { cache: Map<string, TranslationCacheEntry>; ids: Set<string> };
  clearSelectionTranslations: () => void;
  hideSelectionTranslations: () => void;
  showSelectionTranslations: () => void;

  // Mode control
  setActiveMode: (mode: TranslationMode) => void;
  setIsShowingTranslation: (value: boolean) => void;

  // Toggle visibility (for button click)
  toggleTranslationVisibility: () => void;

  // Legacy compatibility
  translatedIds: Set<string>;
  translationCache: Map<string, TranslationCacheEntry>;
  isTranslated: boolean;
  setIsTranslated: (value: boolean) => void;
  clearAllTranslations: () => void;
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

// Helper: Remove DOM elements by IDs and clean attributes
function removeDOMByIds(ids: Set<string>) {
  ids.forEach(id => {
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
}

// Helper: Hide DOM elements by IDs (keep in DOM)
function hideDOMByIds(ids: Set<string>) {
  ids.forEach(id => {
    const container = document.getElementById(id);
    if (container) {
      container.style.display = 'none';
      container.classList.remove('show');
    }
  });
}

// Helper: Show DOM elements by IDs
function showDOMByIds(ids: Set<string>) {
  ids.forEach(id => {
    const container = document.getElementById(id);
    if (container) {
      container.style.display = container.classList.contains('inline-mode') ? 'inline' : 'block';
      setTimeout(() => container.classList.add('show'), 10);
    }
  });
}

export const TranslationProvider: React.FC<TranslationProviderProps> = ({ children }) => {
  const [uiLang, setUiLang] = useState<UILang>('zh');
  const defaultTargetLang = isBrowserChinese() ? '中文' : 'English';
  const [targetLang, setTargetLang] = useState(defaultTargetLang);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationButtonEnabled, setTranslationButtonEnabled] = useState(true);

  // Current display state
  const [activeMode, setActiveMode] = useState<TranslationMode>('none');
  const [isShowingTranslation, setIsShowingTranslation] = useState(false);

  // Full page translation refs
  const fullPageCacheRef = useRef(new Map<string, TranslationCacheEntry>());
  const fullPageIdsRef = useRef(new Set<string>());
  const fullPageContentHashRef = useRef('');

  // Selection translation refs (last 5)
  const selectionCacheListRef = useRef<SelectionCacheEntry[]>([]);
  const currentSelectionIndexRef = useRef(-1);

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

  // Full page actions
  const setFullPageContentHash = useCallback((hash: string) => {
    fullPageContentHashRef.current = hash;
  }, []);

  const clearFullPageTranslations = useCallback(() => {
    removeDOMByIds(fullPageIdsRef.current);
    fullPageIdsRef.current.clear();
    fullPageCacheRef.current.clear();
    fullPageContentHashRef.current = '';
  }, []);

  const hideFullPageTranslations = useCallback(() => {
    hideDOMByIds(fullPageIdsRef.current);
  }, []);

  const showFullPageTranslations = useCallback(() => {
    showDOMByIds(fullPageIdsRef.current);
  }, []);

  // Selection actions
  const addSelectionCache = useCallback(() => {
    const newEntry: SelectionCacheEntry = {
      cache: new Map(),
      ids: new Set(),
      timestamp: Date.now(),
    };

    // Remove oldest if at capacity
    if (selectionCacheListRef.current.length >= MAX_SELECTION_CACHES) {
      const oldest = selectionCacheListRef.current.shift();
      if (oldest) {
        removeDOMByIds(oldest.ids);
      }
    }

    selectionCacheListRef.current.push(newEntry);
    currentSelectionIndexRef.current = selectionCacheListRef.current.length - 1;

    return { cache: newEntry.cache, ids: newEntry.ids };
  }, []);

  const clearSelectionTranslations = useCallback(() => {
    selectionCacheListRef.current.forEach(entry => {
      removeDOMByIds(entry.ids);
    });
    selectionCacheListRef.current = [];
    currentSelectionIndexRef.current = -1;
  }, []);

  const hideSelectionTranslations = useCallback(() => {
    selectionCacheListRef.current.forEach(entry => {
      hideDOMByIds(entry.ids);
    });
  }, []);

  const showSelectionTranslations = useCallback(() => {
    selectionCacheListRef.current.forEach(entry => {
      showDOMByIds(entry.ids);
    });
  }, []);

  // Toggle visibility for current mode
  const toggleTranslationVisibility = useCallback(() => {
    if (isShowingTranslation) {
      // Hide current translations
      if (activeMode === 'fullPage') {
        hideFullPageTranslations();
      } else if (activeMode === 'selection') {
        hideSelectionTranslations();
      }
      setIsShowingTranslation(false);
    } else {
      // Show current translations
      if (activeMode === 'fullPage') {
        showFullPageTranslations();
      } else if (activeMode === 'selection') {
        showSelectionTranslations();
      }
      setIsShowingTranslation(true);
    }
  }, [activeMode, isShowingTranslation, hideFullPageTranslations, hideSelectionTranslations, showFullPageTranslations, showSelectionTranslations]);

  const abortTranslation = useCallback(() => {
    abortRef.current = true;
    setIsTranslating(false);
  }, []);

  // Legacy: clearAllTranslations - clears everything
  const clearAllTranslations = useCallback(() => {
    clearFullPageTranslations();
    clearSelectionTranslations();
    setActiveMode('none');
    setIsShowingTranslation(false);
  }, [clearFullPageTranslations, clearSelectionTranslations]);

  // Legacy compatibility: return current active cache/ids
  const getCurrentCache = useCallback((): Map<string, TranslationCacheEntry> => {
    if (activeMode === 'fullPage') {
      return fullPageCacheRef.current;
    } else if (activeMode === 'selection' && currentSelectionIndexRef.current >= 0) {
      return selectionCacheListRef.current[currentSelectionIndexRef.current]?.cache || new Map();
    }
    return new Map();
  }, [activeMode]);

  const getCurrentIds = useCallback((): Set<string> => {
    if (activeMode === 'fullPage') {
      return fullPageIdsRef.current;
    } else if (activeMode === 'selection' && currentSelectionIndexRef.current >= 0) {
      return selectionCacheListRef.current[currentSelectionIndexRef.current]?.ids || new Set();
    }
    return new Set();
  }, [activeMode]);

  const value: TranslationContextType = {
    targetLang,
    uiLang,
    isTranslating,
    translationButtonEnabled,
    abortRef,

    // Current display state
    activeMode,
    isShowingTranslation,

    // Full page
    fullPageCache: fullPageCacheRef.current,
    fullPageIds: fullPageIdsRef.current,
    fullPageContentHash: fullPageContentHashRef.current,

    // Selection
    selectionCacheList: selectionCacheListRef.current,
    currentSelectionIndex: currentSelectionIndexRef.current,

    // Actions
    setTargetLang,
    setIsTranslating,
    setTranslationButtonEnabled,
    abortTranslation,

    // Full page actions
    setFullPageContentHash,
    clearFullPageTranslations,
    hideFullPageTranslations,
    showFullPageTranslations,

    // Selection actions
    addSelectionCache,
    clearSelectionTranslations,
    hideSelectionTranslations,
    showSelectionTranslations,

    // Mode control
    setActiveMode,
    setIsShowingTranslation,

    // Toggle
    toggleTranslationVisibility,

    // Legacy compatibility
    translatedIds: getCurrentIds(),
    translationCache: getCurrentCache(),
    isTranslated: isShowingTranslation,
    setIsTranslated: setIsShowingTranslation,
    clearAllTranslations,
  };

  return (
    <TranslationContext.Provider value={value}>
      {children}
    </TranslationContext.Provider>
  );
};
