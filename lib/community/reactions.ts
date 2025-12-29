/**
 * Community reaction types for charitable/heartfelt fundraising
 */

export const REACTION_TYPES = ['love', 'pray', 'encourage', 'celebrate', 'care'] as const
export type ReactionType = typeof REACTION_TYPES[number]

export const REACTION_EMOJIS: Record<ReactionType, string> = {
  love: '❤️',
  pray: '🙏',
  encourage: '💪',
  celebrate: '🎉',
  care: '😢'
}

export function isValidReactionType(type: string): type is ReactionType {
  return REACTION_TYPES.includes(type as ReactionType)
}
