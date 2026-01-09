/**
 * ContextExtractor utility for retrieving text context around a selection.
 */
export class ContextExtractor {
  // Minimum context length to extract (in characters)
  private static MIN_CONTEXT_LENGTH = 500;
  // Maximum context length to prevent excessive data
  private static MAX_CONTEXT_LENGTH = 3000;

  /**
   * Extracts context around the current selection.
   * @param selection The current Selection object.
   * @returns A string containing the selection and surrounding context.
   */
  static getContext(selection: Selection): string {
    if (!selection || selection.rangeCount === 0) return '';

    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;

    // Start with the container element's text
    let contextElement: Node | null = container;
    
    // Walk up the DOM until we have enough context or hit the body
    while (
      contextElement && 
      contextElement.textContent && 
      contextElement.textContent.length < this.MIN_CONTEXT_LENGTH && 
      contextElement.parentElement && 
      contextElement.nodeName !== 'BODY'
    ) {
      contextElement = contextElement.parentElement;
    }

    let context = contextElement?.textContent?.trim() || '';
    
    // Truncate if too long, keeping content around the selection
    if (context.length > this.MAX_CONTEXT_LENGTH) {
      const selectedText = selection.toString();
      const selectionIndex = context.indexOf(selectedText);
      
      if (selectionIndex !== -1) {
        // Keep context centered around the selection
        const halfMax = Math.floor(this.MAX_CONTEXT_LENGTH / 2);
        const start = Math.max(0, selectionIndex - halfMax);
        const end = Math.min(context.length, selectionIndex + selectedText.length + halfMax);
        context = (start > 0 ? '...' : '') + context.substring(start, end) + (end < context.length ? '...' : '');
      } else {
        // Fallback: just take the first MAX_CONTEXT_LENGTH characters
        context = context.substring(0, this.MAX_CONTEXT_LENGTH) + '...';
      }
    }
    
    return context;
  }
}
