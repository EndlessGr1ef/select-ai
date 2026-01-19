import { useRef, useCallback } from 'react';

interface StreamMessage {
  type: 'delta' | 'done' | 'error';
  data?: string;
  error?: string;
}

export interface TranslationStreamOptions {
  targetLang: string;
  uiLang: string;
  onDelta: (data: string) => void;
  onDone: (fullTranslation: string) => void;
  onError: (error: string) => void;
}

export const useTranslationStream = () => {
  const streamPortRef = useRef<chrome.runtime.Port | null>(null);

  const disconnect = useCallback(() => {
    if (streamPortRef.current) {
      streamPortRef.current.disconnect();
      streamPortRef.current = null;
    }
  }, []);

  const translate = useCallback(async (
    selection: string,
    options: TranslationStreamOptions
  ): Promise<void> => {
    const { targetLang, uiLang, onDelta, onDone, onError } = options;
    const payload = { selection, targetLang, uiLang };

    let port: chrome.runtime.Port | null = null;
    let connected = false;
    let resolved = false;
    let fullTranslation = '';

    const cleanup = () => {
      if (port) {
        try {
          port.onMessage.removeListener(messageHandler);
          port.onDisconnect.removeListener(disconnectHandler);
        } catch {
        }
      }
    };

    const disconnectHandler = () => {
      streamPortRef.current = null;
      cleanup();
      if (!resolved) {
        resolved = true;
        onDone(fullTranslation);
      }
    };

    const messageHandler = (message: StreamMessage) => {
      if (message.type === 'delta') {
        fullTranslation += message.data || '';
        onDelta(fullTranslation);
      } else if (message.type === 'done') {
        if (!resolved) {
          resolved = true;
          onDone(fullTranslation);
          cleanup();
          try {
            port?.disconnect();
          } catch {
          }
        }
      } else if (message.type === 'error') {
        if (!resolved) {
          resolved = true;
          cleanup();
          onError(message.error || 'Translation error');
          try {
            port?.disconnect();
          } catch {
          }
        }
      }
    };

    const tryConnect = (attempt: number): Promise<void> => {
      return new Promise((resolve) => {
        if (resolved || attempt > 3) {
          if (!resolved) {
            resolved = true;
            onError('Connection failed');
          }
          resolve();
          return;
        }

        try {
          if (!chrome.runtime?.id) {
            throw new Error('Extension context invalidated');
          }

          port = chrome.runtime.connect({ name: 'ai-translate-stream' });

          if (!port) {
            throw new Error('Port is null');
          }

          connected = true;
          streamPortRef.current = port;

          port.onMessage.addListener(messageHandler);
          port.onDisconnect.addListener(disconnectHandler);

          setTimeout(() => {
            if (!connected || !port || resolved) {
              return;
            }
            try {
              port.postMessage({ action: 'inlineTranslate', payload });
            } catch {
              cleanup();
              setTimeout(() => {
                if (!resolved) {
                  tryConnect(attempt + 1).then(resolve);
                }
              }, 50 * Math.pow(2, Math.min(attempt, 5)) + Math.random() * 50);
            }
          }, 10);
        } catch {
          cleanup();
          setTimeout(() => {
            if (!resolved) {
              tryConnect(attempt + 1).then(resolve);
            }
          }, 50 * Math.pow(2, Math.min(attempt, 5)) + Math.random() * 50);
        }
      });
    };

    return tryConnect(0);
  }, []);

  return { translate, disconnect, streamPortRef };
};
