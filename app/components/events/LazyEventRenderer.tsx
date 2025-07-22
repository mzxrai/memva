import { useState, useEffect, useRef } from 'react';
import type { Event, PermissionRequest } from '../../db/schema';
import { EventRenderer } from './EventRenderer';

interface LazyEventRendererProps {
  event: Event;
  toolResults: Map<string, { result: unknown; isError?: boolean }>;
  permissions: Map<string, PermissionRequest>;
  onApprovePermission: (toolId: string) => void;
  onDenyPermission: (toolId: string) => void;
  onApprovePermissionWithSettings?: (id: string, permissionMode: 'default' | 'acceptEdits') => void;
  isProcessingPermission: boolean;
  isStreaming: boolean;
}

interface UserEventData {
  content?: string;
}

interface AssistantEventData {
  content?: string | Array<{ type: string; text?: string }>;
}

interface ToolUseEventData {
  name?: string;
}

// Extract text content for CTRL-F functionality
function getEventTextContent(event: Event): string {
  if (event.event_type === 'user') {
    const data = event.data as UserEventData;
    return data?.content || '';
  }
  
  if (event.event_type === 'assistant') {
    const data = event.data as AssistantEventData;
    if (data?.content) {
      if (typeof data.content === 'string') {
        return data.content;
      }
      if (Array.isArray(data.content)) {
        return data.content
          .filter((item) => item?.type === 'text')
          .map((item) => item.text || '')
          .join(' ');
      }
    }
  }
  
  if (event.event_type === 'tool_use') {
    const data = event.data as ToolUseEventData;
    return data?.name ? `Tool: ${data.name}` : '';
  }
  
  return '';
}

export function LazyEventRenderer(props: LazyEventRendererProps) {
  const [hasBeenVisible, setHasBeenVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasBeenVisible) {
          setHasBeenVisible(true);
        }
      },
      {
        // Start loading content before it's actually visible
        rootMargin: '200px 0px',
        threshold: 0
      }
    );
    
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    
    return () => {
      observer.disconnect();
    };
  }, [hasBeenVisible]);
  
  const textContent = getEventTextContent(props.event);
  
  return (
    <div 
      ref={containerRef}
      className="message-container"
      // Minimum height to prevent layout shift
      style={{ minHeight: '60px' }}
    >
      {hasBeenVisible ? (
        <EventRenderer {...props} />
      ) : (
        // Minimal render for CTRL-F - just the text content
        <div className="p-4 text-zinc-500 text-sm">
          {textContent ? (
            <span className="sr-only">{textContent}</span>
          ) : (
            <span className="opacity-0">Loading...</span>
          )}
        </div>
      )}
    </div>
  );
}