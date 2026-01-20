export interface PlaceholderTemplate {
  templateHTML: string;
  tokens: string[];
  originals: string[];
  plainText: string;
  translationInput: string;
}

export const buildPlaceholderTemplate = (originalHTML: string): PlaceholderTemplate | null => {
  if (!originalHTML.includes('<') || !originalHTML.includes('>')) {
    return null;
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(originalHTML, 'text/html');
    const tokens: string[] = [];
    const originals: string[] = [];
    let index = 0;

    const walker = document.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      const text = node.textContent || '';
      if (!text.trim()) {
        continue;
      }
      const token = `[[[T${index}]]]`;
      tokens.push(token);
      originals.push(text);
      node.textContent = token;
      index += 1;
    }

    if (tokens.length === 0) {
      return null;
    }

    const plainText = originals.join('');
    const translationInput = tokens.map((token, idx) => `${token}${originals[idx]}`).join('');
    return {
      templateHTML: doc.body.innerHTML,
      tokens,
      originals,
      plainText,
      translationInput
    };
  } catch {
    return null;
  }
};

export const parsePlaceholderSegments = (translatedText: string) => {
  const regex = /\[\[\[T(\d+)\]\]\]/g;
  const matches = Array.from(translatedText.matchAll(regex));
  const segments = new Map<number, { text: string; start: number; end: number }>();

  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i];
    const tokenIndex = Number(match[1]);
    const matchStart = match.index ?? 0;
    const segmentStart = matchStart + match[0].length;
    const nextMatch = matches[i + 1];
    const segmentEnd = nextMatch?.index ?? translatedText.length;
    segments.set(tokenIndex, {
      text: translatedText.slice(segmentStart, segmentEnd),
      start: segmentStart,
      end: segmentEnd
    });
  }

  const matchedIndices = matches.map(match => Number(match[1]));
  return { segments, matchedIndices };
};

export const applyPlaceholderTranslation = (
  template: PlaceholderTemplate,
  translatedText: string,
  parseMarkdown: (text: string) => string,
  options: { isFinal: boolean; fallbackToOriginal: boolean }
): string => {
  const { segments, matchedIndices } = parsePlaceholderSegments(translatedText);
  const validMatched = matchedIndices.filter(index => index >= 0 && index < template.tokens.length);

  if (validMatched.length === 0) {
    return parseMarkdown(translatedText);
  }

  // Sort segments by their position in the translated text to ensure correct order
  const sortedSegments = Array.from(segments.entries())
    .sort((a, b) => a[1].start - b[1].start);

  // Build the result by replacing tokens in order
  let result = template.templateHTML;
  const tokenReplacements: Map<string, string> = new Map();

  for (const [tokenIndex, segInfo] of sortedSegments) {
    const originalText = template.originals[tokenIndex];
    if (!originalText) continue;

    const translatedSegment = segInfo.text;
    const isComplete = options.isFinal || tokenIndex !== validMatched[validMatched.length - 1];

    // For inline translation, escape HTML but don't wrap in <p>
    // Just apply basic markdown inline formatting
    let replacement: string;
    if (!isComplete || !translatedSegment.trim()) {
      replacement = escapeHtml(originalText);
    } else {
      replacement = escapeHtml(translatedSegment);
    }

    // Apply inline markdown formatting only (no <p> wrapping)
    replacement = replacement
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-family: monospace;">$1</code>');

    tokenReplacements.set(template.tokens[tokenIndex], replacement);
  }

  // Apply replacements in reverse order (longer tokens first to avoid conflicts)
  const sortedTokens = Array.from(tokenReplacements.entries())
    .sort((a, b) => b[0].length - a[0].length);

  for (const [token, replacement] of sortedTokens) {
    result = result.split(token).join(replacement);
  }

  return result;
};

// Simple HTML escape function
const escapeHtml = (text: string): string => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
};
