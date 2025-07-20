#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import Database from 'better-sqlite3'
import { PermissionPoller } from './permission-poller.js'
import { appendFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

// Debug logging to file
const logFile = join(homedir(), '.memva', 'mcp-server.log')
const log = (message: string) => {
  const timestamp = new Date().toISOString()
  const logMessage = `[${timestamp}] ${message}\n`
  console.error(logMessage) // MCP uses stderr for logs
  try {
    appendFileSync(logFile, logMessage)
  } catch (e) {
    // Ignore file write errors
  }
}

// Debug process.argv
log(`process.argv: ${JSON.stringify(process.argv)}`)
log(`process.argv length: ${process.argv.length}`)

// Parse command-line arguments
const args = process.argv.slice(2)
let SESSION_ID: string | undefined
let DATABASE_PATH: string | undefined

// Parse arguments - supports both --key=value and --key value formats
for (let i = 0; i < args.length; i++) {
  const arg = args[i]
  
  if (arg.startsWith('--session-id=')) {
    SESSION_ID = arg.slice('--session-id='.length)
  } else if (arg === '--session-id' && i + 1 < args.length) {
    SESSION_ID = args[++i]
  } else if (arg.startsWith('--database-path=')) {
    DATABASE_PATH = arg.slice('--database-path='.length)
  } else if (arg === '--database-path' && i + 1 < args.length) {
    DATABASE_PATH = args[++i]
  }
}

// Fall back to environment variables if CLI args not provided
if (!SESSION_ID && process.env.SESSION_ID) {
  SESSION_ID = process.env.SESSION_ID
  log('Using SESSION_ID from environment variable')
}
if (!DATABASE_PATH && process.env.DATABASE_PATH) {
  DATABASE_PATH = process.env.DATABASE_PATH
  log('Using DATABASE_PATH from environment variable')
}

log(`MCP Permission Server starting...`)
log(`Command-line args: ${JSON.stringify(args)}`)
log(`Session ID: ${SESSION_ID}`)
log(`Database Path: ${DATABASE_PATH}`)
log(`Current directory: ${process.cwd()}`)

if (!SESSION_ID) {
  log('ERROR: --session-id argument or SESSION_ID env var is required')
  process.exit(1)
}

if (!DATABASE_PATH) {
  log('ERROR: --database-path argument or DATABASE_PATH env var is required')
  process.exit(1)
}

// Initialize database connection
log(`Opening database at: ${DATABASE_PATH}`)
const db = new Database(DATABASE_PATH)
log('Database opened successfully')

// Initialize permission poller
const poller = new PermissionPoller(db)
log('Permission poller initialized')

// Create MCP server
const server = new McpServer({
  name: 'memva-permissions',
  version: '1.0.0'
})

// Register the approval_prompt tool
server.tool(
  'approval_prompt',
  'Request permission from user for tool execution',
  {
    tool_name: z.string().describe('The name of the tool requesting permission'),
    input: z.object({}).passthrough().describe('The input for the tool'),
    tool_use_id: z.string().optional().describe('The unique tool use request ID')
  },
  async ({ tool_name, input, tool_use_id }) => {
    log(`Received approval_prompt request: tool=${tool_name}, tool_use_id=${tool_use_id}`)
    log(`Input: ${JSON.stringify(input)}`)
    
    try {
      // Create permission request in database
      const requestId = poller.createPermissionRequest({
        session_id: SESSION_ID,
        tool_name,
        tool_use_id,
        input
      })

      log(`Created permission request ${requestId} for ${tool_name}`)

      // Poll for decision (up to 24 hours)
      const maxWaitTime = 24 * 60 * 60 * 1000 // 24 hours
      const decision = await poller.pollForDecision(requestId, maxWaitTime)

      log(`Decision for ${requestId}: ${JSON.stringify(decision)}`)

      // Return the decision as JSON-stringified text
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(decision)
          }
        ]
      }
    } catch (error) {
      log(`ERROR: ${error instanceof Error ? error.stack : String(error)}`)
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              behavior: 'deny',
              message: `Error processing permission request: ${error instanceof Error ? error.message : 'Unknown error'}`
            })
          }
        ]
      }
    }
  }
)

// Connect to stdio transport
async function main() {
  log('Creating stdio transport...')
  const transport = new StdioServerTransport()
  log('Connecting server to transport...')
  await server.connect(transport)
  log('MCP Permission Server connected via stdio transport and ready!')
}

// Handle cleanup
process.on('SIGINT', () => {
  log('Received SIGINT, shutting down...')
  db.close()
  process.exit(0)
})

process.on('SIGTERM', () => {
  log('Received SIGTERM, shutting down...')
  db.close()
  process.exit(0)
})

// Start the server
main().catch((error) => {
  log(`Failed to start: ${error instanceof Error ? error.stack : String(error)}`)
  process.exit(1)
})