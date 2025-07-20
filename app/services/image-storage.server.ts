import { promises as fs } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

// Store images in user's home directory under .memva
const MEMVA_DIR = join(homedir(), '.memva')
const TEMP_DIR = join(MEMVA_DIR, 'tmp')
const SESSIONS_DIR = join(TEMP_DIR, 'sessions')

export async function saveImageToDisk(
  sessionId: string,
  fileName: string,
  buffer: Buffer
): Promise<string> {
  const sessionDir = join(SESSIONS_DIR, sessionId)
  
  // Ensure directory exists
  await fs.mkdir(sessionDir, { recursive: true })
  
  // Generate unique filename with timestamp
  const timestamp = Date.now()
  const uniqueFileName = `image-${timestamp}-${fileName}`
  const filePath = join(sessionDir, uniqueFileName)
  
  // Save file
  await fs.writeFile(filePath, buffer)
  
  return filePath
}

export async function deleteImage(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath)
  } catch (error) {
    // Ignore errors if file doesn't exist
    if ((error as { code?: string }).code !== 'ENOENT') {
      throw error
    }
  }
}

export function getImagePath(sessionId: string, fileName: string): string {
  return join(SESSIONS_DIR, sessionId, fileName)
}

export async function cleanupSessionImages(sessionId: string): Promise<void> {
  const sessionDir = join(SESSIONS_DIR, sessionId)
  
  try {
    await fs.rm(sessionDir, { recursive: true, force: true })
  } catch (error) {
    // Ignore errors if directory doesn't exist
    if ((error as { code?: string }).code !== 'ENOENT') {
      throw error
    }
  }
}