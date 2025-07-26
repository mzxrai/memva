import { memo, useMemo } from 'react';
import type { Event, PermissionRequest } from '../../db/schema';
import { LazyEventRenderer } from './LazyEventRenderer';
import { ContextLimitNotification } from './ContextLimitNotification';

interface EventListProps {
  displayEvents: Event[];
  toolResults: Map<string, { result: unknown; isError?: boolean }>;
  permissionsByToolId: Map<string, PermissionRequest>;
  onApprovePermission: (toolId: string) => void;
  onDenyPermission: (toolId: string) => void;
  onApprovePermissionWithSettings?: (id: string, permissionMode: 'default' | 'acceptEdits') => void;
  isProcessingPermission: boolean;
}

export const EventList = memo(function EventList({
  displayEvents,
  toolResults,
  permissionsByToolId,
  onApprovePermission,
  onDenyPermission,
  onApprovePermissionWithSettings,
  isProcessingPermission
}: EventListProps) {
  // Process events to consolidate context limit notifications
  const processedEvents = useMemo(() => {
    const result: Array<{ type: 'event'; event: Event } | { type: 'contextLimit'; event: Event; status: 'warning' | 'summarizing' | 'complete'; summaryContent?: string; summarizedEventCount?: number }> = [];
    let contextLimitGroup: Event[] = [];
    
    for (const event of displayEvents) {
      // Check if this is a context limit related event
      const isContextLimitEvent = event.event_type === 'system' && 
        event.data && typeof event.data === 'object' && 'subtype' in event.data &&
        ['prompt_too_long', 'context_limit_reached', 'summarizing_context', 'context_summary'].includes(event.data.subtype as string);
      
      if (isContextLimitEvent) {
        contextLimitGroup.push(event);
      } else {
        // If we have a context limit group, process it
        if (contextLimitGroup.length > 0) {
          const firstEvent = contextLimitGroup[0];
          const summaryEvent = contextLimitGroup.find(e => 
            e.data && typeof e.data === 'object' && 'subtype' in e.data && e.data.subtype === 'context_summary'
          );
          const isSummarizing = contextLimitGroup.some(e => 
            e.data && typeof e.data === 'object' && 'subtype' in e.data && e.data.subtype === 'summarizing_context'
          );
          
          let status: 'warning' | 'summarizing' | 'complete' = 'warning';
          if (summaryEvent) {
            status = 'complete';
          } else if (isSummarizing) {
            status = 'summarizing';
          }
          
          let summaryContent: string | undefined;
          let summarizedEventCount: number | undefined;
          
          if (summaryEvent && summaryEvent.data && typeof summaryEvent.data === 'object') {
            if ('content' in summaryEvent.data && typeof summaryEvent.data.content === 'string') {
              summaryContent = summaryEvent.data.content;
            }
            if ('metadata' in summaryEvent.data && typeof summaryEvent.data.metadata === 'object' && 
                summaryEvent.data.metadata && 'summarized_event_count' in summaryEvent.data.metadata) {
              summarizedEventCount = summaryEvent.data.metadata.summarized_event_count as number;
            }
          }
          
          result.push({
            type: 'contextLimit',
            event: firstEvent,
            status,
            summaryContent,
            summarizedEventCount
          });
          
          contextLimitGroup = [];
        }
        
        // Add the regular event
        result.push({ type: 'event', event });
      }
    }
    
    // Handle any remaining context limit group
    if (contextLimitGroup.length > 0) {
      const firstEvent = contextLimitGroup[0];
      const summaryEvent = contextLimitGroup.find(e => 
        e.data && typeof e.data === 'object' && 'subtype' in e.data && e.data.subtype === 'context_summary'
      );
      const isSummarizing = contextLimitGroup.some(e => 
        e.data && typeof e.data === 'object' && 'subtype' in e.data && e.data.subtype === 'summarizing_context'
      );
      
      let status: 'warning' | 'summarizing' | 'complete' = 'warning';
      if (summaryEvent) {
        status = 'complete';
      } else if (isSummarizing) {
        status = 'summarizing';
      }
      
      let summaryContent: string | undefined;
      let summarizedEventCount: number | undefined;
      
      if (summaryEvent && summaryEvent.data && typeof summaryEvent.data === 'object') {
        if ('content' in summaryEvent.data && typeof summaryEvent.data.content === 'string') {
          summaryContent = summaryEvent.data.content;
        }
        if ('metadata' in summaryEvent.data && typeof summaryEvent.data.metadata === 'object' && 
            summaryEvent.data.metadata && 'summarized_event_count' in summaryEvent.data.metadata) {
          summarizedEventCount = summaryEvent.data.metadata.summarized_event_count as number;
        }
      }
      
      result.push({
        type: 'contextLimit',
        event: firstEvent,
        status,
        summaryContent,
        summarizedEventCount
      });
    }
    
    return result;
  }, [displayEvents]);
  
  return (
    <>
      {processedEvents.map((item) => {
        if (item.type === 'contextLimit') {
          return (
            <ContextLimitNotification
              key={item.event.uuid}
              event={item.event}
              status={item.status}
              summaryContent={item.summaryContent}
              summarizedEventCount={item.summarizedEventCount}
            />
          );
        } else {
          return (
            <LazyEventRenderer
              key={item.event.uuid}
              event={item.event}
              toolResults={toolResults}
              permissions={permissionsByToolId}
              onApprovePermission={onApprovePermission}
              onDenyPermission={onDenyPermission}
              onApprovePermissionWithSettings={onApprovePermissionWithSettings}
              isProcessingPermission={isProcessingPermission}
              isStreaming={false}
            />
          );
        }
      })}
    </>
  );
});