import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('Better Queue Dependencies', () => {
  it('should have better-queue in package.json dependencies', () => {
    // This test will fail until better-queue is properly added to package.json
    const packageJsonPath = path.join(process.cwd(), 'package.json')
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
    
    expect(packageJson.dependencies).toHaveProperty('better-queue')
  })

  it('should have @types/better-queue in package.json dependencies', () => {
    // This test will fail until @types/better-queue is added to package.json
    const packageJsonPath = path.join(process.cwd(), 'package.json')
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
    
    expect(packageJson.dependencies).toHaveProperty('@types/better-queue')
  })

  it('should be able to create a basic queue instance', () => {
    // This test will fail until better-queue is properly installed
    const Queue = require('better-queue') as new (processor: (task: unknown, cb: (err: Error | null, result?: unknown) => void) => void) => {
      push: (task: unknown) => void
      getStats: () => Record<string, unknown>
    }
    
    const queue = new Queue(function(task: unknown, cb: (err: Error | null, result?: unknown) => void) {
      cb(null, 'processed')
    })
    
    expect(queue).toBeDefined()
    expect(typeof queue.push).toBe('function')
    expect(typeof queue.getStats).toBe('function')
  })
})