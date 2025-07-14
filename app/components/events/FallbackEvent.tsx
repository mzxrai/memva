import { BaseEventWrapper } from './BaseEventWrapper'
import type { AnyEvent } from '../../types/events'

interface FallbackEventProps {
  event: AnyEvent
}

export function FallbackEvent({ event }: FallbackEventProps) {
  return (
    <BaseEventWrapper
      timestamp={event.timestamp}
      uuid={event.uuid}
      eventType={event.type as string || 'unknown'}
      className="opacity-70"
    >
      <div className="bg-zinc-800 p-4 rounded-lg border border-zinc-700">
        <div className="text-xs text-zinc-400 mb-2">Raw Event Data</div>
        <pre className="text-zinc-100 font-mono text-xs overflow-x-auto">
          {JSON.stringify(event, null, 2)}
        </pre>
      </div>
    </BaseEventWrapper>
  )
}