import { SiteBlacklist } from '../../utils/SiteBlacklist';

const INLINE_DISPLAY_THRESHOLD = 100;

const TEXT_SELECTORS = [
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li',
  'td', 'th', 'dd', 'dt', 'blockquote', 'a'
].join(',');

export const getTextSelectors = (): string => TEXT_SELECTORS;

export const hasNestedList = (element: Element): boolean => {
  return element.querySelector('ul, ol') !== null;
};

export const getDirectTextContent = (element: Element): string => {
  let text = '';
  for (const node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent || '';
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      const tagName = el.tagName.toLowerCase();
      if (['span', 'a', 'strong', 'b', 'em', 'i', 'code'].includes(tagName)) {
        const outerHTML = el.outerHTML;
        text += outerHTML;
      } else {
        text += el.textContent || '';
      }
    }
  }
  return text.trim();
};

export const shouldUseInlineMode = (element: Element, text: string): boolean => {
  if (text.length > INLINE_DISPLAY_THRESHOLD) return false;

  const tagName = element.tagName.toLowerCase();
  const inlineSuitableTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'dt', 'th', 'td', 'a'];
  if (!inlineSuitableTags.includes(tagName)) return false;

  const rect = element.getBoundingClientRect();
  const parentWidth = element.parentElement?.getBoundingClientRect().width || window.innerWidth;
  const estimatedTranslationWidth = rect.width * 0.9;
  const availableWidth = parentWidth - rect.width;

  return availableWidth >= parentWidth * 0.25 || availableWidth >= estimatedTranslationWidth + 40;
};

export interface ElementEligibilityOptions {
  blacklist?: SiteBlacklist;
  isBlacklistEnabled?: boolean;
}

export const isElementEligible = (
  element: Element,
  options: ElementEligibilityOptions = {}
): boolean => {
  const { blacklist, isBlacklistEnabled = true } = options;

  if (isBlacklistEnabled && blacklist?.isElementBlocked(element)) return false;
  if (element.hasAttribute('data-select-ai-translated')) return false;
  if (element.closest('[data-select-ai-translated]')) return false;

  const tagName = element.tagName.toLowerCase();
  if (tagName === 'li' && hasNestedList(element)) {
    const directText = getDirectTextContent(element);
    if (!directText) return false;
  }

  const text = element.textContent?.trim() || '';
  if (!text || text.length === 0 || text.length >= 5000) return false;
  if (element.querySelector('script, style')) return false;

  const isPureNumeric = /^[\d\s.,\-+=%$¥€£()[\]]+$/.test(text);
  if (isPureNumeric) return false;

  return true;
};

export interface ElementTranslationItem {
  element: Element;
  id: string;
  text: string;
  originalHTML?: string;
  useInlineMode: boolean;
}

export const prepareTranslationItems = (
  elements: Element[]
): ElementTranslationItem[] => {
  const items: ElementTranslationItem[] = [];

  for (const element of elements) {
    const id = `translation-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    const tagName = element.tagName.toLowerCase();
    const hasNested = tagName === 'li' && hasNestedList(element);
    const text = hasNested ? getDirectTextContent(element) : (element.textContent?.trim() || '');

    let originalHTML: string | undefined;
    if (hasNested) {
      originalHTML = getDirectTextContent(element);
    } else {
      const hasSpanChild = element.querySelector('span');
      if (hasSpanChild) {
        originalHTML = getDirectTextContent(element);
      }
    }

    if (!text) continue;

    items.push({
      element,
      id,
      text,
      originalHTML,
      useInlineMode: shouldUseInlineMode(element, text),
    });
  }

  return items;
};

export const filterVisibleElements = (elements: Element[]): Element[] => {
  const filteredElements: Element[] = [];
  for (const el of elements) {
    const hasVisibleChildInList = elements.some(otherEl =>
      otherEl !== el && el.contains(otherEl)
    );
    if (!hasVisibleChildInList) {
      filteredElements.push(el);
    }
  }
  return filteredElements;
};
