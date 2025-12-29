/**
 * User Account Module Types - Following ISP principles
 * Each interface is focused on a single responsibility
 */

/**
 * User permissions structure
 */
export interface UserPermissions {
  canManageCampaigns: boolean
  canApproveUpdates: boolean
  canManageAdmins: boolean
  canViewDashboard: boolean
}

/**
 * User profile from admin API
 */
export interface UserProfile {
  id: string
  email: string
  role: string
  permissions?: UserPermissions
}

/**
 * Community profile for social features
 */
export interface CommunityProfile {
  display_name: string
  first_name: string | null
  last_name: string | null
  bio: string | null
  avatar_url: string | null
  cover_url: string | null
  website_url: string | null
  twitter_handle: string | null
}

/**
 * Auth mode for the auth modal
 */
export type AuthMode = 'login' | 'signup' | 'forgot'

/**
 * Auth form state
 */
export interface AuthFormState {
  email: string
  password: string
  firstName: string
  lastName: string
  company: string
}

/**
 * Profile edit form state
 */
export interface ProfileEditState {
  displayName: string
  firstName: string
  lastName: string
  bio: string
  twitter: string
  website: string
}

/**
 * Role badge configuration
 */
export interface RoleBadge {
  bg: string
  text: string
  label: string
}

/**
 * Role badges mapping
 */
export const ROLE_BADGES: Record<string, RoleBadge> = {
  super_admin: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Super Admin' },
  admin: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Admin' },
  moderator: { bg: 'bg-purple-500/20', text: 'text-purple-400', label: 'Moderator' },
  viewer: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Viewer' },
  user: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Member' },
}

/**
 * Auth modal props
 */
export interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  mode: AuthMode
  onModeChange: (mode: AuthMode) => void
  formState: AuthFormState
  onFormChange: (updates: Partial<AuthFormState>) => void
  onSubmit: () => void
  loading: boolean
  message: string
}

/**
 * Profile modal props
 */
export interface ProfileModalProps {
  isOpen: boolean
  onClose: () => void
  user: any
  communityProfile: CommunityProfile | null
  editState: ProfileEditState
  onEditChange: (updates: Partial<ProfileEditState>) => void
  onSave: () => void
  onAvatarUpload: (file: File) => void
  loading: boolean
  uploadingAvatar: boolean
  message: string
}

/**
 * User dropdown props
 */
export interface UserDropdownProps {
  isOpen: boolean
  user: any
  profile: UserProfile | null
  communityProfile: CommunityProfile | null
  onEditProfile: () => void
  onLogout: () => void
}

/**
 * Wallet section props
 */
export interface WalletSectionProps {
  address: string | null
  isConnected: boolean
  balance: string | null
  isOnBlockDAG: boolean
  onDisconnect: () => void
  onSwitchNetwork: () => void
}
