#!/usr/bin/env node
/* eslint-env node */

import { JobSystem } from '../app/workers/index.js'

async function startJobWorker() {
  const jobSystem = new JobSystem({
    concurrent: 2,  // Run 2 jobs concurrently 
    maxRetries: 3,
    retryDelay: 1000
  })

  console.log('🚀 Starting job system...')
  
  try {
    await jobSystem.start()
    console.log('🔄 Polling for jobs...')
    
    // Keep the process alive
    process.on('SIGINT', async () => {
      console.log('\n🛑 Stopping job system...')
      await jobSystem.stop()
      console.log('✅ Job system stopped')
      process.exit(0)
    })
    
  } catch (error) {
    console.error('❌ Failed to start job system:', error)
    process.exit(1)
  }
}

startJobWorker()