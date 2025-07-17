import { createRequire } from 'module'
import { claimNextJob, completeJob, failJob, type Job } from '../db/jobs.service'

const require = createRequire(import.meta.url)
const Queue = require('better-queue')

export type JobWorkerConfig = {
  concurrent?: number
  maxRetries?: number
  retryDelay?: number
}

export type JobHandler = (job: unknown, callback: (error: Error | null, result?: unknown) => void) => void

export class JobWorker {
  public readonly queue: Queue
  private pollingQueue: Queue
  public readonly config: Required<JobWorkerConfig>
  private handlers: Map<string, JobHandler> = new Map()
  private _isRunning = false
  private pollingInterval: ReturnType<typeof setInterval> | null = null

  constructor(config: JobWorkerConfig = {}) {
    this.config = {
      concurrent: config.concurrent ?? 1,
      maxRetries: config.maxRetries ?? 3,
      retryDelay: config.retryDelay ?? 1000
    }

    // Initialize Better Queue for job processing with configured concurrency
    this.queue = new Queue(this.processJob.bind(this), {
      concurrent: this.config.concurrent,
      maxRetries: 0, // We handle retries at the database level
      afterProcessDelay: 100 // Small delay between jobs
    })

    // Initialize polling queue to claim jobs from database
    this.pollingQueue = new Queue(this.pollForJobs.bind(this), {
      concurrent: 1, // Only one polling operation at a time
      afterProcessDelay: 200 // Poll more frequently for better concurrency
    })
  }

  get isRunning(): boolean {
    return this._isRunning
  }

  registerHandler(jobType: string, handler: JobHandler): void {
    if (this.handlers.has(jobType)) {
      throw new Error(`Handler for job type "${jobType}" already registered`)
    }
    this.handlers.set(jobType, handler)
  }

  getHandler(jobType: string): JobHandler | undefined {
    return this.handlers.get(jobType)
  }

  getRegisteredHandlers(): string[] {
    return Array.from(this.handlers.keys())
  }

  async start(): Promise<void> {
    if (this._isRunning) {
      return // Already running, do nothing
    }
    this._isRunning = true
    
    // Start polling for jobs
    this.startPolling()
  }

  async stop(): Promise<void> {
    if (!this._isRunning) {
      return // Already stopped, do nothing
    }
    this._isRunning = false
    
    // Stop polling
    this.stopPolling()
    
    // For now, just wait a short time for jobs to finish
    // TODO: Implement proper graceful shutdown
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  private startPolling(): void {
    if (this.pollingInterval) {
      return
    }
    
    // Start continuous polling
    this.pollingInterval = setInterval(() => {
      if (this._isRunning) {
        this.pollingQueue.push('poll')
      }
    }, 200)
    
    // Initial poll
    this.pollingQueue.push('poll')
  }

  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval)
      this.pollingInterval = null
    }
  }

  private async pollForJobs(_task: unknown, callback: (error: Error | null) => void): Promise<void> {
    try {
      if (!this._isRunning) {
        callback(null)
        return
      }

      // Calculate how many jobs we can claim based on current queue capacity
      const stats = this.queue.getStats()
      const runningJobs = stats.running || 0
      const availableSlots = this.config.concurrent - runningJobs
      
      // Claim multiple jobs if we have capacity
      for (let i = 0; i < availableSlots; i++) {
        const claimedJob = await claimNextJob()
        
        if (!claimedJob) {
          break // No more jobs available
        }
        
        // Check if we have a handler for this job type
        const handler = this.handlers.get(claimedJob.type)
        
        if (handler) {
          // Push the job to the processing queue
          this.queue.push(claimedJob)
        } else {
          // No handler available, mark job as failed
          await failJob(claimedJob.id, `No handler registered for job type: ${claimedJob.type}`, false)
        }
      }
      
      callback(null)
    } catch (error) {
      console.error('Error polling for jobs:', error)
      callback(null) // Continue polling even on errors
    }
  }

  private async processJob(job: Job, callback: (error: Error | null, result?: unknown) => void): Promise<void> {
    const handler = this.handlers.get(job.type)
    
    if (!handler) {
      // This shouldn't happen as we check in pollForJobs, but safety first
      await failJob(job.id, `No handler registered for job type: ${job.type}`, false)
      callback(new Error(`No handler for job type: ${job.type}`))
      return
    }

    try {
      // Execute the job handler
      handler(job, async (error: Error | null, result?: unknown) => {
        try {
          if (error) {
            // Job failed, use the job service retry logic
            await failJob(job.id, error.message, true)
            callback(error)
          } else {
            // Job succeeded
            await completeJob(job.id, result as Record<string, unknown> | undefined)
            callback(null, result)
          }
        } catch (dbError) {
          console.error('Error updating job status:', dbError)
          callback(dbError as Error)
        }
      })
    } catch (handlerError) {
      // Handler threw an exception
      try {
        await failJob(job.id, (handlerError as Error).message, true)
      } catch (dbError) {
        console.error('Error marking job as failed:', dbError)
      }
      callback(handlerError as Error)
    }
  }
}