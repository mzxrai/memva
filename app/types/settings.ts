export type PermissionMode = 'acceptEdits' | 'bypassPermissions' | 'plan'

export interface SettingsConfig {
  maxTurns: number
  permissionMode: PermissionMode
}