import { startTransition, useCallback } from 'react';
import { useNavigate, type NavigateOptions, type To } from 'react-router-dom';

/**
 * navigate envuelto en startTransition para evitar
 * "A component suspended while responding to synchronous input".
 */
export function useTransitionNavigate() {
  const navigate = useNavigate();

  return useCallback(
    (to: To, options?: NavigateOptions) => {
      startTransition(() => {
        navigate(to, options);
      });
    },
    [navigate]
  );
}

export function runTransition(fn: () => void): void {
  startTransition(fn);
}
