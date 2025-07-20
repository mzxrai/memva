import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import Database from 'better-sqlite3'
import { PermissionPoller } from './permission-poller.js'

// Get environment variables
const SESSION_ID = process.env.SESSION_ID
const DATABASE_PATH = process.env.DATABASE_PATH

if (!SESSION_ID) {
  console.error('SESSION_ID environment variable is required')
  process.exit(1)
}

if (!DATABASE_PATH) {
  console.error('DATABASE_PATH environment variable is required')
  process.exit(1)
}

// Initialize database connection
const db = new Database(DATABASE_PATH)

// Initialize permission poller
const poller = new PermissionPoller(db)

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
    try {
      // Create permission request in database
      const requestId = poller.createPermissionRequest({
        session_id: SESSION_ID,
        tool_name,
        tool_use_id,
        input
      })

      console.error(`[MCP Permission Server] Created permission request ${requestId} for ${tool_name}`)

      // Poll for decision (up to 24 hours)
      const maxWaitTime = 24 * 60 * 60 * 1000 // 24 hours
      const decision = await poller.pollForDecision(requestId, maxWaitTime)

      console.error(`[MCP Permission Server] Decision for ${requestId}: ${decision.behavior}`)

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
      console.error('[MCP Permission Server] Error:', error)
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
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('[MCP Permission Server] Connected via stdio transport')
}

// Handle cleanup
process.on('SIGINT', () => {
  console.error('[MCP Permission Server] Shutting down...')
  db.close()
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.error('[MCP Permission Server] Shutting down...')
  db.close()
  process.exit(0)
})

// Start the server
main().catch((error) => {
  console.error('[MCP Permission Server] Failed to start:', error)
  process.exit(1)
})