#!/usr/bin/env node
import { readdir, readFile } from 'fs/promises'
import { join, basename } from 'path'
import { homedir } from 'os'
import { getDatabase, closeDatabase } from '../app/db/database'
import { events } from '../app/db/schema'
import type { ClaudeEvent } from '../app/types/events'
import { eq } from 'drizzle-orm'

interface ImportOptions {
  dbPath?: string
  projectsPath?: string
  dryRun?: boolean
  verbose?: boolean
}

interface ImportStats {
  totalEvents: number
  successfulImports: number
  failedImports: number
  duplicates: number
  projectsProcessed: number
  filesProcessed: number
  errors: string[]
}

export async function importEvents(options: ImportOptions = {}): Promise<ImportStats> {
  const {
    dbPath = './memva.db',
    projectsPath = join(homedir(), '.claude', 'projects'),
    dryRun = false,
    verbose = false
  } = options

  const stats: ImportStats = {
    totalEvents: 0,
    successfulImports: 0,
    failedImports: 0,
    duplicates: 0,
    projectsProcessed: 0,
    filesProcessed: 0,
    errors: []
  }

  console.log(`Starting import from ${projectsPath}`)
  if (dryRun) {
    console.log('DRY RUN MODE - No data will be written')
  }

  try {
    // Get database connection
    const db = dryRun ? null : getDatabase(dbPath)

    // Read all project directories
    const projectDirs = await readdir(projectsPath)
    
    for (const projectDir of projectDirs) {
      const projectPath = join(projectsPath, projectDir)
      const projectName = projectDir.replace(/-/g, '/')
      
      try {
        // Read all JSONL files in project directory
        const files = await readdir(projectPath)
        const jsonlFiles = files.filter(f => f.endsWith('.jsonl'))
        
        if (jsonlFiles.length === 0) continue
        
        stats.projectsProcessed++
        if (verbose) {
          console.log(`\nProcessing project: ${projectName}`)
          console.log(`Found ${jsonlFiles.length} session files`)
        }

        for (const jsonlFile of jsonlFiles) {
          const filePath = join(projectPath, jsonlFile)
          const sessionId = basename(jsonlFile, '.jsonl')
          
          try {
            // Read and parse JSONL file
            const content = await readFile(filePath, 'utf-8')
            const lines = content.trim().split('\n').filter(line => line.trim())
            
            stats.filesProcessed++
            let lineNumber = 0
            
            for (const line of lines) {
              lineNumber++
              stats.totalEvents++
              
              try {
                const event = JSON.parse(line)
                
                // Skip if already exists (based on UUID)
                if (!dryRun && db) {
                  const existing = db.select()
                    .from(events)
                    .where(eq(events.uuid, event.uuid))
                    .get()
                  
                  if (existing) {
                    stats.duplicates++
                    continue
                  }
                }
                
                // Skip summary events without timestamps for now
                if (event.type === 'summary' && !event.timestamp) {
                  if (verbose) {
                    console.log(`Skipping summary event without timestamp at line ${lineNumber}`)
                  }
                  continue
                }
                
                // Prepare event for database
                const dbEvent = {
                  uuid: event.uuid,
                  session_id: sessionId,
                  event_type: event.type as 'user' | 'assistant' | 'summary',
                  timestamp: event.timestamp,
                  is_sidechain: event.isSidechain || false,
                  parent_uuid: event.parentUuid || null,
                  cwd: event.cwd || projectName,
                  project_name: projectName,
                  data: event,
                  file_path: filePath,
                  line_number: lineNumber
                }
                
                // Insert into database
                if (!dryRun && db) {
                  db.insert(events).values(dbEvent).run()
                }
                
                stats.successfulImports++
                
              } catch (error) {
                stats.failedImports++
                const errorMsg = `Failed to process line ${lineNumber} in ${filePath}: ${error}`
                stats.errors.push(errorMsg)
                if (verbose) {
                  console.error(errorMsg)
                }
              }
            }
            
          } catch (error) {
            const errorMsg = `Failed to read file ${filePath}: ${error}`
            stats.errors.push(errorMsg)
            if (verbose) {
              console.error(errorMsg)
            }
          }
        }
        
      } catch (error) {
        const errorMsg = `Failed to process project ${projectDir}: ${error}`
        stats.errors.push(errorMsg)
        if (verbose) {
          console.error(errorMsg)
        }
      }
    }
    
  } catch (error) {
    const errorMsg = `Failed to read projects directory: ${error}`
    stats.errors.push(errorMsg)
    console.error(errorMsg)
  } finally {
    if (!dryRun) {
      closeDatabase()
    }
  }

  return stats
}

// Run if called directly
import { fileURLToPath } from 'url'

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const verbose = args.includes('--verbose') || args.includes('-v')
  
  console.log('Claude Code Event Importer')
  console.log('==========================\n')
  
  importEvents({ dryRun, verbose }).then(stats => {
    console.log('\nImport Summary:')
    console.log('===============')
    console.log(`Projects processed: ${stats.projectsProcessed}`)
    console.log(`Files processed: ${stats.filesProcessed}`)
    console.log(`Total events found: ${stats.totalEvents}`)
    console.log(`Successfully imported: ${stats.successfulImports}`)
    console.log(`Failed imports: ${stats.failedImports}`)
    console.log(`Duplicates skipped: ${stats.duplicates}`)
    
    if (stats.errors.length > 0) {
      console.log(`\nErrors (${stats.errors.length}):`)
      stats.errors.slice(0, 10).forEach(err => console.error(`- ${err}`))
      if (stats.errors.length > 10) {
        console.log(`... and ${stats.errors.length - 10} more errors`)
      }
    }
    
    process.exit(stats.failedImports > 0 ? 1 : 0)
  }).catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
}