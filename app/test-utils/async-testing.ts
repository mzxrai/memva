/**
 * Async testing utilities for proper completion polling instead of arbitrary timeouts.
 * Replaces setTimeout patterns with smart waiting that checks actual conditions.
 */

export type WaitCondition = () => boolean | Promise<boolean>

export interface WaitOptions {
  timeoutMs?: number
  intervalMs?: number
  errorMessage?: string
}

/**
 * Wait for a condition to become true by polling at regular intervals.
 * Much more reliable than arbitrary timeouts.
 * 
 * @param condition Function that returns true when the condition is met
 * @param options Configuration for timeout, interval, and error message
 */
export async function waitForCondition(
  condition: WaitCondition,
  options: WaitOptions = {}
): Promise<void> {
  const {
    timeoutMs = 5000,
    intervalMs = 100,
    errorMessage = 'Condition not met within timeout'
  } = options

  const startTime = Date.now()

  while (Date.now() - startTime < timeoutMs) {
    const result = await condition()
    if (result) {
      return
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs))
  }

  throw new Error(`${errorMessage} (${timeoutMs}ms)`)
}

/**
 * Wait for database to contain expected data.
 * Common pattern for integration tests.
 */
export async function waitForDatabaseCondition<T>(
  queryFn: () => T[],
  expectedCount: number,
  options: WaitOptions = {}
): Promise<T[]> {
  let results: T[] = []
  
  await waitForCondition(
    () => {
      results = queryFn()
      return results.length >= expectedCount
    },
    {
      errorMessage: `Expected ${expectedCount} records, got ${results.length}`,
      ...options
    }
  )

  return results
}

/**
 * Wait for specific events to be stored in the database.
 * Common pattern for Claude Code integration tests.
 */
export async function waitForEvents(
  getEventsFn: () => Array<{ event_type: string }>,
  expectedTypes: string[],
  options: WaitOptions = {}
): Promise<Array<{ event_type: string }>> {
  let events: Array<{ event_type: string }> = []
  
  await waitForCondition(
    () => {
      events = getEventsFn()
      return expectedTypes.every(type => 
        events.some(event => event.event_type === type)
      )
    },
    {
      errorMessage: `Expected events [${expectedTypes.join(', ')}], got [${events.map(e => e.event_type).join(', ')}]`,
      timeoutMs: 10000, // Longer timeout for integration tests
      ...options
    }
  )

  return events
}

/**
 * Wait for a streaming response to complete.
 * Used for API tests that return streaming responses.
 */
export async function waitForStreamCompletion(
  checkCompletionFn: () => boolean,
  options: WaitOptions = {}
): Promise<void> {
  await waitForCondition(
    checkCompletionFn,
    {
      errorMessage: 'Stream did not complete within timeout',
      timeoutMs: 10000, // Longer timeout for streaming
      intervalMs: 200,  // Check less frequently for streaming
      ...options
    }
  )
}

/**
 * Simple delay utility for cases where you actually need to wait a specific amount.
 * Use sparingly - prefer waitForCondition when possible.
 */
export async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}