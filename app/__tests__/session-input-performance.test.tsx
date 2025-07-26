import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SessionInput } from '../components/SessionInput';
import { createBrowserRouter, RouterProvider } from 'react-router';

describe('SessionInput Performance', () => {
  let mockOnPromptChange: ReturnType<typeof vi.fn>;
  let mockOnSubmit: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnPromptChange = vi.fn();
    mockOnSubmit = vi.fn();
  });

  const renderWithRouter = (component: React.ReactElement) => {
    const router = createBrowserRouter([
      {
        path: '/',
        element: component,
      },
    ]);
    return render(<RouterProvider router={router} />);
  };

  it('should update textarea value immediately without lag', () => {
    renderWithRouter(
      <SessionInput
        prompt=""
        onPromptChange={mockOnPromptChange}
        images={[]}
        isDisabled={false}
        placeholderText="Type a message..."
        onSubmit={mockOnSubmit}
      />
    );

    const textarea = screen.getByRole('textbox');
    
    // Type multiple characters rapidly
    const testText = 'Hello world!';
    for (const char of testText) {
      fireEvent.change(textarea, { 
        target: { value: textarea.getAttribute('value') + char } 
      });
    }

    // Ensure onChange was called for each character
    expect(mockOnPromptChange).toHaveBeenCalledTimes(testText.length);
  });

  it('should call onChange handler immediately when typing', () => {
    renderWithRouter(
      <SessionInput
        prompt=""
        onPromptChange={mockOnPromptChange}
        images={[]}
        isDisabled={false}
        placeholderText="Type a message..."
        onSubmit={mockOnSubmit}
      />
    );

    const textarea = screen.getByRole('textbox');
    
    // Type a character
    fireEvent.change(textarea, { target: { value: 'H' } });
    
    // onChange should be called immediately
    expect(mockOnPromptChange).toHaveBeenCalledWith('H');
    expect(mockOnPromptChange).toHaveBeenCalledTimes(1);
  });

  it('should handle rapid typing without dropping characters', () => {
    const { rerender } = renderWithRouter(
      <SessionInput
        prompt=""
        onPromptChange={mockOnPromptChange}
        images={[]}
        isDisabled={false}
        placeholderText="Type a message..."
        onSubmit={mockOnSubmit}
      />
    );

    const textarea = screen.getByRole('textbox');
    const rapidText = 'The quick brown fox jumps over the lazy dog';
    
    // Simulate rapid typing
    rapidText.split('').forEach((char, index) => {
      const currentValue = rapidText.substring(0, index + 1);
      fireEvent.change(textarea, { target: { value: currentValue } });
      
      // Update the component with new prompt value
      rerender(
        <RouterProvider router={createBrowserRouter([{
          path: '/',
          element: (
            <SessionInput
              prompt={currentValue}
              onPromptChange={mockOnPromptChange}
              images={[]}
              isDisabled={false}
              placeholderText="Type a message..."
              onSubmit={mockOnSubmit}
            />
          )
        }])} />
      );
    });

    // Verify all characters were processed
    expect(mockOnPromptChange).toHaveBeenCalledTimes(rapidText.length);
    expect(mockOnPromptChange).toHaveBeenLastCalledWith(rapidText);
  });

  it('should call resize function on content change', async () => {
    const { rerender } = renderWithRouter(
      <SessionInput
        prompt=""
        onPromptChange={mockOnPromptChange}
        images={[]}
        isDisabled={false}
        placeholderText="Type a message..."
        onSubmit={mockOnSubmit}
      />
    );

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;

    // Add multiline text
    const multilineText = 'Line 1\nLine 2\nLine 3';
    fireEvent.change(textarea, { target: { value: multilineText } });

    // Verify onChange was called
    expect(mockOnPromptChange).toHaveBeenCalledWith(multilineText);

    // Re-render with new prompt value
    rerender(
      <RouterProvider router={createBrowserRouter([{
        path: '/',
        element: (
          <SessionInput
            prompt={multilineText}
            onPromptChange={mockOnPromptChange}
            images={[]}
            isDisabled={false}
            placeholderText="Type a message..."
            onSubmit={mockOnSubmit}
          />
        )
      }])} />
    );

    // Wait for next animation frame (our optimization uses requestAnimationFrame)
    await new Promise(resolve => requestAnimationFrame(resolve));

    // Textarea should have adjusted its height (style will be set by useAutoResizeTextarea)
    expect(textarea.style.height).toBeTruthy();
  });
});