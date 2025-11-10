# Plugins

A lightweight plugins system for PatriotPledge NFTs. Drop TypeScript modules into this folder to add features or cause categories without modifying core code.

- Each plugin exports `{ id: string, name: string, description?: string, run?: () => Promise<void>, routes?: RouteDef[] }`.
- The registry loads all `*.plugin.ts` files server-side and exposes metadata to the UI.
- Use for new causes, automations, or integrations.
