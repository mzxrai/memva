import React, { useState, useEffect } from 'react';
import { useFetcher } from 'react-router';
import { RiDeleteBinLine, RiInboxUnarchiveLine, RiLoader4Line } from 'react-icons/ri';
import { useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';

interface ArchiveButtonProps {
  sessionId: string;
  sessionStatus: 'active' | 'archived';
  variant?: 'compact' | 'full';
  className?: string;
  onArchiveStart?: () => void;
}

export function ArchiveButton({ 
  sessionId, 
  sessionStatus, 
  variant = 'full',
  className = '',
  onArchiveStart 
}: ArchiveButtonProps) {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  const [isArchiving, setIsArchiving] = useState(false);
  const [minimumLoadingTime, setMinimumLoadingTime] = useState(false);
  const [actionType, setActionType] = useState<'archive' | 'unarchive' | null>(null);
  
  // Track when the fetcher completes successfully
  useEffect(() => {
    if (fetcher.state === 'idle' && isArchiving && minimumLoadingTime) {
      if (fetcher.data) {
        // Fetcher completed successfully, invalidate queries to refresh data
        queryClient.invalidateQueries({ queryKey: ['homepage-sessions'] });
        queryClient.invalidateQueries({ queryKey: ['archived-sessions'] });
      }
      // Reset states
      setIsArchiving(false);
      setMinimumLoadingTime(false);
      setActionType(null);
    }
  }, [fetcher.state, fetcher.data, isArchiving, minimumLoadingTime, queryClient]);
  
  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const isCurrentlyArchived = sessionStatus === 'archived';
    setActionType(isCurrentlyArchived ? 'unarchive' : 'archive');
    setIsArchiving(true);
    
    // Set minimum loading time (500ms)
    setTimeout(() => {
      setMinimumLoadingTime(true);
    }, 500);
    
    if (onArchiveStart) {
      onArchiveStart();
    }
    
    fetcher.submit(
      { status: isCurrentlyArchived ? 'active' : 'archived' },
      {
        method: 'PATCH',
        action: `/api/session/${sessionId}/status`,
        encType: 'application/json'
      }
    );
  };
  
  const isLoading = isArchiving || fetcher.state !== 'idle';
  const isArchived = sessionStatus === 'archived';
  
  const baseClasses = clsx(
    'flex items-center gap-1 rounded transition-all duration-150',
    className
  );
  
  if (variant === 'compact') {
    return (
      <button
        onClick={handleClick}
        disabled={isLoading}
        className={clsx(
          baseClasses,
          isLoading ? 'px-2 py-1' : 'p-1.5',
          !isLoading && 'text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800/50',
          isLoading && 'text-zinc-500'
        )}
        aria-label={isArchived ? 'Unarchive session' : 'Archive session'}
        title={isLoading ? 'Processing...' : (isArchived ? 'Unarchive session' : 'Archive session')}
      >
        {isLoading ? (
          <>
            <RiLoader4Line className="w-3.5 h-3.5 animate-spin" />
            <span className="text-xs">{actionType === 'unarchive' ? 'Unarchiving' : 'Archiving'}</span>
          </>
        ) : isArchived ? (
          <RiInboxUnarchiveLine className="w-3.5 h-3.5" />
        ) : (
          <RiDeleteBinLine className="w-3.5 h-3.5" />
        )}
      </button>
    );
  }
  
  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={clsx(
        baseClasses,
        'px-3 py-1.5 gap-2',
        !isLoading && 'text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800/50',
        isLoading && 'text-zinc-400'
      )}
      aria-label={isArchived ? 'Unarchive session' : 'Archive session'}
    >
      {isLoading ? (
        <>
          <RiLoader4Line className="w-4 h-4 animate-spin" />
          <span>{actionType === 'unarchive' ? 'Unarchiving...' : 'Archiving...'}</span>
        </>
      ) : isArchived ? (
        <>
          <RiInboxUnarchiveLine className="w-4 h-4" />
          <span>Unarchive</span>
        </>
      ) : (
        <>
          <RiDeleteBinLine className="w-4 h-4" />
          <span>Archive</span>
        </>
      )}
    </button>
  );
}