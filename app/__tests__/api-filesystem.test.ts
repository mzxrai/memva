import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock react-router's json function
vi.mock('react-router', () => ({
  json: vi.fn((data, init) => {
    return new Response(JSON.stringify(data), {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers || {})
      }
    })
  })
}))

// Mock fs, os, and process
vi.mock('node:fs/promises', () => ({
  default: {},
  access: vi.fn(),
  realpath: vi.fn()
}))

vi.mock('node:os', () => ({
  default: {},
  homedir: vi.fn(() => '/Users/testuser')
}))

describe('Filesystem API', () => {
  let loader: any
  let mockFsRealpath: any
  
  beforeEach(async () => {
    vi.clearAllMocks()
    
    // Get mocked functions
    const fs = await import('node:fs/promises')
    vi.mocked(fs.access)
    mockFsRealpath = vi.mocked(fs.realpath)
    
    // Import loader after mocks are set up
    const module = await import('../routes/api.filesystem')
    loader = module.loader
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('validate endpoint', () => {
    it('should return true for valid directory', async () => {
      const testPath = '/Users/testuser/projects'
      mockFsRealpath.mockResolvedValue(testPath)

      const request = new Request(`http://localhost/api/filesystem?action=validate&path=${encodeURIComponent(testPath)}`)
      const response = await loader({ request, params: {}, context: {} })
      const data = await response.json()

      expect(data).toEqual({ valid: true, resolvedPath: testPath })
      expect(mockFsRealpath).toHaveBeenCalled()
    })

    it('should return false for invalid directory', async () => {
      const testPath = '/nonexistent/path'
      mockFsRealpath.mockRejectedValue(new Error('ENOENT'))

      const request = new Request(`http://localhost/api/filesystem?action=validate&path=${encodeURIComponent(testPath)}`)
      const response = await loader({ request, params: {}, context: {} })
      const data = await response.json()

      expect(data).toEqual({ valid: false, resolvedPath: testPath })
    })

    it('should validate empty path as current directory', async () => {
      const cwd = process.cwd()
      mockFsRealpath.mockResolvedValue(cwd)

      const request = new Request('http://localhost/api/filesystem?action=validate&path=')
      const response = await loader({ request, params: {}, context: {} })
      const data = await response.json()

      expect(data.valid).toBe(true)
      expect(data.resolvedPath).toBe(cwd)
    })
  })

  describe('expand endpoint', () => {
    it('should expand tilde to home directory', async () => {
      const request = new Request('http://localhost/api/filesystem?action=expand&path=~/projects')
      const response = await loader({ request, params: {}, context: {} })
      const data = await response.json()

      expect(data.expandedPath).toBe('/Users/testuser/projects')
    })

    it('should expand relative paths', async () => {
      // Save current directory
      const originalCwd = process.cwd()
      
      // Mock process.cwd for this test
      vi.spyOn(process, 'cwd').mockReturnValue('/Users/testuser/current')

      const request = new Request('http://localhost/api/filesystem?action=expand&path=../sibling')
      const response = await loader({ request, params: {}, context: {} })
      const data = await response.json()

      expect(data.expandedPath).toBe('/Users/testuser/sibling')

      // Restore original cwd
      vi.mocked(process.cwd).mockReturnValue(originalCwd)
    })

    it('should handle absolute paths without expansion', async () => {
      const absolutePath = '/Users/testuser/absolute/path'

      const request = new Request(`http://localhost/api/filesystem?action=expand&path=${encodeURIComponent(absolutePath)}`)
      const response = await loader({ request, params: {}, context: {} })
      const data = await response.json()

      expect(data).toEqual({ expandedPath: absolutePath })
    })

    it('should handle dot notation', async () => {
      const cwd = process.cwd()

      const request = new Request('http://localhost/api/filesystem?action=expand&path=.')
      const response = await loader({ request, params: {}, context: {} })
      const data = await response.json()

      expect(data.expandedPath).toBe(cwd)
    })
  })

  describe('current endpoint', () => {
    it('should return current working directory', async () => {
      const cwd = '/Users/testuser/memva'
      vi.spyOn(process, 'cwd').mockReturnValue(cwd)

      const request = new Request('http://localhost/api/filesystem?action=current')
      const response = await loader({ request, params: {}, context: {} })
      const data = await response.json()

      expect(data).toEqual({ currentDirectory: cwd })
    })
  })

  describe('error handling', () => {
    it('should return 400 for missing action', async () => {
      const request = new Request('http://localhost/api/filesystem')
      const response = await loader({ request, params: {}, context: {} })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data).toEqual({ error: 'Invalid action' })
    })

    it('should return 400 for invalid action', async () => {
      const request = new Request('http://localhost/api/filesystem?action=invalid')
      const response = await loader({ request, params: {}, context: {} })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data).toEqual({ error: 'Invalid action' })
    })

    it('should return 400 for missing path in validate action', async () => {
      const request = new Request('http://localhost/api/filesystem?action=validate')
      const response = await loader({ request, params: {}, context: {} })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data).toEqual({ error: 'Path parameter is required' })
    })
  })
})