import { useCallback, type KeyboardEvent } from 'react';

export function useTextareaSubmit(
  value: string,
  onSubmit?: () => void,
  allowEmptySubmit = false
) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // Submit on Enter without Shift
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const form = e.currentTarget.closest('form');
        if (form && (value.trim() || allowEmptySubmit)) {
          if (onSubmit) {
            onSubmit();
          }
          // Try to find and click a submit button instead of using requestSubmit
          const submitButton = form.querySelector('button[type="submit"]') as HTMLButtonElement;
          if (submitButton) {
            submitButton.click();
          } else {
            form.requestSubmit();
          }
        }
      }
    },
    [value, onSubmit, allowEmptySubmit]
  );

  return handleKeyDown;
}