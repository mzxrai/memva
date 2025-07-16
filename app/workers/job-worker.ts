import Queue from 'better-queue'

export type JobWorkerConfig = {
  concurrent?: number
  maxRetries?: number
  retryDelay?: number
}

export type JobHandler = (job: unknown, callback: (error: Error | null, result?: unknown) => void) => void

export class JobWorker {
  public readonly queue: Queue
  public readonly config: Required<JobWorkerConfig>
  private handlers: Map<string, JobHandler> = new Map()
  private _isRunning = false

  constructor(config: JobWorkerConfig = {}) {
    this.config = {
      concurrent: config.concurrent ?? 1,
      maxRetries: config.maxRetries ?? 3,
      retryDelay: config.retryDelay ?? 1000
    }

    // Initialize Better Queue with basic configuration
    this.queue = new Queue(this.processJob.bind(this), {
      concurrent: this.config.concurrent,
      maxRetries: this.config.maxRetries,
      retryDelay: this.config.retryDelay
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
  }

  async stop(): Promise<void> {
    if (!this._isRunning) {
      return // Already stopped, do nothing
    }
    this._isRunning = false
  }

  private processJob(job: unknown, callback: (error: Error | null, result?: unknown) => void): void {
    // This will be implemented in the next phase
    callback(null, { processed: true })
  }
}