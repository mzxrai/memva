import clsx from 'clsx'
import { RiSparklingLine } from 'react-icons/ri'
import { BaseEventWrapper } from './events/BaseEventWrapper'
import { MessageContainer } from './events/MessageContainer'
import { MessageHeader } from './events/MessageHeader'

export function PendingMessage() {
  return (
    <BaseEventWrapper>
      <MessageContainer>
        <MessageHeader icon={RiSparklingLine} title="Claude" />
        
        {/* Message placeholder */}
        <div className="space-y-2">
          <div className={clsx(
            'h-4 bg-zinc-800 rounded',
            'w-3/4',
            'animate-pulse'
          )} />
          <div className={clsx(
            'h-4 bg-zinc-800 rounded',
            'w-1/2',
            'animate-pulse',
            'animation-delay-150'
          )} />
        </div>
      </MessageContainer>
    </BaseEventWrapper>
  )
}