import { memo } from 'react';
import { useEventStore } from '../stores/event-store';
import { EventList } from './events/EventList';
import type { PermissionRequest } from '../db/schema';

interface SessionMessagesProps {
  permissionsByToolId: Map<string, PermissionRequest>;
  onApprovePermission: (toolId: string) => void;
  onDenyPermission: (toolId: string) => void;
  onApprovePermissionWithSettings?: (id: string, permissionMode: 'default' | 'acceptEdits') => void;
  isProcessingPermission: boolean;
  eventsLoading: boolean;
  showSpinner: boolean;
  isSubmitting: boolean;
}

export const SessionMessages = memo(function SessionMessages({
  permissionsByToolId,
  onApprovePermission,
  onDenyPermission,
  onApprovePermissionWithSettings,
  isProcessingPermission,
  eventsLoading,
  showSpinner,
  isSubmitting
}: SessionMessagesProps) {
  // Subscribe to event store here, isolated from the parent component
  const displayEvents = useEventStore(state => state.displayEvents);
  const toolResults = useEventStore(state => state.toolResults);

  if (eventsLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-zinc-500">Loading messages...</p>
      </div>
    );
  }

  if (displayEvents.length === 0 && !showSpinner && !isSubmitting && !eventsLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-zinc-500">No messages yet. Start by asking something.</p>
      </div>
    );
  }

  return (
    <EventList
      displayEvents={displayEvents}
      toolResults={toolResults}
      permissionsByToolId={permissionsByToolId}
      onApprovePermission={onApprovePermission}
      onDenyPermission={onDenyPermission}
      onApprovePermissionWithSettings={onApprovePermissionWithSettings}
      isProcessingPermission={isProcessingPermission}
    />
  );
});