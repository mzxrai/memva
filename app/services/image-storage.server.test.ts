import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { promises as fs } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { saveImageToDisk, deleteImage, getImagePath, cleanupSessionImages } from './image-storage.server'

describe('Image Storage Service', () => {
  const testSessionId = 'test-session-123'
  const testMemvaDir = join(homedir(), '.memva', 'tmp', 'sessions')
  const testImageDir = join(testMemvaDir, testSessionId)
  
  beforeEach(async () => {
    vi.clearAllMocks()
    // Ensure test directory doesn't exist before each test
    try {
      await fs.rm(testImageDir, { recursive: true, force: true })
    } catch (error) {
      // Only ignore ENOENT errors (file not found)
      if ((error as { code?: string }).code !== 'ENOENT') {
        throw error
      }
    }
  })

  afterEach(async () => {
    // Clean up test directory after each test
    try {
      await fs.rm(join(homedir(), '.memva', 'tmp'), { recursive: true, force: true })
    } catch (error) {
      // Only ignore ENOENT errors (file not found)
      if ((error as { code?: string }).code !== 'ENOENT') {
        throw error
      }
    }
  })

  it('should save image to disk and return file path', async () => {
    const imageBuffer = Buffer.from('fake image data')
    const fileName = 'test-image.jpg'
    
    const filePath = await saveImageToDisk(testSessionId, fileName, imageBuffer)
    
    expect(filePath).toMatch(/\.tmp\/sessions\/test-session-123\/image-\d+-test-image\.jpg$/)
    
    // Verify file exists
    const fileExists = await fs.access(filePath).then(() => true).catch(() => false)
    expect(fileExists).toBe(true)
    
    // Verify file content
    const savedContent = await fs.readFile(filePath)
    expect(savedContent.toString()).toBe('fake image data')
  })

  it('should create directory structure if it does not exist', async () => {
    const imageBuffer = Buffer.from('fake image data')
    const fileName = 'test-image.jpg'
    
    // Directory shouldn't exist initially
    const dirExists = await fs.access(testImageDir).then(() => true).catch(() => false)
    expect(dirExists).toBe(false)
    
    await saveImageToDisk(testSessionId, fileName, imageBuffer)
    
    // Directory should exist after saving
    const dirExistsAfter = await fs.access(testImageDir).then(() => true).catch(() => false)
    expect(dirExistsAfter).toBe(true)
  })

  it('should generate unique file names with timestamp', async () => {
    const imageBuffer = Buffer.from('fake image data')
    const fileName = 'test-image.jpg'
    
    const filePath1 = await saveImageToDisk(testSessionId, fileName, imageBuffer)
    
    // Small delay to ensure different timestamp
    await new Promise(resolve => setTimeout(resolve, 10))
    
    const filePath2 = await saveImageToDisk(testSessionId, fileName, imageBuffer)
    
    expect(filePath1).not.toBe(filePath2)
    expect(filePath1).toMatch(/image-\d+-test-image\.jpg$/)
    expect(filePath2).toMatch(/image-\d+-test-image\.jpg$/)
  })

  it('should delete image file', async () => {
    const imageBuffer = Buffer.from('fake image data')
    const fileName = 'test-image.jpg'
    
    const filePath = await saveImageToDisk(testSessionId, fileName, imageBuffer)
    
    // Verify file exists
    const fileExists = await fs.access(filePath).then(() => true).catch(() => false)
    expect(fileExists).toBe(true)
    
    await deleteImage(filePath)
    
    // Verify file no longer exists
    const fileExistsAfter = await fs.access(filePath).then(() => true).catch(() => false)
    expect(fileExistsAfter).toBe(false)
  })

  it('should handle deletion of non-existent file gracefully', async () => {
    const nonExistentPath = join(testImageDir, 'non-existent.jpg')
    
    // Should not throw
    await expect(deleteImage(nonExistentPath)).resolves.not.toThrow()
  })

  it('should get correct image path for session', () => {
    const sessionId = 'test-session'
    const fileName = 'image-123-test.jpg'
    
    const path = getImagePath(sessionId, fileName)
    
    expect(path).toBe(join(process.cwd(), '.tmp', 'sessions', sessionId, fileName))
  })

  it('should cleanup all images for a session', async () => {
    const imageBuffer = Buffer.from('fake image data')
    
    // Create multiple images
    const filePath1 = await saveImageToDisk(testSessionId, 'image1.jpg', imageBuffer)
    const filePath2 = await saveImageToDisk(testSessionId, 'image2.jpg', imageBuffer)
    const filePath3 = await saveImageToDisk(testSessionId, 'image3.jpg', imageBuffer)
    
    // Verify all files exist
    expect(await fs.access(filePath1).then(() => true).catch(() => false)).toBe(true)
    expect(await fs.access(filePath2).then(() => true).catch(() => false)).toBe(true)
    expect(await fs.access(filePath3).then(() => true).catch(() => false)).toBe(true)
    
    await cleanupSessionImages(testSessionId)
    
    // Verify directory and all files are gone
    const dirExists = await fs.access(testImageDir).then(() => true).catch(() => false)
    expect(dirExists).toBe(false)
  })

  it('should handle cleanup of non-existent session gracefully', async () => {
    const nonExistentSessionId = 'non-existent-session'
    
    // Should not throw
    await expect(cleanupSessionImages(nonExistentSessionId)).resolves.not.toThrow()
  })

  it('should preserve file extension when saving', async () => {
    const imageBuffer = Buffer.from('fake image data')
    
    const jpgPath = await saveImageToDisk(testSessionId, 'test.jpg', imageBuffer)
    expect(jpgPath).toMatch(/\.jpg$/)
    
    const pngPath = await saveImageToDisk(testSessionId, 'test.png', imageBuffer)
    expect(pngPath).toMatch(/\.png$/)
    
    const gifPath = await saveImageToDisk(testSessionId, 'test.gif', imageBuffer)
    expect(gifPath).toMatch(/\.gif$/)
  })
})