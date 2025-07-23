import { useCallback, useEffect, useRef } from 'react';

interface UseAutoResizeTextareaOptions {
  maxRows?: number;
  minRows?: number;
}

export function useAutoResizeTextarea(
  value: string,
  options: UseAutoResizeTextareaOptions = {}
) {
  const { maxRows = 5, minRows = 1 } = options;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';

    // Calculate the height based on content
    const scrollHeight = textarea.scrollHeight;
    const lineHeight = parseInt(window.getComputedStyle(textarea).lineHeight);

    const minHeight = lineHeight * minRows;
    const maxHeight = lineHeight * maxRows;

    // Set the height, clamped between min and max
    const newHeight = Math.max(minHeight, Math.min(scrollHeight, maxHeight));
    textarea.style.height = `${newHeight}px`;

    // Add or remove scrollbar based on content
    textarea.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [maxRows, minRows]);

  // Debounced height adjustment when value changes
  useEffect(() => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set a new timeout to adjust height after user stops typing
    timeoutRef.current = setTimeout(() => {
      adjustHeight();
    }, 100); // 100ms debounce

    // Cleanup timeout on unmount or value change
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, adjustHeight]);

  // Adjust height on mount (no debounce needed)
  useEffect(() => {
    adjustHeight();
  }, [adjustHeight]);

  return { textareaRef, adjustHeight };
}