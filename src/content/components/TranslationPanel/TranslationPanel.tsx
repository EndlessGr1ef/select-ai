import React from 'react';
import InlinePanel from './InlinePanel';
import BlockPanel from './BlockPanel';

export interface TranslationItem {
  id: string;
  element: Element;
  text: string;
  originalHTML?: string;
  useInlineMode: boolean;
  computedStyles: string;
}

interface TranslationPanelProps {
  items: TranslationItem[];
  translations: Record<string, string>;
  loadingText: string;
}

const TranslationPanel: React.FC<TranslationPanelProps> = ({
  items,
  translations,
  loadingText,
}) => {
  return (
    <>
      {items.map((item) => (
        item.useInlineMode ? (
          <InlinePanel
            key={item.id}
            id={item.id}
            text={translations[item.id] || ''}
            placeholder={item.originalHTML ? {
              templateHTML: '',
              tokens: [],
              originals: [],
              plainText: '',
              translationInput: '',
            } : undefined}
            inheritedStyles={item.computedStyles}
          />
        ) : (
          <BlockPanel
            key={item.id}
            id={item.id}
            text={translations[item.id] || ''}
            placeholder={item.originalHTML ? {
              templateHTML: '',
              tokens: [],
              originals: [],
              plainText: '',
              translationInput: '',
            } : undefined}
            inheritedStyles={item.computedStyles}
            loadingText={loadingText}
          />
        )
      ))}
    </>
  );
};

export default TranslationPanel;
