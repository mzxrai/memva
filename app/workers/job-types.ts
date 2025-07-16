import type { JobHandler } from './job-worker'

// Job Type Constants
export const JOB_TYPES = {
  SESSION_RUNNER: 'session-runner',
  MAINTENANCE: 'maintenance', 
  DATABASE_VACUUM: 'database-vacuum',
  DATABASE_BACKUP: 'database-backup'
} as const

export type JobType = typeof JOB_TYPES[keyof typeof JOB_TYPES]

export const ALL_JOB_TYPES: JobType[] = Object.values(JOB_TYPES)

// Job Data Types
export type SessionRunnerJobData = {
  sessionId: string
  prompt: string
  userId?: string
}

export type MaintenanceJobData = {
  operation: string
  olderThanDays?: number
}

export type DatabaseVacuumJobData = Record<string, never> // Empty object

export type DatabaseBackupJobData = {
  backupPath: string
}

// Job Creation Input Types
export type JobInput = {
  type: string
  data: Record<string, unknown>
  priority?: number
}

// Type-Safe Job Creation Helpers
export function createSessionRunnerJob(data: SessionRunnerJobData): JobInput {
  return {
    type: JOB_TYPES.SESSION_RUNNER,
    data,
    priority: 8 // High priority for user interactions
  }
}

export function createMaintenanceJob(data: MaintenanceJobData): JobInput {
  return {
    type: JOB_TYPES.MAINTENANCE,
    data,
    priority: 3 // Lower priority
  }
}

export function createDatabaseVacuumJob(): JobInput {
  return {
    type: JOB_TYPES.DATABASE_VACUUM,
    data: {},
    priority: 1 // Low priority
  }
}

export function createDatabaseBackupJob(data: DatabaseBackupJobData): JobInput {
  return {
    type: JOB_TYPES.DATABASE_BACKUP,
    data,
    priority: 2 // Low priority
  }
}

// Job Handler Registry
export class JobHandlerRegistry {
  private handlers = new Map<string, JobHandler>()

  register(jobType: string, handler: JobHandler): void {
    if (this.handlers.has(jobType)) {
      throw new Error(`Handler for job type "${jobType}" already registered`)
    }

    // Warn if registering handler for unknown job type
    if (!ALL_JOB_TYPES.includes(jobType as JobType)) {
      console.warn(`Warning: Registering handler for unknown job type "${jobType}"`)
    }

    this.handlers.set(jobType, handler)
  }

  get(jobType: string): JobHandler | undefined {
    return this.handlers.get(jobType)
  }

  getRegisteredTypes(): string[] {
    return Array.from(this.handlers.keys())
  }
}