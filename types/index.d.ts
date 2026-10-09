export type Decision = { text: string; at: number }

declare module 'claude-code' {
  interface PluginState {
    'decision-tracker': { decisions: Decision[]; isExpanded: boolean }
  }
}
