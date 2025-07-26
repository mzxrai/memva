import React, { memo, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Form } from 'react-router';
import { useAutoResizeTextarea } from '../hooks/useAutoResizeTextarea';
import { useTextareaSubmit } from '../hooks/useTextareaSubmit';
type ImageFile = {
  id: string;
  file: File;
  preview: string;
};

interface SessionInputProps {
  prompt: string;
  onPromptChange: (value: string) => void;
  images: ImageFile[];
  isDisabled: boolean;
  placeholderText: string;
  onSubmit?: () => void;
}

export interface SessionInputHandle {
  focus: () => void;
}

export const SessionInput = memo(forwardRef<SessionInputHandle, SessionInputProps>(function SessionInput({
  prompt,
  onPromptChange,
  images,
  isDisabled,
  placeholderText,
  onSubmit
}, ref) {
  const { textareaRef } = useAutoResizeTextarea(prompt, { maxRows: 5 });
  const handleTextareaKeyDown = useTextareaSubmit(prompt, onSubmit, images.length > 0);
  
  useImperativeHandle(ref, () => ({
    focus: () => {
      textareaRef.current?.focus();
    }
  }), []);
  
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onPromptChange(e.target.value);
  }, [onPromptChange]);

  return (
    <Form 
      method="post" 
      className="flex-1"
      onSubmit={(e) => {
        const message = prompt.trim();
        const hasImages = images.length > 0;
        
        // Check if textarea is disabled - if so, prevent submit
        if (isDisabled) {
          e.preventDefault();
          return;
        }
        
        // Prevent submit if no content
        if (!message && !hasImages) {
          e.preventDefault();
        }
        
        onSubmit?.();
      }}
    >
      <div className="flex items-start px-5 py-3.5 bg-zinc-800/60 border border-zinc-700/50 rounded-xl focus-within:border-zinc-600 focus-within:bg-zinc-800/80 transition-colors duration-200">
        <span className="text-zinc-500 font-mono mr-4 select-none">{'>'}</span>
        <textarea
          ref={textareaRef}
          name="prompt"
          value={prompt}
          onChange={handleChange}
          onKeyDown={handleTextareaKeyDown}
          disabled={isDisabled}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
          rows={1}
          className="flex-1 bg-transparent text-zinc-100 focus:outline-none disabled:opacity-50 font-mono text-[0.9375rem] resize-none leading-normal"
          role="textbox"
          placeholder={placeholderText}
          style={{ overflowY: 'hidden' }}
        />
      </div>
      
      {/* Hidden inputs for image data */}
      {images.map((image, index) => (
        <div key={image.id}>
          <input
            type="hidden"
            name={`image-data-${index}`}
            value={image.preview}
          />
          <input
            type="hidden"
            name={`image-name-${index}`}
            value={image.file.name}
          />
        </div>
      ))}
      
      {/* Hidden submit button for Enter key handling */}
      <button type="submit" style={{ display: 'none' }} aria-hidden="true">Submit</button>
    </Form>
  );
}));