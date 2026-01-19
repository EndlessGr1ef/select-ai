import { useRef, useCallback } from 'react';

export const useAbortController = () => {
  const abortRef = useRef(false);

  const abort = useCallback(() => {
    abortRef.current = true;
  }, []);

  const reset = useCallback(() => {
    abortRef.current = false;
  }, []);

  return { abortRef, abort, reset };
};
