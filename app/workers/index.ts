import { JobWorker, type JobWorkerConfig } from './job-worker'
import { sessionRunnerHandler } from './handlers/session-runner.handler'

export class JobSystem {
  private jobWorker: JobWorker
  public readonly config: Required<JobWorkerConfig>
  
  constructor(config: JobWorkerConfig = {}) {
    this.config = {
      concurrent: config.concurrent ?? 1,
      maxRetries: config.maxRetries ?? 3,
      retryDelay: config.retryDelay ?? 1000
    }
    
    this.jobWorker = new JobWorker(this.config)
    
    // Auto-register default handlers
    this.jobWorker.registerHandler('session-runner', sessionRunnerHandler)
  }
  
  get isRunning(): boolean {
    return this.jobWorker.isRunning
  }
  
  getRegisteredHandlers(): string[] {
    return this.jobWorker.getRegisteredHandlers()
  }
  
  async start(): Promise<void> {
    await this.jobWorker.start()
  }
  
  async stop(): Promise<void> {
    await this.jobWorker.stop()
  }
}