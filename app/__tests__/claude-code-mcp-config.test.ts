import { vi } from 'vitest'
import { setupInMemoryDb, type TestDatabase } from '../test-utils/in-memory-db'
import { setupDatabaseMocks, setTestDatabase, clearTestDatabase } from '../test-utils/database-mocking'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'

// CRITICAL: Setup static mocks before any imports that use database
setupDatabaseMocks(vi)

// Mock fs/promises
vi.mock('node:fs/promises', () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    unlink: vi.fn().mockResolvedValue(undefined),
    access: vi.fn().mockRejectedValue(new Error('File not found'))
  }
}))

import { generateMcpConfig, cleanupMcpConfig, getClaudeCodeOptionsWithPermissions } from '../services/claude-code.server'

describe('Claude Code MCP Configuration', () => {
  let testDb: TestDatabase

  beforeEach(() => {
    testDb = setupInMemoryDb()
    setTestDatabase(testDb)
    vi.clearAllMocks()
  })

  afterEach(() => {
    testDb.cleanup()
    clearTestDatabase()
  })

  describe('generateMcpConfig', () => {
    it('should create MCP config directory if it does not exist', async () => {
      const sessionId = 'test-session-123'
      const homeDir = os.homedir()
      const configDir = path.join(homeDir, '.memva', 'tmp')

      await generateMcpConfig(sessionId)

      expect(fs.mkdir).toHaveBeenCalledWith(configDir, { recursive: true })
    })

    it('should generate MCP config file with correct structure', async () => {
      const sessionId = 'test-session-456'
      const expectedPath = path.join(os.homedir(), '.memva', 'tmp', `mcp-config-${sessionId}.json`)

      const configPath = await generateMcpConfig(sessionId)

      expect(configPath).toBe(expectedPath)
      expect(fs.writeFile).toHaveBeenCalledWith(
        expectedPath,
        expect.any(String),
        'utf-8'
      )

      // Verify the content
      const writtenContent = JSON.parse((fs.writeFile as any).mock.calls[0][1])
      expect(writtenContent).toMatchObject({
        mcpServers: {
          'memva-permissions': {
            command: 'node',
            args: expect.arrayContaining([
              expect.stringContaining('mcp-permission-server/build/index.js')
            ]),
            env: {
              SESSION_ID: sessionId,
              DATABASE_PATH: expect.stringContaining('memva-dev.db')
            }
          }
        }
      })
    })

    it('should use absolute paths for MCP server', async () => {
      const sessionId = 'test-session-789'
      
      await generateMcpConfig(sessionId)

      const writtenContent = JSON.parse((fs.writeFile as any).mock.calls[0][1])
      const args = writtenContent.mcpServers['memva-permissions'].args
      
      // Should use absolute path
      expect(args[0]).toMatch(/^\//)
      expect(args[0]).toContain('mcp-permission-server/build/index.js')
    })
  })

  describe('cleanupMcpConfig', () => {
    it('should delete MCP config file', async () => {
      const sessionId = 'test-session-cleanup'
      const expectedPath = path.join(os.homedir(), '.memva', 'tmp', `mcp-config-${sessionId}.json`)

      // Mock that file exists
      ;(fs.access as any).mockResolvedValueOnce(undefined)

      await cleanupMcpConfig(sessionId)

      expect(fs.unlink).toHaveBeenCalledWith(expectedPath)
    })

    it('should not throw if file does not exist', async () => {
      const sessionId = 'test-session-not-exist'
      
      // fs.access already mocked to reject (file not found)
      await expect(cleanupMcpConfig(sessionId)).resolves.not.toThrow()
      expect(fs.unlink).not.toHaveBeenCalled()
    })
  })

  describe('getClaudeCodeOptionsWithPermissions', () => {
    it('should return options with MCP config and permission tool', async () => {
      const sessionId = 'test-session-123'
      const baseOptions = {
        maxTurns: 100,
        cwd: '/test/project',
        permissionMode: 'acceptEdits' as const
      }

      const result = await getClaudeCodeOptionsWithPermissions(sessionId, baseOptions)

      // Should generate MCP config
      expect(fs.writeFile).toHaveBeenCalled()
      const configPath = path.join(os.homedir(), '.memva', 'tmp', `mcp-config-${sessionId}.json`)
      expect(result.mcpConfig).toBe(configPath)

      // Should include permission prompt tool
      expect(result.permissionPromptTool).toBe('mcp__memva-permissions__approval_prompt')

      // Should add permission tool to allowed tools
      expect(result.allowedTools).toContain('mcp__memva-permissions__approval_prompt')

      // Should preserve other options
      expect(result.maxTurns).toBe(100)
      expect(result.cwd).toBe('/test/project')
      expect(result.permissionMode).toBe('acceptEdits')
    })

    it('should preserve existing allowed tools and add permission tool', async () => {
      const sessionId = 'test-session-456'
      const baseOptions = {
        maxTurns: 100,
        cwd: '/test/project',
        allowedTools: ['Read', 'Write', 'Bash']
      }

      const result = await getClaudeCodeOptionsWithPermissions(sessionId, baseOptions)

      // Should preserve existing tools and add permission tool
      expect(result.allowedTools).toEqual([
        'Read', 
        'Write', 
        'Bash',
        'mcp__memva-permissions__approval_prompt'
      ])
    })

    it('should not duplicate permission tool if already in allowed tools', async () => {
      const sessionId = 'test-session-789'
      const baseOptions = {
        maxTurns: 100,
        cwd: '/test/project',
        allowedTools: ['Read', 'mcp__memva-permissions__approval_prompt']
      }

      const result = await getClaudeCodeOptionsWithPermissions(sessionId, baseOptions)

      // Should not duplicate the permission tool
      expect(result.allowedTools).toEqual([
        'Read',
        'mcp__memva-permissions__approval_prompt'
      ])
    })

    it('should handle empty allowed tools', async () => {
      const sessionId = 'test-session-empty'
      const baseOptions = {
        maxTurns: 100,
        cwd: '/test/project'
      }

      const result = await getClaudeCodeOptionsWithPermissions(sessionId, baseOptions)

      // Should add permission tool to empty array
      expect(result.allowedTools).toEqual([
        'mcp__memva-permissions__approval_prompt'
      ])
    })
  })
})