import { db } from './index'
import { settings } from './schema'
import { eq } from 'drizzle-orm'

import type { SettingsConfig, PermissionMode } from '../types/settings'
import { PERMISSION_MODES } from '../types/settings'

export { type SettingsConfig, type PermissionMode }

const DEFAULT_CONFIG: SettingsConfig = {
  maxTurns: 200,
  permissionMode: 'acceptEdits'
}

const SETTINGS_ID = 'singleton'

export async function getSettings(): Promise<SettingsConfig> {
  const result = db.select().from(settings).where(eq(settings.id, SETTINGS_ID)).get()
  
  if (!result) {
    // Create default settings if they don't exist
    await createDefaultSettings()
    return DEFAULT_CONFIG
  }
  
  const config = result.config as SettingsConfig
  
  // Merge with defaults to handle missing fields
  return {
    maxTurns: config.maxTurns ?? DEFAULT_CONFIG.maxTurns,
    permissionMode: config.permissionMode ?? DEFAULT_CONFIG.permissionMode,
    defaultDirectory: config.defaultDirectory
  }
}

export async function updateSettings(config: Partial<SettingsConfig>): Promise<void> {
  const currentSettings = await getSettings()
  const newConfig = { ...currentSettings, ...config }
  
  // Validate settings
  if (newConfig.maxTurns < 1 || newConfig.maxTurns > 1000) {
    throw new Error('maxTurns must be between 1 and 1000')
  }
  
  if (!PERMISSION_MODES.includes(newConfig.permissionMode)) {
    throw new Error(`Invalid permission mode: ${newConfig.permissionMode}`)
  }
  
  await db.update(settings)
    .set({
      config: newConfig,
      updated_at: new Date().toISOString()
    })
    .where(eq(settings.id, SETTINGS_ID))
    .run()
}

async function createDefaultSettings(): Promise<void> {
  db.insert(settings).values({
    id: SETTINGS_ID,
    config: DEFAULT_CONFIG,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }).run()
}