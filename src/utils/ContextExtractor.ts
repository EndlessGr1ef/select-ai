/**
 * ContextExtractor utility for retrieving text context around a selection.
 * Uses bidirectional DOM traversal to collect text evenly before and after the selection.
 */
export class ContextExtractor {
  // Default maximum context length (fallback)
  private static DEFAULT_MAX_CONTEXT_LENGTH = 3000;
  // Estimated system prompt length to reserve
  private static SYSTEM_PROMPT_RESERVE = 500;
  private static IGNORED_TAGS = new Set(['STYLE', 'SCRIPT', 'NOSCRIPT', 'SVG', 'PATH']);

  private static isLikelyCssText(text: string): boolean {
    if (text.length < 20) return false;
    if (/@(media|keyframes|font-face|supports)\b/i.test(text)) return true;
    if (/[.#][a-z0-9_-]+\s*\{/i.test(text)) return true;
    if (/[a-z-]+\s*:\s*[^;]+;/i.test(text) && text.includes('{') && text.includes('}')) return true;
    return false;
  }

  private static shouldIgnoreNode(node: Node): boolean {
    let current: Node | null = node;
    while (current && current !== document.body) {
      if (current.nodeType === Node.ELEMENT_NODE) {
        const tagName = (current as Element).tagName;
        if (this.IGNORED_TAGS.has(tagName)) return true;
      }
      current = current.parentNode;
    }
    return false;
  }

  private static cleanText(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
  }

  /**
   * Get all text nodes in the document using TreeWalker.
   */
  private static getAllTextNodes(root: Node): Text[] {
    const textNodes: Text[] = [];
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          if (this.shouldIgnoreNode(node)) return NodeFilter.FILTER_REJECT;
          const text = node.textContent?.trim();
          if (!text) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );
    
    let node: Node | null;
    while ((node = walker.nextNode())) {
      textNodes.push(node as Text);
    }
    return textNodes;
  }

  /**
   * Find the index of the text node containing the given node.
   */
  private static findTextNodeIndex(textNodes: Text[], targetNode: Node): number {
    // If target is a text node, find it directly
    if (targetNode.nodeType === Node.TEXT_NODE) {
      return textNodes.indexOf(targetNode as Text);
    }
    
    // If target is an element, find the first text node inside it
    for (let i = 0; i < textNodes.length; i++) {
      if (targetNode.contains(textNodes[i])) {
        return i;
      }
    }
    
    // Find the closest text node after the target
    const range = document.createRange();
    range.selectNode(targetNode);
    for (let i = 0; i < textNodes.length; i++) {
      const compareRange = document.createRange();
      compareRange.selectNode(textNodes[i]);
      if (range.compareBoundaryPoints(Range.START_TO_START, compareRange) <= 0) {
        return i;
      }
    }
    
    return -1;
  }

  /**
   * Collect text before the selection start.
   */
  private static collectTextBefore(
    textNodes: Text[],
    startNodeIndex: number,
    startNode: Node,
    startOffset: number,
    maxChars: number
  ): string {
    const parts: string[] = [];
    let totalLength = 0;

    // First, get partial text from the start node (before the selection)
    if (startNodeIndex >= 0 && startNodeIndex < textNodes.length) {
      const node = textNodes[startNodeIndex];
      if (node === startNode && startOffset > 0) {
        const text = node.textContent?.substring(0, startOffset) || '';
        const cleaned = this.cleanText(text);
        if (cleaned && !this.isLikelyCssText(cleaned)) {
          parts.unshift(cleaned);
          totalLength += cleaned.length;
        }
      }
    }

    // Then collect from previous text nodes
    for (let i = startNodeIndex - 1; i >= 0 && totalLength < maxChars; i--) {
      const text = textNodes[i].textContent || '';
      const cleaned = this.cleanText(text);
      
      if (cleaned && !this.isLikelyCssText(cleaned)) {
        const remaining = maxChars - totalLength;
        if (cleaned.length > remaining) {
          // Truncate from the start, keep the end
          parts.unshift('...' + cleaned.slice(-remaining));
          totalLength = maxChars;
          break;
        }
        parts.unshift(cleaned);
        totalLength += cleaned.length;
      }
    }

    return parts.join(' ');
  }

  /**
   * Collect text after the selection end.
   */
  private static collectTextAfter(
    textNodes: Text[],
    endNodeIndex: number,
    endNode: Node,
    endOffset: number,
    maxChars: number
  ): string {
    const parts: string[] = [];
    let totalLength = 0;

    // First, get partial text from the end node (after the selection)
    if (endNodeIndex >= 0 && endNodeIndex < textNodes.length) {
      const node = textNodes[endNodeIndex];
      if (node === endNode) {
        const fullText = node.textContent || '';
        if (endOffset < fullText.length) {
          const text = fullText.substring(endOffset);
          const cleaned = this.cleanText(text);
          if (cleaned && !this.isLikelyCssText(cleaned)) {
            parts.push(cleaned);
            totalLength += cleaned.length;
          }
        }
      }
    }

    // Then collect from following text nodes
    for (let i = endNodeIndex + 1; i < textNodes.length && totalLength < maxChars; i++) {
      const text = textNodes[i].textContent || '';
      const cleaned = this.cleanText(text);
      
      if (cleaned && !this.isLikelyCssText(cleaned)) {
        const remaining = maxChars - totalLength;
        if (cleaned.length > remaining) {
          // Truncate from the end
          parts.push(cleaned.slice(0, remaining) + '...');
          totalLength = maxChars;
          break;
        }
        parts.push(cleaned);
        totalLength += cleaned.length;
      }
    }

    return parts.join(' ');
  }

  /**
   * Extracts context around the current selection.
   * Collects text evenly before and after the selection.
   * @param selection The current Selection object.
   * @param maxContextTokens Optional maximum context length from user settings.
   *        If provided, the actual context length will be (maxContextTokens - systemPromptReserve) / 2 for each direction.
   * @returns A string containing the selection and surrounding context.
   */
  static getContext(selection: Selection, maxContextTokens?: number): string {
    if (!selection || selection.rangeCount === 0) return '';

    const range = selection.getRangeAt(0);
    const selectedText = selection.toString().trim();
    if (!selectedText) return '';

    // Get all text nodes in document body
    const textNodes = this.getAllTextNodes(document.body);
    if (textNodes.length === 0) return selectedText;

    // Find the text nodes at selection boundaries
    const startNodeIndex = this.findTextNodeIndex(textNodes, range.startContainer);
    const endNodeIndex = this.findTextNodeIndex(textNodes, range.endContainer);

    // Calculate maximum length for before/after context (evenly distributed)
    // Formula: (userMaxTokens - systemPromptReserve) / 2
    const effectiveMax = maxContextTokens 
      ? Math.max(200, maxContextTokens - this.SYSTEM_PROMPT_RESERVE)
      : this.DEFAULT_MAX_CONTEXT_LENGTH;
    const halfMax = Math.floor(effectiveMax / 2);

    // Collect text before the selection
    const textBefore = this.collectTextBefore(
      textNodes,
      startNodeIndex,
      range.startContainer,
      range.startOffset,
      halfMax
    );

    // Collect text after the selection
    const textAfter = this.collectTextAfter(
      textNodes,
      endNodeIndex,
      range.endContainer,
      range.endOffset,
      halfMax
    );

    // Combine the context
    const parts: string[] = [];
    if (textBefore) parts.push(textBefore);
    parts.push(selectedText);
    if (textAfter) parts.push(textAfter);

    return parts.join(' ').trim();
  }
}
