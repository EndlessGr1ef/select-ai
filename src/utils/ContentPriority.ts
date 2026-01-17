/**
 * Main content priority detection utility
 * Used to detect the main reading area of the page and sort elements by priority
 */

export interface ContentRegion {
  element: Element;
  score: number;
  priority: number;
  boundingBox: DOMRect;
}

export interface ContentPriorityOptions {
  // Viewport center weight (0-1)
  centerWeight?: number;
  // Text density weight (0-1)
  densityWeight?: number;
  // Visibility weight (0-1)
  visibilityWeight?: number;
  // Minimum text length
  minTextLength?: number;
  // Maximum text length
  maxTextLength?: number;
}

const DEFAULT_OPTIONS: Required<ContentPriorityOptions> = {
  centerWeight: 0.4,
  densityWeight: 0.3,
  visibilityWeight: 0.3,
  minTextLength: 20,
  maxTextLength: 5000,
};

export class ContentPriority {
  /**
   * Main content container selector priorities (high to low)
   */
  private static readonly CONTENT_SELECTORS: { selector: string; priority: number }[] = [
    { selector: 'article', priority: 100 },
    { selector: '[role="main"]', priority: 95 },
    { selector: 'main', priority: 90 },
    { selector: '.blog-post', priority: 85 },
    { selector: '.post', priority: 82 },
    { selector: '.article', priority: 80 },
    { selector: '.entry', priority: 80 },
    { selector: '.documentation', priority: 85 },
    { selector: '.documentation-body', priority: 85 },
    { selector: '.docs-content', priority: 85 },
    { selector: '#main-content', priority: 88 },
    { selector: '#content', priority: 75 },
    { selector: '.main-content', priority: 82 },
    { selector: '.content-body', priority: 75 },
    { selector: '.content', priority: 70 },
    { selector: '.text-body', priority: 70 },
    { selector: '.post-content', priority: 78 },
    { selector: '.article-content', priority: 78 },
    { selector: '.story-body', priority: 75 },
    { selector: '.entry-content', priority: 75 },
  ];

  /**
   * Excluded non-main content element selectors
   */
  private static readonly EXCLUDE_SELECTORS: string[] = [
    'nav',
    'header',
    'footer',
    'aside',
    '.sidebar',
    '.menu',
    '.nav',
    '.navbar',
    '.advertisement',
    '.ad',
    '.ads',
    '.ads-banner',
    '.social-share',
    '.share-buttons',
    '.comments',
    '.comment-section',
    '.related-posts',
    '.related-articles',
    '.recommended',
    '.trending',
    '.popular',
    '.footer-content',
    '.header-content',
    '.sidebar-content',
    'script',
    'style',
    'noscript',
    'iframe',
    '.code-block',
    'pre',
    'code',
  ];

  /**
   * Detect and return the main content area with highest priority
   */
  static detectMainContent(
    options: ContentPriorityOptions = {}
  ): ContentRegion | null {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const candidates = this.findContentCandidates(opts);

    if (candidates.length === 0) return null;

    // Sort by priority and score
    const sorted = candidates.sort((a, b) => {
      // First by priority
      if (b.priority !== a.priority) return b.priority - a.priority;
      // Then by score
      return b.score - a.score;
    });

    return sorted[0];
  }

  /**
   * Find all elements that might be main content
   */
  private static findContentCandidates(
    options: Required<ContentPriorityOptions>
  ): ContentRegion[] {
    const candidates: ContentRegion[] = [];
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const viewportCenter = { x: viewportWidth / 2, y: viewportHeight / 2 };

    // Use CONTENT_SELECTORS to find
    for (const { selector, priority } of this.CONTENT_SELECTORS) {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        if (this.isExcluded(el) || !this.hasValidTextContent(el, options)) continue;

        const rect = el.getBoundingClientRect();
        const score = this.calculateContentScore(el, rect, viewportCenter, viewportHeight, options);

        candidates.push({
          element: el,
          score,
          priority,
          boundingBox: rect,
        });
      }
    }

    // If not found, use paragraph elements as candidates
    if (candidates.length === 0) {
      const paragraphs = document.querySelectorAll('p, h1, h2, h3, h4, li, td, th');
      for (const el of paragraphs) {
        if (this.isExcluded(el) || !this.hasValidTextContent(el, options)) continue;

        const rect = el.getBoundingClientRect();
        const score = this.calculateContentScore(el, rect, viewportCenter, viewportHeight, options);

        candidates.push({
          element: el,
          score,
          priority: 0,
          boundingBox: rect,
        });
      }
    }

    return candidates;
  }

  /**
   * Check if element should be excluded
   */
  static isExcluded(element: Element): boolean {
    // Check if element itself matches exclusion selectors
    for (const selector of this.EXCLUDE_SELECTORS) {
      if (element.matches(selector)) {
        return true;
      }
    }

    // Check if element's parent matches exclusion selectors
    for (const selector of this.EXCLUDE_SELECTORS) {
      if (element.closest(selector)) {
        return true;
      }
    }

    return false;
  }

  /**
   * 检查元素是否有有效的文本内容
   */
  private static hasValidTextContent(
    element: Element,
    options: Required<ContentPriorityOptions>
  ): boolean {
    const textLength = element.textContent?.trim().length || 0;
    return textLength >= options.minTextLength && textLength <= options.maxTextLength;
  }

  /**
   * Calculate content score (higher means more likely to be main content)
   */
  private static calculateContentScore(
    element: Element,
    rect: DOMRect,
    center: { x: number; y: number },
    viewportHeight: number,
    options: Required<ContentPriorityOptions>
  ): number {
    let score = 0;

    // 1. Visual position score: closer to viewport center = higher score
    const elementCenterY = rect.top + rect.height / 2;
    const distanceFromCenter = Math.abs(elementCenterY - center.y);
    const maxDistance = viewportHeight / 2;
    const positionScore = 1 - Math.min(distanceFromCenter / maxDistance, 1);
    score += positionScore * 100 * options.centerWeight;

    // 2. Text density score
    const textLength = element.textContent?.trim().length || 0;
    const area = Math.max(rect.width * rect.height, 1);
    const density = textLength / area;
    score += Math.min(density * 5, 50) * options.densityWeight;

    // 3. Element visibility score
    const visibleHeight = Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0);
    const visibleRatio = Math.max(rect.height, 1) > 0 ? visibleHeight / rect.height : 0;
    score += visibleRatio * 50 * options.visibilityWeight;

    // 4. Text length score (moderate length is better)
    if (textLength > 100 && textLength < 3000) {
      score += 20;
    } else if (textLength >= 50 && textLength <= 5000) {
      score += 10;
    }

    return score;
  }

  /**
   * Get selector priority
   */
  static getSelectorPriority(selector: string): number {
    const found = this.CONTENT_SELECTORS.find(s => s.selector === selector);
    return found?.priority ?? 50;
  }

  /**
   * Sort element list by main content priority
   */
  static sortByMainContentPriority(
    elements: Element[],
    options: ContentPriorityOptions = {}
  ): Element[] {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const viewportCenter = { x: viewportWidth / 2, y: viewportHeight / 2 };

    return [...elements].sort((a, b) => {
      const rectA = a.getBoundingClientRect();
      const rectB = b.getBoundingClientRect();

      const scoreA = this.calculateContentScore(a, rectA, viewportCenter, viewportHeight, opts);
      const scoreB = this.calculateContentScore(b, rectB, viewportCenter, viewportHeight, opts);

      // Prioritize elements in main content area
      const mainContent = this.detectMainContent(opts);
      if (mainContent) {
        const aInMain = mainContent.element.contains(a);
        const bInMain = mainContent.element.contains(b);
        if (aInMain && !bInMain) return -1;
        if (!aInMain && bInMain) return 1;
      }

      return scoreB - scoreA;
    });
  }

  /**
   * Check if element is within main content area
   */
  static isInMainContent(element: Element): boolean {
    const mainContent = this.detectMainContent();
    if (!mainContent) return false;

    return mainContent.element.contains(element);
  }

  /**
   * Get element's content type
   */
  static getElementContentType(element: Element): 'main' | 'navigation' | 'sidebar' | 'other' {
    // Check if it's main content
    if (this.isInMainContent(element)) {
      return 'main';
    }

    // Check if it's navigation
    if (element.matches('nav') || element.closest('nav')) {
      return 'navigation';
    }

    // Check if it's sidebar
    if (
      element.matches('.sidebar, aside') ||
      element.closest('.sidebar, aside')
    ) {
      return 'sidebar';
    }

    return 'other';
  }
}
