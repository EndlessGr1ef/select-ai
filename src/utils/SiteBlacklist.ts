/**
 * CSS selector blacklist utility
 * Uses system preset blacklist, no user configuration needed
 */

// System preset blacklist selectors (commonly excluded areas)
const PRESET_BLACKLIST_SELECTORS = [
  'header', 'footer', 'nav', 'aside',
  '.sidebar', '.side-bar',
  '.menu', '.nav', '.navigation',
  '.header', '.footer', '.topbar', '.toolbar',
  '.advertisement', '.ad', '.ads', '.ad-banner',
  '.sponsor', '.promo',
  '.breadcrumb', '.pagination', '.widget',
];

export class SiteBlacklist {
  /**
   * 加载黑名单（预设，无需从存储加载）
   */
  async load(): Promise<void> {
    // Use preset blacklist, no need to load
  }

  /**
   * 检查是否启用了黑名单
   */
  async isBlacklistEnabled(): Promise<boolean> {
    return new Promise((resolve) => {
      chrome.storage.local.get(['translationBlacklistEnabled'], (result) => {
        // Default to true if not set
        resolve(result.translationBlacklistEnabled !== false);
      });
    });
  }

  /**
   * 检查元素是否匹配任何黑名单选择器
   * @param element 要检查的元素
   * @param checkParents 是否也检查父元素（默认true）
   * @returns 是否匹配黑名单
   */
  isElementBlocked(element: Element, checkParents: boolean = true): boolean {
    // Check current element
    if (this.matchesAnySelector(element)) {
      return true;
    }

    // Traverse up to check parent elements
    if (checkParents) {
      let parent: Element | null = element.parentElement;
      while (parent) {
        if (this.matchesAnySelector(parent)) {
          return true;
        }
        parent = parent.parentElement;
      }
    }

    return false;
  }

  /**
   * Check if element matches any selector in preset blacklist
   */
  private matchesAnySelector(element: Element): boolean {
    for (const selector of PRESET_BLACKLIST_SELECTORS) {
      try {
        if (element.matches(selector)) {
          return true;
        }
      } catch (error) {
        // Ignore invalid selectors
      }
    }
    return false;
  }
}
