import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';
import { useAutoResizeTextarea } from './useAutoResizeTextarea';

describe('useAutoResizeTextarea', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should debounce height adjustments when value changes', () => {
    const mockTextarea = {
      style: { height: '', overflowY: '' },
      scrollHeight: 100,
    } as HTMLTextAreaElement;

    // Mock getComputedStyle
    window.getComputedStyle = vi.fn().mockReturnValue({
      lineHeight: '20px',
    });

    const { result, rerender } = renderHook(
      ({ value }) => useAutoResizeTextarea(value),
      {
        initialProps: { value: 'initial text' },
      }
    );

    // Manually set the ref
    (result.current.textareaRef as any).current = mockTextarea;

    // Change value multiple times rapidly
    rerender({ value: 'updated text' });
    rerender({ value: 'updated text again' });
    rerender({ value: 'updated text once more' });

    // Height should not have been adjusted yet (debounced)
    expect(mockTextarea.style.height).toBe('');

    // Fast-forward time by 100ms
    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Now height should be adjusted
    expect(mockTextarea.style.height).toBe('100px');
  });

  it('should adjust height immediately on mount', () => {
    const mockTextarea = {
      style: { height: '', overflowY: '' },
      scrollHeight: 60,
    } as HTMLTextAreaElement;

    window.getComputedStyle = vi.fn().mockReturnValue({
      lineHeight: '20px',
    });

    const { result } = renderHook(() => useAutoResizeTextarea('test'));

    // Manually set the ref
    (result.current.textareaRef as any).current = mockTextarea;

    // Trigger mount effect
    act(() => {
      result.current.adjustHeight();
    });

    // Height should be adjusted immediately on mount
    expect(mockTextarea.style.height).toBe('60px');
  });

  it('should respect maxRows option', () => {
    const mockTextarea = {
      style: { height: '', overflowY: '' },
      scrollHeight: 200, // Would be 10 rows
    } as HTMLTextAreaElement;

    window.getComputedStyle = vi.fn().mockReturnValue({
      lineHeight: '20px',
    });

    const { result } = renderHook(() => 
      useAutoResizeTextarea('long text', { maxRows: 5 })
    );

    // Manually set the ref
    (result.current.textareaRef as any).current = mockTextarea;

    act(() => {
      result.current.adjustHeight();
    });

    // Height should be clamped to maxRows * lineHeight
    expect(mockTextarea.style.height).toBe('100px'); // 5 * 20px
    expect(mockTextarea.style.overflowY).toBe('auto');
  });
});