export const parseMarkdown = (text: string): string => {
  // Escape HTML first to prevent XSS
  let result = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Process inline Markdown syntax first (before handling newlines)
  result = result
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-family: monospace;">$1</code>');

  // Handle line breaks - preserve original formatting
  // Convert double newlines to paragraph breaks, single newlines to <br>
  result = result
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');

  // Don't wrap in paragraph tags - preserve the structure
  return result;
};
