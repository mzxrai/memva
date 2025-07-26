import { db, events } from './app/db/index'
import { eq, and, desc } from 'drizzle-orm'

async function debugTokens(sessionId: string) {
  console.log(`\nDebugging tokens for session: ${sessionId}\n`)
  
  // Get all events for this session to find unique Claude sessions
  const allEvents = await db
    .select()
    .from(events)
    .where(eq(events.memva_session_id, sessionId))
    .execute()
  
  const uniqueClaudeSessions = new Set(allEvents.map(e => e.session_id).filter(Boolean))
  console.log(`Number of Claude sessions (resumes): ${uniqueClaudeSessions.size}`)
  console.log(`Claude session IDs: ${Array.from(uniqueClaudeSessions).join(', ')}\n`)
  
  // Get result events
  const resultEvents = await db
    .select()
    .from(events)
    .where(
      and(
        eq(events.memva_session_id, sessionId),
        eq(events.event_type, 'result')
      )
    )
    .orderBy(desc(events.timestamp))
    .execute()
  
  console.log(`Found ${resultEvents.length} result events\n`)
  
  if (resultEvents.length > 0) {
    console.log('=== LATEST RESULT EVENT ===\n')
    const latestResult = resultEvents[0]
    
    if (latestResult.data && typeof latestResult.data === 'object') {
      const data = latestResult.data as Record<string, unknown>
      const usage = data.usage as {
        input_tokens?: number
        cache_read_input_tokens?: number
        cache_creation_input_tokens?: number
        output_tokens?: number
      } | undefined
      
      if (usage) {
        const total = (usage.input_tokens || 0) + 
                     (usage.cache_read_input_tokens || 0) + 
                     (usage.cache_creation_input_tokens || 0) + 
                     (usage.output_tokens || 0)
        
        const contextPercentage = (total / 200000) * 100
        
        console.log(`Latest Result Event:`)
        console.log(`  Timestamp: ${latestResult.timestamp}`)
        console.log(`  Claude Session ID: ${latestResult.session_id}`)
        console.log(`  Usage:`)
        console.log(`    Input tokens: ${usage.input_tokens || 0}`)
        console.log(`    Cache read tokens: ${usage.cache_read_input_tokens || 0}`)
        console.log(`    Cache creation tokens: ${usage.cache_creation_input_tokens || 0}`)
        console.log(`    Output tokens: ${usage.output_tokens || 0}`)
        console.log(`    TOTAL: ${total.toLocaleString()}`)
        console.log(`    Context percentage: ${contextPercentage.toFixed(2)}%`)
        console.log(`    Expected display: ${Math.round(contextPercentage)}%`)
        console.log('')
      }
    }
  }
  
  // Get all assistant events for this session
  const assistantEvents = await db
    .select()
    .from(events)
    .where(
      and(
        eq(events.memva_session_id, sessionId),
        eq(events.event_type, 'assistant')
      )
    )
    .execute()
  
  console.log(`Found ${assistantEvents.length} assistant events\n`)
  
  // Group events by Claude session ID
  const eventsBySession = new Map<string, typeof assistantEvents>()
  for (const event of assistantEvents) {
    const sessionId = event.session_id || 'unknown'
    if (!eventsBySession.has(sessionId)) {
      eventsBySession.set(sessionId, [])
    }
    eventsBySession.get(sessionId)!.push(event)
  }
  
  console.log('=== LAST EVENT PER CLAUDE SESSION ===\n')
  
  for (const [claudeSessionId, sessionEvents] of eventsBySession) {
    // Sort by timestamp to ensure we get the last event
    sessionEvents.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    const lastEvent = sessionEvents[sessionEvents.length - 1]
    
    if (lastEvent.data && typeof lastEvent.data === 'object') {
      const data = lastEvent.data as Record<string, unknown>
      const message = data.message as Record<string, unknown> | undefined
      const usage = message?.usage as {
        input_tokens?: number
        cache_read_input_tokens?: number
        cache_creation_input_tokens?: number
        output_tokens?: number
      } | undefined
      
      if (usage) {
        const total = (usage.input_tokens || 0) + 
                     (usage.cache_read_input_tokens || 0) + 
                     (usage.cache_creation_input_tokens || 0) + 
                     (usage.output_tokens || 0)
        
        console.log(`Claude Session: ${claudeSessionId}`)
        console.log(`  Events in session: ${sessionEvents.length}`)
        console.log(`  Last event timestamp: ${lastEvent.timestamp}`)
        console.log(`  Last event usage:`)
        console.log(`    Input tokens: ${usage.input_tokens || 0}`)
        console.log(`    Cache read tokens: ${usage.cache_read_input_tokens || 0}`)
        console.log(`    Cache creation tokens: ${usage.cache_creation_input_tokens || 0}`)
        console.log(`    Output tokens: ${usage.output_tokens || 0}`)
        console.log(`    Total for this event: ${total.toLocaleString()}`)
        console.log('')
      }
    }
  }
  
  console.log('\n=== CUMULATIVE TOTALS (ALL EVENTS) ===\n')
  
  let totalInputTokens = 0
  let totalOutputTokens = 0
  let totalCacheReadTokens = 0
  let totalCacheCreationTokens = 0
  let eventCount = 0
  
  for (const event of assistantEvents) {
    if (event.data && typeof event.data === 'object') {
      const data = event.data as Record<string, unknown>
      const message = data.message as Record<string, unknown> | undefined
      const usage = message?.usage as {
        input_tokens?: number
        cache_read_input_tokens?: number
        cache_creation_input_tokens?: number
        output_tokens?: number
      } | undefined
      
      if (usage) {
        eventCount++
        const input = usage.input_tokens || 0
        const cacheRead = usage.cache_read_input_tokens || 0
        const cacheCreation = usage.cache_creation_input_tokens || 0
        const output = usage.output_tokens || 0
        
        totalInputTokens += input
        totalCacheReadTokens += cacheRead
        totalCacheCreationTokens += cacheCreation
        totalOutputTokens += output
        
        const eventTotal = input + cacheRead + cacheCreation + output
        console.log(`Event ${eventCount}:`)
        console.log(`  Timestamp: ${event.timestamp}`)
        console.log(`  Input tokens: ${input}`)
        console.log(`  Cache read tokens: ${cacheRead}`)
        console.log(`  Cache creation tokens: ${cacheCreation}`)
        console.log(`  Output tokens: ${output}`)
        console.log(`  Event total: ${eventTotal.toLocaleString()}`)
        console.log('')
      }
    }
  }
  
  const totalTokens = totalInputTokens + totalCacheReadTokens + totalCacheCreationTokens + totalOutputTokens
  const contextPercentage = (totalTokens / 200000) * 100
  
  console.log('=== TOTALS ===')
  console.log(`Input tokens: ${totalInputTokens.toLocaleString()}`)
  console.log(`Cache read tokens: ${totalCacheReadTokens.toLocaleString()}`)
  console.log(`Cache creation tokens: ${totalCacheCreationTokens.toLocaleString()}`)
  console.log(`Output tokens: ${totalOutputTokens.toLocaleString()}`)
  console.log(`\nTOTAL TOKENS: ${totalTokens.toLocaleString()}`)
  console.log(`Context usage: ${contextPercentage.toFixed(2)}%`)
  console.log(`\nExpected percentage: ${Math.round(contextPercentage)}%`)
  
  process.exit(0)
}

// Run the debug script
debugTokens('30943f44-7bfb-484d-8e85-192fa5a7fa55').catch(console.error)