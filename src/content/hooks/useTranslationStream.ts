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
    let currentAttempt = 0;

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
      // Only handle disconnect if this is the current attempt and not resolved
      if (!resolved) {
        resolved = true;
        // Only call onDone if this was a successful connection that got interrupted
        // If we haven't successfully connected yet (connected === false), treat as error
        if (connected) {
          onDone(fullTranslation);
        } else {
          onError('Connection failed');
        }
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

    return new Promise((resolve) => {
      const tryConnectWithResolve = (attempt: number) => {
        // Use currentAttempt to track the latest attempt number
        currentAttempt = attempt;

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

          // Disconnect any existing port before creating a new one
          if (port) {
            try {
              port.disconnect();
            } catch {
            }
            port = null;
          }

          port = chrome.runtime.connect({ name: 'ai-translate-stream' });

          if (!port) {
            throw new Error('Port is null');
          }

          connected = true;
          streamPortRef.current = port;

          // Define local handlers that capture resolve
          const localMessageHandler = (message: StreamMessage) => {
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
                resolve();
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
                resolve();
              }
            }
          };

          const localDisconnectHandler = () => {
            streamPortRef.current = null;
            cleanup();
            if (!resolved) {
              resolved = true;
              if (connected) {
                onDone(fullTranslation);
              } else {
                onError('Connection failed');
              }
              resolve();
            }
          };

          // Override cleanup to use local listeners
          const localCleanup = () => {
            if (port) {
              try {
                port.onMessage.removeListener(localMessageHandler);
                port.onDisconnect.removeListener(localDisconnectHandler);
              } catch {
              }
            }
          };

          port.onMessage.addListener(localMessageHandler);
          port.onDisconnect.addListener(localDisconnectHandler);

          setTimeout(() => {
            // Check if this is still the current attempt and conditions are met
            if (!connected || !port || resolved || currentAttempt !== attempt) {
              return;
            }
            try {
              port.postMessage({ action: 'inlineTranslate', payload });
              // We DO NOT resolve here anymore. We wait for localMessageHandler or localDisconnectHandler.
            } catch {
              localCleanup();
              setTimeout(() => {
                if (!resolved && currentAttempt === attempt) {
                  tryConnectWithResolve(attempt + 1);
                } else {
                  resolve();
                }
              }, 50 * Math.pow(2, Math.min(attempt, 5)) + Math.random() * 50);
            }
          }, 10);
        } catch {
          cleanup();
          setTimeout(() => {
            if (!resolved && currentAttempt === attempt) {
              tryConnectWithResolve(attempt + 1);
            } else {
              resolve();
            }
          }, 50 * Math.pow(2, Math.min(attempt, 5)) + Math.random() * 50);
        }
      };

      tryConnectWithResolve(0);
    });
  }, []);

  return { translate, disconnect, streamPortRef };
};
