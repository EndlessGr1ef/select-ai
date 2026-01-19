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
  const segments = new Map<number, string>();

  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i];
    const tokenIndex = Number(match[1]);
    const matchStart = match.index ?? 0;
    const segmentStart = matchStart + match[0].length;
    const nextMatch = matches[i + 1];
    const segmentEnd = nextMatch?.index ?? translatedText.length;
    segments.set(tokenIndex, translatedText.slice(segmentStart, segmentEnd));
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

  const lastMatched = validMatched[validMatched.length - 1];
  let html = template.templateHTML;

  template.tokens.forEach((token, index) => {
    const segment = segments.get(index);
    const isComplete = options.isFinal || index !== lastMatched;
    const replacement = segment !== undefined && isComplete
      ? parseMarkdown(segment)
      : (options.fallbackToOriginal ? template.originals[index] : '');
    html = html.replaceAll(token, replacement);
  });

  return html;
};
