import React from 'react'
import { RiBarChartLine } from 'react-icons/ri'
import clsx from 'clsx'

interface TokenStats {
  input_tokens: number
  output_tokens: number
  cache_read_tokens: number
  cache_creation_tokens: number
  total_tokens: number
  cache_efficiency: number
  context_used: number
  context_percentage: number
}

interface TokenCounterProps {
  tokenStats: TokenStats | null
  className?: string
}

function formatNumber(num: number): string {
  if (num < 1000) return num.toString()
  if (num < 1000000) return `${(num / 1000).toFixed(1)}k`
  return `${(num / 1000000).toFixed(1)}M`
}


export default function TokenCounter({ tokenStats, className }: TokenCounterProps) {
  if (!tokenStats) return null
  
  return (
    <div className={clsx('group relative', className)}>
      {/* Main display - matching the style of permission badge */}
      <div className={clsx(
        "flex items-center gap-1.5 px-2.5 py-1 border rounded-md cursor-help transition-all duration-200",
        tokenStats.context_percentage < 75 
          ? "bg-zinc-900/50 border-zinc-800 hover:bg-zinc-800/50" 
          : tokenStats.context_percentage < 90
          ? "bg-amber-900/20 border-amber-800/50 hover:bg-amber-800/30"
          : "bg-red-900/20 border-red-800/50 hover:bg-red-800/30"
      )}>
        <RiBarChartLine className={clsx(
          "w-3.5 h-3.5",
          tokenStats.context_percentage < 75 ? "text-zinc-400" :
          tokenStats.context_percentage < 90 ? "text-amber-400" :
          "text-red-400"
        )} />
        <span className={clsx(
          "text-xs font-mono",
          tokenStats.context_percentage < 75 ? "text-zinc-300" :
          tokenStats.context_percentage < 90 ? "text-amber-300" :
          "text-red-300"
        )}>
          {formatNumber(tokenStats.context_used)}
        </span>
      </div>
      
      {/* Detailed tooltip - matching the style of permission mode tooltip */}
      <div className="absolute bottom-full right-0 mb-2 px-4 py-3 bg-zinc-800 text-zinc-300 text-sm rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 min-w-[320px] border border-zinc-700">
        <div className="space-y-3">
          <div className="font-medium text-zinc-100">Context Usage</div>
          
          <div className="space-y-3">
            <div>
              <div className="text-xs text-zinc-500 mb-1">Current Claude session:</div>
              <div className="text-2xl font-mono text-zinc-100">
                {formatNumber(tokenStats.context_used)} / 200k
              </div>
              <div className="text-xs text-zinc-500">
                {Math.round(tokenStats.context_percentage)}% of context window
              </div>
            </div>
            
            <div className="w-full bg-zinc-700/50 rounded-full h-2 overflow-hidden">
              <div 
                className={clsx(
                  "h-full transition-all duration-300",
                  tokenStats.context_percentage < 75 ? "bg-emerald-500" :
                  tokenStats.context_percentage < 90 ? "bg-amber-500" :
                  "bg-red-500"
                )}
                style={{ width: `${Math.min(100, tokenStats.context_percentage)}%` }}
              />
            </div>
            
            {tokenStats.context_percentage >= 90 && (
              <div className="text-xs text-red-400">
                ⚠️ Approaching context limit - may need to start a new session soon
              </div>
            )}
            {tokenStats.context_percentage >= 75 && tokenStats.context_percentage < 90 && (
              <div className="text-xs text-amber-400">
                ⚠️ Context usage high - long responses may hit limit
              </div>
            )}
            {tokenStats.context_percentage < 75 && (
              <div className="text-xs text-zinc-500">
                Plenty of context remaining
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}