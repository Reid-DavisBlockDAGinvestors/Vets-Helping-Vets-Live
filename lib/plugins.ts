export type Plugin = {
  id: string
  name: string
  description?: string
  run?: () => Promise<void>
}

// Registry: import plugins here. Add new plugins to this list.
import disasters from '@/plugins/example.disasters.plugin'

export const registry: Plugin[] = [disasters]

export function getPlugins(): Plugin[] {
  return registry
}
