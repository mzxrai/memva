export type PermissionMode = 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan'

export const PERMISSION_MODES: readonly PermissionMode[] = ['default', 'acceptEdits', 'bypassPermissions', 'plan'] as const

export interface SettingsConfig {
  maxTurns: number
  permissionMode: PermissionMode
  defaultDirectory?: string
}