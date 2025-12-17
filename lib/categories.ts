/**
 * Fundraiser Categories Configuration
 * 
 * Centralized category definitions for the PatriotPledge platform.
 * Used across submission forms, admin panels, and display components.
 */

export type CategoryId = 
  | 'veteran'
  | 'medical'
  | 'children'
  | 'pets'
  | 'disaster'
  | 'education'
  | 'community'
  | 'other'

export interface Category {
  id: CategoryId
  label: string
  emoji: string
  description: string
  color: string // Tailwind color class prefix (e.g., 'red' for bg-red-500)
}

export const CATEGORIES: Category[] = [
  {
    id: 'veteran',
    label: 'Veteran / Military',
    emoji: '🎖️',
    description: 'Support for veterans, active military, and their families',
    color: 'red'
  },
  {
    id: 'medical',
    label: 'Medical Expenses',
    emoji: '🏥',
    description: 'Medical bills, treatments, surgeries, and healthcare costs',
    color: 'pink'
  },
  {
    id: 'children',
    label: 'Children & Youth',
    emoji: '👶',
    description: 'Support for children, youth programs, and family needs',
    color: 'purple'
  },
  {
    id: 'pets',
    label: 'Pets & Animals',
    emoji: '🐾',
    description: 'Veterinary care, animal rescue, and pet welfare',
    color: 'amber'
  },
  {
    id: 'disaster',
    label: 'Natural Disaster',
    emoji: '🌪️',
    description: 'Recovery from hurricanes, floods, fires, and other disasters',
    color: 'orange'
  },
  {
    id: 'education',
    label: 'Education',
    emoji: '📚',
    description: 'Tuition, school supplies, scholarships, and learning programs',
    color: 'indigo'
  },
  {
    id: 'community',
    label: 'Community',
    emoji: '🤝',
    description: 'Local initiatives, neighborhood projects, and civic causes',
    color: 'teal'
  },
  {
    id: 'other',
    label: 'Other',
    emoji: '💙',
    description: 'Other fundraising needs not covered by specific categories',
    color: 'blue'
  }
]

// Helper to get category by ID
export function getCategoryById(id: string): Category | undefined {
  return CATEGORIES.find(c => c.id === id)
}

// Helper to get category label with emoji
export function getCategoryLabel(id: string): string {
  const cat = getCategoryById(id)
  return cat ? `${cat.emoji} ${cat.label}` : id
}

// Helper to get Tailwind classes for a category
export function getCategoryClasses(id: string, variant: 'bg' | 'text' | 'border' = 'bg'): string {
  const cat = getCategoryById(id)
  const color = cat?.color || 'gray'
  
  switch (variant) {
    case 'bg':
      return `bg-${color}-500`
    case 'text':
      return `text-${color}-400`
    case 'border':
      return `border-${color}-500`
    default:
      return `bg-${color}-500`
  }
}

// Default category for new submissions
export const DEFAULT_CATEGORY: CategoryId = 'other'

// Legacy category mapping (for backwards compatibility)
export function mapLegacyCategory(category: string): CategoryId {
  if (category === 'general') return 'other'
  if (CATEGORIES.find(c => c.id === category)) return category as CategoryId
  return 'other'
}
